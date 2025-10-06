"""
FastAPI wrapper for MixesDB scraper
Handles both targeted and URL-based scraping modes
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import json
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MixesDB Scraper", version="2.0.0")

class ScrapeRequest(BaseModel):
    url: Optional[str] = None
    params: Optional[Dict[str, Any]] = {}
    task_id: Optional[str] = None
    target_track: Optional[Dict[str, Any]] = None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "mixesdb"}

@app.post("/scrape")
async def scrape_url(request: ScrapeRequest):
    """
    Execute scraping task
    Works in URL mode when URL is provided, otherwise targeted mode
    """
    task_id = request.task_id or f"mixesdb_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    try:
        # Build scrapy command
        cmd = [
            "scrapy", "crawl", "mixesdb",
            "-L", "INFO",
            "-s", "LOG_ENABLED=1"
        ]

        # Determine mode based on URL presence
        if request.url:
            logger.info(f"Processing URL: {request.url}")

            # For MixesDB, URLs come in format: https://www.mixesdb.com/w/Search:Artist
            # Just pass the URL directly to the spider as start_urls
            cmd.extend(["-a", f"start_urls={request.url}"])
            logger.info(f"Using provided URL for scraping: {request.url}")
        else:
            # Run in targeted mode (spider design)
            logger.info("No URL provided, running in targeted mode")

        # Add force run to bypass quota checks
        cmd.extend(["-a", "force_run=true"])

        # DON'T use -o flag - it bypasses the database pipeline!
        # The database pipeline will insert items directly to Postgres
        # We'll create a stats file instead for tracking
        stats_file = f"/tmp/{task_id}_stats.json"

        logger.info(f"Executing command: {' '.join(cmd)}")

        # Run the spider with extended timeout
        # MixesDB has 15s download delay + parsing time, so we need longer timeout
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd="/app",
            timeout=900  # 15 minute timeout to accommodate download delays and parsing
        )

        # Log output for debugging (only first/last portions to avoid log spam)
        if result.stdout:
            logger.info(f"Spider stdout (first 500 chars): {result.stdout[:500]}")
        if result.stderr:
            logger.warning(f"Spider stderr (first 500 chars): {result.stderr[:500]}")
            logger.info(f"Spider stderr (last 1000 chars): {result.stderr[-1000:]}")

        # Check if spider ran successfully
        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or "Unknown error"
            logger.error(f"Scrapy failed with code {result.returncode}: {error_msg}")

            # Don't raise 500 error, return structured response
            return {
                "status": "error",
                "task_id": task_id,
                "error": f"Spider execution failed: {error_msg[:200]}",
                "returncode": result.returncode
            }

        # Parse Scrapy stats from FULL stderr (Scrapy logs to stderr, not stdout!)
        # BUG FIX #1: Stats are at the END of output
        # BUG FIX #2: Scrapy logs go to STDERR, not stdout!
        tracks_count = 0
        items_scraped = 0
        items_processed_db = 0  # From database pipeline stats

        # Combine stdout and stderr for parsing (check both just in case)
        combined_output = (result.stdout or "") + "\n" + (result.stderr or "")

        # Look for stats in FULL combined output
        for line in combined_output.split('\n'):
            if 'item_scraped_count' in line:
                try:
                    # Format: 'item_scraped_count': 123,
                    items_scraped = int(line.split(':')[1].strip().rstrip(','))
                    logger.info(f"✅ Parsed item_scraped_count: {items_scraped}")
                except Exception as e:
                    logger.warning(f"Failed to parse item_scraped_count: {e}")

            # Also extract database pipeline stats (more accurate for actual DB inserts)
            if 'Total items processed:' in line:
                try:
                    # Format: "Total items processed: 153"
                    items_processed_db = int(line.split(':')[1].strip())
                    logger.info(f"✅ Parsed database items processed: {items_processed_db}")
                except Exception as e:
                    logger.warning(f"Failed to parse database items: {e}")

        # Use database pipeline count if available (more accurate), fallback to scrapy stats
        final_count = items_processed_db if items_processed_db > 0 else items_scraped

        return {
            "status": "success",
            "task_id": task_id,
            "url": request.url,
            "mode": "url" if request.url else "targeted",
            "items_processed": final_count,
            "tracks_count": items_scraped,  # Scrapy count (includes all items)
            "db_items": items_processed_db,  # Database pipeline count (actual inserts)
            "message": f"Spider executed, {final_count} items processed ({items_processed_db} via database pipeline, {items_scraped} total scraped)"
        }

    except subprocess.TimeoutExpired:
        logger.error(f"Spider timeout for task {task_id}")
        return {
            "status": "timeout",
            "task_id": task_id,
            "error": "Spider execution timeout after 15 minutes"
        }
    except Exception as e:
        logger.error(f"Error executing spider: {str(e)}")
        return {
            "status": "error",
            "task_id": task_id,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8012)