"""
Store-based music metadata spiders for SongNodes.

This module contains spiders that interact with official music stores
and databases via their APIs for metadata enrichment.

Available spiders:
- discogs: Discogs API spider for electronic music, vinyl, and label metadata
"""

from .discogs_spider import DiscogsAPISpider

__all__ = ['DiscogsAPISpider']
