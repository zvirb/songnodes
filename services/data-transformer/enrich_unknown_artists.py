"""
Enrich Unknown Artist tracks using the metadata-enrichment service.

This script finds tracks with "Unknown Artist" in the Silver layer and
enriches them via the existing metadata-enrichment service API, which
queries Spotify/MusicBrainz by track title only.

Usage:
    python enrich_unknown_artists.py --limit 100
    python enrich_unknown_artists.py --dry-run --limit 10
"""

import asyncio
import asyncpg
import aiohttp
import logging
import sys
import os
import argparse
from typing import Optional, Dict, Any, List
from datetime import datetime

# Add common directory to path for secrets manager
sys.path.insert(0, '/app/common')
try:
    from secrets_manager import get_database_config
    SECRETS_AVAILABLE = True
except ImportError:
    SECRETS_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UnknownArtistEnricher:
    """Enriches Unknown Artist tracks via metadata-enrichment service"""

    def __init__(self, dry_run: bool = False, enrichment_url: str = "http://metadata-enrichment:8020"):
        self.dry_run = dry_run
        self.enrichment_url = enrichment_url
        self.pool: Optional[asyncpg.Pool] = None
        self.http_session: Optional[aiohttp.ClientSession] = None
        self.stats = {
            'tracks_processed': 0,
            'enrichments_attempted': 0,
            'enrichments_successful': 0,
            'enrichments_partial': 0,
            'enrichments_failed': 0,
            'tracks_updated': 0,
            'errors': 0
        }

    async def connect(self):
        """Initialize database connection pool"""
        if SECRETS_AVAILABLE:
            db_config = get_database_config()
            logger.info("✅ Using centralized secrets manager for database configuration")
        else:
            db_config = {
                'host': os.getenv('POSTGRES_HOST', 'db-connection-pool'),
                'port': int(os.getenv('POSTGRES_PORT', '6432')),
                'database': os.getenv('POSTGRES_DB', 'musicdb'),
                'user': os.getenv('POSTGRES_USER', 'musicdb_user'),
                'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass_2024')
            }
            logger.info("⚠️ Secrets manager not available - using environment variables")

        self.pool = await asyncpg.create_pool(
            host=db_config['host'],
            port=db_config['port'],
            database=db_config['database'],
            user=db_config['user'],
            password=db_config['password'],
            min_size=5,
            max_size=20,
            command_timeout=60
        )

        self.http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=120)
        )

        logger.info("✅ Connections initialized")

    async def close(self):
        """Close connections"""
        if self.http_session:
            await self.http_session.close()
        if self.pool:
            await self.pool.close()
        logger.info("✅ Connections closed")

    async def enrich_track(
        self,
        track_id: str,
        track_title: str,
        artist_hint: str = "Unknown Artist"
    ) -> Optional[Dict[str, Any]]:
        """
        Enrich a single track via metadata-enrichment service.

        Args:
            track_id: Track UUID
            track_title: Track title
            artist_hint: Artist hint (default "Unknown Artist")

        Returns:
            Enrichment result dict or None if failed
        """
        try:
            # Call enrichment service
            payload = {
                "track_id": track_id,
                "artist_name": artist_hint,
                "track_title": track_title,
                "priority": 10,  # High priority for manual enrichment
                "force_refresh": False
            }

            async with self.http_session.post(
                f"{self.enrichment_url}/enrich",
                json=payload
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.debug(f"Enrichment result for '{track_title}': {result['status']}")
                    return result
                else:
                    error_text = await response.text()
                    logger.error(f"Enrichment failed for '{track_title}': {response.status} - {error_text}")
                    return None

        except Exception as e:
            logger.error(f"Error enriching track '{track_title}': {e}")
            return None

    async def update_track_metadata(
        self,
        conn: asyncpg.Connection,
        track_id: str,
        enrichment_result: Dict[str, Any]
    ) -> bool:
        """
        Update Silver layer track with enrichment results.

        Args:
            conn: Database connection
            track_id: Track UUID
            enrichment_result: Enrichment service response

        Returns:
            True if updated successfully
        """
        try:
            metadata = enrichment_result.get('metadata_acquired', {})

            # Extract artist name from Spotify ID or other sources
            # The enrichment service should have found the artist
            if 'artist_name' not in metadata and 'spotify_id' not in metadata:
                logger.warning(f"No artist found for track {track_id}")
                return False

            # Build update fields
            set_clauses = []
            params = []
            param_num = 1

            # Update artist_name if found
            if 'artist_name' in metadata and metadata['artist_name']:
                set_clauses.append(f"artist_name = ${param_num}")
                params.append(metadata['artist_name'])
                param_num += 1

            # Update other metadata fields
            if 'spotify_id' in metadata and metadata['spotify_id']:
                set_clauses.append(f"spotify_id = ${param_num}")
                params.append(metadata['spotify_id'])
                param_num += 1

            if 'isrc' in metadata and metadata['isrc']:
                set_clauses.append(f"isrc = ${param_num}")
                params.append(metadata['isrc'])
                param_num += 1

            if 'bpm' in metadata and metadata['bpm']:
                set_clauses.append(f"bpm = ${param_num}")
                params.append(metadata['bpm'])
                param_num += 1

            if 'key' in metadata and metadata['key']:
                set_clauses.append(f"key = ${param_num}")
                params.append(metadata['key'])
                param_num += 1

            if 'genre' in metadata and metadata['genre']:
                set_clauses.append(f"genre = ${param_num}")
                params.append([metadata['genre']] if isinstance(metadata['genre'], str) else metadata['genre'])
                param_num += 1

            if not set_clauses:
                logger.warning(f"No metadata to update for track {track_id}")
                return False

            # Add updated_at timestamp
            set_clauses.append("updated_at = NOW()")

            # Execute update
            query = f"""
                UPDATE silver_enriched_tracks
                SET {', '.join(set_clauses)}
                WHERE id::text = ${param_num}
                RETURNING id, artist_name, track_title
            """
            params.append(track_id)

            if self.dry_run:
                logger.info(f"[DRY RUN] Would update track {track_id} with: {metadata}")
                return True

            row = await conn.fetchrow(query, *params)

            if row:
                logger.info(f"✅ Updated track: {row['artist_name']} - {row['track_title']}")
                return True
            else:
                logger.warning(f"Track {track_id} not found in Silver layer")
                return False

        except Exception as e:
            logger.error(f"Error updating track {track_id}: {e}")
            return False

    async def run(self, limit: Optional[int] = None):
        """
        Run the enrichment process.

        Args:
            limit: Maximum number of tracks to process (None = all)
        """
        start_time = datetime.now()
        logger.info("="*80)
        logger.info("UNKNOWN ARTIST ENRICHMENT PROCESS STARTING")
        logger.info("="*80)

        if self.dry_run:
            logger.warning("🔍 DRY RUN MODE - No database writes will be performed")

        await self.connect()

        try:
            async with self.pool.acquire() as conn:
                # Query Unknown Artist tracks
                query = """
                    SELECT id, track_title, artist_name
                    FROM silver_enriched_tracks
                    WHERE validation_status = 'valid'
                      AND artist_name = 'Unknown Artist'
                    ORDER BY created_at DESC
                """

                if limit:
                    query += f" LIMIT {limit}"

                logger.info(f"Querying Unknown Artist tracks (limit={limit or 'none'})...")
                tracks = await conn.fetch(query)
                total_tracks = len(tracks)

                logger.info(f"Found {total_tracks} Unknown Artist tracks to enrich")

                if total_tracks == 0:
                    logger.warning("No Unknown Artist tracks found!")
                    return

                # Process tracks
                for idx, track in enumerate(tracks, 1):
                    track_id = str(track['id'])
                    track_title = track['track_title']

                    logger.info(f"[{idx}/{total_tracks}] Processing: {track_title}")

                    self.stats['tracks_processed'] += 1

                    # Enrich track
                    self.stats['enrichments_attempted'] += 1
                    result = await self.enrich_track(track_id, track_title)

                    if not result:
                        self.stats['enrichments_failed'] += 1
                        self.stats['errors'] += 1
                        continue

                    status = result.get('status', 'failed')

                    if status == 'completed':
                        self.stats['enrichments_successful'] += 1
                    elif status == 'partial':
                        self.stats['enrichments_partial'] += 1
                    else:
                        self.stats['enrichments_failed'] += 1

                    # Update Silver layer if enrichment found artist
                    if status in ['completed', 'partial']:
                        async with conn.transaction():
                            if await self.update_track_metadata(conn, track_id, result):
                                self.stats['tracks_updated'] += 1

                    # Rate limiting
                    if idx % 10 == 0:
                        logger.info(
                            f"Progress: {idx}/{total_tracks} tracks, "
                            f"{self.stats['tracks_updated']} updated"
                        )
                        await asyncio.sleep(2)  # Respect rate limits

        finally:
            await self.close()

        # Report statistics
        duration = (datetime.now() - start_time).total_seconds()

        logger.info("="*80)
        logger.info("UNKNOWN ARTIST ENRICHMENT PROCESS COMPLETE")
        logger.info("="*80)
        logger.info(f"Duration: {duration:.2f}s")
        logger.info(f"Tracks processed: {self.stats['tracks_processed']}")
        logger.info(f"Enrichments attempted: {self.stats['enrichments_attempted']}")
        logger.info(f"Enrichments successful: {self.stats['enrichments_successful']}")
        logger.info(f"Enrichments partial: {self.stats['enrichments_partial']}")
        logger.info(f"Enrichments failed: {self.stats['enrichments_failed']}")
        logger.info(f"Tracks updated: {self.stats['tracks_updated']}")
        logger.info(f"Errors: {self.stats['errors']}")

        if self.stats['tracks_processed'] > 0:
            success_rate = (self.stats['tracks_updated'] / self.stats['tracks_processed']) * 100
            logger.info(f"Success rate: {success_rate:.1f}%")

        logger.info("="*80)

        return self.stats


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Enrich Unknown Artist tracks")
    parser.add_argument('--limit', type=int, help="Maximum number of tracks to process")
    parser.add_argument('--dry-run', action='store_true', help="Run without writing to database")
    parser.add_argument('--enrichment-url', default="http://metadata-enrichment:8020", help="Metadata enrichment service URL")
    args = parser.parse_args()

    enricher = UnknownArtistEnricher(
        dry_run=args.dry_run,
        enrichment_url=args.enrichment_url
    )

    try:
        stats = await enricher.run(limit=args.limit)

        # Exit with error code if there were errors
        if stats['errors'] > 0:
            logger.error(f"Enrichment completed with {stats['errors']} errors")
            sys.exit(1)

        logger.info("✅ Enrichment completed successfully")
        sys.exit(0)

    except KeyboardInterrupt:
        logger.warning("Enrichment interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Enrichment failed with exception: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
