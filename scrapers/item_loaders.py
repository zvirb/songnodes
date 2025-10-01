"""
Centralized ItemLoader Definitions for SongNodes (Spec Section V.1)

MANDATORY: All spiders MUST use ItemLoaders for data extraction.
Direct Item dictionary population is PROHIBITED.

ItemLoaders provide:
- Separation of parsing logic (finding data) from cleaning logic (processing data)
- Reusable, composable processors
- Consistent data transformation across all spiders
- Field-level atomic transformations

Best Practices:
- input_processors: Applied to EACH extracted value (use MapCompose for atomic transforms)
- output_processors: Applied to FINAL list of values (use TakeFirst, Join, etc.)
- Processors from utils.processors are atomic, context-free functions
"""
from scrapy.loader import ItemLoader
from itemloaders.processors import TakeFirst, MapCompose, Join, Identity, Compose
from datetime import datetime

# Import reusable processors from utils library
from utils.processors import (
    strip_text,
    lowercase,
    uppercase,
    normalize_whitespace,
    remove_html_tags,
    clean_price,
    to_int,
    to_float,
    clean_bpm,
    parse_flexible_date,
    parse_duration_seconds,
    absolute_url,
    normalize_url,
    normalize_artist_name,
    clean_track_title,
    parse_musical_key,
    split_comma,
    unique_list,
)

# Import items
from items import (
    EnhancedArtistItem,
    EnhancedTrackItem,
    EnhancedSetlistItem,
    EnhancedVenueItem,
    PlaylistItem,
)


# ============================================================================
# ARTIST ITEMLOADER
# ============================================================================

class ArtistLoader(ItemLoader):
    """
    ItemLoader for EnhancedArtistItem.

    Usage in spider:
        loader = ArtistLoader(item=EnhancedArtistItem(), response=response)
        loader.add_css('artist_name', 'h1.artist-name::text')
        loader.add_xpath('bio', '//div[@class="bio"]/text()')
        artist_item = loader.load_item()
    """
    default_item_class = EnhancedArtistItem
    default_output_processor = TakeFirst()

    # Artist name processing
    artist_name_in = MapCompose(strip_text, normalize_artist_name)
    normalized_name_in = MapCompose(strip_text, lowercase, normalize_artist_name)

    # External IDs (strip whitespace only)
    spotify_id_in = MapCompose(strip_text)
    apple_music_id_in = MapCompose(strip_text)
    discogs_id_in = MapCompose(strip_text)
    musicbrainz_id_in = MapCompose(strip_text)

    # Genre preferences (list of genres)
    genre_preferences_in = MapCompose(strip_text, lowercase)
    genre_preferences_out = unique_list  # Remove duplicates

    # Country (uppercase ISO code)
    country_in = MapCompose(strip_text, uppercase)

    # Boolean fields
    is_verified_in = MapCompose(lambda x: str(x).lower() in ('true', '1', 'yes', 'verified'))

    # Numeric fields
    follower_count_in = MapCompose(to_int)
    monthly_listeners_in = MapCompose(to_int)
    popularity_score_in = MapCompose(to_int)
    formation_year_in = MapCompose(to_int)

    # Text fields (clean HTML and normalize)
    bio_in = MapCompose(remove_html_tags, normalize_whitespace)
    bio_out = Join('\n')  # Combine multiple bio fragments

    # Lists (join into single list)
    aliases_in = MapCompose(strip_text)
    aliases_out = unique_list

    record_labels_in = MapCompose(strip_text)
    record_labels_out = unique_list

    # Metadata (keep as-is)
    metadata_out = Identity()
    external_urls_out = Identity()
    social_media_out = Identity()

    # System fields
    created_at_in = MapCompose(parse_flexible_date)
    updated_at_in = MapCompose(parse_flexible_date)
    data_source_in = MapCompose(strip_text)


# ============================================================================
# TRACK ITEMLOADER
# ============================================================================

class TrackLoader(ItemLoader):
    """
    ItemLoader for EnhancedTrackItem.

    Usage in spider:
        loader = TrackLoader(item=EnhancedTrackItem(), response=response)
        loader.add_css('track_name', 'h1.track-title::text')
        loader.add_css('bpm', 'span.bpm::text')
        track_item = loader.load_item()
    """
    default_item_class = EnhancedTrackItem
    default_output_processor = TakeFirst()

    # Track name processing
    track_name_in = MapCompose(strip_text, clean_track_title)
    normalized_title_in = MapCompose(strip_text, lowercase, clean_track_title)

    # External IDs
    isrc_in = MapCompose(strip_text, uppercase)
    spotify_id_in = MapCompose(strip_text)
    apple_music_id_in = MapCompose(strip_text)
    youtube_id_in = MapCompose(strip_text)
    soundcloud_id_in = MapCompose(strip_text)
    discogs_id_in = MapCompose(strip_text)
    musicbrainz_id_in = MapCompose(strip_text)

    # Duration (convert to milliseconds)
    duration_ms_in = MapCompose(to_int)

    # Audio features
    bpm_in = MapCompose(clean_bpm, to_int)
    musical_key_in = MapCompose(parse_musical_key)

    # Audio features (0.0-1.0 range)
    energy_in = MapCompose(to_float)
    danceability_in = MapCompose(to_float)
    valence_in = MapCompose(to_float)
    acousticness_in = MapCompose(to_float)
    instrumentalness_in = MapCompose(to_float)
    liveness_in = MapCompose(to_float)
    speechiness_in = MapCompose(to_float)

    # Loudness (decibels)
    loudness_in = MapCompose(to_float)

    # Music metadata
    release_date_in = MapCompose(parse_flexible_date)
    genre_in = MapCompose(strip_text, lowercase)
    subgenre_in = MapCompose(strip_text, lowercase)
    record_label_in = MapCompose(strip_text)

    # Boolean track characteristics
    is_remix_in = MapCompose(lambda x: str(x).lower() in ('true', '1', 'yes', 'remix'))
    is_mashup_in = MapCompose(lambda x: str(x).lower() in ('true', '1', 'yes', 'mashup'))
    is_live_in = MapCompose(lambda x: str(x).lower() in ('true', '1', 'yes', 'live'))
    is_cover_in = MapCompose(lambda x: str(x).lower() in ('true', '1', 'yes', 'cover'))
    is_instrumental_in = MapCompose(lambda x: str(x).lower() in ('true', '1', 'yes', 'instrumental'))
    is_explicit_in = MapCompose(lambda x: str(x).lower() in ('true', '1', 'yes', 'explicit'))

    # Remix/version info
    remix_type_in = MapCompose(strip_text)
    original_artist_in = MapCompose(strip_text, normalize_artist_name)
    remixer_in = MapCompose(strip_text, normalize_artist_name)

    # Mashup components (list)
    mashup_components_in = MapCompose(strip_text)
    mashup_components_out = unique_list

    # Popularity metrics
    popularity_score_in = MapCompose(to_int)
    play_count_in = MapCompose(to_int)
    like_count_in = MapCompose(to_int)
    comment_count_in = MapCompose(to_int)

    # Context fields
    track_type_in = MapCompose(strip_text)
    source_context_in = MapCompose(strip_text)
    position_in_source_in = MapCompose(to_int)

    # Timestamps (duration in seconds -> convert to proper format)
    start_time_in = MapCompose(parse_duration_seconds)
    end_time_in = MapCompose(parse_duration_seconds)

    # Metadata
    metadata_out = Identity()
    external_urls_out = Identity()
    audio_features_out = Identity()

    # System fields
    created_at_in = MapCompose(parse_flexible_date)
    updated_at_in = MapCompose(parse_flexible_date)
    data_source_in = MapCompose(strip_text)


# ============================================================================
# SETLIST/PLAYLIST ITEMLOADER
# ============================================================================

class SetlistLoader(ItemLoader):
    """
    ItemLoader for EnhancedSetlistItem.

    Usage in spider:
        loader = SetlistLoader(item=EnhancedSetlistItem(), response=response)
        loader.add_css('setlist_name', 'h1.setlist-title::text')
        loader.add_css('event_date', 'time.event-date::attr(datetime)')
        setlist_item = loader.load_item()
    """
    default_item_class = EnhancedSetlistItem
    default_output_processor = TakeFirst()

    # Setlist name
    setlist_name_in = MapCompose(strip_text, clean_track_title)
    normalized_name_in = MapCompose(strip_text, lowercase)

    # Description (clean HTML)
    description_in = MapCompose(remove_html_tags, normalize_whitespace)
    description_out = Join('\n')

    # Artist/DJ info
    dj_artist_name_in = MapCompose(strip_text, normalize_artist_name)
    dj_artist_id_in = MapCompose(strip_text)

    # Supporting artists (list)
    supporting_artists_in = MapCompose(strip_text, normalize_artist_name)
    supporting_artists_out = unique_list

    # Event details
    event_name_in = MapCompose(strip_text)
    event_type_in = MapCompose(strip_text, lowercase)
    venue_name_in = MapCompose(strip_text)
    venue_location_in = MapCompose(strip_text)
    venue_capacity_in = MapCompose(to_int)

    # Temporal info
    set_date_in = MapCompose(parse_flexible_date)
    set_start_time_in = MapCompose(strip_text)
    set_end_time_in = MapCompose(strip_text)
    duration_minutes_in = MapCompose(to_int)
    last_updated_date_in = MapCompose(parse_flexible_date)

    # Performance context
    stage_name_in = MapCompose(strip_text)
    set_type_in = MapCompose(strip_text, lowercase)
    audio_quality_in = MapCompose(strip_text, lowercase)

    # Genre and mood tags (lists)
    genre_tags_in = MapCompose(strip_text, lowercase)
    genre_tags_out = unique_list

    mood_tags_in = MapCompose(strip_text, lowercase)
    mood_tags_out = unique_list

    # BPM range (keep as dict)
    bpm_range_out = Identity()

    # Total tracks
    total_tracks_in = MapCompose(to_int)

    # External platform IDs
    spotify_playlist_id_in = MapCompose(strip_text)
    soundcloud_playlist_id_in = MapCompose(strip_text)
    mixcloud_id_in = MapCompose(strip_text)
    youtube_playlist_id_in = MapCompose(strip_text)

    # Engagement metrics
    play_count_in = MapCompose(to_int)
    like_count_in = MapCompose(to_int)
    comment_count_in = MapCompose(to_int)
    share_count_in = MapCompose(to_int)

    # Metadata
    metadata_out = Identity()
    external_urls_out = Identity()

    # System fields
    created_at_in = MapCompose(parse_flexible_date)
    updated_at_in = MapCompose(parse_flexible_date)
    data_source_in = MapCompose(strip_text)


# ============================================================================
# VENUE ITEMLOADER
# ============================================================================

class VenueLoader(ItemLoader):
    """ItemLoader for EnhancedVenueItem."""
    default_item_class = EnhancedVenueItem
    default_output_processor = TakeFirst()

    # Venue name
    venue_name_in = MapCompose(strip_text)
    normalized_name_in = MapCompose(strip_text, lowercase)

    # Location details
    address_in = MapCompose(strip_text)
    city_in = MapCompose(strip_text)
    state_province_in = MapCompose(strip_text)
    country_in = MapCompose(strip_text, uppercase)
    postal_code_in = MapCompose(strip_text)

    # Coordinates
    latitude_in = MapCompose(to_float)
    longitude_in = MapCompose(to_float)

    # Venue characteristics
    venue_type_in = MapCompose(strip_text, lowercase)
    capacity_in = MapCompose(to_int)
    sound_system_in = MapCompose(strip_text)
    stage_count_in = MapCompose(to_int)

    # External IDs
    foursquare_id_in = MapCompose(strip_text)
    facebook_id_in = MapCompose(strip_text)
    google_place_id_in = MapCompose(strip_text)

    # Metadata
    metadata_out = Identity()
    external_urls_out = Identity()

    # System fields
    created_at_in = MapCompose(parse_flexible_date)
    updated_at_in = MapCompose(parse_flexible_date)
    data_source_in = MapCompose(strip_text)


# ============================================================================
# PLAYLIST ITEMLOADER (Legacy compatibility)
# ============================================================================

class PlaylistLoader(ItemLoader):
    """
    ItemLoader for PlaylistItem (legacy compatibility).

    Simpler loader for basic playlist scraping.
    """
    default_item_class = PlaylistItem
    default_output_processor = TakeFirst()

    # Basic fields
    name_in = MapCompose(strip_text)
    source_in = MapCompose(strip_text)
    source_url_in = MapCompose(strip_text, normalize_url)

    # DJ/Artist
    dj_name_in = MapCompose(strip_text, normalize_artist_name)
    artist_name_in = MapCompose(strip_text, normalize_artist_name)
    curator_in = MapCompose(strip_text)

    # Event info
    event_name_in = MapCompose(strip_text)
    event_date_in = MapCompose(parse_flexible_date)
    venue_name_in = MapCompose(strip_text)

    # Tracks (list)
    tracks_in = MapCompose(strip_text)
    tracks_out = unique_list

    total_tracks_in = MapCompose(to_int)

    # Description
    description_in = MapCompose(remove_html_tags, normalize_whitespace)

    # Genre tags (list)
    genre_tags_in = MapCompose(strip_text, lowercase)
    genre_tags_out = unique_list

    # Duration
    duration_minutes_in = MapCompose(to_int)

    # Platform IDs
    playlist_id_in = MapCompose(strip_text)
    platform_id_in = MapCompose(strip_text)

    # System fields
    data_source_in = MapCompose(strip_text)
    scrape_timestamp_in = MapCompose(parse_flexible_date)
    created_at_in = MapCompose(parse_flexible_date)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def create_loader_with_base_url(loader_class, response, base_url=None):
    """
    Factory function to create ItemLoader with automatic base URL resolution.

    Usage:
        loader = create_loader_with_base_url(TrackLoader, response)
        loader.add_css('track_url', 'a.track-link::attr(href)')  # Auto-resolves relative URLs
    """
    base_url = base_url or response.url

    # Create custom loader with URL processors
    class UrlAwareLoader(loader_class):
        # Add absolute URL processor to all URL fields
        track_url_in = MapCompose(lambda url: absolute_url(url, base_url))
        source_url_in = MapCompose(lambda url: absolute_url(url, base_url))
        artist_url_in = MapCompose(lambda url: absolute_url(url, base_url))

    return UrlAwareLoader(response=response)
