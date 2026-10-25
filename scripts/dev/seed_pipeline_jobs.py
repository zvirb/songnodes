#!/usr/bin/env python3
import asyncio
import os
import sys
import uuid
import random
import urllib.parse
from datetime import datetime, timedelta

def check_env():
    if "--yes-local-dev" not in sys.argv:
        print("Error: Missing --yes-local-dev flag.")
        sys.exit(1)

    db_url = os.getenv("DATABASE_URL", "postgresql://songnodes:songnodes@localhost:5432/songnodes")

    try:
        parsed = urllib.parse.urlparse(db_url)
        hostname = parsed.hostname
    except Exception:
        hostname = ""

    allowed_hosts = ["localhost", "127.0.0.1", "postgres"]

    if hostname not in allowed_hosts:
         print("Error: This script can only be run against a local dev database.")
         sys.exit(1)

# Ensure we can import from services
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services'))

# Catch import errors so we can still test the flag logic without dependencies
try:
    from common.datalayer import jobs
    from routers.catalog_writes import get_pool
except ImportError:
    pass

async def seed_jobs():
    print("Seeding dev DB with pipeline jobs...")

    pool = await get_pool()
    async with pool.acquire() as conn:

        now = datetime.utcnow()

        # 1. Succeeded Jobs (over the last hour)
        for i in range(50):
            kind = random.choice(['scrape', 'enrich_track', 'ingest_pending'])
            source = random.choice(['1001tracklists', 'spotify', 'tidal'])
            payload = {"source": source, "seed": True, "track_id": f"song_test_{i}"}

            row, _ = await jobs.enqueue(conn, kind, str(uuid.uuid4()), payload)

            # Simulate claim
            await jobs.claim_next(conn, kinds=[kind])

            # Simulate completion in the past
            finished_time = now - timedelta(minutes=random.randint(1, 60))
            await conn.execute("""
                UPDATE ingestion_jobs
                SET status = 'succeeded', finished_at = $1, updated_at = $1
                WHERE id = $2
            """, finished_time, row['id'])

        # 2. Running Jobs
        for i in range(5):
            kind = random.choice(['scrape', 'enrich_track'])
            source = random.choice(['1001tracklists', 'spotify'])
            payload = {"source": source, "seed": True, "search_query": f"test target {i}"}

            row, _ = await jobs.enqueue(conn, kind, str(uuid.uuid4()), payload)
            await jobs.claim_next(conn, kinds=[kind])

        # 3. Queued Jobs
        for i in range(10):
            kind = 'ingest_pending'
            payload = {"source": "tidal", "seed": True}
            await jobs.enqueue(conn, kind, str(uuid.uuid4()), payload)

        # 4. Dead Jobs
        for i in range(3):
            kind = 'scrape'
            payload = {"source": "1001tracklists", "seed": True, "search_query": f"failing {i}"}
            row, _ = await jobs.enqueue(conn, kind, str(uuid.uuid4()), payload)

            # Fail it multiple times to make it dead
            for _ in range(3):
                await jobs.claim_next(conn, kinds=[kind])
                await jobs.fail(conn, row['id'], error=f"Rate limit exceeded {i}")

    print("Seeding complete.")

if __name__ == "__main__":
    check_env()
    if "pytest" not in sys.modules:
        asyncio.run(seed_jobs())
