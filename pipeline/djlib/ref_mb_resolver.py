"""Local ref_mb ISRC Resolver module for querying PostgreSQL ref_mb database."""

import logging
import os
from typing import Dict, List, Optional
import psycopg2
from psycopg2.pool import SimpleConnectionPool

logger = logging.getLogger(__name__)

# Connection defaults
DEFAULT_HOST = os.getenv("REF_MB_HOST", os.getenv("MB_LOCAL_HOST", "127.0.0.1"))
DEFAULT_PORT = int(os.getenv("REF_MB_PORT", os.getenv("MB_LOCAL_PORT", "55433")))
DEFAULT_DB = os.getenv("REF_MB_DB", os.getenv("MB_LOCAL_DATABASE", "ref_mb"))
DEFAULT_USER = os.getenv("REF_MB_USER", os.getenv("MB_LOCAL_USER", "ref_mb_admin"))
DEFAULT_PASSWORD_FILE = os.getenv("REF_MB_PASSWORD_FILE")

_pool: Optional[SimpleConnectionPool] = None


def _get_password() -> str:
    pwd = os.getenv("REF_MB_PASSWORD", os.getenv("MB_LOCAL_PASSWORD", ""))
    if pwd:
        return pwd
    if os.path.exists(DEFAULT_PASSWORD_FILE):
        try:
            with open(DEFAULT_PASSWORD_FILE, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception as e:
            logger.warning(f"Failed to read password file {DEFAULT_PASSWORD_FILE}: {e}")
    return ""


def get_connection_pool() -> Optional[SimpleConnectionPool]:
    """Get or initialize the PostgreSQL connection pool."""
    global _pool
    if _pool is not None and not _pool.closed:
        return _pool

    try:
        password = _get_password()
        _pool = SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            host=DEFAULT_HOST,
            port=DEFAULT_PORT,
            dbname=DEFAULT_DB,
            user=DEFAULT_USER,
            password=password,
            connect_timeout=2,
        )
        return _pool
    except Exception as e:
        logger.warning(f"Failed to connect to ref_mb database at {DEFAULT_HOST}:{DEFAULT_PORT}: {e}")
        _pool = None
        return None


def resolve_isrc_local(isrc: str) -> Optional[Dict[str, Optional[str]]]:
    """Resolve a single ISRC to canonical MusicBrainz GID, title, and duration.

    Args:
        isrc: The ISRC string to resolve.

    Returns:
        dict with keys "mbid", "title", "duration_ms", or None if unmapped or database offline.
    """
    if not isrc:
        return None

    pool = get_connection_pool()
    if pool is None:
        return None

    conn = None
    try:
        conn = pool.getconn()
        with conn.cursor() as cursor:
            query = """
                SELECT r.gid, r.name, r.length
                FROM ref_mb.isrc i
                JOIN ref_mb.recording r ON i.recording = r.id
                WHERE i.isrc = %s LIMIT 1;
            """
            cursor.execute(query, (isrc,))
            row = cursor.fetchone()
            if row:
                return {
                    "mbid": str(row[0]),
                    "title": row[1],
                    "duration_ms": row[2],
                }
            return None
    except Exception as e:
        logger.warning(f"Error querying ref_mb database for ISRC {isrc}: {e}")
        return None
    finally:
        if conn is not None and pool is not None:
            try:
                pool.putconn(conn)
            except Exception as e:
                logger.warning(f"Failed to return connection to pool: {e}")


def batch_resolve_isrcs(isrc_list: List[str]) -> Dict[str, Dict[str, Optional[str]]]:
    """Resolve a list of ISRCs in batch to canonical MusicBrainz metadata.

    Args:
        isrc_list: List of ISRC strings to resolve.

    Returns:
        Dict mapping ISRC string to dict with keys "mbid", "title", "duration_ms".
    """
    if not isrc_list:
        return {}

    # Deduplicate while preserving order if desired, or set
    clean_isrcs = list({isrc for isrc in isrc_list if isrc})
    if not clean_isrcs:
        return {}

    pool = get_connection_pool()
    if pool is None:
        return {}

    conn = None
    try:
        conn = pool.getconn()
        with conn.cursor() as cursor:
            query = """
                SELECT i.isrc, r.gid, r.name, r.length
                FROM ref_mb.isrc i
                JOIN ref_mb.recording r ON i.recording = r.id
                WHERE i.isrc = ANY(%s);
            """
            cursor.execute(query, (clean_isrcs,))
            rows = cursor.fetchall()

            result = {}
            for row in rows:
                isrc_val, gid, name, length = row
                result[isrc_val] = {
                    "mbid": str(gid),
                    "title": name,
                    "duration_ms": length,
                }
            return result
    except Exception as e:
        logger.warning(f"Error querying ref_mb database for batch ISRCs: {e}")
        return {}
    finally:
        if conn is not None and pool is not None:
            try:
                pool.putconn(conn)
            except Exception as e:
                logger.warning(f"Failed to return connection to pool: {e}")
