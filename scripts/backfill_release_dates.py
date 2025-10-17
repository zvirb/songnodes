#!/usr/bin/env python3
"""
Backfill Release Dates for Tracks with Spotify IDs

This script fetches release dates from Spotify for tracks that:
1. Have a spotify_id (already matched)
2. Are missing release_date in the database

This is a one-time data repair script to fix historical enrichment gaps.
"""

import asyncio
import os
import sys
from datetime import datetime, date
from typing import Optional

import asyncpg
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Add parent directory to path for imports
sys.path.insert(0, '/app/services/metadata-enrichment')
sys.path.insert(0, '/app/common')

from api_clients import SpotifyClient
import redis.asyncio as aioredis


async def get_spotify_release_date(spotify_client: SpotifyClient, spotify_id: str) -> Optional[date]:
    """
    Fetch release date from Spotify API for a track

    Returns:
        date object or None if not available
    """
    try:
        track_data = await spotify_client.get_track(spotify_id)

        if not track_data or 'album' not in track_data:
            return None

        album = track_data['album']
        release_date_str = album.get('release_date')
        release_date_precision = album.get('release_date_precision', 'day')

        if not release_date_str:
            return None

        # Parse based on precision
        if release_date_precision == 'year':
            # Just year: YYYY
            year = int(release_date_str)
            return date(year, 1, 1)
        elif release_date_precision == 'month':
            # Year-month: YYYY-MM
            parts = release_date_str.split('-')
            year, month = int(parts[0]), int(parts[1])
            return date(year, month, 1)
        else:
            # Full date: YYYY-MM-DD
            parts = release_date_str.split('-')
            year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
            return date(year, month, day)

    except Exception as e:
        print(f"  ⚠️ Error fetching Spotify data for {spotify_id}: {e}")
        return None


async def backfill_release_dates(
    limit: int = 500,
    batch_size: int = 50,
    delay_between_batches: float = 2.0
):
    """
    Backfill release dates for tracks with Spotify IDs

    Args:
        limit: Maximum tracks to process
        batch_size: Tracks per batch
        delay_between_batches: Delay in seconds (rate limiting)
    """
    print("=" * 60)
    print("Release Date Backfill Script")
    print("=" * 60)
    print(f"Processing up to {limit} tracks in batches of {batch_size}")
    print()

    # Database connection
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://musicdb_user:musicdb_secure_pass_2024@db-connection-pool:6432/musicdb"
    )

    engine = create_async_engine(
        database_url,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_pre_ping=True
    )

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # Redis connection
    redis_host = os.getenv("REDIS_HOST", "redis")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    redis_password = os.getenv("REDIS_PASSWORD", "")

    redis_client = await aioredis.from_url(
        f"redis://:{redis_password}@{redis_host}:{redis_port}",
        decode_responses=False,
        max_connections=10
    )

    # Initialize Spotify client
    spotify_client_id = os.getenv("SPOTIFY_CLIENT_ID")
    spotify_client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")

    if not spotify_client_id or not spotify_client_secret:
        print("❌ Error: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set")
        return

    spotify_client = SpotifyClient(
        client_id=spotify_client_id,
        client_secret=spotify_client_secret,
        redis_client=redis_client,
        db_session_factory=session_factory
    )

    print("✅ Connections initialized")
    print()

    # Fetch tracks needing backfill
    async with session_factory() as session:
        query = text("""
            SELECT id, title, spotify_id
            FROM tracks
            WHERE spotify_id IS NOT NULL
              AND release_date IS NULL
            ORDER BY created_at DESC
            LIMIT :limit
        """)

        result = await session.execute(query, {"limit": limit})
        tracks = result.fetchall()

    print(f"📊 Found {len(tracks)} tracks with Spotify IDs but missing release dates")
    print()

    if not tracks:
        print("✅ All tracks already have release dates!")
        return

    # Process in batches
    total_updated = 0
    total_failed = 0

    for i in range(0, len(tracks), batch_size):
        batch = tracks[i:i+batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(tracks) + batch_size - 1) // batch_size

        print(f"🔄 Processing batch {batch_num}/{total_batches} ({len(batch)} tracks)...")

        batch_updated = 0
        batch_failed = 0

        for track in batch:
            track_id, title, spotify_id = track

            # Fetch release date from Spotify
            release_date = await get_spotify_release_date(spotify_client, spotify_id)

            if release_date:
                # Update database
                async with session_factory() as session:
                    update_query = text("""
                        UPDATE tracks
                        SET release_date = :release_date,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :track_id
                    """)

                    await session.execute(update_query, {
                        "track_id": track_id,
                        "release_date": release_date
                    })
                    await session.commit()

                print(f"  ✅ Updated: {title[:50]} → {release_date}")
                batch_updated += 1
                total_updated += 1
            else:
                print(f"  ⚠️ No date: {title[:50]}")
                batch_failed += 1
                total_failed += 1

        print(f"  Batch result: {batch_updated} updated, {batch_failed} failed")
        print()

        # Rate limiting delay between batches
        if i + batch_size < len(tracks):
            await asyncio.sleep(delay_between_batches)

    # Cleanup
    await redis_client.close()
    await engine.dispose()

    # Final summary
    print("=" * 60)
    print("Backfill Complete!")
    print("=" * 60)
    print(f"Total tracks processed: {len(tracks)}")
    print(f"✅ Successfully updated: {total_updated}")
    print(f"⚠️ Failed to fetch: {total_failed}")
    print(f"📈 Success rate: {total_updated / len(tracks) * 100:.1f}%")
    print()

    # Show updated coverage
    async with session_factory() as session:
        stats_query = text("""
            SELECT
                COUNT(*) as total,
                COUNT(release_date) as with_date,
                COUNT(release_date) * 100.0 / COUNT(*) as percentage
            FROM tracks
        """)
        result = await session.execute(stats_query)
        stats = result.fetchone()

        print(f"📊 New database coverage:")
        print(f"   Total tracks: {stats.total}")
        print(f"   With release_date: {stats.with_date}")
        print(f"   Coverage: {stats.percentage:.1f}%")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Backfill release dates from Spotify")
    parser.add_argument("--limit", type=int, default=500, help="Maximum tracks to process (default: 500)")
    parser.add_argument("--batch-size", type=int, default=50, help="Tracks per batch (default: 50)")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between batches in seconds (default: 2.0)")

    args = parser.parse_args()

    asyncio.run(backfill_release_dates(
        limit=args.limit,
        batch_size=args.batch_size,
        delay_between_batches=args.delay
    ))
