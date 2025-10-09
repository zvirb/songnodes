"""
MusicBrainz Spider - Canonical Entity Resolution (Framework Section 1.1)
===========================================================================

The foundational layer for entity resolution using MusicBrainz as the "Rosetta Stone".
Provides stable, unique identifiers (MBID, ISRC) for reliable cross-source linking.

Framework Quote:
"MusicBrainz provides stable, unique identifiers for musical works, including the
MusicBrainz ID (MBID) and the International Standard Recording Code (ISRC). These
identifiers serve as the primary keys in the master database."

Features:
- Query by ISRC (from Spotify) for exact matches
- Query by artist + title for fuzzy matching
- Extract canonical metadata (release dates, relationships)
- Respect 1 req/sec rate limit per framework specification
"""

import scrapy
import json
import logging
import hashlib
import time
from typing import Dict, Optional, List
from datetime import datetime
from urllib.parse import urlencode, quote
import redis

try:
    from ..items import EnhancedTrackItem, EnhancedArtistItem
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from items import EnhancedTrackItem, EnhancedArtistItem


class MusicBrainzSpider(scrapy.Spider):
    """
    MusicBrainz API spider for canonical entity resolution.

    Rate Limit: 1 request/second (framework specification Section 2.1)
    Authentication: User-Agent required (no API key for read-only)
    """
    name = 'musicbrainz'
    allowed_domains = ['musicbrainz.org']

    # STRICT rate limiting - 1 request per second as per MusicBrainz policy
    download_delay = 1.0
    randomize_download_delay = 0.1  # 0.9-1.1 seconds

    custom_settings = {
        'DOWNLOAD_DELAY': 1.0,
        'RANDOMIZE_DOWNLOAD_DELAY': 0.1,
        'CONCURRENT_REQUESTS': 1,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 1.0,
        'AUTOTHROTTLE_MAX_DELAY': 5.0,
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 1.0,
        'RETRY_TIMES': 3,
        'RETRY_HTTP_CODES': [429, 503, 500, 502, 504],
        'DOWNLOAD_TIMEOUT': 30,
        'USER_AGENT': 'SongNodes/1.0 (https://songnodes.com; contact@songnodes.com)',
        'ITEM_PIPELINES': {
            'pipelines.raw_data_storage_pipeline.RawDataStoragePipeline': 50,  # Raw data archive
            'pipelines.validation_pipeline.ValidationPipeline': 100,  # Validation
            'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,  # Enrichment
            'pipelines.persistence_pipeline.PersistencePipeline': 300,  # Modern async persistence
        }
    }

    def __init__(self, search_tracks=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.api_base = 'https://musicbrainz.org/ws/2'
        self.search_tracks = search_tracks  # JSON list of {artist, title, isrc?}
        self.redis_client = None
        self._initialize_redis()

    def _initialize_redis(self):
        """Initialize Redis for caching MusicBrainz responses"""
        import os
        host = os.getenv('REDIS_HOST', 'localhost')
        port = int(os.getenv('REDIS_PORT', 6379))
        db = int(os.getenv('REDIS_DB', 0))

        try:
            client = redis.Redis(host=host, port=port, db=db, decode_responses=True, socket_timeout=2)
            client.ping()
            self.redis_client = client
            self.logger.info(f"Using Redis for MusicBrainz cache at {host}:{port}")
        except Exception as e:
            self.redis_client = None
            self.logger.warning(f"Redis not available for MusicBrainz caching: {e}")

        # Load User-Agent from database API key storage
        self._load_user_agent()

    def _load_user_agent(self):
        """Load MusicBrainz User-Agent from database or environment"""
        import os
        import asyncio
        import asyncpg

        # Try environment variable first
        user_agent = os.getenv('MUSICBRAINZ_USER_AGENT')
        if user_agent:
            self.custom_settings['USER_AGENT'] = user_agent
            self.logger.info(f"Using MusicBrainz User-Agent from environment")
            return

        # Try database
        try:
            db_host = os.getenv('DATABASE_HOST', 'postgres')
            db_port = int(os.getenv('DATABASE_PORT', '5432'))
            db_name = os.getenv('DATABASE_NAME', 'musicdb')
            db_user = os.getenv('DATABASE_USER', 'musicdb_user')
            db_password = os.getenv('DATABASE_PASSWORD', 'musicdb_secure_pass_2024')
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET', 'songnodes_change_in_production_2024')

            async def fetch_user_agent():
                conn = await asyncpg.connect(
                    host=db_host,
                    port=db_port,
                    database=db_name,
                    user=db_user,
                    password=db_password,
                    timeout=5.0
                )
                try:
                    user_agent = await conn.fetchval(
                        "SELECT get_api_key($1, $2, $3)",
                        'musicbrainz', 'user_agent', encryption_secret
                    )
                    return user_agent
                finally:
                    await conn.close()

            loop = asyncio.new_event_loop()
            try:
                user_agent = loop.run_until_complete(fetch_user_agent())
                if user_agent:
                    self.custom_settings['USER_AGENT'] = user_agent
                    self.logger.info("✓ Loaded MusicBrainz User-Agent from database")
                else:
                    self.logger.warning("⚠️  MusicBrainz User-Agent not configured - using default")
            finally:
                loop.close()

        except Exception as e:
            self.logger.debug(f"Database API key load failed (will use default): {e}")

    def start(self):
        """Generate initial requests based on search tracks"""
        if self.search_tracks:
            # Parse search tracks from JSON
            try:
                tracks = json.loads(self.search_tracks)
                for track in tracks:
                    yield from self._search_track(track)
            except json.JSONDecodeError as e:
                self.logger.error(f"Failed to parse search_tracks JSON: {e}")
        else:
            # Load from target tracks file
            yield from self._load_target_tracks()

    def _load_target_tracks(self):
        """Load target tracks from database or file"""
        import os
        target_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'target_tracks_for_scraping.json'
        )

        try:
            with open(target_file, 'r') as f:
                data = json.load(f)

            priority_tracks = data.get('scraper_targets', {}).get('priority_tracks', [])

            # Limit to first 50 for initial run (prevent timeout)
            for track in priority_tracks[:50]:
                track_data = {
                    'artist': track.get('primary_artist'),
                    'title': track.get('track_title'),
                    'isrc': track.get('isrc')  # May be None
                }
                yield from self._search_track(track_data)

        except Exception as e:
            self.logger.warning(f"Failed to load target tracks: {e}")

    def _search_track(self, track_data: Dict):
        """Search for track using ISRC or artist+title"""
        artist = track_data.get('artist')
        title = track_data.get('title')
        isrc = track_data.get('isrc')

        # Check cache first
        cache_key = self._get_cache_key(artist, title, isrc)
        if self._check_cache(cache_key):
            self.logger.debug(f"Cache hit for: {artist} - {title}")
            return

        # Priority 1: Search by ISRC (exact match)
        if isrc:
            yield scrapy.Request(
                url=f"{self.api_base}/isrc/{isrc}?fmt=json&inc=artist-credits+releases",
                callback=self.parse_isrc_response,
                errback=self.handle_error,
                meta={'track_data': track_data, 'cache_key': cache_key}
            )
        # Priority 2: Search by artist + title (fuzzy match)
        elif artist and title:
            query = f'artist:"{artist}" AND recording:"{title}"'
            params = {
                'query': query,
                'fmt': 'json',
                'limit': 10
            }
            yield scrapy.Request(
                url=f"{self.api_base}/recording/?{urlencode(params)}",
                callback=self.parse_search_response,
                errback=self.handle_error,
                meta={'track_data': track_data, 'cache_key': cache_key}
            )

    def parse_isrc_response(self, response):
        """Parse ISRC lookup response (exact match)"""
        try:
            data = json.loads(response.text)
            recordings = data.get('recordings', [])

            if not recordings:
                self.logger.debug(f"No recordings found for ISRC: {response.meta['track_data'].get('isrc')}")
                # Fallback to artist+title search
                track_data = response.meta['track_data']
                yield from self._search_track({'artist': track_data['artist'], 'title': track_data['title']})
                return

            # Use first recording (ISRC is unique identifier)
            recording = recordings[0]
            yield from self._create_items_from_recording(recording, response.meta['track_data'])

            # Cache result
            self._cache_result(response.meta['cache_key'], recording)

        except Exception as e:
            self.logger.error(f"Error parsing ISRC response: {e}")

    def parse_search_response(self, response):
        """Parse recording search response (fuzzy match)"""
        try:
            data = json.loads(response.text)
            recordings = data.get('recordings', [])

            if not recordings:
                self.logger.debug(f"No recordings found for: {response.meta['track_data']}")
                return

            # Find best match using similarity scoring
            best_match = self._find_best_match(
                recordings,
                response.meta['track_data']['artist'],
                response.meta['track_data']['title']
            )

            if best_match:
                # Fetch full recording details with relationships
                recording_id = best_match['id']
                yield scrapy.Request(
                    url=f"{self.api_base}/recording/{recording_id}?fmt=json&inc=artist-credits+releases+isrcs",
                    callback=self.parse_recording_details,
                    errback=self.handle_error,
                    meta={'track_data': response.meta['track_data'], 'cache_key': response.meta['cache_key']}
                )

        except Exception as e:
            self.logger.error(f"Error parsing search response: {e}")

    def parse_recording_details(self, response):
        """Parse full recording details"""
        try:
            recording = json.loads(response.text)
            yield from self._create_items_from_recording(recording, response.meta['track_data'])

            # Cache result
            self._cache_result(response.meta['cache_key'], recording)

        except Exception as e:
            self.logger.error(f"Error parsing recording details: {e}")

    def _create_items_from_recording(self, recording: Dict, original_track_data: Dict):
        """Create EnhancedTrackItem and EnhancedArtistItem from MusicBrainz recording"""
        # Extract canonical data
        mbid = recording.get('id')
        title = recording.get('title')
        duration_ms = recording.get('length')  # MusicBrainz stores in milliseconds

        # Extract ISRC (may have multiple)
        isrcs = recording.get('isrcs', [])
        isrc = isrcs[0] if isrcs else None

        # Extract artist credits
        artist_credits = recording.get('artist-credit', [])
        primary_artist = artist_credits[0].get('artist', {}).get('name') if artist_credits else None

        # Extract release information
        releases = recording.get('releases', [])
        release_date = None
        label = None
        if releases:
            first_release = releases[0]
            release_date = first_release.get('date')
            if first_release.get('label-info'):
                label_info = first_release['label-info'][0]
                label = label_info.get('label', {}).get('name')

        # Create enhanced track item
        track_item = EnhancedTrackItem(
            track_id=original_track_data.get('track_id'),  # Preserve existing ID if present
            track_name=title,
            normalized_title=title.lower().strip(),
            musicbrainz_id=mbid,
            isrc=isrc,
            duration_ms=duration_ms,
            release_date=release_date,
            record_label=label,
            metadata=json.dumps({
                'musicbrainz': {
                    'recording_id': mbid,
                    'all_isrcs': isrcs,
                    'disambiguation': recording.get('disambiguation'),
                    'video': recording.get('video', False),
                    'release_count': len(releases)
                },
                'canonical_source': 'musicbrainz',
                'original_query': original_track_data
            }),
            external_urls=json.dumps({
                'musicbrainz': f"https://musicbrainz.org/recording/{mbid}"
            }),
            data_source=self.name,
            scrape_timestamp=datetime.utcnow(),
            created_at=datetime.utcnow()
        )

        self.logger.info(f"✓ MusicBrainz matched: {primary_artist} - {title} (MBID: {mbid})")
        yield track_item

        # Create artist items
        for credit in artist_credits:
            artist_data = credit.get('artist', {})
            artist_item = EnhancedArtistItem(
                artist_name=artist_data.get('name'),
                normalized_name=artist_data.get('name', '').lower().strip(),
                musicbrainz_id=artist_data.get('id'),
                aliases=[alias.get('name') for alias in artist_data.get('aliases', [])],
                metadata=json.dumps({
                    'musicbrainz': {
                        'artist_id': artist_data.get('id'),
                        'sort_name': artist_data.get('sort-name'),
                        'disambiguation': artist_data.get('disambiguation'),
                        'type': artist_data.get('type')
                    }
                }),
                external_urls=json.dumps({
                    'musicbrainz': f"https://musicbrainz.org/artist/{artist_data.get('id')}"
                }),
                data_source=self.name,
                scrape_timestamp=datetime.utcnow(),
                created_at=datetime.utcnow()
            )
            yield artist_item

    def _find_best_match(self, recordings: List[Dict], artist: str, title: str) -> Optional[Dict]:
        """Find best matching recording using similarity scoring"""
        from difflib import SequenceMatcher

        best_score = 0
        best_match = None

        for recording in recordings:
            # Calculate artist similarity
            recording_artists = recording.get('artist-credit', [])
            if not recording_artists:
                continue

            recording_artist = recording_artists[0].get('artist', {}).get('name', '')
            artist_sim = SequenceMatcher(None, artist.lower(), recording_artist.lower()).ratio()

            # Calculate title similarity
            recording_title = recording.get('title', '')
            title_sim = SequenceMatcher(None, title.lower(), recording_title.lower()).ratio()

            # Weighted score (artist 60%, title 40%)
            score = (artist_sim * 0.6) + (title_sim * 0.4)

            if score > best_score:
                best_score = score
                best_match = recording

        # Only return if confidence is high (>0.7)
        if best_score >= 0.7:
            self.logger.debug(f"Match score {best_score:.2f}: {artist} - {title}")
            return best_match
        else:
            self.logger.debug(f"Low match score {best_score:.2f}, skipping")
            return None

    def _get_cache_key(self, artist: str, title: str, isrc: str = None) -> str:
        """Generate cache key for MusicBrainz lookup"""
        if isrc:
            key_str = f"mb:isrc:{isrc}"
        else:
            key_str = f"mb:search:{artist}:{title}".lower()
        return hashlib.sha1(key_str.encode('utf-8')).hexdigest()

    def _check_cache(self, cache_key: str) -> bool:
        """Check if result is cached"""
        if not self.redis_client:
            return False
        try:
            return bool(self.redis_client.exists(f"musicbrainz:{cache_key}"))
        except Exception as e:
            self.logger.debug(f"Cache check failed: {e}")
            return False

    def _cache_result(self, cache_key: str, recording: Dict):
        """Cache MusicBrainz result"""
        if not self.redis_client:
            return
        try:
            # Cache for 30 days
            self.redis_client.setex(
                f"musicbrainz:{cache_key}",
                30 * 86400,
                json.dumps(recording)
            )
        except Exception as e:
            self.logger.debug(f"Cache write failed: {e}")

    def handle_error(self, failure):
        """Handle request errors with rate limit detection"""
        request = failure.request

        if hasattr(failure.value, 'response') and failure.value.response:
            response = failure.value.response

            # Handle rate limiting (503 with specific message)
            if response.status == 503:
                self.logger.warning("MusicBrainz rate limit hit. Backing off...")
                return

        self.logger.error(f"MusicBrainz request failed: {request.url} - {failure.value}")

    def closed(self, reason):
        """Log spider completion"""
        self.logger.info(f"MusicBrainz spider closed: {reason}")
