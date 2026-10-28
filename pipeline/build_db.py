"""
Pipeline module for SQLite database creation and Set Builder JSON artifact export.
"""

import json
import os
import sqlite3
from typing import Any, Dict, List, Optional

DEFAULT_DB_PATH = os.path.join("db", "library.db")
DEFAULT_ARTIFACT_PATH = os.path.join("outputs", "artifact", "library.json")


def init_db(conn: sqlite3.Connection) -> None:
    """Initialize SQLite database schema including tracks table with artwork_url TEXT."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            artist TEXT,
            title TEXT,
            mix TEXT,
            duration INTEGER,
            bpm REAL,
            key TEXT,
            energy INTEGER,
            pillar TEXT,
            rotation INTEGER,
            tags TEXT,
            sources TEXT,
            first_heard TEXT,
            last_heard TEXT,
            genre TEXT,
            label TEXT,
            sync TEXT,
            tidal TEXT,
            deezer TEXT,
            beatport TEXT,
            artwork_url TEXT,
            isrc TEXT,
            mbid TEXT,
            camelot_key TEXT,
            preview TEXT
        )
        """
    )
    # Databases built before these columns existed get them added in place.
    existing = {row[1] for row in conn.execute("PRAGMA table_info(tracks)")}
    for column in ("isrc", "mbid", "camelot_key", "preview"):
        if column not in existing:
            conn.execute(f"ALTER TABLE tracks ADD COLUMN {column} TEXT")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracks_mbid ON tracks(mbid)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc)")
    conn.commit()


def insert_track(conn: sqlite3.Connection, r: Dict[str, Any]) -> None:
    """
    Insert or replace a track record into the tracks SQLite table.
    Includes r.get("artwork_url") for artwork persistence.
    """
    artwork_url = r.get("artwork_url")
    conn.execute(
        """
        INSERT OR REPLACE INTO tracks (
            id, artist, title, mix, duration, bpm, key, energy,
            pillar, rotation, tags, sources, first_heard, last_heard,
            genre, label, sync, tidal, deezer, beatport, artwork_url,
            isrc, mbid, camelot_key, preview
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            r.get("id"),
            r.get("artist") or r.get("a"),
            r.get("title") or r.get("t"),
            r.get("mix") or r.get("m"),
            r.get("duration") or r.get("d"),
            r.get("bpm"),
            r.get("key") or r.get("k") or r.get("camelot_key"),
            r.get("energy") or r.get("e"),
            r.get("pillar") or r.get("p"),
            r.get("rotation") or r.get("rot"),
            json.dumps(r.get("tags", [])) if isinstance(r.get("tags"), list) else r.get("tags"),
            json.dumps(r.get("sources", [])) if isinstance(r.get("sources"), list) else r.get("sources") or r.get("src"),
            r.get("first_heard") or r.get("first"),
            r.get("last_heard") or r.get("last"),
            r.get("genre") or r.get("g"),
            r.get("label") or r.get("lbl"),
            r.get("sync"),
            r.get("tidal"),
            r.get("deezer") or r.get("dz"),
            r.get("beatport") or r.get("bp"),
            artwork_url,
            r.get("isrc"),
            r.get("mbid"),
            r.get("camelot_key") or r.get("k"),
            r.get("preview") or r.get("preview_url"),
        ),
    )
    conn.commit()


def export_artifact_library(conn: sqlite3.Connection, output_path: Optional[str] = DEFAULT_ARTIFACT_PATH) -> Dict[str, Any]:
    """
    Export tracks from SQLite database into the Set Builder JSON artifact.
    Emits compact track dictionaries with "art": r.get("artwork_url").
    """
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tracks")
    rows = cursor.fetchall()

    compact_tracks: List[Dict[str, Any]] = []
    for row in rows:
        r = dict(row)

        tags = r.get("tags")
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except Exception:
                tags = []
        elif not isinstance(tags, list):
            tags = []

        sources = r.get("sources")
        if isinstance(sources, str):
            try:
                sources = json.loads(sources)
            except Exception:
                sources = []
        elif not isinstance(sources, list):
            sources = []

        compact_track = {
            "id": r.get("id"),
            "a": r.get("artist"),
            "t": r.get("title"),
            "m": r.get("mix"),
            "d": r.get("duration"),
            "bpm": r.get("bpm"),
            "k": r.get("key"),
            "e": r.get("energy"),
            "p": r.get("pillar"),
            "rot": r.get("rotation"),
            "tags": tags,
            "src": sources,
            "first": r.get("first_heard"),
            "last": r.get("last_heard"),
            "g": r.get("genre"),
            "lbl": r.get("label"),
            "sync": r.get("sync"),
            "tidal": r.get("tidal"),
            "dz": r.get("deezer"),
            "bp": r.get("beatport"),
            "art": r.get("artwork_url"),
            "isrc": r.get("isrc"),
            "mbid": r.get("mbid"),
        }
        compact_tracks.append(compact_track)

    artifact = {
        "tracks": compact_tracks
    }

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(artifact, f, indent=2)

    return artifact


def build_database(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Initialize and return a SQLite database connection for the given path."""
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    init_db(conn)
    return conn


if __name__ == "__main__":
    conn = build_database()
    export_artifact_library(conn)
    conn.close()
    print("Database build and artifact export complete.")
