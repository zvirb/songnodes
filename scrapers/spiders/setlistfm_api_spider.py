"""
Setlist.fm API Spider
Uses the official Setlist.fm API v1.0 to collect live performance data
"""

import scrapy
import json
import os
from datetime import datetime
from urllib.parse import quote
from ..items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem

class SetlistFmApiSpider(scrapy.Spider):
    name = 'setlistfm_api'
    allowed_domains = ['api.setlist.fm']

    custom_settings = {
        'DOWNLOAD_DELAY': 0.1,  # 10 requests per second max
        'CONCURRENT_REQUESTS': 1,
        'DEFAULT_REQUEST_HEADERS': {
            'Accept': 'application/json',
            'x-api-key': os.environ.get('SETLISTFM_API_KEY', '8xTq8eBNbEZCWKg1ZrGpgsRQlU9GlNYNZVtG')
        }
    }

    def __init__(self, artist_name=None, venue=None, city=None, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Build search URL based on parameters
        base_url = 'https://api.setlist.fm/rest/1.0/search/setlists'
        params = []

        if artist_name:
            params.append(f'artistName={quote(artist_name)}')
        if venue:
            params.append(f'venueName={quote(venue)}')
        if city:
            params.append(f'cityName={quote(city)}')

        # Default to popular artists if no params provided
        if not params:
            # Search for recent popular electronic music artists
            self.start_urls = [
                'https://api.setlist.fm/rest/1.0/search/setlists?artistName=Calvin%20Harris',
                'https://api.setlist.fm/rest/1.0/search/setlists?artistName=David%20Guetta',
                'https://api.setlist.fm/rest/1.0/search/setlists?artistName=Marshmello',
                'https://api.setlist.fm/rest/1.0/search/setlists?artistName=Swedish%20House%20Mafia',
                'https://api.setlist.fm/rest/1.0/search/setlists?artistName=Skrillex'
            ]
        else:
            self.start_urls = [f"{base_url}?{'&'.join(params)}"]

        self.logger.info(f"Initialized with URLs: {self.start_urls}")

    def parse(self, response):
        """Parse search results"""
        try:
            data = json.loads(response.text)

            # Process each setlist
            for setlist in data.get('setlist', []):
                # Create venue item
                venue_data = setlist.get('venue', {})
                city_data = venue_data.get('city', {})

                venue_item = {
                    'id': venue_data.get('id'),
                    'name': venue_data.get('name'),
                    'city': city_data.get('name'),
                    'state': city_data.get('stateCode'),
                    'country': city_data.get('country', {}).get('name'),
                    'latitude': city_data.get('coords', {}).get('lat'),
                    'longitude': city_data.get('coords', {}).get('long')
                }

                # Create event item
                artist_data = setlist.get('artist', {})
                event_date = setlist.get('eventDate')

                event_item = {
                    'id': setlist.get('id'),
                    'name': setlist.get('tour', {}).get('name') or f"{artist_data.get('name')} Live",
                    'date': event_date,
                    'venue_id': venue_data.get('id'),
                    'artist_id': artist_data.get('mbid'),
                    'artist_name': artist_data.get('name')
                }

                # Create setlist item
                setlist_item = SetlistItem()
                setlist_item['setlist_name'] = f"{artist_data.get('name')} - {event_date} - {venue_data.get('name')}"
                setlist_item['dj_artist_name'] = artist_data.get('name')
                setlist_item['event_name'] = setlist.get('tour', {}).get('name')
                setlist_item['venue_name'] = venue_data.get('name')
                setlist_item['set_date'] = event_date
                setlist_item['last_updated_date'] = None

                yield setlist_item

                # Process tracks in the setlist
                sets = setlist.get('sets', {}).get('set', [])
                track_position = 1

                for set_data in sets:
                    for song in set_data.get('song', []):
                        name = song.get('name') or ''
                        track_item = TrackItem()
                        track_item['track_name'] = name
                        track_item['is_remix'] = bool(re.search(r'(remix|edit|mix)\b', name, re.IGNORECASE))
                        track_item['is_mashup'] = bool(re.search(r'\b(vs\.|mashup)\b', name, re.IGNORECASE))
                        track_item['mashup_components'] = []
                        track_item['track_type'] = 'Setlist'

                        # Check if it's a cover
                        if song.get('cover'):
                            track_item['is_cover'] = True

                        yield track_item

                        # Yield track artist relationship
                        track_artist_item = TrackArtistItem()
                        track_artist_item['track_name'] = name
                        track_artist_item['artist_name'] = artist_data.get('name')
                        track_artist_item['artist_role'] = 'primary'
                        yield track_artist_item

                        # Yield setlist track relationship
                        setlist_track_item = SetlistTrackItem()
                        setlist_track_item['setlist_name'] = setlist_item['setlist_name']
                        setlist_track_item['track_name'] = name
                        setlist_track_item['track_order'] = track_position
                        setlist_track_item['start_time'] = None
                        yield setlist_track_item

                        track_position += 1

                self.logger.info(f"Processed setlist: {setlist_item['setlist_name']}")

            # Handle pagination
            total_setlists = data.get('total', 0)
            current_page = data.get('page', 1)
            items_per_page = data.get('itemsPerPage', 20)

            if current_page * items_per_page < total_setlists:
                next_page = current_page + 1
                next_url = f"{response.url.split('&p=')[0]}&p={next_page}"
                yield scrapy.Request(next_url, callback=self.parse)

        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
        except Exception as e:
            self.logger.error(f"Error processing setlist data: {e}")

    def parse_artist_setlists(self, response):
        """Parse setlists for a specific artist"""
        return self.parse(response)
