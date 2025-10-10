"""Discogs API Adapter - Token-based authentication"""

from typing import Dict, List, Optional, Any
from .base import BaseAPIAdapter


class DiscogsAdapter(BaseAPIAdapter):
    """Discogs API adapter."""

    provider_name = "discogs"
    base_url = "https://api.discogs.com"

    def __init__(self, token: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.token = token

    async def search_release(
        self,
        artist: str,
        title: str
    ) -> List[Dict[str, Any]]:
        """Search for releases."""
        params = {"artist": artist, "title": title}

        async def fetch():
            result = await self._make_request(
                "GET",
                "/database/search",
                params={
                    "artist": artist,
                    "release_title": title,
                    "type": "release"
                },
                headers={"Authorization": f"Discogs token={self.token}"}
            )
            return result.get("results", [])

        return await self._get_with_cache("search", params, fetch)

    async def get_release(
        self,
        release_id: str
    ) -> Dict[str, Any]:
        """Get release details."""
        params = {"release_id": release_id}

        async def fetch():
            return await self._make_request(
                "GET",
                f"/releases/{release_id}",
                headers={"Authorization": f"Discogs token={self.token}"}
            )

        return await self._get_with_cache("release", params, fetch)

    async def get_master(
        self,
        master_id: str
    ) -> Dict[str, Any]:
        """Get master release details (stable)."""
        params = {"master_id": master_id}

        async def fetch():
            return await self._make_request(
                "GET",
                f"/masters/{master_id}",
                headers={"Authorization": f"Discogs token={self.token}"}
            )

        return await self._get_with_cache(
            "master",
            params,
            fetch,
            ttl_override=90 * 24 * 3600  # 90 days
        )
