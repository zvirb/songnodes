"""SQLite database builder for weekly library ingestion."""

import os
import sqlite3
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def build_database(tracks: List[Dict[str, Any]], db_path: str = "dj_library.sqlite") -> str:
    """
    Creates or updates SQLite database with resolved track metadata including
    `mbid`, `bpm`, and `camelot_key`.
    """
    dirname = os.path.dirname(db_path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)

    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()

        # Create table with mbid column and DSP fields
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY,
                title TEXT,
                artist TEXT,
                album TEXT,
                isrc TEXT,
                mbid TEXT,
                bpm REAL,
                camelot_key TEXT,
                key TEXT,
                preview TEXT
            )
        """)

        # Ensure mbid column exists if table existed previously without it
        cursor.execute("PRAGMA table_info(tracks)")
        columns = [column[1] for column in cursor.fetchall()]
        if "mbid" not in columns:
            cursor.execute("ALTER TABLE tracks ADD COLUMN mbid TEXT")

        # Create index on mbid
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_mbid ON tracks(mbid)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc)")

        # Insert or replace tracks
        for track in tracks:
            cursor.execute("""
                INSERT OR REPLACE INTO tracks (
                    id, title, artist, album, isrc, mbid, bpm, camelot_key, key, preview
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(track.get("id") or track.get("isrc") or track.get("title")),
                track.get("title"),
                track.get("artist"),
                track.get("album"),
                track.get("isrc"),
                track.get("mbid"),
                track.get("bpm"),
                track.get("camelot_key") or track.get("k") or track.get("key"),
                track.get("key") or track.get("camelot_key") or track.get("k"),
                track.get("preview") or track.get("preview_url")
            ))

        conn.commit()
        logger.info(f"Database successfully built at {db_path} with {len(tracks)} tracks.")
    finally:
        conn.close()

    return db_path
