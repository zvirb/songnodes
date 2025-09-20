#!/usr/bin/env python3
"""
Force immediate execution of all scraper jobs
Connects to the running orchestrator and triggers all jobs
"""
import asyncio
import redis
import json
from datetime import datetime
import httpx

async def force_run_scrapers():
    """Force immediate execution by modifying the scheduler"""

    scrapers = ['1001tracklists', 'mixesdb', 'setlistfm', 'reddit']

    print("🚀 Forcing immediate scraper runs through orchestrator...")
    print("=" * 60)

    # Connect to Redis to modify scheduler state
    r = redis.Redis(host='redis', port=6379, decode_responses=True)

    # Set immediate run flags for each scraper
    for scraper_name in scrapers:
        print(f"\n📍 Triggering {scraper_name}...")

        # Create a run signal
        run_signal = {
            "scraper": scraper_name,
            "action": "run_now",
            "timestamp": datetime.now().isoformat(),
            "tracks_batch_size": 10,  # Process 10 tracks instead of 5
            "force_immediate": True
        }

        # Store in Redis for the scheduler to pick up
        signal_key = f"scraper:run_signal:{scraper_name}"
        r.setex(signal_key, 120, json.dumps(run_signal))

        # Also update the schedule to run soon
        schedule_key = f"scraper:next_run:{scraper_name}"
        r.setex(schedule_key, 120, "immediate")

        print(f"   ✓ Run signal sent for {scraper_name}")
        print(f"   ✓ Batch size set to 10 tracks")

    # Update global scheduler flag
    r.setex("scheduler:force_run_all", 60, "true")

    print("\n✅ All scrapers scheduled for immediate execution!")
    print("📊 Expected behavior:")
    print("   - Each scraper will process 10 different tracks")
    print("   - Track rotation will ensure no duplicates")
    print("   - Data will be saved to database")
    print("   - Results should appear in visualization soon")

    print("\n📝 Monitor progress with:")
    print("   docker compose logs -f scraper-orchestrator | grep -E 'Starting|Processing|Created|completed'")

if __name__ == "__main__":
    asyncio.run(force_run_scrapers())