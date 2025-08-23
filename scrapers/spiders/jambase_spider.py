import scrapy
from items import SetlistItem

class JambaseSpider(scrapy.Spider):
    name = 'jambase'
    allowed_domains = ['jambase.com']
    start_urls = []  # Add URLs here

    def parse(self, response):
        # Jambase provides concert details but explicitly states no tracklist information [28, 3]
        self.logger.info(f"Jambase.com does not provide tracklist information for {response.url}. Extracting concert details only.")

        artist_name = response.css('h1.band-name::text').get()
        if artist_name:
            artist_name = artist_name.strip()

        concert_elements = response.css('div.show-card') # Selector for individual concert listings

        for concert_el in concert_elements:
            date = concert_el.css('div.date::text').get()
            venue = concert_el.css('div.venue-name::text').get()
            location = concert_el.css('div.venue-location::text').get()

            if date and venue and location:
                setlist_name = f"{artist_name} - {date.strip()} - {venue.strip()}"
                yield SetlistItem(
                    setlist_name=setlist_name,
                    dj_artist_name=artist_name,
                    event_name=None, # Not explicitly available
                    venue_name=f"{venue.strip()}, {location.strip()}",
                    set_date=date.strip(),
                    last_updated_date=None
                )