#!/usr/bin/env python3
"""
Clean Artist Names - Remove Tracklist Formatting Artifacts

This script fixes artist names that incorrectly include DJ mix tracklist formatting:
- Timestamp prefixes: [40:54] Artist Name, [??:??] Artist Name
- Special character prefixes: + Artist Name, + # Artist Name, * Artist Name
- Bracketed placeholders: [??] Artist Name

These are common in DJ tracklists but should not be part of the artist name.

Example fixes:
  "[40:54] Laurent Wolf" → "Laurent Wolf"
  "+ # Deadmau5" → "Deadmau5"
  "[??] ARTBAT" → "ARTBAT"
  "[??:??] + CamelPhat" → "CamelPhat"
"""

import asyncio
import os
import re
import sys
from typing import Dict, List, Tuple, Set
from datetime import datetime

import asyncpg
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Add parent directory to path for imports
sys.path.insert(0, '/app/common')
from secrets_manager import get_database_url


def clean_artist_name(name: str) -> str:
    """
    Remove tracklist formatting artifacts from artist names.

    Patterns removed:
    - Timestamp prefixes: [MM:SS], [??:??], [?:??:??]
    - Special character prefixes: +, -, *, + #
    - Bracketed placeholders: [??]
    - Leading/trailing whitespace

    Args:
        name: Raw artist name from database

    Returns:
        Cleaned artist name
    """
    if not name:
        return name

    original = name

    # Remove timestamp prefixes (most common)
    # Patterns: [00:00], [40:54], [??:??], [?:??:??], [??], etc.
    name = re.sub(r'^\[\d{1,2}:\d{2}\]\s*', '', name)  # [MM:SS]
    name = re.sub(r'^\[\?+:\?+:\?+\]\s*', '', name)    # [?:??:??]
    name = re.sub(r'^\[\?+:\?+\]\s*', '', name)        # [??:??]
    name = re.sub(r'^\[\?+\]\s*', '', name)            # [??]

    # Remove special character prefixes
    # Patterns: + Artist, + # Artist, - Artist, * Artist
    name = re.sub(r'^\+\s*#\s*', '', name)             # + #
    name = re.sub(r'^\+\s+', '', name)                 # +
    name = re.sub(r'^-\s+', '', name)                  # -
    name = re.sub(r'^\*\s+', '', name)                 # *

    # Trim whitespace
    name = name.strip()

    # If cleaning removed everything, keep original (edge case protection)
    if not name:
        return original

    return name


async def find_duplicate_artists(session) -> List[Tuple[str, List[str]]]:
    """
    Find groups of artists that will become duplicates after cleaning.

    Returns:
        List of (clean_name, [artist_id1, artist_id2, ...])
    """
    query = text("""
        SELECT
            name,
            artist_id,
            COUNT(*) OVER (PARTITION BY name) as name_count
        FROM artists
        ORDER BY name
    """)

    result = await session.execute(query)
    rows = result.fetchall()

    # Build mapping: clean_name -> [artist_ids]
    clean_to_ids: Dict[str, List[str]] = {}

    for row in rows:
        original_name = row.name
        artist_id = str(row.artist_id)

        clean_name = clean_artist_name(original_name)

        if clean_name not in clean_to_ids:
            clean_to_ids[clean_name] = []
        clean_to_ids[clean_name].append(artist_id)

    # Filter to only duplicates
    duplicates = [
        (clean_name, ids)
        for clean_name, ids in clean_to_ids.items()
        if len(ids) > 1
    ]

    return duplicates


async def merge_artists(
    session,
    keep_id: str,
    merge_ids: List[str],
    dry_run: bool = True
) -> int:
    """
    Merge duplicate artists by updating all references.

    Args:
        keep_id: Artist ID to keep
        merge_ids: Artist IDs to merge into keep_id
        dry_run: If True, only count changes without committing

    Returns:
        Number of track_artists rows updated
    """
    # Update track_artists to point to keep_id
    update_query = text("""
        UPDATE track_artists
        SET artist_id = :keep_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE artist_id = ANY(:merge_ids)
    """)

    if not dry_run:
        result = await session.execute(update_query, {
            "keep_id": keep_id,
            "merge_ids": merge_ids
        })
        updated_count = result.rowcount
    else:
        # Count without updating
        count_query = text("""
            SELECT COUNT(*)
            FROM track_artists
            WHERE artist_id = ANY(:merge_ids)
        """)
        result = await session.execute(count_query, {"merge_ids": merge_ids})
        updated_count = result.scalar()

    # Delete merged artist records (only if not dry run)
    if not dry_run:
        delete_query = text("""
            DELETE FROM artists
            WHERE artist_id = ANY(:merge_ids)
        """)
        await session.execute(delete_query, {"merge_ids": merge_ids})

    return updated_count


async def clean_artist_names_in_place(
    session,
    dry_run: bool = True
) -> int:
    """
    Clean artist names that don't create duplicates (safe in-place update).

    Returns:
        Number of artists cleaned
    """
    # Get all artists
    query = text("SELECT artist_id, name FROM artists ORDER BY name")
    result = await session.execute(query)
    rows = result.fetchall()

    # Build clean name mapping
    updates: List[Tuple[str, str]] = []  # (artist_id, clean_name)

    existing_names = {row.name for row in rows}

    for row in rows:
        artist_id = str(row.artist_id)
        original_name = row.name
        clean_name = clean_artist_name(original_name)

        # Only update if:
        # 1. Name actually changed
        # 2. Clean name doesn't conflict with existing artist
        if clean_name != original_name and clean_name not in existing_names:
            updates.append((artist_id, clean_name))

    if not dry_run:
        # Batch update
        for artist_id, clean_name in updates:
            update_query = text("""
                UPDATE artists
                SET name = :clean_name,
                    updated_at = CURRENT_TIMESTAMP
                WHERE artist_id = :artist_id
            """)
            await session.execute(update_query, {
                "artist_id": artist_id,
                "clean_name": clean_name
            })

    return len(updates)


async def clean_all_artists(dry_run: bool = True):
    """
    Main cleanup function.

    Process:
    1. Find artists that need cleaning
    2. Safe in-place updates (no conflicts)
    3. Find duplicates after cleaning
    4. Merge duplicates (keep oldest/most used)
    5. Rebuild graph nodes view
    """
    print("=" * 60)
    print("Artist Name Cleanup Script")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (writing changes)'}")
    print()

    # Database connection
    database_url = get_database_url(async_driver=True, use_connection_pool=True)

    engine = create_async_engine(
        database_url,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_pre_ping=True
    )

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # Step 1: Get statistics
    print("📊 Analyzing database...")
    async with session_factory() as session:
        stats_query = text(r"""
            SELECT
                COUNT(*) as total_artists,
                COUNT(*) FILTER (WHERE name ~ '^\[\d{1,2}:\d{2}\]') as with_timestamps,
                COUNT(*) FILTER (WHERE name ~ '^[+*-] ') as with_special_chars,
                COUNT(*) FILTER (WHERE name ~ '^\[') as with_brackets
            FROM artists
        """)
        result = await session.execute(stats_query)
        stats = result.fetchone()

    print(f"  Total artists: {stats.total_artists}")
    print(f"  With timestamps [MM:SS]: {stats.with_timestamps}")
    print(f"  With special chars (+, *, -): {stats.with_special_chars}")
    print(f"  With any bracket prefix: {stats.with_brackets}")
    print(f"  Estimated affected: {stats.with_timestamps + stats.with_special_chars}")
    print()

    # Step 2: Safe in-place cleaning
    print("🔧 Cleaning artist names (in-place, no conflicts)...")
    async with session_factory() as session:
        safe_updates = await clean_artist_names_in_place(session, dry_run=dry_run)
        if not dry_run:
            await session.commit()

    print(f"  ✅ {safe_updates} artists cleaned (no conflicts)")
    print()

    # Step 3: Find duplicates
    print("🔍 Finding duplicate artists after cleaning...")
    async with session_factory() as session:
        duplicates = await find_duplicate_artists(session)

    print(f"  Found {len(duplicates)} groups of duplicates")

    if duplicates:
        print()
        print("  Examples (first 10):")
        for clean_name, ids in duplicates[:10]:
            print(f"    '{clean_name}' → {len(ids)} duplicates")
    print()

    # Step 4: Merge duplicates
    if duplicates:
        print("🔀 Merging duplicate artists...")
        total_merged = 0
        total_tracks_updated = 0

        async with session_factory() as session:
            for clean_name, artist_ids in duplicates:
                # Keep the first artist ID (arbitrary choice - could use oldest or most tracks)
                keep_id = artist_ids[0]
                merge_ids = artist_ids[1:]

                tracks_updated = await merge_artists(
                    session,
                    keep_id,
                    merge_ids,
                    dry_run=dry_run
                )

                total_merged += len(merge_ids)
                total_tracks_updated += tracks_updated

            if not dry_run:
                # Update the kept artist name to clean version
                for clean_name, artist_ids in duplicates:
                    keep_id = artist_ids[0]
                    update_query = text("""
                        UPDATE artists
                        SET name = :clean_name,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE artist_id = :artist_id
                    """)
                    await session.execute(update_query, {
                        "artist_id": keep_id,
                        "clean_name": clean_name
                    })

                await session.commit()

        print(f"  ✅ {total_merged} duplicate artists merged")
        print(f"  ✅ {total_tracks_updated} track_artists rows updated")
        print()

    # Step 5: Final statistics
    print("📊 Final statistics...")
    async with session_factory() as session:
        final_query = text(r"""
            SELECT
                COUNT(*) as total_artists,
                COUNT(*) FILTER (WHERE name ~ '^\[\d{1,2}:\d{2}\]') as with_timestamps,
                COUNT(*) FILTER (WHERE name ~ '^[+*-] ') as with_special_chars,
                COUNT(*) FILTER (WHERE name ~ '^\[') as with_brackets
            FROM artists
        """)
        result = await session.execute(final_query)
        final_stats = result.fetchone()

    print(f"  Total artists: {final_stats.total_artists}")
    print(f"  With timestamps: {final_stats.with_timestamps} (was {stats.with_timestamps})")
    print(f"  With special chars: {final_stats.with_special_chars} (was {stats.with_special_chars})")
    print(f"  Cleaned: {(stats.with_timestamps + stats.with_special_chars) - (final_stats.with_timestamps + final_stats.with_special_chars)}")
    print()

    # Cleanup
    await engine.dispose()

    # Summary
    print("=" * 60)
    if dry_run:
        print("✅ Dry run complete - no changes made")
        print()
        print("Run with --live flag to apply changes:")
        print("  python clean_artist_names.py --live")
    else:
        print("✅ Cleanup complete!")
        print()
        print("⚠️  IMPORTANT: Rebuild graph nodes view:")
        print("  docker exec musicdb-postgres psql -U musicdb_user -d musicdb -c 'REFRESH MATERIALIZED VIEW CONCURRENTLY graph_nodes;'")
    print("=" * 60)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Clean artist names by removing tracklist formatting artifacts"
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Apply changes (default is dry run)"
    )

    args = parser.parse_args()

    asyncio.run(clean_all_artists(dry_run=not args.live))
