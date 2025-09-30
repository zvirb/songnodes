"""
Proxy Manager for Scraper Resilience
Implements rotating proxy pool with health checking and failover.
"""
import asyncio
import random
import time
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import logging
import aiohttp

logger = logging.getLogger(__name__)


class ProxyStatus(Enum):
    """Proxy health status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    FAILED = "failed"
    UNTESTED = "untested"


@dataclass
class ProxyInfo:
    """Proxy configuration and statistics"""
    url: str
    protocol: str = "http"  # http, https, socks5
    username: Optional[str] = None
    password: Optional[str] = None
    status: ProxyStatus = ProxyStatus.UNTESTED
    success_count: int = 0
    failure_count: int = 0
    last_used: float = 0.0
    last_check: float = 0.0
    avg_response_time: float = 0.0
    consecutive_failures: int = 0

    @property
    def success_rate(self) -> float:
        """Calculate success rate"""
        total = self.success_count + self.failure_count
        return self.success_count / total if total > 0 else 0.0

    @property
    def proxy_url(self) -> str:
        """Get formatted proxy URL"""
        if self.username and self.password:
            return f"{self.protocol}://{self.username}:{self.password}@{self.url}"
        return f"{self.protocol}://{self.url}"


class ProxyManager:
    """
    Manages rotating proxy pool with health checking and intelligent selection.

    Features:
    - Automatic proxy rotation
    - Health monitoring
    - Performance-based selection
    - Automatic failover
    - Cooldown periods for failed proxies
    """

    def __init__(
        self,
        proxies: List[Dict[str, Any]] = None,
        health_check_url: str = "https://httpbin.org/ip",
        health_check_interval: int = 300,  # 5 minutes
        max_consecutive_failures: int = 3,
        cooldown_period: int = 600,  # 10 minutes
        enable_health_checks: bool = True
    ):
        """
        Initialize proxy manager.

        Args:
            proxies: List of proxy configurations
            health_check_url: URL to test proxies
            health_check_interval: Seconds between health checks
            max_consecutive_failures: Failures before marking proxy as failed
            cooldown_period: Seconds to wait before retrying failed proxy
            enable_health_checks: Whether to perform automatic health checks
        """
        self.proxies: List[ProxyInfo] = []
        self.health_check_url = health_check_url
        self.health_check_interval = health_check_interval
        self.max_consecutive_failures = max_consecutive_failures
        self.cooldown_period = cooldown_period
        self.enable_health_checks = enable_health_checks
        self._health_check_task: Optional[asyncio.Task] = None

        # Initialize proxies
        if proxies:
            for proxy_config in proxies:
                self.add_proxy(proxy_config)

        logger.info(f"ProxyManager initialized with {len(self.proxies)} proxies")

    def add_proxy(self, proxy_config: Dict[str, Any]):
        """Add proxy to pool"""
        proxy = ProxyInfo(
            url=proxy_config['url'],
            protocol=proxy_config.get('protocol', 'http'),
            username=proxy_config.get('username'),
            password=proxy_config.get('password')
        )
        self.proxies.append(proxy)
        logger.info(f"Added proxy: {proxy.url}")

    def get_healthy_proxies(self) -> List[ProxyInfo]:
        """Get list of healthy proxies"""
        current_time = time.time()

        healthy = []
        for proxy in self.proxies:
            # Check if proxy is in cooldown period
            if proxy.status == ProxyStatus.FAILED:
                if current_time - proxy.last_used < self.cooldown_period:
                    continue  # Still in cooldown
                else:
                    # Cooldown expired, reset to untested
                    proxy.status = ProxyStatus.UNTESTED
                    proxy.consecutive_failures = 0

            if proxy.status in [ProxyStatus.HEALTHY, ProxyStatus.UNTESTED]:
                healthy.append(proxy)

        return healthy

    def select_proxy(self, strategy: str = "performance") -> Optional[ProxyInfo]:
        """
        Select proxy using specified strategy.

        Strategies:
        - random: Random selection
        - round_robin: Sequential rotation
        - performance: Best success rate and response time
        - least_used: Proxy used least recently
        """
        healthy_proxies = self.get_healthy_proxies()

        if not healthy_proxies:
            logger.warning("No healthy proxies available")
            return None

        if strategy == "random":
            return random.choice(healthy_proxies)

        elif strategy == "round_robin":
            # Select least recently used
            return min(healthy_proxies, key=lambda p: p.last_used)

        elif strategy == "performance":
            # Score based on success rate and response time
            def score_proxy(p: ProxyInfo) -> float:
                # Favor high success rate and low response time
                success_weight = p.success_rate * 0.7
                # Normalize response time (lower is better)
                time_weight = (1.0 / (p.avg_response_time + 0.1)) * 0.3
                return success_weight + time_weight

            return max(healthy_proxies, key=score_proxy)

        elif strategy == "least_used":
            # Select proxy with lowest usage count
            return min(healthy_proxies, key=lambda p: p.success_count + p.failure_count)

        else:
            logger.warning(f"Unknown strategy '{strategy}', using random")
            return random.choice(healthy_proxies)

    def record_success(self, proxy: ProxyInfo, response_time: float):
        """Record successful proxy usage"""
        proxy.success_count += 1
        proxy.consecutive_failures = 0
        proxy.last_used = time.time()

        # Update average response time (exponential moving average)
        if proxy.avg_response_time == 0:
            proxy.avg_response_time = response_time
        else:
            proxy.avg_response_time = proxy.avg_response_time * 0.8 + response_time * 0.2

        # Update status
        if proxy.status != ProxyStatus.HEALTHY and proxy.success_rate > 0.7:
            proxy.status = ProxyStatus.HEALTHY
            logger.info(f"Proxy {proxy.url} marked as HEALTHY")

    def record_failure(self, proxy: ProxyInfo, error: str):
        """Record proxy failure"""
        proxy.failure_count += 1
        proxy.consecutive_failures += 1
        proxy.last_used = time.time()

        logger.warning(f"Proxy {proxy.url} failure: {error}")

        # Update status based on consecutive failures
        if proxy.consecutive_failures >= self.max_consecutive_failures:
            proxy.status = ProxyStatus.FAILED
            logger.error(f"Proxy {proxy.url} marked as FAILED after {proxy.consecutive_failures} consecutive failures")
        elif proxy.success_rate < 0.5 and proxy.success_count + proxy.failure_count > 10:
            proxy.status = ProxyStatus.DEGRADED
            logger.warning(f"Proxy {proxy.url} marked as DEGRADED (success rate: {proxy.success_rate:.2%})")

    async def check_proxy_health(self, proxy: ProxyInfo) -> bool:
        """
        Check if proxy is working.

        Returns:
            True if proxy is healthy, False otherwise
        """
        try:
            start_time = time.time()

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.health_check_url,
                    proxy=proxy.proxy_url,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    response_time = time.time() - start_time

                    if response.status == 200:
                        self.record_success(proxy, response_time)
                        proxy.last_check = time.time()
                        logger.debug(f"Proxy {proxy.url} health check passed ({response_time:.2f}s)")
                        return True
                    else:
                        self.record_failure(proxy, f"HTTP {response.status}")
                        return False

        except asyncio.TimeoutError:
            self.record_failure(proxy, "Timeout")
            return False

        except Exception as e:
            self.record_failure(proxy, str(e))
            return False

    async def health_check_loop(self):
        """Continuous health checking of all proxies"""
        logger.info("Starting proxy health check loop")

        while True:
            try:
                for proxy in self.proxies:
                    # Skip if recently checked
                    if time.time() - proxy.last_check < self.health_check_interval:
                        continue

                    await self.check_proxy_health(proxy)
                    await asyncio.sleep(1)  # Small delay between checks

                # Wait before next full cycle
                await asyncio.sleep(self.health_check_interval)

            except Exception as e:
                logger.error(f"Health check loop error: {e}")
                await asyncio.sleep(60)  # Wait before retrying

    async def start_health_checks(self):
        """Start background health checking"""
        if self.enable_health_checks and self._health_check_task is None:
            self._health_check_task = asyncio.create_task(self.health_check_loop())
            logger.info("Proxy health checks started")

    async def stop_health_checks(self):
        """Stop background health checking"""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
            self._health_check_task = None
            logger.info("Proxy health checks stopped")

    def get_statistics(self) -> Dict[str, Any]:
        """Get proxy pool statistics"""
        total = len(self.proxies)
        healthy = len([p for p in self.proxies if p.status == ProxyStatus.HEALTHY])
        degraded = len([p for p in self.proxies if p.status == ProxyStatus.DEGRADED])
        failed = len([p for p in self.proxies if p.status == ProxyStatus.FAILED])
        untested = len([p for p in self.proxies if p.status == ProxyStatus.UNTESTED])

        total_requests = sum(p.success_count + p.failure_count for p in self.proxies)
        total_success = sum(p.success_count for p in self.proxies)

        overall_success_rate = total_success / total_requests if total_requests > 0 else 0.0

        return {
            "total_proxies": total,
            "healthy": healthy,
            "degraded": degraded,
            "failed": failed,
            "untested": untested,
            "total_requests": total_requests,
            "overall_success_rate": overall_success_rate,
            "proxies": [
                {
                    "url": p.url,
                    "status": p.status.value,
                    "success_rate": p.success_rate,
                    "avg_response_time": p.avg_response_time,
                    "requests": p.success_count + p.failure_count
                }
                for p in self.proxies
            ]
        }


class UserAgentRotator:
    """
    Manages user agent rotation to avoid detection.

    Provides realistic user agent strings for major browsers.
    """

    # Common user agent strings (realistic, recent versions)
    USER_AGENTS = [
        # Chrome on Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",

        # Chrome on macOS
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",

        # Firefox on Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",

        # Firefox on macOS
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",

        # Safari on macOS
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",

        # Edge on Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",

        # Chrome on Linux
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]

    def __init__(self, strategy: str = "random"):
        """
        Initialize user agent rotator.

        Args:
            strategy: Selection strategy ("random", "round_robin")
        """
        self.strategy = strategy
        self.current_index = 0
        self.usage_count = {ua: 0 for ua in self.USER_AGENTS}

    def get_user_agent(self) -> str:
        """Get user agent string using configured strategy"""
        if self.strategy == "random":
            ua = random.choice(self.USER_AGENTS)
        elif self.strategy == "round_robin":
            ua = self.USER_AGENTS[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.USER_AGENTS)
        else:
            ua = random.choice(self.USER_AGENTS)

        self.usage_count[ua] += 1
        return ua

    def get_statistics(self) -> Dict[str, Any]:
        """Get usage statistics"""
        total_requests = sum(self.usage_count.values())
        return {
            "total_requests": total_requests,
            "unique_user_agents": len(self.USER_AGENTS),
            "usage_distribution": self.usage_count
        }