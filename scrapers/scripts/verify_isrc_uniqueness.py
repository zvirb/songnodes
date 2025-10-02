#!/usr/bin/env python3
"""
ISRC Uniqueness Verification Script
Validates the 002_add_isrc_unique_constraints migration

Author: Schema Database Expert Agent
Date: 2025-10-02
Version: 1.0.0
"""

import os
import sys
import psycopg2
import psycopg2.extras
from datetime import datetime
from typing import Dict, List, Tuple

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def get_database_connection():
    """Get database connection using environment variables or defaults"""
    try:
        # Try to import secrets manager
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))
        from common.secrets_manager import get_database_config

        db_config = get_database_config()

        # Allow environment variable overrides for local testing
        if os.getenv('DATABASE_HOST'):
            db_config['host'] = os.getenv('DATABASE_HOST')
        if os.getenv('DATABASE_PORT'):
            db_config['port'] = int(os.getenv('DATABASE_PORT'))

        print(f"✓ Using secrets manager config: {db_config['host']}:{db_config['port']}")

    except ImportError:
        # Fallback to environment variables
        db_config = {
            'host': os.getenv('DATABASE_HOST', 'localhost'),
            'port': int(os.getenv('DATABASE_PORT', '5433')),
            'database': os.getenv('DATABASE_NAME', 'musicdb'),
            'user': os.getenv('DATABASE_USER', 'musicdb_user'),
            'password': os.getenv('DATABASE_PASSWORD', 'musicdb_secure_pass_2024')
        }
        print(f"✓ Using environment variables: {db_config['host']}:{db_config['port']}")

    return psycopg2.connect(**db_config)


def print_section(title: str):
    """Print formatted section header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{title}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 70}{Colors.ENDC}\n")


def print_success(message: str):
    """Print success message"""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")


def print_warning(message: str):
    """Print warning message"""
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")


def print_error(message: str):
    """Print error message"""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")


def print_info(message: str):
    """Print info message"""
    print(f"{Colors.OKCYAN}ℹ {message}{Colors.ENDC}")


def verify_migration_applied(conn) -> bool:
    """Check if migration 002 was applied"""
    print_section("MIGRATION STATUS CHECK")

    with conn.cursor() as cur:
        # Check if migration tracking table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'schema_migrations'
            )
        """)
        tracking_exists = cur.fetchone()[0]

        if not tracking_exists:
            print_warning("Migration tracking table does not exist")
            return False

        # Check if migration was applied
        cur.execute("""
            SELECT applied_at, description
            FROM schema_migrations
            WHERE migration_name = '002_add_isrc_unique_constraints'
        """)
        result = cur.fetchone()

        if result:
            applied_at, description = result
            print_success(f"Migration applied on: {applied_at}")
            print_info(f"Description: {description}")
            return True
        else:
            print_error("Migration 002_add_isrc_unique_constraints NOT applied")
            return False


def verify_unique_constraints(conn) -> Tuple[bool, bool]:
    """Verify unique constraints exist on ISRC and Spotify ID"""
    print_section("UNIQUE CONSTRAINT VERIFICATION")

    with conn.cursor() as cur:
        # Check ISRC unique index
        cur.execute("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE indexname = 'idx_tracks_isrc_unique'
        """)
        isrc_index = cur.fetchone()

        if isrc_index:
            print_success(f"ISRC unique index exists: {isrc_index[0]}")
            print_info(f"Definition: {isrc_index[1]}")
            isrc_constraint_exists = True
        else:
            print_error("ISRC unique index NOT found")
            isrc_constraint_exists = False

        # Check Spotify ID unique index
        cur.execute("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE indexname = 'idx_tracks_spotify_id_unique'
        """)
        spotify_index = cur.fetchone()

        if spotify_index:
            print_success(f"Spotify ID unique index exists: {spotify_index[0]}")
            print_info(f"Definition: {spotify_index[1]}")
            spotify_constraint_exists = True
        else:
            print_error("Spotify ID unique index NOT found")
            spotify_constraint_exists = False

    return isrc_constraint_exists, spotify_constraint_exists


def count_tracks_with_identifiers(conn) -> Dict[str, int]:
    """Count tracks with various identifiers"""
    print_section("TRACK IDENTIFIER STATISTICS")

    with conn.cursor() as cur:
        # Total tracks
        cur.execute("SELECT COUNT(*) FROM tracks")
        total_tracks = cur.fetchone()[0]

        # Tracks with ISRC
        cur.execute("SELECT COUNT(*) FROM tracks WHERE isrc IS NOT NULL")
        tracks_with_isrc = cur.fetchone()[0]

        # Tracks without ISRC
        tracks_without_isrc = total_tracks - tracks_with_isrc

        # Tracks with Spotify ID
        cur.execute("SELECT COUNT(*) FROM tracks WHERE spotify_id IS NOT NULL")
        tracks_with_spotify = cur.fetchone()[0]

        # Tracks with both ISRC and Spotify ID
        cur.execute("SELECT COUNT(*) FROM tracks WHERE isrc IS NOT NULL AND spotify_id IS NOT NULL")
        tracks_with_both = cur.fetchone()[0]

        # Tracks with neither
        cur.execute("SELECT COUNT(*) FROM tracks WHERE isrc IS NULL AND spotify_id IS NULL")
        tracks_with_neither = cur.fetchone()[0]

        stats = {
            'total': total_tracks,
            'with_isrc': tracks_with_isrc,
            'without_isrc': tracks_without_isrc,
            'with_spotify': tracks_with_spotify,
            'with_both': tracks_with_both,
            'with_neither': tracks_with_neither
        }

        # Print statistics
        print_info(f"Total tracks: {total_tracks:,}")
        print_success(f"Tracks with ISRC: {tracks_with_isrc:,} ({tracks_with_isrc/total_tracks*100:.1f}%)")
        print_warning(f"Tracks without ISRC: {tracks_without_isrc:,} ({tracks_without_isrc/total_tracks*100:.1f}%)")
        print_success(f"Tracks with Spotify ID: {tracks_with_spotify:,} ({tracks_with_spotify/total_tracks*100:.1f}%)")
        print_info(f"Tracks with both ISRC & Spotify ID: {tracks_with_both:,}")
        print_warning(f"Tracks with neither identifier: {tracks_with_neither:,}")

        return stats


def find_duplicate_isrc(conn) -> List[Tuple[str, int]]:
    """Find any duplicate ISRC values (should be 0 after migration)"""
    print_section("DUPLICATE ISRC CHECK")

    with conn.cursor() as cur:
        cur.execute("""
            SELECT isrc, COUNT(*) as count, ARRAY_AGG(id::text ORDER BY created_at) as track_ids
            FROM tracks
            WHERE isrc IS NOT NULL
            GROUP BY isrc
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        """)
        duplicates = cur.fetchall()

        if duplicates:
            print_error(f"Found {len(duplicates)} duplicate ISRC groups!")
            for isrc, count, track_ids in duplicates[:10]:  # Show first 10
                print_warning(f"  ISRC: {isrc} - {count} tracks: {track_ids[:3]}")
            return duplicates
        else:
            print_success("No duplicate ISRCs found - constraint is working correctly!")
            return []


def find_duplicate_spotify_id(conn) -> List[Tuple[str, int]]:
    """Find any duplicate Spotify ID values (should be 0 after migration)"""
    print_section("DUPLICATE SPOTIFY ID CHECK")

    with conn.cursor() as cur:
        cur.execute("""
            SELECT spotify_id, COUNT(*) as count, ARRAY_AGG(id::text ORDER BY created_at) as track_ids
            FROM tracks
            WHERE spotify_id IS NOT NULL
            GROUP BY spotify_id
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        """)
        duplicates = cur.fetchall()

        if duplicates:
            print_error(f"Found {len(duplicates)} duplicate Spotify ID groups!")
            for spotify_id, count, track_ids in duplicates[:10]:
                print_warning(f"  Spotify ID: {spotify_id} - {count} tracks: {track_ids[:3]}")
            return duplicates
        else:
            print_success("No duplicate Spotify IDs found - constraint is working correctly!")
            return []


def check_deleted_tracks_audit(conn) -> int:
    """Check audit log of deleted duplicate tracks"""
    print_section("DELETED TRACKS AUDIT LOG")

    with conn.cursor() as cur:
        # Check if audit table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'deleted_duplicate_tracks'
            )
        """)
        audit_exists = cur.fetchone()[0]

        if not audit_exists:
            print_info("No deleted_duplicate_tracks audit table found")
            return 0

        # Count deleted tracks
        cur.execute("SELECT COUNT(*) FROM deleted_duplicate_tracks")
        deleted_count = cur.fetchone()[0]

        if deleted_count > 0:
            print_warning(f"Migration deleted {deleted_count} duplicate track records")

            # Show deletion breakdown by type
            cur.execute("""
                SELECT duplicate_type, COUNT(*) as count
                FROM deleted_duplicate_tracks
                GROUP BY duplicate_type
                ORDER BY count DESC
            """)
            breakdown = cur.fetchall()

            for dup_type, count in breakdown:
                print_info(f"  {dup_type}: {count} records deleted")

            # Show sample of deleted tracks
            cur.execute("""
                SELECT original_id, merged_into_id, duplicate_type, identifier, deleted_at
                FROM deleted_duplicate_tracks
                ORDER BY deleted_at DESC
                LIMIT 5
            """)
            samples = cur.fetchall()

            print_info("\nSample deleted tracks (first 5):")
            for orig_id, merged_id, dup_type, identifier, deleted_at in samples:
                print_info(f"  {orig_id} → {merged_id} ({dup_type}: {identifier}) on {deleted_at}")
        else:
            print_success("No tracks were deleted during migration")

        return deleted_count


def verify_performance_indexes(conn) -> bool:
    """Verify performance indexes were created"""
    print_section("PERFORMANCE INDEX VERIFICATION")

    expected_indexes = [
        'idx_tracks_isrc_lookup',
        'idx_tracks_spotify_id_lookup',
        'idx_tracks_title_normalized_composite'
    ]

    all_exist = True
    with conn.cursor() as cur:
        for index_name in expected_indexes:
            cur.execute("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE indexname = %s
            """, (index_name,))
            result = cur.fetchone()

            if result:
                print_success(f"Index exists: {index_name}")
            else:
                print_error(f"Index missing: {index_name}")
                all_exist = False

    return all_exist


def generate_summary_report(
    migration_applied: bool,
    constraints_exist: Tuple[bool, bool],
    stats: Dict[str, int],
    duplicate_isrc: List,
    duplicate_spotify: List,
    deleted_count: int,
    indexes_exist: bool
) -> bool:
    """Generate final summary report"""
    print_section("VERIFICATION SUMMARY REPORT")

    all_checks_passed = True

    # Migration applied check
    if migration_applied:
        print_success("Migration 002 applied successfully")
    else:
        print_error("Migration 002 NOT applied")
        all_checks_passed = False

    # Constraint checks
    isrc_constraint, spotify_constraint = constraints_exist
    if isrc_constraint and spotify_constraint:
        print_success("All unique constraints exist")
    else:
        print_error("Missing unique constraints")
        all_checks_passed = False

    # Duplicate checks
    if len(duplicate_isrc) == 0 and len(duplicate_spotify) == 0:
        print_success("No duplicate identifiers found")
    else:
        print_error(f"Found {len(duplicate_isrc)} duplicate ISRCs and {len(duplicate_spotify)} duplicate Spotify IDs")
        all_checks_passed = False

    # Coverage statistics
    isrc_coverage = (stats['with_isrc'] / stats['total'] * 100) if stats['total'] > 0 else 0
    if isrc_coverage >= 50:
        print_success(f"ISRC coverage: {isrc_coverage:.1f}% (good)")
    else:
        print_warning(f"ISRC coverage: {isrc_coverage:.1f}% (consider enrichment)")

    # Index verification
    if indexes_exist:
        print_success("All performance indexes exist")
    else:
        print_warning("Some performance indexes missing")

    # Deleted tracks
    if deleted_count > 0:
        print_info(f"{deleted_count} duplicate tracks were merged and deleted")

    # Final verdict
    print("\n" + "=" * 70)
    if all_checks_passed:
        print(f"{Colors.OKGREEN}{Colors.BOLD}✓ ALL VERIFICATION CHECKS PASSED{Colors.ENDC}")
        print(f"{Colors.OKGREEN}Migration 002 is working correctly!{Colors.ENDC}")
        return True
    else:
        print(f"{Colors.FAIL}{Colors.BOLD}✗ VERIFICATION FAILED{Colors.ENDC}")
        print(f"{Colors.FAIL}Please review the issues above{Colors.ENDC}")
        return False


def main():
    """Main verification script"""
    print(f"{Colors.BOLD}{Colors.HEADER}")
    print("╔═══════════════════════════════════════════════════════════════════╗")
    print("║    ISRC Uniqueness Verification Script                           ║")
    print("║    Migration: 002_add_isrc_unique_constraints                     ║")
    print("╚═══════════════════════════════════════════════════════════════════╝")
    print(f"{Colors.ENDC}\n")

    try:
        # Connect to database
        print_info("Connecting to database...")
        conn = get_database_connection()
        print_success("Database connection established\n")

        # Run verification checks
        migration_applied = verify_migration_applied(conn)
        constraints_exist = verify_unique_constraints(conn)
        stats = count_tracks_with_identifiers(conn)
        duplicate_isrc = find_duplicate_isrc(conn)
        duplicate_spotify = find_duplicate_spotify_id(conn)
        deleted_count = check_deleted_tracks_audit(conn)
        indexes_exist = verify_performance_indexes(conn)

        # Generate summary report
        success = generate_summary_report(
            migration_applied,
            constraints_exist,
            stats,
            duplicate_isrc,
            duplicate_spotify,
            deleted_count,
            indexes_exist
        )

        # Close connection
        conn.close()
        print_info("\nDatabase connection closed")

        # Exit with appropriate code
        sys.exit(0 if success else 1)

    except psycopg2.Error as e:
        print_error(f"Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
