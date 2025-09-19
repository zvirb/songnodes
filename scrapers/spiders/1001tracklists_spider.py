import scrapy
import time
import random
import logging
from scrapy.exceptions import DropItem
from scrapy.http import Request
try:
    from ..items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem
    from .utils import parse_track_string
except ImportError:
    # Fallback for standalone execution
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem
    from spiders.utils import parse_track_string
import re


class OneThousandOneTracklistsSpider(scrapy.Spider):
    name = '1001tracklists'
    allowed_domains = ['1001tracklists.com']

    # Rate limiting settings
    download_delay = 1.5  # 1.5 second delay between requests
    randomize_download_delay = 0.5  # randomize by 0.5 * to 1.5 * delay

    # Custom settings for this spider
    custom_settings = {
        'DOWNLOAD_DELAY': 1.5,
        'RANDOMIZE_DOWNLOAD_DELAY': 0.5,
        'CONCURRENT_REQUESTS': 1,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 2,
        'AUTOTHROTTLE_MAX_DELAY': 10,
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 0.5,
        'RETRY_TIMES': 5,
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 522, 524, 408, 429, 403],
    }

    start_urls = [
        'https://www.1001tracklists.com/tracklist/1rcyn73t/claptone-purple-disco-machine-the-masquerade-pacha-ibiza-spain-2023-08-12.html',
        'https://www.1001tracklists.com/tracklist/jck8kqk/tiesto-liv-las-vegas-united-states-2025-03-29.html',
        'https://www.1001tracklists.com/tracklist/nx3dkn1/fisher-desert-valley-stage-parookaville-germany-2023-07-21.html',
        'https://www.1001tracklists.com/tracklist/2cz5kkgk/tiesto-in-search-of-sunrise-kineticfield-edc-las-vegas-united-states-2025-05-18.html',
        'https://www.1001tracklists.com/tracklist/ul33u4k/artbat-steel-yard-creamfields-north-united-kingdom-2024-08-25.html',
    ]

    def __init__(self, *args, **kwargs):
        super(OneThousandOneTracklistsSpider, self).__init__(*args, **kwargs)
        self.logger = logging.getLogger(__name__)
        self.failed_urls = []
        self.retry_count = 0

    def start_requests(self):
        """Override start_requests to add custom headers and error handling"""
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        for url in self.start_urls:
            yield Request(
                url=url,
                headers=headers,
                callback=self.parse,
                errback=self.handle_error,
                meta={'download_timeout': 30}
            )

    def handle_error(self, failure):
        """Handle request failures with logging and retry logic"""
        self.logger.error(f"Request failed: {failure.request.url} - {failure.value}")
        self.failed_urls.append(failure.request.url)

        # Retry with exponential backoff
        if self.retry_count < 3:
            self.retry_count += 1
            delay = 2 ** self.retry_count + random.uniform(0, 1)
            self.logger.info(f"Retrying {failure.request.url} in {delay:.2f} seconds")
            time.sleep(delay)
            yield Request(
                url=failure.request.url,
                callback=self.parse,
                errback=self.handle_error,
                dont_filter=True
            )

    def parse(self, response):
        """Parse 1001tracklists page with improved selectors and error handling"""
        self.logger.info(f"Parsing URL: {response.url}")

        try:
            # Extract Setlist Metadata with updated selectors for new site structure
            setlist_name = self._extract_setlist_name(response)
            dj_artist_names = self._extract_artist_names(response)
            event_name = self._extract_event_name(response)
            venue_name = self._extract_venue_name(response)
            set_date = self._extract_set_date(response)

        except Exception as e:
            self.logger.error(f"Error extracting metadata from {response.url}: {e}")
            raise DropItem(f"Failed to extract metadata: {e}")

        # Clean and format extracted data
        dj_artist_name = ", ".join(dj_artist_names) if dj_artist_names else None

        setlist_item = SetlistItem(
            setlist_name=setlist_name,
            dj_artist_name=dj_artist_name,
            event_name=event_name,
            venue_name=venue_name,
            set_date=set_date,
            last_updated_date=None  # 1001tracklists doesn't typically have this
        )

        self.logger.info(f"Extracted setlist: {setlist_name} by {dj_artist_name}")
        yield setlist_item

        # Extract Tracklist with updated selectors
        track_elements = self._extract_track_elements(response)
        tracks_found = len(track_elements)
        self.logger.info(f"Found {tracks_found} track elements")

        if tracks_found == 0:
            self.logger.warning(f"No tracks found on {response.url}")
            return

        for i, track_el in enumerate(track_elements):
            try:
                track_data = self._parse_track_element(track_el, i + 1)
                if track_data:
                    track_string, start_time, track_order = track_data

                    # Parse the track string
                    parsed_track = parse_track_string(track_string)

                    if not parsed_track['track_name']:
                        self.logger.debug(f"Skipping track {i+1}: empty track name")
                        continue

                    # Create track item
                    track_item = TrackItem(
                        track_name=parsed_track['track_name'],
                        is_remix=parsed_track['is_remix'],
                        is_mashup=parsed_track['is_mashup'],
                        mashup_components=parsed_track['mashup_components'],
                        start_time=start_time,
                        track_type='Setlist'
                    )
                    yield track_item

                    # Yield TrackArtistItems for primary, featured, and remixer artists
                    for artist in parsed_track['primary_artists']:
                        yield TrackArtistItem(
                            track_name=parsed_track['track_name'],
                            artist_name=artist,
                            artist_role='primary'
                        )
                    for artist in parsed_track['featured_artists']:
                        yield TrackArtistItem(
                            track_name=parsed_track['track_name'],
                            artist_name=artist,
                            artist_role='featured'
                        )
                    for artist in parsed_track['remixer_artists']:
                        yield TrackArtistItem(
                            track_name=parsed_track['track_name'],
                            artist_name=artist,
                            artist_role='remixer'
                        )

                    # Yield SetlistTrackItem
                    yield SetlistTrackItem(
                        setlist_name=setlist_name,
                        track_name=parsed_track['track_name'],
                        track_order=track_order,
                        start_time=start_time
                    )

            except Exception as e:
                self.logger.error(f"Error parsing track {i+1}: {e}")
                continue

    def _extract_setlist_name(self, response):
        """Extract setlist name with multiple fallback selectors"""
        selectors = [
            'h1.spotlightTitle::text',
            'h1.tracklist-header-title::text',
            '#pageTitle::text',
            'h1::text',
            'title::text'
        ]

        for selector in selectors:
            setlist_name = response.css(selector).get()
            if setlist_name:
                setlist_name = setlist_name.strip()
                # Clean up title if it's from page title
                if 'tracklist' in setlist_name.lower():
                    setlist_name = setlist_name.split(' - ')[0] if ' - ' in setlist_name else setlist_name
                return setlist_name

        self.logger.warning(f"Could not extract setlist name from {response.url}")
        return None

    def _extract_artist_names(self, response):
        """Extract artist names with multiple fallback selectors"""
        artist_selectors = [
            'div.spotlight-artists a::text',
            'h1.tracklist-header-title a::text',
            '.bCont .bTitle a::text',
            'a[href*="/artist/"]::text'
        ]

        for selector in artist_selectors:
            artists = response.css(selector).getall()
            if artists:
                return [artist.strip() for artist in artists if artist.strip()]

        self.logger.warning(f"Could not extract artist names from {response.url}")
        return []

    def _extract_event_name(self, response):
        """Extract event name with multiple fallback selectors"""
        event_selectors = [
            'div.spotlight-event a::text',
            'a[href*="/event/"]::text',
            '.iRow a[href*="/event/"]::text'
        ]

        for selector in event_selectors:
            event_name = response.css(selector).get()
            if event_name:
                return event_name.strip()

        return None

    def _extract_venue_name(self, response):
        """Extract venue name with multiple fallback selectors"""
        venue_selectors = [
            'div.spotlight-venue a::text',
            'a[href*="/venue/"]::text',
            '.iRow a[href*="/venue/"]::text'
        ]

        for selector in venue_selectors:
            venue_name = response.css(selector).get()
            if venue_name:
                return venue_name.strip()

        return None

    def _extract_set_date(self, response):
        """Extract set date with multiple fallback selectors"""
        date_selectors = [
            'div.spotlight-date::text',
            '.iRow .fa-calendar + *::text',
            'time::text',
            '[datetime]::attr(datetime)'
        ]

        for selector in date_selectors:
            set_date = response.css(selector).get()
            if set_date:
                return set_date.strip()

        return None

    def _extract_track_elements(self, response):
        """Extract track elements with multiple fallback selectors"""
        track_selectors = [
            'div.tlpItem',           # Original selector
            'li.tracklist-item',     # Alternative selector
            '.bItm',                 # New site structure
            'div.bItm',              # Specific div with bItm class
            '.mediaRow',             # Media row items
            '[data-track]'           # Any element with track data
        ]

        for selector in track_selectors:
            elements = response.css(selector)
            if elements:
                self.logger.debug(f"Found {len(elements)} elements with selector: {selector}")
                return elements

        self.logger.warning("No track elements found with any selector")
        return []

    def _parse_track_element(self, track_el, track_order):
        """Parse individual track element to extract track string and metadata"""
        # Try multiple selectors for track string
        track_string_selectors = [
            'span.trackValue::text',
            'div.track-name::text',
            '.bTitle::text',
            '.bCont .bTitle::text',
            'a::text',
            '::text'
        ]

        track_string = None
        for selector in track_string_selectors:
            track_string = track_el.css(selector).get()
            if track_string and track_string.strip():
                track_string = track_string.strip()
                break

        if not track_string:
            # Try to get all text content as fallback
            all_text = ' '.join(track_el.css('::text').getall())
            if all_text.strip():
                track_string = all_text.strip()

        if not track_string:
            return None

        # Extract start time
        time_selectors = [
            'span.tracklist-time::text',
            '.bRank::text',
            '[data-time]::attr(data-time)',
            '.time::text'
        ]

        start_time = None
        for selector in time_selectors:
            start_time = track_el.css(selector).get()
            if start_time:
                start_time = start_time.strip()
                break

        # Look for time in track string if not found
        if not start_time:
            time_match = re.search(r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]', track_string)
            if time_match:
                start_time = time_match.group(1)

        return track_string, start_time, track_order

    def closed(self, reason):
        """Called when spider closes - log statistics"""
        self.logger.info(f"Spider closed: {reason}")
        if self.failed_urls:
            self.logger.warning(f"Failed to scrape {len(self.failed_urls)} URLs: {self.failed_urls}")
        self.logger.info(f"Total retry attempts: {self.retry_count}")