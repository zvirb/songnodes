"""
API Integration Gateway
========================

Centralized gateway for external API communication with built-in resilience patterns.

This module provides:
- Redis-based caching for API responses
- Token bucket rate limiting for proactive quota management
- Circuit breaker pattern for fault isolation
- Retry with exponential backoff for transient failures
- Dead Letter Queue (DLQ) support for irrecoverable errors

Architecture Alignment:
Implements the "API Integration Gateway" pattern from the architectural blueprint,
providing a unified interface for Spotify, MusicBrainz, Last.fm, and Beatport APIs.
"""

from .cache_manager import CacheManager
from .rate_limiter import TokenBucket, RateLimiter
from .circuit_breaker import CircuitBreaker, CircuitState
from .base_client import BaseAPIClient
from .spotify_client import SpotifyClient
from .musicbrainz_client import MusicBrainzClient
from .lastfm_client import LastFmClient

__all__ = [
    'CacheManager',
    'TokenBucket',
    'RateLimiter',
    'CircuitBreaker',
    'CircuitState',
    'BaseAPIClient',
    'SpotifyClient',
    'MusicBrainzClient',
    'LastFmClient',
]

__version__ = '1.0.0'
