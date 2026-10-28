import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Dict

import asyncpg

logger = logging.getLogger(__name__)

# The specific keys we look up, mapped to the env variable name they satisfy
_MAPPING = {
    ('discogs', 'token'): 'DISCOGS_TOKEN',
    ('lastfm', 'api_key'): 'LASTFM_API_KEY',
    ('getsongbpm', 'api_key'): 'GETSONGBPM_API_KEY',
    ('tidal', 'client_id'): 'TIDAL_CLIENT_ID',
    ('tidal', 'client_secret'): 'TIDAL_CLIENT_SECRET',
}

async def load(conn: asyncpg.Connection, secret: str) -> Dict[str, str]:
    """Load API keys from the api_keys table into an env-like dictionary."""
    results = {}
    for (service, key_name), env_key in _MAPPING.items():
        try:
            val = await conn.fetchval(
                "SELECT get_api_key($1, $2, $3)",
                service, key_name, secret
            )
            if val and isinstance(val, str):
                val = val.strip()
                if val and not val.upper().startswith('CHANGE_ME'):
                    results[env_key] = val
        except Exception as e:
            # Log only the service and exception type: the message may echo the secret or DSN.
            logger.warning("failed to load saved key for %s: %s", service, e.__class__.__name__)
    return results

_SQLALCHEMY_SCHEMES = (
    'postgresql+asyncpg://',
    'postgresql+psycopg2://',
    'postgresql+psycopg://',
    'postgresql+pg8000://',
    'postgres+asyncpg://',
)


def normalise_dsn(dsn: str) -> str:
    """Turn a SQLAlchemy URL (postgresql+asyncpg://...) into a plain one asyncpg accepts."""
    for scheme in _SQLALCHEMY_SCHEMES:
        if dsn.startswith(scheme):
            return 'postgresql://' + dsn[len(scheme):]
    return dsn


def load_sync(dsn: str, secret: str) -> Dict[str, str]:
    """
    Synchronously load API keys, using a separate event loop and thread
    to avoid conflicts if called from within a running event loop.
    """
    if not dsn:
        return {}
    dsn = normalise_dsn(dsn)

    def _run() -> Dict[str, str]:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        conn = None
        try:
            conn = loop.run_until_complete(asyncpg.connect(dsn, timeout=5.0))
            return loop.run_until_complete(asyncio.wait_for(load(conn, secret), timeout=5.0))
        except Exception as e:
            # We don't want to log the DSN or secrets on error
            logger.warning(f"failed to load saved keys from database: {e.__class__.__name__}")
            return {}
        finally:
            if conn:
                try:
                    loop.run_until_complete(conn.close())
                except Exception:
                    pass
            try:
                loop.close()
            except Exception:
                pass

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_run)
        try:
            return future.result(timeout=10.0)
        except Exception as e:
            logger.warning(f"failed to load saved keys asynchronously: {e.__class__.__name__}")
            return {}
