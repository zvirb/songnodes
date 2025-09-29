"""
Streaming Integrations Package for SongNodes
Provides unified access to multiple music streaming platforms
"""

from .unified_streaming_client import (
    StreamingTrackMetadata,
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
)

__all__ = [
    "StreamingTrackMetadata",
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
]

__version__ = "1.0.0"