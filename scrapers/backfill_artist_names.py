"""
Backfill Script: Extract and populate artist_name field in raw_scrape_data

This script processes EnhancedTrackItem records that lack artist_name field
and extracts it from source_context using parse_track_string().

Usage:
    python backfill_artist_names.py --dry-run  # Preview changes
    python backfill_artist_names.py --batch-size 1000  # Process in batches
    python backfill_artist_names.py --commit  # Actually update database

Features:
    - Batch processing for performance
    - Dry-run mode for validation
    - Progress reporting
    - Rollback on errors
    - Statistics tracking
"""
import asyncio
import asyncpg
import json
import logging
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
import argparse

# Add parent directories to path for imports
script_dir = Path(__file__).parent
project_root = script_dir.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / 'services'))
sys.path.insert(0, str(script_dir))

from common.secrets_manager import get_database_config, validate_secrets

# Import track string parser for artist extraction
try:
    from spiders.utils import parse_track_string
except ImportError:
    try:
        sys.path.insert(0, str(script_dir / 'spiders'))
        from utils import parse_track_string
    except ImportError:
        logger.error("Cannot import parse_track_string - check PYTHONPATH")
        sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ArtistNameBackfiller:
    """Backfills artist_name field in raw_scrape_data"""

    def __init__(self, db_config: Dict[str, Any], dry_run: bool = True):
        """
        Initialize backfiller.

        Args:
            db_config: Database connection parameters
            dry_run: If True, don't commit changes to database
        """
        self.db_config = db_config
        self.dry_run = dry_run
        self.connection_pool: Optional[asyncpg.Pool] = None

        # Statistics
        self.stats = {
            'total_records': 0,
            'already_have_artist': 0,
            'extracted_successfully': 0,
            'extraction_failed': 0,
            'no_source_context': 0,
            'updated': 0,
            'skipped': 0
        }

    async def initialize(self):
        """Initialize database connection pool"""
        connection_string = (
            f"postgresql://{self.db_config['user']}:{self.db_config['password']}"
            f"@{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"
        )

        self.connection_pool = await asyncpg.create_pool(
            connection_string,
            min_size=2,
            max_size=10
        )
        logger.info("✓ Database connection pool initialized")

    async def close(self):
        """Close database connection pool"""
        if self.connection_pool:
            await self.connection_pool.close()
            logger.info("✓ Database connection pool closed")

    async def backfill_all(self, batch_size: int = 1000):
        """
        Backfill artist_name for all EnhancedTrackItem records.

        Args:
            batch_size: Number of records to process per batch
        """
        if not self.connection_pool:
            await self.initialize()

        async with self.connection_pool.acquire() as conn:
            # Count total records needing backfill
            total_count = await conn.fetchval("""
                SELECT COUNT(*)
                FROM raw_scrape_data
                WHERE scrape_type = 'enhancedtrack'
                AND (
                    raw_data->>'artist_name' IS NULL
                    OR raw_data->>'artist_name' = ''
                )
            """)

            self.stats['total_records'] = total_count
            logger.info(f"📊 Found {total_count} EnhancedTrackItem records needing artist_name backfill")

            if total_count == 0:
                logger.info("✅ No records need backfilling!")
                return

            # Process in batches
            offset = 0
            batch_num = 0

            while offset < total_count:
                batch_num += 1
                logger.info(f"\n{'='*60}")
                logger.info(f"Processing batch {batch_num} (offset {offset}/{total_count})")
                logger.info(f"{'='*60}")

                await self._process_batch(conn, batch_size, offset)
                offset += batch_size

                # Progress report
                progress_pct = min(100, (offset / total_count) * 100)
                logger.info(f"Progress: {progress_pct:.1f}% ({offset}/{total_count})")

        # Final statistics
        self._print_statistics()

    async def _process_batch(self, conn, batch_size: int, offset: int):
        """Process a single batch of records"""
        # Fetch batch
        rows = await conn.fetch("""
            SELECT scrape_id, raw_data
            FROM raw_scrape_data
            WHERE scrape_type = 'enhancedtrack'
            AND (
                raw_data->>'artist_name' IS NULL
                OR raw_data->>'artist_name' = ''
            )
            ORDER BY scraped_at
            LIMIT $1 OFFSET $2
        """, batch_size, offset)

        logger.info(f"Fetched {len(rows)} records for processing")

        # Process each record
        updates = []
        for row in rows:
            scrape_id = row['scrape_id']
            raw_data = row['raw_data']

            # Parse if string
            if isinstance(raw_data, str):
                raw_data = json.loads(raw_data)

            # Check if artist_name already exists
            if raw_data.get('artist_name') and raw_data['artist_name'] not in ['', 'Unknown Artist']:
                self.stats['already_have_artist'] += 1
                continue

            # Extract source_context
            source_context = raw_data.get('source_context', '')
            if not source_context:
                self.stats['no_source_context'] += 1
                logger.debug(f"Record {scrape_id} has no source_context, skipping")
                continue

            # Parse artist from source_context
            try:
                parsed = parse_track_string(source_context)

                if parsed and parsed.get('primary_artists'):
                    artist_name = parsed['primary_artists'][0]
                    track_name = parsed['track_name']

                    # Update raw_data
                    raw_data['artist_name'] = artist_name
                    raw_data['track_name'] = track_name  # Also update normalized track name

                    updates.append({
                        'scrape_id': scrape_id,
                        'raw_data': raw_data,
                        'artist_name': artist_name,
                        'track_name': track_name,
                        'source_context': source_context
                    })

                    self.stats['extracted_successfully'] += 1
                    logger.debug(f"✓ Extracted: {artist_name} - {track_name} from '{source_context}'")
                else:
                    self.stats['extraction_failed'] += 1
                    logger.debug(f"✗ Could not extract artist from: '{source_context}'")

            except Exception as e:
                self.stats['extraction_failed'] += 1
                logger.warning(f"Error parsing '{source_context}': {e}")

        # Apply updates to database
        if updates and not self.dry_run:
            await self._apply_updates(conn, updates)
        elif updates and self.dry_run:
            logger.info(f"[DRY RUN] Would update {len(updates)} records")
            # Show sample
            for update in updates[:5]:
                logger.info(
                    f"  [SAMPLE] {update['artist_name']} - {update['track_name']} "
                    f"(from: {update['source_context'][:50]}...)"
                )
            self.stats['skipped'] += len(updates)
        else:
            logger.info("No updates needed for this batch")

    async def _apply_updates(self, conn, updates: List[Dict]):
        """Apply updates to database within a transaction"""
        try:
            async with conn.transaction():
                for update in updates:
                    # Update raw_data JSONB field
                    await conn.execute("""
                        UPDATE raw_scrape_data
                        SET raw_data = $1
                        WHERE scrape_id = $2
                    """, json.dumps(update['raw_data'], default=str), update['scrape_id'])

                self.stats['updated'] += len(updates)
                logger.info(f"✓ Updated {len(updates)} records in database")

        except Exception as e:
            logger.error(f"❌ Error updating batch: {e}")
            raise

    def _print_statistics(self):
        """Print final statistics"""
        logger.info("\n" + "=" * 80)
        logger.info("BACKFILL STATISTICS")
        logger.info("=" * 80)
        logger.info(f"  Total records scanned:        {self.stats['total_records']}")
        logger.info(f"  Already have artist_name:     {self.stats['already_have_artist']}")
        logger.info(f"  No source_context available:  {self.stats['no_source_context']}")
        logger.info(f"  ✅ Extracted successfully:     {self.stats['extracted_successfully']}")
        logger.info(f"  ❌ Extraction failed:           {self.stats['extraction_failed']}")

        if self.dry_run:
            logger.info(f"\n  [DRY RUN] Skipped updates:    {self.stats['skipped']}")
        else:
            logger.info(f"\n  ✓ Database records updated:   {self.stats['updated']}")

        # Calculate success rate
        attempted = self.stats['extracted_successfully'] + self.stats['extraction_failed']
        if attempted > 0:
            success_rate = (self.stats['extracted_successfully'] / attempted) * 100
            logger.info(f"\n  Success rate: {success_rate:.1f}% ({self.stats['extracted_successfully']}/{attempted})")

        logger.info("=" * 80)


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Backfill artist_name field in raw_scrape_data')
    parser.add_argument('--dry-run', action='store_true', default=False,
                        help='Preview changes without committing to database')
    parser.add_argument('--commit', action='store_true', default=False,
                        help='Commit changes to database (opposite of dry-run)')
    parser.add_argument('--batch-size', type=int, default=1000,
                        help='Number of records to process per batch (default: 1000)')
    parser.add_argument('--localhost', action='store_true', default=False,
                        help='Connect to localhost:5433 instead of docker network')

    args = parser.parse_args()

    # Determine dry-run mode
    dry_run = not args.commit  # Default to dry-run unless --commit is specified

    # Validate secrets
    logger.info("Validating database credentials...")
    if not validate_secrets():
        logger.error("❌ Required secrets missing")
        sys.exit(1)

    # Get database config
    if args.localhost:
        db_config = get_database_config(host_override="localhost", port_override=5433)
        logger.info("Connecting to localhost:5433 (host mode)")
    else:
        db_config = get_database_config()
        logger.info("Connecting to postgres:5432 (container mode)")

    # Run backfill
    backfiller = ArtistNameBackfiller(db_config, dry_run=dry_run)

    try:
        if dry_run:
            logger.info("\n🔍 DRY RUN MODE - No changes will be committed")
            logger.info("    Use --commit flag to apply changes\n")

        await backfiller.initialize()
        await backfiller.backfill_all(batch_size=args.batch_size)

        if dry_run:
            logger.info("\n💡 To apply these changes, run with --commit flag")

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        await backfiller.close()


if __name__ == "__main__":
    asyncio.run(main())
