"""
Memory Monitor for Playwright Spiders
Tracks Playwright page lifecycle to detect memory leaks
"""
import logging
import psutil
import os
from typing import Optional
from datetime import datetime


class MemoryMonitor:
    """
    Monitor Playwright page lifecycle and memory usage to detect leaks.

    Usage:
        monitor = MemoryMonitor(spider_name='1001tracklists')
        monitor.page_opened()
        # ... use page ...
        monitor.page_closed()
        monitor.log_stats()
    """

    def __init__(self, spider_name: str, logger: Optional[logging.Logger] = None):
        self.spider_name = spider_name
        self.logger = logger or logging.getLogger(f'{spider_name}.memory')

        # Counters
        self.pages_opened = 0
        self.pages_closed = 0
        self.pages_errored = 0

        # Memory tracking
        self.process = psutil.Process(os.getpid())
        self.initial_memory_mb = self._get_memory_mb()
        self.peak_memory_mb = self.initial_memory_mb

        # Logging frequency
        self.log_frequency = int(os.getenv('PLAYWRIGHT_LOG_FREQUENCY', '10'))

        self.logger.info(
            f"Memory monitor initialized for {spider_name} | "
            f"Initial memory: {self.initial_memory_mb:.1f} MB"
        )

    def _get_memory_mb(self) -> float:
        """Get current process memory usage in MB."""
        try:
            memory_info = self.process.memory_info()
            return memory_info.rss / 1024 / 1024  # Convert bytes to MB
        except Exception as e:
            self.logger.warning(f"Failed to get memory info: {e}")
            return 0.0

    def page_opened(self):
        """Track Playwright page opened."""
        self.pages_opened += 1

        # Log stats every N pages
        if self.pages_opened % self.log_frequency == 0:
            self.log_stats()

    def page_closed(self):
        """Track Playwright page closed."""
        self.pages_closed += 1

        # Update peak memory
        current_memory = self._get_memory_mb()
        if current_memory > self.peak_memory_mb:
            self.peak_memory_mb = current_memory

    def page_errored(self):
        """Track Playwright page that errored before closing."""
        self.pages_errored += 1

    def log_stats(self):
        """Log current memory statistics."""
        current_memory = self._get_memory_mb()
        memory_delta = current_memory - self.initial_memory_mb
        open_pages = self.pages_opened - self.pages_closed

        self.logger.info(
            f"Memory Stats | "
            f"Pages: opened={self.pages_opened} closed={self.pages_closed} "
            f"open={open_pages} errored={self.pages_errored} | "
            f"Memory: current={current_memory:.1f}MB "
            f"delta={memory_delta:+.1f}MB "
            f"peak={self.peak_memory_mb:.1f}MB"
        )

        # Warn if potential leak detected
        if open_pages > 5:
            self.logger.warning(
                f"Potential page leak detected: {open_pages} pages still open! "
                f"Ensure all Playwright pages are closed in finally blocks."
            )

        # Warn if memory growing significantly
        if memory_delta > 500:  # 500MB growth
            self.logger.warning(
                f"Significant memory growth: {memory_delta:.1f}MB | "
                f"Consider reviewing page cleanup logic"
            )

    def log_final_stats(self):
        """Log final statistics on spider close."""
        current_memory = self._get_memory_mb()
        memory_delta = current_memory - self.initial_memory_mb
        open_pages = self.pages_opened - self.pages_closed

        self.logger.info(f"\n{'='*60}")
        self.logger.info(f"FINAL MEMORY STATISTICS - {self.spider_name}")
        self.logger.info(f"{'='*60}")
        self.logger.info(f"Pages opened: {self.pages_opened}")
        self.logger.info(f"Pages closed: {self.pages_closed}")
        self.logger.info(f"Pages errored: {self.pages_errored}")
        self.logger.info(f"Pages still open: {open_pages}")
        self.logger.info(f"Initial memory: {self.initial_memory_mb:.1f} MB")
        self.logger.info(f"Final memory: {current_memory:.1f} MB")
        self.logger.info(f"Memory delta: {memory_delta:+.1f} MB")
        self.logger.info(f"Peak memory: {self.peak_memory_mb:.1f} MB")

        # Leak detection
        if open_pages > 0:
            self.logger.warning(
                f"MEMORY LEAK DETECTED: {open_pages} Playwright pages were not closed!"
            )
        else:
            self.logger.info("All Playwright pages properly closed")

        self.logger.info(f"{'='*60}\n")

        return {
            'pages_opened': self.pages_opened,
            'pages_closed': self.pages_closed,
            'pages_errored': self.pages_errored,
            'open_pages': open_pages,
            'initial_memory_mb': self.initial_memory_mb,
            'final_memory_mb': current_memory,
            'memory_delta_mb': memory_delta,
            'peak_memory_mb': self.peak_memory_mb,
            'leak_detected': open_pages > 0
        }

    def export_prometheus_metrics(self) -> str:
        """
        Export metrics in Prometheus format.

        Returns:
            Prometheus-formatted metrics string
        """
        open_pages = self.pages_opened - self.pages_closed
        current_memory = self._get_memory_mb()

        metrics = f"""# HELP playwright_pages_opened_total Total Playwright pages opened
# TYPE playwright_pages_opened_total counter
playwright_pages_opened_total{{spider="{self.spider_name}"}} {self.pages_opened}

# HELP playwright_pages_closed_total Total Playwright pages closed
# TYPE playwright_pages_closed_total counter
playwright_pages_closed_total{{spider="{self.spider_name}"}} {self.pages_closed}

# HELP playwright_pages_errored_total Total Playwright pages that errored
# TYPE playwright_pages_errored_total counter
playwright_pages_errored_total{{spider="{self.spider_name}"}} {self.pages_errored}

# HELP playwright_pages_open Current open Playwright pages
# TYPE playwright_pages_open gauge
playwright_pages_open{{spider="{self.spider_name}"}} {open_pages}

# HELP playwright_memory_usage_mb Current memory usage in MB
# TYPE playwright_memory_usage_mb gauge
playwright_memory_usage_mb{{spider="{self.spider_name}"}} {current_memory:.2f}

# HELP playwright_memory_peak_mb Peak memory usage in MB
# TYPE playwright_memory_peak_mb gauge
playwright_memory_peak_mb{{spider="{self.spider_name}"}} {self.peak_memory_mb:.2f}
"""
        return metrics
