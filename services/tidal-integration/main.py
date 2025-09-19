"""FastAPI service exposing TIDAL integration APIs."""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from tidal_connector import IntegrationDisabledError, TidalIntegration

logger = logging.getLogger("tidal-integration")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="SongNodes TIDAL Integration", version="1.0.0")

_tidal: Optional[TidalIntegration] = None


class PlaylistSelection(BaseModel):
    playlist_id: str = Field(..., description="TIDAL playlist identifier")


class PathPlaylistRequest(BaseModel):
    node_ids: List[str] = Field(..., description="Ordered list of SongNodes node identifiers")
    name: Optional[str] = Field(None, description="Optional name for the TIDAL playlist")
    description: Optional[str] = Field(None, description="Optional playlist description")


@app.on_event("startup")
async def startup_event() -> None:
    global _tidal
    try:
        tidal = TidalIntegration()
    except IntegrationDisabledError as exc:
        logger.warning("TIDAL integration disabled: %s", exc)
        _tidal = None
        return
    try:
        await tidal.initialize()
        _tidal = tidal
        logger.info("TIDAL integration service initialized")
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Failed to initialize TIDAL integration: %s", exc)
        _tidal = None


@app.on_event("shutdown")
async def shutdown_event() -> None:
    global _tidal
    if _tidal:
        try:
            await _tidal.shutdown()
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("Error while shutting down TIDAL integration: %s", exc)
        _tidal = None


def _require_integration() -> TidalIntegration:
    if not _tidal:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TIDAL integration is not enabled",
        )
    return _tidal


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok" if _tidal else "disabled",
        "service": "tidal",
    }


@app.get("/playlists")
async def list_playlists() -> dict:
    tidal = _require_integration()
    playlists = await tidal.list_playlists()
    return {"playlists": playlists}


@app.post("/playlists/import")
async def import_playlist(selection: PlaylistSelection) -> dict:
    tidal = _require_integration()
    try:
        result = await tidal.import_playlist(selection.playlist_id)
    except Exception as exc:
        logger.exception("Failed to import TIDAL playlist %s", selection.playlist_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return result


@app.post("/playlists/create-from-path")
async def create_playlist_from_path(request: PathPlaylistRequest) -> dict:
    tidal = _require_integration()
    try:
        result = await tidal.create_playlist_from_path(
            node_ids=request.node_ids,
            name=request.name,
            description=request.description,
        )
    except Exception as exc:
        logger.exception("Failed to create TIDAL playlist from path")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return result


@app.get("/")
async def root() -> dict:
    return {
        "message": "TIDAL integration service",
        "health_endpoint": "/health",
        "playlists_endpoint": "/playlists",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8095, reload=False)
