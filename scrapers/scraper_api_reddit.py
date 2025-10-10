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
FastAPI wrapper for Reddit scraper
Handles both targeted and URL-based scraping modes

LEGACY: This file is not actively used. See Scrapy spiders in spiders/ directory.
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

app = FastAPI(title="Reddit Scraper", version="2.0.0")

class ScrapeRequest(BaseModel):
    url: Optional[str] = None
    params: Optional[Dict[str, Any]] = {}
    task_id: Optional[str] = None
    target_track: Optional[Dict[str, Any]] = None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "reddit"}

@app.post("/scrape")
async def scrape_url(request: ScrapeRequest):
    """
    Execute scraping task
    Works in targeted mode using target_tracks_for_scraping.json
    """
    task_id = request.task_id or f"reddit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    try:
        # Build scrapy command
        cmd = [
            "scrapy", "crawl", "reddit",
            "-L", "INFO",
            "-s", "LOG_ENABLED=1"
        ]

        # Always run in targeted mode (spider design)
        cmd.extend(["-a", "search_mode=targeted"])

        # Add force run to bypass quota checks
        cmd.extend(["-a", "force_run=true"])

        # Set output file
        output_file = f"/tmp/{task_id}_reddit.json"
        cmd.extend(["-o", output_file])

        logger.info(f"Executing command: {' '.join(cmd)}")
        if request.url:
            logger.info(f"Received URL request: {request.url}, running in targeted mode")

        # Run the spider
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd="/app",
            timeout=300  # 5 minute timeout
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

        return {
            "status": "success",
            "task_id": task_id,
            "url": request.url,
            "mode": "targeted",
            "output_file": output_file if output_exists else None,
            "output_size": output_size,
            "message": "Spider executed in targeted mode using target_tracks_for_scraping.json"
        }

    except subprocess.TimeoutExpired:
        logger.error(f"Spider timeout for task {task_id}")
        return {
            "status": "timeout",
            "task_id": task_id,
            "error": "Spider execution timeout after 5 minutes"
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
    uvicorn.run(app, host="0.0.0.0", port=8014)