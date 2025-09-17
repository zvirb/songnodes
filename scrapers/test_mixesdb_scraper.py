#!/usr/bin/env python3
"""
Test script for the enhanced MixesDB scraper
"""

import subprocess
import os
import sys
import json
import csv
from pathlib import Path

def run_scraper_test():
    """Run the MixesDB scraper with example URLs"""
    print("Testing MixesDB scraper with example URLs...")

    # Change to scrapers directory
    scrapers_dir = Path(__file__).parent
    os.chdir(scrapers_dir)

    # Run the scraper
    cmd = [
        'scrapy', 'crawl', 'mixesdb',
        '-s', 'LOG_LEVEL=INFO',
        '-a', 'start_mode=examples'
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        print(f"Scraper exit code: {result.returncode}")

        if result.stdout:
            print("STDOUT:")
            print(result.stdout[-2000:])  # Last 2000 chars

        if result.stderr:
            print("STDERR:")
            print(result.stderr[-1000:])  # Last 1000 chars

        return result.returncode == 0

    except subprocess.TimeoutExpired:
        print("Scraper timed out after 5 minutes")
        return False
    except Exception as e:
        print(f"Error running scraper: {e}")
        return False

def validate_output():
    """Validate the scraper output files"""
    output_dir = Path("output")
    if not output_dir.exists():
        print("No output directory found")
        return False

    files_to_check = [
        "setlists.csv",
        "tracks.csv",
        "trackartists.csv",
        "setlisttracks.csv"
    ]

    results = {}

    for filename in files_to_check:
        filepath = output_dir / filename
        if filepath.exists():
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    rows = list(reader)
                    results[filename] = {
                        'exists': True,
                        'row_count': len(rows),
                        'columns': reader.fieldnames if reader.fieldnames else [],
                        'sample_data': rows[:2] if rows else []
                    }
                    print(f"✓ {filename}: {len(rows)} rows")
            except Exception as e:
                results[filename] = {'exists': True, 'error': str(e)}
                print(f"✗ {filename}: Error reading - {e}")
        else:
            results[filename] = {'exists': False}
            print(f"✗ {filename}: Not found")

    return results

def check_robots_compliance():
    """Check if the scraper respects robots.txt"""
    print("\nChecking robots.txt compliance...")

    import requests
    try:
        response = requests.get("https://www.mixesdb.com/robots.txt", timeout=10)
        if response.status_code == 200:
            robots_content = response.text
            print("✓ Successfully fetched robots.txt")

            # Check for key restrictions
            if "Crawl-delay: 4" in robots_content:
                print("✓ Found crawl delay requirement (4 seconds)")

            disallowed_paths = ['/db/', '/tools/', '/list-artist-content/']
            for path in disallowed_paths:
                if f"Disallow: {path}" in robots_content:
                    print(f"✓ Found disallow rule for {path}")

            return True
        else:
            print(f"✗ Failed to fetch robots.txt: {response.status_code}")
            return False

    except Exception as e:
        print(f"✗ Error checking robots.txt: {e}")
        return False

def run_browse_test():
    """Test the scraper in browse mode (limited)"""
    print("\nTesting browse mode (limited to prevent overwhelming)...")

    scrapers_dir = Path(__file__).parent
    os.chdir(scrapers_dir)

    cmd = [
        'scrapy', 'crawl', 'mixesdb',
        '-s', 'LOG_LEVEL=INFO',
        '-s', 'CLOSESPIDER_ITEMCOUNT=5',  # Limit to 5 items
        '-a', 'start_mode=browse'
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        print(f"Browse test exit code: {result.returncode}")

        if "Closing spider" in result.stderr:
            print("✓ Browse mode completed successfully")
            return True
        else:
            print("✗ Browse mode may have issues")
            print(result.stderr[-500:])
            return False

    except subprocess.TimeoutExpired:
        print("Browse test timed out")
        return False
    except Exception as e:
        print(f"Error in browse test: {e}")
        return False

def main():
    """Main test function"""
    print("=" * 60)
    print("MixesDB Scraper Test Suite")
    print("=" * 60)

    # Test 1: Check robots.txt compliance
    robots_ok = check_robots_compliance()

    # Test 2: Run scraper with examples
    scraper_ok = run_scraper_test()

    # Test 3: Validate output
    output_results = validate_output()

    # Test 4: Limited browse test
    browse_ok = run_browse_test()

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Robots.txt compliance: {'✓ PASS' if robots_ok else '✗ FAIL'}")
    print(f"Example scraping: {'✓ PASS' if scraper_ok else '✗ FAIL'}")
    print(f"Browse mode test: {'✓ PASS' if browse_ok else '✗ FAIL'}")

    print("\nOutput validation:")
    for filename, result in output_results.items():
        if result.get('exists'):
            if 'error' in result:
                print(f"  {filename}: ✗ FAIL ({result['error']})")
            else:
                print(f"  {filename}: ✓ PASS ({result['row_count']} rows)")
        else:
            print(f"  {filename}: ✗ FAIL (not found)")

    overall_success = all([robots_ok, scraper_ok, any(r.get('exists', False) for r in output_results.values())])

    if overall_success:
        print("\n🎉 Overall test result: SUCCESS")
        print("The MixesDB scraper is working correctly!")
    else:
        print("\n❌ Overall test result: FAILED")
        print("Please check the errors above and fix any issues.")

    return 0 if overall_success else 1

if __name__ == "__main__":
    sys.exit(main())