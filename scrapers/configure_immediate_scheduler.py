#!/usr/bin/env python3
"""
Configure the automated scheduler for immediate and frequent runs
This enables automatic scraping without manual triggers
"""

import os
import sys
import json
import time
from pathlib import Path

# Configuration for immediate testing
IMMEDIATE_CONFIG = {
    "1001tracklists": {
        "min_interval": 60,      # 1 minute minimum
        "max_interval": 300,     # 5 minutes maximum
        "priority": "high",
        "enabled": True,
        "run_immediately": True,
        "search_queries": ["carl cox", "fisher", "chris lake", "john summit"],
        "max_items": 10
    },
    "mixesdb": {
        "min_interval": 120,     # 2 minutes minimum
        "max_interval": 600,     # 10 minutes maximum
        "priority": "high",
        "enabled": True,
        "run_immediately": True,
        "categories": ["House", "Techno", "Progressive_House"],
        "max_items": 10
    },
    "setlistfm": {
        "min_interval": 180,     # 3 minutes minimum
        "max_interval": 900,     # 15 minutes maximum
        "priority": "medium",
        "enabled": True,
        "run_immediately": True,
        "artists": ["Swedish House Mafia", "David Guetta", "Tiësto"],
        "max_items": 5
    }
}

def update_scheduler_config():
    """Update the automated_scheduler.py with immediate intervals"""

    scheduler_path = Path("/app/automated_scheduler.py")
    if not scheduler_path.exists():
        print(f"Error: {scheduler_path} not found")
        return False

    # Read current scheduler
    with open(scheduler_path, 'r') as f:
        content = f.read()

    # Update intervals for each scraper
    replacements = [
        # 1001tracklists
        ('min_interval=7200,  # 2 hours minimum', 'min_interval=60,  # 1 minute for testing'),
        ('max_interval=43200,  # 12 hours maximum', 'max_interval=300,  # 5 minutes for testing'),

        # mixesdb
        ('min_interval=10800,  # 3 hours minimum', 'min_interval=120,  # 2 minutes for testing'),
        ('max_interval=86400,  # 24 hours maximum', 'max_interval=600,  # 10 minutes for testing'),

        # setlistfm
        ('min_interval=14400,  # 4 hours minimum', 'min_interval=180,  # 3 minutes for testing'),
        ('max_interval=172800,  # 48 hours maximum', 'max_interval=900,  # 15 minutes for testing'),
    ]

    for old, new in replacements:
        content = content.replace(old, new)

    # Write updated scheduler
    with open(scheduler_path, 'w') as f:
        f.write(content)

    print("✅ Updated scheduler intervals for immediate testing")
    return True

def trigger_immediate_runs():
    """Trigger immediate runs for all scrapers"""

    import subprocess

    scrapers = ["1001tracklists", "mixesdb", "setlistfm"]

    for scraper in scrapers:
        config = IMMEDIATE_CONFIG[scraper]

        # Build run command based on scraper
        if scraper == "1001tracklists":
            for query in config["search_queries"][:2]:  # Start with 2 queries
                cmd = f'scrapy crawl {scraper} -a search_query="{query}" -a max_items={config["max_items"]}'
                print(f"🚀 Running: {cmd}")
                subprocess.run(cmd, shell=True, cwd="/app/spiders")
                time.sleep(5)  # Brief pause between queries

        elif scraper == "mixesdb":
            for category in config["categories"][:2]:  # Start with 2 categories
                cmd = f'scrapy crawl {scraper} -a category="{category}" -a max_items={config["max_items"]}'
                print(f"🚀 Running: {cmd}")
                subprocess.run(cmd, shell=True, cwd="/app/spiders")
                time.sleep(5)

        elif scraper == "setlistfm":
            for artist in config["artists"][:2]:  # Start with 2 artists
                cmd = f'scrapy crawl {scraper} -a artist="{artist}" -a max_items={config["max_items"]}'
                print(f"🚀 Running: {cmd}")
                subprocess.run(cmd, shell=True, cwd="/app/spiders")
                time.sleep(5)

def main():
    print("🔧 Configuring automated scheduler for immediate runs")
    print("=" * 60)

    # Update scheduler configuration
    if update_scheduler_config():
        print("✅ Scheduler configuration updated")

        # Restart the scheduler to pick up new config
        print("🔄 Restarting scheduler service...")
        os.system("pkill -f automated_scheduler.py")
        time.sleep(2)

        # Start scheduler with new config
        print("🚀 Starting scheduler with immediate intervals...")
        os.system("python3 /app/automated_scheduler.py &")

        # Trigger immediate runs
        print("\n📊 Triggering immediate scraper runs...")
        trigger_immediate_runs()

        print("\n✅ Automated scraping configured and running!")
        print("   - Scrapers will run automatically every 1-15 minutes")
        print("   - No manual triggers required")
        print("   - Check database for growing song and adjacency data")

        return True

    return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)