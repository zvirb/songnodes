import os
import re
from typing import Any, Optional
from dataclasses import dataclass
from urllib.parse import quote_plus
import asyncpg

# dump_meta is not on the live mirror. load_manifest's column names are not fixed;
# take the first of these keys that is present and non-empty.
LOAD_MANIFEST_SQL = """
SELECT COALESCE(
    NULLIF(to_jsonb(m)->>'dump_id', ''),
    NULLIF(to_jsonb(m)->>'schema_sequence', ''),
    NULLIF(to_jsonb(m)->>'id', '')
) AS dump_id
FROM ref_mb.load_manifest m
ORDER BY COALESCE(
    to_jsonb(m)->>'loaded_at',
    to_jsonb(m)->>'finished_at',
    to_jsonb(m)->>'timestamp',
    ''
) DESC
LIMIT 1
"""


def _dump_id_unavailable(exc: BaseException) -> bool:
    """Missing manifest, or a statement timeout. Provenance must not fail the match."""
    sqlstate = getattr(exc, 'sqlstate', None)
    if sqlstate in {'42P01', '42703', '42883', '57014'}:
        return True
    text = str(exc).lower()
    return 'does not exist' in text or 'undefined' in text or 'statement timeout' in text


async def read_dump_id(conn: Any) -> Optional[str]:
    """Dump id from `ref_mb.load_manifest`, or None when that table is missing, empty, or timed out.

    A statement timeout (SQLSTATE 57014) is treated as no dump id. Callers still apply
    `MB_LOCAL_DUMP_ID`. This lookup must not discard a match that has already succeeded.
    """
    try:
        row = await conn.fetchrow(LOAD_MANIFEST_SQL)
    except Exception as exc:
        if _dump_id_unavailable(exc):
            return None
        raise
    if not row:
        return None
    try:
        value = row['dump_id']
    except (KeyError, IndexError, TypeError):
        return None
    text = '' if value is None else str(value).strip()
    return text or None

_IDENT = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')

@dataclass
class RefMBSettings:
    enabled: bool = False
    host: str = "host.docker.internal"
    port: int = 55433
    database: str = "ref_mb"
    schema: str = "ref_mb"
    user: str = "ref_mb_reader"
    statement_timeout_ms: int = 2000

    @classmethod
    def from_env(cls) -> "RefMBSettings":
        enabled_str = os.getenv("MB_LOCAL_ENABLED", "false").lower()
        enabled = enabled_str in ("true", "1", "yes")
        host = os.getenv("MB_LOCAL_HOST", "host.docker.internal")
        port = int(os.getenv("MB_LOCAL_PORT", "55433"))
        database = os.getenv("MB_LOCAL_DATABASE", "ref_mb")
        schema = os.getenv("MB_LOCAL_SCHEMA", "ref_mb")
        user = os.getenv("MB_LOCAL_USER", "ref_mb_reader")
        timeout = int(os.getenv("MB_LOCAL_STATEMENT_TIMEOUT_MS", "2000"))

        return cls(
            enabled=enabled,
            host=host,
            port=port,
            database=database,
            schema=schema,
            user=user,
            statement_timeout_ms=timeout,
        )

    def get_password(self) -> str:
        """Read password at connect time, from env or file."""
        pwd_file = os.getenv("MB_LOCAL_PASSWORD_FILE")
        if pwd_file and os.path.exists(pwd_file):
            with open(pwd_file, "r") as f:
                return f.read().strip()
        return os.getenv("MB_LOCAL_PASSWORD", "")

async def create_pool(settings: RefMBSettings) -> Optional[asyncpg.Pool]:
    if not settings.enabled:
        return None

    if not _IDENT.match(settings.schema):
        raise ValueError(f'ref_mb schema is not a safe identifier: {settings.schema!r}')
    password = settings.get_password()
    dsn = (
        f"postgresql://{quote_plus(settings.user)}:{quote_plus(password)}"
        f"@{settings.host}:{int(settings.port)}/{quote_plus(settings.database)}"
    )

    async def init(conn):
        # public stays on the path so unaccent and pg_trgm, installed outside ref_mb, resolve.
        await conn.execute(f"SET search_path TO {settings.schema}, public")
        await conn.execute(f"SET statement_timeout = {int(settings.statement_timeout_ms)}")
        await conn.execute("SET default_transaction_read_only = on")

    return await asyncpg.create_pool(
        dsn,
        init=init,
        min_size=1,
        max_size=5,
        timeout=5.0
    )

async def check_health(settings: Optional[RefMBSettings] = None) -> dict:
    if settings is None:
        settings = RefMBSettings.from_env()

    result = {
        "enabled": settings.enabled,
        "reachable": False,
        "schema": settings.schema,
        "dump_id": None
    }

    if not settings.enabled:
        return result

    pool = None
    try:
        pool = await create_pool(settings)
        if pool:
            async with pool.acquire() as conn:
                result["reachable"] = True
                result["dump_id"] = await read_dump_id(conn) or os.getenv("MB_LOCAL_DUMP_ID") or None
    except Exception:
        pass
    finally:
        if pool:
            await pool.close()

    return result
