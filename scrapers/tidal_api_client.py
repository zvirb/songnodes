"""
Fixed Tidal Music Service API Client
Handles OAuth authentication, playlist creation, and track availability checking
"""
import asyncio
import json
import logging
import os
import tempfile
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
import concurrent.futures
from pathlib import Path

try:
    import tidalapi
except ImportError:
    tidalapi = None
    print("Warning: tidalapi not installed. Run: pip install tidalapi")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class TidalCredentials:
    """Tidal OAuth credentials"""
    session_file: Optional[str] = None
    user_id: Optional[str] = None
    country_code: Optional[str] = None
    auth_status: str = "not_authenticated"  # not_authenticated, pending, authenticated

@dataclass
class TidalTrack:
    """Tidal track information"""
    id: int
    name: str
    artist: str
    album: str
    duration: int
    isrc: Optional[str] = None
    explicit: bool = False
    available: bool = True
    url: Optional[str] = None

@dataclass
class TidalPlaylist:
    """Tidal playlist information"""
    id: str
    name: str
    description: str
    track_count: int
    duration: int
    public: bool = False
    url: Optional[str] = None
    created_at: Optional[datetime] = None

class TidalAPIClient:
    """
    Tidal API client with OAuth authentication and async support
    """

    def __init__(self, db_pipeline=None):
        self.session: Optional[tidalapi.Session] = None
        self.db_pipeline = db_pipeline
        self._authenticated = False
        self._last_auth_check: Optional[datetime] = None
        self.credentials: Optional[TidalCredentials] = None
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        self._session_file = os.path.join(tempfile.gettempdir(), "songnodes_tidal_session.json")

    async def get_auth_status(self) -> Dict[str, Any]:
        """Get current authentication status"""
        if not self.session:
            return {
                "authenticated": False,
                "status": "not_initialized",
                "message": "Session not initialized"
            }

        # Check authentication in thread pool
        def _check_auth():
            try:
                return self.session.check_login()
            except Exception as e:
                logger.error(f"Error checking auth status: {e}")
                return False

        is_authenticated = await asyncio.get_event_loop().run_in_executor(
            self._executor, _check_auth
        )

        self._authenticated = is_authenticated

        return {
            "authenticated": is_authenticated,
            "status": "authenticated" if is_authenticated else "not_authenticated",
            "user_id": getattr(self.session, 'user', {}).get('id') if is_authenticated else None,
            "last_check": self._last_auth_check.isoformat() if self._last_auth_check else None
        }

    async def start_oauth_flow(self) -> Dict[str, Any]:
        """
        Start OAuth authentication flow
        """
        try:
            def _start_oauth():
                self.session = tidalapi.Session()

                # Check if we have a valid existing session
                if os.path.exists(self._session_file):
                    try:
                        if self.session.login_session_file(self._session_file):
                            return {
                                "success": True,
                                "authenticated": True,
                                "message": "Already authenticated using existing session"
                            }
                    except Exception as e:
                        logger.warning(f"Failed to load existing session: {e}")

                # Start new OAuth flow
                link_login, future = self.session.login_oauth()

                return {
                    "success": True,
                    "authenticated": False,
                    "auth_url": link_login.verification_uri_complete,
                    "user_code": link_login.user_code,
                    "device_code": link_login.device_code,
                    "expires_in": link_login.expires_in,
                    "message": f"Visit {link_login.verification_uri_complete} to authenticate",
                    "instructions": f"Enter this code when prompted: {link_login.user_code}"
                }

            result = await asyncio.get_event_loop().run_in_executor(
                self._executor, _start_oauth
            )

            if result.get("authenticated"):
                self._authenticated = True
                self._last_auth_check = datetime.now()

            return result

        except Exception as e:
            logger.error(f"OAuth flow error: {e}")
            return {
                "success": False,
                "message": f"Failed to start OAuth flow: {str(e)}"
            }

    async def check_oauth_completion(self) -> Dict[str, Any]:
        """
        Check if OAuth authentication has been completed
        """
        try:
            def _check_completion():
                if not self.session:
                    return {"success": False, "message": "No session"}

                if self.session.check_login():
                    # Save session for future use
                    self.session.save_session_to_file(self._session_file)
                    return {
                        "success": True,
                        "authenticated": True,
                        "user_id": getattr(self.session.user, 'id', None) if hasattr(self.session, 'user') else None,
                        "message": "Authentication completed successfully"
                    }
                else:
                    return {
                        "success": True,
                        "authenticated": False,
                        "message": "Authentication still pending"
                    }

            result = await asyncio.get_event_loop().run_in_executor(
                self._executor, _check_completion
            )

            if result.get("authenticated"):
                self._authenticated = True
                self._last_auth_check = datetime.now()

            return result

        except Exception as e:
            logger.error(f"Error checking OAuth completion: {e}")
            return {
                "success": False,
                "message": f"Error checking authentication: {str(e)}"
            }

    async def search_tracks(self, query: str, limit: int = 50) -> List[TidalTrack]:
        """
        Search for tracks on Tidal
        """
        if not self._authenticated:
            raise Exception("Not authenticated with Tidal")

        def _search():
            try:
                search_results = self.session.search(query, models=[tidalapi.Track], limit=limit)
                tracks = []

                for track in search_results.get('tracks', []):
                    tracks.append(TidalTrack(
                        id=track.id,
                        name=track.name,
                        artist=track.artist.name if track.artist else "Unknown Artist",
                        album=track.album.name if track.album else "Unknown Album",
                        duration=track.duration or 0,
                        isrc=getattr(track, 'isrc', None),
                        explicit=getattr(track, 'explicit', False),
                        available=True,
                        url=getattr(track, 'tidal_url', None)
                    ))

                return tracks

            except Exception as e:
                logger.error(f"Search error: {e}")
                return []

        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _search
        )

    async def check_track_availability(self, song_data: Dict[str, Any]) -> Optional[TidalTrack]:
        """
        Check if a track is available on Tidal
        """
        if not self._authenticated:
            return None

        def _check_availability():
            try:
                # Build search query
                artist = song_data.get('artist', '')
                title = song_data.get('title', '')
                isrc = song_data.get('isrc', '')

                # Try ISRC first if available
                if isrc:
                    try:
                        tracks = self.session.get_tracks_by_isrc(isrc)
                        if tracks:
                            track = tracks[0]
                            return TidalTrack(
                                id=track.id,
                                name=track.name,
                                artist=track.artist.name if track.artist else "Unknown Artist",
                                album=track.album.name if track.album else "Unknown Album",
                                duration=track.duration or 0,
                                isrc=isrc,
                                explicit=getattr(track, 'explicit', False),
                                available=True,
                                url=getattr(track, 'tidal_url', None)
                            )
                    except Exception as e:
                        logger.debug(f"ISRC search failed: {e}")

                # Fall back to text search
                if artist and title:
                    query = f"{artist} {title}"
                    search_results = self.session.search(query, models=[tidalapi.Track], limit=5)

                    for track in search_results.get('tracks', []):
                        # Simple matching logic
                        track_artist = track.artist.name.lower() if track.artist else ""
                        track_title = track.name.lower()

                        if (artist.lower() in track_artist or track_artist in artist.lower()) and \
                           (title.lower() in track_title or track_title in title.lower()):
                            return TidalTrack(
                                id=track.id,
                                name=track.name,
                                artist=track.artist.name if track.artist else "Unknown Artist",
                                album=track.album.name if track.album else "Unknown Album",
                                duration=track.duration or 0,
                                isrc=getattr(track, 'isrc', None),
                                explicit=getattr(track, 'explicit', False),
                                available=True,
                                url=getattr(track, 'tidal_url', None)
                            )

                return None

            except Exception as e:
                logger.error(f"Track availability check error: {e}")
                return None

        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _check_availability
        )

    async def create_playlist(self, name: str, description: str = "", public: bool = False) -> Optional[TidalPlaylist]:
        """
        Create a new playlist on Tidal
        """
        if not self._authenticated:
            return None

        def _create_playlist():
            try:
                playlist = self.session.user.create_playlist(title=name, description=description)

                if playlist:
                    return TidalPlaylist(
                        id=str(playlist.id),
                        name=playlist.name,
                        description=playlist.description or "",
                        track_count=playlist.num_tracks or 0,
                        duration=playlist.duration or 0,
                        public=False,  # Tidal doesn't seem to support public flag in API
                        url=getattr(playlist, 'tidal_url', None),
                        created_at=datetime.now()
                    )
                return None

            except Exception as e:
                logger.error(f"Playlist creation error: {e}")
                return None

        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _create_playlist
        )

    async def get_user_playlists(self) -> List[TidalPlaylist]:
        """
        Get user's playlists from Tidal
        """
        if not self._authenticated:
            return []

        def _get_playlists():
            try:
                playlists = []
                user_playlists = self.session.user.playlists()

                for playlist in user_playlists:
                    playlists.append(TidalPlaylist(
                        id=str(playlist.id),
                        name=playlist.name,
                        description=playlist.description or "",
                        track_count=playlist.num_tracks or 0,
                        duration=playlist.duration or 0,
                        public=False,
                        url=getattr(playlist, 'tidal_url', None),
                        created_at=getattr(playlist, 'created_at', None)
                    ))

                return playlists

            except Exception as e:
                logger.error(f"Error getting playlists: {e}")
                return []

        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _get_playlists
        )

    async def add_tracks_to_playlist(self, playlist_id: str, track_ids: List[int]) -> bool:
        """
        Add tracks to an existing playlist
        """
        if not self._authenticated:
            return False

        def _add_tracks():
            try:
                playlist = self.session.playlist(playlist_id)
                if not playlist:
                    return False

                # Get track objects
                tracks = []
                for track_id in track_ids:
                    track = self.session.track(track_id)
                    if track:
                        tracks.append(track)

                if tracks:
                    playlist.add(tracks)
                    return True
                return False

            except Exception as e:
                logger.error(f"Error adding tracks to playlist: {e}")
                return False

        return await asyncio.get_event_loop().run_in_executor(
            self._executor, _add_tracks
        )

    async def create_setlist_playlist(self, setlist_tracks: List[Dict], playlist_name: str) -> Optional[TidalPlaylist]:
        """
        Create a playlist from a setlist
        """
        # Create the playlist first
        playlist = await self.create_playlist(playlist_name)
        if not playlist:
            return None

        # Find tracks and add them
        track_ids = []
        for track_data in setlist_tracks:
            tidal_track = await self.check_track_availability(track_data)
            if tidal_track:
                track_ids.append(tidal_track.id)

        if track_ids:
            await self.add_tracks_to_playlist(playlist.id, track_ids)

        return playlist

    async def bulk_check_availability(self, limit: int = 100) -> Dict[str, Any]:
        """
        Bulk check track availability (placeholder for database integration)
        """
        # This would integrate with the database to check many tracks
        # For now, return a summary
        return {
            "checked": 0,
            "available": 0,
            "not_available": 0,
            "message": "Bulk availability checking requires database integration"
        }

    def __del__(self):
        """Cleanup thread pool"""
        if hasattr(self, '_executor'):
            self._executor.shutdown(wait=False)

# Factory function
def create_tidal_client(db_pipeline=None) -> TidalAPIClient:
    """Create a Tidal API client instance"""
    return TidalAPIClient(db_pipeline)

# Test function
async def test_tidal_oauth() -> bool:
    """
    Test Tidal OAuth flow (for development only)
    """
    try:
        client = TidalAPIClient()

        # Start OAuth flow
        auth_result = await client.start_oauth_flow()

        if auth_result.get("authenticated"):
            return True

        if auth_result.get("success"):
            print(f"Visit: {auth_result.get('auth_url')}")
            print(f"Code: {auth_result.get('user_code')}")

            # In a real application, you'd wait for user to complete auth
            # For testing, we just return the status
            return False

        return False

    except Exception as e:
        logger.error(f"Error testing Tidal OAuth: {e}")
        return False

# Export main classes and functions
__all__ = [
    'TidalAPIClient',
    'TidalCredentials',
    'TidalTrack',
    'TidalPlaylist',
    'create_tidal_client',
    'test_tidal_oauth'
]