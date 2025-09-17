import scrapy
from scrapy.http import Request
from items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem
from .utils import parse_track_string
import re
import time
import logging
from urllib.parse import urljoin, urlparse
from datetime import datetime

class MixesdbSpider(scrapy.Spider):
    name = 'mixesdb'
    allowed_domains = ['mixesdb.com']

    # Enhanced user agent for respectful crawling
    custom_settings = {
        'USER_AGENT': 'SongNodes MixesDB Scraper/1.0 (+https://github.com/your-project/songnodes; contact@songnodes.com)',
        'DOWNLOAD_DELAY': 4,  # Respect robots.txt requirement
        'RANDOMIZE_DOWNLOAD_DELAY': 0.5,  # Add randomization
        'CONCURRENT_REQUESTS': 1,  # Single thread for politeness
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 4,
        'AUTOTHROTTLE_MAX_DELAY': 15,
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 1.0,
        'RETRY_TIMES': 3,
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 522, 524, 408, 429, 403]
    }

    def __init__(self, start_mode='examples', *args, **kwargs):
        super(MixesdbSpider, self).__init__(*args, **kwargs)
        self.start_mode = start_mode
        self.scraped_urls = set()  # Track scraped URLs to avoid duplicates

        # Configure start URLs based on mode
        if start_mode == 'browse':
            self.start_urls = [
                'https://www.mixesdb.com',  # Start from homepage
                'https://www.mixesdb.com/w/Category:House',
                'https://www.mixesdb.com/w/Category:Techno',
                'https://www.mixesdb.com/w/Category:Progressive',
            ]
        else:
            # Default to example URLs for testing
            self.start_urls = [
                'https://www.mixesdb.com/w/2025-05-13_-_Purple_Disco_Machine_-_Purple_Disco_Tales_May_2025',
                'https://www.mixesdb.com/w/2025-05-31_-_Adam_Beyer_-_Essential_Mix',
                'https://www.mixesdb.com/w/2025-03-11_-_John_Summit_-_Experts_Only_Radio_025_(MMW_Special)',
                'https://www.mixesdb.com/w/2025-06-02_-_Meduza_-_Aeterna_Radio_June_2025',
                'https://www.mixesdb.com/w/2023-07-21_-_FISHER_@_Desert_Valley,_Parookaville',
                'https://www.mixesdb.com/w/2025-03-29_-_Carl_Cox_@_Ultra_Music_Festival,_Miami'
            ]

    def start_requests(self):
        """Generate initial requests with proper headers"""
        for url in self.start_urls:
            yield Request(
                url=url,
                callback=self.parse_dispatch,
                headers={
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
                meta={'start_url': True}
            )

    def parse_dispatch(self, response):
        """Route to appropriate parser based on URL type"""
        if '/w/' in response.url and not '/Category:' in response.url:
            # Individual mix page
            yield from self.parse_mix_page(response)
        elif '/Category:' in response.url or response.url.endswith('mixesdb.com') or response.url.endswith('mixesdb.com/'):
            # Category or homepage - extract mix links
            yield from self.parse_category_page(response)
        else:
            self.logger.warning(f"Unknown page type: {response.url}")

    def parse_category_page(self, response):
        """Parse category pages and homepage to find mix links"""
        self.logger.info(f"Parsing category page: {response.url}")

        # Extract mix links from various sections
        mix_links = []

        # Find links to individual mix pages
        for link in response.css('a[href*="/w/"]::attr(href)').getall():
            if '/Category:' not in link and '/Special:' not in link:
                full_url = urljoin(response.url, link)
                if full_url not in self.scraped_urls:
                    mix_links.append(full_url)

        # Extract pagination links
        pagination_links = response.css('a[href*="offset="]::attr(href)').getall()
        for link in pagination_links:
            if link:
                next_page_url = urljoin(response.url, link)
                yield Request(
                    url=next_page_url,
                    callback=self.parse_category_page,
                    headers=self.get_request_headers(),
                    meta={'category_page': True}
                )

        # Follow mix links
        for mix_url in mix_links[:50]:  # Limit to prevent overwhelming
            if mix_url not in self.scraped_urls:
                self.scraped_urls.add(mix_url)
                yield Request(
                    url=mix_url,
                    callback=self.parse_mix_page,
                    headers=self.get_request_headers()
                )

    def get_request_headers(self):
        """Get consistent request headers"""
        return {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }

    def parse_mix_page(self, response):
        """Parse individual mix page to extract comprehensive data"""
        self.logger.info(f"Parsing mix page: {response.url}")

        # Handle inaccessible pages
        if "This website is inaccessible" in response.text or "not found" in response.text.lower():
            self.logger.warning(f"Skipping inaccessible URL: {response.url}")
            return

        # Check if page exists and has content
        if response.status == 404 or not response.css('h1#firstHeading'):
            self.logger.warning(f"Page not found or empty: {response.url}")
            return

        # Extract comprehensive mix metadata
        page_title = response.css('h1#firstHeading span.mw-page-title-main::text').get()
        if not page_title:
            page_title = response.css('h1::text').get() or response.url.split('/')[-1].replace('_', ' ')

        # Parse title for DJ name, date, and event
        dj_name = None
        event_name = None
        parsed_date = None

        if page_title:
            # Try to parse structured title: "YYYY-MM-DD - Artist - Event"
            title_match = re.search(r'(\d{4}-\d{2}-\d{2})\s*-\s*(.*?)\s*-\s*(.*)', page_title)
            if title_match:
                parsed_date = title_match.group(1)
                dj_name = title_match.group(2).strip()
                event_name = title_match.group(3).strip()
            else:
                # Fallback parsing
                date_match = re.search(r'(\d{4}-\d{2}-\d{2})', page_title)
                if date_match:
                    parsed_date = date_match.group(1)
                    remainder = page_title.replace(parsed_date, '').strip(' -')
                    parts = [p.strip() for p in remainder.split('-') if p.strip()]
                    if len(parts) >= 2:
                        dj_name = parts[0]
                        event_name = parts[1]
                    elif len(parts) == 1:
                        dj_name = parts[0]
                        event_name = parts[0]
                else:
                    # No date found, try to split by dashes
                    parts = [p.strip() for p in page_title.split('-') if p.strip()]
                    if len(parts) >= 2:
                        dj_name = parts[0]
                        event_name = parts[1]
                    else:
                        dj_name = page_title
                        event_name = page_title

        # Extract date information with multiple fallbacks
        set_date = parsed_date  # Use date from title if available

        # Try to find date in page content
        date_elements = response.css('li:contains("Date:"), th:contains("Date:"), td:contains("Date:")')
        for element in date_elements:
            date_text = element.css('::text').get() or ''
            date_match = re.search(r'(\d{4}-\d{2}-\d{2})', date_text)
            if date_match and not set_date:
                set_date = date_match.group(1)
                break

        # Extract additional metadata
        genre = self.extract_genre(response)
        label = self.extract_label(response)
        duration = self.extract_duration(response)
        mix_type = self.extract_mix_type(response)

        # Enhanced venue extraction
        venue_name = None
        venue_elements = response.css('li:contains("Venue:"), th:contains("Venue:"), td:contains("Venue:")')
        for element in venue_elements:
            venue_link = element.css('a::text').get()
            if venue_link:
                venue_name = venue_link.strip()
                break
            venue_text = element.css('::text').get()
            if venue_text and 'Venue:' in venue_text:
                venue_name = venue_text.replace('Venue:', '').strip()
                break

        # Fallback: extract from event name
        if not venue_name and event_name:
            venue_match = re.search(r'@\s*(.*?)(?:,|\s*\||$)', event_name)
            if venue_match:
                venue_name = venue_match.group(1).strip()

        # Extract article metadata
        last_updated_date = self.extract_last_updated_date(response)
        description = self.extract_description(response)

        # Create enhanced setlist item with all extracted metadata
        setlist_item = SetlistItem(
            setlist_name=page_title or response.url.split('/')[-1].replace('_', ' '),
            dj_artist_name=dj_name,
            event_name=event_name,
            venue_name=venue_name,
            set_date=set_date,
            last_updated_date=last_updated_date
        )

        # Add custom fields for additional metadata
        setlist_item['genre'] = genre
        setlist_item['label'] = label
        setlist_item['duration'] = duration
        setlist_item['mix_type'] = mix_type
        setlist_item['description'] = description
        setlist_item['source_url'] = response.url

        yield setlist_item

        # Enhanced tracklist extraction with multiple selectors
        track_elements = []

        # Try multiple selectors for tracklist
        selectors = [
            'ol.tracklist li',
            'div.tracklist-section ul li',
            'ol li:contains("."):not(:contains("Category"))',
            'ul li:contains("-")',
            '.mw-content-text ol li',
            '.mw-content-text ul li'
        ]

        for selector in selectors:
            elements = response.css(selector)
            if elements and len(elements) > 3:  # Require at least 3 tracks
                track_elements = elements
                self.logger.info(f"Found {len(track_elements)} tracks using selector: {selector}")
                break

        if not track_elements:
            self.logger.warning(f"No tracklist found for {response.url}")

        for i, track_el in enumerate(track_elements):
            track_string_raw = track_el.css('::text').getall()
            track_string = " ".join([t.strip() for t in track_string_raw if t.strip()])

            if track_string:
                parsed_track = parse_track_string(track_string)
                track_order = i + 1

                # Extract start time if available (e.g., [00:37])
                start_time_match = re.search(r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]', track_string)
                start_time = start_time_match.group(1) if start_time_match else None

                # Handle "ID - ID" tracks and incomplete entries [17, 3]
                if parsed_track['track_name'].lower() == 'id' or parsed_track['track_name'].lower() == '?':
                    parsed_track['track_name'] = "Unknown Track"
                    parsed_track['is_identified'] = False
                if not parsed_track['primary_artists'] and (parsed_track['track_name'] == "Unknown Track" or parsed_track['track_name'].lower() == '?'):
                    parsed_track['primary_artists'] = ["Unknown Artist"]
                    parsed_track['is_identified'] = False

                track_item = TrackItem(
                    track_name=parsed_track['track_name'],
                    is_remix=parsed_track['is_remix'],
                    is_mashup=parsed_track['is_mashup'],
                    mashup_components=parsed_track['mashup_components'],
                    start_time=start_time,
                    track_type='Setlist'
                )
                yield track_item

                # Yield TrackArtistItems
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
                    setlist_name=setlist_item['setlist_name'],
                    track_name=parsed_track['track_name'],
                    track_order=track_order,
                    start_time=start_time
                )

    def extract_genre(self, response):
        """Extract genre/style information from the page"""
        genre_selectors = [
            'li:contains("Genre:") a::text',
            'li:contains("Style:") a::text',
            'th:contains("Genre:") + td::text',
            'th:contains("Style:") + td::text',
            'a[href*="Category:"][href*="House"]::text',
            'a[href*="Category:"][href*="Techno"]::text',
            'a[href*="Category:"][href*="Progressive"]::text',
            'a[href*="Category:"][href*="Trance"]::text'
        ]

        for selector in genre_selectors:
            genre = response.css(selector).get()
            if genre:
                return genre.strip()
        return None

    def extract_label(self, response):
        """Extract record label information"""
        label_selectors = [
            'li:contains("Label:") a::text',
            'th:contains("Label:") + td::text',
            'li:contains("Released by:") a::text'
        ]

        for selector in label_selectors:
            label = response.css(selector).get()
            if label:
                return label.strip()
        return None

    def extract_duration(self, response):
        """Extract mix duration"""
        duration_selectors = [
            'li:contains("Duration:")::text',
            'th:contains("Duration:") + td::text',
            'li:contains("Length:")::text'
        ]

        for selector in duration_selectors:
            duration_text = response.css(selector).get()
            if duration_text:
                # Extract time format (e.g., "1:23:45" or "Duration: 1:23:45")
                time_match = re.search(r'(\d{1,2}:\d{2}(?::\d{2})?)', duration_text)
                if time_match:
                    return time_match.group(1)
        return None

    def extract_mix_type(self, response):
        """Extract type of mix (DJ Set, Radio Show, Podcast, etc.)"""
        title = response.css('h1::text').get() or ''

        if 'essential mix' in title.lower():
            return 'Essential Mix'
        elif 'radio' in title.lower():
            return 'Radio Show'
        elif 'podcast' in title.lower():
            return 'Podcast'
        elif 'live' in title.lower() or '@' in title:
            return 'Live Set'
        else:
            return 'DJ Mix'

    def extract_last_updated_date(self, response):
        """Extract when the article was last updated"""
        update_selectors = [
            'li:contains("Article Last Updated Date:")::text',
            'li:contains("Last updated:")::text',
            'span.mw-revisiontimestamp::text'
        ]

        for selector in update_selectors:
            update_text = response.css(selector).get()
            if update_text:
                # Try to extract date
                date_match = re.search(r'(\d{4}-\d{2}-\d{2})', update_text)
                if date_match:
                    return date_match.group(1)
                # Try to extract full datetime
                datetime_match = re.search(r'(\d{1,2}\s+\w+\s+\d{4})', update_text)
                if datetime_match:
                    return datetime_match.group(1)
        return None

    def extract_description(self, response):
        """Extract mix description or summary"""
        description_selectors = [
            'div.mw-content-text p:first-of-type::text',
            'div#mw-content-text p:first-of-type::text',
            'meta[name="description"]::attr(content)'
        ]

        for selector in description_selectors:
            desc = response.css(selector).get()
            if desc and len(desc.strip()) > 20:
                return desc.strip()[:500]  # Limit length
        return None