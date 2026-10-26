from fastapi import APIRouter, HTTPException, Query, Response, Request
from fastapi.responses import JSONResponse
from typing import Dict, Any
from music_search import search_tracks, MusicSearchError
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/search", tags=["Search"])

@router.get("/{service}")
async def search(
    request: Request,
    service: str,
    response: Response,
    q: str = Query(..., description="Search query"),
    limit: int = Query(20, ge=1, le=50, description="Max results")
):
    service = service.lower()
    if service not in ["spotify", "tidal"]:
        return JSONResponse(status_code=400, content={"code": "bad_request", "message": "Unknown service. Must be 'spotify' or 'tidal'."})

    q = q.strip()
    if not q:
        return JSONResponse(status_code=400, content={"code": "bad_request", "message": "Search query cannot be empty."})

    # Cap query length just in case
    q = q[:100]

    try:
        results = await search_tracks(request, service, q, limit)
        return JSONResponse(content=results)
    except MusicSearchError as e:
        headers = {}
        if e.retry_after is not None:
            headers["Retry-After"] = str(e.retry_after)

        return JSONResponse(
            status_code=e.status_code,
            content={"code": e.code, "message": e.message},
            headers=headers
        )
    except Exception as e:
        logger.exception("Unhandled search error")
        return JSONResponse(
            status_code=500,
            content={"code": "internal_error", "message": "An internal error occurred."}
        )
