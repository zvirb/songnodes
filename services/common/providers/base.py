"""Shared HTTP behaviour for metadata providers: rate limiting, bounded retries, caching, error taxonomy.

Credentials are read from the environment by the registry and are only ever sent in headers or request
bodies, never in URLs that get logged. Clients accept an injected `httpx.AsyncClient` so contract tests
run against `httpx.MockTransport` with no network.
"""
import asyncio
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol

import httpx

from common.metadata.matching import Track

USER_AGENT = 'SongNodes/1.0 (+https://github.com/songnodes)'
RETRYABLE = {429, 500, 502, 503, 504}
ISO_DURATION = re.compile(r'^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$')


class ProviderError(Exception):
    """A request failed in a way the caller should record (not an empty result)."""

    def __init__(self, provider: str, message: str, status: Optional[int] = None):
        super().__init__(f'{provider}: {message}')
        self.provider, self.status = provider, status


class ProviderUnavailable(ProviderError):
    """Retries exhausted or quota exceeded; callers should back off rather than treat it as 'no match'."""


class ProviderDisabled(ProviderError):
    """Missing credentials or terms not verified; the provider must not be called."""


def parse_iso_duration_ms(value: Optional[str]) -> Optional[int]:
    """'PT3M22S' -> 202000. Returns None for missing, malformed or zero durations."""
    if not value or not isinstance(value, str):
        return None
    match = ISO_DURATION.match(value.strip())
    if not match or not any(match.groups()):
        return None
    days, hours, minutes, seconds = (float(g) if g else 0.0 for g in match.groups())
    total = (((days * 24) + hours) * 60 + minutes) * 60 + seconds
    return int(round(total * 1000)) if total > 0 else None


class RateLimiter:
    """Minimum spacing between calls (per client). `interval` seconds; 0 disables."""

    def __init__(self, interval: float = 0.0, clock=time.monotonic, sleep=asyncio.sleep):
        self.interval, self._clock, self._sleep = interval, clock, sleep
        self._next = 0.0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        if self.interval <= 0:
            return
        async with self._lock:
            now = self._clock()
            delay = self._next - now
            if delay > 0:
                await self._sleep(delay)
            self._next = max(now, self._next) + self.interval


class MemoryCache:
    """Tiny TTL cache with the same interface a Redis-backed cache provides (get/set)."""

    def __init__(self, clock=time.monotonic):
        self._data: Dict[str, tuple] = {}
        self._clock = clock

    async def get(self, key: str) -> Optional[Any]:
        item = self._data.get(key)
        if item and item[0] > self._clock():
            return item[1]
        self._data.pop(key, None)
        return None

    async def set(self, key: str, value: Any, ttl: float) -> None:
        self._data[key] = (self._clock() + ttl, value)


@dataclass(frozen=True)
class ProviderTrack:
    """One provider candidate normalised for matching, plus the metadata it carries."""
    provider: str
    track: Track                                 # title (with version), artist, isrc, duration_ms, ref=provider id
    fields: Dict[str, Any] = field(default_factory=dict)
    raw: Dict[str, Any] = field(default_factory=dict)
    field_sources: Dict[str, str] = field(default_factory=dict)   # field -> evidence source when not `provider`
    confidence: Optional[float] = None


class Provider(Protocol):
    name: str
    independent_group: str

    async def lookup(self, target: Track, genres: Optional[List[str]] = None) -> List[ProviderTrack]: ...

    async def hydrate(self, found: ProviderTrack) -> ProviderTrack:
        """Optional second call for the one matched candidate (e.g. Deezer album genres and label)."""
        ...


class HttpProvider:
    """Base class with retrying, rate-limited JSON requests."""
    name = 'provider'
    independent_group = 'provider'
    max_retries = 3
    backoff_seconds = 1.0
    max_retry_after = 60.0

    def __init__(self, client: Optional[httpx.AsyncClient] = None, rate_interval: float = 0.0, cache=None,
                 sleep=asyncio.sleep, timeout: float = 15.0):
        self._owns_client = client is None
        self.client = client or httpx.AsyncClient(timeout=timeout, headers={'User-Agent': USER_AGENT})
        self.limiter = RateLimiter(rate_interval, sleep=sleep)
        self.cache = cache or MemoryCache()
        self._sleep = sleep

    async def aclose(self) -> None:
        if self._owns_client:
            await self.client.aclose()

    def retry_delay(self, response: Optional[httpx.Response], attempt: int) -> float:
        header = response.headers.get('Retry-After') if response is not None else None
        try:
            if header is not None:
                return min(float(header), self.max_retry_after)
        except ValueError:
            pass
        return min(self.backoff_seconds * (2 ** attempt), self.max_retry_after)

    def quota_exceeded(self, response: httpx.Response) -> bool:
        """Providers that signal quota inside a 200 body override this."""
        return False

    async def request(self, method: str, url: str, **kwargs) -> httpx.Response:
        last: Optional[httpx.Response] = None
        for attempt in range(self.max_retries + 1):
            await self.limiter.wait()
            try:
                response = await self.client.request(method, url, **kwargs)
            except httpx.TransportError as error:
                if attempt == self.max_retries:
                    raise ProviderUnavailable(self.name, f'network error: {error.__class__.__name__}') from error
                await self._sleep(self.retry_delay(None, attempt))
                continue
            if response.status_code in RETRYABLE or self.quota_exceeded(response):
                last = response
                if attempt == self.max_retries:
                    break
                await self._sleep(self.retry_delay(response, attempt))
                continue
            return response
        raise ProviderUnavailable(self.name, f'gave up after {self.max_retries + 1} attempts', last.status_code if last is not None else None)

    async def get_json(self, url: str, **kwargs) -> Any:
        response = await self.request('GET', url, **kwargs)
        if response.status_code >= 400:
            raise ProviderError(self.name, f'HTTP {response.status_code}', response.status_code)
        try:
            return response.json()
        except ValueError as error:
            raise ProviderError(self.name, 'response was not JSON', response.status_code) from error
