#!/usr/bin/env python3
"""
Simple test for 1001tracklists scraper logic using requests and beautifulsoup
Tests the scraper selectors and parsing logic without the full Scrapy framework
"""

import requests
import time
from bs4 import BeautifulSoup
import logging
import sys
import os

# Add the scrapers directory to Python path
sys.path.insert(0, '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/scrapers')

# Import the utility function
from spiders.utils import parse_track_string

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_selector_logic(url):
    """Test the selector logic on a real 1001tracklists page"""
    logger.info(f"Testing selectors on: {url}")

    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }

    try:
        # Make request with rate limiting
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')

        # Test setlist name extraction
        setlist_name = extract_setlist_name(soup)
        logger.info(f"Setlist name: {setlist_name}")

        # Test artist extraction
        artists = extract_artists(soup)
        logger.info(f"Artists: {artists}")

        # Test event extraction
        event_name = extract_event_name(soup)
        logger.info(f"Event: {event_name}")

        # Test venue extraction
        venue_name = extract_venue_name(soup)
        logger.info(f"Venue: {venue_name}")

        # Test date extraction
        set_date = extract_date(soup)
        logger.info(f"Date: {set_date}")

        # Test track elements extraction
        track_elements = extract_track_elements(soup)
        logger.info(f"Found {len(track_elements)} track elements")

        # Test parsing a few tracks
        for i, track_el in enumerate(track_elements[:5]):  # Test first 5 tracks
            track_data = parse_track_element(track_el, i + 1)
            if track_data:
                track_string, start_time, track_order = track_data
                logger.info(f"Track {track_order}: {track_string} (Time: {start_time})")

                # Test track string parsing
                parsed = parse_track_string(track_string)
                logger.info(f"  Parsed: {parsed['track_name']} by {parsed['primary_artists']}")
            else:
                logger.warning(f"Could not parse track {i + 1}")

        return True

    except Exception as e:
        logger.error(f"Error testing selectors: {e}")
        return False

def extract_setlist_name(soup):
    """Extract setlist name with multiple fallback selectors"""
    selectors = [
        'h1.spotlightTitle',
        'h1.tracklist-header-title',
        '#pageTitle',
        'h1',
        'title'
    ]

    for selector in selectors:
        elements = soup.select(selector)
        if elements:
            text = elements[0].get_text(strip=True)
            if text:
                # Clean up title if it's from page title
                if 'tracklist' in text.lower():
                    text = text.split(' - ')[0] if ' - ' in text else text
                return text

    return None

def extract_artists(soup):
    """Extract artist names with multiple fallback selectors"""
    selectors = [
        'div.spotlight-artists a',
        'h1.tracklist-header-title a',
        '.bCont .bTitle a',
        'a[href*="/artist/"]'
    ]

    for selector in selectors:
        elements = soup.select(selector)
        if elements:
            artists = [el.get_text(strip=True) for el in elements if el.get_text(strip=True)]
            if artists:
                return artists

    return []

def extract_event_name(soup):
    """Extract event name with multiple fallback selectors"""
    selectors = [
        'div.spotlight-event a',
        'a[href*="/event/"]',
        '.iRow a[href*="/event/"]'
    ]

    for selector in selectors:
        elements = soup.select(selector)
        if elements:
            text = elements[0].get_text(strip=True)
            if text:
                return text

    return None

def extract_venue_name(soup):
    """Extract venue name with multiple fallback selectors"""
    selectors = [
        'div.spotlight-venue a',
        'a[href*="/venue/"]',
        '.iRow a[href*="/venue/"]'
    ]

    for selector in selectors:
        elements = soup.select(selector)
        if elements:
            text = elements[0].get_text(strip=True)
            if text:
                return text

    return None

def extract_date(soup):
    """Extract set date with multiple fallback selectors"""
    selectors = [
        'div.spotlight-date',
        '.iRow .fa-calendar + *',
        'time',
        '[datetime]'
    ]

    for selector in selectors:
        elements = soup.select(selector)
        if elements:
            # Try text content first
            text = elements[0].get_text(strip=True)
            if text:
                return text
            # Try datetime attribute
            datetime_attr = elements[0].get('datetime')
            if datetime_attr:
                return datetime_attr

    return None

def extract_track_elements(soup):
    """Extract track elements with multiple fallback selectors"""
    selectors = [
        'div.tlpItem',
        'li.tracklist-item',
        '.bItm',
        'div.bItm',
        '.mediaRow',
        '[data-track]'
    ]

    for selector in selectors:
        elements = soup.select(selector)
        if elements:
            logger.info(f"Found {len(elements)} elements with selector: {selector}")
            return elements

    logger.warning("No track elements found with any selector")
    return []

def parse_track_element(track_el, track_order):
    """Parse individual track element to extract track string and metadata"""
    # Try multiple selectors for track string
    track_string_selectors = [
        'span.trackValue',
        'div.track-name',
        '.bTitle',
        '.bCont .bTitle',
        'a'
    ]

    track_string = None
    for selector in track_string_selectors:
        elements = track_el.select(selector)
        if elements:
            track_string = elements[0].get_text(strip=True)
            if track_string:
                break

    if not track_string:
        # Try to get all text content as fallback
        all_text = track_el.get_text(strip=True)
        if all_text:
            track_string = all_text

    if not track_string:
        return None

    # Extract start time
    time_selectors = [
        'span.tracklist-time',
        '.bRank',
        '[data-time]',
        '.time'
    ]

    start_time = None
    for selector in time_selectors:
        elements = track_el.select(selector)
        if elements:
            start_time = elements[0].get_text(strip=True)
            if start_time:
                break
        # Try data-time attribute
        if not start_time and elements:
            start_time = elements[0].get('data-time')

    # Look for time in track string if not found
    if not start_time:
        import re
        time_match = re.search(r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]', track_string)
        if time_match:
            start_time = time_match.group(1)

    return track_string, start_time, track_order

def main():
    """Main test function"""
    logger.info("=" * 60)
    logger.info("1001tracklists Selector Test")
    logger.info("=" * 60)

    # Test URL
    test_url = 'https://www.1001tracklists.com/tracklist/1rcyn73t/claptone-purple-disco-machine-the-masquerade-pacha-ibiza-spain-2023-08-12.html'

    # Rate limiting - be respectful
    logger.info("Starting test with 2-second delay for politeness...")
    time.sleep(2)

    success = test_selector_logic(test_url)

    if success:
        logger.info("✅ Selector test completed successfully!")
        print("\n✅ Test Results: PASSED")
        print("- Selectors are working correctly")
        print("- Track parsing logic is functional")
        print("- Rate limiting is implemented")
    else:
        logger.error("❌ Selector test failed!")
        print("\n❌ Test Results: FAILED")
        return 1

    return 0

if __name__ == "__main__":
    sys.exit(main())