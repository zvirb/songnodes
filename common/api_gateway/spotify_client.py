"""
Spotify API Client with Full Resilience Stack
==============================================

Implements Spotify Web API integration with:
- OAuth 2.0 Client Credentials Flow
- Automatic token refresh
- Search and track retrieval
- Audio features extraction (deprecated - use audio-analysis service)

Built on BaseAPIClient for automatic caching, rate limiting, and circuit breaking.

API Documentation: https://developer.spotify.com/documentation/web-api
"""

import base64
import logging
from typing import Dict, Optional, List
from datetime import datetime, timedelta

from .base_client import BaseAPIClient

logger = logging.getLogger(__name__)


class SpotifyClient(BaseAPIClient):
    """
    Spotify API client with OAuth 2.0 authentication and full resilience.

    Usage:
        client = SpotifyClient(
            client_id="your_client_id",
            client_secret="your_secret",
            cache_manager=cache,
            rate_limiter=limiter,
            circuit_breaker=breaker
        )

        # Search for track
        results = client.search_track(artist="Deadmau5", title="Strobe")

        # Get track by ID
        track = client.get_track(spotify_id="3Fzlg5r1IjhLk2qRw667od")
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        cache_manager,
        rate_limiter,
        circuit_breaker,
        timeout: int = 10
    ):
        """
        Initialize Spotify client.

        Args:
            client_id: Spotify API client ID
            client_secret: Spotify API client secret
            cache_manager: CacheManager instance
            rate_limiter: RateLimiter instance (must have 'spotify' configured)
            circuit_breaker: CircuitBreaker instance for Spotify
            timeout: Request timeout in seconds
        """
        super().__init__(
            provider_name="spotify",
            cache_manager=cache_manager,
            rate_limiter=rate_limiter,
            circuit_breaker=circuit_breaker,
            timeout=timeout
        )

        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None

        logger.info("Spotify API Client ready (OAuth 2.0 Client Credentials Flow)")

    def _get_base_url(self) -> str:
        """Spotify API base URL."""
        return "https://api.spotify.com/v1"

    def _get_default_headers(self) -> Dict[str, str]:
        """
        Get headers with OAuth token.

        Automatically refreshes token if expired.
        """
        # Ensure we have a valid token
        self._ensure_valid_token()

        return {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    def _handle_response(self, response) -> Dict:
        """Parse Spotify JSON response."""
        try:
            return response.json()
        except ValueError as e:
            logger.error(f"Spotify: Invalid JSON response - {e}")
            raise

    def _ensure_valid_token(self):
        """
        Ensure OAuth token is valid, refresh if needed.

        Uses Client Credentials Flow (server-to-server).
        """
        if self.access_token and self.token_expiry and datetime.utcnow() < self.token_expiry:
            return  # Token still valid

        # Request new token
        self._refresh_access_token()

    def _refresh_access_token(self):
        """
        Request new OAuth access token.

        Reference: https://developer.spotify.com/documentation/general/guides/authorization/client-credentials/
        """
        logger.info("Spotify: Requesting new OAuth access token")

        auth_str = f"{self.client_id}:{self.client_secret}"
        auth_b64 = base64.b64encode(auth_str.encode()).decode()

        response = self.session.post(
            'https://accounts.spotify.com/api/token',
            headers={
                'Authorization': f'Basic {auth_b64}',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data={'grant_type': 'client_credentials'},
            timeout=10
        )

        response.raise_for_status()
        data = response.json()

        self.access_token = data['access_token']
        expires_in = data.get('expires_in', 3600)
        self.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in - 60)

        logger.info(f"Spotify: OAuth token acquired (expires in {expires_in}s)")

    def search_track(
        self,
        artist: str,
        title: str,
        limit: int = 5,
        use_cache: bool = True
    ) -> Optional[Dict]:
        """
        Search for track by artist and title.

        Args:
            artist: Artist name
            title: Track title
            limit: Maximum results to return
            use_cache: Use Redis cache

        Returns:
            Top matching track or None if not found

        API Endpoint: GET /v1/search
        """
        # Build search query
        query = f"artist:{artist} track:{title}"

        # Cache key includes query parameters
        cache_key = f"spotify:search:{artist.lower()}:{title.lower()}"

        response = self._make_request(
            method='GET',
            endpoint='/search',
            params={
                'q': query,
                'type': 'track',
                'limit': limit
            },
            cache_key=cache_key if use_cache else None,
            cache_ttl=604800,  # 7 days
        )

        # Extract tracks from response
        tracks = response.get('tracks', {}).get('items', [])

        if not tracks:
            logger.debug(f"Spotify: No results for '{artist} - {title}'")
            return None

        # Return top result
        top_result = tracks[0]
        logger.debug(
            f"Spotify: Found '{top_result['name']}' by "
            f"{top_result['artists'][0]['name']} (ID: {top_result['id']})"
        )

        return top_result

    def get_track(self, spotify_id: str, use_cache: bool = True) -> Optional[Dict]:
        """
        Get track by Spotify ID.

        Args:
            spotify_id: Spotify track ID
            use_cache: Use Redis cache

        Returns:
            Track data or None if not found

        API Endpoint: GET /v1/tracks/{id}
        """
        cache_key = f"spotify:track:{spotify_id}"

        response = self._make_request(
            method='GET',
            endpoint=f'/tracks/{spotify_id}',
            cache_key=cache_key if use_cache else None,
            cache_ttl=2592000,  # 30 days (track data rarely changes)
        )

        return response

    def get_audio_features(self, spotify_id: str, use_cache: bool = True) -> Optional[Dict]:
        """
        Get audio features for track (DEPRECATED).

        WARNING: Spotify is deprecating the Audio Features API.
        Use self-hosted audio-analysis service instead.

        Args:
            spotify_id: Spotify track ID
            use_cache: Use Redis cache

        Returns:
            Audio features or None if unavailable

        API Endpoint: GET /v1/audio-features/{id}
        """
        logger.warning(
            "Spotify Audio Features API is deprecated. "
            "Use self-hosted audio-analysis service instead."
        )

        cache_key = f"spotify:audio_features:{spotify_id}"

        try:
            response = self._make_request(
                method='GET',
                endpoint=f'/audio-features/{spotify_id}',
                cache_key=cache_key if use_cache else None,
                cache_ttl=2592000,  # 30 days
            )
            return response
        except Exception as e:
            logger.error(f"Spotify: Audio features request failed - {e}")
            return None

    def get_artist(self, artist_id: str, use_cache: bool = True) -> Optional[Dict]:
        """
        Get artist by Spotify ID.

        Args:
            artist_id: Spotify artist ID
            use_cache: Use Redis cache

        Returns:
            Artist data or None if not found

        API Endpoint: GET /v1/artists/{id}
        """
        cache_key = f"spotify:artist:{artist_id}"

        response = self._make_request(
            method='GET',
            endpoint=f'/artists/{artist_id}',
            cache_key=cache_key if use_cache else None,
            cache_ttl=2592000,  # 30 days
        )

        return response
