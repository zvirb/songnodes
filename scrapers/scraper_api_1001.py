"""
FastAPI wrapper for 1001tracklists scraper
Handles targeted scraping mode using target_tracks_for_scraping.json
"""
from fastapi import FastAPI, HTTPException
import subprocess
import json
import os
import logging
from typing import Dict, Any
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="1001Tracklists Scraper", version="2.0.0")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "1001tracklists"}

@app.post("/scrape")
async def scrape_url(request: Dict[str, Any]):
    """
    Execute scraping task in targeted mode using target_tracks_for_scraping.json
    URL parameter is optional and ignored (for orchestrator compatibility)
    """
    task_id = request.get("task_id") or f"1001_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    url = request.get("url")

    try:
        # Build scrapy command - always use targeted mode
        cmd = [
            "scrapy", "crawl", "1001tracklists",
            "-L", "INFO",
            "-s", "LOG_ENABLED=1",
            "-a", "search_mode=targeted",
            "-a", "force_run=true"
        ]

        # Set output file
        output_file = f"/tmp/{task_id}_1001.json"
        cmd.extend(["-o", output_file])

        logger.info(f"Executing command: {' '.join(cmd)}")
        if url:
            logger.info(f"Received URL request: {url}, running in targeted mode")

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

            # Return structured response instead of raising 500
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
            "url": url,
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
    uvicorn.run(app, host="0.0.0.0", port=8011)