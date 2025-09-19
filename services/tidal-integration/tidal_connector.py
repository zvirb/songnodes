"""TIDAL integration utilities for SongNodes."""
from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import asyncpg

try:
    import tidalapi  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    tidalapi = None  # Sentinel to indicate missing library


class IntegrationDisabledError(RuntimeError):
    """Raised when TIDAL integration is disabled or unavailable."""


@dataclass
class TidalTrackMatch:
    tidal_track_id: int
    track_name: str
    artist_name: str
    isrc: Optional[str]


class TidalIntegration:
    """High-level helper that orchestrates TIDAL interactions and DB writes."""

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.enabled = os.getenv("ENABLE_TIDAL_INTEGRATION", "0").lower() in {"1", "true", "yes"}
        if not self.enabled:
            raise IntegrationDisabledError("TIDAL integration disabled via environment flag")
        if tidalapi is None:  # pragma: no cover - optional dependency
            raise IntegrationDisabledError("Python package 'tidalapi' is not installed")

        self.session_file = os.getenv("TIDAL_SESSION_FILE", os.path.expanduser("~/.tidal-session.json"))
        self.session: Optional[tidalapi.Session] = tidalapi.Session()
        self.pool: Optional[asyncpg.Pool] = None
        self.initialized = False

        self.db_config = {
            "host": os.getenv("DATABASE_HOST", "localhost"),
            "port": int(os.getenv("DATABASE_PORT", "5433")),
            "database": os.getenv("DATABASE_NAME", "musicdb"),
            "user": os.getenv("DATABASE_USER", "musicdb_user"),
            "password": os.getenv("DATABASE_PASSWORD", "musicdb_secure_pass"),
        }

    async def initialize(self) -> None:
        if self.initialized:
            return

        await asyncio.to_thread(self._login)
        self.pool = await asyncpg.create_pool(**self.db_config, min_size=1, max_size=5)
        await self._ensure_tables()
        self.initialized = True
        self.logger.info("TIDAL integration ready")

    async def shutdown(self) -> None:
        if self.pool:
            await self.pool.close()
            self.pool = None
        self.initialized = False

    # ------------------------------------------------------------------
    # Playlist operations
    # ------------------------------------------------------------------
    async def list_playlists(self) -> List[Dict[str, Any]]:
        self._ensure_session()
        result = await asyncio.to_thread(self._list_playlists_sync)
        return result

    async def import_playlist(self, playlist_id: str) -> Dict[str, Any]:
        self._ensure_session()
        if not self.pool:
            raise IntegrationDisabledError("Database connection not initialized")

        playlist_summary = await asyncio.to_thread(self._fetch_playlist_summary, playlist_id)
        tracks = await asyncio.to_thread(self._fetch_playlist_tracks, playlist_id)

        async with self.pool.acquire() as conn:
            await self._ensure_import_table(conn)
            await conn.execute(
                "DELETE FROM tidal_imported_tracks WHERE playlist_id = $1",
                playlist_id,
            )
            await conn.executemany(
                """
                INSERT INTO tidal_imported_tracks (
                    playlist_id,
                    playlist_name,
                    track_order,
                    tidal_track_id,
                    track_name,
                    artist_name,
                    isrc,
                    metadata,
                    imported_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                """,
                [
                    (
                        playlist_id,
                        playlist_summary["name"],
                        index + 1,
                        track.tidal_track_id,
                        track.track_name,
                        track.artist_name,
                        track.isrc,
                        json.dumps({"source": "tidal", "playlist_id": playlist_id}),
                    )
                    for index, track in enumerate(tracks)
                ],
            )

        return {
            "playlist_id": playlist_id,
            "playlist_name": playlist_summary["name"],
            "imported_tracks": len(tracks),
        }

    async def create_playlist_from_path(
        self,
        node_ids: List[str],
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        self._ensure_session()
        if not self.pool:
            raise IntegrationDisabledError("Database connection not initialized")

        track_metadata = await self._fetch_track_metadata_for_nodes(node_ids)
        tidal_track_ids: List[int] = []
        for meta in track_metadata:
            tidal_track_id = await self._get_or_cache_tidal_track_id(meta)
            if tidal_track_id:
                tidal_track_ids.append(tidal_track_id)

        if not tidal_track_ids:
            raise RuntimeError("No matching TIDAL tracks were found for the provided path")

        playlist_name = name or self._generate_default_playlist_name()
        playlist_description = description or "Generated from SongNodes visualization path"

        playlist_id = await asyncio.to_thread(
            self._create_playlist_sync,
            playlist_name,
            playlist_description,
            tidal_track_ids,
        )

        return {
            "playlist_id": playlist_id,
            "playlist_name": playlist_name,
            "track_count": len(tidal_track_ids),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _ensure_session(self) -> None:
        if not self.session or not self.session.check_login():
            raise IntegrationDisabledError("TIDAL session is not authenticated")

    def _login(self) -> None:
        assert self.session is not None
        if os.path.exists(self.session_file):
            try:
                self.session.load_session_from_file(self.session_file)
                if self.session.check_login():
                    self.logger.info("Loaded TIDAL session from %s", self.session_file)
                    return
                self.logger.warning("Stored TIDAL session invalid, re-authenticating")
            except Exception as exc:  # pragma: no cover
                self.logger.warning("Failed to load session file: %s", exc)

        self.logger.info("Starting TIDAL OAuth device flow")
        success = self.session.login_oauth_simple()
        if not success:  # pragma: no cover - user cancelled
            raise IntegrationDisabledError("TIDAL OAuth login failed; rerun with valid credentials")
        self.session.save_session(self.session_file)
        self.logger.info("Stored new TIDAL session at %s", self.session_file)

    def _list_playlists_sync(self) -> List[Dict[str, Any]]:
        assert self.session is not None
        playlists = self.session.user.playlists()
        result = []
        for playlist in playlists:
            result.append(
                {
                    "id": playlist.id,
                    "name": playlist.name,
                    "description": playlist.description,
                    "num_tracks": len(playlist.tracks()) if hasattr(playlist, "tracks") else None,
                }
            )
        return result

    def _fetch_playlist_summary(self, playlist_id: str) -> Dict[str, Any]:
        assert self.session is not None
        playlist = self.session.playlist(playlist_id)
        return {
            "id": playlist.id,
            "name": playlist.name,
            "description": playlist.description,
        }

    def _fetch_playlist_tracks(self, playlist_id: str) -> List[TidalTrackMatch]:
        assert self.session is not None
        playlist = self.session.playlist(playlist_id)
        tracks = []
        for track in playlist.tracks():
            tracks.append(
                TidalTrackMatch(
                    tidal_track_id=int(track.id),
                    track_name=track.name,
                    artist_name=track.artist.name if track.artist else "",
                    isrc=getattr(track, "isrc", None),
                )
            )
        return tracks

    def _create_playlist_sync(self, name: str, description: str, tidal_track_ids: List[int]) -> str:
        assert self.session is not None
        playlist = self.session.user.create_playlist(name, description)
        playlist.add(tidal_track_ids)
        return playlist.id

    async def _fetch_track_metadata_for_nodes(self, node_ids: List[str]) -> List[Dict[str, Any]]:
        if not node_ids:
            return []
        if not self.pool:
            raise IntegrationDisabledError("Database connection not initialized")

        # Filter node IDs to UUID-like values
        valid_ids = [nid for nid in node_ids if self._looks_like_uuid(nid)]
        if not valid_ids:
            return []

        query = """
            SELECT
                n.id::text AS node_id,
                n.track_id::text AS track_uuid,
                COALESCE(t.title, n.metadata->>'title') AS title,
                COALESCE(t.metadata->>'primary_artist', t.artist_name, n.metadata->>'artist', n.metadata->>'primary_artist') AS artist,
                COALESCE(t.metadata->>'isrc', n.metadata->>'isrc') AS isrc,
                COALESCE(t.metadata, '{}') AS track_metadata,
                COALESCE(n.metadata, '{}') AS node_metadata
            FROM musicdb.nodes n
            LEFT JOIN musicdb.tracks t ON t.id = n.track_id
            WHERE n.id = ANY($1::uuid[])
            ORDER BY array_position($1::uuid[], n.id)
        """

        async with self.pool.acquire() as conn:
            records = await conn.fetch(query, valid_ids)

        result: List[Dict[str, Any]] = []
        for record in records:
            result.append(
                {
                    "node_id": record["node_id"],
                    "track_uuid": record["track_uuid"],
                    "title": record["title"],
                    "artist": record["artist"],
                    "isrc": record["isrc"],
                    "metadata": {**record["track_metadata"], **record["node_metadata"]},
                }
            )
        return result

    async def _get_or_cache_tidal_track_id(self, metadata: Dict[str, Any]) -> Optional[int]:
        track_uuid = metadata.get("track_uuid")
        cache_key = track_uuid
        if self.pool and cache_key:
            async with self.pool.acquire() as conn:
                await self._ensure_mapping_table(conn)
                record = await conn.fetchrow(
                    "SELECT tidal_track_id FROM tidal_track_mappings WHERE track_uuid = $1",
                    track_uuid,
                )
                if record:
                    return int(record["tidal_track_id"])

        match = await asyncio.to_thread(self._search_tidal_track, metadata)
        if match and self.pool and cache_key:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO tidal_track_mappings (track_uuid, tidal_track_id, metadata, updated_at)
                    VALUES ($1, $2, $3::jsonb, NOW())
                    ON CONFLICT (track_uuid) DO UPDATE SET
                        tidal_track_id = EXCLUDED.tidal_track_id,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                    """,
                    track_uuid,
                    match.tidal_track_id,
                    json.dumps({"title": metadata.get("title"), "artist": metadata.get("artist"), "isrc": metadata.get("isrc")}),
                )
        return match.tidal_track_id if match else None

    def _search_tidal_track(self, metadata: Dict[str, Any]) -> Optional[TidalTrackMatch]:
        assert self.session is not None
        title = metadata.get("title")
        artist = metadata.get("artist")
        isrc = metadata.get("isrc")

        if not title or not artist:
            return None

        # Try ISRC lookup first if available
        if isrc:
            try:
                result = self.session.search("track", isrc)
                tracks = getattr(result, "tracks", [])
                for track in tracks:
                    if getattr(track, "isrc", None) == isrc:
                        return TidalTrackMatch(
                            tidal_track_id=int(track.id),
                            track_name=track.name,
                            artist_name=track.artist.name if track.artist else "",
                            isrc=getattr(track, "isrc", None),
                        )
            except Exception as exc:  # pragma: no cover
                self.logger.debug("ISRC search failed: %s", exc)

        query = f"{title} {artist}"
        result = self.session.search("track", query)
        tracks = getattr(result, "tracks", [])
        for track in tracks:
            return TidalTrackMatch(
                tidal_track_id=int(track.id),
                track_name=track.name,
                artist_name=track.artist.name if track.artist else "",
                isrc=getattr(track, "isrc", None),
            )
        return None

    async def _ensure_tables(self) -> None:
        if not self.pool:
            return
        async with self.pool.acquire() as conn:
            await self._ensure_mapping_table(conn)
            await self._ensure_import_table(conn)

    async def _ensure_mapping_table(self, conn: asyncpg.Connection) -> None:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tidal_track_mappings (
                track_uuid UUID PRIMARY KEY,
                tidal_track_id BIGINT NOT NULL,
                metadata JSONB,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

    async def _ensure_import_table(self, conn: asyncpg.Connection) -> None:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tidal_imported_tracks (
                playlist_id TEXT NOT NULL,
                playlist_name TEXT NOT NULL,
                track_order INTEGER NOT NULL,
                tidal_track_id BIGINT,
                track_name TEXT,
                artist_name TEXT,
                isrc TEXT,
                metadata JSONB,
                imported_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

    @staticmethod
    def _looks_like_uuid(value: str) -> bool:
        if not value:
            return False
        try:
            import uuid

            uuid.UUID(value)
            return True
        except ValueError:
            return False

    @staticmethod
    def _generate_default_playlist_name() -> str:
        timestamp = datetime.utcnow().strftime("%Y%b%d-%H%M%S").upper()
        return f"path{timestamp}"
