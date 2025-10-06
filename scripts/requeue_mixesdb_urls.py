#!/usr/bin/env python3
"""
Re-queue all MixesDB URLs affected by the Oct 2-6 XPath bug for re-scraping.
This script queues URLs directly to the scraper service via HTTP API.
"""
import csv
import requests
import time
import logging
import sys
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Scraper API endpoint
SCRAPER_API_URL = "http://localhost:8012/scrape"

def queue_url_for_scraping(url, delay=1.0):
    """Queue a single URL to the MixesDB scraper service."""
    payload = {
        "url": url,
        "task_id": f"backfill_{int(time.time())}_{hash(url)}",
        "force_run": True
    }

    try:
        response = requests.post(SCRAPER_API_URL, json=payload, timeout=10)

        if response.status_code == 200:
            logger.info(f"✅ Queued: {url}")
            return True
        else:
            logger.error(f"❌ Failed ({response.status_code}): {url}")
            return False
    except Exception as e:
        logger.error(f"❌ Error queuing {url}: {e}")
        return False
    finally:
        # Rate limit to avoid overwhelming the scraper
        time.sleep(delay)

def main():
    csv_file = "/mnt/my_external_drive/programming/songnodes/scripts/mixesdb_failed_urls.csv"

    # Check for --yes flag to skip confirmation
    skip_confirm = '--yes' in sys.argv or '-y' in sys.argv

    logger.info("="*80)
    logger.info("MIXESDB URL BACKFILL - XPath Bug Recovery")
    logger.info("="*80)
    logger.info(f"Reading URLs from: {csv_file}")

    urls = []
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            urls.append(row['source_url'])

    total_urls = len(urls)
    logger.info(f"Found {total_urls} URLs to re-scrape")
    logger.info("="*80)

    # Ask for confirmation unless --yes flag is provided
    if not skip_confirm:
        print(f"\n⚠️  This will queue {total_urls} URLs for re-scraping.")
        print(f"⏱️  Estimated time: ~{total_urls * 1.5 / 60:.1f} minutes for queuing")
        print(f"🕐 Actual scraping time: ~{total_urls * 90 / 3600:.1f} hours (90s delay/URL)")

        response = input("\n▶️  Proceed? (yes/no): ")
        if response.lower() != 'yes':
            logger.info("❌ Cancelled by user")
            return
    else:
        logger.info(f"⚠️  Auto-confirmed: Queuing {total_urls} URLs for re-scraping")
        logger.info(f"⏱️  Estimated time: ~{total_urls * 1.5 / 60:.1f} minutes for queuing")
        logger.info(f"🕐 Actual scraping time: ~{total_urls * 90 / 3600:.1f} hours (90s delay/URL)")

    # Queue URLs
    logger.info("\n🚀 Starting URL queuing...")
    logger.info("="*80)

    queued = 0
    failed = 0
    start_time = time.time()

    for i, url in enumerate(urls, 1):
        logger.info(f"[{i}/{total_urls}] Processing...")

        if queue_url_for_scraping(url, delay=1.0):
            queued += 1
        else:
            failed += 1

        # Progress report every 50 URLs
        if i % 50 == 0:
            elapsed = time.time() - start_time
            rate = i / elapsed
            remaining = (total_urls - i) / rate
            logger.info(f"📊 Progress: {i}/{total_urls} ({i/total_urls*100:.1f}%) - "
                       f"ETA: {remaining/60:.1f} min - "
                       f"Success: {queued}, Failed: {failed}")

    # Final summary
    elapsed_total = time.time() - start_time
    logger.info("="*80)
    logger.info("✅ BACKFILL COMPLETE")
    logger.info("="*80)
    logger.info(f"Total URLs: {total_urls}")
    logger.info(f"Successfully queued: {queued}")
    logger.info(f"Failed to queue: {failed}")
    logger.info(f"Time elapsed: {elapsed_total/60:.1f} minutes")
    logger.info(f"Average rate: {total_urls/elapsed_total:.1f} URLs/second")
    logger.info("="*80)
    logger.info(f"🕐 Scraping will complete in ~{total_urls * 90 / 3600:.1f} hours")
    logger.info("📊 Monitor progress: docker compose logs scraper-mixesdb -f")

if __name__ == "__main__":
    main()
