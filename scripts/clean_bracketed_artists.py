#!/usr/bin/env python3
"""
Clean bracketed artist names and trigger re-enrichment.

This script:
1. Finds tracks with bracketed artist names (e.g., "[00] Skrillex")
2. Creates or finds cleaned artist entries (e.g., "Skrillex")
3. Updates track_artists associations to use cleaned artists
4. Marks affected tracks for re-enrichment
"""

import asyncio
import asyncpg
import re
from typing import Dict, Set
import os

# Database configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5433"))
DB_NAME = os.getenv("DB_NAME", "musicdb")
DB_USER = os.getenv("DB_USER", "musicdb_user")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "musicdb_secure_pass_2024")


async def clean_bracketed_artists():
    """Main function to clean artist associations."""

    conn = await asyncpg.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )

    try:
        # Step 1: Find all bracketed artists
        print("📊 Finding bracketed artists...")
        bracketed_artists = await conn.fetch(r"""
            SELECT DISTINCT
                a.artist_id,
                a.name as original_name,
                REGEXP_REPLACE(a.name, '^\[[^\]]*\]\s*', '') as cleaned_name,
                LOWER(REGEXP_REPLACE(a.name, '^\[[^\]]*\]\s*', '')) as normalized_cleaned
            FROM artists a
            WHERE a.name ~ '^\['
              AND REGEXP_REPLACE(a.name, '^\[[^\]]*\]\s*', '') != ''
        """)

        print(f"  Found {len(bracketed_artists)} bracketed artists")

        # Step 2: Find or create cleaned artist entries
        print("\n🔧 Creating/finding cleaned artists...")
        artist_mapping: Dict[str, str] = {}  # old_id -> new_id
        created_count = 0
        matched_count = 0

        for record in bracketed_artists:
            old_id = str(record['artist_id'])
            cleaned_name = record['cleaned_name']
            normalized = record['normalized_cleaned']

            # Try to find existing artist by normalized_name
            existing = await conn.fetchrow("""
                SELECT artist_id FROM artists
                WHERE normalized_name = $1
                  AND artist_id != $2
                LIMIT 1
            """, normalized, record['artist_id'])

            if existing:
                # Use existing artist
                artist_mapping[old_id] = str(existing['artist_id'])
                matched_count += 1
            else:
                # Create new artist
                try:
                    new_artist = await conn.fetchrow("""
                        INSERT INTO artists (name, normalized_name)
                        VALUES ($1, $2)
                        ON CONFLICT (normalized_name) DO UPDATE
                        SET name = EXCLUDED.name
                        RETURNING artist_id
                    """, cleaned_name, normalized)

                    artist_mapping[old_id] = str(new_artist['artist_id'])
                    created_count += 1
                except Exception as e:
                    print(f"  ⚠️  Error creating artist '{cleaned_name}': {e}")
                    continue

        print(f"  ✅ Matched {matched_count} to existing artists")
        print(f"  ✅ Created {created_count} new artists")

        # Step 3: Update track_artists associations for failed tracks only
        print("\n🔄 Updating track_artists associations...")
        affected_tracks: Set[str] = set()

        async with conn.transaction():
            update_count = 0

            for old_artist_id, new_artist_id in artist_mapping.items():
                if old_artist_id == new_artist_id:
                    continue

                # Update track_artists for tracks with failed enrichment
                updated = await conn.fetch("""
                    UPDATE track_artists ta
                    SET artist_id = $1
                    FROM enrichment_status es
                    WHERE ta.artist_id = $2
                      AND ta.track_id = es.track_id
                      AND es.status = 'failed'
                    RETURNING ta.track_id
                """, new_artist_id, old_artist_id)

                for row in updated:
                    affected_tracks.add(str(row['track_id']))

                update_count += len(updated)

            print(f"  ✅ Updated {update_count} track_artist associations")
            print(f"  ✅ Affected {len(affected_tracks)} unique tracks")

        # Step 4: Mark tracks for re-enrichment
        print("\n♻️  Marking tracks for re-enrichment...")
        if affected_tracks:
            track_ids = list(affected_tracks)

            await conn.execute("""
                UPDATE enrichment_status
                SET status = 'pending',
                    is_retriable = true,
                    error_message = NULL,
                    retry_after = NOW()
                WHERE track_id = ANY($1::uuid[])
            """, track_ids)

            print(f"  ✅ Marked {len(track_ids)} tracks as pending re-enrichment")

        # Step 5: Show summary
        print("\n" + "="*60)
        print("📈 SUMMARY")
        print("="*60)
        print(f"  Bracketed artists processed: {len(bracketed_artists)}")
        print(f"  New artists created: {created_count}")
        print(f"  Existing artists matched: {matched_count}")
        print(f"  Track associations updated: {update_count}")
        print(f"  Tracks marked for re-enrichment: {len(affected_tracks)}")
        print("="*60)

        # Verify results
        stats = await conn.fetchrow("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM enrichment_status
        """)

        print(f"\n📊 Current enrichment status:")
        print(f"  Pending: {stats['pending']}")
        print(f"  Failed: {stats['failed']}")

    finally:
        await conn.close()


if __name__ == "__main__":
    print("🚀 Starting artist name cleaning script...\n")
    asyncio.run(clean_bracketed_artists())
    print("\n✅ Script completed!")
