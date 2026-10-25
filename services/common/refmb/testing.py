import pytest
import asyncpg
import os
from .settings import RefMBSettings

# Pytest fixture to start/connect to a throwaway Postgres container
# if Docker is available. Note: This assumes the container is already started
# or uses a dummy fallback for unit testing in CI where real PG might not be available.

@pytest.fixture(scope="session")
async def ref_mb_db():
    # If the sandbox can't run docker easily, skip with a reason.
    if not os.environ.get("MB_LOCAL_ENABLED") == "true":
        pytest.skip("MB_LOCAL_ENABLED is not set to true, skipping real DB test")

    settings = RefMBSettings.from_env()

    # Try to connect
    try:
        conn = await asyncpg.connect(
            user=settings.user,
            password=settings.get_password(),
            database=settings.database,
            host=settings.host,
            port=settings.port
        )
    except Exception as e:
        pytest.skip(f"Could not connect to ref_mb db: {e}")

    try:
        # Load DDL
        ddl_path = os.path.join(os.path.dirname(__file__), "ddl", "create_tables.sql")
        with open(ddl_path, "r") as f:
            ddl = f.read()
        await conn.execute(ddl)

        # Load dummy data
        await conn.execute("SET search_path TO ref_mb;")

        # 1. Recording
        await conn.execute("""
            INSERT INTO recording (id, gid, name, artist_credit, length)
            VALUES ('1', '00000000-0000-0000-0000-000000000001', 'Test Recording', '1', '200000');

            INSERT INTO recording (id, gid, name, artist_credit, length)
            VALUES ('2', '00000000-0000-0000-0000-000000000002', 'Duplicate Recording', '1', '200000');
        """)

        # 2. ISRC with duplicate
        await conn.execute("""
            INSERT INTO isrc (id, recording, isrc) VALUES ('1', '1', 'USABC1234567');
            INSERT INTO isrc (id, recording, isrc) VALUES ('2', '2', 'USABC1234567');
        """)

        # 3. Canonical recording redirect
        await conn.execute("""
            INSERT INTO canonical_recording_redirect (recording_mbid, canonical_recording_mbid)
            VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
        """)

        # 4. Artist (non-Latin)
        await conn.execute("""
            INSERT INTO artist (id, gid, name, sort_name)
            VALUES ('1', '00000000-0000-0000-0000-111111111111', 'アーティスト', 'アーティスト');
        """)

        # 5. Artist credit with "feat."
        await conn.execute("""
            INSERT INTO artist_credit (id, name) VALUES ('1', 'Main Artist feat. Guest');
        """)

        # 6. Track with Remix title
        await conn.execute("""
            INSERT INTO track (id, gid, recording, name)
            VALUES ('1', '00000000-0000-0000-0000-222222222222', '1', 'Test Recording (Remix)');
        """)

        yield conn

    finally:
        await conn.execute("DROP SCHEMA IF EXISTS ref_mb CASCADE;")
        await conn.close()

        # 7. Canonical row (missing from previous fixture)
        await conn.execute("""
            INSERT INTO canonical_musicbrainz_data (
                id, artist_credit_id, artist_mbids, artist_credit_name,
                release_mbid, release_name, recording_mbid, recording_name,
                combined_lookup, score
            ) VALUES (
                '1', '1', '00000000-0000-0000-0000-111111111111', 'Test Artist',
                '00000000-0000-0000-0000-000000000003', 'Test Release', '00000000-0000-0000-0000-000000000001', 'Test Recording',
                'Test Artist Test Recording', '100'
            );
        """)
