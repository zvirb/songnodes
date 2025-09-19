#!/usr/bin/env python3
"""
Multi-Spider Test Script
Tests all improved spiders with contemporary track searches
"""
import subprocess
import time
import json
from datetime import datetime


def test_spider(spider_name, limit_requests=5):
    """Test a spider with limited requests"""
    print(f"\n{'='*60}")
    print(f"Testing {spider_name} spider...")
    print(f"{'='*60}")

    # Run spider with limited settings to test functionality
    cmd = [
        'scrapy', 'crawl', spider_name,
        '-s', 'CLOSESPIDER_PAGECOUNT=5',  # Limit to 5 pages
        '-s', 'ITEM_PIPELINES={}',  # Disable pipelines for testing
        '-s', 'LOG_LEVEL=INFO'
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )

        # Analyze output
        output = result.stderr

        # Count important metrics
        metrics = {
            'requests_made': output.count('DEBUG] Crawled (200)') + output.count('INFO] Crawled'),
            'items_found': output.count('INFO] Scraped item'),
            'tracks_found': output.count('track_name'),
            'errors': output.count('ERROR]'),
            'warnings': output.count('WARNING]')
        }

        print(f"✓ Spider executed successfully")
        print(f"  - Requests made: {metrics['requests_made']}")
        print(f"  - Items found: {metrics['items_found']}")
        print(f"  - Errors: {metrics['errors']}")
        print(f"  - Warnings: {metrics['warnings']}")

        # Check for specific contemporary artists
        contemporary_artists = ['FISHER', 'Anyma', 'Fred again', 'Alok', 'Chris Lake']
        found_artists = []
        for artist in contemporary_artists:
            if artist.lower() in output.lower():
                found_artists.append(artist)

        if found_artists:
            print(f"  ✓ Found contemporary artists: {', '.join(found_artists)}")

        return metrics

    except subprocess.TimeoutExpired:
        print(f"✗ Spider timed out after 60 seconds")
        return None
    except Exception as e:
        print(f"✗ Error running spider: {e}")
        return None


def main():
    """Test all improved spiders"""
    print("="*60)
    print("MULTI-SPIDER TEST SUITE")
    print(f"Testing contemporary track discovery - {datetime.now()}")
    print("="*60)

    # List of spiders to test
    spiders = [
        'enhanced_1001tracklists',
        'enhanced_mixesdb',
        'setlistfm_api',
        'enhanced_reddit'
    ]

    results = {}

    # Test each spider
    for spider in spiders:
        try:
            metrics = test_spider(spider)
            results[spider] = metrics
            time.sleep(2)  # Pause between spiders
        except Exception as e:
            print(f"Failed to test {spider}: {e}")
            results[spider] = None

    # Summary report
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    total_requests = 0
    total_items = 0
    working_spiders = 0

    for spider, metrics in results.items():
        if metrics:
            working_spiders += 1
            total_requests += metrics.get('requests_made', 0)
            total_items += metrics.get('items_found', 0)
            status = "✓ WORKING"
        else:
            status = "✗ FAILED"

        print(f"{spider:30} {status}")

    print(f"\nOverall Statistics:")
    print(f"  Working Spiders: {working_spiders}/{len(spiders)}")
    print(f"  Total Requests: {total_requests}")
    print(f"  Total Items Found: {total_items}")

    # Save results
    with open('spider_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'results': results,
            'summary': {
                'working_spiders': working_spiders,
                'total_spiders': len(spiders),
                'total_requests': total_requests,
                'total_items': total_items
            }
        }, f, indent=2)

    print(f"\nResults saved to spider_test_results.json")


if __name__ == '__main__':
    main()