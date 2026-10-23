"""Catalog read contracts, separate from validation of new scraper submissions."""
from datetime import date, datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class Provenance(BaseModel):
    data_layer: Literal['silver'] = 'silver'
    data_source: Optional[str] = None
    data_sources: List[str] = Field(default_factory=list)
    source_url: Optional[str] = None
    scrape_timestamp: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class CatalogTrack(Provenance):
    # Database identity is distinct from a provider's source_track_id.
    id: UUID
    song_id: UUID
    track_id: UUID
    source_track_id: Optional[str] = None
    name: str
    title: str
    track_name: str
    normalized_title: str
    artist: str
    artist_name: str
    duration_ms: Optional[int] = None
    duration: Optional[float] = None
    bpm: Optional[float] = None
    key: Optional[str] = None
    musical_key: Optional[str] = None
    energy: Optional[float] = None
    danceability: Optional[float] = None
    valence: Optional[float] = None
    release_date: Optional[date] = None
    genre: Optional[str] = None
    genres: Optional[List[str]] = None
    spotify_id: Optional[str] = None
    isrc: Optional[str] = None
    camelot_key: Optional[str] = None
    energy_scale: Optional[str] = None
    tidal_id: Optional[str] = None
    deezer_id: Optional[str] = None
    apple_music_id: Optional[str] = None
    beatport_id: Optional[str] = None
    record_label: Optional[str] = None
    mix_name: Optional[str] = None


class CatalogArtist(Provenance):
    artist_id: UUID
    name: str
    artist_name: str
    normalized_name: str
    aliases: Optional[List[str]] = None
    genres: Optional[List[str]] = None
    genre_preferences: Optional[List[str]] = None
    country: Optional[str] = None
    spotify_id: Optional[str] = None
    musicbrainz_id: Optional[str] = None
    discogs_id: Optional[str] = None
    beatport_id: Optional[str] = None
    track_count: int
    match_score: Optional[float] = None  # Literal-match ranking, not a learned confidence.


class CatalogSetlist(Provenance):
    playlist_id: UUID
    setlist_name: str
    normalized_name: str
    dj_artist_id: Optional[UUID] = None
    dj_artist_name: str
    event_name: Optional[str] = None
    set_date: Optional[date] = None
    venue_name: Optional[str] = None
    venue_location: Optional[str] = None
    total_tracks: int
    declared_track_count: Optional[int] = None
    total_duration_ms: Optional[int] = None
    duration_minutes: Optional[float] = None


class CatalogSetlistEntry(BaseModel):
    playlist_id: UUID
    track_id: UUID
    position: int
    cue_time_ms: Optional[int] = None
    track: CatalogTrack


class CatalogSetlistDetail(CatalogSetlist):
    tracks: List[CatalogSetlistEntry]
