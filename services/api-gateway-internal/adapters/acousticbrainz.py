"""AcousticBrainz API Adapter - Free, no auth"""

from typing import Dict, Optional, Any
from .base import BaseAPIAdapter


class AcousticBrainzAdapter(BaseAPIAdapter):
    """AcousticBrainz API adapter (free, no auth)."""

    provider_name = "acousticbrainz"
    base_url = "https://acousticbrainz.org/api/v1"

    async def get_low_level_features(
        self,
        mbid: str
    ) -> Dict[str, Any]:
        """Get low-level audio features by MusicBrainz ID."""
        params = {"mbid": mbid}

        async def fetch():
            return await self._make_request(
                "GET",
                f"/{mbid}/low-level"
            )

        return await self._get_with_cache(
            "features",
            params,
            fetch,
            ttl_override=90 * 24 * 3600  # 90 days (stable)
        )

    async def get_high_level_features(
        self,
        mbid: str
    ) -> Dict[str, Any]:
        """Get high-level audio features (genre, mood, etc.)."""
        params = {"mbid": mbid}

        async def fetch():
            return await self._make_request(
                "GET",
                f"/{mbid}/high-level"
            )

        return await self._get_with_cache(
            "features",
            params,
            fetch,
            ttl_override=90 * 24 * 3600  # 90 days (stable)
        )
