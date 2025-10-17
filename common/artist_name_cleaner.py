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
from typing import Optional


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

    # Remove timestamp prefixes (most common)
    # DJ mixes often show timestamps: [40:54] Artist - Track
    cleaned = re.sub(r'^\[\d{1,2}:\d{2}\]\s*', '', cleaned)  # [MM:SS]
    cleaned = re.sub(r'^\[\?+:\?+:\?+\]\s*', '', cleaned)    # [?:??:??]
    cleaned = re.sub(r'^\[\?+:\?+\]\s*', '', cleaned)        # [??:??]

    # Remove any bracketed content (mixed digits/question marks, pure patterns)
    # Handles: [0?], [1??], [2?], [420], [69], [??], etc.
    cleaned = re.sub(r'^\[[\d\?]+\]\s*', '', cleaned)        # Any combo of digits/question marks

    # Remove special character prefixes
    # Common notations: + Artist (b2b), # Artist (featured)
    cleaned = re.sub(r'^\+\s*#\s*', '', cleaned)             # + #
    cleaned = re.sub(r'^\+\s+', '', cleaned)                 # +
    cleaned = re.sub(r'^-\s+', '', cleaned)                  # -
    cleaned = re.sub(r'^\*\s+', '', cleaned)                 # *

    # Trim whitespace after pattern removal
    cleaned = cleaned.strip()

    # Safety: If cleaning removed everything, keep original
    if not cleaned:
        return original

    return cleaned


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

    match = re.match(r'^\[(\d{1,2}:\d{2})\]', name.strip())
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

    # Check for any pattern that would be cleaned
    patterns = [
        r'^\[\d{1,2}:\d{2}\]',      # [MM:SS]
        r'^\[\?+:\?+',              # [??:??]
        r'^\[[\d\?]+\]',            # [0?], [1??], [420], [??]
        r'^\+\s*#\s*',              # + #
        r'^\+\s+',                  # +
        r'^-\s+',                   # -
        r'^\*\s+',                  # *
    ]

    return any(re.match(pattern, name.strip()) for pattern in patterns)
