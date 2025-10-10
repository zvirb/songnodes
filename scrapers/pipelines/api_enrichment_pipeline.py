"""
General-Purpose API Enrichment Pipeline
=========================================

Enriches ALL tracks (regardless of source) with API data from:
- Spotify (track metadata + audio features)
- MusicBrainz (fallback for IDs and metadata)
- Last.fm (genre tags)

Priority: 250 (after EnrichmentPipeline, before Persistence)

This pipeline fills the 26 database fields that were at 0% population:
- Platform IDs (spotify_id, musicbrainz_id, etc.)
- Audio features (bpm, key, energy, danceability, etc.)
- Metadata (isrc, duration_ms, release_date, genre, popularity_score)
"""

import logging
import requests
import base64
import json
import time
from typing import Dict, Optional, Tuple
from itemadapter import ItemAdapter
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class APIEnrichmentPipeline:
    """
    Enriches ALL tracks with Spotify/MusicBrainz/Last.fm data.

    Unlike specialized pipelines (RedditValidationPipeline, DiscogsEnrichmentPipeline),
    this pipeline processes EVERY track to populate platform IDs and audio features.
    """

    # Match threshold for API searches (0.0 - 1.0)
    SIMILARITY_THRESHOLD = 0.65  # Slightly lower than Reddit (0.7) since we control input quality

    def __init__(self,
                 spotify_client_id: str = None,
                 spotify_client_secret: str = None,
                 lastfm_api_key: str = None,
                 musicbrainz_user_agent: str = None,
                 audio_analysis_url: str = None):

        # Spotify credentials
        self.spotify_client_id = spotify_client_id or self._get_credential('SPOTIFY_CLIENT_ID')
        self.spotify_client_secret = spotify_client_secret or self._get_credential('SPOTIFY_CLIENT_SECRET')
        self.access_token = None
        self.token_expiry = None

        # Last.fm credentials
        self.lastfm_api_key = lastfm_api_key or self._get_credential('LASTFM_API_KEY')

        # MusicBrainz user agent (required, no API key needed)
        self.musicbrainz_user_agent = musicbrainz_user_agent or self._get_credential('MUSICBRAINZ_USER_AGENT')

        # Audio Analysis service URL (self-hosted, replaces Spotify Audio Features API)
        self.audio_analysis_url = audio_analysis_url or 'http://audio-analysis:8020'

        # MusicBrainz rate limiting (1 request per second)
        self.last_musicbrainz_request = 0

        # Statistics
        self.stats = {
            'total_tracks': 0,
            'spotify_enriched': 0,
            'audio_analysis_queued': 0,  # UPDATED: Queued for async processing
            'musicbrainz_fallback': 0,
            'lastfm_genre_added': 0,
            'api_failures': 0,
            'already_enriched': 0
        }

    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings"""
        import os
        return cls(
            spotify_client_id=crawler.settings.get('SPOTIFY_CLIENT_ID') or os.getenv('SPOTIFY_CLIENT_ID'),
            spotify_client_secret=crawler.settings.get('SPOTIFY_CLIENT_SECRET') or os.getenv('SPOTIFY_CLIENT_SECRET'),
            lastfm_api_key=crawler.settings.get('LASTFM_API_KEY') or os.getenv('LASTFM_API_KEY'),
            musicbrainz_user_agent=crawler.settings.get('MUSICBRAINZ_USER_AGENT') or os.getenv('MUSICBRAINZ_USER_AGENT')
        )

    def _get_credential(self, env_var: str) -> Optional[str]:
        """Load credential from environment or secrets manager"""
        import os

        cred = os.getenv(env_var)
        if cred and not cred.startswith('PLACEHOLDER'):
            return cred

        # Try centralized secrets manager
        try:
            from common.secrets_manager import get_secret
            cred = get_secret(env_var, required=False)
            if cred and not cred.startswith('PLACEHOLDER'):
                return cred
        except Exception as e:
            logger.debug(f"Could not load {env_var} from secrets manager: {e}")

        return None

    def process_item(self, item, spider):
        """Enrich track with API data"""
        adapter = ItemAdapter(item)

        # Skip track-artist relationship items (only enrich actual track items)
        item_class_name = item.__class__.__name__
        if 'TrackArtist' in item_class_name or 'Adjacency' in item_class_name:
            return item

        # Only process tracks (not playlists, artists, etc.)
        item_type = adapter.get('item_type')
        if item_type and item_type != 'track':
            return item

        self.stats['total_tracks'] += 1

        # Skip if already has spotify_id (already enriched by specialized pipeline)
        if adapter.get('spotify_id'):
            self.stats['already_enriched'] += 1
            return item

        # Get track info
        artist = self._get_primary_artist(adapter)

        # Get title - prefer track_name, fallback to parsing from source_context
        title = adapter.get('track_name') or adapter.get('title')
        if not title:
            # Parse title from source_context (format: "Artist - Title (Remix)")
            source_context = adapter.get('source_context')
            if source_context and ' - ' in source_context:
                # Extract "Title (Remix)" part
                title_part = source_context.split(' - ', 1)[1].strip()
                title = title_part if title_part else None

        if not (artist and title):
            logger.debug(f"Track missing artist or title - skipping API enrichment (artist={artist}, title={title})")
            return item

        # Clean title for API search (remove common artifacts)
        title = self._clean_title_for_search(title, artist)

        # Try Spotify first (metadata only - audio features handled by audio-analysis service)
        try:
            spotify_track = self._search_spotify(artist, title)
            if spotify_track:
                self._apply_spotify_data(adapter, spotify_track)
                self.stats['spotify_enriched'] += 1
                logger.debug(f"✓ Spotify enriched: {artist} - {title}")

                # Queue track for audio analysis (async, self-hosted)
                # This replaces the deprecated Spotify Audio Features API
                preview_url = spotify_track.get('preview_url')
                if preview_url and adapter.get('track_id'):
                    queued = self._queue_audio_analysis(
                        track_id=adapter.get('track_id'),
                        spotify_preview_url=preview_url
                    )
                    if queued:
                        self.stats['audio_analysis_queued'] += 1
                        logger.debug(f"✓ Audio analysis queued: {artist} - {title}")

                # Success - return early
                return item

        except Exception as e:
            logger.error(f"Spotify enrichment error for '{artist} - {title}': {e}")
            self.stats['api_failures'] += 1

        # Fallback to MusicBrainz (free, no key needed)
        if self.musicbrainz_user_agent:
            try:
                mb_recording = self._search_musicbrainz(artist, title)
                if mb_recording:
                    self._apply_musicbrainz_data(adapter, mb_recording)
                    self.stats['musicbrainz_fallback'] += 1
                    logger.debug(f"✓ MusicBrainz fallback: {artist} - {title}")
            except Exception as e:
                logger.error(f"MusicBrainz fallback error: {e}")

        # Try Last.fm for genre if still missing
        if not adapter.get('genre') and self.lastfm_api_key:
            try:
                tags = self._get_lastfm_tags(artist, title)
                if tags:
                    adapter['genre'] = tags[0]
                    self.stats['lastfm_genre_added'] += 1
                    logger.debug(f"✓ Last.fm genre added: {artist} - {title}")
            except Exception as e:
                logger.error(f"Last.fm error: {e}")

        return item

    def _get_primary_artist(self, adapter: ItemAdapter) -> Optional[str]:
        """Extract primary artist from various field names or parse from source_context"""
        # Try standard artist fields first
        artist = (
            adapter.get('original_artist') or
            adapter.get('artist_name') or
            adapter.get('artist') or
            (adapter.get('artists', [{}])[0].get('name') if adapter.get('artists') else None)
        )

        if artist:
            return artist

        # Fallback: Parse artist from source_context (format: "Artist - Title (Remix)")
        source_context = adapter.get('source_context')
        if source_context and ' - ' in source_context:
            # Extract artist from "Artist - Title" pattern
            artist = source_context.split(' - ')[0].strip()
            return artist if artist else None

        return None

    def _clean_title_for_search(self, title: str, artist: str) -> str:
        """Clean title for API search"""
        # Remove artist name if it appears in title
        if artist and artist.lower() in title.lower():
            title = title.replace(artist, '').replace('-', '').strip()

        # Remove common artifacts
        title = title.strip(' -—–')

        return title

    # ============================================================================
    # SPOTIFY API METHODS
    # ============================================================================

    def _get_spotify_token(self) -> Optional[str]:
        """Get or refresh Spotify access token (OAuth Client Credentials)"""
        # Check if token is still valid
        if self.access_token and self.token_expiry and datetime.utcnow() < self.token_expiry:
            return self.access_token

        if not (self.spotify_client_id and self.spotify_client_secret):
            logger.warning("Spotify credentials not available - skipping Spotify enrichment")
            return None

        # Request new token
        try:
            auth_str = f"{self.spotify_client_id}:{self.spotify_client_secret}"
            auth_bytes = auth_str.encode('utf-8')
            auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

            headers = {
                'Authorization': f'Basic {auth_base64}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }

            response = requests.post(
                'https://accounts.spotify.com/api/token',
                headers=headers,
                data={'grant_type': 'client_credentials'},
                timeout=10
            )

            response.raise_for_status()
            data = response.json()

            self.access_token = data['access_token']
            expires_in = data.get('expires_in', 3600)
            self.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in - 60)

            logger.info(f"✓ Spotify token acquired (expires in {expires_in}s)")
            return self.access_token

        except requests.RequestException as e:
            logger.error(f"Failed to get Spotify token: {e}")
            return None

    def _search_spotify(self, artist: str, title: str) -> Optional[Dict]:
        """Search Spotify for track"""
        token = self._get_spotify_token()
        if not token:
            return None

        query = f"artist:{artist} track:{title}"

        headers = {
            'Authorization': f'Bearer {token}'
        }

        try:
            response = requests.get(
                'https://api.spotify.com/v1/search',
                headers=headers,
                params={'q': query, 'type': 'track', 'limit': 5},
                timeout=10
            )

            if response.status_code == 429:
                logger.warning("Spotify rate limit hit - backing off")
                return None

            response.raise_for_status()
            data = response.json()

            tracks = data.get('tracks', {}).get('items', [])
            if not tracks:
                return None

            # Check similarity to avoid false matches
            top_result = tracks[0]
            similarity = self._calculate_similarity(
                query_artist=artist.lower(),
                query_title=title.lower(),
                result_artist=top_result['artists'][0]['name'].lower(),
                result_title=top_result['name'].lower()
            )

            if similarity >= self.SIMILARITY_THRESHOLD:
                return top_result
            else:
                logger.debug(f"Low Spotify match score {similarity:.2f} for: {artist} - {title}")
                return None

        except requests.RequestException as e:
            logger.error(f"Spotify search error: {e}")
            return None

    def _queue_audio_analysis(self, track_id: str, spotify_preview_url: str) -> bool:
        """
        Queue track for self-hosted audio analysis (replaces deprecated Spotify API).

        Sends track to audio-analysis microservice for async processing.
        Features extracted: BPM, key, energy, danceability, valence, acousticness,
        instrumentalness, liveness, speechiness, and more.

        Args:
            track_id: UUID of the track
            spotify_preview_url: Spotify preview URL (30s clip)

        Returns:
            True if successfully queued, False otherwise
        """
        try:
            # Post to audio-analysis service /analyze endpoint
            response = requests.post(
                f'{self.audio_analysis_url}/analyze',
                json={
                    'track_id': track_id,
                    'spotify_preview_url': spotify_preview_url
                },
                timeout=5  # Quick timeout - this is async
            )

            if response.status_code == 200:
                logger.debug(f"✓ Track {track_id} queued for audio analysis")
                return True
            elif response.status_code == 503:
                logger.warning(f"Audio analysis service unavailable (track {track_id})")
                return False
            else:
                logger.warning(f"Audio analysis queue failed: {response.status_code}")
                return False

        except requests.RequestException as e:
            logger.warning(f"Could not queue audio analysis (service may be down): {e}")
            return False

    def _apply_spotify_data(self, adapter: ItemAdapter, spotify_data: Dict):
        """Apply Spotify track data to item"""
        # Platform IDs
        adapter['spotify_id'] = spotify_data.get('id')

        # ISRC (International Standard Recording Code)
        if spotify_data.get('external_ids', {}).get('isrc'):
            adapter['isrc'] = spotify_data['external_ids']['isrc']

        # Basic metadata
        adapter['duration_ms'] = spotify_data.get('duration_ms')
        adapter['popularity_score'] = spotify_data.get('popularity')

        # Release date
        if spotify_data.get('album', {}).get('release_date'):
            adapter['release_date'] = spotify_data['album']['release_date']

        # Update metadata JSONB
        metadata = json.loads(adapter.get('metadata', '{}'))
        metadata['spotify'] = {
            'track_id': spotify_data.get('id'),
            'track_name': spotify_data.get('name'),
            'artist_name': spotify_data['artists'][0]['name'] if spotify_data.get('artists') else None,
            'album_name': spotify_data.get('album', {}).get('name'),
            'popularity': spotify_data.get('popularity'),
            'explicit': spotify_data.get('explicit'),
            'preview_url': spotify_data.get('preview_url'),
            'enriched_at': datetime.utcnow().isoformat()
        }
        adapter['metadata'] = json.dumps(metadata)

        # External URLs
        external_urls = json.loads(adapter.get('external_urls', '{}'))
        if 'spotify' in spotify_data.get('external_urls', {}):
            external_urls['spotify'] = spotify_data['external_urls']['spotify']
        adapter['external_urls'] = json.dumps(external_urls)

    def _apply_audio_features(self, adapter: ItemAdapter, features: Dict):
        """
        Apply audio features to item (DEPRECATED - kept for backward compatibility).

        NOTE: This method is no longer called in the normal pipeline flow.
        Audio features are now extracted by the self-hosted audio-analysis service
        and stored directly in the tracks_audio_analysis table.

        This method remains for:
        1. Legacy Spotify API users with extended access
        2. Testing and validation purposes
        """
        # Musical attributes
        adapter['bpm'] = features.get('tempo')  # Tempo in BPM

        # Convert Spotify key format to readable format (0=C, 1=C#, etc.)
        key_num = features.get('key')
        mode = features.get('mode')
        if key_num is not None:
            adapter['key'] = self._convert_key(key_num, mode)

        # Audio feature scores (0.0 - 1.0)
        adapter['energy'] = features.get('energy')
        adapter['danceability'] = features.get('danceability')
        adapter['valence'] = features.get('valence')
        adapter['acousticness'] = features.get('acousticness')
        adapter['instrumentalness'] = features.get('instrumentalness')
        adapter['liveness'] = features.get('liveness')
        adapter['speechiness'] = features.get('speechiness')

        # Loudness in dB
        adapter['loudness'] = features.get('loudness')

        # Time signature
        adapter['time_signature'] = features.get('time_signature')

        # Update metadata JSONB
        metadata = json.loads(adapter.get('metadata', '{}'))
        metadata['audio_features'] = {
            'tempo': features.get('tempo'),
            'key': features.get('key'),
            'mode': features.get('mode'),
            'energy': features.get('energy'),
            'danceability': features.get('danceability'),
            'valence': features.get('valence'),
            'time_signature': features.get('time_signature'),
            'enriched_at': datetime.utcnow().isoformat()
        }
        adapter['metadata'] = json.dumps(metadata)

    def _convert_key(self, key_num: int, mode: int) -> str:
        """Convert Spotify key format to readable format"""
        if key_num is None or key_num < 0:
            return None

        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        mode_str = 'Major' if mode == 1 else 'Minor'

        return f"{keys[key_num]} {mode_str}"

    # ============================================================================
    # MUSICBRAINZ API METHODS
    # ============================================================================

    def _search_musicbrainz(self, artist: str, title: str) -> Optional[Dict]:
        """Search MusicBrainz for recording (FREE, no API key needed)"""
        if not self.musicbrainz_user_agent:
            return None

        # Respect rate limit: 1 request per second
        now = time.time()
        time_since_last = now - self.last_musicbrainz_request
        if time_since_last < 1.0:
            time.sleep(1.0 - time_since_last)
        self.last_musicbrainz_request = time.time()

        # Build search query
        query = f'artist:"{artist}" AND recording:"{title}"'

        headers = {
            'User-Agent': self.musicbrainz_user_agent
        }

        try:
            response = requests.get(
                'https://musicbrainz.org/ws/2/recording/',
                headers=headers,
                params={'query': query, 'fmt': 'json', 'limit': 5},
                timeout=10
            )

            response.raise_for_status()
            data = response.json()

            recordings = data.get('recordings', [])
            if not recordings:
                return None

            # Check similarity
            top_result = recordings[0]
            result_artist = top_result.get('artist-credit', [{}])[0].get('name', '')
            result_title = top_result.get('title', '')

            similarity = self._calculate_similarity(
                query_artist=artist.lower(),
                query_title=title.lower(),
                result_artist=result_artist.lower(),
                result_title=result_title.lower()
            )

            if similarity >= self.SIMILARITY_THRESHOLD:
                return top_result
            else:
                logger.debug(f"Low MusicBrainz match score {similarity:.2f} for: {artist} - {title}")
                return None

        except requests.RequestException as e:
            logger.error(f"MusicBrainz search error: {e}")
            return None

    def _apply_musicbrainz_data(self, adapter: ItemAdapter, mb_data: Dict):
        """Apply MusicBrainz data to item"""
        # Platform ID
        adapter['musicbrainz_id'] = mb_data.get('id')

        # ISRC (if available and not already set)
        if not adapter.get('isrc'):
            isrcs = mb_data.get('isrcs', [])
            if isrcs:
                adapter['isrc'] = isrcs[0]

        # Release date (if available)
        if not adapter.get('release_date'):
            releases = mb_data.get('releases', [])
            if releases and releases[0].get('date'):
                adapter['release_date'] = releases[0]['date']

        # Update metadata JSONB
        metadata = json.loads(adapter.get('metadata', '{}'))
        metadata['musicbrainz'] = {
            'recording_id': mb_data.get('id'),
            'title': mb_data.get('title'),
            'length_ms': mb_data.get('length'),
            'enriched_at': datetime.utcnow().isoformat()
        }
        adapter['metadata'] = json.dumps(metadata)

    # ============================================================================
    # LAST.FM API METHODS
    # ============================================================================

    def _get_lastfm_tags(self, artist: str, title: str) -> Optional[list]:
        """Get Last.fm genre tags for track"""
        if not self.lastfm_api_key:
            return None

        try:
            response = requests.get(
                'http://ws.audioscrobbler.com/2.0/',
                params={
                    'method': 'track.getInfo',
                    'artist': artist,
                    'track': title,
                    'api_key': self.lastfm_api_key,
                    'format': 'json'
                },
                timeout=10
            )

            response.raise_for_status()
            data = response.json()

            tags = data.get('track', {}).get('toptags', {}).get('tag', [])
            if not tags:
                return None

            # Extract tag names (sorted by count)
            tag_names = [tag['name'] for tag in tags if isinstance(tag, dict)]
            return tag_names[:5]  # Return top 5 tags

        except requests.RequestException as e:
            logger.error(f"Last.fm error: {e}")
            return None

    # ============================================================================
    # UTILITY METHODS
    # ============================================================================

    def _calculate_similarity(
        self,
        query_artist: str,
        query_title: str,
        result_artist: str,
        result_title: str
    ) -> float:
        """
        Calculate similarity score between query and result.

        Uses difflib's SequenceMatcher for fuzzy string matching.

        Returns:
            Similarity score 0.0 - 1.0
        """
        from difflib import SequenceMatcher

        # Artist similarity
        artist_sim = SequenceMatcher(None, query_artist, result_artist).ratio()

        # Title similarity
        title_sim = SequenceMatcher(None, query_title, result_title).ratio()

        # Weighted average (artist match more important for DJ tracks)
        similarity = (artist_sim * 0.6) + (title_sim * 0.4)

        return similarity

    def close_spider(self, spider):
        """Log pipeline statistics"""
        logger.info(
            f"\n{'='*60}\n"
            f"API Enrichment Pipeline Statistics\n"
            f"{'='*60}\n"
            f"Total tracks processed:     {self.stats['total_tracks']}\n"
            f"Already enriched:           {self.stats['already_enriched']}\n"
            f"Spotify enriched:           {self.stats['spotify_enriched']}\n"
            f"Audio analysis queued:      {self.stats['audio_analysis_queued']} (self-hosted)\n"
            f"MusicBrainz fallback:       {self.stats['musicbrainz_fallback']}\n"
            f"Last.fm genre added:        {self.stats['lastfm_genre_added']}\n"
            f"API failures:               {self.stats['api_failures']}\n"
            f"{'='*60}\n"
            f"NOTE: Audio features are processed asynchronously by the\n"
            f"      audio-analysis service and stored in tracks_audio_analysis table.\n"
            f"{'='*60}\n"
        )
