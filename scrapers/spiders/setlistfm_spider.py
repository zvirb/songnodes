import scrapy
from ..items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem
import re

class SetlistFmSpider(scrapy.Spider):
    name = 'setlistfm'
    allowed_domains = ['setlist.fm']
    start_urls = [
        'https://www.setlist.fm/setlist/fred-again/2024/ball-arena-denver-co-3b55dc5c.html', # Example URL [25]
        'https://www.setlist.fm/setlists/fred-again-skrillex-and-four-tet-23fbf4d7.html', # Example URL [26]
        'https://www.setlist.fm/setlists/swedish-house-mafia-13d5f9c1.html', # Example URL [27]
    ]

    def parse(self, response):
        # Extract Performing Artist, Concert Date, Venue [3]
        performing_artist = response.css('h1.url a::text').get()
        concert_date = response.css('time.value::text').get()
        venue_name = response.css('a.url span[itemprop="name"]::text').get()
        venue_location = response.css('span.locality::text').get()
        venue_country = response.css('span.country-name::text').get()

        full_venue = f"{venue_name}, {venue_location}, {venue_country}" if venue_name and venue_location and venue_country else venue_name

        setlist_name = f"{performing_artist} - {concert_date} - {full_venue}" if performing_artist and concert_date else response.url

        setlist_item = SetlistItem(
            setlist_name=setlist_name,
            dj_artist_name=performing_artist.strip() if performing_artist else None,
            event_name=None, # Not always explicit on setlist.fm
            venue_name=full_venue.strip() if full_venue else None,
            set_date=concert_date.strip() if concert_date else None,
            last_updated_date=response.css('p.lastUpdate::text').re_first(r'Date:\s*(.*)') # [24, 26]
        )
        yield setlist_item

        # Extract Tracklist [3]
        track_elements = response.css('li.setlist-song')
        if not track_elements:
            self.logger.warning(f"No tracklist found for {response.url} or incomplete. [3]")
            return

        for i, track_el in enumerate(track_elements):
            track_name_raw = track_el.css('a.songLabel::text').get()
            if not track_name_raw:
                track_name_raw = track_el.css('span.songLabel::text').get() # Fallback for non-linked songs

            if track_name_raw:
                track_name = track_name_raw.strip()

                # Extract notes like "(Travis Scott cover)", "(with Chase & Status)" [24, 3]
                notes_raw = track_el.css('span.songPart::text').getall()
                notes = [n.strip().replace('(', '').replace(')', '') for n in notes_raw if n.strip()]

                primary_artists = [performing_artist.strip()] if performing_artist else
                featured_artists =
                remixer_artists =
                is_remix = False
                is_mashup = False
                mashup_components =

                # Simple parsing for common notes
                for note in notes:
                    if 'cover' in note.lower():
                        # This would require more advanced parsing to get the actual cover artist
                        pass
                    if 'remix' in note.lower() or 'edit' in note.lower():
                        is_remix = True
                        remixer_match = re.search(r'\((.*?)\s*(remix|edit)\)', note, re.IGNORECASE)
                        if remixer_match:
                            remixer_artists.append(remixer_match.group(1).strip())
                    if 'with' in note.lower():
                        with_match = re.search(r'with\s*(.*)', note, re.IGNORECASE)
                        if with_match:
                            featured_artists.extend([a.strip() for a in re.split(r'[&,]', with_match.group(1))])
                    if 'vs.' in note.lower():
                        is_mashup = True
                        mashup_components.extend([comp.strip() for comp in re.split(r'\s*vs\.\s*', track_name) if comp.strip()])


                track_item = TrackItem(
                    track_name=track_name,
                    is_remix=is_remix,
                    is_mashup=is_mashup,
                    mashup_components=mashup_components if is_mashup else,
                    track_type='Concert'
                )
                yield track_item

                # Yield TrackArtistItems
                for artist in primary_artists:
                    yield TrackArtistItem(
                        track_name=track_name,
                        artist_name=artist,
                        artist_role='primary'
                    )
                for artist in featured_artists:
                    yield TrackArtistItem(
                        track_name=track_name,
                        artist_name=artist,
                        artist_role='featured'
                    )
                for artist in remixer_artists:
                    yield TrackArtistItem(
                        track_name=track_name,
                        artist_name=artist,
                        artist_role='remixer'
                    )

                # Yield SetlistTrackItem
                yield SetlistTrackItem(
                    setlist_name=setlist_name,
                    track_name=track_name,
                    track_order=i + 1,
                    start_time=None # Setlist.fm typically doesn't have timestamps
                )