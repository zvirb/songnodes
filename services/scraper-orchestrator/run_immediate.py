#!/usr/bin/env python3
"""
Override scheduler to run all scrapers immediately (one-time override)
"""
import os
import sys
sys.path.insert(0, '/app')

# Monkey-patch the intervals before importing
os.environ['SCRAPER_FORCE_IMMEDIATE'] = '1'

# Import and modify the scheduler
from automated_scheduler import AutomatedScrapingScheduler, ScraperConfig

# Override configs with 60 second intervals for immediate run
AutomatedScrapingScheduler.SCRAPER_CONFIGS = {
    "1001tracklists": ScraperConfig(
        name="1001tracklists",
        domains=["www.1001tracklists.com"],
        base_url_patterns=[
            "https://www.1001tracklists.com/tracklist/",
            "https://www.1001tracklists.com/dj/"
        ],
        min_interval=60,  # 1 minute for immediate run
        max_interval=120,  # 2 minutes max
        priority="high"
    ),
    "mixesdb": ScraperConfig(
        name="mixesdb",
        domains=["www.mixesdb.com"],
        base_url_patterns=[
            "https://www.mixesdb.com/w/",
            "https://www.mixesdb.com/db/"
        ],
        min_interval=60,
        max_interval=120,
        priority="medium"
    ),
    "setlistfm": ScraperConfig(
        name="setlistfm",
        domains=["www.setlist.fm"],
        base_url_patterns=[
            "https://www.setlist.fm/setlist/",
            "https://www.setlist.fm/artist/"
        ],
        min_interval=60,
        max_interval=120,
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
        min_interval=60,
        max_interval=120,
        priority="medium"
    )
}

print("✅ Scheduler intervals overridden to 60 seconds!")
print("🚀 Scrapers will run within 1-2 minutes")
print("This is a one-time override for immediate testing")