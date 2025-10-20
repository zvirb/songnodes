"""
Silver-to-Gold ETL Scheduler
=============================

Automated scheduler that runs the Silver-to-Gold ETL transformation periodically.

Schedule:
- Runs every 2 hours (configurable via SILVER_TO_GOLD_INTERVAL_HOURS env var)
- Processes 50,000 tracks per cycle (configurable via SILVER_TO_GOLD_BATCH_SIZE)
- Creates artist attribution and track-artist relationships
- Runs 1 minute after raw-data-processor completes its cycle

Architecture Integration:
- Completes the medallion architecture automation chain
- Bronze → Silver (raw-data-processor, 30s interval)
- Silver → Gold (this service, 2h interval, 50K batch size)
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from silver_to_gold_etl import SilverToGoldETL

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def run_etl_cycle(batch_size: int = 1000) -> dict:
    """
    Run a single ETL cycle

    Args:
        batch_size: Number of tracks to process per cycle

    Returns:
        Statistics dictionary from ETL run
    """
    try:
        etl = SilverToGoldETL(dry_run=False)
        stats = await etl.run(limit=batch_size)
        return stats
    except Exception as e:
        logger.error(f"ETL cycle failed: {e}", exc_info=True)
        return {"errors": 1, "silver_tracks_processed": 0}


async def scheduler_loop():
    """
    Main scheduler loop

    Runs the Silver-to-Gold ETL at configured intervals
    """
    # Configuration
    interval_hours = int(os.getenv("SILVER_TO_GOLD_INTERVAL_HOURS", "2"))
    batch_size = int(os.getenv("SILVER_TO_GOLD_BATCH_SIZE", "50000"))
    startup_delay_seconds = int(os.getenv("STARTUP_DELAY_SECONDS", "60"))

    interval_seconds = interval_hours * 3600

    logger.info("="*80)
    logger.info("SILVER-TO-GOLD ETL SCHEDULER STARTED")
    logger.info("="*80)
    logger.info(f"Configuration:")
    logger.info(f"  - Interval: {interval_hours} hours ({interval_seconds}s)")
    logger.info(f"  - Batch size: {batch_size} tracks per cycle")
    logger.info(f"  - Startup delay: {startup_delay_seconds}s")
    logger.info("="*80)

    # Initial startup delay (allows other services to stabilize)
    logger.info(f"Waiting {startup_delay_seconds}s for system stabilization...")
    await asyncio.sleep(startup_delay_seconds)

    cycle_count = 0

    while True:
        try:
            cycle_count += 1
            cycle_start = datetime.now()

            logger.info("="*80)
            logger.info(f"ETL CYCLE #{cycle_count} STARTING")
            logger.info(f"Started at: {cycle_start.isoformat()}")
            logger.info("="*80)

            # Run ETL
            stats = await run_etl_cycle(batch_size=batch_size)

            cycle_duration = (datetime.now() - cycle_start).total_seconds()

            # Log results
            logger.info("="*80)
            logger.info(f"ETL CYCLE #{cycle_count} COMPLETE")
            logger.info(f"Duration: {cycle_duration:.2f}s")
            logger.info(f"Statistics:")
            logger.info(f"  - Silver tracks processed: {stats.get('silver_tracks_processed', 0)}")
            logger.info(f"  - Tracks created: {stats.get('tracks_created', 0)}")
            logger.info(f"  - Tracks updated: {stats.get('tracks_updated', 0)}")
            logger.info(f"  - Artists created: {stats.get('artists_created', 0)}")
            logger.info(f"  - Track-artist relationships: {stats.get('track_artists_created', 0)}")
            logger.info(f"  - Errors: {stats.get('errors', 0)}")

            # Calculate next run time
            next_run = datetime.now() + timedelta(seconds=interval_seconds)
            logger.info(f"Next ETL cycle at: {next_run.isoformat()}")
            logger.info("="*80)

            # Sleep until next cycle
            logger.info(f"Sleeping for {interval_hours} hours until next cycle...")
            await asyncio.sleep(interval_seconds)

        except asyncio.CancelledError:
            logger.info("Scheduler cancelled - shutting down gracefully")
            break
        except Exception as e:
            logger.error(f"Error in scheduler loop: {e}", exc_info=True)
            # On error, wait a shorter interval before retry
            retry_delay = min(interval_seconds, 3600)  # Max 1 hour retry
            logger.info(f"Retrying in {retry_delay}s...")
            await asyncio.sleep(retry_delay)


def main():
    """Main entry point"""
    try:
        asyncio.run(scheduler_loop())
    except KeyboardInterrupt:
        logger.info("Scheduler interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Scheduler failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
