import asyncio
import sqlite3
import argparse
import sys
import uuid
from typing import Dict, Any, List

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def read_sqlite(db_path: str) -> Dict[str, Any]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = dict_factory
    cursor = conn.cursor()

    payload = {}
    tables = ['tracks', 'appearances', 'rotation_history', 'chart_positions',
              'pending', 'rejected', 'beatport_check', 'sources', 'runs', 'sets']

    # check integrity
    cursor.execute("PRAGMA integrity_check")
    if cursor.fetchone()['integrity_check'] != 'ok':
        raise Exception("SQLite DB integrity check failed.")

    for table in tables:
        try:
            cursor.execute(f"SELECT * FROM {table}")
            payload[table] = cursor.fetchall()
        except sqlite3.OperationalError:
            payload[table] = []

    try:
        cursor.execute("SELECT * FROM track_tags")
        tags = cursor.fetchall()
        # Merge tags into tracks based on some assumption?
        payload['track_tags'] = tags
    except sqlite3.OperationalError:
        payload['track_tags'] = []

    try:
        cursor.execute("SELECT * FROM set_tracks")
        payload['set_tracks'] = cursor.fetchall()
    except sqlite3.OperationalError:
        payload['set_tracks'] = []

    conn.close()
    return payload

async def main():
    parser = argparse.ArgumentParser(description="Import musicLibrary SQLite to Postgres")
    parser.add_argument("--sqlite", required=True, help="Path to SQLite DB")
    parser.add_argument("--api-url", default="http://localhost:8080/api/v1/library/ingest", help="API Endpoint to push to")

    args = parser.parse_args()

    # Normally we would use httpx to push this payload to the API
    # so that the queue handles it.
    import httpx

    payload = read_sqlite(args.sqlite)
    # Ensure idempotency key per run/file hash
    import hashlib
    file_hash = hashlib.md5(open(args.sqlite, 'rb').read()).hexdigest()

    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(args.api_url, json=payload, headers={'Idempotency-Key': f'import-{file_hash}'})
            res.raise_for_status()
            print(f"Successfully enqueued import job: {res.json()}")
        except httpx.HTTPStatusError as e:
            print(f"Failed to push import: {e.response.text}")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
