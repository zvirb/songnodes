"""
Reusable ItemLoader Processor Library (Spec Section V.2)

This module provides atomic, context-free transformation functions for use
in ItemLoader input processors via MapCompose.

Best Practices:
- Each function operates on a SINGLE value (not lists)
- Functions are pure (no side effects)
- Functions are composable via MapCompose
- Return None to filter out invalid values
"""
import re
import sys
from datetime import datetime
from typing import Optional, Union
from urllib.parse import urlparse, urljoin

# Add common directory to path for shared utilities
sys.path.insert(0, '/app/common')
from artist_name_cleaner import normalize_artist_name as _normalize_artist_name


# ============================================================================
# TEXT CLEANING PROCESSORS
# ============================================================================

def strip_text(value: str) -> str:
    """
    Remove leading/trailing whitespace and normalize internal whitespace.

    Example:
        "  Hello   World  " -> "Hello World"
    """
    if not value:
        return value
    return ' '.join(str(value).split())


def lowercase(value: str) -> str:
    """Convert text to lowercase."""
    return str(value).lower() if value else value


def uppercase(value: str) -> str:
    """Convert text to uppercase."""
    return str(value).upper() if value else value


def remove_html_tags(value: str) -> str:
    """
    Remove HTML tags from text.

    Example:
        "<p>Hello <b>World</b></p>" -> "Hello World"
    """
    if not value:
        return value
    clean = re.sub(r'<[^>]+>', '', str(value))
    return strip_text(clean)


def normalize_whitespace(value: str) -> str:
    """
    Replace all whitespace (including newlines, tabs) with single spaces.

    Example:
        "Hello\n\tWorld" -> "Hello World"
    """
    if not value:
        return value
    return re.sub(r'\s+', ' ', str(value)).strip()


# ============================================================================
# NUMERIC PROCESSORS
# ============================================================================

def clean_price(value: str) -> Optional[str]:
    """
    Remove currency symbols and commas from price strings.

    Example:
        "$1,234.56" -> "1234.56"
        "€ 99,99" -> "99.99"

    Returns:
        Cleaned numeric string ready for float conversion, or None if invalid
    """
    if not value:
        return None

    # Remove currency symbols, commas, and spaces
    cleaned = re.sub(r'[£$€¥,\s]', '', str(value))

    # Handle European format (99,99 -> 99.99)
    if ',' in cleaned and '.' not in cleaned:
        cleaned = cleaned.replace(',', '.')

    # Validate numeric format
    if re.match(r'^\d+(\.\d{1,2})?$', cleaned):
        return cleaned

    return None


def to_int(value: Union[str, int, float]) -> Optional[int]:
    """
    Convert value to integer, filtering out invalid inputs.

    Example:
        "42" -> 42
        "42.9" -> 42
        "abc" -> None (filtered)
    """
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def to_float(value: Union[str, int, float]) -> Optional[float]:
    """
    Convert value to float, filtering out invalid inputs.

    Example:
        "42.5" -> 42.5
        "42" -> 42.0
        "abc" -> None (filtered)
    """
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def clean_bpm(value: str) -> Optional[str]:
    """
    Extract BPM value from text containing BPM information.

    Example:
        "128 BPM" -> "128"
        "BPM: 140" -> "140"
        "120-128" -> "124" (average)
    """
    if not value:
        return None

    value_str = str(value).upper()

    # Extract numeric BPM value
    match = re.search(r'(\d+)\s*BPM', value_str)
    if match:
        return match.group(1)

    # Handle range (e.g., "120-128")
    range_match = re.search(r'(\d+)\s*-\s*(\d+)', value_str)
    if range_match:
        low, high = int(range_match.group(1)), int(range_match.group(2))
        return str((low + high) // 2)  # Return average

    # Just a number
    num_match = re.search(r'\d+', value_str)
    if num_match:
        bpm = int(num_match.group())
        # Validate reasonable BPM range (40-300)
        if 40 <= bpm <= 300:
            return str(bpm)

    return None


# ============================================================================
# DATE/TIME PROCESSORS
# ============================================================================

def parse_datetime(value: str, format: str = '%Y-%m-%d') -> Optional[datetime]:
    """
    Parse datetime string with specified format.

    Example:
        parse_datetime("2025-01-15") -> datetime(2025, 1, 15)

    Args:
        value: Date string to parse
        format: strptime format string (default: ISO date)

    Returns:
        datetime object or None if parsing fails
    """
    if not value:
        return None

    try:
        return datetime.strptime(str(value).strip(), format)
    except ValueError:
        return None


def parse_flexible_date(value: str) -> Optional[str]:
    """
    Parse various date formats and return ISO format (YYYY-MM-DD).

    Supports:
        - ISO: 2025-01-15
        - US: 01/15/2025, 1/15/25
        - EU: 15.01.2025, 15/01/2025
        - Text: Jan 15, 2025

    Returns:
        ISO format string (YYYY-MM-DD) or None
    """
    if not value:
        return None

    value_str = str(value).strip()

    # Try multiple formats
    formats = [
        '%Y-%m-%d',  # ISO
        '%m/%d/%Y',  # US
        '%d.%m.%Y',  # EU (dot)
        '%d/%m/%Y',  # EU (slash)
        '%b %d, %Y',  # Jan 15, 2025
        '%B %d, %Y',  # January 15, 2025
        '%Y-%m-%dT%H:%M:%S',  # ISO with time
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(value_str, fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue

    return None


def parse_duration_seconds(value: str) -> Optional[int]:
    """
    Parse duration strings into seconds.

    Example:
        "3:45" -> 225
        "1:30:00" -> 5400
        "2h 30m" -> 9000

    Returns:
        Total seconds as integer, or None if invalid
    """
    if not value:
        return None

    value_str = str(value).strip()

    # Format: MM:SS or HH:MM:SS
    time_match = re.match(r'^(?:(\d+):)?(\d+):(\d+)$', value_str)
    if time_match:
        hours = int(time_match.group(1) or 0)
        minutes = int(time_match.group(2))
        seconds = int(time_match.group(3))
        return hours * 3600 + minutes * 60 + seconds

    # Format: "2h 30m 15s" or "2h30m"
    hours_match = re.search(r'(\d+)\s*h', value_str, re.I)
    mins_match = re.search(r'(\d+)\s*m', value_str, re.I)
    secs_match = re.search(r'(\d+)\s*s', value_str, re.I)

    if hours_match or mins_match or secs_match:
        total = 0
        if hours_match:
            total += int(hours_match.group(1)) * 3600
        if mins_match:
            total += int(mins_match.group(1)) * 60
        if secs_match:
            total += int(secs_match.group(1))
        return total

    return None


# ============================================================================
# URL PROCESSORS
# ============================================================================

def absolute_url(value: str, base_url: str) -> str:
    """
    Convert relative URL to absolute URL.

    Example:
        absolute_url("/tracks/123", "https://example.com") -> "https://example.com/tracks/123"

    Args:
        value: Relative or absolute URL
        base_url: Base URL for resolution

    Returns:
        Absolute URL
    """
    if not value:
        return value
    return urljoin(base_url, str(value))


def normalize_url(value: str) -> str:
    """
    Normalize URL by removing fragments and query parameters (optionally).

    Example:
        "https://example.com/page?ref=twitter#section" -> "https://example.com/page"
    """
    if not value:
        return value

    parsed = urlparse(str(value))
    # Reconstruct URL without fragment
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def extract_domain(value: str) -> Optional[str]:
    """
    Extract domain from URL.

    Example:
        "https://www.example.com/path" -> "example.com"
    """
    if not value:
        return None

    parsed = urlparse(str(value))
    domain = parsed.netloc or parsed.path

    # Remove 'www.' prefix
    if domain.startswith('www.'):
        domain = domain[4:]

    return domain if domain else None


# ============================================================================
# MUSIC-SPECIFIC PROCESSORS
# ============================================================================

def normalize_artist_name(value: str) -> str:
    """
    Normalize artist name for matching and remove tracklist formatting artifacts.

    This is a wrapper around the shared artist_name_cleaner module
    to ensure consistency across scraping, enrichment, and cleanup scripts.

    Removes:
    - Timestamp prefixes: [40:54], [??:??], [?:??:??]
    - Special character prefixes: +, + #, *, -
    - Bracketed placeholders: [??]
    - "The " prefix (for matching)

    Normalizes:
    - Whitespace
    - Ampersands (&  → and)

    Examples:
        "[40:54] Laurent Wolf" → "Laurent Wolf"
        "+ # Deadmau5" → "Deadmau5"
        "[??] ARTBAT" → "ARTBAT"
        "The Chemical Brothers" → "Chemical Brothers"
        "Daft  Punk" → "Daft Punk"
    """
    return _normalize_artist_name(value) if value else value


def clean_track_title(value: str) -> str:
    """
    Clean track title by removing common artifacts.

    - Remove [Official Video], (Lyrics), etc.
    - Remove extra whitespace
    - Preserve remix/edit info

    Example:
        "Song Name [Official Video]" -> "Song Name"
        "Song Name (Original Mix)" -> "Song Name (Original Mix)"
    """
    if not value:
        return value

    cleaned = str(value)

    # Remove common YouTube/streaming artifacts
    artifacts = [
        r'\[Official Video\]',
        r'\[Official Audio\]',
        r'\[Lyric Video\]',
        r'\(Lyrics\)',
        r'\(Official\)',
        r'\[HD\]',
        r'\[HQ\]',
    ]

    for pattern in artifacts:
        cleaned = re.sub(pattern, '', cleaned, flags=re.I)

    return strip_text(cleaned)


def parse_musical_key(value: str) -> Optional[str]:
    """
    Normalize musical key notation.

    Example:
        "C# minor" -> "C#m"
        "D flat major" -> "Dbmaj"
        "5A" -> "C" (Camelot to key)
    """
    if not value:
        return None

    value_str = str(value).strip().upper()

    # Camelot wheel conversion (simplified)
    camelot_to_key = {
        '1A': 'Abm', '1B': 'B', '2A': 'Ebm', '2B': 'Gb',
        '3A': 'Bbm', '3B': 'Db', '4A': 'Fm', '4B': 'Ab',
        '5A': 'Cm', '5B': 'Eb', '6A': 'Gm', '6B': 'Bb',
        '7A': 'Dm', '7B': 'F', '8A': 'Am', '8B': 'C',
        '9A': 'Em', '9B': 'G', '10A': 'Bm', '10B': 'D',
        '11A': 'F#m', '11B': 'A', '12A': 'C#m', '12B': 'E',
    }

    if value_str in camelot_to_key:
        return camelot_to_key[value_str]

    # Standard notation
    match = re.match(r'([A-G][#b]?)\s*(MAJ|MIN|MAJOR|MINOR)?', value_str)
    if match:
        note = match.group(1)
        mode = match.group(2)

        if mode and mode.startswith('MIN'):
            return f"{note}m"
        elif mode and mode.startswith('MAJ'):
            return note
        else:
            return note

    return None


# ============================================================================
# LIST/ARRAY PROCESSORS
# ============================================================================

def split_comma(value: str) -> list:
    """
    Split comma-separated string into list.

    Example:
        "techno, house, minimal" -> ["techno", "house", "minimal"]
    """
    if not value:
        return []
    return [item.strip() for item in str(value).split(',') if item.strip()]


def split_semicolon(value: str) -> list:
    """Split semicolon-separated string into list."""
    if not value:
        return []
    return [item.strip() for item in str(value).split(';') if item.strip()]


def unique_list(values: list) -> list:
    """
    Remove duplicates from list while preserving order.

    Example:
        ["a", "b", "a", "c"] -> ["a", "b", "c"]
    """
    seen = set()
    result = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


# ============================================================================
# VALIDATION PROCESSORS (Return None to filter out invalid data)
# ============================================================================

def validate_email(value: str) -> Optional[str]:
    """Validate email format, return None if invalid."""
    if not value:
        return None

    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return value if re.match(pattern, str(value)) else None


def validate_url(value: str) -> Optional[str]:
    """Validate URL format, return None if invalid."""
    if not value:
        return None

    try:
        result = urlparse(str(value))
        return value if all([result.scheme, result.netloc]) else None
    except Exception:
        return None


def clamp_value(value: Union[int, float], min_val: float, max_val: float) -> Optional[Union[int, float]]:
    """
    Clamp numeric value to range, return None if out of range.

    Example:
        clamp_value(150, 0, 100) -> None (out of range)
        clamp_value(50, 0, 100) -> 50
    """
    try:
        num_val = float(value)
        return value if min_val <= num_val <= max_val else None
    except (ValueError, TypeError):
        return None
