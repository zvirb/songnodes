import asyncio
from typing import Dict, Any, List, Optional
import logging
from fastapi import Request

logger = logging.getLogger(__name__)

class MusicSearchError(Exception):
    def __init__(self, message: str, status_code: int = 500, code: str = "internal_error", retry_after: int = None):
        self.message = message
        self.status_code = status_code
        self.code = code
        self.retry_after = retry_after
        super().__init__(message)

def _normalize_spotify_track(item: Dict[str, Any]) -> Dict[str, Any]:
    album = item.get("album", {})
    images = album.get("images", [])
    image_url = None
    if images and len(images) > 0:
        image_url = images[0].get("url")

    artists = item.get("artists", [])
    primary_artist = artists[0].get("name", "Unknown") if artists else "Unknown"

    return {
        "id": item.get("id"),
        "name": item.get("name"),
        "title": item.get("name"),
        "artist": primary_artist,
        "artists": [{"name": a.get("name", "Unknown")} for a in artists],
        "album": {
            "name": album.get("name", "Unknown"),
            "images": [{"url": img.get("url")} for img in images if img.get("url")]
        },
        "duration_ms": item.get("duration_ms"),
        "preview_url": item.get("preview_url"),
        "image": image_url,
        "isrc": item.get("external_ids", {}).get("isrc"),
        "url": item.get("external_urls", {}).get("spotify")
    }

def _normalize_tidal_track(item: Dict[str, Any]) -> Dict[str, Any]:
    album = item.get("album", {})

    cover = album.get("cover")
    image_url = None
    if cover:
        if str(cover).startswith("http"):
            image_url = cover
        else:
            cover_path = str(cover).replace('-', '/')
            image_url = f"https://resources.tidal.com/images/{cover_path}/320x320.jpg"

    artists = item.get("artists", [])
    if not artists and item.get("artist"):
        artists = [item.get("artist")]

    primary_artist = item.get("artist", {}).get("name", "Unknown") if item.get("artist") else "Unknown"

    return {
        "id": str(item.get("id")),
        "name": item.get("title"),
        "title": item.get("title"),
        "artist": primary_artist,
        "artists": [{"name": a.get("name", "Unknown")} for a in artists],
        "album": {
            "name": album.get("title", "Unknown"),
            "images": [{"url": image_url}] if image_url else []
        },
        "duration_ms": item.get("duration", 0) * 1000 if item.get("duration") else None,
        "preview_url": None,
        "image": image_url,
        "isrc": item.get("isrc"),
        "url": f"https://tidal.com/browse/track/{item.get('id')}" if item.get("id") else None
    }

async def search_tracks(request: Request, service: str, q: str, limit: int) -> Dict[str, List[Dict[str, Any]]]:
    pipeline = getattr(request.app.state, "enrichment_pipeline", None)
    if not pipeline:
        raise MusicSearchError("Service not fully initialized", status_code=503, code="service_unavailable")

    if service == "spotify":
        client = pipeline.spotify_client
        if not client:
            raise MusicSearchError("Spotify not configured", status_code=424, code="spotify_not_configured")

        try:
            token = await client._get_access_token()
            headers = {'Authorization': f'Bearer {token}'}
            url = f"{client.base_url}/search"
            params = {"q": q, "type": "track", "limit": limit}

            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params, timeout=5.0) as response:
                    if response.status == 429:
                        retry_after = int(response.headers.get("Retry-After", 1))
                        raise MusicSearchError("Rate limited", status_code=429, code="provider_error", retry_after=retry_after)
                    if response.status >= 500:
                        raise MusicSearchError("Provider error", status_code=502, code="provider_error")
                    response.raise_for_status()
                    data = await response.json()

                    tracks = data.get("tracks", {}).get("items", [])
                    return {"tracks": [_normalize_spotify_track(t) for t in tracks]}
        except asyncio.TimeoutError:
            raise MusicSearchError("Timeout", status_code=502, code="provider_error")
        except MusicSearchError:
            raise
        except Exception as e:
            logger.error(f"Spotify search failed: {e}")
            raise MusicSearchError(f"Provider error: {str(e)}", status_code=502, code="provider_error")

    elif service == "tidal":
        client = pipeline.tidal_client
        if not client or not client.client_id:
            raise MusicSearchError("Tidal not configured", status_code=424, code="tidal_not_configured")

        try:
            token = await client._get_token()
            if not token:
                raise MusicSearchError("Tidal not configured", status_code=424, code="tidal_not_configured")

            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/vnd.tidal.v1+json',
                'Accept': 'application/vnd.tidal.v1+json'
            }
            url = f"{client.base_url}/search" if "localhost" in client.base_url else f"{client.base_url}/v1/search"
            params = {"query": q, "types": "TRACKS", "limit": limit, "countryCode": "US"}

            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params, timeout=5.0) as response:
                    if response.status == 429:
                        retry_after = int(response.headers.get("Retry-After", 1))
                        raise MusicSearchError("Rate limited", status_code=429, code="provider_error", retry_after=retry_after)
                    if response.status >= 500:
                        raise MusicSearchError("Provider error", status_code=502, code="provider_error")
                    response.raise_for_status()
                    data = await response.json()

                    # fake_music_services returns items directly, real tidal might return tracks.items or items directly
                    tracks = data.get("tracks", {}).get("items")
                    if tracks is None:
                        tracks = data.get("items", [])
                    return {"tracks": [_normalize_tidal_track(t) for t in tracks]}
        except asyncio.TimeoutError:
            raise MusicSearchError("Timeout", status_code=502, code="provider_error")
        except MusicSearchError:
            raise
        except Exception as e:
            logger.error(f"Tidal search failed: {e}")
            raise MusicSearchError(f"Provider error: {str(e)}", status_code=502, code="provider_error")

    else:
        raise MusicSearchError("Unknown service", status_code=400, code="bad_request")
