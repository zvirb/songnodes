"""
Store-based music metadata spiders for SongNodes.

This module contains spiders that interact with official music stores
and databases via their APIs for metadata enrichment.

Available spiders:
- discogs: Discogs API spider for electronic music, vinyl, and label metadata
- beatport: Beatport API spider for electronic music metadata
- spotify: Spotify API spider for music metadata

Note: Spiders are auto-discovered by Scrapy from this directory.
Do not import them here to avoid duplicate spider registration.
"""

__all__ = []
