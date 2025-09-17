#!/usr/bin/env python3
"""
Test script for the Setlist.fm scraper implementation
This script validates the scraper functionality and integration.
"""

import os
import sys
import subprocess
import json
import time
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.append(str(project_root))

def test_docker_build():
    """Test building the Setlist.fm scraper Docker container"""
    print("Testing Docker build for Setlist.fm scraper...")

    try:
        # Change to scrapers directory
        os.chdir(project_root / "scrapers")

        # Build the container
        result = subprocess.run([
            "docker", "build",
            "-f", "Dockerfile.setlistfm",
            "-t", "test-setlistfm-scraper",
            "."
        ], capture_output=True, text=True, timeout=300)

        if result.returncode == 0:
            print("✅ Docker build successful")
            return True
        else:
            print(f"❌ Docker build failed: {result.stderr}")
            return False

    except subprocess.TimeoutExpired:
        print("❌ Docker build timed out")
        return False
    except Exception as e:
        print(f"❌ Error during Docker build: {e}")
        return False

def test_api_endpoint():
    """Test the scraper API endpoint"""
    print("Testing Setlist.fm scraper API endpoint...")

    try:
        # Start the container
        container_name = "test-setlistfm-scraper-container"

        # Remove existing container if it exists
        subprocess.run(["docker", "rm", "-f", container_name],
                      capture_output=True)

        # Start new container
        subprocess.run([
            "docker", "run", "-d",
            "--name", container_name,
            "-p", "8013:8013",
            "-e", "SETLISTFM_API_KEY=test-key",
            "test-setlistfm-scraper"
        ], check=True, capture_output=True)

        # Wait for container to start
        time.sleep(5)

        # Test health endpoint
        result = subprocess.run([
            "curl", "-s", "http://localhost:8013/health"
        ], capture_output=True, text=True)

        if result.returncode == 0:
            response = json.loads(result.stdout)
            if response.get("status") == "healthy":
                print("✅ Health endpoint working")

                # Test scrape endpoint (will fail without valid API key, but tests the endpoint)
                scrape_result = subprocess.run([
                    "curl", "-s", "-X", "POST",
                    "http://localhost:8013/scrape",
                    "-H", "Content-Type: application/json",
                    "-d", json.dumps({
                        "task_id": "test-task",
                        "params": {"artistName": "Test Artist"}
                    })
                ], capture_output=True, text=True)

                if scrape_result.returncode == 0:
                    print("✅ Scrape endpoint accessible")
                    return True
                else:
                    print(f"❌ Scrape endpoint failed: {scrape_result.stderr}")
            else:
                print(f"❌ Unexpected health response: {response}")
        else:
            print(f"❌ Health endpoint failed: {result.stderr}")

    except Exception as e:
        print(f"❌ Error testing API: {e}")
    finally:
        # Cleanup container
        subprocess.run(["docker", "rm", "-f", container_name],
                      capture_output=True)

    return False

def test_spider_structure():
    """Test the spider file structure and imports"""
    print("Testing spider file structure...")

    try:
        spider_file = project_root / "scrapers" / "spiders" / "setlistfm_spider.py"

        if not spider_file.exists():
            print("❌ Spider file not found")
            return False

        # Check required imports and classes
        content = spider_file.read_text()

        required_elements = [
            "class SetlistFmSpider",
            "API_BASE_URL",
            "API_KEY",
            "RATE_LIMIT_DELAY",
            "start_requests",
            "process_setlist_data",
            "ArtistItem",
            "VenueItem",
            "EventItem",
            "SetlistItem"
        ]

        missing_elements = []
        for element in required_elements:
            if element not in content:
                missing_elements.append(element)

        if missing_elements:
            print(f"❌ Missing required elements: {missing_elements}")
            return False

        print("✅ Spider structure validation passed")
        return True

    except Exception as e:
        print(f"❌ Error validating spider structure: {e}")
        return False

def test_items_structure():
    """Test the items file structure"""
    print("Testing items file structure...")

    try:
        items_file = project_root / "scrapers" / "items.py"

        if not items_file.exists():
            print("❌ Items file not found")
            return False

        content = items_file.read_text()

        required_items = [
            "class ArtistItem",
            "class VenueItem",
            "class EventItem",
            "class SetlistItem",
            "class TrackItem",
            "class ArtistEventItem"
        ]

        missing_items = []
        for item in required_items:
            if item not in content:
                missing_items.append(item)

        if missing_items:
            print(f"❌ Missing required items: {missing_items}")
            return False

        print("✅ Items structure validation passed")
        return True

    except Exception as e:
        print(f"❌ Error validating items structure: {e}")
        return False

def main():
    """Run all tests"""
    print("🎵 SongNodes Setlist.fm Scraper Test Suite")
    print("=" * 50)

    tests = [
        ("Spider Structure", test_spider_structure),
        ("Items Structure", test_items_structure),
        ("Docker Build", test_docker_build),
        ("API Endpoint", test_api_endpoint),
    ]

    results = []

    for test_name, test_func in tests:
        print(f"\n🧪 Running test: {test_name}")
        result = test_func()
        results.append((test_name, result))

    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")

    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
        if result:
            passed += 1

    print(f"\nTotal: {passed}/{len(results)} tests passed")

    if passed == len(results):
        print("🎉 All tests passed! Setlist.fm scraper is ready for deployment.")
        return 0
    else:
        print("❌ Some tests failed. Please review the implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main())