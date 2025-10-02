"""
🎵 SongNodes Target Track Searcher - 2025 Best Practices Edition
Enhanced with circuit breakers, proper async patterns, and comprehensive observability
"""

import asyncio
import logging
import time
import uuid
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from dataclasses import dataclass
from enum import Enum
import json

import httpx
from urllib.parse import quote
import re
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

# Configure structured logging
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),
    logger_factory=structlog.WriteLoggerFactory(),
    cache_logger_on_first_use=False,
)

logger = structlog.get_logger(__name__)

# 2025 Best Practices: Circuit Breaker Implementation
class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 3
    recovery_timeout: float = 30.0
    expected_exception: tuple = (Exception,)
    fallback_function: Optional[Callable] = None

class AsyncCircuitBreaker:
    def __init__(self, name: str, config: CircuitBreakerConfig):
        self.name = name
        self.config = config
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0
        self.success_count = 0
        self._lock = asyncio.Lock()

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        correlation_id = str(uuid.uuid4())[:8]

        async with self._lock:
            structlog.contextvars.bind_contextvars(
                circuit_breaker=self.name,
                circuit_state=self.state.value,
                correlation_id=correlation_id
            )

            if self.state == CircuitState.OPEN:
                if time.time() - self.last_failure_time < self.config.recovery_timeout:
                    logger.warning("Circuit breaker OPEN, request blocked")
                    if self.config.fallback_function:
                        return await self.config.fallback_function(*args, **kwargs)
                    raise Exception(f"Circuit breaker {self.name} is OPEN")
                else:
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                    logger.info("Circuit breaker transitioning to HALF_OPEN")

            try:
                start_time = time.time()
                result = await func(*args, **kwargs)
                execution_time = time.time() - start_time

                logger.info(
                    "Circuit breaker call succeeded",
                    execution_time=f"{execution_time:.3f}s"
                )

                await self._on_success()
                return result

            except self.config.expected_exception as e:
                execution_time = time.time() - start_time
                logger.error(
                    "Circuit breaker call failed",
                    error=str(e),
                    execution_time=f"{execution_time:.3f}s"
                )
                await self._on_failure()
                raise

    async def _on_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= 2:  # Require 2 successes to close
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                logger.info("Circuit breaker transitioned to CLOSED")

        if self.failure_count > 0:
            self.failure_count = 0

    async def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.config.failure_threshold:
            self.state = CircuitState.OPEN
            logger.error(
                "Circuit breaker transitioned to OPEN",
                failure_count=self.failure_count,
                threshold=self.config.failure_threshold
            )

# 2025 Best Practices: Async Context Management
class AsyncDatabaseService:
    def __init__(self, session_factory):
        self.session_factory = session_factory

    @asynccontextmanager
    async def get_session(self):
        """Async context manager for database sessions with proper error handling"""
        correlation_id = str(uuid.uuid4())[:8]
        session = self.session_factory()

        structlog.contextvars.bind_contextvars(
            database_session=session.__hash__(),
            correlation_id=correlation_id
        )

        start_time = time.time()
        logger.info("Database session started")

        try:
            yield session
            await session.commit()
            execution_time = time.time() - start_time
            logger.info(
                "Database session completed successfully",
                execution_time=f"{execution_time:.3f}s"
            )
        except Exception as e:
            await session.rollback()
            execution_time = time.time() - start_time
            logger.error(
                "Database session failed, rolled back",
                error=str(e),
                execution_time=f"{execution_time:.3f}s"
            )
            raise
        finally:
            await session.close()

    async def execute_query_with_params(self, query: str, params: Dict[str, Any]) -> List[Dict]:
        """Execute parameterized query with proper error handling

        Note: Handles both positional ($1, $2) and named (:param_name) placeholders
        """
        async with self.get_session() as session:
            try:
                start_time = time.time()

                # Detect if params are positional (numeric keys like "1", "2") or named (string keys like "title", "artist")
                if params and all(key.isdigit() for key in params.keys()):
                    # Convert PostgreSQL-style positional params ($1, $2) to SQLAlchemy named params (:param_1, :param_2)
                    # This is needed because SQLAlchemy with asyncpg doesn't support $1 style with dict params
                    converted_query = query
                    converted_params = {}

                    # Sort params by key (numeric) to ensure correct order
                    for param_key, param_value in sorted(params.items(), key=lambda x: int(x[0])):
                        # Replace $N with :param_N
                        converted_query = converted_query.replace(f"${param_key}", f":param_{param_key}")
                        converted_params[f"param_{param_key}"] = param_value
                else:
                    # Already using named parameters - use directly
                    converted_query = query
                    converted_params = params

                result = await session.execute(text(converted_query), converted_params)
                execution_time = time.time() - start_time

                # Check if this is a SELECT query by looking at the query string
                is_select = query.strip().upper().startswith('SELECT')

                if is_select and result.returns_rows:
                    rows = [dict(row._mapping) for row in result]
                else:
                    # For INSERT/UPDATE/DELETE, don't try to fetch rows
                    rows = []

                # Note: commit is handled by the context manager

                logger.info(
                    "Query executed successfully",
                    query_hash=hash(query),
                    execution_time=f"{execution_time:.3f}s",
                    rows_returned=len(rows) if is_select else 0,
                    params_used=list(converted_params.keys())
                )

                return rows
            except Exception as e:
                logger.error(
                    "Query execution failed",
                    query_hash=hash(query),
                    error=str(e),
                    params_keys=list(params.keys())
                )
                raise

# 2025 Best Practices: Timeout Manager
class TimeoutManager:
    def __init__(self, default_timeout: float = 30.0):
        self.default_timeout = default_timeout

    @asynccontextmanager
    async def timeout(self, seconds: float = None, operation_name: str = "operation"):
        timeout_seconds = seconds or self.default_timeout
        correlation_id = str(uuid.uuid4())[:8]

        structlog.contextvars.bind_contextvars(
            timeout_seconds=timeout_seconds,
            operation_name=operation_name,
            correlation_id=correlation_id
        )

        start_time = time.time()

        try:
            async with asyncio.timeout(timeout_seconds):
                yield
                execution_time = time.time() - start_time
                logger.info(
                    "Operation completed within timeout",
                    execution_time=f"{execution_time:.3f}s"
                )
        except asyncio.TimeoutError:
            execution_time = time.time() - start_time
            logger.error(
                "Operation timed out",
                execution_time=f"{execution_time:.3f}s",
                timeout_seconds=timeout_seconds
            )
            raise

# 2025 Best Practices: Enhanced Target Track Searcher
class TargetTrackSearcher2025:
    """
    2025 Best Practices Implementation:
    - Circuit breakers for external services
    - Proper async context management
    - Comprehensive timeout handling
    - Structured logging with correlation IDs
    - Graceful error handling and fallbacks
    """

    def __init__(self, session_factory=None):
        self.db_service = AsyncDatabaseService(session_factory) if session_factory else None
        self.timeout_manager = TimeoutManager(default_timeout=15.0)

        # HTTP client with circuit breaker protection
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
        )

        # Circuit breakers for ALL data sources (2025 comprehensive configuration)
        self.circuit_breakers = {
            # Web scraping sources
            '1001tracklists': AsyncCircuitBreaker(
                "1001tracklists",
                CircuitBreakerConfig(
                    failure_threshold=2,
                    recovery_timeout=30.0,
                    expected_exception=(httpx.RequestError, httpx.HTTPStatusError, asyncio.TimeoutError)
                )
            ),
            'mixesdb': AsyncCircuitBreaker(
                "mixesdb",
                CircuitBreakerConfig(
                    failure_threshold=2,
                    recovery_timeout=30.0,
                    expected_exception=(httpx.RequestError, httpx.HTTPStatusError, asyncio.TimeoutError)
                )
            ),
            'setlistfm': AsyncCircuitBreaker(
                "setlistfm",
                CircuitBreakerConfig(
                    failure_threshold=2,
                    recovery_timeout=30.0,
                    expected_exception=(httpx.RequestError, httpx.HTTPStatusError, asyncio.TimeoutError)
                )
            ),
            # API-based scraper services
            'youtube': AsyncCircuitBreaker(
                "youtube",
                CircuitBreakerConfig(
                    failure_threshold=2,
                    recovery_timeout=30.0,
                    expected_exception=(httpx.RequestError, httpx.HTTPStatusError, asyncio.TimeoutError)
                )
            ),
            'soundcloud': AsyncCircuitBreaker(
                "soundcloud",
                CircuitBreakerConfig(
                    failure_threshold=2,
                    recovery_timeout=30.0,
                    expected_exception=(httpx.RequestError, httpx.HTTPStatusError, asyncio.TimeoutError)
                )
            ),
            'mixcloud': AsyncCircuitBreaker(
                "mixcloud",
                CircuitBreakerConfig(
                    failure_threshold=2,
                    recovery_timeout=30.0,
                    expected_exception=(httpx.RequestError, httpx.HTTPStatusError, asyncio.TimeoutError)
                )
            ),
            'reddit': AsyncCircuitBreaker(
                "reddit",
                CircuitBreakerConfig(
                    failure_threshold=2,
                    recovery_timeout=30.0,
                    expected_exception=(httpx.RequestError, httpx.HTTPStatusError, asyncio.TimeoutError)
                )
            ),
            'internetarchive': AsyncCircuitBreaker(
                "internetarchive",
                CircuitBreakerConfig(
                    failure_threshold=2,
                    recovery_timeout=30.0,
                    expected_exception=(httpx.RequestError, httpx.HTTPStatusError, asyncio.TimeoutError)
                )
            ),
            'livetracklist': AsyncCircuitBreaker(
                "livetracklist",
                CircuitBreakerConfig(
                    failure_threshold=2,
                    recovery_timeout=30.0,
                    expected_exception=(httpx.RequestError, httpx.HTTPStatusError, asyncio.TimeoutError)
                )
            ),
            'residentadvisor': AsyncCircuitBreaker(
                "residentadvisor",
                CircuitBreakerConfig(
                    failure_threshold=2,
                    recovery_timeout=30.0,
                    expected_exception=(httpx.RequestError, httpx.HTTPStatusError, asyncio.TimeoutError)
                )
            ),
            # Internal
            'database': AsyncCircuitBreaker(
                "database",
                CircuitBreakerConfig(
                    failure_threshold=3,
                    recovery_timeout=60.0,
                    expected_exception=(Exception,)
                )
            )
        }

        # Search endpoints configuration
        self.search_endpoints = {
            '1001tracklists': {
                'base_url': 'https://www.1001tracklists.com',
                'search_path': '/search/result.php',
                'search_params': 'searchTerm={query}&trackTitle={title}&trackArtist={artist}'
            },
            'mixesdb': {
                'base_url': 'https://www.mixesdb.com',
                'search_path': '/w/Search',
                'search_params': 'search={query}&type=tracklist'
            },
            'setlistfm': {
                'base_url': 'https://api.setlist.fm/rest/1.0',
                'search_path': '/search/setlists',
                'search_params': 'songName={title}&artistName={artist}',
                'headers': {
                    'x-api-key': 'YOUR_SETLISTFM_API_KEY',
                    'Accept': 'application/json'
                }
            }
        }

    async def search_for_target_tracks(self, target_tracks: List[Dict]) -> Dict[str, List[str]]:
        """
        Main search function with 2025 best practices:
        - Comprehensive error handling
        - Circuit breaker protection
        - Structured logging
        - Graceful degradation
        """
        correlation_id = str(uuid.uuid4())[:8]

        structlog.contextvars.bind_contextvars(
            operation="search_for_target_tracks",
            total_tracks=len(target_tracks),
            correlation_id=correlation_id
        )

        logger.info("Starting target track search pipeline")
        results = {}

        async with self.timeout_manager.timeout(300.0, "complete_search_pipeline"):  # 5 minute total timeout
            for i, track in enumerate(target_tracks):
                track_key = f"{track['artist']} - {track['title']}"

                structlog.contextvars.bind_contextvars(
                    track_index=i + 1,
                    track_key=track_key,
                    track_id=track.get('track_id', 'unknown')
                )

                logger.info("Processing track")

                try:
                    # Search with timeout per track
                    async with self.timeout_manager.timeout(30.0, f"search_track_{i}"):
                        playlist_urls = await self._search_track_across_platforms(track)
                        results[track_key] = playlist_urls

                        # Update database with circuit breaker protection
                        if self.db_service:
                            await self.circuit_breakers['database'].call(
                                self._update_search_results, track, playlist_urls
                            )

                        logger.info(
                            "Track search completed",
                            playlists_found=len(playlist_urls)
                        )

                except Exception as e:
                    logger.error(
                        "Track search failed",
                        error=str(e),
                        track_key=track_key
                    )
                    # Continue with next track instead of failing entire operation
                    results[track_key] = []

                # Rate limiting between tracks
                await asyncio.sleep(1.0)

        logger.info(
            "Target track search pipeline completed",
            total_results=sum(len(urls) for urls in results.values()),
            tracks_processed=len(results)
        )

        return results

    async def _search_track_across_platforms(self, track: Dict) -> List[str]:
        """Search track across all platforms with circuit breaker protection"""
        all_urls = []

        # Dynamically build search tasks from all available circuit breakers
        # Exclude 'database' (internal) and 'setlistfm' (not suitable for electronic music)
        excluded_sources = {'database', 'setlistfm'}

        search_tasks = []
        active_platforms = []

        for platform_name, circuit_breaker in self.circuit_breakers.items():
            if platform_name in excluded_sources:
                continue

            # Map circuit breaker name to search method
            search_method = getattr(self, f'_search_{platform_name}', None)
            if search_method:
                search_tasks.append(circuit_breaker.call(search_method, track))
                active_platforms.append(platform_name)
                logger.debug(
                    "Added platform to search",
                    platform=platform_name,
                    total_platforms=len(active_platforms)
                )

        logger.info(
            "Initiating multi-platform search",
            platforms=active_platforms,
            track_artist=track.get('artist'),
            track_title=track.get('title')
        )

        # Execute searches concurrently with individual error handling
        results = await asyncio.gather(*search_tasks, return_exceptions=True)

        for platform, result in zip(active_platforms, results):
            if isinstance(result, Exception):
                logger.warning(
                    "Platform search failed",
                    platform=platform,
                    error=str(result)
                )
            elif isinstance(result, list):
                all_urls.extend(result)
                logger.info(
                    "Platform search succeeded",
                    platform=platform,
                    urls_found=len(result)
                )

        return all_urls

    def _validate_urls_for_track(self, urls: List[str], track: Dict) -> List[str]:
        """
        Validate URLs to filter out non-tracklist content (2025 best practice: post-LLM validation)

        IMPORTANT: We do NOT filter by artist name because:
        - DJ name in tracklist URL ≠ track artist name
        - A DJ (e.g., "Tiesto") can play tracks by other artists (e.g., "Calvin Harris")
        - We need to scrape the tracklist to verify it contains our target track

        We only filter out obvious non-tracklist URLs like navigation, search, homepage.
        This solves the LLM hallucination issue without requiring a larger model.
        """
        validated_urls = []

        # Patterns that indicate VALID tracklist/setlist URLs
        valid_patterns = [
            '/tracklist/',
            '/setlist/',
            '/db/mix/',
            '/db/index.php',
            '/playlist/',
            '/mix/',
            '/show/',
            '/w/',  # MixesDB wiki-style tracklist pages
        ]

        # Patterns that indicate INVALID URLs (navigation, etc.)
        invalid_patterns = [
            '/search',
            '?query=',
            '/about',
            '/contact',
            '/artists',
            '/home',
            '/login',
            '/register',
            'facebook.com',
            'twitter.com',
            'instagram.com',
            'youtube.com',
        ]

        for url in urls:
            url_lower = url.lower()

            # Check if it's an invalid URL type
            if any(pattern in url_lower for pattern in invalid_patterns):
                logger.warning(
                    "URL rejected - navigation/search/social link",
                    url=url,
                    reason="invalid_url_type"
                )
                continue

            # Check if it matches valid tracklist patterns
            if any(pattern in url_lower for pattern in valid_patterns):
                validated_urls.append(url)
                logger.debug(
                    "URL validated - valid tracklist/setlist pattern",
                    url=url
                )
            else:
                logger.warning(
                    "URL rejected - does not match tracklist URL patterns",
                    url=url,
                    reason="not_tracklist_url"
                )

        return validated_urls

    async def _search_1001tracklists(self, track: Dict) -> List[str]:
        """
        Search 1001tracklists using DJ/Artist page strategy (2025 best practice)

        Instead of searching (which returns no results or navigation content),
        we browse the artist's DJ page directly and extract all their tracklist URLs.
        This gives guaranteed real URLs that actually exist on the site.

        Strategy: https://www.1001tracklists.com/dj/{artist-slug}/ → extract tracklist links
        """
        correlation_id = str(uuid.uuid4())[:8]
        structlog.contextvars.bind_contextvars(
            platform="1001tracklists",
            correlation_id=correlation_id,
            strategy="dj_page_scraping"
        )

        try:
            # Convert artist name to URL slug format
            # Example: "Calvin Harris" → "calvin-harris"
            # Example: "deadmau5" → "deadmau5"
            # Example: "Above & Beyond" → "above-beyond"
            artist_slug = (
                track['artist']
                .lower()
                .replace(' & ', '-')
                .replace(' ', '-')
                .replace('.', '')
                .replace("'", '')
                .replace(',', '')
            )

            artist_page_url = f"https://www.1001tracklists.com/dj/{artist_slug}/"

            logger.info(
                "Browsing artist/DJ page directly",
                artist=track['artist'],
                artist_slug=artist_slug,
                artist_page_url=artist_page_url
            )

            # Use direct CSS selector scraping (no AI, no browser)
            try:
                from direct_scrapers import DirectScrapers

                direct_scraper = DirectScrapers()
                normalized_urls = await direct_scraper.scrape_1001tracklists_artist_page(artist_slug)

                # Validate URLs to filter out navigation/social links
                validated_urls = self._validate_urls_for_track(normalized_urls, track)

                if validated_urls:
                    logger.info(
                        "Artist page scraping completed via CSS selectors",
                        urls_found=len(validated_urls),
                        urls_extracted=len(normalized_urls),
                        extraction_method="direct_css"
                    )
                    await direct_scraper.close()
                    return validated_urls
                else:
                    logger.warning(
                        "Artist page found but no valid tracklist URLs after filtering",
                        urls_extracted=len(normalized_urls)
                    )
                    await direct_scraper.close()
                    return []

            except Exception as scrape_error:
                logger.warning("Direct CSS scraping failed", error=str(scrape_error))
                return []

        except Exception as e:
            logger.error("Artist page scraping error", error=str(e))
            raise

    async def _search_mixesdb(self, track: Dict) -> List[str]:
        """
        Search MixesDB using insource: targeted queries (2025 best practice)

        MixesDB is a MediaWiki installation that supports advanced search operators.
        Using insource:"Artist - Track" performs a surgical lookup for that exact track
        in page content, which is much more precise than generic text searches.

        Strategy: insource:"Artist - Track" → extract page URLs containing that track
        """
        correlation_id = str(uuid.uuid4())[:8]
        structlog.contextvars.bind_contextvars(
            platform="mixesdb",
            correlation_id=correlation_id,
            strategy="insource_targeted_query"
        )

        try:
            # Build insource: query for surgical track lookup
            # Format: insource:"Artist - Track"
            # Example: insource:"Calvin Harris - Summer"
            insource_query = f'insource:"{track["artist"]} - {track["title"]}"'
            encoded_query = quote(insource_query)

            # MixesDB MediaWiki search URL with insource: operator
            search_url = f"https://www.mixesdb.com/w/index.php?search={encoded_query}"

            logger.info(
                "Searching MixesDB with insource: operator",
                artist=track['artist'],
                title=track['title'],
                insource_query=insource_query,
                search_url=search_url
            )

            # Use browser-collector to fetch search results and extract page URLs
            try:
                from direct_scrapers import DirectScrapers

                direct_scraper = DirectScrapers()
                normalized_urls = await direct_scraper.scrape_mixesdb_search(
                    artist=track['artist'],
                    title=track['title']
                )

                # Validate URLs to filter out navigation/special pages
                validated_urls = self._validate_urls_for_track(normalized_urls, track)

                if validated_urls:
                    logger.info(
                        "MixesDB insource: search completed via CSS selectors",
                        urls_found=len(validated_urls),
                        urls_extracted=len(normalized_urls),
                        extraction_method="direct_css"
                    )
                    await direct_scraper.close()
                    return validated_urls
                else:
                    logger.warning(
                        "insource: search found results but no valid URLs after filtering",
                        urls_extracted=len(normalized_urls)
                    )
                    await direct_scraper.close()
                    return []

            except Exception as scrape_error:
                logger.warning("Direct CSS scraping failed for MixesDB", error=str(scrape_error))
                return []

        except Exception as e:
            logger.error("MixesDB insource: search error", error=str(e))
            raise

    async def _search_setlistfm(self, track: Dict) -> List[str]:
        """
        Search Setlist.fm using REST API (2025 best practice: API-first approach)

        Uses official setlist.fm API instead of browser scraping.
        Free tier: 1000 requests/day, structured JSON responses, no LLM needed.
        """
        correlation_id = str(uuid.uuid4())[:8]
        structlog.contextvars.bind_contextvars(
            platform="setlistfm",
            correlation_id=correlation_id
        )

        try:
            # Get API key from environment
            import os
            api_key = os.getenv('SETLISTFM_API_KEY')

            if not api_key:
                logger.error("SETLISTFM_API_KEY not configured")
                return []

            logger.info(
                "Searching platform via REST API",
                song_name=track['title'],
                artist_name=track['artist']
            )

            # Use official setlist.fm REST API
            try:
                import httpx

                # Search for setlists containing this track
                # API: https://api.setlist.fm/docs/1.0/resource__search_setlists.html
                search_url = "https://api.setlist.fm/rest/1.0/search/setlists"
                params = {
                    'songName': track['title'],
                    'artistName': track['artist'],
                    'p': 1  # First page
                }

                headers = {
                    'x-api-key': api_key,
                    'Accept': 'application/json'
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(search_url, params=params, headers=headers)
                    response.raise_for_status()

                    data = response.json()
                    setlists = data.get('setlist', [])

                    if not setlists:
                        logger.info("No setlists found via API")
                        return []

                    # Extract URLs directly from API response (API provides correct URL format)
                    urls = []
                    for setlist in setlists[:10]:  # Limit to 10 results
                        # API response includes pre-formatted URL - use it directly!
                        # Format: https://www.setlist.fm/setlist/{artist}/{year}/{venue-slug}-{id}.html
                        url = setlist.get('url')
                        if url:
                            urls.append(url)

                            logger.debug(
                                "Found setlist via API",
                                setlist_id=setlist.get('id'),
                                artist=setlist.get('artist', {}).get('name'),
                                venue=setlist.get('venue', {}).get('name'),
                                date=setlist.get('eventDate'),
                                url=url
                            )

                    logger.info(
                        "Platform search completed via API",
                        urls_found=len(urls),
                        method="rest_api",
                        total_setlists=len(setlists)
                    )

                    return urls

            except httpx.HTTPError as api_error:
                logger.error("Setlist.fm API call failed", error=str(api_error))
                return []

        except Exception as e:
            logger.error("Platform search error", error=str(e))
            raise

    async def _update_search_results(self, track: Dict, urls: List[str]):
        """Update database with search results using 2025 async patterns"""
        if not self.db_service:
            logger.warning("No database service available")
            return

        correlation_id = str(uuid.uuid4())[:8]
        structlog.contextvars.bind_contextvars(
            operation="update_search_results",
            track_title=track['title'],
            track_artist=track['artist'],
            urls_count=len(urls),
            correlation_id=correlation_id
        )

        try:
            # Insert search results with proper parameter binding
            insert_query = """
                INSERT INTO target_track_searches
                (target_title, target_artist, search_query, scraper_name,
                 results_found, playlists_containing, search_timestamp)
                VALUES (:title, :artist, :search_query, :scraper_name,
                        :results_found, :playlists_containing, :search_timestamp)
            """

            insert_params = {
                'title': track['title'],
                'artist': track['artist'],
                'search_query': f"{track['artist']} {track['title']}",
                'scraper_name': 'orchestrator_search_2025',
                'results_found': len(urls),
                'playlists_containing': len(urls),
                'search_timestamp': datetime.now()
            }

            await self.db_service.execute_query_with_params(insert_query, insert_params)

            # Update target tracks with last searched timestamp
            update_query = """
                UPDATE target_tracks
                SET last_searched = NOW(),
                    playlists_found = playlists_found + :playlists_count
                WHERE title = :title AND artist = :artist
            """

            update_params = {
                'playlists_count': len(urls),
                'title': track['title'],
                'artist': track['artist']
            }

            await self.db_service.execute_query_with_params(update_query, update_params)

            logger.info("Database update completed successfully")

        except Exception as e:
            logger.error("Database update failed", error=str(e))
            raise

    async def get_unscraped_playlists(self, urls: List[str]) -> List[str]:
        """Filter out already-scraped playlists with proper async patterns"""
        if not self.db_service or not urls:
            return urls

        correlation_id = str(uuid.uuid4())[:8]
        structlog.contextvars.bind_contextvars(
            operation="get_unscraped_playlists",
            input_urls_count=len(urls),
            correlation_id=correlation_id
        )

        try:
            # Use proper SQLAlchemy parameter binding with ANY() for arrays
            query = """
                SELECT source_url
                FROM playlists
                WHERE source_url = ANY(:url_array)
            """

            params = {'url_array': urls}

            existing_rows = await self.db_service.execute_query_with_params(query, params)
            existing_urls = {row['source_url'] for row in existing_rows}

            new_urls = [url for url in urls if url not in existing_urls]

            logger.info(
                "Playlist filtering completed",
                existing_urls_count=len(existing_urls),
                new_urls_count=len(new_urls)
            )

            return new_urls

        except Exception as e:
            logger.error("Playlist filtering failed", error=str(e))
            # Return original URLs on error to prevent data loss
            return urls

    async def create_scraping_tasks(self, search_results: Dict[str, List[str]]) -> List[Dict]:
        """Convert search results into scraping tasks with enhanced metadata"""
        correlation_id = str(uuid.uuid4())[:8]
        structlog.contextvars.bind_contextvars(
            operation="create_scraping_tasks",
            correlation_id=correlation_id
        )

        tasks = []

        for track_key, urls in search_results.items():
            # Filter out already-scraped playlists
            new_urls = await self.get_unscraped_playlists(urls)

            for url in new_urls:
                scraper = self._determine_scraper(url)

                task = {
                    'id': f"{scraper}_{int(time.time() * 1000000)}",
                    'url': url,
                    'scraper': scraper,
                    'discovered_via': track_key,
                    'priority': 'high' if 'high' in track_key.lower() else 'normal',
                    'created_at': datetime.now().isoformat(),
                    'correlation_id': correlation_id,
                    'retry_count': 0,
                    'max_retries': 3
                }

                tasks.append(task)

        logger.info(
            "Scraping tasks created",
            total_tasks=len(tasks),
            tasks_by_scraper={
                scraper: sum(1 for t in tasks if t['scraper'] == scraper)
                for scraper in set(t['scraper'] for t in tasks)
            }
        )

        return tasks

    def _determine_scraper(self, url: str) -> str:
        """Determine which scraper to use based on URL"""
        if '1001tracklists.com' in url:
            return '1001tracklists'
        elif 'mixesdb.com' in url:
            return 'mixesdb'
        elif 'setlist.fm' in url:
            return 'setlistfm'
        else:
            return 'generic'

    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check for monitoring"""
        correlation_id = str(uuid.uuid4())[:8]

        health_status = {
            'service': 'target_track_searcher_2025',
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'correlation_id': correlation_id,
            'circuit_breakers': {},
            'checks': {}
        }

        # Check circuit breaker states
        for name, cb in self.circuit_breakers.items():
            health_status['circuit_breakers'][name] = {
                'state': cb.state.value,
                'failure_count': cb.failure_count,
                'last_failure_time': cb.last_failure_time
            }

        # Database health check
        if self.db_service:
            try:
                start_time = time.time()
                await self.db_service.execute_query_with_params("SELECT 1 as health_check", {})
                db_response_time = time.time() - start_time

                health_status['checks']['database'] = {
                    'status': 'healthy',
                    'response_time': f"{db_response_time:.3f}s"
                }
            except Exception as e:
                health_status['checks']['database'] = {
                    'status': 'unhealthy',
                    'error': str(e)
                }
                health_status['status'] = 'unhealthy'

        # HTTP client health check
        try:
            await self.http_client.get('https://httpbin.org/status/200', timeout=5.0)
            health_status['checks']['http_client'] = {'status': 'healthy'}
        except Exception as e:
            health_status['checks']['http_client'] = {
                'status': 'unhealthy',
                'error': str(e)
            }

        return health_status

    async def close(self):
        """Graceful shutdown with proper cleanup"""
        correlation_id = str(uuid.uuid4())[:8]
        structlog.contextvars.bind_contextvars(
            operation="graceful_shutdown",
            correlation_id=correlation_id
        )

        logger.info("Starting graceful shutdown")

        try:
            await self.http_client.aclose()
            logger.info("HTTP client closed")
        except Exception as e:
            logger.error("Error closing HTTP client", error=str(e))

        logger.info("Graceful shutdown completed")


# 2025 Best Practices: Enhanced Search Orchestrator
class SearchOrchestrator2025:
    """
    Enhanced orchestrator with 2025 best practices:
    - Comprehensive error handling
    - Circuit breaker integration
    - Structured logging
    - Graceful degradation
    """

    def __init__(self, session_factory, redis_client, message_queue):
        self.session_factory = session_factory
        self.redis = redis_client
        self.queue = message_queue
        self.searcher = TargetTrackSearcher2025(session_factory)
        self.db_service = AsyncDatabaseService(session_factory)
        self.timeout_manager = TimeoutManager(default_timeout=60.0)

    async def execute_search_pipeline(
        self,
        force_rescrape: bool = False,
        clear_last_searched: bool = False,
        track_id: str = None,
        artist: str = None,
        title: str = None,
        limit: int = 20
    ):
        """Enhanced pipeline with comprehensive error handling and monitoring

        Args:
            force_rescrape: If True, bypass 24-hour rate limit and scrape all active tracks
            clear_last_searched: If True, clear last_searched timestamps before scraping
            track_id: If provided, scrape only this specific track
            artist: If provided, filter tracks by artist
            title: If provided, filter tracks by title
            limit: Maximum number of tracks to process
        """
        correlation_id = str(uuid.uuid4())[:8]

        structlog.contextvars.bind_contextvars(
            operation="execute_search_pipeline",
            correlation_id=correlation_id
        )

        logger.info(
            "Starting enhanced target track search pipeline",
            force_rescrape=force_rescrape,
            clear_last_searched=clear_last_searched,
            track_id=track_id,
            artist=artist,
            title=title,
            limit=limit
        )

        try:
            async with self.timeout_manager.timeout(600.0, "complete_pipeline"):  # 10 minute timeout
                # Step 1: Load active target tracks
                target_tracks = await self.load_active_targets(
                    force_rescrape=force_rescrape,
                    clear_last_searched=clear_last_searched,
                    track_id=track_id,
                    artist=artist,
                    title=title,
                    limit=limit
                )

                if not target_tracks:
                    logger.info("No active target tracks found, pipeline complete")
                    return

                # Step 2: Search for playlists
                search_results = await self.searcher.search_for_target_tracks(target_tracks)

                # Step 3: Create scraping tasks
                scraping_tasks = await self.searcher.create_scraping_tasks(search_results)

                # Step 4: Queue tasks for scrapers
                await self.queue_scraping_tasks(scraping_tasks)

                # Step 5: Update statistics
                await self.update_target_statistics(search_results)

                logger.info(
                    "Enhanced search pipeline completed successfully",
                    target_tracks_processed=len(target_tracks),
                    scraping_tasks_created=len(scraping_tasks),
                    total_urls_found=sum(len(urls) for urls in search_results.values())
                )

        except Exception as e:
            logger.error(
                "Search pipeline failed",
                error=str(e),
                error_type=type(e).__name__
            )
            raise

    async def load_active_targets(
        self,
        force_rescrape: bool = False,
        clear_last_searched: bool = False,
        track_id: str = None,
        artist: str = None,
        title: str = None,
        limit: int = 20
    ) -> List[Dict]:
        """Load target tracks with proper error handling

        Args:
            force_rescrape: If True, bypass 24-hour rate limit
            clear_last_searched: If True, clear last_searched timestamps first
            track_id: If provided, load only this specific track
            artist: If provided, filter tracks by artist
            title: If provided, filter tracks by title
            limit: Maximum number of tracks to load
        """
        correlation_id = str(uuid.uuid4())[:8]
        structlog.contextvars.bind_contextvars(
            operation="load_active_targets",
            correlation_id=correlation_id
        )

        try:
            # Step 1: Optionally clear last_searched timestamps
            if clear_last_searched:
                logger.info("Clearing last_searched timestamps for active tracks")
                clear_conditions = ["is_active = true"]
                clear_params = {}

                if track_id:
                    clear_conditions.append("track_id = $1")
                    clear_params = {"1": track_id}
                elif artist:
                    clear_conditions.append("LOWER(artist) = LOWER($1)")
                    clear_params = {"1": artist}
                elif title:
                    clear_conditions.append("LOWER(title) = LOWER($1)")
                    clear_params = {"1": title}

                clear_query = f"""
                    UPDATE target_tracks
                    SET last_searched = NULL
                    WHERE {' AND '.join(clear_conditions)}
                """
                await self.db_service.execute_query_with_params(clear_query, clear_params)
                logger.info("Timestamps cleared successfully")

            # Step 2: Build query based on filters
            where_conditions = ["is_active = true"]
            query_params = {}
            param_counter = 1

            # Add specific track filter
            if track_id:
                where_conditions.append(f"track_id = ${param_counter}")
                query_params[str(param_counter)] = track_id
                param_counter += 1
                logger.info(f"Filtering for specific track_id: {track_id}")

            # Add artist filter
            if artist:
                where_conditions.append(f"LOWER(artist) = LOWER(${param_counter})")
                query_params[str(param_counter)] = artist
                param_counter += 1
                logger.info(f"Filtering for artist: {artist}")

            # Add title filter
            if title:
                where_conditions.append(f"LOWER(title) = LOWER(${param_counter})")
                query_params[str(param_counter)] = title
                param_counter += 1
                logger.info(f"Filtering for title: {title}")

            # Add time filter (unless force_rescrape is enabled)
            # Use randomized interval between 50-70 minutes to prevent overwhelming the system
            # This allows approximately 10 tracks per hour (60 minutes / 6 minutes average)
            if not force_rescrape:
                # Random interval between 50-70 minutes per track
                import random
                random_minutes = random.randint(50, 70)
                where_conditions.append(f"(last_searched IS NULL OR last_searched < NOW() - INTERVAL '{random_minutes} minutes')")
                logger.info(f"Applying randomized rate limit: {random_minutes} minutes between scrapes")
            else:
                logger.info("Force rescrape enabled - bypassing rate limit")

            # Build final query
            query = f"""
                SELECT track_id, title, artist, priority, last_searched
                FROM target_tracks
                WHERE {' AND '.join(where_conditions)}
                ORDER BY
                    CASE priority
                        WHEN 'high' THEN 1
                        WHEN 'medium' THEN 2
                        ELSE 3
                    END,
                    last_searched ASC NULLS FIRST
                LIMIT {limit}
            """

            rows = await self.db_service.execute_query_with_params(query, query_params)

            target_tracks = [
                {
                    'track_id': row['track_id'],
                    'title': row['title'],
                    'artist': row['artist'],
                    'priority': row['priority']
                }
                for row in rows
            ]

            logger.info(
                "Active targets loaded successfully",
                count=len(target_tracks),
                force_rescrape=force_rescrape,
                clear_last_searched=clear_last_searched,
                track_id=track_id,
                artist=artist,
                title=title,
                limit=limit
            )
            return target_tracks

        except Exception as e:
            logger.error("Failed to load active targets", error=str(e))
            raise

    async def queue_scraping_tasks(self, tasks: List[Dict]):
        """Queue scraping tasks with enhanced error handling"""
        correlation_id = str(uuid.uuid4())[:8]
        structlog.contextvars.bind_contextvars(
            operation="queue_scraping_tasks",
            correlation_id=correlation_id
        )

        queued_count = 0
        failed_count = 0

        for task in tasks:
            try:
                # Add to Redis queue (using synchronous Redis client)
                self.redis.lpush('scraping_queue', json.dumps(task))

                # Also publish to RabbitMQ if configured
                if self.queue:
                    await self.queue.publish(
                        exchange='scrapers',
                        routing_key=f"scraper.{task['scraper']}",
                        body=json.dumps(task)
                    )

                queued_count += 1

            except Exception as e:
                failed_count += 1
                logger.warning(
                    "Failed to queue task",
                    task_id=task.get('id', 'unknown'),
                    error=str(e)
                )

        logger.info(
            "Task queuing completed",
            queued_successfully=queued_count,
            failed_to_queue=failed_count,
            total_tasks=len(tasks)
        )

    async def update_target_statistics(self, search_results: Dict[str, List[str]]):
        """Update target track statistics with proper error handling"""
        correlation_id = str(uuid.uuid4())[:8]
        structlog.contextvars.bind_contextvars(
            operation="update_target_statistics",
            correlation_id=correlation_id
        )

        updated_count = 0
        failed_count = 0

        for track_key, urls in search_results.items():
            try:
                # Parse track key
                parts = track_key.split(' - ', 1)
                if len(parts) == 2:
                    artist, title = parts

                    query = """
                        UPDATE target_tracks
                        SET last_searched = NOW(),
                            playlists_found = playlists_found + :playlists_count
                        WHERE artist = :artist AND title = :title
                    """

                    params = {
                        'playlists_count': len(urls),
                        'artist': artist,
                        'title': title
                    }

                    await self.db_service.execute_query_with_params(query, params)
                    updated_count += 1

            except Exception as e:
                failed_count += 1
                logger.warning(
                    "Failed to update track statistics",
                    track_key=track_key,
                    error=str(e)
                )

        logger.info(
            "Target statistics update completed",
            updated_successfully=updated_count,
            failed_to_update=failed_count
        )

    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check"""
        return await self.searcher.health_check()

    async def close(self):
        """Graceful shutdown"""
        await self.searcher.close()