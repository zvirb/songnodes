import os
import re
import uuid
import logging
from typing import List, Optional, Dict, Any, Iterable
import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

ISO_DURATION = re.compile(r'^P(?:([0-9]+)D)?T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+(?:.[0-9]+)?)S)?$')

def parse_iso_duration_seconds(value: Optional[str]) -> int:
    """'PT5M4S' -> 304"""
    if not value or not isinstance(value, str):
        return 0
    match = ISO_DURATION.match(value.strip())
    if not match or not any(match.groups()):
        return 0
    days, hours, minutes, seconds = (float(g) if g else 0.0 for g in match.groups())
    total = (((days * 24) + hours) * 60 + minutes) * 60 + seconds
    return int(round(total))

def chunks(values: List[str], size: int) -> Iterable[List[str]]:
    for start in range(0, len(values), size):
        yield values[start:start + size]

class TidalUserApi:
    def __init__(self, access_token: str, country_code: Optional[str] = None, client: Optional[httpx.AsyncClient] = None):
        self.access_token = access_token
        self.country_code = country_code or os.getenv('TIDAL_COUNTRY_CODE', 'AU') or 'AU'
        self._client = client
        # We close only a client we created ourselves; an injected client belongs to the caller.
        self._owns_client = client is None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    async def close(self):
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> "TidalUserApi":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json"
        }

    def _handle_error(self, response: httpx.Response):
        if response.status_code >= 400:
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Tidal API unauthorized")
            elif response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                headers = {"Retry-After": retry_after} if retry_after else {}
                raise HTTPException(status_code=429, detail="Tidal API rate limit exceeded", headers=headers)
            else:
                try:
                    error_data = response.json()
                    detail = str(error_data)[:200]
                except Exception:
                    detail = response.text[:200]
                logger.error(f"Tidal API error {response.status_code}: {detail}")
                raise HTTPException(status_code=502, detail=f"Tidal API error: HTTP {response.status_code}")

    async def me(self) -> Dict[str, Any]:
        """Not strictly required for v2 playlists, but included for completeness if needed."""
        # We can just fetch playlists without knowing the user ID via /v2/playlists
        return {}

    async def search_track(self, artist: str, title: str, isrc: Optional[str] = None) -> Optional[Dict[str, Any]]:
        client = await self._get_client()

        if isrc:
            response = await client.get(
                "https://openapi.tidal.com/v2/tracks",
                params={"filter[isrc]": isrc, "countryCode": self.country_code, "include": "artists,albums"},
                headers=self._headers()
            )
            self._handle_error(response)
            data = response.json().get("data", [])
            if data:
                return self._parse_track(data[0], response.json().get("included", []))

        query = f"{title} {artist}".strip()
        response = await client.get(
            "https://openapi.tidal.com/v2/searchResults",
            params={"filter[query]": query, "countryCode": self.country_code, "include": "tracks"},
            headers=self._headers()
        )
        self._handle_error(response)

        doc = response.json()
        search_data = doc.get("data", [])
        if isinstance(search_data, list) and search_data:
            search_data = search_data[0]
        elif not isinstance(search_data, dict):
            search_data = {}

        track_refs = search_data.get("relationships", {}).get("tracks", {}).get("data", [])
        track_ids = [ref["id"] for ref in track_refs if ref.get("type") == "tracks"]

        if not track_ids:
            track_ids = [inc["id"] for inc in doc.get("included", []) if inc.get("type") == "tracks"]

        if not track_ids:
            return None

        # Fetch full track data for the first result
        response = await client.get(
            "https://openapi.tidal.com/v2/tracks",
            params={"filter[id]": track_ids[0], "countryCode": self.country_code, "include": "artists,albums"},
            headers=self._headers()
        )
        self._handle_error(response)
        data = response.json().get("data", [])
        if data:
            return self._parse_track(data[0], response.json().get("included", []))

        return None

    def _parse_track(self, track_data: Dict[str, Any], included: List[Dict[str, Any]]) -> Dict[str, Any]:
        attrs = track_data.get("attributes", {})

        artist_names = []
        album_name = "Unknown"

        included_map = {(inc.get("type"), inc.get("id")): inc for inc in included}

        # Get artist
        artist_refs = track_data.get("relationships", {}).get("artists", {}).get("data", [])
        for ref in artist_refs:
            inc = included_map.get(("artists", ref.get("id")))
            if inc:
                artist_names.append(inc.get("attributes", {}).get("name", "Unknown"))

        # Get album
        album_refs = track_data.get("relationships", {}).get("albums", {}).get("data", [])
        if album_refs:
            inc = included_map.get(("albums", album_refs[0].get("id")))
            if inc:
                album_name = inc.get("attributes", {}).get("title", "Unknown")

        # Handle version
        title = attrs.get("title", "")
        version = attrs.get("version")
        if version and version.strip():
            # append version if not already in title
            if version.strip() not in title:
                title = f"{title} ({version.strip()})"

        # Available/streamReady
        # v2 API uses 'streamReady' or similar? According to docs, we just assume True if returned,
        # but we can check if there's any availability flag. If not, default to True.

        return {
            "id": int(track_data["id"]) if track_data["id"].isdigit() else track_data["id"],
            "name": title,
            "artist": artist_names[0] if artist_names else "Unknown",
            "album": album_name,
            "duration": parse_iso_duration_seconds(attrs.get("duration")),
            "isrc": attrs.get("isrc"),
            "explicit": attrs.get("explicit", False),
            "available": True,
            "url": f"https://tidal.com/browse/track/{track_data['id']}"
        }

    async def list_playlists(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        client = await self._get_client()
        # GET /v2/playlists?filter[owners.id]=me lists the signed-in user's playlists.
        response = await client.get(
            "https://openapi.tidal.com/v2/playlists",
            params={
                "filter[owners.id]": "me",
                "countryCode": self.country_code,
                "page[limit]": limit,
                "page[offset]": offset,
            },
            headers=self._headers()
        )
        self._handle_error(response)

        results = []
        data = response.json().get("data", [])
        for item in data:
            attrs = item.get("attributes", {})
            results.append({
                "id": item.get("id"),
                "name": attrs.get("name", "Unnamed Playlist"),
                "description": attrs.get("description"),
                "track_count": attrs.get("numberOfTrackItems", attrs.get("numberOfItems", 0)),
                "duration": parse_iso_duration_seconds(attrs.get("duration")),
                "public": attrs.get("accessType") == "PUBLIC",
                "url": f"https://tidal.com/browse/playlist/{item.get('id')}",
                "created_at": attrs.get("createdAt")
            })
        return results

    async def create_playlist(self, name: str, description: Optional[str] = "") -> str:
        client = await self._get_client()
        payload = {
            "data": {
                "type": "playlists",
                "attributes": {
                    "name": name,
                    "description": description or ""
                }
            }
        }

        response = await client.post(
            "https://openapi.tidal.com/v2/playlists",
            params={"countryCode": self.country_code},
            json=payload,
            headers=self._headers()
        )
        self._handle_error(response)

        return response.json()["data"]["id"]

    async def add_tracks_in_order(self, playlist_id: str, track_ids: List[str], allow_duplicates: bool = False):
        client = await self._get_client()

        # POST /v2/playlists/{id}/relationships/items
        # Chunks of 50
        for chunk in chunks(track_ids, 50):
            payload = {
                "data": [
                    {
                        "type": "tracks",
                        "id": str(tid)
                    }
                    for tid in chunk
                ],
                "meta": {
                    "onDuplicates": "ADD" if allow_duplicates else "SKIP"
                }
            }

            headers = self._headers()
            headers["Idempotency-Key"] = str(uuid.uuid4())

            response = await client.post(
                f"https://openapi.tidal.com/v2/playlists/{playlist_id}/relationships/items",
                params={"countryCode": self.country_code},
                json=payload,
                headers=headers
            )
            self._handle_error(response)
