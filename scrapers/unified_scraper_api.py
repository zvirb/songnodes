"""
Unified Scraper API - Consolidates all scrapers into a single service

Replaces 12 separate scraper deployments with a single unified service
that can target multiple data sources, significantly reducing resource usage.

Supported sources:
- 1001tracklists
- mixesdb
- setlistfm
- reddit
- bbc_sounds
- internetarchive
- livetracklist
- mixcloud
- soundcloud
- youtube
- residentadvisor
"""

from __future__ import annotations

import asyncio
import logging
import os
import shlex
import time
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Unified Scraper Service", version="1.0.0")

# Prometheus metrics
scrape_requests_total = Counter(
    "unified_scraper_requests_total",
    "Total scrape requests",
    ["source", "status"],
)

scrape_duration_seconds = Histogram(
    "unified_scraper_duration_seconds",
    "Scrape request duration",
    ["source", "status"],
    buckets=[1, 5, 15, 30, 60, 120, 300, 600, 900],
)

items_scraped_total = Counter(
    "unified_scraper_items_total",
    "Total items scraped",
    ["source"],
)

# Spider name mapping
SPIDER_MAP = {
    "1001tracklists": "1001tracklists",
    "mixesdb": "mixesdb",
    "setlistfm": "setlistfm",
    "reddit": "reddit",
    "bbc_sounds": "bbc_sounds_rave_forever",
    "internetarchive": "generic_archive",
    "livetracklist": "watchthedj",
    "mixcloud": "generic_archive",
    "soundcloud": "generic_archive",
    "youtube": "generic_archive",
    "residentadvisor": "generic_archive",
}


class ScrapeRequest(BaseModel):
    """Request payload for triggering a spider."""

    source: str  # e.g., "mixesdb", "1001tracklists", "bbc_sounds"
    url: Optional[str] = None
    start_urls: Optional[str] = None  # Direct URL(s) for spider
    params: Dict[str, Any] = {}
    task_id: Optional[str] = None
    max_pages: Optional[int] = None
    artist_name: Optional[str] = None
    search_query: Optional[str] = None  # For mixesdb: "Artist - Track Title"
    limit: Optional[int] = None


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health probe for Kubernetes."""
    return {
        "status": "healthy",
        "service": "unified_scraper",
        "supported_sources": list(SPIDER_MAP.keys()),
    }


@app.get("/metrics")
async def metrics() -> Response:
    """Expose Prometheus metrics."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/sources")
async def list_sources() -> Dict[str, Any]:
    """List all supported scraper sources."""
    return {
        "sources": list(SPIDER_MAP.keys()),
        "total_count": len(SPIDER_MAP),
    }


async def _run_spider(cmd: list[str], timeout: int = 900) -> Dict[str, Any]:
    """Execute the scrapy command asynchronously."""
    logger.info("Executing command: %s", " ".join(shlex.quote(c) for c in cmd))

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd="/app",
    )

    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            process.communicate(), timeout=timeout
        )
    except asyncio.TimeoutError:
        process.kill()
        await process.communicate()
        return {
            "status": "timeout",
            "returncode": None,
            "stdout": "",
            "stderr": f"Spider timeout after {timeout} seconds",
        }

    stdout_text = stdout_bytes.decode("utf-8", errors="ignore") if stdout_bytes else ""
    stderr_text = stderr_bytes.decode("utf-8", errors="ignore") if stderr_bytes else ""

    return {
        "status": "success" if process.returncode == 0 else "error",
        "returncode": process.returncode,
        "stdout": stdout_text,
        "stderr": stderr_text,
    }


def _extract_stats(stdout: str, stderr: str) -> Dict[str, int]:
    """Parse scrapy log output for item counters."""
    combined = f"{stdout}\n{stderr}"
    item_scraped = 0
    db_items = 0

    for line in combined.splitlines():
        if "item_scraped_count" in line:
            try:
                item_scraped = int(line.split(":")[1].strip().rstrip(","))
            except (IndexError, ValueError):
                continue
        if "Total items processed:" in line:
            try:
                db_items = int(line.split(":")[1].strip())
            except (IndexError, ValueError):
                continue

    return {
        "items_scraped": item_scraped,
        "items_processed": db_items if db_items > 0 else item_scraped,
    }


async def _scrape_internal(request: ScrapeRequest) -> Dict[str, Any]:
    """
    Internal scraping logic extracted for timeout wrapper.
    """
    # Validate source
    if request.source not in SPIDER_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown source '{request.source}'. Supported: {list(SPIDER_MAP.keys())}",
        )

    spider_name = SPIDER_MAP[request.source]
    task_id = request.task_id or f"{request.source}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    start_time = time.time()
    status_label = "error"

    # Build scrapy command
    cmd = [
        "scrapy",
        "crawl",
        spider_name,
        "-L",
        "INFO",
        "-s",
        "LOG_ENABLED=1",
    ]

    # Add source-specific parameters
    if request.source == "mixesdb":
        logger.info(
            "MixesDB spider parameters: start_urls=%s, search_query=%s, artist_name=%s, limit=%s",
            request.start_urls,
            request.search_query,
            request.artist_name,
            request.limit
        )
        if request.start_urls:
            # Direct URL scraping (for testing specific mix pages)
            cmd.extend(["-a", f"start_urls={request.start_urls}"])
            logger.info("Added start_urls parameter: %s", request.start_urls)
        elif request.search_query:
            # Use search_query if provided (preferred)
            cmd.extend(["-a", f"search_query={request.search_query}"])
            logger.info("Added search_query parameter: %s", request.search_query)
        elif request.artist_name:
            # Fall back to artist_name for backward compatibility
            cmd.extend(["-a", f"search_query={request.artist_name}"])
            logger.info("Added artist_name as search_query parameter: %s", request.artist_name)
        else:
            logger.warning("No search parameters provided for mixesdb spider!")
        if request.limit:
            # Note: mixesdb spider doesn't currently use limit parameter
            # It uses MIXESDB_MAX_RESULTS_PER_SEARCH env var instead
            cmd.extend(["-a", f"limit={request.limit}"])
            logger.info("Added limit parameter: %s", request.limit)

    elif request.source == "bbc_sounds":
        if request.max_pages:
            cmd.extend(["-a", f"max_pages={request.max_pages}"])
        if request.url:
            cmd.extend(["-a", f"episode_url={request.url}"])

    elif request.source == "1001tracklists":
        if request.url:
            cmd.extend(["-a", f"start_urls={request.url}"])

    elif request.source in ["setlistfm", "reddit"]:
        if request.artist_name:
            cmd.extend(["-a", f"artist_name={request.artist_name}"])
        if request.limit:
            cmd.extend(["-a", f"limit={request.limit}"])

    # Add generic parameters from params dict
    for key, value in (request.params or {}).items():
        if value is not None:
            cmd.extend(["-a", f"{key}={value}"])

    # Execute spider
    result = await _run_spider(cmd)
    duration = time.time() - start_time

    # Handle timeout
    if result["status"] == "timeout":
        scrape_requests_total.labels(source=request.source, status="timeout").inc()
        scrape_duration_seconds.labels(source=request.source, status="timeout").observe(
            duration
        )
        return {
            "status": "timeout",
            "source": request.source,
            "task_id": task_id,
            "error": result["stderr"],
        }

    stdout = result.get("stdout", "")
    stderr = result.get("stderr", "")

    # Handle error
    if result.get("returncode") != 0:
        scrape_requests_total.labels(source=request.source, status="error").inc()
        scrape_duration_seconds.labels(source=request.source, status="error").observe(
            duration
        )
        logger.error(
            "Spider execution failed: source=%s, returncode=%s, stderr=%s",
            request.source,
            result.get("returncode"),
            stderr[:500],
        )
        return {
            "status": "error",
            "source": request.source,
            "task_id": task_id,
            "returncode": result.get("returncode"),
            "error": stderr[:500] or stdout[:500] or "Spider execution failed",
        }

    # Success
    stats = _extract_stats(stdout, stderr)
    status_label = "success"

    scrape_requests_total.labels(source=request.source, status=status_label).inc()
    scrape_duration_seconds.labels(source=request.source, status=status_label).observe(
        duration
    )
    items_scraped_total.labels(source=request.source).inc(stats["items_processed"])

    logger.info(
        "Spider completed: source=%s, duration_seconds=%s, items_processed=%s",
        request.source,
        f"{duration:.2f}",
        stats["items_processed"],
    )

    return {
        "status": "success",
        "source": request.source,
        "task_id": task_id,
        "url": request.url,
        "items_processed": stats["items_processed"],
        "items_scraped": stats["items_scraped"],
        "duration_seconds": round(duration, 2),
    }


@app.post("/scrape")
async def scrape(request: ScrapeRequest) -> Dict[str, Any]:
    """
    Execute scraping task for the specified source with 5-minute timeout.

    Examples:
        # Scrape MixesDB for artist
        POST /scrape {"source": "mixesdb", "artist_name": "Deadmau5", "limit": 5}

        # Scrape BBC Sounds
        POST /scrape {"source": "bbc_sounds", "max_pages": 1}

        # Scrape 1001tracklists with URL
        POST /scrape {"source": "1001tracklists", "url": "https://..."}
    """
    # Wrap entire scraping operation with 15-minute (900s) timeout
    try:
        result = await asyncio.wait_for(
            _scrape_internal(request),
            timeout=900.0  # 15 minutes - matches spider timeout
        )
        return result
    except asyncio.TimeoutError:
        logger.error(
            "Scrape request timeout: source=%s, exceeded 900 seconds",
            request.source
        )
        scrape_requests_total.labels(source=request.source, status="timeout").inc()
        raise HTTPException(
            status_code=504,
            detail=f"Scrape request timeout after 900 seconds for source '{request.source}'"
        )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
