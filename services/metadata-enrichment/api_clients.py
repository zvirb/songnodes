"""
API clients for metadata enrichment with circuit breakers and rate limiting
"""

import asyncio
import base64
import hashlib
import json
import os
import time
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import aiohttp
import redis.asyncio as aioredis
import structlog

from circuit_breaker import CircuitBreaker
from retry_handler import fetch_with_exponential_backoff, RetryExhausted
from abbreviation_expander import get_abbreviation_expander

logger = structlog.get_logger(__name__)

# ===================
# RETRY CONFIGURATION
# ===================
API_MAX_RETRIES = int(os.getenv('API_MAX_RETRIES', '5'))
API_INITIAL_DELAY = float(os.getenv('API_INITIAL_DELAY', '1.0'))
API_MAX_DELAY = float(os.getenv('API_MAX_DELAY', '60.0'))

# ===================
# SPOTIFY CLIENT
# ===================
class SpotifyClient:
    """Spotify Web API client with OAuth 2.0 and rate limiting"""

    def __init__(self, client_id: str, client_secret: str, redis_client: aioredis.Redis, db_session_factory=None):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redis_client = redis_client
        self.db_session_factory = db_session_factory  # For user token retrieval
        self.base_url = "https://api.spotify.com/v1"
        self.token_url = "https://accounts.spotify.com/api/token"
        self.access_token = None
        self.token_expires_at = 0
        self.user_token_mode = db_session_factory is not None  # Use user tokens if DB available
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            timeout_seconds=60,
            name="spotify"
        )
        self.rate_limiter = RateLimiter(requests_per_second=3)

    async def _get_user_token_from_db(self) -> Optional[str]:
        """Get user OAuth token from database (for audio features access) with automatic refresh"""
        if not self.db_session_factory:
            return None

        try:
            from sqlalchemy import text
            from datetime import datetime, timedelta

            async with self.db_session_factory() as session:
                # Get token with refresh capability
                result = await session.execute(
                    text("""
                        SELECT access_token, refresh_token, expires_at
                        FROM user_oauth_tokens
                        WHERE service = 'spotify' AND user_id = 'default_user'
                        ORDER BY expires_at DESC
                        LIMIT 1
                    """)
                )
                row = result.fetchone()

                if not row:
                    logger.warning("⚠️ No Spotify user token found in database")
                    return None

                # Check if token is still valid (with 5-minute buffer)
                expires_at = row.expires_at
                # Ensure both datetimes are timezone-aware for comparison
                now_utc = datetime.now(expires_at.tzinfo) if expires_at.tzinfo else datetime.now()
                if expires_at > now_utc + timedelta(minutes=5):
                    logger.debug("✅ Retrieved valid Spotify user token from database")
                    return row.access_token

                # Token expired or expiring soon - try to refresh
                if row.refresh_token:
                    logger.info("🔄 Spotify user token expired/expiring, attempting refresh...")
                    new_token = await self._refresh_user_token(row.refresh_token)
                    if new_token:
                        logger.info("✅ Successfully refreshed Spotify user token")
                        return new_token
                    else:
                        logger.warning("⚠️ Failed to refresh Spotify user token")
                        return None
                else:
                    logger.warning("⚠️ Spotify user token expired and no refresh token available")
                    return None

        except Exception as e:
            logger.error(f"Failed to retrieve user token from database: {e}")
            return None

    async def _refresh_user_token(self, refresh_token: str) -> Optional[str]:
        """Refresh expired user OAuth token and update database"""
        try:
            from sqlalchemy import text
            from datetime import datetime, timedelta

            # Request new access token using refresh token
            auth_str = f"{self.client_id}:{self.client_secret}"
            auth_bytes = auth_str.encode('utf-8')
            auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

            headers = {
                'Authorization': f'Basic {auth_base64}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }

            data = {
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(self.token_url, headers=headers, data=data) as response:
                    if response.status == 200:
                        token_data = await response.json()
                        new_access_token = token_data['access_token']
                        new_refresh_token = token_data.get('refresh_token', refresh_token)  # Spotify may not return new refresh token
                        expires_in = token_data['expires_in']
                        expires_at = datetime.now() + timedelta(seconds=expires_in)

                        # Update database with new token
                        if self.db_session_factory:
                            async with self.db_session_factory() as db_session:
                                await db_session.execute(
                                    text("""
                                        UPDATE user_oauth_tokens
                                        SET access_token = :access_token,
                                            refresh_token = :refresh_token,
                                            expires_at = :expires_at,
                                            updated_at = CURRENT_TIMESTAMP
                                        WHERE service = 'spotify' AND user_id = 'default_user'
                                    """),
                                    {
                                        'access_token': new_access_token,
                                        'refresh_token': new_refresh_token,
                                        'expires_at': expires_at
                                    }
                                )
                                await db_session.commit()
                                logger.info(f"✅ Updated Spotify user token in database (expires: {expires_at.isoformat()})")

                        return new_access_token
                    else:
                        error_data = await response.text()
                        logger.error(f"Failed to refresh Spotify token: {response.status} - {error_data}")
                        return None

        except Exception as e:
            logger.error(f"Error refreshing Spotify user token: {e}")
            return None

    async def _get_access_token(self) -> str:
        """Get Spotify access token - prefers user tokens (for audio features) over client credentials"""
        # Try user token first (has access to audio features)
        if self.user_token_mode:
            user_token = await self._get_user_token_from_db()
            if user_token:
                logger.debug("Using Spotify user token (audio features enabled)")
                return user_token
            else:
                logger.info("No user token available, falling back to client credentials (no audio features)")

        # Fallback to client credentials flow (no audio features access)
        if self.access_token and time.time() < self.token_expires_at:
            return self.access_token

        # Check cache
        cache_key = f"spotify:token:{self.client_id}"
        cached_token = await self.redis_client.get(cache_key)
        if cached_token:
            token_data = json.loads(cached_token)
            self.access_token = token_data['access_token']
            self.token_expires_at = token_data['expires_at']
            return self.access_token

        # Request new token
        auth_str = f"{self.client_id}:{self.client_secret}"
        auth_bytes = auth_str.encode('utf-8')
        auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

        headers = {
            'Authorization': f'Basic {auth_base64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        data = {'grant_type': 'client_credentials'}

        async with aiohttp.ClientSession() as session:
            async with session.post(self.token_url, headers=headers, data=data) as response:
                if response.status == 200:
                    token_data = await response.json()
                    self.access_token = token_data['access_token']
                    expires_in = token_data['expires_in']
                    self.token_expires_at = time.time() + expires_in - 60  # 60s buffer

                    # Cache token
                    cache_data = {
                        'access_token': self.access_token,
                        'expires_at': self.token_expires_at
                    }
                    await self.redis_client.setex(
                        cache_key,
                        expires_in - 60,
                        json.dumps(cache_data)
                    )

                    return self.access_token
                else:
                    raise Exception(f"Failed to get Spotify token: {response.status}")

    async def search_track(self, artist: str, title: str) -> Optional[Dict[str, Any]]:
        """Search for track by artist and title"""
        await self.rate_limiter.wait()

        query = f"artist:{artist} track:{title}"
        cache_key = f"spotify:search:{hashlib.md5(query.encode()).hexdigest()}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            logger.debug("Spotify search cache hit", query=query)
            return json.loads(cached)

        async def _search():
            token = await self._get_access_token()
            headers = {'Authorization': f'Bearer {token}'}

            url = f"{self.base_url}/search?q={quote(query)}&type=track&limit=1"

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, headers=headers) as response:
                        response.raise_for_status()
                        data = await response.json()
                        if data['tracks']['items']:
                            track = data['tracks']['items'][0]
                            result = self._extract_track_metadata(track)

                            # Cache for 7 days
                            await self.redis_client.setex(
                                cache_key,
                                7 * 24 * 3600,
                                json.dumps(result)
                            )

                            return result
                        return None

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'spotify', 'method': 'search_track', 'query': query}
            )

        try:
            return await self.circuit_breaker.call(_search)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.error("Spotify search failed", error=str(e), query=query)
            return None

    async def search_track_multiple(
        self,
        artist: Optional[str],
        title: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for tracks and return multiple results for fuzzy matching.

        Unlike search_track() which returns single best match, this returns
        top N results so fuzzy matcher can apply label-based filtering.

        Args:
            artist: Artist name (may be None/Unknown for fuzzy matching)
            title: Track title
            limit: Maximum results to return (default 10)

        Returns:
            List of track metadata dicts with label information
        """
        await self.rate_limiter.wait()

        # Build search query
        if artist and artist.lower() not in ['unknown', 'various artists']:
            query = f"track:{title} artist:{artist}"
        else:
            query = f"track:{title}"

        cache_key = f"spotify:search_multi:{hashlib.md5(query.encode()).hexdigest()}:{limit}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            logger.debug("Spotify multi-search cache hit", query=query)
            return json.loads(cached)

        async def _search():
            token = await self._get_access_token()
            headers = {'Authorization': f'Bearer {token}'}

            url = f"{self.base_url}/search?q={quote(query)}&type=track&limit={limit}"

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, headers=headers) as response:
                        response.raise_for_status()
                        data = await response.json()

                        results = []
                        for track in data['tracks']['items']:
                            # Extract basic metadata
                            metadata = self._extract_track_metadata(track)

                            # Get album details for label info
                            album_id = track['album']['id']
                            album_details = await self._get_album_label(album_id)
                            if album_details:
                                metadata['album']['label'] = album_details.get('label')

                            results.append(metadata)

                        # Cache for 7 days
                        await self.redis_client.setex(
                            cache_key,
                            7 * 24 * 3600,
                            json.dumps(results)
                        )

                        return results

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'spotify', 'method': 'search_track_multiple', 'query': query}
            )

        try:
            return await self.circuit_breaker.call(_search)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.error("Spotify multi-search failed", error=str(e), query=query)
            return []

    async def search_track_with_abbreviation_expansion(
        self,
        artist: Optional[str],
        title: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for tracks using abbreviation expansion

        If artist or title contains abbreviations (e.g., "Gold Music Kft."),
        this method will search with both original and expanded forms.

        Args:
            artist: Artist name (may contain abbreviations)
            title: Track title
            limit: Maximum results per search variant

        Returns:
            Combined deduplicated results from all search variants
        """
        expander = get_abbreviation_expander()
        all_results = []
        seen_ids = set()

        # Get search variants for artist (if provided)
        artist_variants = [artist] if artist else [None]
        if artist and expander.is_abbreviation(artist):
            artist_variants = await expander.get_search_variants(
                artist,
                context="music artist name"
            )
            logger.info(
                "🔍 Artist contains abbreviation, searching with variants",
                original=artist,
                variants=artist_variants
            )

        # Search with each artist variant
        for artist_variant in artist_variants:
            results = await self.search_track_multiple(
                artist=artist_variant,
                title=title,
                limit=limit
            )

            # Deduplicate by track ID
            for result in results:
                track_id = result.get('id')
                if track_id and track_id not in seen_ids:
                    seen_ids.add(track_id)
                    all_results.append(result)

        logger.debug(
            "Abbreviation-expanded search completed",
            artist=artist,
            title=title,
            variants_searched=len(artist_variants),
            unique_results=len(all_results)
        )

        return all_results[:limit * 2]  # Allow more results when using expansions

    async def _get_album_label(self, album_id: str) -> Optional[Dict[str, Any]]:
        """
        Get album details including label information.

        Spotify includes label in full album object but not in search results.
        This method fetches the full album to extract label.
        """
        cache_key = f"spotify:album_label:{album_id}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        try:
            token = await self._get_access_token()
            headers = {'Authorization': f'Bearer {token}'}

            url = f"{self.base_url}/albums/{album_id}"

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    response.raise_for_status()
                    album = await response.json()

                    result = {
                        'label': album.get('label'),
                        'release_date': album.get('release_date')
                    }

                    # Cache for 30 days (labels don't change)
                    await self.redis_client.setex(
                        cache_key,
                        30 * 24 * 3600,
                        json.dumps(result)
                    )

                    return result
        except Exception as e:
            logger.warning("Failed to get album label", album_id=album_id, error=str(e))
            return None

    async def get_track_by_id(self, spotify_id: str) -> Optional[Dict[str, Any]]:
        """Get track metadata by Spotify ID"""
        await self.rate_limiter.wait()

        cache_key = f"spotify:track:{spotify_id}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            logger.debug("Spotify track cache hit", spotify_id=spotify_id)
            return json.loads(cached)

        async def _get_track():
            token = await self._get_access_token()
            headers = {'Authorization': f'Bearer {token}'}

            url = f"{self.base_url}/tracks/{spotify_id}"

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, headers=headers) as response:
                        response.raise_for_status()
                        track = await response.json()
                        result = self._extract_track_metadata(track)

                        # Cache for 30 days
                        await self.redis_client.setex(
                            cache_key,
                            30 * 24 * 3600,
                            json.dumps(result)
                        )

                        return result

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'spotify', 'method': 'get_track_by_id', 'spotify_id': spotify_id}
            )

        try:
            return await self.circuit_breaker.call(_get_track)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.error("Spotify get track failed", error=str(e), spotify_id=spotify_id)
            return None

    async def get_audio_features(self, spotify_id: str) -> Optional[Dict[str, Any]]:
        """Get audio features for a track"""
        await self.rate_limiter.wait()

        cache_key = f"spotify:audio_features:{spotify_id}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        async def _get_features():
            token = await self._get_access_token()
            headers = {'Authorization': f'Bearer {token}'}

            url = f"{self.base_url}/audio-features/{spotify_id}"

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, headers=headers) as response:
                        response.raise_for_status()
                        features = await response.json()

                        # Cache for 90 days (audio features don't change)
                        await self.redis_client.setex(
                            cache_key,
                            90 * 24 * 3600,
                            json.dumps(features)
                        )

                        return features

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'spotify', 'method': 'get_audio_features', 'spotify_id': spotify_id}
            )

        try:
            return await self.circuit_breaker.call(_get_features)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.error("Spotify audio features failed", error=str(e), spotify_id=spotify_id)
            return None

    async def search_by_isrc(self, isrc: str) -> Optional[Dict[str, Any]]:
        """Search track by ISRC"""
        await self.rate_limiter.wait()

        cache_key = f"spotify:isrc:{isrc}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        async def _search_isrc():
            token = await self._get_access_token()
            headers = {'Authorization': f'Bearer {token}'}

            url = f"{self.base_url}/search?q=isrc:{isrc}&type=track&limit=1"

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, headers=headers) as response:
                        response.raise_for_status()
                        data = await response.json()
                        if data['tracks']['items']:
                            track = data['tracks']['items'][0]
                            result = self._extract_track_metadata(track)

                            # Cache for 90 days
                            await self.redis_client.setex(
                                cache_key,
                                90 * 24 * 3600,
                                json.dumps(result)
                            )

                            return result
                        return None

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'spotify', 'method': 'search_by_isrc', 'isrc': isrc}
            )

        try:
            return await self.circuit_breaker.call(_search_isrc)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.error("Spotify ISRC search failed", error=str(e), isrc=isrc)
            return None

    def _extract_track_metadata(self, track: Dict) -> Dict[str, Any]:
        """Extract metadata from Spotify track object"""
        return {
            'spotify_id': track['id'],
            'isrc': track.get('external_ids', {}).get('isrc'),
            'title': track['name'],
            'artists': [{'name': artist['name'], 'spotify_id': artist['id']} for artist in track['artists']],
            'album': {
                'name': track['album']['name'],
                'spotify_id': track['album']['id'],
                'release_date': track['album'].get('release_date')
            },
            'duration_ms': track['duration_ms'],
            'popularity': track.get('popularity'),
            'preview_url': track.get('preview_url')
        }

# ===================
# MUSICBRAINZ CLIENT
# ===================
class MusicBrainzClient:
    """MusicBrainz API client with 1 req/sec rate limit"""

    def __init__(self, user_agent: str, redis_client: aioredis.Redis):
        self.user_agent = user_agent
        self.redis_client = redis_client
        self.base_url = "https://musicbrainz.org/ws/2"
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=3,
            timeout_seconds=120,
            name="musicbrainz"
        )
        self.rate_limiter = RateLimiter(requests_per_second=0.9)  # Slightly under 1/sec

    async def search_by_isrc(self, isrc: str) -> Optional[Dict[str, Any]]:
        """Search recording by ISRC"""
        await self.rate_limiter.wait()

        cache_key = f"musicbrainz:isrc:{isrc}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        async def _search():
            headers = {'User-Agent': self.user_agent, 'Accept': 'application/json'}
            url = f"{self.base_url}/isrc/{isrc}?inc=artists+releases+isrcs"

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, headers=headers) as response:
                        response.raise_for_status()
                        data = await response.json()
                        if data.get('recordings'):
                            recording = data['recordings'][0]
                            result = self._extract_recording_metadata(recording)

                            # Only cache and return if extraction succeeded
                            if result:
                                # Cache for 90 days
                                await self.redis_client.setex(
                                    cache_key,
                                    90 * 24 * 3600,
                                    json.dumps(result)
                                )
                                return result
                        return None

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'musicbrainz', 'method': 'search_by_isrc', 'isrc': isrc}
            )

        try:
            return await self.circuit_breaker.call(_search)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.error("MusicBrainz ISRC search failed", error=str(e), isrc=isrc)
            return None

    async def search_recording(self, artist: str, title: str) -> Optional[Dict[str, Any]]:
        """Search recording by artist and title"""
        await self.rate_limiter.wait()

        query = f'artist:"{artist}" AND recording:"{title}"'
        cache_key = f"musicbrainz:search:{hashlib.md5(query.encode()).hexdigest()}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        async def _search():
            headers = {'User-Agent': self.user_agent, 'Accept': 'application/json'}
            url = f"{self.base_url}/recording?query={quote(query)}&limit=1&fmt=json"

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, headers=headers) as response:
                        response.raise_for_status()
                        data = await response.json()
                        if data['recordings']:
                            recording = data['recordings'][0]
                            result = self._extract_recording_metadata(recording)

                            # Only cache and return if extraction succeeded
                            if result:
                                # Cache for 30 days
                                await self.redis_client.setex(
                                    cache_key,
                                    30 * 24 * 3600,
                                    json.dumps(result)
                                )
                                return result
                        return None

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'musicbrainz', 'method': 'search_recording', 'query': query}
            )

        try:
            return await self.circuit_breaker.call(_search)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.error("MusicBrainz recording search failed", error=str(e), query=query)
            return None

    def _extract_recording_metadata(self, recording: Dict) -> Optional[Dict[str, Any]]:
        """
        Extract metadata from MusicBrainz recording.

        Returns None if recording doesn't have required 'id' field.
        """
        # MusicBrainz sometimes returns results without 'id' - skip these
        if not recording.get('id'):
            logger.warning(
                "MusicBrainz recording missing 'id' field, skipping",
                title=recording.get('title')
            )
            return None

        return {
            'musicbrainz_id': recording['id'],
            'title': recording.get('title', ''),
            'isrcs': recording.get('isrcs', []),
            'artists': [
                {
                    'name': artist.get('name', 'Unknown'),
                    'musicbrainz_id': artist.get('id'),  # May be None
                    'country': artist.get('country')
                }
                for artist in recording.get('artist-credit', [])
                if isinstance(artist, dict) and artist.get('name')
            ],
            'releases': [
                {
                    'title': release.get('title', ''),
                    'date': release.get('date'),
                    'country': release.get('country')
                }
                for release in recording.get('releases', [])[:3]
            ]
        }

# ===================
# DISCOGS CLIENT
# ===================
class DiscogsClient:
    """Discogs API client with 60 req/min limit"""

    def __init__(self, token: str, redis_client: aioredis.Redis):
        self.token = token
        self.redis_client = redis_client
        self.base_url = "https://api.discogs.com"
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            timeout_seconds=60,
            name="discogs"
        )
        self.rate_limiter = RateLimiter(requests_per_second=0.9)  # 60/min = 1/sec

    async def search(self, artist: str, title: str) -> Optional[Dict[str, Any]]:
        """Search Discogs for release"""
        await self.rate_limiter.wait()

        query = f"{artist} {title}"
        cache_key = f"discogs:search:{hashlib.md5(query.encode()).hexdigest()}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        async def _search():
            headers = {
                'Authorization': f'Discogs token={self.token}',
                'User-Agent': 'SongNodes/1.0'
            }
            url = f"{self.base_url}/database/search?q={quote(query)}&type=release&per_page=1"

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, headers=headers) as response:
                        response.raise_for_status()
                        data = await response.json()
                        if data['results']:
                            release = data['results'][0]
                            result = {
                                'discogs_id': release['id'],
                                'title': release['title'],
                                'label': release.get('label', [None])[0] if release.get('label') else None,
                                'year': release.get('year'),
                                'genre': release.get('genre', []),
                                'style': release.get('style', []),
                                'country': release.get('country')
                            }

                            # Cache for 30 days
                            await self.redis_client.setex(
                                cache_key,
                                30 * 24 * 3600,
                                json.dumps(result)
                            )

                            return result
                        return None

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'discogs', 'method': 'search', 'query': query}
            )

        try:
            return await self.circuit_breaker.call(_search)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.error("Discogs search failed", error=str(e), query=query)
            return None

# ===================
# BEATPORT CLIENT
# ===================
class BeatportClient:
    """Beatport scraper for electronic music metadata (no official API)"""

    def __init__(self, redis_client: aioredis.Redis):
        self.redis_client = redis_client
        self.base_url = "https://www.beatport.com"
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            timeout_seconds=60,
            name="beatport"
        )
        self.rate_limiter = RateLimiter(requests_per_second=0.5)

    async def search(self, artist: str, title: str) -> Optional[Dict[str, Any]]:
        """Search Beatport (basic implementation - would need web scraping)"""
        # Note: This is a placeholder. Real implementation would require
        # web scraping or unofficial API endpoints
        logger.warning("Beatport search not fully implemented")
        return None

# ===================
# LAST.FM CLIENT
# ===================
class LastFMClient:
    """Last.fm API client for tags and popularity"""

    def __init__(self, api_key: str, redis_client: aioredis.Redis):
        self.api_key = api_key
        self.redis_client = redis_client
        self.base_url = "http://ws.audioscrobbler.com/2.0"
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            timeout_seconds=60,
            name="lastfm"
        )
        self.rate_limiter = RateLimiter(requests_per_second=0.5)

    async def get_track_info(self, artist: str, track: str) -> Optional[Dict[str, Any]]:
        """Get track info from Last.fm"""
        await self.rate_limiter.wait()

        cache_key = f"lastfm:track:{hashlib.md5(f'{artist}{track}'.encode()).hexdigest()}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        async def _get_info():
            params = {
                'method': 'track.getInfo',
                'api_key': self.api_key,
                'artist': artist,
                'track': track,
                'format': 'json'
            }

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(self.base_url, params=params) as response:
                        response.raise_for_status()
                        data = await response.json()
                        if 'track' in data:
                            track_data = data['track']
                            result = {
                                'tags': [tag['name'] for tag in track_data.get('toptags', {}).get('tag', [])[:5]],
                                'playcount': int(track_data.get('playcount', 0)),
                                'listeners': int(track_data.get('listeners', 0))
                            }

                            # Cache for 7 days
                            await self.redis_client.setex(
                                cache_key,
                                7 * 24 * 3600,
                                json.dumps(result)
                            )

                            return result
                        return None

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'lastfm', 'method': 'get_track_info', 'artist': artist, 'track': track}
            )

        try:
            return await self.circuit_breaker.call(_get_info)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.error("Last.fm track info failed", error=str(e), artist=artist, track=track)
            return None

# ===================
# ACOUSTICBRAINZ CLIENT
# ===================
class AcousticBrainzClient:
    """AcousticBrainz API client for BPM and key detection via MusicBrainz IDs"""

    def __init__(self, redis_client: aioredis.Redis):
        self.redis_client = redis_client
        self.base_url = "https://acousticbrainz.org/api/v1"
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            timeout_seconds=60,
            name="acousticbrainz"
        )
        self.rate_limiter = RateLimiter(requests_per_second=2)

    async def get_audio_features(self, musicbrainz_id: str) -> Optional[Dict[str, Any]]:
        """Get BPM and key from AcousticBrainz using MusicBrainz recording ID"""
        await self.rate_limiter.wait()

        cache_key = f"acousticbrainz:{musicbrainz_id}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            logger.debug("AcousticBrainz cache hit", mbid=musicbrainz_id)
            return json.loads(cached)

        async def _get_features():
            url = f"{self.base_url}/{musicbrainz_id}/low-level"

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(url) as response:
                        if response.status == 404:
                            logger.debug("No AcousticBrainz data for recording", mbid=musicbrainz_id)
                            return None

                        response.raise_for_status()
                        data = await response.json()

                        # Extract BPM and key
                        result = {}

                        if 'rhythm' in data and 'bpm' in data['rhythm']:
                            result['bpm'] = round(data['rhythm']['bpm'], 2)

                        if 'tonal' in data:
                            key_data = data['tonal']
                            if 'key_key' in key_data and 'key_scale' in key_data:
                                # Combine key and scale (e.g., "C# minor")
                                result['key'] = f"{key_data['key_key']} {key_data['key_scale']}"
                            if 'key_strength' in key_data:
                                result['key_confidence'] = round(key_data['key_strength'], 3)

                        if result:
                            # Cache for 90 days (data doesn't change)
                            await self.redis_client.setex(
                                cache_key,
                                90 * 24 * 3600,
                                json.dumps(result)
                            )
                            logger.info("✓ AcousticBrainz data retrieved", mbid=musicbrainz_id, **result)
                            return result

                        return None

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'acousticbrainz', 'method': 'get_audio_features', 'mbid': musicbrainz_id}
            )

        try:
            return await self.circuit_breaker.call(_get_features)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.debug("AcousticBrainz lookup failed", error=str(e), mbid=musicbrainz_id)
            return None

# ===================
# GETSONGBPM CLIENT
# ===================
class GetSongBPMClient:
    """GetSongBPM API client for BPM and key lookups"""

    def __init__(self, api_key: Optional[str], redis_client: aioredis.Redis):
        self.api_key = api_key
        self.redis_client = redis_client
        self.base_url = "https://api.getsongbpm.com"
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            timeout_seconds=60,
            name="getsongbpm"
        )
        self.rate_limiter = RateLimiter(requests_per_second=1)  # Conservative rate

    async def search(self, artist: str, title: str) -> Optional[Dict[str, Any]]:
        """Search for BPM and key by artist and title"""
        if not self.api_key:
            logger.warning("GetSongBPM API key not configured - skipping")
            return None

        await self.rate_limiter.wait()

        query = f"{artist} {title}"
        cache_key = f"getsongbpm:search:{hashlib.md5(query.encode()).hexdigest()}"

        # Check cache
        cached = await self.redis_client.get(cache_key)
        if cached:
            logger.debug("GetSongBPM cache hit", query=query)
            return json.loads(cached)

        async def _search():
            params = {
                'api_key': self.api_key,
                'type': 'both',  # Search both artist and title
                'lookup': query
            }

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.get(f"{self.base_url}/search/", params=params) as response:
                        if response.status == 403:
                            logger.error("GetSongBPM API returned 403 - check API key")
                            return None

                        response.raise_for_status()
                        data = await response.json()

                        # Parse response (format depends on their API structure)
                        if data and 'search' in data and len(data['search']) > 0:
                            first_result = data['search'][0]
                            result = {}

                            if 'tempo' in first_result:
                                result['bpm'] = float(first_result['tempo'])
                            if 'song_key' in first_result:
                                result['key'] = first_result['song_key']

                            if result:
                                # Cache for 30 days
                                await self.redis_client.setex(
                                    cache_key,
                                    30 * 24 * 3600,
                                    json.dumps(result)
                                )
                                logger.info("✓ GetSongBPM data retrieved", query=query, **result)
                                return result

                        return None

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=API_MAX_RETRIES,
                initial_delay=API_INITIAL_DELAY,
                max_delay=API_MAX_DELAY,
                logger_context={'api': 'getsongbpm', 'method': 'search', 'query': query}
            )

        try:
            return await self.circuit_breaker.call(_search)
        except (RetryExhausted, aiohttp.ClientError) as e:
            logger.debug("GetSongBPM search failed", error=str(e), query=query)
            return None

# ===================
# SONOTELLER.AI CLIENT
# ===================
class SonotellerClient:
    """
    Sonoteller.ai API client via RapidAPI for comprehensive audio analysis

    ⚠️ CRITICAL: FREE TIER LIMIT = 5 REQUESTS/MONTH
    This should ONLY be used as an ABSOLUTE LAST RESORT when all other sources fail.
    """

    def __init__(self, rapidapi_key: Optional[str], redis_client: aioredis.Redis):
        self.rapidapi_key = rapidapi_key
        self.redis_client = redis_client
        self.base_url = "https://sonoteller-ai1.p.rapidapi.com"
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=2,  # Even lower - preserve quota
            timeout_seconds=120,   # Longer timeout - can take ~1 min per track
            name="sonoteller"
        )
        self.rate_limiter = RateLimiter(requests_per_second=0.1)  # Ultra conservative
        self.monthly_usage_key = "sonoteller:monthly_usage"
        self.monthly_limit = int(os.getenv("SONOTELLER_MONTHLY_LIMIT", "5"))  # DEFAULT: 5/month

    async def check_monthly_quota(self) -> bool:
        """
        Check if monthly quota has been exceeded.

        Returns:
            True if quota available, False if exceeded
        """
        try:
            # Get current usage count (resets monthly)
            import time
            from datetime import datetime

            # Create monthly key (e.g., "sonoteller:monthly_usage:2025-10")
            current_month = datetime.now().strftime("%Y-%m")
            usage_key = f"{self.monthly_usage_key}:{current_month}"

            current_usage = await self.redis_client.get(usage_key)
            current_usage = int(current_usage) if current_usage else 0

            if current_usage >= self.monthly_limit:
                logger.warning(
                    f"🚫 Sonoteller.ai monthly quota EXCEEDED",
                    usage=current_usage,
                    limit=self.monthly_limit,
                    month=current_month
                )
                return False

            logger.info(
                f"✓ Sonoteller.ai quota check",
                usage=current_usage,
                limit=self.monthly_limit,
                remaining=self.monthly_limit - current_usage
            )
            return True

        except Exception as e:
            logger.error(f"Failed to check Sonoteller quota: {e}")
            # Fail safe - block usage if we can't track it
            return False

    async def increment_monthly_usage(self):
        """Increment monthly usage counter"""
        try:
            from datetime import datetime

            current_month = datetime.now().strftime("%Y-%m")
            usage_key = f"{self.monthly_usage_key}:{current_month}"

            # Increment and set expiry for end of next month (to handle edge cases)
            await self.redis_client.incr(usage_key)
            await self.redis_client.expire(usage_key, 60 * 60 * 24 * 60)  # 60 days

        except Exception as e:
            logger.error(f"Failed to increment Sonoteller usage: {e}")

    async def analyze_track(self, artist: str, title: str, spotify_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Analyze track using Sonoteller.ai via YouTube URL

        Sonoteller requires an audio file URL (MP3 or YouTube).
        We'll construct a YouTube search URL from artist + title.

        ⚠️ FREE TIER = 5 REQUESTS/MONTH
        """
        if not self.rapidapi_key:
            logger.warning("Sonoteller.ai RapidAPI key not configured - skipping")
            return None

        # CHECK MONTHLY QUOTA FIRST (before rate limiter)
        if not await self.check_monthly_quota():
            logger.warning(
                "Sonoteller.ai monthly quota exceeded - skipping",
                artist=artist,
                title=title
            )
            return None

        await self.rate_limiter.wait()

        cache_key = f"sonoteller:{hashlib.md5(f'{artist}{title}'.encode()).hexdigest()}"

        # Check cache (long cache since analysis doesn't change)
        cached = await self.redis_client.get(cache_key)
        if cached:
            logger.debug("Sonoteller cache hit", artist=artist, title=title)
            return json.loads(cached)

        async def _analyze():
            # Construct YouTube search URL (Sonoteller can analyze from YouTube)
            import urllib.parse
            search_query = f"{artist} {title} official audio".strip()
            youtube_search_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(search_query)}"

            # Note: For actual implementation, we'd need the first video URL from search
            # For now, try multiple endpoint formats based on RapidAPI documentation

            headers = {
                'X-RapidAPI-Key': self.rapidapi_key,
                'X-RapidAPI-Host': 'sonoteller-ai1.p.rapidapi.com',
                'Content-Type': 'application/json'
            }

            # Try different payload formats that Sonoteller might accept
            payloads_to_try = [
                {'url': youtube_search_url},  # YouTube URL format
                {'youtube_url': youtube_search_url},  # Alternative YouTube format
                {'artist': artist, 'title': title},  # Text search format
                {'song_url': youtube_search_url},  # Another URL format
            ]

            async def _api_call():
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_url}/api/analyze",
                        headers=headers,
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=120)  # 2 min timeout
                    ) as response:
                        if response.status == 429:
                            logger.warning("Sonoteller.ai rate limit exceeded")
                            return None

                        response.raise_for_status()
                        data = await response.json()

                        # Extract relevant fields
                        result = {}

                        if 'BPMRange' in data:
                            # Parse BPM range (e.g., "128-132")
                            bpm_range = data['BPMRange']
                            if '-' in bpm_range:
                                bpm_values = bpm_range.split('-')
                                result['bpm'] = (float(bpm_values[0]) + float(bpm_values[1])) / 2
                                result['bpm_range'] = bpm_range
                            else:
                                result['bpm'] = float(bpm_range)

                        if 'musicalKey' in data:
                            result['key'] = data['musicalKey']

                        if 'mood' in data:
                            result['moods'] = data['mood']

                        if 'genres' in data:
                            result['genres'] = data['genres']

                        if 'instruments' in data:
                            result['instruments'] = data['instruments']

                        if result:
                            # INCREMENT USAGE COUNTER (successful call)
                            await self.increment_monthly_usage()

                            # Cache for 180 days (expensive API, data stable)
                            await self.redis_client.setex(
                                cache_key,
                                180 * 24 * 3600,
                                json.dumps(result)
                            )
                            logger.info("✓ Sonoteller.ai analysis complete", artist=artist, title=title, **result)
                            return result

                        return None

            return await fetch_with_exponential_backoff(
                _api_call,
                max_retries=2,  # Only retry twice (expensive)
                initial_delay=5.0,
                max_delay=30.0,
                logger_context={'api': 'sonoteller', 'method': 'analyze_track', 'artist': artist, 'title': title}
            )

        try:
            return await self.circuit_breaker.call(_analyze)
        except (RetryExhausted, aiohttp.ClientError, asyncio.TimeoutError) as e:
            logger.warning("Sonoteller.ai analysis failed", error=str(e), artist=artist, title=title)
            return None

# ===================
# RATE LIMITER
# ===================
class RateLimiter:
    """Simple token bucket rate limiter"""

    def __init__(self, requests_per_second: float):
        self.requests_per_second = requests_per_second
        self.min_interval = 1.0 / requests_per_second
        self.last_call = 0

    async def wait(self):
        """Wait if necessary to respect rate limit"""
        now = time.time()
        time_since_last_call = now - self.last_call

        if time_since_last_call < self.min_interval:
            await asyncio.sleep(self.min_interval - time_since_last_call)

        self.last_call = time.time()