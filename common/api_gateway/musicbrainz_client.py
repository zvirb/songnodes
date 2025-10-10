"""
MusicBrainz API Client with Full Resilience Stack
================================================

Implements MusicBrainz API integration for canonical music metadata.

Key Features:
- ISRC lookups
- Recording/release search
- Artist disambiguation
- Relationship data (covers, remixes, etc.)
- 1 request/second rate limiting (API requirement)

Built on BaseAPIClient for automatic caching, rate limiting, and circuit breaking.

API Documentation: https://musicbrainz.org/doc/MusicBrainz_API
"""

import logging
import time
from typing import Dict, Optional, List

from .base_client import BaseAPIClient

logger = logging.getLogger(__name__)


class MusicBrainzClient(BaseAPIClient):
    """
    MusicBrainz API client with resilience patterns.

    MusicBrainz is a FREE, community-maintained music metadata database.
    Rate limit: 1 request per second (enforced by rate limiter).

    Usage:
        client = MusicBrainzClient(
            user_agent="MyApp/1.0 (contact@example.com)",
            cache_manager=cache,
            rate_limiter=limiter,  # Must be configured for 1 req/sec
            circuit_breaker=breaker
        )

        # Search by ISRC
        recording = client.lookup_isrc(isrc="USIR20400500")

        # Search by artist and title
        results = client.search_recording(artist="Deadmau5", title="Strobe")
    """

    def __init__(
        self,
        user_agent: str,
        cache_manager,
        rate_limiter,
        circuit_breaker,
        timeout: int = 10
    ):
        """
        Initialize MusicBrainz client.

        Args:
            user_agent: User-Agent string (REQUIRED by MusicBrainz)
                       Format: "AppName/Version (contact@email.com)"
            cache_manager: CacheManager instance
            rate_limiter: RateLimiter (must have 'musicbrainz' configured at 1 req/s)
            circuit_breaker: CircuitBreaker instance
            timeout: Request timeout in seconds
        """
        super().__init__(
            provider_name="musicbrainz",
            cache_manager=cache_manager,
            rate_limiter=rate_limiter,
            circuit_breaker=circuit_breaker,
            timeout=timeout
        )

        if not user_agent:
            raise ValueError("MusicBrainz requires a User-Agent header")

        self.user_agent = user_agent
        logger.info(f"MusicBrainz API Client ready (User-Agent: {user_agent})")

    def _get_base_url(self) -> str:
        """MusicBrainz API base URL."""
        return "https://musicbrainz.org/ws/2"

    def _get_default_headers(self) -> Dict[str, str]:
        """
        MusicBrainz requires User-Agent header.

        Reference: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
        """
        return {
            'User-Agent': self.user_agent,
            'Accept': 'application/json'
        }

    def _handle_response(self, response) -> Dict:
        """Parse MusicBrainz JSON response."""
        try:
            return response.json()
        except ValueError as e:
            logger.error(f"MusicBrainz: Invalid JSON response - {e}")
            raise

    def lookup_isrc(self, isrc: str, use_cache: bool = True) -> Optional[Dict]:
        """
        Lookup recording by ISRC (International Standard Recording Code).

        ISRC is a globally unique identifier for recordings.

        Args:
            isrc: ISRC code (e.g., "USIR20400500")
            use_cache: Use Redis cache

        Returns:
            Recording data or None if not found

        API Endpoint: GET /isrc/{isrc}
        """
        cache_key = f"musicbrainz:isrc:{isrc}"

        response = self._make_request(
            method='GET',
            endpoint=f'/isrc/{isrc}',
            params={'fmt': 'json'},
            cache_key=cache_key if use_cache else None,
            cache_ttl=2592000,  # 30 days (ISRCs don't change)
        )

        # MusicBrainz returns a list of recordings for an ISRC
        recordings = response.get('recordings', [])

        if not recordings:
            logger.debug(f"MusicBrainz: No recording found for ISRC {isrc}")
            return None

        # Return first recording (ISRCs should be unique, but duplicates exist)
        recording = recordings[0]
        logger.debug(
            f"MusicBrainz: Found '{recording['title']}' "
            f"(MBID: {recording['id']})"
        )

        return recording

    def search_recording(
        self,
        artist: str,
        title: str,
        limit: int = 5,
        use_cache: bool = True
    ) -> List[Dict]:
        """
        Search for recording by artist and title.

        Uses Lucene query syntax for powerful matching.

        Args:
            artist: Artist name
            title: Recording title
            limit: Maximum results to return
            use_cache: Use Redis cache

        Returns:
            List of matching recordings (may be empty)

        API Endpoint: GET /recording?query=...
        """
        # Build Lucene query
        query = f'artist:"{artist}" AND recording:"{title}"'

        cache_key = f"musicbrainz:search:{artist.lower()}:{title.lower()}"

        response = self._make_request(
            method='GET',
            endpoint='/recording/',
            params={
                'query': query,
                'fmt': 'json',
                'limit': limit
            },
            cache_key=cache_key if use_cache else None,
            cache_ttl=604800,  # 7 days
        )

        recordings = response.get('recordings', [])

        logger.debug(
            f"MusicBrainz: Found {len(recordings)} recording(s) for "
            f"'{artist} - {title}'"
        )

        return recordings

    def get_recording(
        self,
        mbid: str,
        includes: Optional[List[str]] = None,
        use_cache: bool = True
    ) -> Optional[Dict]:
        """
        Get recording by MusicBrainz ID (MBID).

        Args:
            mbid: MusicBrainz recording ID
            includes: Additional data to include (e.g., ['artists', 'releases', 'isrcs'])
            use_cache: Use Redis cache

        Returns:
            Recording data or None if not found

        API Endpoint: GET /recording/{mbid}
        """
        cache_key = f"musicbrainz:recording:{mbid}"

        params = {'fmt': 'json'}
        if includes:
            params['inc'] = '+'.join(includes)

        response = self._make_request(
            method='GET',
            endpoint=f'/recording/{mbid}',
            params=params,
            cache_key=cache_key if use_cache else None,
            cache_ttl=2592000,  # 30 days
        )

        return response

    def get_release(
        self,
        mbid: str,
        includes: Optional[List[str]] = None,
        use_cache: bool = True
    ) -> Optional[Dict]:
        """
        Get release by MusicBrainz ID.

        Args:
            mbid: MusicBrainz release ID
            includes: Additional data to include (e.g., ['artists', 'recordings'])
            use_cache: Use Redis cache

        Returns:
            Release data or None if not found

        API Endpoint: GET /release/{mbid}
        """
        cache_key = f"musicbrainz:release:{mbid}"

        params = {'fmt': 'json'}
        if includes:
            params['inc'] = '+'.join(includes)

        response = self._make_request(
            method='GET',
            endpoint=f'/release/{mbid}',
            params=params,
            cache_key=cache_key if use_cache else None,
            cache_ttl=2592000,  # 30 days
        )

        return response
