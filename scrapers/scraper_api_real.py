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
FastAPI wrapper for 1001Tracklists scraper
Handles both targeted and URL-based scraping modes

LEGACY: This file is not actively used. See Scrapy spiders in spiders/ directory.
"""
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, Histogram
import subprocess
import json
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="1001Tracklists Scraper", version="2.0.0")

# Prometheus metrics
scrape_requests_total = Counter(
    'scraper_1001tl_requests_total',
    'Total scrape requests',
    ['status']
)

scrape_duration_seconds = Histogram(
    'scraper_1001tl_duration_seconds',
    'Scrape request duration',
    ['status'],
    buckets=[1, 5, 10, 30, 60, 120, 300, 600]
)

items_scraped_total = Counter(
    'scraper_1001tl_items_total',
    'Total items scraped',
    ['mode']
)

class ScrapeRequest(BaseModel):
    url: Optional[str] = None
    params: Optional[Dict[str, Any]] = {}
    task_id: Optional[str] = None
    target_track: Optional[Dict[str, Any]] = None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "1001tracklists"}

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
    task_id = request.task_id or f"1001tl_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    start_time = time.time()
    status = "error"

    try:
        # Build scrapy command
        cmd = [
            "scrapy", "crawl", "1001tracklists",
            "-L", "INFO",
            "-s", "LOG_ENABLED=1"
        ]

        # Determine mode based on URL presence
        if request.url:
            logger.info(f"URL provided: {request.url}")
            # If it's a search URL, extract the query and use targeted mode
            # If it's a tracklist URL, pass it as start_urls
            if '/search' in request.url or 'main_search' in request.url:
                logger.info("Search URL detected - using targeted mode to scrape search results")
                cmd.extend(["-a", "search_mode=targeted"])
                # Extract search query from URL if possible
                import urllib.parse
                parsed = urllib.parse.urlparse(request.url)
                params = urllib.parse.parse_qs(parsed.query)
                search_query = params.get('main_search', params.get('q', ['']))[0]
                if search_query:
                    logger.info(f"Search query extracted: {search_query}")
                    cmd.extend(["-a", f"search_query={search_query}"])
            elif '/tracklist/' in request.url:
                logger.info("Direct tracklist URL - using start_urls parameter")
                cmd.extend(["-a", f"start_urls={request.url}"])
                cmd.extend(["-a", "search_mode=targeted"])
            else:
                # For DJ profile URLs or other pages, use discovery on that specific page
                logger.info("Using targeted mode with custom start URL")
                cmd.extend(["-a", f"start_urls={request.url}"])
                cmd.extend(["-a", "search_mode=discovery"])
        else:
            # Run in targeted mode (spider's default behavior)
            # This requires target tracks to be in the database
            cmd.extend(["-a", "search_mode=targeted"])
            logger.info("No URL provided, running in targeted mode")

        # Add force run to bypass quota checks
        cmd.extend(["-a", "force_run=true"])

        # Set output file
        output_file = f"/tmp/{task_id}_1001tl.json"
        cmd.extend(["-o", output_file])

        logger.info(f"Executing command: {' '.join(cmd)}")

        # Timeout: Use env var for manual CAPTCHA solving (default 30 min for non-headless mode)
        headless = os.getenv('TRACKLISTS_1001_HEADLESS', 'True').lower() == 'true'
        default_timeout = 300 if headless else 1800  # 5 min headless, 30 min with GUI
        timeout_seconds = int(os.getenv('SCRAPER_TIMEOUT', default_timeout))

        # Run the spider
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd="/app",
            timeout=timeout_seconds
        )

        # Log output for debugging
        if result.stdout:
            logger.info(f"Spider stdout: {result.stdout[:500]}")
        if result.stderr:
            logger.warning(f"Spider stderr: {result.stderr[:500]}")

        # Check if spider ran successfully
        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or "Unknown error"
            logger.error(f"Scrapy failed with code {result.returncode}: {error_msg}")

            # Track error metrics
            duration = time.time() - start_time
            scrape_requests_total.labels(status='error').inc()
            scrape_duration_seconds.labels(status='error').observe(duration)

            # Don't raise 500 error, return structured response
            return {
                "status": "error",
                "task_id": task_id,
                "error": f"Spider execution failed: {error_msg[:200]}",
                "returncode": result.returncode
            }

        # Check if output file was created
        output_exists = os.path.exists(output_file)
        output_size = os.path.getsize(output_file) if output_exists else 0

        # Count items if output file exists
        items_count = 0
        if output_exists and output_size > 0:
            try:
                with open(output_file, 'r') as f:
                    data = json.load(f)
                    items_count = len(data) if isinstance(data, list) else 1
                    items_scraped_total.labels(mode='targeted').inc(items_count)
            except Exception as e:
                logger.warning(f"Could not count items in output file: {e}")

        # Track success metrics
        status = "success"
        duration = time.time() - start_time
        scrape_requests_total.labels(status='success').inc()
        scrape_duration_seconds.labels(status='success').observe(duration)

        return {
            "status": "success",
            "task_id": task_id,
            "url": request.url,
            "mode": "targeted",
            "output_file": output_file if output_exists else None,
            "output_size": output_size,
            "items_count": items_count,
            "message": "Spider executed successfully with proper artist extraction"
        }

    except subprocess.TimeoutExpired:
        logger.error(f"Spider timeout for task {task_id}")
        duration = time.time() - start_time
        scrape_requests_total.labels(status='timeout').inc()
        scrape_duration_seconds.labels(status='timeout').observe(duration)
        return {
            "status": "timeout",
            "task_id": task_id,
            "error": "Spider execution timeout after 5 minutes"
        }
    except Exception as e:
        logger.error(f"Error executing spider: {str(e)}")
        duration = time.time() - start_time
        scrape_requests_total.labels(status='error').inc()
        scrape_duration_seconds.labels(status='error').observe(duration)
        return {
            "status": "error",
            "task_id": task_id,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)