import os
from typing import Optional
from dataclasses import dataclass
import asyncpg

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

    password = settings.get_password()
    dsn = f"postgresql://{settings.user}:{password}@{settings.host}:{settings.port}/{settings.database}"

    async def init(conn):
        await conn.execute(f"SET search_path TO {settings.schema}")
        await conn.execute(f"SET statement_timeout = {settings.statement_timeout_ms}")
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
                # Query dump_id safely (assuming it exists, but might not)
                try:
                    row = await conn.fetchrow("SELECT schema_sequence FROM dump_meta ORDER BY timestamp DESC LIMIT 1")
                    if row:
                        result["dump_id"] = row['schema_sequence']
                except asyncpg.exceptions.UndefinedTableError:
                    pass
    except Exception:
        pass
    finally:
        if pool:
            await pool.close()

    return result
