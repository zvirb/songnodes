"""FastAPI wrapper for the BBC Sounds Rave Forever spider."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shlex
import time
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import FastAPI, Response
from pydantic import BaseModel
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

from secrets_utils import resolve_secret


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="BBC Sounds Rave Forever Scraper", version="1.0.0")


class ScrapeRequest(BaseModel):
    """Request payload for triggering the spider."""

    url: Optional[str] = None
    params: Dict[str, Any] = {}
    task_id: Optional[str] = None
    max_pages: Optional[int] = None


# Prometheus metrics
scrape_requests_total = Counter(
    "scraper_bbc_sounds_requests_total",
    "Total scrape requests",
    ["status"],
)

scrape_duration_seconds = Histogram(
    "scraper_bbc_sounds_duration_seconds",
    "Scrape request duration",
    ["status"],
    buckets=[1, 5, 15, 30, 60, 120, 300, 600, 900],
)

items_scraped_total = Counter(
    "scraper_bbc_sounds_items_total",
    "Total items scraped",
    ["mode"],
)

@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Simple health probe used by orchestrator and Docker."""

    credentials_ready = bool(
        resolve_secret("BBC_SOUNDS_USERNAME")
        and resolve_secret("BBC_SOUNDS_PASSWORD")
    )
    return {
        "status": "healthy",
        "scraper": "bbc_sounds_rave_forever",
        "credentials": "configured" if credentials_ready else "missing",
    }


@app.get("/metrics")
async def metrics() -> Response:
    """Expose Prometheus metrics for scraping activity."""

    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


async def _run_spider(cmd: list[str], timeout: int = 900) -> Dict[str, Any]:
    """Execute the scrapy command asynchronously and capture output."""

    logger.info("Executing command: %s", " ".join(shlex.quote(c) for c in cmd))

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd="/app",
    )

    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        process.kill()
        await process.communicate()
        return {
            "status": "timeout",
            "returncode": None,
            "stdout": "",
            "stderr": "Spider timeout after {} seconds".format(timeout),
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


def _allowed_param(key: str, value: Any) -> Optional[str]:
    """Whitelist CLI parameters forwarded to the spider."""

    allowed_keys = {"max_pages", "episode_url", "episode_urls"}
    if key in allowed_keys and value is not None:
        return f"{key}={value}"
    return None


@app.post("/scrape")
async def scrape_url(request: ScrapeRequest) -> Dict[str, Any]:
    """Run the BBC Sounds spider via subprocess and report statistics."""

    task_id = request.task_id or f"bbc_sounds_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    start_time = time.time()
    status_label = "error"

    cmd = [
        "scrapy",
        "crawl",
        "bbc_sounds_rave_forever",
        "-L",
        "INFO",
        "-s",
        "LOG_ENABLED=1",
    ]

    # Apply optional overrides
    if request.max_pages:
        cmd.extend(["-a", f"max_pages={request.max_pages}"])

    if request.url:
        cmd.extend(["-a", f"episode_url={request.url}"])

    for key, value in (request.params or {}).items():
        param = _allowed_param(key, value)
        if param:
            cmd.extend(["-a", param])

    result = await _run_spider(cmd)
    duration = time.time() - start_time

    if result["status"] == "timeout":
        scrape_requests_total.labels(status="timeout").inc()
        scrape_duration_seconds.labels(status="timeout").observe(duration)
        return {
            "status": "timeout",
            "task_id": task_id,
            "error": result["stderr"],
        }

    stdout = result.get("stdout", "")
    stderr = result.get("stderr", "")

    if result.get("returncode") != 0:
        scrape_requests_total.labels(status="error").inc()
        scrape_duration_seconds.labels(status="error").observe(duration)
        logger.error(
            "Spider execution failed: returncode=%s, stderr=%s",
            result.get("returncode"),
            stderr[:500],
        )
        return {
            "status": "error",
            "task_id": task_id,
            "returncode": result.get("returncode"),
            "error": stderr[:500] or stdout[:500] or "Spider execution failed",
        }

    stats = _extract_stats(stdout, stderr)
    status_label = "success"

    scrape_requests_total.labels(status=status_label).inc()
    scrape_duration_seconds.labels(status=status_label).observe(duration)
    items_scraped_total.labels(mode="targeted" if request.url else "series").inc(
        stats["items_processed"]
    )

    logger.info(
        "Spider completed: duration_seconds=%s, items_processed=%s",
        f"{duration:.2f}",
        stats["items_processed"],
    )

    return {
        "status": "success",
        "task_id": task_id,
        "url": request.url,
        "mode": "episode" if request.url else "series",
        "items_processed": stats["items_processed"],
        "items_scraped": stats["items_scraped"],
    }


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8026)
