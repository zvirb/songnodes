"""
Automated Scraping Scheduler
Implements intelligent interval-based scraping with robots.txt compliance
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
import os
import random
from pathlib import Path

import asyncpg
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.job import Job

from robots_parser import RobotsChecker, SmartScheduler

logger = logging.getLogger(__name__)


@dataclass
class ScraperConfig:
    """Configuration for a specific scraper"""
    name: str
    domains: List[str]
    base_url_patterns: List[str]
    min_interval: int = 3600  # Minimum 1 hour between runs
    max_interval: int = 86400  # Maximum 24 hours between runs
    priority: str = "medium"
    enabled: bool = True
    respect_robots: bool = True
    adaptive_scheduling: bool = True
    max_concurrent_pages: int = 1
    retry_on_failure: bool = True

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "domains": self.domains,
            "base_url_patterns": self.base_url_patterns,
            "min_interval": self.min_interval,
            "max_interval": self.max_interval,
            "priority": self.priority,
            "enabled": self.enabled,
            "respect_robots": self.respect_robots,
            "adaptive_scheduling": self.adaptive_scheduling,
            "max_concurrent_pages": self.max_concurrent_pages,
            "retry_on_failure": self.retry_on_failure
        }


class AutomatedScrapingScheduler:
    """
    Manages automated scraping with intelligent scheduling based on:
    - Robots.txt compliance
    - Server response times
    - Rate limit detection
    - Domain health metrics
    """

    # Default scraper configurations
    SCRAPER_CONFIGS = {
        "1001tracklists": ScraperConfig(
            name="1001tracklists",
            domains=["www.1001tracklists.com"],
            base_url_patterns=[
                "https://www.1001tracklists.com/tracklist/",
                "https://www.1001tracklists.com/dj/"
            ],
            min_interval=7200,  # 2 hours minimum
            max_interval=43200,  # 12 hours maximum
            priority="high"
        ),
        "mixesdb": ScraperConfig(
            name="mixesdb",
            domains=["www.mixesdb.com"],
            base_url_patterns=[
                "https://www.mixesdb.com/w/",
                "https://www.mixesdb.com/db/"
            ],
            min_interval=10800,  # 3 hours minimum
            max_interval=86400,  # 24 hours maximum
            priority="medium"
        ),
        "setlistfm": ScraperConfig(
            name="setlistfm",
            domains=["www.setlist.fm"],
            base_url_patterns=[
                "https://www.setlist.fm/setlist/",
                "https://www.setlist.fm/artist/"
            ],
            min_interval=14400,  # 4 hours minimum
            max_interval=172800,  # 48 hours maximum
            priority="low"
        ),
        "reddit": ScraperConfig(
            name="reddit",
            domains=["www.reddit.com", "old.reddit.com"],
            base_url_patterns=[
                "https://www.reddit.com/r/EDM/",
                "https://www.reddit.com/r/ElectronicMusic/",
                "https://www.reddit.com/r/Techno/"
            ],
            min_interval=3600,  # 1 hour minimum (Reddit API friendly)
            max_interval=21600,  # 6 hours maximum
            priority="medium"
        )
    }

    def __init__(self, redis_client, scraper_service_urls: Dict[str, str]):
        """
        Initialize the automated scheduler

        Args:
            redis_client: Redis client for state persistence
            scraper_service_urls: Mapping of scraper names to their service URLs
        """
        self.redis_client = redis_client
        self.scraper_service_urls = scraper_service_urls
        self.scheduler = AsyncIOScheduler()
        self.robots_checker = RobotsChecker()
        self.smart_scheduler = SmartScheduler(self.robots_checker)
        self.scraper_configs = self.SCRAPER_CONFIGS.copy()
        self.job_history: Dict[str, List[Dict]] = {}

        # Database connection settings for target tracks
        self.db_config = {
            'host': os.getenv('DB_HOST', 'musicdb-postgres'),
            'port': int(os.getenv('DB_PORT', 5432)),
            'database': os.getenv('DB_NAME', 'musicdb'),
            'user': os.getenv('DB_USER', 'musicdb_user'),
            'password': os.getenv('DB_PASSWORD', '7D82_xqNs55tGyk')
        }

        # Load target tracks for scraping
        self.target_tracks = []
        self.current_track_index = 0
        # Initialize with empty list, will be loaded async on startup

        # Load custom configurations if they exist
        self._load_custom_configs()

    async def _load_target_tracks_from_database(self):
        """Load target tracks from database"""
        try:
            logger.info("Loading target tracks from database...")
            conn = await asyncpg.connect(**self.db_config)

            try:
                # Query active target tracks from database
                query = """
                    SELECT title, artist, priority, search_terms, genres
                    FROM target_tracks
                    WHERE is_active = TRUE
                    ORDER BY priority DESC, title
                """

                rows = await conn.fetch(query)

                # Convert database rows to track dictionaries
                self.target_tracks = []
                for row in rows:
                    track = {
                        'title': row['title'],
                        'primary_artist': row['artist'],
                        'artists': [row['artist']] if row['artist'] else [],
                        'priority': row['priority'] or 'medium',
                        'search_terms': row['search_terms'] if row['search_terms'] else [],
                        'genres': row['genres'] if row['genres'] else []
                    }
                    self.target_tracks.append(track)

                logger.info(f"Loaded {len(self.target_tracks)} target tracks from database")

            finally:
                await conn.close()

            # Load rotation state from Redis
            try:
                saved_index = self.redis_client.get("scraper:current_track_index")
                if saved_index:
                    self.current_track_index = int(saved_index) % len(self.target_tracks) if self.target_tracks else 0
                else:
                    # Start from random position to avoid always starting with same tracks
                    self.current_track_index = random.randint(0, len(self.target_tracks) - 1) if self.target_tracks else 0
            except Exception as e:
                logger.warning(f"Could not load track rotation state: {e}")
                self.current_track_index = 0

            logger.info(f"Using {len(self.target_tracks)} target tracks, starting from index {self.current_track_index}")

        except Exception as e:
            logger.error(f"Failed to load target tracks from database: {e}")
            self.target_tracks = []
            self.current_track_index = 0

    def _load_custom_configs(self):
        """Load custom scraper configurations from Redis or environment"""
        try:
            custom_configs = self.redis_client.get("scraper:configs")
            if custom_configs:
                configs = json.loads(custom_configs)
                for name, config_dict in configs.items():
                    if name in self.scraper_configs:
                        # Update existing config
                        for key, value in config_dict.items():
                            if hasattr(self.scraper_configs[name], key):
                                setattr(self.scraper_configs[name], key, value)
                    else:
                        # Create new config
                        self.scraper_configs[name] = ScraperConfig(**config_dict)
                logger.info(f"Loaded custom configurations for {len(configs)} scrapers")
        except Exception as e:
            logger.warning(f"Could not load custom configs: {e}")

    def get_next_track_batch(self, batch_size: int = 10) -> List[Dict]:
        """
        Get next batch of tracks with rotation

        Args:
            batch_size: Number of tracks to return

        Returns:
            List of track dictionaries
        """
        if not self.target_tracks:
            logger.warning("No target tracks available")
            return []

        tracks = []
        for i in range(batch_size):
            if self.current_track_index >= len(self.target_tracks):
                self.current_track_index = 0  # Wrap around

            tracks.append(self.target_tracks[self.current_track_index])
            self.current_track_index += 1

        # Save rotation state to Redis
        try:
            self.redis_client.set("scraper:current_track_index", self.current_track_index)
        except Exception as e:
            logger.warning(f"Could not save track rotation state: {e}")

        logger.info(f"Retrieved {len(tracks)} tracks, current index: {self.current_track_index}/{len(self.target_tracks)}")
        return tracks

    def generate_search_urls(self, track: Dict, scraper_name: str) -> List[str]:
        """
        Generate search URLs for a specific track based on scraper type

        Args:
            track: Track dictionary with title, artists, etc.
            scraper_name: Name of the scraper (1001tracklists, mixesdb, etc.)

        Returns:
            List of search URLs
        """
        urls = []

        # Get search terms
        title = track.get("title", "")
        artists = track.get("artists", [])
        primary_artist = track.get("primary_artist", "")
        search_terms = track.get("search_terms", [])

        # Combine all search terms
        all_terms = [title]
        if primary_artist:
            all_terms.append(primary_artist)
        all_terms.extend(artists)
        all_terms.extend(search_terms)

        # Clean and prepare search query
        search_query = " ".join(all_terms).replace(" & ", " ").replace("&", "")

        if scraper_name == "1001tracklists":
            # 1001tracklists search URLs
            encoded_query = search_query.replace(" ", "%20")
            urls.append(f"https://www.1001tracklists.com/search/?q={encoded_query}")

            # Also search by artist
            if primary_artist:
                encoded_artist = primary_artist.replace(" ", "%20")
                urls.append(f"https://www.1001tracklists.com/search/?q={encoded_artist}")

        elif scraper_name == "mixesdb":
            # MixesDB search URLs
            encoded_query = search_query.replace(" ", "+")
            urls.append(f"https://www.mixesdb.com/db/index.php/search?q={encoded_query}")

        elif scraper_name == "setlistfm":
            # Setlist.fm search URLs
            encoded_query = search_query.replace(" ", "%20")
            urls.append(f"https://www.setlist.fm/search?query={encoded_query}")

            # Search by artist
            if primary_artist:
                encoded_artist = primary_artist.replace(" ", "%20")
                urls.append(f"https://www.setlist.fm/search?query={encoded_artist}")

        return urls

    async def calculate_next_interval(self, scraper_name: str) -> int:
        """
        Calculate the next scraping interval based on:
        - Robots.txt crawl delay
        - Domain health metrics
        - Historical performance

        Returns interval in seconds
        """
        config = self.scraper_configs.get(scraper_name)
        if not config:
            return 3600  # Default 1 hour

        base_interval = config.min_interval

        if config.adaptive_scheduling:
            # Get domain health metrics
            domain_healths = []
            for domain in config.domains:
                health = self.robots_checker.get_domain_health(domain)
                domain_healths.append(health)

            # Calculate average success rate
            total_requests = sum(h["total_requests"] for h in domain_healths)
            successful_requests = sum(h["successful_requests"] for h in domain_healths)

            if total_requests > 0:
                success_rate = successful_requests / total_requests

                # Adjust interval based on success rate
                if success_rate > 0.95:
                    # Very healthy - can use minimum interval
                    interval = config.min_interval
                elif success_rate > 0.8:
                    # Healthy - use moderate interval
                    interval = config.min_interval * 1.5
                elif success_rate > 0.5:
                    # Some issues - increase interval
                    interval = config.min_interval * 2
                else:
                    # Many failures - use conservative interval
                    interval = min(config.max_interval, config.min_interval * 4)
            else:
                # No history - use moderate interval
                interval = (config.min_interval + config.max_interval) / 2

            # Check for rate limit hits
            rate_limit_hits = sum(h["rate_limit_hits"] for h in domain_healths)
            if rate_limit_hits > 0:
                # Exponential backoff for rate limits
                interval *= min(4, 1.5 ** rate_limit_hits)

            # Get crawl delays from robots.txt
            total_delay = 0
            for domain in config.domains:
                try:
                    rules = await self.robots_checker.get_rules(f"https://{domain}/")
                    if rules:
                        total_delay += rules.get_delay()
                except:
                    total_delay += 10  # Default conservative delay

            # Average delay across domains
            avg_robot_delay = total_delay / len(config.domains) if config.domains else 10

            # Ensure we respect robots.txt minimum delay
            # For a full scraping run, multiply by expected number of requests
            expected_requests = 100  # Estimate
            min_time_needed = avg_robot_delay * expected_requests

            # Use the larger of calculated interval and minimum time needed
            interval = max(interval, min_time_needed)

        else:
            # Non-adaptive - use configured minimum
            interval = config.min_interval

        # Ensure within configured bounds
        return int(max(config.min_interval, min(config.max_interval, interval)))

    async def schedule_scraper(self, scraper_name: str):
        """Schedule a scraper with intelligent intervals"""
        config = self.scraper_configs.get(scraper_name)
        if not config or not config.enabled:
            logger.info(f"Scraper {scraper_name} is disabled or not configured")
            return

        # Calculate initial interval
        interval = await self.calculate_next_interval(scraper_name)

        # Create job
        job = self.scheduler.add_job(
            func=self._run_scraper,
            trigger=IntervalTrigger(seconds=interval),
            args=[scraper_name],
            id=f"scraper_{scraper_name}",
            name=f"Automated scraping for {scraper_name}",
            replace_existing=True,
            max_instances=1,  # Prevent overlapping runs
            misfire_grace_time=300  # 5 minute grace period
        )

        logger.info(f"Scheduled {scraper_name} with initial interval of {interval}s ({interval/3600:.1f} hours)")

        # Store initial schedule info
        self._record_job_schedule(scraper_name, interval, "scheduled")

        return job

    async def _run_scraper(self, scraper_name: str):
        """Execute a scraping job with robots.txt compliance"""
        start_time = datetime.now()
        config = self.scraper_configs.get(scraper_name)

        if not config or not config.enabled:
            logger.warning(f"Scraper {scraper_name} is disabled, skipping run")
            return

        # Record the start time immediately to prevent overlapping executions
        try:
            last_run_key = f"scraper:last_run:{scraper_name}"
            self.redis_client.set(last_run_key, start_time.isoformat())
        except Exception as e:
            logger.warning(f"Could not record start time for {scraper_name}: {e}")

        logger.info(f"Starting automated scraping run for {scraper_name}")

        try:
            # Check if scraper service is available
            service_url = self.scraper_service_urls.get(scraper_name)
            if not service_url:
                logger.error(f"No service URL configured for {scraper_name}")
                return

            # Create scraping tasks based on target tracks
            tasks_created = 0
            tasks_blocked = 0

            # Get batch of tracks to scrape
            batch_size = 5  # Process 5 tracks per run to avoid overwhelming
            tracks_batch = self.get_next_track_batch(batch_size)

            if not tracks_batch:
                logger.warning(f"No target tracks available for {scraper_name}")
                return

            logger.info(f"Processing {len(tracks_batch)} tracks for {scraper_name}")

            for track in tracks_batch:
                # Generate search URLs for this track
                search_urls = self.generate_search_urls(track, scraper_name)

                for url in search_urls:
                    if config.respect_robots:
                        # Check if URL is allowed by robots.txt
                        is_allowed = await self.robots_checker.is_allowed(url)
                        if not is_allowed:
                            logger.warning(f"URL {url} blocked by robots.txt")
                            tasks_blocked += 1
                            continue

                        # Wait for rate limit
                        await self.robots_checker.wait_if_needed(url)

                    # Add task to smart scheduler with track info
                    task_data = {
                        "scraper": scraper_name,
                        "url": url,
                        "priority": config.priority,
                        "timestamp": datetime.now().isoformat(),
                        "target_track": {
                            "title": track.get("title"),
                            "primary_artist": track.get("primary_artist"),
                            "artists": track.get("artists", [])
                        }
                    }

                    self.smart_scheduler.add_task(url, task_data)
                    tasks_created += 1

            logger.info(f"Created {tasks_created} scraping tasks for {scraper_name} from {len(tracks_batch)} tracks")

            # Process tasks with rate limiting
            processed = 0
            errors = 0

            while True:
                task = await self.smart_scheduler.get_next_task()
                if not task:
                    break

                try:
                    # Execute scraping task
                    response_time = await self._execute_scraping_task(
                        service_url,
                        task["data"]
                    )

                    # Update domain statistics
                    self.robots_checker.update_domain_stats(
                        task["url"],
                        response_time,
                        is_error=False
                    )

                    processed += 1

                except Exception as e:
                    logger.error(f"Error executing task for {task['url']}: {e}")

                    # Update statistics with error
                    is_rate_limit = "rate" in str(e).lower() or "429" in str(e)
                    self.robots_checker.update_domain_stats(
                        task["url"],
                        0,
                        is_error=True,
                        is_rate_limit=is_rate_limit
                    )

                    errors += 1

                finally:
                    # Mark domain as available for next task
                    self.smart_scheduler.mark_task_complete(task["domain"])

            # Record job completion
            duration = (datetime.now() - start_time).total_seconds()
            self._record_job_completion(
                scraper_name,
                tasks_created,
                processed,
                errors,
                tasks_blocked,
                duration
            )

            # Calculate and update next interval
            next_interval = await self.calculate_next_interval(scraper_name)
            await self._update_job_interval(scraper_name, next_interval)

            logger.info(
                f"Completed {scraper_name} scraping: "
                f"{processed}/{tasks_created} tasks processed, "
                f"{errors} errors, {tasks_blocked} blocked by robots.txt, "
                f"took {duration:.1f}s"
            )

        except Exception as e:
            logger.error(f"Fatal error in {scraper_name} scraping run: {e}")
            self._record_job_completion(
                scraper_name, 0, 0, 1, 0,
                (datetime.now() - start_time).total_seconds()
            )

    async def _execute_scraping_task(self, service_url: str, task_data: Dict) -> float:
        """Execute a single scraping task and return response time"""
        import httpx
        import time

        start = time.time()

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{service_url}/scrape",
                json=task_data
            )
            response.raise_for_status()

        return time.time() - start

    async def _update_job_interval(self, scraper_name: str, new_interval: int):
        """Update the interval for a scheduled job"""
        job_id = f"scraper_{scraper_name}"

        try:
            # Remove existing job
            self.scheduler.remove_job(job_id)

            # Reschedule with new interval
            self.scheduler.add_job(
                func=self._run_scraper,
                trigger=IntervalTrigger(seconds=new_interval),
                args=[scraper_name],
                id=job_id,
                name=f"Automated scraping for {scraper_name}",
                max_instances=1,
                misfire_grace_time=300
            )

            logger.info(f"Updated {scraper_name} interval to {new_interval}s ({new_interval/3600:.1f} hours)")

        except Exception as e:
            logger.error(f"Failed to update interval for {scraper_name}: {e}")

    def _record_job_schedule(self, scraper_name: str, interval: int, status: str):
        """Record job scheduling information"""
        record = {
            "timestamp": datetime.now().isoformat(),
            "scraper": scraper_name,
            "interval": interval,
            "status": status
        }

        # Store in Redis
        key = f"scraper:schedule:{scraper_name}"
        self.redis_client.lpush(key, json.dumps(record))
        self.redis_client.ltrim(key, 0, 99)  # Keep last 100 records

    def _record_job_completion(self, scraper_name: str, tasks_created: int,
                              processed: int, errors: int, blocked: int, duration: float):
        """Record job completion statistics"""
        record = {
            "timestamp": datetime.now().isoformat(),
            "scraper": scraper_name,
            "tasks_created": tasks_created,
            "tasks_processed": processed,
            "errors": errors,
            "blocked_by_robots": blocked,
            "duration": duration,
            "success_rate": (processed / max(1, tasks_created)) * 100
        }

        # Store in Redis
        key = f"scraper:history:{scraper_name}"
        self.redis_client.lpush(key, json.dumps(record))
        self.redis_client.ltrim(key, 0, 999)  # Keep last 1000 records

        # Update job history in memory
        if scraper_name not in self.job_history:
            self.job_history[scraper_name] = []
        self.job_history[scraper_name].append(record)
        self.job_history[scraper_name] = self.job_history[scraper_name][-100:]  # Keep last 100

    async def _check_and_run_overdue_tasks(self):
        """Check for overdue tasks and execute them immediately"""
        logger.info("Checking for overdue scraping tasks...")

        current_time = datetime.now()
        overdue_scrapers = []

        for scraper_name, config in self.scraper_configs.items():
            if not config.enabled:
                continue

            # Get last run timestamp from Redis
            try:
                last_run_key = f"scraper:last_run:{scraper_name}"
                last_run_str = self.redis_client.get(last_run_key)

                if last_run_str:
                    last_run = datetime.fromisoformat(last_run_str.decode() if isinstance(last_run_str, bytes) else last_run_str)
                    expected_interval = config.min_interval  # Use minimum interval for overdue check
                    time_since_last_run = (current_time - last_run).total_seconds()

                    if time_since_last_run > expected_interval:
                        overdue_time = time_since_last_run - expected_interval
                        logger.warning(f"Scraper {scraper_name} is overdue by {overdue_time:.0f} seconds ({overdue_time/3600:.1f} hours)")
                        overdue_scrapers.append(scraper_name)
                    else:
                        logger.info(f"Scraper {scraper_name} last ran {time_since_last_run:.0f}s ago, next run in {expected_interval - time_since_last_run:.0f}s")
                else:
                    # No last run recorded - consider it overdue for initial run
                    logger.info(f"No previous run recorded for {scraper_name}, marking for immediate execution")
                    overdue_scrapers.append(scraper_name)

            except Exception as e:
                logger.error(f"Error checking last run for {scraper_name}: {e}")
                # If we can't determine last run, consider it overdue to be safe
                overdue_scrapers.append(scraper_name)

        # Execute overdue tasks immediately
        if overdue_scrapers:
            logger.info(f"Executing {len(overdue_scrapers)} overdue scrapers: {', '.join(overdue_scrapers)}")

            # Run overdue scrapers in parallel to catch up quickly
            overdue_tasks = []
            for scraper_name in overdue_scrapers:
                logger.info(f"Starting immediate execution for overdue scraper: {scraper_name}")
                overdue_tasks.append(self._run_scraper(scraper_name))

            # Execute all overdue tasks concurrently
            try:
                await asyncio.gather(*overdue_tasks, return_exceptions=True)
                logger.info("Completed execution of all overdue scrapers")
            except Exception as e:
                logger.error(f"Error during overdue task execution: {e}")
        else:
            logger.info("No overdue scrapers found - all are up to date")

    async def start(self):
        """Start the automated scheduling system"""
        logger.info("Starting automated scraping scheduler...")

        # Load target tracks from database first
        await self._load_target_tracks_from_database()

        # Check for and execute any overdue tasks before starting regular scheduling
        await self._check_and_run_overdue_tasks()

        # Schedule all enabled scrapers
        for scraper_name, config in self.scraper_configs.items():
            if config.enabled:
                await self.schedule_scraper(scraper_name)

        # Start the scheduler
        self.scheduler.start()
        logger.info(f"Automated scheduler started with {len(self.scheduler.get_jobs())} active jobs")

    async def stop(self):
        """Stop the automated scheduling system"""
        logger.info("Stopping automated scraping scheduler...")
        self.scheduler.shutdown()
        await self.robots_checker.close()
        logger.info("Automated scheduler stopped")

    def get_status(self) -> Dict[str, Any]:
        """Get current scheduler status"""
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            })

        return {
            "running": self.scheduler.running,
            "jobs": jobs,
            "scrapers": {
                name: {
                    "enabled": config.enabled,
                    "priority": config.priority,
                    "min_interval": config.min_interval,
                    "max_interval": config.max_interval,
                    "respect_robots": config.respect_robots
                }
                for name, config in self.scraper_configs.items()
            },
            "queue_stats": self.smart_scheduler.get_queue_stats(),
            "domain_health": {
                domain: self.robots_checker.get_domain_health(domain)
                for config in self.scraper_configs.values()
                for domain in config.domains
            }
        }

    def update_config(self, scraper_name: str, config_updates: Dict):
        """Update configuration for a specific scraper"""
        if scraper_name not in self.scraper_configs:
            raise ValueError(f"Unknown scraper: {scraper_name}")

        config = self.scraper_configs[scraper_name]

        for key, value in config_updates.items():
            if hasattr(config, key):
                setattr(config, key, value)

        # Save to Redis
        all_configs = {
            name: config.to_dict()
            for name, config in self.scraper_configs.items()
        }
        self.redis_client.set("scraper:configs", json.dumps(all_configs))

        logger.info(f"Updated configuration for {scraper_name}")

        # Reschedule if needed
        if config.enabled:
            asyncio.create_task(self.schedule_scraper(scraper_name))