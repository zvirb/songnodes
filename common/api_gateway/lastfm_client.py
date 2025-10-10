"""
Last.fm API Client with Full Resilience Stack
==============================================

Implements Last.fm API integration for:
- Track information and tags (genres)
- Artist information and similar artists
- User listening history (scrobbles)

Built on BaseAPIClient for automatic caching, rate limiting, and circuit breaking.

API Documentation: https://www.last.fm/api
"""

import logging
from typing import Dict, Optional, List

from .base_client import BaseAPIClient

logger = logging.getLogger(__name__)


class LastFmClient(BaseAPIClient):
    """
    Last.fm API client with resilience patterns.

    Last.fm provides rich tagging/genre data from community-driven classification.

    Usage:
        client = LastFmClient(
            api_key="your_api_key",
            cache_manager=cache,
            rate_limiter=limiter,
            circuit_breaker=breaker
        )

        # Get track tags (genres)
        tags = client.get_track_tags(artist="Deadmau5", track="Strobe")

        # Get track info
        info = client.get_track_info(artist="Deadmau5", track="Strobe")
    """

    def __init__(
        self,
        api_key: str,
        cache_manager,
        rate_limiter,
        circuit_breaker,
        timeout: int = 10
    ):
        """
        Initialize Last.fm client.

        Args:
            api_key: Last.fm API key
            cache_manager: CacheManager instance
            rate_limiter: RateLimiter (must have 'lastfm' configured)
            circuit_breaker: CircuitBreaker instance
            timeout: Request timeout in seconds
        """
        super().__init__(
            provider_name="lastfm",
            cache_manager=cache_manager,
            rate_limiter=rate_limiter,
            circuit_breaker=circuit_breaker,
            timeout=timeout
        )

        if not api_key:
            raise ValueError("Last.fm requires an API key")

        self.api_key = api_key
        logger.info("Last.fm API Client ready")

    def _get_base_url(self) -> str:
        """Last.fm API base URL."""
        return "http://ws.audioscrobbler.com/2.0/"

    def _get_default_headers(self) -> Dict[str, str]:
        """Last.fm uses URL parameters for auth, not headers."""
        return {
            'Accept': 'application/json'
        }

    def _handle_response(self, response) -> Dict:
        """Parse Last.fm JSON response."""
        try:
            data = response.json()

            # Check for API errors
            if 'error' in data:
                error_code = data.get('error')
                error_msg = data.get('message', 'Unknown error')
                logger.error(f"Last.fm API error {error_code}: {error_msg}")
                raise ValueError(f"Last.fm API error: {error_msg}")

            return data

        except ValueError as e:
            logger.error(f"Last.fm: Invalid JSON response - {e}")
            raise

    def get_track_info(
        self,
        artist: str,
        track: str,
        use_cache: bool = True
    ) -> Optional[Dict]:
        """
        Get track information.

        Args:
            artist: Artist name
            track: Track name
            use_cache: Use Redis cache

        Returns:
            Track data or None if not found

        API Method: track.getInfo
        """
        cache_key = f"lastfm:track_info:{artist.lower()}:{track.lower()}"

        response = self._make_request(
            method='GET',
            endpoint='',
            params={
                'method': 'track.getInfo',
                'artist': artist,
                'track': track,
                'api_key': self.api_key,
                'format': 'json'
            },
            cache_key=cache_key if use_cache else None,
            cache_ttl=604800,  # 7 days
        )

        return response.get('track')

    def get_track_tags(
        self,
        artist: str,
        track: str,
        use_cache: bool = True
    ) -> List[str]:
        """
        Get track tags (genres).

        Returns community-assigned tags/genres for a track.

        Args:
            artist: Artist name
            track: Track name
            use_cache: Use Redis cache

        Returns:
            List of tag names (e.g., ['electronic', 'progressive house'])

        API Method: track.getTopTags
        """
        cache_key = f"lastfm:track_tags:{artist.lower()}:{track.lower()}"

        response = self._make_request(
            method='GET',
            endpoint='',
            params={
                'method': 'track.getTopTags',
                'artist': artist,
                'track': track,
                'api_key': self.api_key,
                'format': 'json'
            },
            cache_key=cache_key if use_cache else None,
            cache_ttl=604800,  # 7 days
        )

        # Extract tag names from response
        tags = response.get('toptags', {}).get('tag', [])

        if not tags:
            return []

        # Tags are sorted by count (popularity)
        tag_names = [
            tag['name']
            for tag in tags
            if isinstance(tag, dict) and 'name' in tag
        ]

        logger.debug(
            f"Last.fm: Found {len(tag_names)} tag(s) for '{artist} - {track}': "
            f"{', '.join(tag_names[:5])}"
        )

        return tag_names

    def get_artist_info(
        self,
        artist: str,
        use_cache: bool = True
    ) -> Optional[Dict]:
        """
        Get artist information.

        Args:
            artist: Artist name
            use_cache: Use Redis cache

        Returns:
            Artist data or None if not found

        API Method: artist.getInfo
        """
        cache_key = f"lastfm:artist_info:{artist.lower()}"

        response = self._make_request(
            method='GET',
            endpoint='',
            params={
                'method': 'artist.getInfo',
                'artist': artist,
                'api_key': self.api_key,
                'format': 'json'
            },
            cache_key=cache_key if use_cache else None,
            cache_ttl=2592000,  # 30 days
        )

        return response.get('artist')

    def get_similar_artists(
        self,
        artist: str,
        limit: int = 10,
        use_cache: bool = True
    ) -> List[Dict]:
        """
        Get similar artists.

        Args:
            artist: Artist name
            limit: Maximum results to return
            use_cache: Use Redis cache

        Returns:
            List of similar artists with match scores

        API Method: artist.getSimilar
        """
        cache_key = f"lastfm:similar_artists:{artist.lower()}"

        response = self._make_request(
            method='GET',
            endpoint='',
            params={
                'method': 'artist.getSimilar',
                'artist': artist,
                'limit': limit,
                'api_key': self.api_key,
                'format': 'json'
            },
            cache_key=cache_key if use_cache else None,
            cache_ttl=2592000,  # 30 days
        )

        similar = response.get('similarartists', {}).get('artist', [])

        logger.debug(
            f"Last.fm: Found {len(similar)} similar artist(s) for '{artist}'"
        )

        return similar
