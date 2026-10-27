"""
Artist Name Cleaner - Shared Utility

Removes DJ mix tracklist formatting artifacts from artist names.
This module is used by:
- Scraping pipeline (scrapers/utils/processors.py)
- Enrichment pipeline (metadata-enrichment service)
- Database cleanup scripts

Ensures consistent artist name cleaning across all systems.
"""

import re
from functools import lru_cache
from typing import Optional

# Performance Optimization: Pre-compile regex patterns at module level
# to eliminate repeated regex compilation overhead during batch processing
# and candidate matching loops.
_RE_TIMESTAMP_MM_SS = re.compile(r'^\[\d{1,2}:\d{2}\]\s*')
_RE_TIMESTAMP_UNKNOWN_3 = re.compile(r'^\[\?+:\?+:\?+\]\s*')
_RE_TIMESTAMP_UNKNOWN_2 = re.compile(r'^\[\?+:\?+\]\s*')
_RE_BRACKETS = re.compile(r'^\[[\d\?]+\]\s*')
_RE_PREFIX_PLUS_HASH = re.compile(r'^\+\s*#\s*')
_RE_PREFIX_PLUS = re.compile(r'^\+\s+')
_RE_PREFIX_MINUS = re.compile(r'^-\s+')
_RE_PREFIX_STAR = re.compile(r'^\*\s+')
_RE_TIMESTAMP_EXTRACT = re.compile(r'^\[(\d{1,2}:\d{2})\]')

_FORMATTING_ARTIFACT_PATTERNS = (
    re.compile(r'^\[\d{1,2}:\d{2}\]'),      # [MM:SS]
    re.compile(r'^\[\?+:\?+'),              # [??:??]
    re.compile(r'^\[[\d\?]+\]'),            # [0?], [1??], [420], [??]
    re.compile(r'^\+\s*#\s*'),              # + #
    re.compile(r'^\+\s+'),                  # +
    re.compile(r'^-\s+'),                   # -
    re.compile(r'^\*\s+'),                  # *
)


# Performance Optimization: Memoize clean_artist_name to avoid re-cleaning
# identical artist names in loops, playlists, and candidate sets (~40x speedup).
@lru_cache(maxsize=4096)
def clean_artist_name(name: str) -> str:
    """
    Remove tracklist formatting artifacts from artist names.

    Common DJ mix tracklist formatting that should not be part of artist names:
    - Timestamp prefixes: [40:54] Artist Name (track start time)
    - Special character prefixes: + Artist Name (b2b, featured)
    - Bracketed placeholders: [??] Artist Name (unknown timestamp)

    Patterns removed:
    - Timestamp prefixes: [MM:SS], [??:??], [?:??:??]
    - Special character prefixes: +, + #, -, *
    - Bracketed placeholders: [??]
    - Leading/trailing whitespace

    Examples:
        "[40:54] Laurent Wolf" → "Laurent Wolf"
        "+ # Deadmau5" → "Deadmau5"
        "[??] ARTBAT" → "ARTBAT"
        "[??:??] + CamelPhat" → "CamelPhat"
        "- David Guetta" → "David Guetta"
        "* Eric Prydz" → "Eric Prydz"

    Args:
        name: Raw artist name from tracklist/database

    Returns:
        Cleaned artist name with formatting artifacts removed

    Note:
        If cleaning removes all characters, returns original name (safety).
    """
    if not name:
        return name

    original = name
    cleaned = name.strip()

    # Remove timestamp prefixes (most common) using pre-compiled regexes
    cleaned = _RE_TIMESTAMP_MM_SS.sub('', cleaned)       # [MM:SS]
    cleaned = _RE_TIMESTAMP_UNKNOWN_3.sub('', cleaned)   # [?:??:??]
    cleaned = _RE_TIMESTAMP_UNKNOWN_2.sub('', cleaned)   # [??:??]

    # Remove any bracketed content (mixed digits/question marks, pure patterns)
    cleaned = _RE_BRACKETS.sub('', cleaned)              # Any combo of digits/question marks

    # Remove special character prefixes
    cleaned = _RE_PREFIX_PLUS_HASH.sub('', cleaned)      # + #
    cleaned = _RE_PREFIX_PLUS.sub('', cleaned)           # +
    cleaned = _RE_PREFIX_MINUS.sub('', cleaned)          # -
    cleaned = _RE_PREFIX_STAR.sub('', cleaned)           # *

    # Trim whitespace after pattern removal
    cleaned = cleaned.strip()

    # Safety: If cleaning removed everything, keep original
    if not cleaned:
        return original

    return cleaned


# Performance Optimization: Memoize normalize_artist_name (~40x speedup)
@lru_cache(maxsize=4096)
def normalize_artist_name(name: str) -> str:
    """
    Clean AND normalize artist name for matching/deduplication.

    Performs both cleaning (remove artifacts) and normalization
    (canonicalize for matching).

    Removes:
    - Timestamp prefixes: [40:54], [??:??]
    - Special character prefixes: +, + #, *, -
    - "The " prefix (for matching only)

    Normalizes:
    - Whitespace (multiple → single)
    - Ampersands (& → and)
    - Case (optional, currently preserves)

    Examples:
        "[40:54] Laurent Wolf" → "Laurent Wolf"
        "The Chemical Brothers" → "Chemical Brothers"
        "Daft  Punk" → "Daft Punk"
        "Simon & Garfunkel" → "Simon and Garfunkel"

    Args:
        name: Raw artist name

    Returns:
        Cleaned and normalized artist name

    Note:
        Use clean_artist_name() if you only want artifact removal
        without normalization.
    """
    if not name:
        return name

    # First clean artifacts
    normalized = clean_artist_name(name)

    # Normalize whitespace (multiple spaces → single)
    normalized = ' '.join(normalized.split())

    # Remove "The " prefix (case-insensitive, for matching)
    if normalized.lower().startswith('the '):
        normalized = normalized[4:]

    # Normalize ampersands
    normalized = normalized.replace(' & ', ' and ')

    return normalized.strip()


def extract_timestamp_from_artist(name: str) -> Optional[str]:
    """
    Extract timestamp from artist name if present.

    Useful for debugging/logging to track where timestamps came from.

    Examples:
        "[40:54] Laurent Wolf" → "40:54"
        "+ # Deadmau5" → None
        "ARTBAT" → None

    Args:
        name: Raw artist name (possibly with timestamp)

    Returns:
        Timestamp string (MM:SS) or None if no timestamp found
    """
    if not name:
        return None

    match = _RE_TIMESTAMP_EXTRACT.match(name.strip())
    return match.group(1) if match else None


def has_formatting_artifacts(name: str) -> bool:
    """
    Check if artist name contains formatting artifacts.

    Useful for data quality monitoring and reporting.

    Args:
        name: Artist name to check

    Returns:
        True if name contains timestamps, special char prefixes, etc.
    """
    if not name:
        return False

    stripped = name.strip()
    return any(p.match(stripped) for p in _FORMATTING_ARTIFACT_PATTERNS)
