"""
Streaming Integrations Package for SongNodes
Provides unified access to multiple music streaming platforms
"""

from .unified_streaming_client import (
    TrackMetadata,
    SearchResult,
    StreamingPlatformClient,
    UnifiedStreamingClient,
    TidalClient,
    SpotifyClient,
    BeatportClient,
    AppleMusicClient,
    SoundCloudClient,
    DeezerClient,
    YouTubeMusicClient,
    search_track_on_all_platforms,
    test_unified_client,
)

__all__ = [
    "TrackMetadata",
    "SearchResult",
    "StreamingPlatformClient",
    "UnifiedStreamingClient",
    "TidalClient",
    "SpotifyClient",
    "BeatportClient",
    "AppleMusicClient",
    "SoundCloudClient",
    "DeezerClient",
    "YouTubeMusicClient",
    "search_track_on_all_platforms",
    "test_unified_client",
]

__version__ = "1.0.0"