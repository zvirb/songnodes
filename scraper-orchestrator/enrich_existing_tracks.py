"""
Enrich Existing Tracks Script

Processes existing tracks without artist attribution through the enrichment pipeline.
Uses the EnrichmentPipeline's fuzzy matching capabilities to extract and validate artist names.

Usage:
    docker compose exec scraper-orchestrator python enrich_existing_tracks.py --dry-run
    docker compose exec scraper-orchestrator python enrich_existing_tracks.py --commit
"""
import asyncio
import asyncpg
import logging
import sys
from pathlib import Path
from typing import Dict, List, Any
import argparse

# Add paths for imports
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

import os
from pipelines.enrichment_pipeline import EnrichmentPipeline

def get_database_config():
    """Get database config from environment"""
    return {
        'user': os.getenv('POSTGRES_USER', 'musicdb_user'),
        'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass_2024'),
        'host': os.getenv('POSTGRES_HOST', 'postgres'),
        'port': int(os.getenv('POSTGRES_PORT', '5432')),
        'database': os.getenv('POSTGRES_DB', 'musicdb')
    }

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ExistingTracksEnricher:
    """Enriches existing tracks using the enrichment pipeline"""

    def __init__(self, db_config: Dict[str, Any], dry_run: bool = True):
        self.db_config = db_config
        self.dry_run = dry_run
        self.connection_pool = None

        # Initialize enrichment pipeline
        self.pipeline = EnrichmentPipeline()

        # Mock spider for pipeline (required by pipeline interface)
        self.mock_spider = type('MockSpider', (), {'name': 'existing_tracks_enricher'})()

        # Statistics
        self.stats = {
            'total_tracks': 0,
            'tracks_processed': 0,
            'artists_extracted': 0,
            'artists_fuzzy_matched': 0,
            'tracks_updated': 0,
            'errors': 0
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
        logger.info("✅ Database connection pool initialized")

    async def close(self):
        """Close database connection pool"""
        if self.connection_pool:
            await self.connection_pool.close()
            logger.info("✅ Database connection pool closed")

    async def enrich_all(self, limit: int = None):
        """
        Enrich all tracks without artist attribution.

        Args:
            limit: Maximum number of tracks to process (None = all)
        """
        if not self.connection_pool:
            await self.initialize()

        async with self.connection_pool.acquire() as conn:
            # Get tracks needing enrichment
            query = """
            SELECT t.id, t.track_title, t.artist_name
            FROM silver_enriched_tracks t
            WHERE EXISTS (SELECT 1 FROM silver_playlist_tracks spt WHERE spt.track_id = t.id)
              AND (t.artist_name IS NULL OR t.artist_name = '' OR t.artist_name = 'Unknown Artist')
            ORDER BY t.created_at DESC
            """

            if limit:
                query += f" LIMIT {limit}"

            rows = await conn.fetch(query)
            self.stats['total_tracks'] = len(rows)

            logger.info(f"📊 Found {len(rows)} tracks needing artist enrichment")

            if len(rows) == 0:
                logger.info("✅ No tracks need enrichment!")
                return

            # Process each track
            updates = []
            for idx, row in enumerate(rows, 1):
                track_id = row['id']
                track_title = row['track_title']

                logger.info(f"[{idx}/{len(rows)}] Processing: {track_title}")

                try:
                    # Create item dict for pipeline
                    item = {
                        'item_type': 'track',
                        'track_id': str(track_id),
                        'track_title': track_title,
                        'track_name': track_title,
                        'artist_name': row['artist_name'] or ''
                    }

                    # Process through enrichment pipeline
                    enriched_item = self.pipeline.process_item(item, self.mock_spider)

                    # Check if artist was extracted
                    new_artist = enriched_item.get('artist_name', '')
                    if new_artist and new_artist not in ['', 'Unknown Artist']:
                        self.stats['tracks_processed'] += 1
                        self.stats['artists_extracted'] += 1

                        updates.append({
                            'track_id': track_id,
                            'artist_name': new_artist,
                            'original_title': track_title
                        })

                        logger.info(f"  ✓ Extracted: '{new_artist}'")
                    else:
                        logger.debug(f"  ✗ Could not extract artist from: {track_title}")

                except Exception as e:
                    self.stats['errors'] += 1
                    logger.error(f"  ❌ Error processing track {track_id}: {e}")

            # Apply updates to database
            if updates:
                await self._apply_updates(conn, updates)
            else:
                logger.info("No tracks were enriched")

        # Print final statistics
        self._print_statistics()

        # Print pipeline statistics
        logger.info("\n")
        self.pipeline.close_spider(self.mock_spider)

    async def _apply_updates(self, conn, updates: List[Dict]):
        """Apply updates to database"""
        if self.dry_run:
            logger.info(f"\n{'='*80}")
            logger.info("[DRY RUN] Would update the following tracks:")
            logger.info(f"{'='*80}")
            for update in updates[:10]:  # Show first 10
                logger.info(f"  {update['artist_name']} - {update['original_title']}")
            if len(updates) > 10:
                logger.info(f"  ... and {len(updates) - 10} more")
            logger.info(f"{'='*80}")
            self.stats['tracks_updated'] = len(updates)
        else:
            try:
                async with conn.transaction():
                    for update in updates:
                        await conn.execute("""
                            UPDATE silver_enriched_tracks
                            SET artist_name = $1,
                                updated_at = NOW()
                            WHERE id = $2
                        """, update['artist_name'], update['track_id'])

                    self.stats['tracks_updated'] = len(updates)
                    logger.info(f"✅ Updated {len(updates)} tracks in database")

            except Exception as e:
                logger.error(f"❌ Error updating batch: {e}")
                raise

    def _print_statistics(self):
        """Print final statistics"""
        logger.info("\n" + "=" * 80)
        logger.info("ENRICHMENT STATISTICS")
        logger.info("=" * 80)
        logger.info(f"  Total tracks scanned:       {self.stats['total_tracks']}")
        logger.info(f"  Tracks processed:           {self.stats['tracks_processed']}")
        logger.info(f"  ✅ Artists extracted:        {self.stats['artists_extracted']}")
        logger.info(f"  ❌ Errors:                   {self.stats['errors']}")

        if self.dry_run:
            logger.info(f"\n  [DRY RUN] Would update:     {self.stats['tracks_updated']} tracks")
        else:
            logger.info(f"\n  ✓ Database records updated: {self.stats['tracks_updated']}")

        # Calculate success rate
        if self.stats['total_tracks'] > 0:
            success_rate = (self.stats['artists_extracted'] / self.stats['total_tracks']) * 100
            logger.info(f"\n  Success rate: {success_rate:.1f}% ({self.stats['artists_extracted']}/{self.stats['total_tracks']})")

        logger.info("=" * 80)


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Enrich existing tracks without artist attribution')
    parser.add_argument('--dry-run', action='store_true', default=False,
                        help='Preview changes without committing to database')
    parser.add_argument('--commit', action='store_true', default=False,
                        help='Commit changes to database (opposite of dry-run)')
    parser.add_argument('--limit', type=int, default=None,
                        help='Maximum number of tracks to process (default: all)')

    args = parser.parse_args()

    # Determine dry-run mode
    dry_run = not args.commit  # Default to dry-run unless --commit is specified

    # Get database config (container mode - use docker network)
    db_config = get_database_config()
    logger.info(f"Connecting to {db_config['host']}:{db_config['port']} (container mode)")

    # Run enrichment
    enricher = ExistingTracksEnricher(db_config, dry_run=dry_run)

    try:
        if dry_run:
            logger.info("\n🔍 DRY RUN MODE - No changes will be committed")
            logger.info("    Use --commit flag to apply changes\n")

        await enricher.initialize()
        await enricher.enrich_all(limit=args.limit)

        if dry_run:
            logger.info("\n💡 To apply these changes, run with --commit flag")

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        await enricher.close()


if __name__ == "__main__":
    asyncio.run(main())
