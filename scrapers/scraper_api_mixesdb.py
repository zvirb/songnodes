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
            # Extract search query from MixesDB URL
            # URL format: https://www.mixesdb.com/w/Search?search=Artist+Track
            from urllib.parse import urlparse, parse_qs, unquote

            search_query = ""
            if "mixesdb.com" in request.url:
                parsed = urlparse(request.url)
                query_params = parse_qs(parsed.query)
                if 'search' in query_params:
                    search_query = unquote(query_params['search'][0])
                elif 'q' in query_params:
                    search_query = unquote(query_params['q'][0])

            if search_query:
                # Run in URL mode with the search query
                cmd.extend(["-a", "search_mode=url"])
                cmd.extend(["-a", f"search_query={search_query}"])
                logger.info(f"Using search query from URL: {search_query}")
            else:
                # If we can't extract query, use the URL as-is
                cmd.extend(["-a", "search_mode=url"])
                cmd.extend(["-a", f"start_url={request.url}"])
                logger.info(f"Using full URL for scraping: {request.url}")
        else:
            # Run in targeted mode (spider design)
            cmd.extend(["-a", "search_mode=targeted"])
            logger.info("No URL provided, running in targeted mode")

        # Add force run to bypass quota checks
        cmd.extend(["-a", "force_run=true"])

        # Set output file
        output_file = f"/tmp/{task_id}_mixesdb.json"
        cmd.extend(["-o", output_file])

        logger.info(f"Executing command: {' '.join(cmd)}")

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
    uvicorn.run(app, host="0.0.0.0", port=8012)