"""
Production-Ready Spotify API Spider for SongNodes (Priority Score 3.85 - HIGHEST ROI)
=====================================================================================

Integrates with Spotify Web API to collect rich audio features for DJ playlists:
- BPM, key, energy, danceability, valence, acousticness
- Track metadata (name, ISRC, duration, popularity)
- Artist information and relationships
- Playlist context for DJ sets and electronic music

Authentication: OAuth Client Credentials flow
Rate Limiting: Conservative (20 requests/second max)
Data Quality: ItemLoaders for consistent transformation
"""

import scrapy
import os
import json
import logging
import hashlib
import base64
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from urllib.parse import urlencode, quote
import redis
from scrapy.exceptions import CloseSpider, IgnoreRequest

try:
    from ..items import (
        EnhancedArtistItem,
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem,
        EnhancedSetlistTrackItem,
        PlaylistItem
    )
    from ..item_loaders import TrackLoader, ArtistLoader, SetlistLoader, PlaylistLoader
    from ..track_id_generator import generate_track_id
except ImportError:
    # Fallback for standalone execution
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from items import (
        EnhancedArtistItem,
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem,
        EnhancedSetlistTrackItem,
        PlaylistItem
    )
    from item_loaders import TrackLoader, ArtistLoader, SetlistLoader, PlaylistLoader
    from track_id_generator import generate_track_id


class SpotifySpider(scrapy.Spider):
    """
    Production Spotify API spider with OAuth authentication and comprehensive metadata extraction.
    """
    name = 'spotify'
    allowed_domains = ['api.spotify.com', 'accounts.spotify.com']

    # Conservative rate limiting (Spotify allows 180 requests/minute = 3/second, we use 0.05/second)
    download_delay = 20.0
    randomize_download_delay = 0.2

    custom_settings = {
        'DOWNLOAD_DELAY': 20.0,  # 20 seconds between requests - very conservative
        'RANDOMIZE_DOWNLOAD_DELAY': 0.2,  # Range: 16-24 seconds
        'CONCURRENT_REQUESTS': 1,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 20,
        'AUTOTHROTTLE_MAX_DELAY': 60,
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 0.1,
        'RETRY_TIMES': 3,
        'RETRY_HTTP_CODES': [429, 500, 502, 503, 504, 522, 524, 408],
        'DOWNLOAD_TIMEOUT': 30,
        'ITEM_PIPELINES': {
            'pipelines.raw_data_storage_pipeline.RawDataStoragePipeline': 50,  # Raw data archive
            'database_pipeline.DatabasePipeline': 300,  # Legacy persistence
        },
        'DEFAULT_REQUEST_HEADERS': {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    }

    # DJ-focused search queries (electronic music genres)
    DJ_SEARCH_QUERIES = [
        'DJ Mix', 'Tech House', 'Melodic Techno', 'Progressive House',
        'Deep House', 'Techno Mix', 'House Music', 'Electronic Mix',
        'DJ Set', 'Club Mix', 'Festival Mix', 'Radio Mix'
    ]

    def __init__(self, search_query=None, playlist_ids=None, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.access_token = None
        self.token_expiry = None
        self.redis_client = None
        self.redis_prefix = os.getenv('SCRAPER_STATE_PREFIX_SPOTIFY', 'scraped:playlists:spotify')
        self.source_ttl_seconds = int(os.getenv('SCRAPER_SOURCE_TTL_DAYS', '30')) * 86400
        self.processed_playlists = set()

        # Load credentials
        self._load_credentials()

        # Initialize Redis for token caching
        self._initialize_redis()

        # Support for custom search or specific playlists
        self.custom_search = search_query
        self.playlist_ids = playlist_ids.split(',') if playlist_ids else []

    def _load_credentials(self):
        """Load Spotify credentials from database or environment"""
        self.client_id = None
        self.client_secret = None

        # Try loading from database first (encrypted storage)
        try:
            self._load_credentials_from_db()
        except Exception as e:
            self.logger.warning(f"Failed to load Spotify credentials from database: {e}")

        # Fallback to environment variables
        if not self.client_id:
            self.client_id = os.getenv('SPOTIFY_CLIENT_ID')
        if not self.client_secret:
            self.client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')

        if not self.client_id or not self.client_secret:
            raise ValueError(
                "Spotify API credentials not found. Please set SPOTIFY_CLIENT_ID and "
                "SPOTIFY_CLIENT_SECRET environment variables or configure via Settings UI."
            )

        self.logger.info(f"✓ Spotify credentials loaded (Client ID: {self.client_id[:8]}...)")

    def _load_credentials_from_db(self):
        """Load Spotify credentials from encrypted database storage"""
        try:
            import asyncpg
            import asyncio

            # Get database connection details
            db_host = os.getenv('DB_HOST', 'postgres')
            db_port = int(os.getenv('DB_PORT', '5432'))
            db_name = os.getenv('DB_NAME', 'musicdb')
            db_user = os.getenv('DB_USER', 'musicdb_user')
            db_password = os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass_2024')
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET', 'songnodes_change_in_production_2024')

            async def fetch_credentials():
                conn = await asyncpg.connect(
                    host=db_host,
                    port=db_port,
                    database=db_name,
                    user=db_user,
                    password=db_password,
                    timeout=5.0
                )
                try:
                    # Fetch client ID
                    client_id = await conn.fetchval(
                        "SELECT get_api_key($1, $2, $3)",
                        'spotify', 'client_id', encryption_secret
                    )
                    # Fetch client secret
                    client_secret = await conn.fetchval(
                        "SELECT get_api_key($1, $2, $3)",
                        'spotify', 'client_secret', encryption_secret
                    )
                    return client_id, client_secret
                finally:
                    await conn.close()

            # Run async function
            loop = asyncio.new_event_loop()
            try:
                client_id, client_secret = loop.run_until_complete(fetch_credentials())
                if client_id and client_secret:
                    self.client_id = client_id
                    self.client_secret = client_secret
                    self.logger.info("✓ Loaded Spotify credentials from database")
            finally:
                loop.close()

        except Exception as e:
            self.logger.debug(f"Database credential load failed (will try environment): {e}")
            raise

    def _initialize_redis(self):
        """Initialize Redis for token caching and state management"""
        host = os.getenv('REDIS_HOST', 'localhost')
        port = int(os.getenv('REDIS_PORT', 6379))
        db = int(os.getenv('REDIS_DB', 0))

        try:
            client = redis.Redis(host=host, port=port, db=db, decode_responses=True, socket_timeout=2)
            client.ping()
            self.redis_client = client
            self.logger.info(f"Using Redis for Spotify token cache at {host}:{port}")

            # Try to load cached token
            self._load_cached_token()
        except Exception as e:
            self.redis_client = None
            self.logger.warning(f"Redis not available for token caching: {e}")

    def _load_cached_token(self):
        """Load cached access token from Redis"""
        if not self.redis_client:
            return

        try:
            token_key = f"{self.redis_prefix}:access_token"
            expiry_key = f"{self.redis_prefix}:token_expiry"

            cached_token = self.redis_client.get(token_key)
            cached_expiry = self.redis_client.get(expiry_key)

            if cached_token and cached_expiry:
                expiry_time = datetime.fromisoformat(cached_expiry)
                if expiry_time > datetime.utcnow():
                    self.access_token = cached_token
                    self.token_expiry = expiry_time
                    self.logger.info(f"✓ Using cached Spotify token (expires {expiry_time})")
        except Exception as e:
            self.logger.debug(f"Failed to load cached token: {e}")

    def _cache_token(self, token: str, expires_in: int):
        """Cache access token in Redis"""
        if not self.redis_client:
            return

        try:
            token_key = f"{self.redis_prefix}:access_token"
            expiry_key = f"{self.redis_prefix}:token_expiry"

            expiry_time = datetime.utcnow() + timedelta(seconds=expires_in - 60)  # 60s buffer

            self.redis_client.setex(token_key, expires_in - 60, token)
            self.redis_client.setex(expiry_key, expires_in - 60, expiry_time.isoformat())

            self.logger.info(f"✓ Cached Spotify token (expires {expiry_time})")
        except Exception as e:
            self.logger.debug(f"Failed to cache token: {e}")

    def start(self):
        """Generate initial requests - authenticate first, then search playlists"""
        # First, get access token
        yield scrapy.Request(
            url='https://accounts.spotify.com/api/token',
            method='POST',
            headers={
                'Authorization': f'Basic {self._get_auth_header()}',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body='grant_type=client_credentials',
            callback=self.parse_token_response,
            errback=self.handle_error,
            dont_filter=True
        )

    def _get_auth_header(self) -> str:
        """Generate Basic auth header for token request"""
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
        return encoded

    def parse_token_response(self, response):
        """Parse OAuth token response and proceed with playlist searches"""
        try:
            data = json.loads(response.text)
            self.access_token = data['access_token']
            expires_in = data.get('expires_in', 3600)
            self.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in - 60)

            self.logger.info(f"✓ Spotify authentication successful (expires in {expires_in}s)")

            # Cache token
            self._cache_token(self.access_token, expires_in)

            # Now search for DJ playlists
            if self.custom_search:
                # Use custom search query
                yield from self._search_playlists(self.custom_search)
            elif self.playlist_ids:
                # Use specific playlist IDs
                for playlist_id in self.playlist_ids:
                    yield from self._fetch_playlist(playlist_id)
            else:
                # Search for DJ playlists using predefined queries
                for query in self.DJ_SEARCH_QUERIES:
                    yield from self._search_playlists(query)

        except Exception as e:
            self.logger.error(f"Failed to parse token response: {e}")

    def _search_playlists(self, query: str):
        """Search for playlists matching query"""
        params = {
            'q': query,
            'type': 'playlist',
            'limit': 20,  # Conservative limit
            'market': 'US'
        }

        url = f"https://api.spotify.com/v1/search?{urlencode(params)}"

        yield scrapy.Request(
            url=url,
            headers=self._get_api_headers(),
            callback=self.parse_search_results,
            errback=self.handle_error,
            meta={'search_query': query}
        )

    def _fetch_playlist(self, playlist_id: str):
        """Fetch specific playlist by ID"""
        url = f"https://api.spotify.com/v1/playlists/{playlist_id}"

        yield scrapy.Request(
            url=url,
            headers=self._get_api_headers(),
            callback=self.parse_playlist,
            errback=self.handle_error
        )

    def _get_api_headers(self) -> Dict[str, str]:
        """Get headers for Spotify API requests"""
        if not self.access_token:
            raise ValueError("No access token available")

        return {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/json'
        }

    def parse_search_results(self, response):
        """Parse playlist search results"""
        try:
            data = json.loads(response.text)
            playlists = data.get('playlists', {}).get('items', [])

            self.logger.info(f"Found {len(playlists)} playlists for query: {response.meta.get('search_query')}")

            for playlist in playlists[:10]:  # Limit to 10 playlists per search
                playlist_id = playlist.get('id')
                if playlist_id and not self._is_playlist_processed(playlist_id):
                    yield from self._fetch_playlist(playlist_id)

        except Exception as e:
            self.logger.error(f"Error parsing search results: {e}")

    def parse_playlist(self, response):
        """Parse individual playlist and extract tracks with audio features"""
        try:
            playlist_data = json.loads(response.text)
            playlist_id = playlist_data.get('id')

            if self._is_playlist_processed(playlist_id):
                return

            # Extract playlist metadata using ItemLoader
            loader = PlaylistLoader(item=PlaylistItem(), response=response)
            loader.add_value('item_type', 'playlist')
            loader.add_value('name', playlist_data.get('name'))
            loader.add_value('source', 'spotify')
            loader.add_value('source_url', playlist_data.get('external_urls', {}).get('spotify'))
            loader.add_value('playlist_id', playlist_id)
            loader.add_value('platform_id', playlist_id)
            loader.add_value('curator', playlist_data.get('owner', {}).get('display_name'))
            loader.add_value('description', playlist_data.get('description'))
            loader.add_value('total_tracks', playlist_data.get('tracks', {}).get('total'))
            loader.add_value('data_source', self.name)
            loader.add_value('scrape_timestamp', datetime.utcnow())

            playlist_item = loader.load_item()

            # Extract track URIs for batch audio features request
            tracks = playlist_data.get('tracks', {}).get('items', [])
            track_ids = [
                track['track']['id']
                for track in tracks
                if track.get('track') and track['track'].get('id')
            ]

            if track_ids:
                # Fetch audio features in batches (max 100 tracks per request)
                for i in range(0, len(track_ids), 50):  # Conservative: 50 per batch
                    batch = track_ids[i:i+50]
                    yield scrapy.Request(
                        url=f"https://api.spotify.com/v1/audio-features?ids={','.join(batch)}",
                        headers=self._get_api_headers(),
                        callback=self.parse_audio_features,
                        errback=self.handle_error,
                        meta={
                            'playlist_data': playlist_data,
                            'playlist_item': playlist_item,
                            'tracks': tracks,
                            'track_batch': batch
                        }
                    )

            self._mark_playlist_processed(playlist_id)

        except Exception as e:
            self.logger.error(f"Error parsing playlist: {e}")

    def parse_audio_features(self, response):
        """Parse audio features and create enhanced track items"""
        try:
            audio_features_data = json.loads(response.text)
            audio_features = audio_features_data.get('audio_features', [])

            playlist_data = response.meta['playlist_data']
            playlist_item = response.meta['playlist_item']
            tracks = response.meta['tracks']

            # Map audio features to tracks
            features_map = {f['id']: f for f in audio_features if f}

            track_names = []

            for i, track_item in enumerate(tracks):
                try:
                    track = track_item.get('track')
                    if not track:
                        continue

                    track_id = track.get('id')
                    features = features_map.get(track_id, {})

                    # Use ItemLoader for consistent data transformation
                    loader = TrackLoader(item=EnhancedTrackItem(), response=response)

                    # Basic track info
                    loader.add_value('track_name', track.get('name'))
                    loader.add_value('normalized_title', track.get('name'))
                    loader.add_value('duration_ms', track.get('duration_ms'))
                    loader.add_value('spotify_id', track_id)
                    loader.add_value('isrc', track.get('external_ids', {}).get('isrc'))

                    # Audio features from /audio-features endpoint
                    loader.add_value('bpm', features.get('tempo'))
                    loader.add_value('musical_key', self._map_key(features.get('key'), features.get('mode')))
                    loader.add_value('energy', features.get('energy'))
                    loader.add_value('danceability', features.get('danceability'))
                    loader.add_value('valence', features.get('valence'))
                    loader.add_value('acousticness', features.get('acousticness'))
                    loader.add_value('instrumentalness', features.get('instrumentalness'))
                    loader.add_value('liveness', features.get('liveness'))
                    loader.add_value('speechiness', features.get('speechiness'))
                    loader.add_value('loudness', features.get('loudness'))

                    # Track metadata
                    loader.add_value('release_date', track.get('album', {}).get('release_date'))
                    loader.add_value('popularity_score', track.get('popularity'))
                    loader.add_value('is_explicit', track.get('explicit'))

                    # Context
                    loader.add_value('track_type', 'Playlist')
                    loader.add_value('source_context', playlist_data.get('name'))
                    loader.add_value('position_in_source', i + 1)

                    # System fields
                    loader.add_value('data_source', self.name)
                    loader.add_value('scrape_timestamp', datetime.utcnow())

                    # Metadata
                    loader.add_value('metadata', json.dumps({
                        'spotify_popularity': track.get('popularity'),
                        'preview_url': track.get('preview_url'),
                        'album': track.get('album', {}).get('name'),
                        'audio_features': features
                    }))

                    loader.add_value('external_urls', json.dumps({
                        'spotify': track.get('external_urls', {}).get('spotify')
                    }))

                    track_item_obj = loader.load_item()
                    track_names.append(track_item_obj.get('track_name'))
                    yield track_item_obj

                    # Extract artist relationships
                    artists = track.get('artists', [])
                    for j, artist in enumerate(artists):
                        yield from self._create_artist_items(artist, track_item_obj, j)

                except Exception as e:
                    self.logger.error(f"Error processing track {i}: {e}")
                    continue

            # Yield playlist item with track list
            playlist_item['tracks'] = track_names
            yield playlist_item

        except Exception as e:
            self.logger.error(f"Error parsing audio features: {e}")

    def _create_artist_items(self, artist_data: Dict, track_item: EnhancedTrackItem, position: int):
        """Create artist and relationship items"""
        # Create artist item using ItemLoader
        loader = ArtistLoader(item=EnhancedArtistItem())
        loader.add_value('artist_name', artist_data.get('name'))
        loader.add_value('normalized_name', artist_data.get('name'))
        loader.add_value('spotify_id', artist_data.get('id'))
        loader.add_value('external_urls', json.dumps({
            'spotify': artist_data.get('external_urls', {}).get('spotify')
        }))
        loader.add_value('data_source', self.name)
        loader.add_value('scrape_timestamp', datetime.utcnow())

        yield loader.load_item()

        # Create track-artist relationship
        yield EnhancedTrackArtistItem(
            track_name=track_item.get('track_name'),
            track_id=track_item.get('spotify_id'),
            artist_name=artist_data.get('name'),
            artist_id=artist_data.get('id'),
            artist_role='primary' if position == 0 else 'featured',
            position=position,
            data_source=self.name,
            scrape_timestamp=datetime.utcnow()
        )

    def _map_key(self, key_code: Optional[int], mode: Optional[int]) -> Optional[str]:
        """Map Spotify key code to musical key notation"""
        if key_code is None:
            return None

        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key = keys[key_code] if 0 <= key_code < 12 else None

        if key and mode is not None:
            suffix = 'maj' if mode == 1 else 'min'
            return f"{key}{suffix}"

        return key

    def _is_playlist_processed(self, playlist_id: str) -> bool:
        """Check if playlist has already been processed"""
        if playlist_id in self.processed_playlists:
            return True

        if not self.redis_client:
            return False

        digest = hashlib.sha1(playlist_id.encode('utf-8')).hexdigest()
        key = f"{self.redis_prefix}:{digest}"

        try:
            return bool(self.redis_client.exists(key))
        except Exception as e:
            self.logger.debug(f"Redis check failed: {e}")
            return False

    def _mark_playlist_processed(self, playlist_id: str):
        """Mark playlist as processed"""
        self.processed_playlists.add(playlist_id)

        if not self.redis_client:
            return

        digest = hashlib.sha1(playlist_id.encode('utf-8')).hexdigest()
        key = f"{self.redis_prefix}:{digest}"

        try:
            self.redis_client.setex(key, self.source_ttl_seconds, datetime.utcnow().isoformat())
        except Exception as e:
            self.logger.debug(f"Redis mark failed: {e}")

    def handle_error(self, failure):
        """Handle request errors with rate limit detection"""
        request = failure.request

        if hasattr(failure.value, 'response') and failure.value.response:
            response = failure.value.response

            # Handle rate limiting (429)
            if response.status == 429:
                retry_after = response.headers.get('Retry-After', 60)
                self.logger.warning(f"Spotify API rate limit hit. Retry after {retry_after}s")
                # Scrapy will handle retry automatically
                return

            # Handle unauthorized (401) - token expired
            if response.status == 401:
                self.logger.warning("Spotify token expired, re-authenticating...")
                self.access_token = None
                return

        self.logger.error(f"Request failed: {request.url} - {failure.value}")

    def closed(self, reason):
        """Log spider completion statistics"""
        self.logger.info(f"\n{'='*60}")
        self.logger.info(f"SPOTIFY API SPIDER COMPLETED")
        self.logger.info(f"{'='*60}")
        self.logger.info(f"Spider closed: {reason}")
        self.logger.info(f"Playlists processed: {len(self.processed_playlists)}")
        self.logger.info(f"{'='*60}")
