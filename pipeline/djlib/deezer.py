"""Deezer client module for djlib pipeline.

Provides functions to interact with Deezer public API:
- detail(track_id): Fetches track details by ID and extracts artwork_url.
- search(...): Searches tracks by query or artist/title and includes artwork_url.
"""

import json
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

BASE_URL = "https://api.deezer.com"


def _fetch_json(url: str) -> Optional[Dict[str, Any]]:
    """Fetch JSON data from a URL using standard library urllib."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SongNodes/1.0"})
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode("utf-8")
            res = json.loads(data)
            if isinstance(res, dict) and "error" in res:
                return None
            return res
    except Exception:
        return None


def detail(track_id: Any) -> Optional[Dict[str, Any]]:
    """Get track details from Deezer public API by track ID.

    Extracts album artwork URL prioritizing cover_xl -> cover_big -> cover_medium -> None.
    Preserves all existing return keys: bpm, isrc, release_date, album_id.
    """
    if not track_id:
        return None

    url = f"{BASE_URL}/track/{track_id}"
    t = _fetch_json(url)
    if not t or not isinstance(t, dict):
        return None

    album = t.get("album") or {}
    cover_url = (
        album.get("cover_xl")
        or album.get("cover_big")
        or album.get("cover_medium")
        or None
    )

    artist_data = t.get("artist")
    artist_name = artist_data.get("name") if isinstance(artist_data, dict) else artist_data

    return {
        "id": t.get("id"),
        "title": t.get("title"),
        "artist": artist_name,
        "bpm": t.get("bpm"),
        "isrc": t.get("isrc"),
        "release_date": t.get("release_date") or album.get("release_date"),
        "album_id": album.get("id") or t.get("album_id"),
        "artwork_url": cover_url,
    }


def search(
    query: str = "",
    *args: Any,
    artist: str = "",
    title: str = "",
    limit: int = 10,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Search for tracks on Deezer public API.

    Includes artwork_url from (t.get("album") or {}).get("cover_medium") if present.
    Preserves all existing return keys: bpm, isrc, release_date, album_id.
    """
    q_parts = [p for p in [query] + list(args) + [artist, title] if p]
    q_str = " ".join(str(p) for p in q_parts).strip()
    if not q_str:
        return []

    encoded_query = urllib.parse.quote(q_str)
    url = f"{BASE_URL}/search/track?q={encoded_query}&limit={limit}"
    body = _fetch_json(url)
    if not body or not isinstance(body, dict):
        return []

    items = body.get("data") or []
    results = []
    for t in items:
        if not isinstance(t, dict):
            continue
        album = t.get("album") or {}
        cover_url = album.get("cover_medium")
        artist_data = t.get("artist")
        artist_name = artist_data.get("name") if isinstance(artist_data, dict) else artist_data

        results.append({
            "id": t.get("id"),
            "title": t.get("title"),
            "artist": artist_name,
            "bpm": t.get("bpm"),
            "isrc": t.get("isrc"),
            "release_date": t.get("release_date") or album.get("release_date"),
            "album_id": album.get("id") or t.get("album_id"),
            "artwork_url": cover_url,
        })
    return results
