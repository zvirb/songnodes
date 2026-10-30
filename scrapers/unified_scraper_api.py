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

# Generic archive config mapping - maps source to YAML config file name
# Config files are in parser_configs/ directory
GENERIC_ARCHIVE_CONFIGS = {
    "internetarchive": "archive_org_etree",
    "mixcloud": "mixcloud",
    "soundcloud": "soundcloud",
    "youtube": "youtube",
    "residentadvisor": "residentadvisor",
}

# Sources that are listed but not yet implemented
NOT_IMPLEMENTED_SOURCES = {
    # All generic archive sources now have parser configs
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
    """List all supported scraper sources with implementation status."""
    implemented = [s for s in SPIDER_MAP.keys() if s not in NOT_IMPLEMENTED_SOURCES]
    not_implemented = list(NOT_IMPLEMENTED_SOURCES.keys())
    return {
        "sources": list(SPIDER_MAP.keys()),
        "implemented": implemented,
        "not_implemented": not_implemented,
        "total_count": len(SPIDER_MAP),
        "implemented_count": len(implemented),
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

    # Debug: Log lengths and returncode
    logger.info(f"Process completed: returncode={process.returncode}, stdout_len={len(stdout_text)}, stderr_len={len(stderr_text)}")

    # Log subprocess output for debugging
    if stdout_text:
        logger.info("=" * 80)
        logger.info("SCRAPY STDOUT:")
        logger.info("=" * 80)
        for line in stdout_text.splitlines():
            logger.info(line)
        logger.info("=" * 80)

    if stderr_text:
        logger.warning("=" * 80)
        logger.warning("SCRAPY STDERR:")
        logger.warning("=" * 80)
        for line in stderr_text.splitlines():
            logger.warning(line)
        logger.warning("=" * 80)

    return {
        "status": "success" if process.returncode == 0 else "error",
        "returncode": process.returncode,
        "stdout": stdout_text,
        "stderr": stderr_text,
    }


def _extract_stats(stdout: str, stderr: str) -> Dict[str, int]:
    """
    Parse scrapy log output for item counters.

    Headline counts are per job and per bronze table:
    - bronze_playlists_persisted / bronze_tracks_persisted: rows the bronze inserts returned,
      summed over the "Inserted N ... to bronze layer" line of every batch.
    - bronze_playlists_queued / bronze_tracks_queued: rows the pipeline queued for bronze
      (its close summary), so a shortfall compares like with like.
    Also returned, not comparable with either:
    - items_yielded: every item the spider yielded, of all kinds (scrapy item_scraped_count).
    - pipeline_records_written: rows written across all tables (bronze, silver, artists,
      adjacency), a mixed total and not a playlist or track count.
    """
    combined = f"{stdout}\n{stderr}"
    items_yielded = 0  # Items yielded by spider (from scrapy's item_scraped_count)
    pipeline_records_written = 0  # Rows written across all tables (mixed record types)
    bronze_playlists_persisted = 0  # Bronze playlists actually written
    bronze_tracks_persisted = 0  # Bronze tracks actually written
    bronze_queued = {"playlists": 0, "tracks": 0}  # Rows the pipeline queued for bronze

    for line in combined.splitlines():
        # Extract scrapy's item_scraped_count (items yielded by spider)
        if "item_scraped_count" in line and ":" in line:
            try:
                # Format: "'item_scraped_count': 21," or "item_scraped_count: 21"
                parts = line.split(":")
                if len(parts) >= 2:
                    count_str = parts[1].strip().rstrip(",").strip("'")
                    items_yielded = int(count_str)
                    logger.info(f"Extracted items_yielded: {items_yielded} from line: {line[:100]}")
            except (IndexError, ValueError) as e:
                logger.warning(f"Failed to parse item_scraped_count from line: {line[:100]}, error: {e}")
                continue

        # Persistence pipeline close summary (labels set in PersistencePipeline.close_spider).
        # Format: "  Pipeline records written (all tables): 42"
        if "Pipeline records written (all tables):" in line:
            try:
                count_str = line.split("Pipeline records written (all tables):")[1].strip().split()[0]
                pipeline_records_written = int(count_str)
            except (IndexError, ValueError) as e:
                logger.warning(f"Failed to parse pipeline records written from line: {line[:100]}, error: {e}")
            continue
        # Format: "  Bronze tracks queued: 10"
        if "Bronze playlists queued:" in line or "Bronze tracks queued:" in line:
            kind = "playlists" if "Bronze playlists queued:" in line else "tracks"
            try:
                bronze_queued[kind] = int(line.split("queued:")[1].strip().split()[0])
            except (IndexError, ValueError) as e:
                logger.warning(f"Failed to parse bronze {kind} queued from line: {line[:100]}, error: {e}")
            continue

        # Extract bronze layer insert counts for detailed tracking
        # Format: "✓ Inserted 5 playlists to bronze layer"
        if "Inserted" in line and "to bronze layer" in line:
            try:
                parts = line.split("Inserted")
                if len(parts) >= 2:
                    count_part = parts[1].strip().split()[0]
                    count = int(count_part)
                    if "playlist" in line.lower():
                        bronze_playlists_persisted += count
                        logger.info(f"Extracted bronze_playlists_persisted: +{count} (total={bronze_playlists_persisted}) from line: {line[:100]}")
                    elif "track" in line.lower():
                        bronze_tracks_persisted += count
                        logger.info(f"Extracted bronze_tracks_persisted: +{count} (total={bronze_tracks_persisted}) from line: {line[:100]}")
            except (IndexError, ValueError) as e:
                logger.debug(f"Failed to parse bronze insert count from line: {line[:100]}, error: {e}")
                continue

    logger.info(
        f"Final extracted stats: bronze_playlists={bronze_playlists_persisted}/{bronze_queued['playlists']} queued, "
        f"bronze_tracks={bronze_tracks_persisted}/{bronze_queued['tracks']} queued, "
        f"yielded={items_yielded}, pipeline_records_written={pipeline_records_written}"
    )

    return {
        "bronze_playlists_persisted": bronze_playlists_persisted,
        "bronze_tracks_persisted": bronze_tracks_persisted,
        "bronze_playlists_queued": bronze_queued["playlists"],
        "bronze_tracks_queued": bronze_queued["tracks"],
        "items_yielded": items_yielded,
        "pipeline_records_written": pipeline_records_written,
        "items_scraped": items_yielded,  # Alias for items_yielded
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

    # Check if source is not implemented
    if request.source in NOT_IMPLEMENTED_SOURCES:
        raise HTTPException(
            status_code=501,
            detail=NOT_IMPLEMENTED_SOURCES[request.source],
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
        target_urls = request.start_urls or request.url
        logger.info(
            "MixesDB spider parameters: start_urls=%s, search_query=%s, artist_name=%s, limit=%s",
            target_urls,
            request.search_query,
            request.artist_name,
            request.limit
        )
        if target_urls:
            # Direct URL scraping (for testing specific mix pages)
            cmd.extend(["-a", f"start_urls={target_urls}"])
            logger.info("Added start_urls parameter: %s", target_urls)
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

    elif request.source in GENERIC_ARCHIVE_CONFIGS:
        # Generic archive spider requires config parameter
        config_name = GENERIC_ARCHIVE_CONFIGS[request.source]
        cmd.extend(["-a", f"config={config_name}"])
        if request.url:
            cmd.extend(["-a", f"start_url={request.url}"])
        elif request.start_urls:
            cmd.extend(["-a", f"start_url={request.start_urls}"])
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Source '{request.source}' requires 'url' or 'start_urls' parameter",
            )

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
    # Counter keeps its previous value: rows written across all tables
    items_scraped_total.labels(source=request.source).inc(stats["pipeline_records_written"])

    # Data loss: rows queued for a bronze table but not written to it (like with like).
    # Spider yields are not compared: they mix item kinds, and standalone track items
    # are never meant to reach bronze.
    bronze_shortfall = {
        "playlists": max(stats["bronze_playlists_queued"] - stats["bronze_playlists_persisted"], 0),
        "tracks": max(stats["bronze_tracks_queued"] - stats["bronze_tracks_persisted"], 0),
    }
    data_loss_count = sum(bronze_shortfall.values())
    if data_loss_count:
        logger.warning(
            "DATA LOSS DETECTED: source=%s, bronze playlists written=%s of %s queued, "
            "bronze tracks written=%s of %s queued",
            request.source,
            stats["bronze_playlists_persisted"],
            stats["bronze_playlists_queued"],
            stats["bronze_tracks_persisted"],
            stats["bronze_tracks_queued"],
        )

    logger.info(
        "Spider completed: source=%s, duration_seconds=%s, bronze_playlists=%s, bronze_tracks=%s, "
        "items_yielded=%s, pipeline_records_written=%s",
        request.source,
        f"{duration:.2f}",
        stats["bronze_playlists_persisted"],
        stats["bronze_tracks_persisted"],
        stats["items_yielded"],
        stats["pipeline_records_written"],
    )

    return {
        "status": "success",
        "source": request.source,
        "task_id": task_id,
        "url": request.url,
        # Headline: rows written to bronze for this job (read by the worker and /pipeline)
        "bronze_playlists_persisted": stats["bronze_playlists_persisted"],
        "bronze_tracks_persisted": stats["bronze_tracks_persisted"],
        "bronze_playlists_queued": stats["bronze_playlists_queued"],
        "bronze_tracks_queued": stats["bronze_tracks_queued"],
        # Not playlist or track counts: all spider items, and rows across all tables
        "items_yielded": stats["items_yielded"],
        "pipeline_records_written": stats["pipeline_records_written"],
        "items_scraped": stats["items_yielded"],
        # Data loss: bronze rows queued but not written
        "data_loss_count": data_loss_count,
        "data_loss_detected": data_loss_count > 0,
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
