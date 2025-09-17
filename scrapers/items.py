import scrapy

class ArtistItem(scrapy.Item):
    artist_name = scrapy.Field()

class AlbumItem(scrapy.Item):
    album_name = scrapy.Field()
    artist_name = scrapy.Field() # For linking to artist

class TrackItem(scrapy.Item):
    track_name = scrapy.Field()
    album_name = scrapy.Field() # Optional, for linking
    isrc = scrapy.Field() # From TIDAL, if available
    tidal_id = scrapy.Field() # From TIDAL, if available
    track_type = scrapy.Field() # e.g., "Playlist", "Single", "Setlist"
    is_remix = scrapy.Field()
    is_mashup = scrapy.Field()
    mashup_components = scrapy.Field() # List of strings

class SetlistItem(scrapy.Item):
    setlist_name = scrapy.Field()
    dj_artist_name = scrapy.Field() # Main DJ of the set
    event_name = scrapy.Field()
    venue_name = scrapy.Field()
    set_date = scrapy.Field()
    last_updated_date = scrapy.Field() # From mixesdb.com

class TrackArtistItem(scrapy.Item):
    track_name = scrapy.Field() # To link to the track
    artist_name = scrapy.Field() # To link to the artist
    artist_role = scrapy.Field() # e.g., 'primary', 'featured', 'remixer'

class PlaylistTrackItem(scrapy.Item):
    playlist_name = scrapy.Field()
    track_name = scrapy.Field()
    track_order = scrapy.Field()

class SetlistTrackItem(scrapy.Item):
    setlist_name = scrapy.Field()
    track_name = scrapy.Field()
    track_order = scrapy.Field()
    start_time = scrapy.Field() # Timestamp within set, e.g., '00:03:14' or '03:14'