import scrapy
from items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem, ArtistItem, VenueItem, EventItem, ArtistEventItem
import re
import requests
import time
import json
import os
from urllib.parse import urljoin, urlparse
from datetime import datetime
import logging

class SetlistFmSpider(scrapy.Spider):
    name = 'setlistfm'
    allowed_domains = ['api.setlist.fm', 'setlist.fm']

    # API Configuration
    API_BASE_URL = 'https://api.setlist.fm/rest/1.0/'
    API_KEY = os.getenv('SETLISTFM_API_KEY')

    # Rate limiting (max 16 requests per second according to API docs)
    RATE_LIMIT_DELAY = 1.0 / 16  # ~0.0625 seconds between requests

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.last_request_time = 0

        if not self.API_KEY:
            self.logger.error("SETLISTFM_API_KEY environment variable not set")
            raise ValueError("API key is required for Setlist.fm API access")

        # API session with proper headers
        self.session = requests.Session()
        self.session.headers.update({
            'x-api-key': self.API_KEY,
            'Accept': 'application/json',
            'Accept-Language': 'en',
            'User-Agent': 'SongNodes/1.0 (+https://github.com/songnodes/music-graph)'
        })

        # Extract spider arguments for search parameters
        self.search_params = {}

        # Handle spider arguments from command line
        if hasattr(self, 'artistName'):
            self.search_params['artistName'] = self.artistName
        if hasattr(self, 'venue'):
            self.search_params['venue'] = self.venue
        if hasattr(self, 'city'):
            self.search_params['city'] = self.city
        if hasattr(self, 'date'):
            self.search_params['date'] = self.date
        if hasattr(self, 'setlist_id'):
            self.setlist_id = self.setlist_id

        # Default search if no specific parameters provided
        if not self.search_params and not hasattr(self, 'setlist_id'):
            # Search for recent electronic music setlists
            self.search_params = {
                'artistName': 'Fred again..',
                'p': 1  # Start with page 1
            }

    def start_requests(self):
        """Generate initial requests based on search parameters"""
        # If a specific setlist ID is provided, fetch that setlist directly
        setlist_id = getattr(self, 'setlist_id', None)
        if setlist_id:
            url = self._build_api_url(f'setlist/{setlist_id}')
            yield scrapy.Request(url=url, callback=self.parse_setlist, dont_filter=True)
            return

        # If an artist name is provided, search for their setlists
        artist_name = self.search_params.get('artistName')
        if artist_name:
            # First, search for the artist to get their MBID
            artist_search_url = self._build_api_url('search/artists', {'artistName': artist_name})
            yield scrapy.Request(url=artist_search_url, callback=self.parse_artist_search, dont_filter=True)
        else:
            # Perform a general setlist search
            search_url = self._build_api_url('search/setlists', self.search_params)
            yield scrapy.Request(url=search_url, callback=self.parse_setlist_search, dont_filter=True)

    def _build_api_url(self, endpoint, params=None):
        """Build API URL with proper parameters"""
        url = urljoin(self.API_BASE_URL, endpoint)
        if params:
            param_str = '&'.join([f"{k}={v}" for k, v in params.items()])
            url = f"{url}?{param_str}"
        return url

    def _rate_limit(self):
        """Implement rate limiting to respect API limits"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time

        if time_since_last < self.RATE_LIMIT_DELAY:
            sleep_time = self.RATE_LIMIT_DELAY - time_since_last
            time.sleep(sleep_time)

        self.last_request_time = time.time()

    def _make_api_request(self, url):
        """Make API request with rate limiting and error handling"""
        self._rate_limit()

        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            self.logger.error(f"API request failed: {e}")
            return None

    def parse_artist_search(self, response):
        """Parse artist search results and get setlists for found artists"""
        try:
            data = json.loads(response.text)
            artists = data.get('artist', [])

            if not artists:
                self.logger.warning(f"No artists found for search: {self.search_params.get('artistName')}")
                return

            # Process first matching artist
            artist = artists[0]
            artist_mbid = artist.get('mbid')
            artist_name = artist.get('name')

            if artist_mbid:
                # Yield artist item
                yield ArtistItem(artist_name=artist_name)

                # Search for setlists by this artist
                setlist_search_url = self._build_api_url('search/setlists', {
                    'artistMbid': artist_mbid,
                    'p': 1
                })
                yield scrapy.Request(
                    url=setlist_search_url,
                    callback=self.parse_setlist_search,
                    meta={'artist_name': artist_name, 'artist_mbid': artist_mbid}
                )

        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse artist search response: {e}")

    def parse_setlist_search(self, response):
        """Parse setlist search results"""
        try:
            data = json.loads(response.text)
            setlists = data.get('setlist', [])

            if not setlists:
                self.logger.warning("No setlists found in search results")
                return

            # Process each setlist
            for setlist in setlists:
                yield from self.process_setlist_data(setlist)

            # Handle pagination if there are more pages
            page = data.get('page', 1)
            total_pages = data.get('total', 0) // data.get('itemsPerPage', 20) + 1

            if page < total_pages and page < 5:  # Limit to first 5 pages
                next_page_params = self.search_params.copy()
                next_page_params['p'] = page + 1

                next_url = self._build_api_url('search/setlists', next_page_params)
                yield scrapy.Request(url=next_url, callback=self.parse_setlist_search)

        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse setlist search response: {e}")

    def parse_setlist(self, response):
        """Parse individual setlist data"""
        try:
            setlist_data = json.loads(response.text)
            yield from self.process_setlist_data(setlist_data)

        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse setlist response: {e}")

    def process_setlist_data(self, setlist_data):
        """Process setlist data and yield items"""
        try:
            # Extract basic setlist information
            setlist_id = setlist_data.get('id')
            artist_data = setlist_data.get('artist', {})
            venue_data = setlist_data.get('venue', {})
            event_date = setlist_data.get('eventDate')
            tour_data = setlist_data.get('tour', {})

            # Extract artist information
            artist_name = artist_data.get('name')
            artist_mbid = artist_data.get('mbid')

            # Extract venue information
            venue_name = venue_data.get('name')
            venue_city = venue_data.get('city', {})
            city_name = venue_city.get('name')
            city_state = venue_city.get('state')
            city_country = venue_city.get('country', {}).get('name')

            # Build full venue string
            venue_parts = [venue_name]
            if city_name:
                venue_parts.append(city_name)
            if city_state:
                venue_parts.append(city_state)
            if city_country:
                venue_parts.append(city_country)
            full_venue = ', '.join(filter(None, venue_parts))

            # Extract tour information
            tour_name = tour_data.get('name') if tour_data else None

            # Build setlist name
            setlist_name_parts = []
            if artist_name:
                setlist_name_parts.append(artist_name)
            if event_date:
                setlist_name_parts.append(event_date)
            if venue_name:
                setlist_name_parts.append(venue_name)

            setlist_name = ' - '.join(setlist_name_parts) if setlist_name_parts else f"Setlist {setlist_id}"

            # Yield artist item if not already processed
            if artist_name:
                yield ArtistItem(artist_name=artist_name)

            # Yield venue item with structured location data
            if venue_name:
                venue_item = VenueItem(
                    venue_name=venue_name,
                    city=city_name,
                    state=city_state,
                    country=city_country,
                    venue_type=None,  # API doesn't provide venue type
                    capacity=None,    # API doesn't provide capacity
                    coordinates=None  # API doesn't provide coordinates
                )
                yield venue_item

            # Create event name for the performance
            event_name = f"{artist_name} at {venue_name}" if artist_name and venue_name else setlist_name
            if tour_name:
                event_name = f"{tour_name} - {event_name}"

            # Yield event item
            yield EventItem(
                event_name=event_name,
                event_date=event_date,
                venue_name=venue_name,
                event_type='concert',
                tour_name=tour_name
            )

            # Yield artist-event relationship
            if artist_name:
                yield ArtistEventItem(
                    artist_name=artist_name,
                    event_name=event_name,
                    performance_role='headliner'
                )

            # Yield setlist item
            yield SetlistItem(
                setlist_name=setlist_name,
                dj_artist_name=artist_name,
                event_name=event_name,  # Link to the event we created
                venue_name=full_venue,
                set_date=event_date,
                last_updated_date=datetime.now().isoformat()
            )

            # Process sets and songs
            sets_data = setlist_data.get('sets', {}).get('set', [])
            if not sets_data:
                self.logger.warning(f"No sets found in setlist {setlist_id}")
                return

            track_order = 1

            # Process each set
            for set_data in sets_data:
                songs = set_data.get('song', [])

                for song in songs:
                    song_name = song.get('name')
                    if not song_name:
                        continue

                    # Check for cover information
                    cover_artist = None
                    original_artist = song.get('cover', {})
                    if original_artist:
                        cover_artist = original_artist.get('name')

                    # Check for tape/interlude information
                    is_tape = song.get('tape', False)

                    # Extract additional info from song
                    info = song.get('info', '')

                    # Determine if it's a remix, mashup, etc.
                    is_remix = 'remix' in song_name.lower() or 'edit' in song_name.lower()
                    is_mashup = ' vs ' in song_name.lower() or ' vs. ' in song_name.lower()

                    mashup_components = []
                    if is_mashup:
                        # Split on common mashup separators
                        components = re.split(r'\s+vs\.?\s+', song_name, flags=re.IGNORECASE)
                        mashup_components = [comp.strip() for comp in components if comp.strip()]

                    # Yield track item
                    track_item = TrackItem(
                        track_name=song_name,
                        is_remix=is_remix,
                        is_mashup=is_mashup,
                        mashup_components=mashup_components if is_mashup else None,
                        track_type='Live Performance'
                    )
                    yield track_item

                    # Yield primary artist relationship
                    if artist_name:
                        yield TrackArtistItem(
                            track_name=song_name,
                            artist_name=artist_name,
                            artist_role='primary'
                        )

                    # Yield cover artist relationship if this is a cover
                    if cover_artist:
                        yield TrackArtistItem(
                            track_name=song_name,
                            artist_name=cover_artist,
                            artist_role='original_artist'
                        )

                    # Yield setlist-track relationship
                    yield SetlistTrackItem(
                        setlist_name=setlist_name,
                        track_name=song_name,
                        track_order=track_order,
                        start_time=None  # API doesn't provide timestamps
                    )

                    track_order += 1

        except Exception as e:
            self.logger.error(f"Error processing setlist data: {e}")

    def parse(self, response):
        """Default parse method - not used in API-based implementation"""
        # This method is kept for compatibility but not used
        # since we use start_requests() and specific parse methods
        pass