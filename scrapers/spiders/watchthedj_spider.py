import scrapy
from items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem
from .utils import parse_track_string
from track_id_generator import generate_track_id_from_parsed
import re

class WatchTheDjSpider(scrapy.Spider):
    name = 'watchthedj'
    allowed_domains = ['watchthedj.com']
    start_urls = []  # Add URLs here

    def parse(self, response):
        # Extract Setlist Metadata
        # WatchTheDJ.com often has the DJ name in the URL and title
        title = response.css('h1.video-title::text').get()
        if title:
            title = title.strip()
            # Attempt to parse DJ name and event from title
            dj_name_match = re.search(r'^(.*?) - Live @ (.*)', title, re.IGNORECASE)
            if dj_name_match:
                dj_artist_name = dj_name_match.group(1).strip()
                event_name = dj_name_match.group(2).strip()
            else:
                dj_artist_name = title.split(' - ').strip() # Fallback
                event_name = title # Fallback

        venue_name = response.css('span.video-venue::text').get()
        set_date = response.css('span.video-date::text').get()

        setlist_item = SetlistItem(
            setlist_name=title,
            dj_artist_name=dj_artist_name,
            event_name=event_name,
            venue_name=venue_name.strip() if venue_name else None,
            set_date=set_date.strip() if set_date else None,
            last_updated_date=None # Not typically available on WatchTheDJ.com
        )
        yield setlist_item

        # Extract Tracklist from the dedicated section [1]
        # Try multiple selectors to handle different HTML structures
        track_elements = response.css('div.tracklist-section ol li')
        if not track_elements:
            # Fallback for alternative structures
            track_elements = response.css('ol li, ul.tracklist li, div.list-track')

        for i, track_el in enumerate(track_elements):
            track_string_raw = track_el.css('::text').getall()
            track_string = " ".join([t.strip() for t in track_string_raw if t.strip()])

            if track_string:
                # Extract timestamp first if present, e.g., "0:00:13 ID - ID (Intro)"
                start_time_match = re.match(r'^(\d{1,2}:\d{2}(?::\d{2})?)\s*(.*)', track_string)
                start_time = None
                if start_time_match:
                    start_time = start_time_match.group(1)
                    track_string_for_parsing = start_time_match.group(2).strip()
                else:
                    track_string_for_parsing = track_string

                parsed_track = parse_track_string(track_string_for_parsing)
                track_order = i + 1

                # Generate deterministic track_id for cross-source deduplication
                track_id = generate_track_id_from_parsed(parsed_track)

                # NOTE: Remix parsing is now handled by enrichment_pipeline._parse_remix_info()
                # which uses the sophisticated TrackTitleParser (2025 Best Practice)
                track_item = TrackItem(
                    track_id=track_id,  # Deterministic ID for matching across sources
                    track_name=parsed_track['track_name'],
                    is_remix=parsed_track['is_remix'],
                    is_mashup=parsed_track['is_mashup'],
                    mashup_components=parsed_track['mashup_components'],
                    start_time=start_time,
                    track_type='Setlist',
                    remix_type=None  # Will be populated by enrichment pipeline
                )

                # Log track_id generation
                primary_artist = parsed_track.get('primary_artists', [''])[0] if parsed_track.get('primary_artists') else ''
                self.logger.debug(f"Generated track_id {track_id} for: {primary_artist} - {parsed_track['track_name']}")

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
                    setlist_name=setlist_item['setlist_name'],
                    track_name=parsed_track['track_name'],
                    track_order=track_order,
                    start_time=start_time
                )