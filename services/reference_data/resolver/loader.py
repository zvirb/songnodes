import asyncio
import asyncpg
import csv
import gzip
import logging
import os

logger = logging.getLogger(__name__)

async def load_canonical_data(conn: asyncpg.Connection, fixture_dir: str):
    logger.info("Loading canonical MB data...")

    csv_file = os.path.join(fixture_dir, 'canonical_musicbrainz_data.csv.gz')
    if not os.path.exists(csv_file):
        logger.warning(f"Canonical data not found at {csv_file}")
        return

    await conn.execute("TRUNCATE TABLE ref_mb.canonical_musicbrainz_data")

    with gzip.open(csv_file, 'rt', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)

        records = []
        for row in reader:
            records.append((
                row[0],
                int(row[1]) if row[1] else None,
                row[2],
                row[3],
                row[4] if row[4] else None,
                row[5],
                row[6] if row[6] else None,
                row[7],
                row[8],
                int(row[9]) if row[9] else None,
                int(row[10]) if row[10] else None
            ))

            if len(records) >= 5000:
                await conn.copy_records_to_table(
                    'canonical_musicbrainz_data',
                    schema_name='ref_mb',
                    records=records,
                    columns=headers
                )
                records = []

        if records:
            await conn.copy_records_to_table(
                'canonical_musicbrainz_data',
                schema_name='ref_mb',
                records=records,
                columns=headers
            )

    logger.info("Canonical MB data loaded.")

    # Load Canonical redirects
    logger.info("Loading canonical redirects...")
    rec_redirect_file = os.path.join(fixture_dir, 'canonical_recording_redirect.csv.gz')
    if os.path.exists(rec_redirect_file):
        await conn.execute("TRUNCATE TABLE ref_mb.canonical_recording_redirect")
        with gzip.open(rec_redirect_file, 'rt', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader)

            records = []
            for row in reader:
                records.append((row[0], row[1], row[2] if row[2] else None))
                if len(records) >= 5000:
                    await conn.copy_records_to_table(
                        'canonical_recording_redirect',
                        schema_name='ref_mb',
                        records=records,
                        columns=headers
                    )
                    records = []
            if records:
                await conn.copy_records_to_table(
                    'canonical_recording_redirect',
                    schema_name='ref_mb',
                    records=records,
                    columns=headers
                )

    rel_redirect_file = os.path.join(fixture_dir, 'canonical_release_redirect.csv.gz')
    if os.path.exists(rel_redirect_file):
        await conn.execute("TRUNCATE TABLE ref_mb.canonical_release_redirect")
        with gzip.open(rel_redirect_file, 'rt', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader)

            records = []
            for row in reader:
                records.append((row[0], row[1], row[2] if row[2] else None))
                if len(records) >= 5000:
                    await conn.copy_records_to_table(
                        'canonical_release_redirect',
                        schema_name='ref_mb',
                        records=records,
                        columns=headers
                    )
                    records = []
            if records:
                await conn.copy_records_to_table(
                    'canonical_release_redirect',
                    schema_name='ref_mb',
                    records=records,
                    columns=headers
                )

async def build_indexes(conn: asyncpg.Connection):
    logger.info("Building indexes on ref_mb...")

    await conn.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    await conn.execute("CREATE EXTENSION IF NOT EXISTS unaccent")

    await conn.execute("""
        CREATE INDEX IF NOT EXISTS trgm_idx_canonical_combined
        ON ref_mb.canonical_musicbrainz_data USING gin (combined_lookup gin_trgm_ops)
    """)

    await conn.execute("""
        CREATE INDEX IF NOT EXISTS trgm_idx_recording_name
        ON ref_mb.recording USING gin (name gin_trgm_ops)
    """)

    await conn.execute("""
        CREATE INDEX IF NOT EXISTS trgm_idx_artist_name
        ON ref_mb.artist USING gin (name gin_trgm_ops)
    """)

    await conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_canonical_combined_exact
        ON ref_mb.canonical_musicbrainz_data (combined_lookup)
    """)

    await conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_isrc_isrc
        ON ref_mb.isrc (isrc)
    """)

    logger.info("Indexes built successfully.")

async def run_loader(dsn: str, fixture_dir: str):
    conn = await asyncpg.connect(dsn)
    try:
        await load_canonical_data(conn, fixture_dir)
        await build_indexes(conn)
    finally:
        await conn.close()

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    dsn = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/songnodes')
    fixture_dir = os.environ.get('CANONICAL_FIXTURE_DIR', 'contracts/fixtures/canonical')
    asyncio.run(run_loader(dsn, fixture_dir))
