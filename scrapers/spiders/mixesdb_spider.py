import scrapy
from ..items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem
from .utils import parse_track_string
import re

class MixesdbSpider(scrapy.Spider):
    name = 'mixesdb'
    allowed_domains = ['mixesdb.com']
    start_urls = [
        'https://www.mixesdb.com/w/2025-05-13_-_Purple_Disco_Machine_-_Purple_Disco_Tales_May_2025', # Example URL [16]
        'https://www.mixesdb.com/w/2025-05-31_-_Adam_Beyer_-_Essential_Mix', # Example URL [17]
        'https://www.mixesdb.com/w/2025-03-11_-_John_Summit_-_Experts_Only_Radio_025_(MMW_Special)', # Example URL [18]
        'https://www.mixesdb.com/w/2025-06-02_-_Meduza_-_Aeterna_Radio_June_2025', # Example URL [19]
        'https://www.mixesdb.com/w/2023-07-21_-_FISHER_@_Desert_Valley,_Parookaville', # Example URL [20]
        'https://www.mixesdb.com/w/2025-03-29_-_Carl_Cox_@_Ultra_Music_Festival,_Miami', # Example URL [21]
        # Inaccessible URLs (scraper should handle gracefully) [22, 23, 3]
        # 'https://www.mixesdb.com/w/2025-02-11_-_John_Summit_-_Experts_Only_Radio_023',
        # 'https://www.mixesdb.com/w/2023-12-08_-_Rooler_@_All_Night_Long,_Bootshaus,_Cologne,_Germany',
    ]

    def parse(self, response):
        # Handle inaccessible pages [3]
        if "This website is inaccessible" in response.text:
            self.logger.warning(f"Skipping inaccessible URL: {response.url}")
            return

        # Extract DJ's Name, Event Details, Set Date [3]
        dj_name = response.css('h1#firstHeading span.mw-page-title-main::text').get()
        if dj_name:
            # Clean up DJ name from title, e.g., "2021-09-18 - Charlotte de Witte - Essential Mix"
            match = re.search(r'-\s*(.*?)\s*-\s*(.*)', dj_name)
            if match:
                dj_name = match.group(1).strip()
                event_name = match.group(2).strip()
            else:
                event_name = dj_name.strip() # Fallback if no clear separator

        set_date_raw = response.css('li:contains("Date:")::text').get()
        set_date = None
        if set_date_raw:
            date_match = re.search(r'Date:\s*(\d{4}-\d{2}-\d{2})', set_date_raw)
            if date_match:
                set_date = date_match.group(1)

        venue_name = response.css('li:contains("Venue:") a::text').get()
        if not venue_name: # Try to extract from event name if not explicit
            venue_match = re.search(r'@\s*(.*?)(?:,|\s*\||$)', event_name)
            if venue_match:
                venue_name = venue_match.group(1).strip()

        # Extract "Article Last Updated Date" [15, 19, 17, 21, 20, 16, 18, 3]
        last_updated_date_raw = response.css('li:contains("Article Last Updated Date:")::text').get()
        last_updated_date = None
        if last_updated_date_raw:
            date_match = re.search(r'Date:\s*(.*)', last_updated_date_raw)
            if date_match:
                last_updated_date = date_match.group(1).strip()

        setlist_item = SetlistItem(
            setlist_name=response.url.split('/')[-1].replace('_', ' ').replace('-', ' ').strip(), # Derive from URL
            dj_artist_name=dj_name,
            event_name=event_name,
            venue_name=venue_name,
            set_date=set_date,
            last_updated_date=last_updated_date
        )
        yield setlist_item

        # Extract Tracklist [3]
        track_elements = response.css('ol.tracklist li')
        if not track_elements:
            track_elements = response.css('div.tracklist-section ul li') # Fallback for other structures

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