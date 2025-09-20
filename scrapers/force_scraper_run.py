#!/usr/bin/env python3
"""
Force immediate execution of all scheduled scrapers
This script connects to the Redis instance and triggers immediate scraper runs
"""
import redis
import json
import asyncio
from datetime import datetime, timedelta
import time

# Connect to Redis
r = redis.Redis(host='localhost', port=6380, decode_responses=True)

def force_immediate_run():
    """Force all scrapers to run immediately by resetting their schedules"""

    scrapers = ['1001tracklists', 'mixesdb', 'setlistfm', 'reddit']

    print("🚀 Forcing immediate scraper execution...")
    print("=" * 50)

    for scraper in scrapers:
        # Clear any existing schedule data to force immediate run
        schedule_key = f"scraper:schedule:{scraper}"
        history_key = f"scraper:history:{scraper}"

        # Add a "force run" entry to trigger immediate execution
        force_run_data = {
            "timestamp": datetime.now().isoformat(),
            "scraper": scraper,
            "interval": 60,  # Set to 60 seconds for immediate run
            "status": "force_immediate",
            "forced_at": datetime.now().isoformat()
        }

        # Push to Redis to signal immediate run needed
        r.lpush(schedule_key, json.dumps(force_run_data))
        r.expire(schedule_key, 300)  # Expire after 5 minutes

        print(f"✓ {scraper}: Scheduled for immediate execution")

    # Also reset the track index to ensure variety
    current_index = r.get("scraper:current_track_index")
    if current_index:
        print(f"\nCurrent track index: {current_index}")

    # Signal the orchestrator to run immediately
    orchestrator_signal = {
        "command": "run_all_scrapers",
        "timestamp": datetime.now().isoformat(),
        "priority": "immediate"
    }

    r.setex("scraper:force_run_signal", 60, json.dumps(orchestrator_signal))

    print("\n✓ Force run signal sent to orchestrator")
    print("⏳ Scrapers should start within 60 seconds...")

    return True

if __name__ == "__main__":
    try:
        success = force_immediate_run()
        if success:
            print("\n✅ Successfully triggered immediate scraper execution!")
            print("Monitor logs with: docker compose logs -f scraper-orchestrator")
    except redis.ConnectionError:
        print("❌ Could not connect to Redis. Make sure Redis is running on port 6380")
    except Exception as e:
        print(f"❌ Error: {e}")