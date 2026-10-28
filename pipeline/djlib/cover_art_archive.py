"""Cover Art Archive public resolver module for MusicBrainz release and recording IDs."""

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_MB_BASE_URL = "https://musicbrainz.org/ws/2"
DEFAULT_USER_AGENT = "SongNodes/1.0.0 (https://github.com/zvirb/songnodes)"


def get_cover_art_for_release(release_gid: str) -> str:
    """Return canonical Cover Art Archive front cover image URL for a release GID.

    Args:
        release_gid: MusicBrainz Release GID string.

    Returns:
        Canonical image URL string.
    """
    if not release_gid:
        return ""
    return f"https://coverartarchive.org/release/{release_gid}/front"


def resolve_release_from_recording(recording_gid: str) -> Optional[str]:
    """Resolve first associated MusicBrainz Release GID from a Recording GID.

    Args:
        recording_gid: MusicBrainz Recording GID string.

    Returns:
        Release GID string if found, otherwise None.
    """
    if not recording_gid:
        return None

    ref_mb_url = os.getenv("REF_MB_URL")

    # If REF_MB_URL specifies a postgres connection string, attempt local DB lookup
    if ref_mb_url and (ref_mb_url.startswith("postgres://") or ref_mb_url.startswith("postgresql://")):
        try:
            import psycopg2

            conn = psycopg2.connect(ref_mb_url, connect_timeout=3)
            try:
                with conn.cursor() as cursor:
                    query = """
                        SELECT rel.gid
                        FROM ref_mb.recording rec
                        JOIN ref_mb.track t ON t.recording = rec.id
                        JOIN ref_mb.medium m ON t.medium = m.id
                        JOIN ref_mb.release rel ON m.release = rel.id
                        WHERE rec.gid = %s LIMIT 1;
                    """
                    cursor.execute(query, (recording_gid,))
                    row = cursor.fetchone()
                    if row and row[0]:
                        return str(row[0])
            finally:
                conn.close()
        except Exception as e:
            logger.warning(f"Failed Postgres lookup via REF_MB_URL for recording {recording_gid}: {e}")

    # Default or fallback HTTP API lookup
    if ref_mb_url and not (ref_mb_url.startswith("postgres://") or ref_mb_url.startswith("postgresql://")):
        base_url = ref_mb_url.rstrip("/")
    else:
        base_url = DEFAULT_MB_BASE_URL

    url = f"{base_url}/recording/{recording_gid}?inc=releases&fmt=json"
    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "application/json",
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status != 200:
                logger.warning(f"MusicBrainz API returned HTTP status {response.status} for {recording_gid}")
                return None
            body = response.read().decode("utf-8")
            data = json.loads(body)
            releases = data.get("releases")
            if releases and isinstance(releases, list) and len(releases) > 0:
                first_release = releases[0]
                if isinstance(first_release, dict) and "id" in first_release:
                    return str(first_release["id"])
            return None
    except Exception as e:
        logger.warning(f"Error resolving release for recording {recording_gid}: {e}")
        return None
