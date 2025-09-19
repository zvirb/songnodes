"""
Robots.txt Parser and Rate Limiter
Handles robots.txt compliance and intelligent rate limiting for web scraping
"""

import asyncio
import re
import time
from typing import Dict, Optional, List, Tuple, Set
from urllib.parse import urlparse, urljoin
from datetime import datetime, timedelta
import logging
import httpx
from dataclasses import dataclass, field
from collections import defaultdict
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class RobotRules:
    """Parsed rules from robots.txt for a specific user agent"""
    allowed_paths: Set[str] = field(default_factory=set)
    disallowed_paths: Set[str] = field(default_factory=set)
    crawl_delay: Optional[float] = None
    request_rate: Optional[Tuple[int, int]] = None  # (requests, seconds)
    sitemap_urls: List[str] = field(default_factory=list)
    last_fetched: datetime = field(default_factory=datetime.now)

    def is_allowed(self, path: str) -> bool:
        """Check if a path is allowed for crawling"""
        # Check disallowed paths first (more specific)
        for pattern in self.disallowed_paths:
            if self._matches_pattern(pattern, path):
                # Check if there's a more specific allow rule
                for allow_pattern in self.allowed_paths:
                    if self._matches_pattern(allow_pattern, path) and len(allow_pattern) > len(pattern):
                        return True
                return False
        return True

    def _matches_pattern(self, pattern: str, path: str) -> bool:
        """Check if a path matches a robots.txt pattern"""
        # Convert robots.txt pattern to regex
        pattern = pattern.replace("*", ".*")
        pattern = pattern.replace("?", ".")
        pattern = f"^{pattern}"
        try:
            return bool(re.match(pattern, path))
        except re.error:
            return False

    def get_delay(self) -> float:
        """Get the appropriate crawl delay in seconds"""
        if self.crawl_delay is not None:
            return self.crawl_delay
        elif self.request_rate is not None:
            # Calculate delay from request rate
            requests, seconds = self.request_rate
            return seconds / requests
        else:
            # Default conservative delay
            return 10.0


@dataclass
class DomainStats:
    """Statistics for domain-specific crawling"""
    last_request_time: float = 0
    total_requests: int = 0
    rate_limit_hits: int = 0
    avg_response_time: float = 0
    error_count: int = 0
    last_error_time: float = 0
    successful_requests: int = 0

    def update_stats(self, response_time: float, is_error: bool = False, is_rate_limit: bool = False):
        """Update domain statistics after a request"""
        self.last_request_time = time.time()
        self.total_requests += 1

        if is_error:
            self.error_count += 1
            self.last_error_time = time.time()
            if is_rate_limit:
                self.rate_limit_hits += 1
        else:
            self.successful_requests += 1
            # Update moving average of response time
            alpha = 0.1  # Exponential moving average factor
            if self.avg_response_time == 0:
                self.avg_response_time = response_time
            else:
                self.avg_response_time = (1 - alpha) * self.avg_response_time + alpha * response_time

    def get_adaptive_delay(self, base_delay: float) -> float:
        """Calculate adaptive delay based on domain statistics"""
        # Start with base delay from robots.txt
        delay = base_delay

        # Increase delay if we've hit rate limits
        if self.rate_limit_hits > 0:
            rate_limit_factor = min(3.0, 1.0 + (self.rate_limit_hits * 0.5))
            delay *= rate_limit_factor

        # Increase delay if error rate is high
        if self.total_requests > 10:
            error_rate = self.error_count / self.total_requests
            if error_rate > 0.1:  # More than 10% errors
                delay *= (1.0 + error_rate)

        # Increase delay if response times are slow (server under load)
        if self.avg_response_time > 5.0:  # Response time > 5 seconds
            delay *= min(2.0, self.avg_response_time / 5.0)

        # Apply exponential backoff for recent errors
        if self.last_error_time > 0:
            time_since_error = time.time() - self.last_error_time
            if time_since_error < 300:  # Within last 5 minutes
                backoff_factor = min(3.0, 2.0 ** (1 - time_since_error / 300))
                delay *= backoff_factor

        # Never go below minimum delay
        return max(delay, 1.0)


class RobotsChecker:
    """Manages robots.txt parsing and compliance for multiple domains"""

    DEFAULT_USER_AGENT = "SongNodes-Bot/1.0 (+https://songnodes.com/bot)"
    CACHE_EXPIRY = 86400  # Cache robots.txt for 24 hours

    def __init__(self, user_agent: Optional[str] = None):
        self.user_agent = user_agent or self.DEFAULT_USER_AGENT
        self.robots_cache: Dict[str, RobotRules] = {}
        self.domain_stats: Dict[str, DomainStats] = defaultdict(DomainStats)
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0),
            follow_redirects=True,
            headers={"User-Agent": self.user_agent}
        )
        self._lock = asyncio.Lock()

    async def fetch_robots_txt(self, domain: str) -> Optional[RobotRules]:
        """Fetch and parse robots.txt for a domain"""
        robots_url = f"https://{domain}/robots.txt"

        try:
            response = await self.client.get(robots_url)
            if response.status_code == 200:
                return self._parse_robots_txt(response.text)
            elif response.status_code == 404:
                # No robots.txt means everything is allowed
                return RobotRules()
            else:
                logger.warning(f"Failed to fetch robots.txt from {domain}: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error fetching robots.txt from {domain}: {e}")
            return None

    def _parse_robots_txt(self, content: str) -> RobotRules:
        """Parse robots.txt content"""
        rules = RobotRules()
        applies_to_us = False
        current_user_agent = None

        for line in content.split('\n'):
            line = line.strip()

            # Remove comments
            if '#' in line:
                line = line[:line.index('#')].strip()

            if not line:
                continue

            # Parse directive
            if ':' in line:
                directive, value = line.split(':', 1)
                directive = directive.strip().lower()
                value = value.strip()

                # User-agent directive
                if directive == 'user-agent':
                    current_user_agent = value.lower()
                    # Check if rules apply to our bot
                    if current_user_agent == '*' or self.user_agent.lower() in current_user_agent:
                        applies_to_us = True
                    else:
                        applies_to_us = False

                # Only process rules that apply to us
                if applies_to_us:
                    if directive == 'disallow':
                        if value:
                            rules.disallowed_paths.add(value)
                    elif directive == 'allow':
                        if value:
                            rules.allowed_paths.add(value)
                    elif directive == 'crawl-delay':
                        try:
                            rules.crawl_delay = float(value)
                        except ValueError:
                            pass
                    elif directive == 'request-rate':
                        # Format: "1/5" means 1 request per 5 seconds
                        if '/' in value:
                            try:
                                requests, seconds = value.split('/')
                                rules.request_rate = (int(requests), int(seconds))
                            except ValueError:
                                pass

                # Global directives (apply to all user agents)
                if directive == 'sitemap':
                    rules.sitemap_urls.append(value)

        return rules

    async def get_rules(self, url: str) -> Optional[RobotRules]:
        """Get cached or fetch robots.txt rules for a URL"""
        parsed = urlparse(url)
        domain = parsed.netloc

        async with self._lock:
            # Check cache
            if domain in self.robots_cache:
                rules = self.robots_cache[domain]
                # Check if cache is still valid
                if (datetime.now() - rules.last_fetched).total_seconds() < self.CACHE_EXPIRY:
                    return rules

            # Fetch fresh robots.txt
            rules = await self.fetch_robots_txt(domain)
            if rules:
                self.robots_cache[domain] = rules

            return rules

    async def is_allowed(self, url: str) -> bool:
        """Check if a URL is allowed to be crawled"""
        parsed = urlparse(url)
        rules = await self.get_rules(url)

        if rules is None:
            # If we couldn't fetch robots.txt, be conservative
            return False

        return rules.is_allowed(parsed.path)

    async def get_crawl_delay(self, url: str) -> float:
        """Get the appropriate crawl delay for a URL"""
        parsed = urlparse(url)
        domain = parsed.netloc

        # Get base delay from robots.txt
        rules = await self.get_rules(url)
        base_delay = rules.get_delay() if rules else 10.0

        # Get adaptive delay based on domain statistics
        stats = self.domain_stats[domain]
        return stats.get_adaptive_delay(base_delay)

    def update_domain_stats(self, url: str, response_time: float,
                           is_error: bool = False, is_rate_limit: bool = False):
        """Update statistics for a domain after a request"""
        parsed = urlparse(url)
        domain = parsed.netloc
        self.domain_stats[domain].update_stats(response_time, is_error, is_rate_limit)

    async def wait_if_needed(self, url: str) -> float:
        """Wait if necessary before making a request to respect rate limits"""
        parsed = urlparse(url)
        domain = parsed.netloc

        delay = await self.get_crawl_delay(url)
        stats = self.domain_stats[domain]

        # Calculate time to wait
        time_since_last = time.time() - stats.last_request_time
        time_to_wait = max(0, delay - time_since_last)

        if time_to_wait > 0:
            logger.info(f"Waiting {time_to_wait:.2f}s before requesting {domain}")
            await asyncio.sleep(time_to_wait)

        return delay

    def get_domain_health(self, domain: str) -> Dict:
        """Get health metrics for a domain"""
        stats = self.domain_stats[domain]
        return {
            "domain": domain,
            "total_requests": stats.total_requests,
            "successful_requests": stats.successful_requests,
            "error_count": stats.error_count,
            "rate_limit_hits": stats.rate_limit_hits,
            "avg_response_time": round(stats.avg_response_time, 2),
            "success_rate": round(stats.successful_requests / max(1, stats.total_requests) * 100, 2),
            "last_request": datetime.fromtimestamp(stats.last_request_time).isoformat()
                          if stats.last_request_time > 0 else None
        }

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


class SmartScheduler:
    """Intelligent scheduler that respects robots.txt and implements adaptive timing"""

    def __init__(self, robots_checker: RobotsChecker):
        self.robots_checker = robots_checker
        self.domain_queues: Dict[str, List[Dict]] = defaultdict(list)
        self.processing_domains: Set[str] = set()
        self._lock = asyncio.Lock()

    def add_task(self, url: str, task_data: Dict):
        """Add a scraping task to the appropriate domain queue"""
        parsed = urlparse(url)
        domain = parsed.netloc

        task = {
            "url": url,
            "domain": domain,
            "data": task_data,
            "added_at": datetime.now()
        }

        self.domain_queues[domain].append(task)

    async def get_next_task(self) -> Optional[Dict]:
        """Get the next task to process, respecting rate limits"""
        async with self._lock:
            # Find domains that are ready to be scraped
            available_domains = []
            current_time = time.time()

            for domain, queue in self.domain_queues.items():
                if not queue or domain in self.processing_domains:
                    continue

                # Check if enough time has passed since last request
                stats = self.robots_checker.domain_stats[domain]
                delay = await self.robots_checker.get_crawl_delay(queue[0]["url"])

                if current_time - stats.last_request_time >= delay:
                    available_domains.append((domain, delay))

            if not available_domains:
                return None

            # Sort by priority (shortest delay first, then by queue size)
            available_domains.sort(key=lambda x: (x[1], -len(self.domain_queues[x[0]])))

            # Get task from highest priority domain
            domain = available_domains[0][0]
            self.processing_domains.add(domain)

            return self.domain_queues[domain].pop(0)

    def mark_task_complete(self, domain: str):
        """Mark a domain as no longer processing"""
        self.processing_domains.discard(domain)

    def get_queue_stats(self) -> Dict:
        """Get statistics about the task queues"""
        return {
            "total_tasks": sum(len(q) for q in self.domain_queues.values()),
            "domains_queued": len(self.domain_queues),
            "domains_processing": len(self.processing_domains),
            "queue_by_domain": {d: len(q) for d, q in self.domain_queues.items()}
        }