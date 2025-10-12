# ============================================================================
# LEGACY FILE - NOT USED IN PRODUCTION
# ============================================================================
# This file is part of the legacy scraper_api_* family which is NOT used in
# docker-compose.yml. These files have been superseded by modern Scrapy-based
# spiders in the spiders/ directory.
#
# Retained for historical reference and potential future migration.
# See: /mnt/my_external_drive/programming/songnodes/scrapers/LEGACY_SCRAPERS_README.md
# ============================================================================
"""
FastAPI wrapper for MixesDB scraper
Handles both targeted and URL-based scraping modes

LEGACY: This file is not actively used. See Scrapy spiders in spiders/ directory.
"""
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
import asyncio
import json
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from monitoring_metrics import track_item_creation, track_schema_error, record_successful_scrape

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

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

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

        # Run the spider with extended timeout using async subprocess
        # MixesDB has 15s download delay + parsing time, so we need longer timeout
        # Using async subprocess allows health checks to respond during scraping
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd="/app"
            )

            # Wait for completion with timeout (15 minutes)
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(),
                timeout=900
            )

            # Decode output
            result_stdout = stdout_bytes.decode('utf-8') if stdout_bytes else ""
            result_stderr = stderr_bytes.decode('utf-8') if stderr_bytes else ""
            result_returncode = process.returncode

        except asyncio.TimeoutError:
            logger.error(f"Spider timeout for task {task_id}")
            # Track timeout error
            track_schema_error('mixesdb', 'spider_timeout', 'EnhancedTrackItem')
            return {
                "status": "timeout",
                "task_id": task_id,
                "error": "Spider execution timeout after 15 minutes"
            }

        # Log output for debugging (only first/last portions to avoid log spam)
        if result_stdout:
            logger.info(f"Spider stdout (first 500 chars): {result_stdout[:500]}")
        if result_stderr:
            logger.warning(f"Spider stderr (first 500 chars): {result_stderr[:500]}")
            logger.info(f"Spider stderr (last 1000 chars): {result_stderr[-1000:]}")

        # Check if spider ran successfully
        if result_returncode != 0:
            error_msg = result_stderr or result_stdout or "Unknown error"
            logger.error(f"Scrapy failed with code {result_returncode}: {error_msg}")

            # Track spider execution error
            track_schema_error('mixesdb', 'spider_execution_failed', 'EnhancedTrackItem')

            # Don't raise 500 error, return structured response
            return {
                "status": "error",
                "task_id": task_id,
                "error": f"Spider execution failed: {error_msg[:200]}",
                "returncode": result_returncode
            }

        # Parse Scrapy stats from FULL stderr (Scrapy logs to stderr, not stdout!)
        # BUG FIX #1: Stats are at the END of output
        # BUG FIX #2: Scrapy logs go to STDERR, not stdout!
        tracks_count = 0
        items_scraped = 0
        items_processed_db = 0  # From database pipeline stats

        # Combine stdout and stderr for parsing (check both just in case)
        combined_output = (result_stdout or "") + "\n" + (result_stderr or "")

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

        # Track metrics for successfully scraped items
        for _ in range(final_count):
            track_item_creation('mixesdb', 'EnhancedTrackItem', 'mixesdb.com')

        # Record successful scrape timestamp
        if final_count > 0:
            record_successful_scrape('mixesdb')

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

    except Exception as e:
        logger.error(f"Error executing spider: {str(e)}")
        # Track general exception
        track_schema_error('mixesdb', 'general_exception', 'EnhancedTrackItem')
        return {
            "status": "error",
            "task_id": task_id,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8012)