"""
API clients for metadata enrichment with circuit breakers and rate limiting
"""

import asyncio
import base64
import hashlib
import json
import os
import time
from typing import Any, Dict, Optional
from urllib.parse import quote

import aiohttp
import redis.asyncio as aioredis
import structlog

from circuit_breaker import CircuitBreaker
from retry_handler import fetch_with_exponential_backoff, RetryExhausted

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

    def __init__(self, client_id: str, client_secret: str, redis_client: aioredis.Redis):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redis_client = redis_client
        self.base_url = "https://api.spotify.com/v1"
        self.token_url = "https://accounts.spotify.com/api/token"
        self.access_token = None
        self.token_expires_at = 0
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            timeout_seconds=60,
            name="spotify"
        )
        self.rate_limiter = RateLimiter(requests_per_second=3)

    async def _get_access_token(self) -> str:
        """Get Spotify access token using client credentials flow"""
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