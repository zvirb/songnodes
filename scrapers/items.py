"""
Enhanced Scrapy Items for comprehensive music data collection
Compatible with the upgraded database schema including all metadata fields
"""
import scrapy
from datetime import datetime


class EnhancedArtistItem(scrapy.Item):
    """Enhanced artist item with complete metadata support"""
    # Basic fields
    artist_name = scrapy.Field()
    normalized_name = scrapy.Field()
    aliases = scrapy.Field()  # List of alternative names

    # External platform IDs
    spotify_id = scrapy.Field()
    apple_music_id = scrapy.Field()
    youtube_channel_id = scrapy.Field()
    soundcloud_id = scrapy.Field()
    discogs_id = scrapy.Field()
    musicbrainz_id = scrapy.Field()

    # Artist metadata
    genre_preferences = scrapy.Field()  # List of genres
    country = scrapy.Field()  # ISO country code
    is_verified = scrapy.Field()  # Boolean
    follower_count = scrapy.Field()
    monthly_listeners = scrapy.Field()
    popularity_score = scrapy.Field()  # 0-100

    # Additional metadata
    bio = scrapy.Field()
    formation_year = scrapy.Field()
    active_years = scrapy.Field()
    record_labels = scrapy.Field()  # List
    social_media = scrapy.Field()  # Dict of platform:url
    metadata = scrapy.Field()  # JSON metadata
    external_urls = scrapy.Field()  # Dict of platform:url

    # System fields
    created_at = scrapy.Field()
    updated_at = scrapy.Field()
    data_source = scrapy.Field()  # Which scraper/source
    scrape_timestamp = scrapy.Field()


class EnhancedTrackItem(scrapy.Item):
    """Enhanced track item with complete audio features and metadata"""
    # Basic track info
    track_name = scrapy.Field()
    normalized_title = scrapy.Field()
    duration_ms = scrapy.Field()

    # External platform IDs
    isrc = scrapy.Field()
    spotify_id = scrapy.Field()
    apple_music_id = scrapy.Field()
    youtube_id = scrapy.Field()
    soundcloud_id = scrapy.Field()
    discogs_id = scrapy.Field()
    musicbrainz_id = scrapy.Field()

    # Audio features (Spotify-style)
    bpm = scrapy.Field()  # Beats per minute
    musical_key = scrapy.Field()  # Musical key (e.g., "C", "Am")
    energy = scrapy.Field()  # 0.0-1.0
    danceability = scrapy.Field()  # 0.0-1.0
    valence = scrapy.Field()  # 0.0-1.0 (musical positivity)
    acousticness = scrapy.Field()  # 0.0-1.0
    instrumentalness = scrapy.Field()  # 0.0-1.0
    liveness = scrapy.Field()  # 0.0-1.0
    speechiness = scrapy.Field()  # 0.0-1.0
    loudness = scrapy.Field()  # dB

    # Music metadata
    release_date = scrapy.Field()
    genre = scrapy.Field()
    subgenre = scrapy.Field()
    record_label = scrapy.Field()

    # Track characteristics
    is_remix = scrapy.Field()
    is_mashup = scrapy.Field()
    is_live = scrapy.Field()
    is_cover = scrapy.Field()
    is_instrumental = scrapy.Field()
    is_explicit = scrapy.Field()

    # Remix/version info
    remix_type = scrapy.Field()  # "Original Mix", "Radio Edit", etc.
    original_artist = scrapy.Field()  # For covers/remixes
    remixer = scrapy.Field()  # Remixer name
    mashup_components = scrapy.Field()  # List of original tracks

    # Popularity and engagement
    popularity_score = scrapy.Field()  # 0-100
    play_count = scrapy.Field()
    like_count = scrapy.Field()
    comment_count = scrapy.Field()

    # Rich metadata
    metadata = scrapy.Field()  # JSON metadata
    external_urls = scrapy.Field()  # Dict of platform:url
    audio_features = scrapy.Field()  # Full audio analysis

    # Context from scrapers
    track_type = scrapy.Field()  # "Setlist", "Playlist", "Album", etc.
    source_context = scrapy.Field()  # Which playlist/setlist it came from
    position_in_source = scrapy.Field()  # Track order
    start_time = scrapy.Field()  # Timestamp in mix/set
    end_time = scrapy.Field()

    # System fields
    created_at = scrapy.Field()
    updated_at = scrapy.Field()
    data_source = scrapy.Field()
    scrape_timestamp = scrapy.Field()


class EnhancedSetlistItem(scrapy.Item):
    """Enhanced setlist/playlist item with comprehensive event metadata"""
    # Basic setlist info
    setlist_name = scrapy.Field()
    normalized_name = scrapy.Field()
    description = scrapy.Field()

    # Artist/DJ info
    dj_artist_name = scrapy.Field()
    dj_artist_id = scrapy.Field()  # External ID
    supporting_artists = scrapy.Field()  # List

    # Event details
    event_name = scrapy.Field()
    event_type = scrapy.Field()  # "Festival", "Club Night", "Radio Show", etc.
    venue_name = scrapy.Field()
    venue_location = scrapy.Field()
    venue_capacity = scrapy.Field()

    # Temporal info
    set_date = scrapy.Field()
    set_start_time = scrapy.Field()
    set_end_time = scrapy.Field()
    duration_minutes = scrapy.Field()
    last_updated_date = scrapy.Field()

    # Performance context
    stage_name = scrapy.Field()  # "Main Stage", "Warehouse", etc.
    set_type = scrapy.Field()  # "Opening", "Headliner", "Closing", etc.
    audio_quality = scrapy.Field()  # "Studio", "Live", "Bootleg", etc.

    # Metadata
    genre_tags = scrapy.Field()  # List
    mood_tags = scrapy.Field()  # List
    bpm_range = scrapy.Field()  # Dict with min/max
    total_tracks = scrapy.Field()

    # External platform info
    spotify_playlist_id = scrapy.Field()
    soundcloud_playlist_id = scrapy.Field()
    mixcloud_id = scrapy.Field()
    youtube_playlist_id = scrapy.Field()

    # Engagement metrics
    play_count = scrapy.Field()
    like_count = scrapy.Field()
    comment_count = scrapy.Field()
    share_count = scrapy.Field()

    # Rich metadata
    metadata = scrapy.Field()  # JSON metadata
    external_urls = scrapy.Field()  # Dict of platform:url

    # System fields
    created_at = scrapy.Field()
    updated_at = scrapy.Field()
    data_source = scrapy.Field()
    scrape_timestamp = scrapy.Field()


class EnhancedTrackArtistItem(scrapy.Item):
    """Enhanced track-artist relationship with detailed role information"""
    # Relationship identifiers
    track_name = scrapy.Field()
    track_id = scrapy.Field()  # External track ID
    artist_name = scrapy.Field()
    artist_id = scrapy.Field()  # External artist ID

    # Relationship details
    artist_role = scrapy.Field()  # "primary", "featured", "remixer", "producer", etc.
    position = scrapy.Field()  # Order of appearance (0=primary)
    contribution_type = scrapy.Field()  # "vocals", "production", "remix", etc.
    contribution_percentage = scrapy.Field()  # For splits/royalties

    # Credit info
    credit_name = scrapy.Field()  # How they're credited on this track
    is_alias = scrapy.Field()  # Boolean - if using a different name

    # System fields
    created_at = scrapy.Field()
    data_source = scrapy.Field()
    scrape_timestamp = scrapy.Field()


class EnhancedSetlistTrackItem(scrapy.Item):
    """Enhanced setlist-track relationship with performance context"""
    # Basic relationship
    setlist_name = scrapy.Field()
    setlist_id = scrapy.Field()
    track_name = scrapy.Field()
    track_id = scrapy.Field()
    track_order = scrapy.Field()

    # Performance timing
    start_time = scrapy.Field()  # Timestamp in set
    end_time = scrapy.Field()
    duration_seconds = scrapy.Field()

    # Performance context
    transition_type = scrapy.Field()  # "beatmatch", "cut", "crossfade", etc.
    key_lock = scrapy.Field()  # Boolean - if key was locked
    tempo_change = scrapy.Field()  # BPM adjustment

    # Audience engagement
    crowd_response = scrapy.Field()  # "High", "Medium", "Low" if available
    is_peak_time = scrapy.Field()  # Boolean
    is_opener = scrapy.Field()  # Boolean
    is_closer = scrapy.Field()  # Boolean

    # Technical info
    audio_quality = scrapy.Field()
    source_file_format = scrapy.Field()  # "MP3", "WAV", "FLAC", etc.

    # System fields
    created_at = scrapy.Field()
    data_source = scrapy.Field()
    scrape_timestamp = scrapy.Field()


class EnhancedVenueItem(scrapy.Item):
    """Venue information for complete event context"""
    venue_name = scrapy.Field()
    normalized_name = scrapy.Field()

    # Location details
    address = scrapy.Field()
    city = scrapy.Field()
    state_province = scrapy.Field()
    country = scrapy.Field()
    postal_code = scrapy.Field()
    latitude = scrapy.Field()
    longitude = scrapy.Field()

    # Venue characteristics
    venue_type = scrapy.Field()  # "Club", "Festival Ground", "Arena", etc.
    capacity = scrapy.Field()
    sound_system = scrapy.Field()
    stage_count = scrapy.Field()

    # External IDs
    foursquare_id = scrapy.Field()
    facebook_id = scrapy.Field()
    google_place_id = scrapy.Field()

    # Metadata
    metadata = scrapy.Field()
    external_urls = scrapy.Field()

    # System fields
    created_at = scrapy.Field()
    updated_at = scrapy.Field()
    data_source = scrapy.Field()
    scrape_timestamp = scrapy.Field()


class TargetTrackSearchItem(scrapy.Item):
    """Item for tracking which target tracks to search for"""
    track_title = scrapy.Field()
    primary_artist = scrapy.Field()
    featured_artists = scrapy.Field()  # List
    genre = scrapy.Field()
    search_terms = scrapy.Field()  # List of search variations
    priority = scrapy.Field()  # "high", "medium", "low"
    remix_variations = scrapy.Field()  # List of expected remix titles

    # Search tracking
    sources_to_search = scrapy.Field()  # List of platforms
    search_status = scrapy.Field()  # "pending", "searching", "completed"
    results_found = scrapy.Field()  # Count of results

    # System fields
    created_at = scrapy.Field()
    data_source = scrapy.Field()


# Legacy item classes for backward compatibility with old spiders
class SetlistItem(scrapy.Item):
    event_id = scrapy.Field()
    artist_name = scrapy.Field()
    venue_name = scrapy.Field()
    event_date = scrapy.Field()
    source_url = scrapy.Field()

class TrackItem(scrapy.Item):
    track_id = scrapy.Field()
    track_name = scrapy.Field()
    track_url = scrapy.Field()
    source_platform = scrapy.Field()

class TrackArtistItem(scrapy.Item):
    track_id = scrapy.Field()
    artist_id = scrapy.Field()
    role = scrapy.Field()

class SetlistTrackItem(scrapy.Item):
    setlist_id = scrapy.Field()
    track_id = scrapy.Field()
    position = scrapy.Field()

class PlaylistTrackItem(scrapy.Item):
    playlist_id = scrapy.Field()
    track_id = scrapy.Field()
    position = scrapy.Field()