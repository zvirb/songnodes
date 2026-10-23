"""Apply the data-layer migrations (012-014) to the configured database. Idempotent and safe to run repeatedly.

    python migrate.py            # apply every migration in /app/sql in order
    python migrate.py --check    # report whether the objects the data layer needs exist, change nothing

Used by the Helm hook Job and by `docker compose run worker python migrate.py`. The SQL files are the same ones the
compose stack mounts as init scripts, copied into the image so there is one source of truth.
"""
import asyncio
import os
import sys
from pathlib import Path

import asyncpg

SQL_DIR = Path(os.getenv('MIGRATIONS_DIR', '/app/sql'))
REQUIRED = {
    'tables': ['target_tracks', 'ingestion_jobs', 'silver_track_metadata_evidence', 'outbox_events', 'outbox_consumers',
               'projection_tracks', 'entity_merge_history', 'entity_redirects', 'er_decisions', 'backfill_checkpoints',
               'silver_camelot_corrections'],
    'columns': [('bronze_scraped_tracks', 'playlist_id'), ('bronze_scraped_tracks', 'position'),
                ('silver_enriched_tracks', 'camelot_key'), ('silver_enriched_tracks', 'metadata_review'),
                ('silver_enriched_tracks', 'energy_canonical')],
}


def dsn() -> str:
    url = os.getenv('DATABASE_URL')
    if not url:
        user, host = os.getenv('POSTGRES_USER', 'musicdb_user'), os.getenv('POSTGRES_HOST', 'postgres')
        password = os.getenv('POSTGRES_PASSWORD') or os.getenv('DATABASE_PASSWORD') or ''
        url = f"postgresql://{user}:{password}@{host}:{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'musicdb')}"
    return url.replace('postgresql+asyncpg://', 'postgresql://', 1)


async def connect(attempts: int = 40, delay: float = 3.0):
    for attempt in range(1, attempts + 1):
        try:
            return await asyncpg.connect(dsn(), timeout=10)
        except (OSError, asyncpg.PostgresError) as error:
            if attempt == attempts:
                raise
            print(f'database not ready ({error.__class__.__name__}); retry {attempt}/{attempts}', flush=True)
            await asyncio.sleep(delay)


async def missing(conn) -> list:
    absent = []
    for table in REQUIRED['tables']:
        if not await conn.fetchval('SELECT to_regclass($1) IS NOT NULL', table):
            absent.append(f'table {table}')
    for table, column in REQUIRED['columns']:
        if not await conn.fetchval('SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2)', table, column):
            absent.append(f'column {table}.{column}')
    return absent


async def main(check_only: bool) -> int:
    conn = await connect()
    try:
        if not check_only:
            for path in sorted(SQL_DIR.glob('*_up.sql')):
                print(f'applying {path.name}', flush=True)
                await conn.execute(path.read_text(encoding='utf-8'))
        absent = await missing(conn)
        for item in absent:
            print(f'MISSING {item}', flush=True)
        print('data layer schema is complete' if not absent else f'{len(absent)} object(s) missing', flush=True)
        return 1 if absent else 0
    finally:
        await conn.close()


if __name__ == '__main__':
    sys.exit(asyncio.run(main('--check' in sys.argv)))
