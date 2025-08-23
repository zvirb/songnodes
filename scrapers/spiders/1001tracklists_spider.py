import scrapy
from items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem
from .utils import parse_track_string
import re

class OneThousandOneTracklistsSpider(scrapy.Spider):
    name = '1001tracklists'
    allowed_domains = ['1001tracklists.com']
    start_urls = [
        'https://www.1001tracklists.com/tracklist/1rcyn73t/claptone-purple-disco-machine-the-masquerade-pacha-ibiza-spain-2023-08-12.html', # Example URL [5]
        'https://www.1001tracklists.com/tracklist/jck8kqk/tiesto-liv-las-vegas-united-states-2025-03-29.html', # Example URL [6]
        'https://www.1001tracklists.com/tracklist/nx3dkn1/fisher-desert-valley-stage-parookaville-germany-2023-07-21.html', # Example URL [7]
        'https://www.1001tracklists.com/tracklist/2cz5kkgk/tiesto-in-search-of-sunrise-kineticfield-edc-las-vegas-united-states-2025-05-18.html', # Example URL [8]
        'https://www.1001tracklists.com/tracklist/ul33u4k/artbat-steel-yard-creamfields-north-united-kingdom-2024-08-25.html', # Example URL [9]
        'https://www.1001tracklists.com/tracklist/p0k05sk/axwell-axtone-pool-party-nautilus-club-miami-music-week-united-states-2025-03-27.html', # Example URL [10]
        'https://www.1001tracklists.com/tracklist/1mmv6t09/skrillex-fred-again..-four-tet-madison-square-garden-new-york-united-states-2023-02-18.html', # Example URL [11]
        'https://www.1001tracklists.com/tracklist/ghxrr21/solomun-four-tet-mau-p-chloe-caillet-diynamic-resistance-megastructure-ultra-music-festival-miami-united-states-2025-03-30.html', # Example URL [12]
        'https://www.1001tracklists.com/tracklist/1kskf2fk/four-tet-fred-again..-skrillex-coachella-stage-coachella-festival-weekend-2-united-states-2023-04-23.html', # Example URL [13]
        'https://www.1001tracklists.com/tracklist/1rhb4nvt/axwell-mainstage-ultra-music-festival-australia-melbourne-2025-04-12.html', # Example URL [14]
    ]

    def parse(self, response):
        # Extract Setlist Metadata [3]
        setlist_name = response.css('h1.spotlightTitle::text').get()
        if not setlist_name:
            setlist_name = response.css('h1.tracklist-header-title::text').get() # Fallback for different page structures

        dj_artist_names = response.css('div.spotlight-artists a::text').getall()
        if not dj_artist_names:
            dj_artist_names = response.css('h1.tracklist-header-title a::text').getall()

        event_name = response.css('div.spotlight-event a::text').get()
        venue_name = response.css('div.spotlight-venue a::text').get()
        set_date = response.css('div.spotlight-date::text').get()

        # Clean and format extracted data
        setlist_name = setlist_name.strip() if setlist_name else None
        dj_artist_name = ", ".join([name.strip() for name in dj_artist_names]) if dj_artist_names else None
        event_name = event_name.strip() if event_name else None
        venue_name = venue_name.strip() if venue_name else None
        set_date = set_date.strip() if set_date else None

        setlist_item = SetlistItem(
            setlist_name=setlist_name,
            dj_artist_name=dj_artist_name,
            event_name=event_name,
            venue_name=venue_name,
            set_date=set_date,
            last_updated_date=None # 1001tracklists doesn't typically have this
        )
        yield setlist_item

        # Extract Tracklist [3]
        track_elements = response.css('div.tlpItem') # Common selector for track items
        if not track_elements:
            track_elements = response.css('li.tracklist-item') # Another common selector

        for i, track_el in enumerate(track_elements):
            track_string = track_el.css('span.trackValue::text').get()
            if not track_string:
                track_string = track_el.css('div.track-name::text').get() # Fallback

            if track_string:
                parsed_track = parse_track_string(track_string)
                track_order = i + 1

                # Extract start time if available
                start_time = track_el.css('span.tracklist-time::text').get()
                if not start_time:
                    start_time_match = re.search(r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]', track_string)
                    if start_time_match:
                        start_time = start_time_match.group(1)

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