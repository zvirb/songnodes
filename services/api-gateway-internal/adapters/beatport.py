"""Beatport API Adapter - Scraping with rotation"""

from typing import Dict, List, Optional, Any
from .base import BaseAPIAdapter


class BeatportAdapter(BaseAPIAdapter):
    """Beatport adapter (scraping-based)."""

    provider_name = "beatport"
    base_url = "https://api.beatport.com/v4"

    async def search_track(
        self,
        artist: str,
        title: str
    ) -> List[Dict[str, Any]]:
        """Search for track on Beatport."""
        params = {"artist": artist, "title": title}

        async def fetch():
            result = await self._make_request(
                "GET",
                "/catalog/search",
                params={
                    "q": f"{artist} {title}",
                    "type": "tracks"
                }
            )
            return result.get("results", [])

        return await self._get_with_cache("search", params, fetch)

    async def get_track(
        self,
        track_id: str
    ) -> Dict[str, Any]:
        """Get track details including BPM and key."""
        params = {"track_id": track_id}

        async def fetch():
            return await self._make_request(
                "GET",
                f"/catalog/tracks/{track_id}"
            )

        return await self._get_with_cache("bpm", params, fetch)
