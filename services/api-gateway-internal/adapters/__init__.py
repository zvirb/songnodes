"""
API Client Adapters for External Services
==========================================

Provides unified interface to all external APIs through the gateway.
"""

from .base import BaseAPIAdapter
from .spotify import SpotifyAdapter
from .musicbrainz import MusicBrainzAdapter
from .lastfm import LastFMAdapter
from .beatport import BeatportAdapter
from .discogs import DiscogsAdapter
from .acousticbrainz import AcousticBrainzAdapter

__all__ = [
    'BaseAPIAdapter',
    'SpotifyAdapter',
    'MusicBrainzAdapter',
    'LastFMAdapter',
    'BeatportAdapter',
    'DiscogsAdapter',
    'AcousticBrainzAdapter'
]
