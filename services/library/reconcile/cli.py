import argparse
import asyncio
import csv
import sys
import logging
from typing import Dict, Any, List

import asyncpg

from library.reconcile.queries import fetch_library_tracks, fetch_silver_tracks
from library.reconcile.match import find_candidates

logger = logging.getLogger(__name__)

async def run_cli(conn: asyncpg.Connection, output_file: str):
    lib_rows = await fetch_library_tracks(conn)
    sil_rows = await fetch_silver_tracks(conn)

    candidates = find_candidates(lib_rows, sil_rows)

    print(f"{'Library ID':<36} | {'Silver ID':<36} | {'Library Artist':<20} | {'Library Title':<20} | {'Evidence'}")
    print("-" * 140)
    for c in candidates:
        evidence_str = ", ".join(f"{e['rule']}:{e['value']}" for e in c.evidence)
        print(f"{c.library_id:<36} | {c.silver_id:<36} | {c.library_artist[:20]:<20} | {c.library_title[:20]:<20} | {evidence_str}")

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            "library_id", "silver_id", "library_artist", "library_title",
            "silver_artist", "silver_title", "evidence"
        ])
        for c in candidates:
            evidence_str = ", ".join(f"{e['rule']}:{e['value']}" for e in c.evidence)
            writer.writerow([
                c.library_id, c.silver_id, c.library_artist, c.library_title,
                c.silver_artist, c.silver_title, evidence_str
            ])

    print(f"\nFound {len(candidates)} candidate duplicates. Written to {output_file}")

async def main():
    parser = argparse.ArgumentParser(description="Report candidate duplicate tracks")
    parser.add_argument("--db", required=True, help="Database connection string")
    parser.add_argument("--out", required=True, help="Output CSV file path")
    args = parser.parse_args()

    conn = await asyncpg.connect(args.db)
    try:
        await run_cli(conn, args.out)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
