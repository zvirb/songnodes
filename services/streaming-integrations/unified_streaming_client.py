"""
Unified Streaming Platform Client for SongNodes
Provides a consistent interface for interacting with multiple music streaming platforms
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
import concurrent.futures
import tempfile
import psutil
from contextlib import asynccontextmanager

import asyncpg


@dataclass
class TrackMetadata:
    """Standardized track metadata across all streaming platforms."""
    # Core identification
    title: str
    artist: str
    album: str

    # Platform IDs - all platform IDs in one place
    spotify_id: Optional[str] = None
    tidal_id: Optional[Union[str, int]] = None
    beatport_id: Optional[Union[str, int]] = None
    apple_music_id: Optional[str] = None
    soundcloud_id: Optional[Union[str, int]] = None
    deezer_id: Optional[Union[str, int]] = None
    youtube_music_id: Optional[str] = None

    # Audio characteristics
    duration: Optional[int] = None  # Duration in seconds
    bpm: Optional[float] = None
    key: Optional[str] = None
    genre: Optional[str] = None

    # Release information
    isrc: Optional[str] = None
    label: Optional[str] = None
    release_year: Optional[int] = None

    # Additional metadata for compatibility
    duration_ms: Optional[int] = None  # Duration in milliseconds
    artist_name: Optional[str] = None  # Alias for artist
    album_name: Optional[str] = None   # Alias for album
    platform: Optional[str] = None     # Source platform for this specific metadata
    platform_id: Optional[Union[str, int]] = None  # Source platform ID
    track_number: Optional[int] = None
    popularity: Optional[int] = None
    preview_url: Optional[str] = None
    external_urls: Optional[Dict[str, str]] = field(default_factory=dict)
    additional_metadata: Optional[Dict[str, Any]] = field(default_factory=dict)

    def __post_init__(self):
        """Post-processing to handle aliases and consistency."""
        # Handle artist name alias
        if self.artist_name and not self.artist:
            self.artist = self.artist_name
        elif self.artist and not self.artist_name:
            self.artist_name = self.artist

        # Handle album name alias
        if self.album_name and not self.album:
            self.album = self.album_name
        elif self.album and not self.album_name:
            self.album_name = self.album

        # Convert duration_ms to duration if needed
        if self.duration_ms and not self.duration:
            self.duration = self.duration_ms // 1000
        elif self.duration and not self.duration_ms:
            self.duration_ms = self.duration * 1000

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage."""
        return {
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "spotify_id": self.spotify_id,
            "tidal_id": self.tidal_id,
            "beatport_id": self.beatport_id,
            "apple_music_id": self.apple_music_id,
            "soundcloud_id": self.soundcloud_id,
            "deezer_id": self.deezer_id,
            "youtube_music_id": self.youtube_music_id,
            "duration": self.duration,
            "bpm": self.bpm,
            "key": self.key,
            "genre": self.genre,
            "isrc": self.isrc,
            "label": self.label,
            "release_year": self.release_year,
            "track_number": self.track_number,
            "popularity": self.popularity,
            "preview_url": self.preview_url,
            "external_urls": self.external_urls,
            "additional_metadata": self.additional_metadata,
        }

    def get_platform_ids(self) -> Dict[str, Union[str, int]]:
        """Get all platform IDs as a dictionary."""
        platform_ids = {}
        for platform in ['spotify', 'tidal', 'beatport', 'apple_music', 'soundcloud', 'deezer', 'youtube_music']:
            platform_id = getattr(self, f'{platform}_id')
            if platform_id:
                platform_ids[f'{platform}_id'] = platform_id
        return platform_ids


@dataclass
class SearchResult:
    """Search result containing track metadata and confidence score."""
    track: TrackMetadata
    confidence: float  # 0.0 to 1.0, higher is better match
    search_query: str
    exact_match: bool = False


class StreamingPlatformClient(ABC):
    """Abstract base class for streaming platform clients."""

    def __init__(self, platform_name: str, enabled: bool = True):
        self.platform_name = platform_name
        self.enabled = enabled
        self.logger = logging.getLogger(f"{__name__}.{platform_name}")
        self._initialized = False

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the client (authentication, setup, etc.)."""
        pass

    @abstractmethod
    async def search_track(
        self,
        title: str,
        artist: str,
        isrc: Optional[str] = None,
        **kwargs
    ) -> List[SearchResult]:
        """Search for tracks on the platform."""
        pass

    @abstractmethod
    async def get_track_by_id(self, track_id: Union[str, int]) -> Optional[TrackMetadata]:
        """Get track metadata by platform-specific ID."""
        pass

    async def shutdown(self) -> None:
        """Clean up resources with proper memory management."""
        self._initialized = False

        # Shutdown thread pool executor
        if self._executor:
            try:
                self._executor.shutdown(wait=True, timeout=5.0)
            except Exception as e:
                self.logger.warning(f"Error shutting down executor: {e}")
            finally:
                self._executor = None

        # Clear session to free memory
        self.session = None
        self._connection_count = 0


class TidalClient(StreamingPlatformClient):
    """TIDAL streaming platform client integrating with existing TidalAPIClient."""

    def __init__(self, enabled: bool = None):
        if enabled is None:
            enabled = os.getenv("ENABLE_TIDAL_INTEGRATION", "0").lower() in {"1", "true", "yes"}

        super().__init__("tidal", enabled)
        self.session = None
        self.session_file = os.getenv("TIDAL_SESSION_FILE", os.path.expanduser("~/.tidal-session.json"))
        self._executor = None
        self._connection_count = 0
        self._max_connections = 10

    async def initialize(self) -> None:
        """Initialize TIDAL client with authentication."""
        if not self.enabled:
            raise RuntimeError("TIDAL integration is disabled")

        try:
            import tidalapi  # type: ignore
        except ImportError:
            raise RuntimeError("tidalapi package not installed")

        # Create thread pool with limited workers to prevent memory bloat
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=2,
            thread_name_prefix="tidal_client"
        )

        self.session = tidalapi.Session()
        await asyncio.to_thread(self._login)
        self._initialized = True
        self.logger.info("TIDAL client initialized successfully")

    def _login(self) -> None:
        """Handle TIDAL authentication."""
        if os.path.exists(self.session_file):
            try:
                self.session.load_session_from_file(self.session_file)
                if self.session.check_login():
                    self.logger.info("Loaded existing TIDAL session")
                    return
            except Exception as e:
                self.logger.warning(f"Failed to load session: {e}")

        self.logger.info("Starting TIDAL OAuth flow")
        success = self.session.login_oauth_simple()
        if not success:
            raise RuntimeError("TIDAL OAuth login failed")

        self.session.save_session(self.session_file)
        self.logger.info("TIDAL session saved successfully")

    async def search_track(
        self,
        title: str,
        artist: str,
        isrc: Optional[str] = None,
        **kwargs
    ) -> List[SearchResult]:
        """Search for tracks on TIDAL."""
        if not self._initialized:
            await self.initialize()

        results = []

        # Enforce connection limits
        if self._connection_count >= self._max_connections:
            self.logger.warning(f"Connection limit reached ({self._max_connections}), skipping search")
            return []

        try:
            self._connection_count += 1

            # Try ISRC search first if available
            if isrc:
                isrc_results = await asyncio.get_event_loop().run_in_executor(
                    self._executor, self._search_by_isrc, isrc
                )
                results.extend(isrc_results)

            # Text-based search
            text_results = await asyncio.get_event_loop().run_in_executor(
                self._executor, self._search_by_text, title, artist
            )
            results.extend(text_results)

        finally:
            self._connection_count -= 1

        return results

    def _search_by_isrc(self, isrc: str) -> List[SearchResult]:
        """Search by ISRC code."""
        try:
            search_result = self.session.search("track", isrc)
            tracks = getattr(search_result, "tracks", [])

            results = []
            for track in tracks:
                if getattr(track, "isrc", None) == isrc:
                    metadata = self._convert_tidal_track(track)
                    results.append(SearchResult(
                        track=metadata,
                        confidence=1.0,  # ISRC match is exact
                        search_query=f"ISRC:{isrc}",
                        exact_match=True
                    ))
            return results
        except Exception as e:
            self.logger.debug(f"ISRC search failed: {e}")
            return []

    def _search_by_text(self, title: str, artist: str) -> List[SearchResult]:
        """Search by title and artist."""
        try:
            query = f"{title} {artist}"
            search_result = self.session.search("track", query)
            tracks = getattr(search_result, "tracks", [])

            results = []
            for i, track in enumerate(tracks[:5]):  # Limit to top 5 results
                metadata = self._convert_tidal_track(track)

                # Calculate confidence based on string similarity and position
                confidence = self._calculate_match_confidence(title, artist, track)
                confidence = max(0.1, confidence - (i * 0.1))  # Reduce confidence for lower positions

                results.append(SearchResult(
                    track=metadata,
                    confidence=confidence,
                    search_query=query,
                    exact_match=False
                ))

            return results
        except Exception as e:
            self.logger.debug(f"Text search failed: {e}")
            return []

    def _convert_tidal_track(self, track) -> TrackMetadata:
        """Convert TIDAL track object to standardized metadata."""
        return TrackMetadata(
            title=track.name,
            artist=track.artist.name if track.artist else "",
            album=track.album.name if track.album else "",
            tidal_id=int(track.id),
            isrc=getattr(track, "isrc", None),
            duration_ms=getattr(track, "duration", None),
            bpm=getattr(track, "bpm", None),
            platform="tidal",
            platform_id=int(track.id),
            track_number=getattr(track, "track_num", None),
            additional_metadata={
                "tidal_url": getattr(track, "url", None),
                "quality": getattr(track, "audio_quality", None),
            }
        )

    def _calculate_match_confidence(self, title: str, artist: str, track) -> float:
        """Calculate confidence score for track match."""
        import difflib

        title_similarity = difflib.SequenceMatcher(None, title.lower(), track.name.lower()).ratio()
        artist_similarity = difflib.SequenceMatcher(
            None,
            artist.lower(),
            track.artist.name.lower() if track.artist else ""
        ).ratio()

        # Weighted average: title is more important
        return (title_similarity * 0.7) + (artist_similarity * 0.3)

    async def get_track_by_id(self, track_id: Union[str, int]) -> Optional[TrackMetadata]:
        """Get track by TIDAL ID."""
        if not self._initialized:
            await self.initialize()

        # Enforce connection limits
        if self._connection_count >= self._max_connections:
            self.logger.warning(f"Connection limit reached ({self._max_connections}), skipping track lookup")
            return None

        try:
            self._connection_count += 1
            track = await asyncio.get_event_loop().run_in_executor(
                self._executor, self.session.track, int(track_id)
            )
            return self._convert_tidal_track(track)
        except Exception as e:
            self.logger.error(f"Failed to get track {track_id}: {e}")
            return None
        finally:
            self._connection_count -= 1


class SpotifyClient(StreamingPlatformClient):
    """Spotify streaming platform client (placeholder implementation)."""

    def __init__(self, enabled: bool = None):
        if enabled is None:
            enabled = os.getenv("ENABLE_SPOTIFY_INTEGRATION", "0").lower() in {"1", "true", "yes"}
        super().__init__("spotify", enabled)

    async def initialize(self) -> None:
        """Initialize Spotify client."""
        if not self.enabled:
            raise RuntimeError("Spotify integration is disabled")

        # TODO: Implement Spotify Web API authentication
        self.logger.warning("Spotify client is a placeholder implementation")
        self._initialized = True

    async def search_track(
        self,
        title: str,
        artist: str,
        isrc: Optional[str] = None,
        **kwargs
    ) -> List[SearchResult]:
        """Search for tracks on Spotify."""
        # TODO: Implement Spotify search
        self.logger.debug(f"Spotify search: {title} by {artist}")
        return []

    async def get_track_by_id(self, track_id: Union[str, int]) -> Optional[TrackMetadata]:
        """Get track by Spotify ID."""
        # TODO: Implement Spotify track lookup
        return None


class BeatportClient(StreamingPlatformClient):
    """Beatport streaming platform client (placeholder implementation)."""

    def __init__(self, enabled: bool = None):
        if enabled is None:
            enabled = os.getenv("ENABLE_BEATPORT_INTEGRATION", "0").lower() in {"1", "true", "yes"}
        super().__init__("beatport", enabled)

    async def initialize(self) -> None:
        """Initialize Beatport client."""
        if not self.enabled:
            raise RuntimeError("Beatport integration is disabled")

        # TODO: Implement Beatport API authentication
        self.logger.warning("Beatport client is a placeholder implementation")
        self._initialized = True

    async def search_track(
        self,
        title: str,
        artist: str,
        isrc: Optional[str] = None,
        **kwargs
    ) -> List[SearchResult]:
        """Search for tracks on Beatport."""
        # TODO: Implement Beatport search
        self.logger.debug(f"Beatport search: {title} by {artist}")
        return []

    async def get_track_by_id(self, track_id: Union[str, int]) -> Optional[TrackMetadata]:
        """Get track by Beatport ID."""
        # TODO: Implement Beatport track lookup
        return None


class AppleMusicClient(StreamingPlatformClient):
    """Apple Music streaming platform client (placeholder implementation)."""

    def __init__(self, enabled: bool = None):
        if enabled is None:
            enabled = os.getenv("ENABLE_APPLE_MUSIC_INTEGRATION", "0").lower() in {"1", "true", "yes"}
        super().__init__("apple_music", enabled)

    async def initialize(self) -> None:
        """Initialize Apple Music client."""
        if not self.enabled:
            raise RuntimeError("Apple Music integration is disabled")

        # TODO: Implement Apple Music API authentication
        self.logger.warning("Apple Music client is a placeholder implementation")
        self._initialized = True

    async def search_track(
        self,
        title: str,
        artist: str,
        isrc: Optional[str] = None,
        **kwargs
    ) -> List[SearchResult]:
        """Search for tracks on Apple Music."""
        # TODO: Implement Apple Music search
        self.logger.debug(f"Apple Music search: {title} by {artist}")
        return []

    async def get_track_by_id(self, track_id: Union[str, int]) -> Optional[TrackMetadata]:
        """Get track by Apple Music ID."""
        # TODO: Implement Apple Music track lookup
        return None


class SoundCloudClient(StreamingPlatformClient):
    """SoundCloud streaming platform client (placeholder implementation)."""

    def __init__(self, enabled: bool = None):
        if enabled is None:
            enabled = os.getenv("ENABLE_SOUNDCLOUD_INTEGRATION", "0").lower() in {"1", "true", "yes"}
        super().__init__("soundcloud", enabled)

    async def initialize(self) -> None:
        """Initialize SoundCloud client."""
        if not self.enabled:
            raise RuntimeError("SoundCloud integration is disabled")

        # TODO: Implement SoundCloud API authentication
        self.logger.warning("SoundCloud client is a placeholder implementation")
        self._initialized = True

    async def search_track(
        self,
        title: str,
        artist: str,
        isrc: Optional[str] = None,
        **kwargs
    ) -> List[SearchResult]:
        """Search for tracks on SoundCloud."""
        # TODO: Implement SoundCloud search
        self.logger.debug(f"SoundCloud search: {title} by {artist}")
        return []

    async def get_track_by_id(self, track_id: Union[str, int]) -> Optional[TrackMetadata]:
        """Get track by SoundCloud ID."""
        # TODO: Implement SoundCloud track lookup
        return None


class DeezerClient(StreamingPlatformClient):
    """Deezer streaming platform client (placeholder implementation)."""

    def __init__(self, enabled: bool = None):
        if enabled is None:
            enabled = os.getenv("ENABLE_DEEZER_INTEGRATION", "0").lower() in {"1", "true", "yes"}
        super().__init__("deezer", enabled)

    async def initialize(self) -> None:
        """Initialize Deezer client."""
        if not self.enabled:
            raise RuntimeError("Deezer integration is disabled")

        # TODO: Implement Deezer API authentication
        self.logger.warning("Deezer client is a placeholder implementation")
        self._initialized = True

    async def search_track(
        self,
        title: str,
        artist: str,
        isrc: Optional[str] = None,
        **kwargs
    ) -> List[SearchResult]:
        """Search for tracks on Deezer."""
        # TODO: Implement Deezer search
        self.logger.debug(f"Deezer search: {title} by {artist}")
        return []

    async def get_track_by_id(self, track_id: Union[str, int]) -> Optional[TrackMetadata]:
        """Get track by Deezer ID."""
        # TODO: Implement Deezer track lookup
        return None


class YouTubeMusicClient(StreamingPlatformClient):
    """YouTube Music streaming platform client (placeholder implementation)."""

    def __init__(self, enabled: bool = None):
        if enabled is None:
            enabled = os.getenv("ENABLE_YOUTUBE_MUSIC_INTEGRATION", "0").lower() in {"1", "true", "yes"}
        super().__init__("youtube_music", enabled)

    async def initialize(self) -> None:
        """Initialize YouTube Music client."""
        if not self.enabled:
            raise RuntimeError("YouTube Music integration is disabled")

        # TODO: Implement YouTube Music API authentication
        self.logger.warning("YouTube Music client is a placeholder implementation")
        self._initialized = True

    async def search_track(
        self,
        title: str,
        artist: str,
        isrc: Optional[str] = None,
        **kwargs
    ) -> List[SearchResult]:
        """Search for tracks on YouTube Music."""
        # TODO: Implement YouTube Music search
        self.logger.debug(f"YouTube Music search: {title} by {artist}")
        return []

    async def get_track_by_id(self, track_id: Union[str, int]) -> Optional[TrackMetadata]:
        """Get track by YouTube Music ID."""
        # TODO: Implement YouTube Music track lookup
        return None


class UnifiedStreamingClient:
    """
    Unified client that orchestrates multiple streaming platform clients.
    Provides a single interface to search across all available platforms.
    """

    def __init__(self, db_config: Optional[Dict[str, Any]] = None):
        self.logger = logging.getLogger(__name__)
        self.db_pool: Optional[asyncpg.Pool] = None
        self.db_config = db_config or self._get_default_db_config()

        # Initialize platform clients
        self.clients: Dict[str, StreamingPlatformClient] = {
            "tidal": TidalClient(),
            "spotify": SpotifyClient(),
            "beatport": BeatportClient(),
            "apple_music": AppleMusicClient(),
            "soundcloud": SoundCloudClient(),
            "deezer": DeezerClient(),
            "youtube_music": YouTubeMusicClient(),
        }

        self._initialized = False

    def _get_default_db_config(self) -> Dict[str, Any]:
        """Get default database configuration from environment."""
        return {
            "host": os.getenv("DATABASE_HOST", "postgres"),
            "port": int(os.getenv("DATABASE_PORT", "5432")),
            "database": os.getenv("DATABASE_NAME", "musicdb"),
            "user": os.getenv("DATABASE_USER", "musicdb_user"),
            "password": os.getenv("DATABASE_PASSWORD", "7D82_xqNs55tGyk"),
        }

    async def initialize(self) -> None:
        """Initialize all enabled platform clients and database connection."""
        if self._initialized:
            return

        # Initialize database connection
        connection_string = (
            f"postgresql://{self.db_config['user']}:{self.db_config['password']}@"
            f"{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"
        )

        self.db_pool = await asyncpg.create_pool(
            connection_string,
            min_size=1,
            max_size=5,
            command_timeout=30,
            max_queries=50000,
            max_inactive_connection_lifetime=1800,
            server_settings={
                'statement_timeout': '30000',
                'idle_in_transaction_session_timeout': '300000'
            }
        )

        # Initialize enabled platform clients
        initialized_count = 0
        for platform_name, client in self.clients.items():
            if client.enabled:
                try:
                    await client.initialize()
                    initialized_count += 1
                    self.logger.info(f"✓ {platform_name} client initialized")
                except Exception as e:
                    self.logger.warning(f"Failed to initialize {platform_name} client: {e}")
                    client.enabled = False

        self._initialized = True
        self.logger.info(f"UnifiedStreamingClient initialized with {initialized_count} platforms")

    async def search_track_across_platforms(
        self,
        title: str,
        artist: str,
        isrc: Optional[str] = None,
        platforms: Optional[List[str]] = None,
        max_results_per_platform: int = 3
    ) -> Dict[str, List[SearchResult]]:
        """
        Search for a track across multiple streaming platforms.

        Args:
            title: Track title
            artist: Artist name
            isrc: ISRC code (optional)
            platforms: List of platform names to search (None = all enabled)
            max_results_per_platform: Maximum results per platform

        Returns:
            Dictionary mapping platform names to search results
        """
        if not self._initialized:
            await self.initialize()

        if platforms is None:
            platforms = [name for name, client in self.clients.items() if client.enabled]

        results = {}
        search_tasks = []

        for platform_name in platforms:
            if platform_name in self.clients and self.clients[platform_name].enabled:
                client = self.clients[platform_name]
                task = asyncio.create_task(
                    client.search_track(title, artist, isrc),
                    name=f"search_{platform_name}"
                )
                search_tasks.append((platform_name, task))

        # Wait for all searches to complete with timeout
        for platform_name, task in search_tasks:
            start_time = time.time()
            try:
                platform_results = await asyncio.wait_for(task, timeout=30.0)
                # Limit results per platform
                results[platform_name] = platform_results[:max_results_per_platform]
                self.logger.debug(f"{platform_name}: found {len(platform_results)} results")

                # Update metrics
                if self.search_counter:
                    self.search_counter.labels(platform=platform_name, status='success').inc()
                if self.search_duration:
                    self.search_duration.labels(platform=platform_name).observe(time.time() - start_time)

            except asyncio.TimeoutError:
                self.logger.warning(f"Search timeout on {platform_name}")
                results[platform_name] = []
                task.cancel()

                # Update metrics
                if self.search_counter:
                    self.search_counter.labels(platform=platform_name, status='timeout').inc()

            except Exception as e:
                self.logger.warning(f"Search failed on {platform_name}: {e}")
                results[platform_name] = []

                # Update metrics
                if self.search_counter:
                    self.search_counter.labels(platform=platform_name, status='error').inc()

        return results

    async def get_best_match(
        self,
        title: str,
        artist: str,
        isrc: Optional[str] = None,
        min_confidence: float = 0.7
    ) -> Optional[SearchResult]:
        """
        Get the best matching track across all platforms.

        Args:
            title: Track title
            artist: Artist name
            isrc: ISRC code (optional)
            min_confidence: Minimum confidence threshold

        Returns:
            Best matching SearchResult or None
        """
        all_results = await self.search_track_across_platforms(title, artist, isrc)

        best_result = None
        best_confidence = 0.0

        for platform_results in all_results.values():
            for result in platform_results:
                if result.confidence > best_confidence and result.confidence >= min_confidence:
                    best_result = result
                    best_confidence = result.confidence

        return best_result

    async def enrich_track_with_platform_ids(
        self,
        track_id: str,
        title: str,
        artist: str,
        isrc: Optional[str] = None
    ) -> Dict[str, Union[str, int]]:
        """
        Enrich a track with platform IDs and store in database.

        Args:
            track_id: SongNodes internal track UUID
            title: Track title
            artist: Artist name
            isrc: ISRC code (optional)

        Returns:
            Dictionary of platform IDs found
        """
        if not self.db_pool:
            await self.initialize()

        search_results = await self.search_track_across_platforms(title, artist, isrc)
        platform_ids = {}

        # Extract platform IDs from search results
        for platform_name, results in search_results.items():
            if results and results[0].confidence >= 0.7:  # Use best result if confidence is high
                best_result = results[0]
                platform_ids[f"{platform_name}_id"] = best_result.track.platform_id

        # Store platform IDs in database
        if platform_ids:
            await self._update_track_platform_ids(track_id, platform_ids)

        return platform_ids

    async def _update_track_platform_ids(
        self,
        track_id: str,
        platform_ids: Dict[str, Union[str, int]]
    ) -> None:
        """Update track with platform IDs in database."""
        if not self.db_pool:
            return

        # Build dynamic UPDATE query
        set_clauses = []
        values = [track_id]
        param_num = 2

        for platform_field, platform_id in platform_ids.items():
            set_clauses.append(f"{platform_field} = ${param_num}")
            values.append(platform_id)
            param_num += 1

        if not set_clauses:
            return

        query = f"""
            UPDATE tracks
            SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        """

        async with self.get_db_connection() as conn:
            await conn.execute(query, *values)

        self.logger.info(f"Updated track {track_id} with platform IDs: {list(platform_ids.keys())}")

    async def get_platform_coverage_stats(self) -> Dict[str, Any]:
        """Get statistics about platform ID coverage."""
        if not self.db_pool:
            await self.initialize()

        query = """
            SELECT
                COUNT(*) as total_tracks,
                COUNT(spotify_id) as spotify_count,
                COUNT(apple_music_id) as apple_music_count,
                COUNT(tidal_id) as tidal_count,
                COUNT(beatport_id) as beatport_count,
                COUNT(soundcloud_id) as soundcloud_count,
                COUNT(deezer_id) as deezer_count,
                COUNT(youtube_music_id) as youtube_music_count,
                COUNT(musicbrainz_id) as musicbrainz_count
            FROM tracks
        """

        async with self.get_db_connection() as conn:
            record = await conn.fetchrow(query)

        stats = dict(record) if record else {}

        # Calculate coverage percentages
        total = stats.get("total_tracks", 0)
        if total > 0:
            for key, value in stats.items():
                if key.endswith("_count") and key != "total_tracks":
                    percentage_key = key.replace("_count", "_percentage")
                    stats[percentage_key] = round((value / total) * 100, 2)

        return stats

    async def shutdown(self) -> None:
        """Shutdown all clients and close database connection."""
        # Shutdown platform clients
        shutdown_tasks = []
        for client in self.clients.values():
            if hasattr(client, 'shutdown'):
                shutdown_tasks.append(asyncio.create_task(client.shutdown()))

        if shutdown_tasks:
            try:
                await asyncio.wait_for(asyncio.gather(*shutdown_tasks, return_exceptions=True), timeout=10.0)
            except asyncio.TimeoutError:
                self.logger.warning("Some clients took too long to shutdown")

        # Close database connection with timeout
        if self.db_pool:
            try:
                await asyncio.wait_for(self.db_pool.close(), timeout=5.0)
            except asyncio.TimeoutError:
                self.logger.warning("Database pool shutdown timed out")
            finally:
                self.db_pool = None

        self._initialized = False
        self.logger.info("UnifiedStreamingClient shutdown complete")

    async def get_memory_usage(self) -> Dict[str, Any]:
        """Get current memory usage metrics."""
        process = psutil.Process()
        memory_info = process.memory_info()

        stats = {
            "rss_mb": memory_info.rss / 1024 / 1024,
            "vms_mb": memory_info.vms / 1024 / 1024,
            "percent": process.memory_percent(),
            "db_pool_size": self.db_pool.get_size() if self.db_pool else 0,
            "active_clients": sum(1 for client in self.clients.values() if client.enabled)
        }

        return stats

    @asynccontextmanager
    async def get_db_connection(self):
        """Context manager for database connections with timeout."""
        if not self.db_pool:
            raise RuntimeError("Database pool not initialized")

        conn = None
        try:
            conn = await asyncio.wait_for(self.db_pool.acquire(), timeout=10.0)
            yield conn
        except asyncio.TimeoutError:
            self.logger.error("Database connection acquisition timeout")
            raise
        finally:
            if conn:
                try:
                    await asyncio.wait_for(self.db_pool.release(conn), timeout=5.0)
                except asyncio.TimeoutError:
                    self.logger.warning("Database connection release timeout")
                except Exception as e:
                    self.logger.warning(f"Error releasing database connection: {e}")


# Convenience function for quick usage
async def search_track_on_all_platforms(
    title: str,
    artist: str,
    isrc: Optional[str] = None
) -> Dict[str, List[SearchResult]]:
    """
    Convenience function to search for a track across all platforms.
    Includes proper resource cleanup and timeout handling.

    Args:
        title: Track title
        artist: Artist name
        isrc: ISRC code (optional)

    Returns:
        Dictionary mapping platform names to search results
    """
    client = UnifiedStreamingClient()
    try:
        await asyncio.wait_for(client.initialize(), timeout=30.0)
        # Update memory metrics
        if client.memory_usage:
            memory_stats = await client.get_memory_usage()
            client.memory_usage.set(memory_stats['rss_mb'] * 1024 * 1024)

        return await asyncio.wait_for(
            client.search_track_across_platforms(title, artist, isrc),
            timeout=60.0
        )
    except asyncio.TimeoutError:
        logging.getLogger(__name__).error("Search operation timed out")
        return {}
    finally:
        await client.shutdown()