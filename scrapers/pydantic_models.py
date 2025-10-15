"""
Pydantic Models for Data Validation Across Services (2025 Best Practices)

Provides comprehensive validation for:
- Scraper output data
- API request/response payloads
- Database pipeline inputs
- Track ID and artist attribution

Ensures data quality at every layer of the application.
"""
from pydantic import BaseModel, Field, field_validator, model_validator, constr, confloat, conint, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone
from enum import Enum
import re


# ============================================================================
# ENUMS FOR CONTROLLED VOCABULARIES
# ============================================================================

class DataSource(str, Enum):
    """Valid data sources for tracking origin"""
    TRACKLISTS_1001 = "1001tracklists"
    MIXESDB = "mixesdb"
    SETLISTFM = "setlistfm"
    WATCHTHEDJ = "watchthedj"
    SPOTIFY = "spotify"
    APPLE_MUSIC = "apple_music"
    SOUNDCLOUD = "soundcloud"
    YOUTUBE = "youtube_music"
    BEATPORT = "beatport"
    TIDAL = "tidal"
    DEEZER = "deezer"
    MUSICBRAINZ = "musicbrainz"
    DISCOGS = "discogs"
    BBC_SOUNDS = "bbc_sounds"


class ArtistRole(str, Enum):
    """Valid artist roles in track relationships"""
    PRIMARY = "primary"
    FEATURED = "featured"
    REMIXER = "remixer"
    PRODUCER = "producer"
    COMPOSER = "composer"
    SONGWRITER = "songwriter"


class EventType(str, Enum):
    """Valid event types for setlists"""
    FESTIVAL = "Festival"
    CLUB_NIGHT = "Club Night"
    RADIO_SHOW = "Radio Show"
    LIVE_PERFORMANCE = "Live Performance"
    DJ_SET = "DJ Set"
    CONCERT = "Concert"
    WAREHOUSE_PARTY = "Warehouse Party"


class RemixType(str, Enum):
    """Valid remix types"""
    ORIGINAL = "original"
    EXTENDED = "extended"
    RADIO = "radio"
    CLUB = "club"
    VIP = "vip"
    INSTRUMENTAL = "instrumental"
    ACAPPELLA = "acappella"
    REMIX = "remix"
    EDIT = "edit"
    REWORK = "rework"
    BOOTLEG = "bootleg"
    MASHUP = "mashup"
    UNKNOWN = "unknown"  # For remixes where type cannot be determined


# ============================================================================
# NOTES ON VALIDATORS
# ============================================================================
# All validators have been updated to Pydantic V2 syntax:
# - @validator → @field_validator with @classmethod
# - @root_validator → @model_validator(mode='after')
# - values parameter → info.data for field_validator
# - cls parameter → self for model_validator


# ============================================================================
# ARTIST MODELS
# ============================================================================

class ArtistBase(BaseModel):
    """Base artist model with core fields"""
    artist_name: constr(min_length=1, max_length=255)
    normalized_name: Optional[str] = None
    aliases: Optional[List[str]] = None

    # External platform IDs
    spotify_id: Optional[str] = None
    apple_music_id: Optional[str] = None
    youtube_channel_id: Optional[str] = None
    soundcloud_id: Optional[str] = None
    discogs_id: Optional[str] = None
    musicbrainz_id: Optional[str] = None

    # Metadata
    genre_preferences: Optional[List[str]] = None
    country: Optional[str] = None
    is_verified: Optional[bool] = False
    follower_count: Optional[conint(ge=0)] = None
    monthly_listeners: Optional[conint(ge=0)] = None
    popularity_score: Optional[confloat(ge=0, le=100)] = None

    # System fields
    data_source: DataSource
    scrape_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Validators
    @field_validator('artist_name')
    @classmethod
    def no_generic_artist_names(cls, v):
        """Reject generic placeholder artist names like 'VA', 'Various Artists', etc."""
        # These should never be treated as real artist entities
        generic_names = ['various artists', 'unknown artist', 'various', 'unknown', 'va', 'n/a', 'tba', 'tbd']
        if v and v.lower().strip() in generic_names:
            raise ValueError(f'Generic artist name "{v}" not allowed - drop this artist item')
        return v

    @field_validator('country')
    @classmethod
    def validate_country_code(cls, v):
        """Validate ISO 3166-1 alpha-2 country code"""
        if v is not None and not re.match(r'^[A-Z]{2}$', v):
            raise ValueError('country must be ISO 3166-1 alpha-2 code (e.g., "US", "GB")')
        return v

    @field_validator('popularity_score')
    @classmethod
    def validate_popularity_range(cls, v):
        """Validate popularity score is 0-100"""
        if v is not None and (v < 0 or v > 100):
            raise ValueError('popularity_score must be between 0 and 100')
        return v

    @field_validator('normalized_name')
    @classmethod
    def set_normalized_name(cls, v, info):
        """Auto-generate normalized_name from artist_name if not provided"""
        if v is None and 'artist_name' in info.data:
            return info.data['artist_name'].lower().strip()
        return v

    @field_validator('artist_name')
    @classmethod
    def no_generic_artists(cls, v):
        """Prevent generic placeholder artist names (2025 best practices)"""
        # For Artist entities, we DO want to reject placeholders since we shouldn't
        # create an artist record for "VA" - those should be left NULL on the playlist
        generic_names = ['various artists', 'unknown artist', 'various', 'unknown', 'va']
        if v and v.lower().strip() in generic_names:
            raise ValueError(f'Generic artist name "{v}" not allowed - must have specific artist attribution')
        return v

    model_config = ConfigDict()


class ArtistCreate(ArtistBase):
    """Artist creation model"""
    pass


class ArtistResponse(ArtistBase):
    """Artist response model with database ID"""
    artist_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# TRACK MODELS
# ============================================================================

class TrackBase(BaseModel):
    """Base track model with core fields and audio features"""
    track_id: Optional[str] = None  # Deterministic cross-source ID
    track_name: constr(min_length=1, max_length=500)
    normalized_title: Optional[str] = None
    duration_ms: Optional[conint(ge=0)] = None

    # External platform IDs
    isrc: Optional[str] = None
    spotify_id: Optional[str] = None
    apple_music_id: Optional[str] = None
    youtube_id: Optional[str] = None
    soundcloud_id: Optional[str] = None
    musicbrainz_id: Optional[str] = None

    # Audio features (Spotify-style, 0.0-1.0 range)
    bpm: Optional[confloat(ge=60, le=200)] = None
    musical_key: Optional[str] = None
    energy: Optional[confloat(ge=0, le=1)] = None
    danceability: Optional[confloat(ge=0, le=1)] = None
    valence: Optional[confloat(ge=0, le=1)] = None
    acousticness: Optional[confloat(ge=0, le=1)] = None
    instrumentalness: Optional[confloat(ge=0, le=1)] = None
    liveness: Optional[confloat(ge=0, le=1)] = None
    speechiness: Optional[confloat(ge=0, le=1)] = None
    loudness: Optional[float] = None

    # Music metadata
    release_date: Optional[date] = None
    genre: Optional[str] = None
    subgenre: Optional[str] = None
    record_label: Optional[str] = None

    # Track characteristics
    is_remix: bool = False
    is_mashup: bool = False
    is_live: bool = False
    is_cover: bool = False
    is_instrumental: bool = False
    is_explicit: bool = False

    # Remix/version info
    remix_type: Optional[RemixType] = None
    original_artist: Optional[str] = None
    remixer: Optional[str] = None
    mashup_components: Optional[List[str]] = None

    # Popularity
    popularity_score: Optional[confloat(ge=0, le=100)] = None
    play_count: Optional[conint(ge=0)] = None

    # Context
    track_type: Optional[str] = None
    source_context: Optional[str] = None
    position_in_source: Optional[conint(ge=0)] = None

    # System fields
    data_source: DataSource
    scrape_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Validators
    @field_validator('track_id')
    @classmethod
    def validate_track_id_format(cls, v):
        """Validate track_id is 16-character hexadecimal"""
        if v is not None and not re.match(r'^[a-f0-9]{16}$', v):
            raise ValueError('track_id must be 16-character hexadecimal string')
        return v

    @field_validator('bpm')
    @classmethod
    def validate_bpm_range(cls, v):
        """Validate BPM is in reasonable range"""
        if v is not None and (v < 60 or v > 200):
            raise ValueError('BPM must be between 60 and 200')
        return v

    @field_validator('popularity_score')
    @classmethod
    def validate_popularity_range(cls, v):
        """Validate popularity score is 0-100"""
        if v is not None and (v < 0 or v > 100):
            raise ValueError('popularity_score must be between 0 and 100')
        return v

    @field_validator('normalized_title')
    @classmethod
    def set_normalized_title(cls, v, info):
        """Auto-generate normalized_title from track_name if not provided"""
        if v is None and 'track_name' in info.data:
            return info.data['track_name'].lower().strip()
        return v

    @field_validator('track_name')
    @classmethod
    def no_generic_tracks(cls, v):
        """Prevent generic placeholder track names"""
        generic_names = ['unknown track', 'id - id', 'unknown', 'id']
        if v.lower().strip() in generic_names:
            raise ValueError(f'Generic track name "{v}" not allowed - skip tracks without identifiable names')
        return v

    @model_validator(mode='after')
    def validate_remix_consistency(self):
        """Ensure remix fields are consistent"""
        if self.is_remix and self.remix_type is None:
            raise ValueError('remix_type must be specified when is_remix=True')

        if not self.is_remix and self.remix_type is not None:
            raise ValueError('remix_type should not be set when is_remix=False')

        return self

    model_config = ConfigDict()


class TrackCreate(TrackBase):
    """Track creation model"""
    pass


class TrackResponse(TrackBase):
    """Track response model with database ID"""
    song_id: int
    primary_artist_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# TRACK-ARTIST RELATIONSHIP MODELS
# ============================================================================

class TrackArtistRelationship(BaseModel):
    """Track-artist relationship with role and contribution details"""
    track_name: constr(min_length=1, max_length=500)
    track_id: Optional[str] = None
    artist_name: constr(min_length=1, max_length=255)
    artist_id: Optional[str] = None

    # Relationship details
    artist_role: ArtistRole
    position: conint(ge=0) = 0
    contribution_type: Optional[str] = None
    contribution_percentage: Optional[confloat(ge=0, le=100)] = None

    # Credit info
    credit_name: Optional[str] = None
    is_alias: bool = False

    # System fields
    data_source: DataSource
    scrape_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Validators
    @field_validator('track_id')
    @classmethod
    def validate_track_id_format(cls, v):
        """Validate track_id is 16-character hexadecimal"""
        if v is not None and not re.match(r'^[a-f0-9]{16}$', v):
            raise ValueError('track_id must be 16-character hexadecimal string')
        return v

    @field_validator('artist_name')
    @classmethod
    def no_generic_artists(cls, v):
        """Prevent generic placeholder artist names on tracks"""
        # For Track entities, reject placeholders - tracks should have specific artists
        generic_names = ['various artists', 'unknown artist', 'various', 'unknown', 'va']
        if v and v.lower().strip() in generic_names:
            raise ValueError(f'Generic artist name "{v}" not allowed')
        return v


# ============================================================================
# SETLIST/PLAYLIST MODELS
# ============================================================================

class SetlistBase(BaseModel):
    """Base setlist/playlist model"""
    setlist_name: constr(min_length=1, max_length=500)
    normalized_name: Optional[str] = None
    description: Optional[str] = None

    # Artist/DJ info
    dj_artist_name: constr(min_length=1, max_length=255)
    dj_artist_id: Optional[str] = None
    supporting_artists: Optional[List[str]] = None

    # Event details
    event_name: Optional[str] = None
    event_type: Optional[EventType] = None
    venue_name: Optional[str] = None
    venue_location: Optional[str] = None
    venue_capacity: Optional[conint(ge=0)] = None

    # Temporal info
    set_date: Optional[date] = None
    set_start_time: Optional[datetime] = None
    set_end_time: Optional[datetime] = None
    duration_minutes: Optional[conint(ge=0)] = None

    # Metadata
    genre_tags: Optional[List[str]] = None
    mood_tags: Optional[List[str]] = None
    bpm_range: Optional[Dict[str, float]] = None
    total_tracks: Optional[conint(ge=0)] = None

    # External platform IDs
    spotify_playlist_id: Optional[str] = None
    soundcloud_playlist_id: Optional[str] = None
    mixcloud_id: Optional[str] = None
    youtube_playlist_id: Optional[str] = None

    # System fields
    data_source: DataSource
    scrape_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator('normalized_name')
    @classmethod
    def set_normalized_name(cls, v, info):
        """Auto-generate normalized_name if not provided"""
        if v is None and 'setlist_name' in info.data:
            return info.data['setlist_name'].lower().strip()
        return v

    @field_validator('dj_artist_name')
    @classmethod
    def no_generic_dj_names(cls, v):
        """Convert generic placeholder DJ names to None for later enrichment"""
        # Generic names like "VA", "Various Artists", etc. should be stored as NULL
        # Enrichment service will attempt artist attribution later for:
        # - Radio shows, compilations, and multi-DJ events
        generic_names = ['various artists', 'unknown artist', 'various', 'unknown', 'va']
        if v and v.lower().strip() in generic_names:
            return None  # Store as NULL, not as "VA"
        return v

    @model_validator(mode='after')
    def validate_time_consistency(self):
        """Ensure start_time < end_time"""
        if self.set_start_time and self.set_end_time and self.set_start_time >= self.set_end_time:
            raise ValueError('set_start_time must be before set_end_time')
        return self

    model_config = ConfigDict()


class SetlistCreate(SetlistBase):
    """Setlist creation model"""
    pass


class SetlistResponse(SetlistBase):
    """Setlist response model with database ID"""
    playlist_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# TRACK ADJACENCY MODELS
# ============================================================================

class TrackAdjacency(BaseModel):
    """Track adjacency for graph relationships"""
    track_1_name: constr(min_length=1, max_length=500)
    track_1_id: Optional[str] = None
    track_2_name: constr(min_length=1, max_length=500)
    track_2_id: Optional[str] = None

    track_1_position: Optional[conint(ge=0)] = None
    track_2_position: Optional[conint(ge=0)] = None

    distance: conint(ge=1) = 1
    setlist_name: Optional[str] = None
    setlist_id: Optional[str] = None

    source_context: Optional[str] = None
    transition_type: Optional[str] = None
    occurrence_count: conint(ge=1) = 1

    # System fields
    data_source: DataSource
    scrape_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Validators
    @field_validator('track_1_id', 'track_2_id')
    @classmethod
    def validate_track_id_format(cls, v):
        """Validate track_id is 16-character hexadecimal"""
        if v is not None and not re.match(r'^[a-f0-9]{16}$', v):
            raise ValueError('track_id must be 16-character hexadecimal string')
        return v

    @model_validator(mode='after')
    def validate_different_tracks(self):
        """Ensure track_1 and track_2 are different"""
        if self.track_1_name == self.track_2_name:
            raise ValueError('track_1 and track_2 must be different tracks')
        return self


# ============================================================================
# TRACK SOURCES MODEL (Multi-Platform Aggregation)
# ============================================================================

class TrackSource(BaseModel):
    """Track source record for multi-platform tracking"""
    track_id: constr(pattern=r'^[a-f0-9]{16}$')
    source: DataSource
    source_track_id: Optional[str] = None
    source_url: Optional[str] = None

    discovered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Metadata from source
    play_count: Optional[conint(ge=0)] = None
    popularity_score: Optional[confloat(ge=0, le=100)] = None
    chart_position: Optional[conint(ge=1)] = None
    source_metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict()


# ============================================================================
# UTILITY MODELS
# ============================================================================

class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    database_connected: bool
    services_available: Dict[str, Any]  # Changed from Dict[str, bool] to support nested structures and error messages

    model_config = ConfigDict()


class ErrorResponse(BaseModel):
    """Standard error response"""
    error: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict()
