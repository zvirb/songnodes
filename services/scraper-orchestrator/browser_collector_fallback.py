"""
Browser Collector Fallback Integration
Integrates browser-collector as a fallback when traditional scrapers fail
"""

import asyncio
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime

import httpx
import structlog

logger = structlog.get_logger(__name__)


class BrowserCollectorFallback:
    """
    Manages browser-collector as a fallback for failed traditional scrapers.

    When a traditional scraper fails (blocked, JavaScript-heavy, etc.),
    this service automatically retries using the browser-collector.
    """

    def __init__(self, base_url: str = "http://browser-collector:8030"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(360.0),  # 6 minutes for browser operations
            limits=httpx.Limits(max_connections=3, max_keepalive_connections=2)
        )
        self.fallback_attempts = 0
        self.fallback_successes = 0
        self.fallback_failures = 0

    async def health_check(self) -> Dict[str, Any]:
        """Check if browser-collector is available"""
        try:
            response = await self.client.get("/health", timeout=5.0)
            response.raise_for_status()
            health_data = response.json()

            logger.info(
                "Browser collector health check",
                status=health_data.get("status"),
                ollama_status=health_data.get("ollama", {}).get("status")
            )

            return health_data
        except Exception as e:
            logger.error("Browser collector health check failed", error=str(e))
            return {"status": "unhealthy", "error": str(e)}

    async def collect_with_fallback(
        self,
        url: str,
        scraper_name: str,
        extraction_type: str = "tracklist",
        collect_screenshots: bool = False
    ) -> Dict[str, Any]:
        """
        Use browser-collector to scrape URL when traditional scraper fails.

        Args:
            url: Target URL to scrape
            scraper_name: Name of the failed scraper (for tracking)
            extraction_type: Type of data to extract (tracklist, artist, event, metadata)
            collect_screenshots: Whether to save screenshots (useful for debugging)

        Returns:
            Collection result with extracted data
        """
        correlation_id = str(uuid.uuid4())[:8]
        self.fallback_attempts += 1

        structlog.contextvars.bind_contextvars(
            operation="browser_collector_fallback",
            original_scraper=scraper_name,
            url=url,
            correlation_id=correlation_id
        )

        logger.info(
            "Using browser-collector as fallback",
            original_scraper=scraper_name,
            extraction_type=extraction_type
        )

        try:
            # Prepare collection request
            collection_request = {
                "session_name": f"fallback_{scraper_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "collector_type": f"fallback_for_{scraper_name}",
                "target_url": url,
                "extraction_type": extraction_type,
                "browser_config": {
                    "headless": True,
                    "browser_type": "chromium",
                    "viewport_width": 1920,
                    "viewport_height": 1080
                },
                "collect_screenshots": collect_screenshots,
                "auto_extract": True,
                "ollama_model": "llama3.2:3b"
            }

            # Make collection request
            response = await self.client.post(
                "/collect",
                json=collection_request
            )
            response.raise_for_status()

            result = response.json()

            # Check if collection succeeded
            if result.get("status") == "completed":
                self.fallback_successes += 1

                logger.info(
                    "Browser collector fallback succeeded",
                    session_id=result.get("session_id"),
                    duration_ms=result.get("collection_result", {}).get("collection_duration_ms"),
                    page_title=result.get("collection_result", {}).get("page_title")
                )

                return {
                    "success": True,
                    "method": "browser_collector",
                    "session_id": result.get("session_id"),
                    "raw_html": result.get("collection_result", {}).get("raw_html"),
                    "raw_text": result.get("collection_result", {}).get("raw_text"),
                    "extracted_data": result.get("extraction_result", {}).get("extracted_data") if result.get("extraction_result") else None,
                    "confidence_score": result.get("extraction_result", {}).get("confidence_score") if result.get("extraction_result") else None,
                    "duration_ms": result.get("collection_result", {}).get("collection_duration_ms"),
                    "correlation_id": correlation_id
                }
            else:
                self.fallback_failures += 1
                logger.warning(
                    "Browser collector fallback failed",
                    status=result.get("status"),
                    message=result.get("message")
                )

                return {
                    "success": False,
                    "method": "browser_collector",
                    "error": result.get("message", "Collection failed"),
                    "correlation_id": correlation_id
                }

        except httpx.TimeoutException:
            self.fallback_failures += 1
            logger.error("Browser collector timeout", url=url, timeout=360)

            return {
                "success": False,
                "method": "browser_collector",
                "error": "Collection timeout after 6 minutes",
                "correlation_id": correlation_id
            }

        except Exception as e:
            self.fallback_failures += 1
            logger.error(
                "Browser collector fallback exception",
                error=str(e),
                error_type=type(e).__name__
            )

            return {
                "success": False,
                "method": "browser_collector",
                "error": str(e),
                "correlation_id": correlation_id
            }

    async def get_statistics(self) -> Dict[str, Any]:
        """Get fallback usage statistics"""
        success_rate = (
            (self.fallback_successes / self.fallback_attempts * 100)
            if self.fallback_attempts > 0
            else 0.0
        )

        return {
            "total_attempts": self.fallback_attempts,
            "successes": self.fallback_successes,
            "failures": self.fallback_failures,
            "success_rate": f"{success_rate:.1f}%"
        }

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
        logger.info("Browser collector fallback client closed")


class ScraperWithFallback:
    """
    Wrapper for traditional scrapers with automatic browser-collector fallback.

    Usage:
        scraper = ScraperWithFallback(
            scraper_url="http://scraper-1001tracklists:8011",
            scraper_name="1001tracklists",
            browser_fallback=browser_collector_fallback
        )

        result = await scraper.scrape_with_fallback(url, params)
    """

    def __init__(
        self,
        scraper_url: str,
        scraper_name: str,
        browser_fallback: BrowserCollectorFallback,
        extraction_type: str = "tracklist"
    ):
        self.scraper_url = scraper_url
        self.scraper_name = scraper_name
        self.browser_fallback = browser_fallback
        self.extraction_type = extraction_type

        self.client = httpx.AsyncClient(
            base_url=scraper_url,
            timeout=httpx.Timeout(60.0),
            limits=httpx.Limits(max_connections=10)
        )

        self.traditional_attempts = 0
        self.traditional_successes = 0
        self.traditional_failures = 0

    async def scrape_with_fallback(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        enable_fallback: bool = True
    ) -> Dict[str, Any]:
        """
        Try traditional scraper first, fall back to browser-collector if it fails.

        Args:
            url: URL to scrape
            params: Additional parameters for the scraper
            enable_fallback: Whether to use browser-collector if traditional fails

        Returns:
            Scraping result from traditional or fallback method
        """
        correlation_id = str(uuid.uuid4())[:8]
        self.traditional_attempts += 1

        structlog.contextvars.bind_contextvars(
            operation="scrape_with_fallback",
            scraper=self.scraper_name,
            url=url,
            correlation_id=correlation_id
        )

        # Try traditional scraper first
        try:
            logger.info(f"Attempting traditional scraper: {self.scraper_name}")

            response = await self.client.post(
                "/scrape",
                json={"url": url, **(params or {})}
            )

            if response.status_code == 200:
                result = response.json()
                self.traditional_successes += 1

                logger.info(
                    "Traditional scraper succeeded",
                    scraper=self.scraper_name,
                    status_code=response.status_code
                )

                return {
                    "success": True,
                    "method": "traditional",
                    "scraper": self.scraper_name,
                    "data": result,
                    "correlation_id": correlation_id
                }
            else:
                raise Exception(f"HTTP {response.status_code}: {response.text[:200]}")

        except Exception as e:
            self.traditional_failures += 1

            logger.warning(
                "Traditional scraper failed",
                scraper=self.scraper_name,
                error=str(e)[:200],
                fallback_enabled=enable_fallback
            )

            # Use browser-collector as fallback
            if enable_fallback:
                logger.info("Falling back to browser-collector")
                return await self.browser_fallback.collect_with_fallback(
                    url=url,
                    scraper_name=self.scraper_name,
                    extraction_type=self.extraction_type
                )
            else:
                return {
                    "success": False,
                    "method": "traditional",
                    "scraper": self.scraper_name,
                    "error": str(e),
                    "correlation_id": correlation_id
                }

    async def get_statistics(self) -> Dict[str, Any]:
        """Get scraper statistics"""
        traditional_success_rate = (
            (self.traditional_successes / self.traditional_attempts * 100)
            if self.traditional_attempts > 0
            else 0.0
        )

        return {
            "scraper": self.scraper_name,
            "traditional": {
                "attempts": self.traditional_attempts,
                "successes": self.traditional_successes,
                "failures": self.traditional_failures,
                "success_rate": f"{traditional_success_rate:.1f}%"
            },
            "fallback_stats": await self.browser_fallback.get_statistics()
        }

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
