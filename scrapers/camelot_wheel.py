"""
Camelot Wheel Mapping - Harmonic Mixing Utility (Framework Section 1.2)
========================================================================

Maps musical keys to Camelot Wheel notation for harmonic mixing compatibility.

Framework Quote:
"The practice of harmonic mixing uses music theory to ensure that transitions
are smooth and musically pleasing. The Camelot Wheel is a widely adopted system
that simplifies this process by assigning a code (e.g., 8A) to each musical key,
making it easy to identify compatible tracks."

Compatible Keys:
- Same key: Perfect match (8A → 8A)
- +/- 1 step: Energy shift (8A → 7A or 9A)
- Relative major/minor: Mood shift (8A → 8B)

Usage:
    from camelot_wheel import get_camelot_key, get_compatible_keys

    # Convert Spotify key/mode to Camelot
    camelot = get_camelot_key(spotify_key=0, spotify_mode=1)  # "8B" (C Major)

    # Get compatible keys for mixing
    compatible = get_compatible_keys("8B")  # ["8B", "7B", "9B", "8A"]
"""

from typing import Optional, List, Dict


# Spotify Pitch Class Notation (0-11)
# 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B

# Spotify to Camelot Wheel Mapping
# Format: (pitch_class, mode) -> Camelot Key
# Mode: 0 = Minor (A), 1 = Major (B)
SPOTIFY_TO_CAMELOT = {
    # C Major / A Minor (8B / 5A)
    (0, 1): '8B',  # C Major
    (0, 0): '5A',  # C Minor

    # C# Major / A# Minor (3B / 12A)
    (1, 1): '3B',  # C# Major (Db Major)
    (1, 0): '12A',  # C# Minor (Db Minor)

    # D Major / B Minor (10B / 7A)
    (2, 1): '10B',  # D Major
    (2, 0): '7A',  # D Minor

    # D# Major / C Minor (5B / 2A)
    (3, 1): '5B',  # D# Major (Eb Major)
    (3, 0): '2A',  # D# Minor (Eb Minor)

    # E Major / C# Minor (12B / 9A)
    (4, 1): '12B',  # E Major
    (4, 0): '9A',  # E Minor

    # F Major / D Minor (7B / 4A)
    (5, 1): '7B',  # F Major
    (5, 0): '4A',  # F Minor

    # F# Major / D# Minor (2B / 11A)
    (6, 1): '2B',  # F# Major (Gb Major)
    (6, 0): '11A',  # F# Minor (Gb Minor)

    # G Major / E Minor (9B / 6A)
    (7, 1): '9B',  # G Major
    (7, 0): '6A',  # G Minor

    # G# Major / F Minor (4B / 1A)
    (8, 1): '4B',  # G# Major (Ab Major)
    (8, 0): '1A',  # G# Minor (Ab Minor)

    # A Major / F# Minor (11B / 8A)
    (9, 1): '11B',  # A Major
    (9, 0): '8A',  # A Minor

    # A# Major / G Minor (6B / 3A)
    (10, 1): '6B',  # A# Major (Bb Major)
    (10, 0): '3A',  # A# Minor (Bb Minor)

    # B Major / G# Minor (1B / 10A)
    (11, 1): '1B',  # B Major
    (11, 0): '10A',  # B Minor
}

# Reverse mapping: Camelot -> (pitch_class, mode)
CAMELOT_TO_SPOTIFY = {v: k for k, v in SPOTIFY_TO_CAMELOT.items()}

# Traditional key names mapping
KEY_NAMES_TO_SPOTIFY = {
    # Major keys
    'C': (0, 1), 'Cmaj': (0, 1), 'C major': (0, 1),
    'C#': (1, 1), 'Db': (1, 1), 'C#maj': (1, 1), 'Dbmaj': (1, 1),
    'D': (2, 1), 'Dmaj': (2, 1), 'D major': (2, 1),
    'D#': (3, 1), 'Eb': (3, 1), 'D#maj': (3, 1), 'Ebmaj': (3, 1),
    'E': (4, 1), 'Emaj': (4, 1), 'E major': (4, 1),
    'F': (5, 1), 'Fmaj': (5, 1), 'F major': (5, 1),
    'F#': (6, 1), 'Gb': (6, 1), 'F#maj': (6, 1), 'Gbmaj': (6, 1),
    'G': (7, 1), 'Gmaj': (7, 1), 'G major': (7, 1),
    'G#': (8, 1), 'Ab': (8, 1), 'G#maj': (8, 1), 'Abmaj': (8, 1),
    'A': (9, 1), 'Amaj': (9, 1), 'A major': (9, 1),
    'A#': (10, 1), 'Bb': (10, 1), 'A#maj': (10, 1), 'Bbmaj': (10, 1),
    'B': (11, 1), 'Bmaj': (11, 1), 'B major': (11, 1),

    # Minor keys
    'Cm': (0, 0), 'C minor': (0, 0), 'Cmin': (0, 0),
    'C#m': (1, 0), 'Dbm': (1, 0), 'C#min': (1, 0), 'Dbmin': (1, 0),
    'Dm': (2, 0), 'D minor': (2, 0), 'Dmin': (2, 0),
    'D#m': (3, 0), 'Ebm': (3, 0), 'D#min': (3, 0), 'Ebmin': (3, 0),
    'Em': (4, 0), 'E minor': (4, 0), 'Emin': (4, 0),
    'Fm': (5, 0), 'F minor': (5, 0), 'Fmin': (5, 0),
    'F#m': (6, 0), 'Gbm': (6, 0), 'F#min': (6, 0), 'Gbmin': (6, 0),
    'Gm': (7, 0), 'G minor': (7, 0), 'Gmin': (7, 0),
    'G#m': (8, 0), 'Abm': (8, 0), 'G#min': (8, 0), 'Abmin': (8, 0),
    'Am': (9, 0), 'A minor': (9, 0), 'Amin': (9, 0),
    'A#m': (10, 0), 'Bbm': (10, 0), 'A#min': (10, 0), 'Bbmin': (10, 0),
    'Bm': (11, 0), 'B minor': (11, 0), 'Bmin': (11, 0),
}


def get_camelot_key(spotify_key: int = None, spotify_mode: int = None, key_name: str = None) -> Optional[str]:
    """
    Convert musical key to Camelot notation.

    Args:
        spotify_key: Spotify pitch class (0-11)
        spotify_mode: Spotify mode (0=minor, 1=major)
        key_name: Traditional key name (e.g., "C major", "Am", "Cmaj")

    Returns:
        Camelot key string (e.g., "8B") or None
    """
    # Convert from key name if provided
    if key_name:
        key_name_clean = key_name.strip().replace(' ', ' ')  # Normalize spaces
        spotify_tuple = KEY_NAMES_TO_SPOTIFY.get(key_name_clean)
        if spotify_tuple:
            spotify_key, spotify_mode = spotify_tuple

    # Validate inputs
    if spotify_key is None or spotify_mode is None:
        return None

    if not (0 <= spotify_key <= 11):
        return None

    if spotify_mode not in (0, 1):
        return None

    # Lookup Camelot key
    return SPOTIFY_TO_CAMELOT.get((spotify_key, spotify_mode))


def get_compatible_keys(camelot_key: str) -> List[str]:
    """
    Get harmonically compatible keys for mixing.

    Args:
        camelot_key: Camelot notation (e.g., "8B")

    Returns:
        List of compatible Camelot keys
    """
    if not camelot_key or len(camelot_key) < 2:
        return []

    # Parse Camelot key
    try:
        number = int(camelot_key[:-1])
        letter = camelot_key[-1].upper()
    except (ValueError, IndexError):
        return []

    if not (1 <= number <= 12) or letter not in ('A', 'B'):
        return []

    compatible = []

    # Rule 1: Same key (perfect match)
    compatible.append(camelot_key)

    # Rule 2: +/- 1 step (energy shift)
    prev_number = 12 if number == 1 else number - 1
    next_number = 1 if number == 12 else number + 1
    compatible.append(f"{prev_number}{letter}")
    compatible.append(f"{next_number}{letter}")

    # Rule 3: Relative major/minor (mood shift)
    opposite_letter = 'B' if letter == 'A' else 'A'
    compatible.append(f"{number}{opposite_letter}")

    return compatible


def get_key_compatibility_score(key1: str, key2: str) -> float:
    """
    Calculate harmonic compatibility score between two keys.

    Args:
        key1: First Camelot key
        key2: Second Camelot key

    Returns:
        Compatibility score (0.0 - 1.0)
        1.0 = Perfect (same key)
        0.8 = Excellent (+/- 1 step or relative)
        0.5 = Acceptable (+/- 2 steps)
        0.0 = Poor (incompatible)
    """
    if not key1 or not key2:
        return 0.0

    compatible_keys = get_compatible_keys(key1)

    if key2 == key1:
        return 1.0  # Perfect match
    elif key2 in compatible_keys:
        # Check if it's +/-1 step or relative
        if key2[-1] != key1[-1]:  # Different letter (relative major/minor)
            return 0.8
        else:  # Same letter (+/-1 step)
            return 0.8
    else:
        # Calculate distance on the wheel
        try:
            num1 = int(key1[:-1])
            num2 = int(key2[:-1])
            letter1 = key1[-1]
            letter2 = key2[-1]

            # Different mode (A vs B)
            if letter1 != letter2:
                return 0.3

            # Same mode, calculate circular distance
            dist = min(abs(num1 - num2), 12 - abs(num1 - num2))

            if dist == 2:
                return 0.5  # Acceptable
            elif dist == 3:
                return 0.3  # Mediocre
            else:
                return 0.0  # Poor

        except (ValueError, IndexError):
            return 0.0


def convert_key_format(key_str: str, output_format: str = 'camelot') -> Optional[str]:
    """
    Convert between key formats.

    Args:
        key_str: Input key (e.g., "C major", "8B", "Cmaj")
        output_format: 'camelot', 'traditional', 'spotify'

    Returns:
        Converted key or None
    """
    # Try to parse as Camelot
    if len(key_str) >= 2 and key_str[-1].upper() in ('A', 'B'):
        try:
            number = int(key_str[:-1])
            letter = key_str[-1].upper()
            camelot = f"{number}{letter}"

            if output_format == 'camelot':
                return camelot
            elif output_format == 'spotify':
                return CAMELOT_TO_SPOTIFY.get(camelot)
            elif output_format == 'traditional':
                spotify_tuple = CAMELOT_TO_SPOTIFY.get(camelot)
                if spotify_tuple:
                    pitch, mode = spotify_tuple
                    keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
                    suffix = 'maj' if mode == 1 else 'min'
                    return f"{keys[pitch]}{suffix}"
        except ValueError:
            pass

    # Try to parse as traditional
    spotify_tuple = KEY_NAMES_TO_SPOTIFY.get(key_str)
    if spotify_tuple:
        if output_format == 'spotify':
            return spotify_tuple
        elif output_format == 'camelot':
            return SPOTIFY_TO_CAMELOT.get(spotify_tuple)
        elif output_format == 'traditional':
            return key_str

    return None


# Convenience function for pipeline integration
def enrich_with_camelot_key(item: Dict) -> Dict:
    """
    Add Camelot key to item based on musical key or Spotify key/mode.

    Args:
        item: Track item dict

    Returns:
        Item with camelot_key field added
    """
    # Try Spotify key/mode first (most reliable)
    spotify_key = item.get('key')
    spotify_mode = item.get('mode')

    if spotify_key is not None and spotify_mode is not None:
        camelot = get_camelot_key(spotify_key=spotify_key, spotify_mode=spotify_mode)
        if camelot:
            item['camelot_key'] = camelot
            return item

    # Fallback to musical_key field
    musical_key = item.get('musical_key')
    if musical_key:
        camelot = get_camelot_key(key_name=musical_key)
        if camelot:
            item['camelot_key'] = camelot

    return item
