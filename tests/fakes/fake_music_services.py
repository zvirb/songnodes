import aiohttp
from aiohttp import web
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def tidal_token(request):
    return web.json_response({
        "access_token": "fake_tidal_token",
        "token_type": "Bearer",
        "expires_in": 3600
    })

async def tidal_search(request):
    # Verify auth
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer fake_tidal_token"):
        return web.json_response({"error": "Unauthorized"}, status=401)

    query = request.query.get("query", "")
    limit = int(request.query.get("limit", 20))

    # Return fake response matching shape expected by TidalClient
    return web.json_response({
        "items": [
            {
                "id": "12345",
                "title": "Looking at Your Pager",
                "artist": {"name": "Four Tet"},
                "artists": [{"name": "Four Tet"}],
                "album": {
                    "title": "Looking at Your Pager",
                    "cover": "fake_cover_id" # TIDAL image URL needs processing
                },
                "duration": 180,
                "isrc": "US1234567890"
            }
        ][:limit]
    })

async def spotify_token(request):
    return web.json_response({
        "access_token": "fake_spotify_token",
        "token_type": "Bearer",
        "expires_in": 3600
    })

async def spotify_search(request):
    # Verify auth
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer fake_spotify_token"):
        return web.json_response({"error": "Unauthorized"}, status=401)

    query = request.query.get("q", "")
    limit = int(request.query.get("limit", 20))

    return web.json_response({
        "tracks": {
            "items": [
                {
                    "id": "abcde",
                    "name": "Looking at Your Pager",
                    "artists": [{"name": "Four Tet"}],
                    "album": {
                        "name": "Looking at Your Pager",
                        "images": [{"url": "https://fake.spotify.com/image"}]
                    },
                    "duration_ms": 180000,
                    "preview_url": "https://fake.spotify.com/preview",
                    "external_ids": {"isrc": "US1234567890"},
                    "external_urls": {"spotify": "https://open.spotify.com/track/abcde"}
                }
            ][:limit]
        }
    })

def create_fake_app():
    app = web.Application()
    app.router.add_post('/tidal/token', tidal_token)
    app.router.add_get('/tidal/search', tidal_search)
    app.router.add_post('/spotify/token', spotify_token)
    app.router.add_get('/spotify/search', spotify_search)
    return app

if __name__ == '__main__':
    web.run_app(create_fake_app(), port=8080)
