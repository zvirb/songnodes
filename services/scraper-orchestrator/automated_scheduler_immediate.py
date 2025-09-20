"""
Temporary override of automated_scheduler.py for immediate execution
This file has reduced intervals for testing purposes
"""
from automated_scheduler import *

# Override the class with immediate intervals
class AutomatedScrapingScheduler(AutomatedScrapingScheduler):
    # Override scraper configurations with 60-second intervals
    SCRAPER_CONFIGS = {
        "1001tracklists": ScraperConfig(
            name="1001tracklists",
            domains=["www.1001tracklists.com"],
            base_url_patterns=[
                "https://www.1001tracklists.com/tracklist/",
                "https://www.1001tracklists.com/dj/"
            ],
            min_interval=60,  # 1 minute - immediate!
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

    async def calculate_next_interval(self, scraper_name: str) -> int:
        """Override to return immediate interval"""
        return 60  # Always return 60 seconds for immediate execution