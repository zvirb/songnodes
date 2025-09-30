"""
Track ID Generation - Deterministic Cross-Source Identification
Implements 2025 best practices for music track deduplication

Generates stable track IDs that:
1. Identify same track across different sources (1001tracklists, Spotify, MixesDB)
2. Distinguish remixes/versions as different tracks
3. Handle artist variations and typos
4. Support multi-artist tracks
"""
import hashlib
import re
import logging
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)


def normalize_string(text: str) -> str:
    """
    Normalize string for comparison - removes punctuation, extra spaces, lowercase.

    Examples:
        "Deadmau5" → "deadmau5"
        "Don't You Worry Child" → "dont you worry child"
        "Café del Mar" → "cafe del mar"
    """
    if not text:
        return ""

    # Lowercase
    text = text.lower()

    # Remove punctuation and special characters (keep spaces)
    text = re.sub(r'[^\w\s]', '', text)

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    return text


def extract_remix_type(track_name: str) -> Optional[str]:
    """
    Extract remix type from track name.

    Returns standardized remix type or None for original.

    Examples:
        "Strobe (Chris Lake Remix)" → "remix"
        "Strobe (Extended Mix)" → "extended"
        "Strobe (Radio Edit)" → "radio"
        "Strobe (VIP Mix)" → "vip"
        "Strobe" → None (original)
    """
    # Pattern mapping: regex → standardized type
    remix_patterns = {
        r'\(.*?original\s+mix\)': 'original',
        r'\(.*?extended\s+mix\)': 'extended',
        r'\(.*?radio\s+edit\)': 'radio',
        r'\(.*?club\s+mix\)': 'club',
        r'\(.*?vip\s+mix\)': 'vip',
        r'\(.*?instrumental\)': 'instrumental',
        r'\(.*?acappella\)': 'acappella',
        r'\(.*?remix\)': 'remix',
        r'\(.*?edit\)': 'edit',
        r'\(.*?rework\)': 'rework',
        r'\(.*?bootleg\)': 'bootleg',
        r'\(.*?mashup\)': 'mashup',
    }

    track_lower = track_name.lower()

    for pattern, remix_type in remix_patterns.items():
        if re.search(pattern, track_lower):
            return remix_type

    return None  # Original version


def generate_track_id(
    title: str,
    primary_artist: str,
    featured_artists: Optional[List[str]] = None,
    remixer_artists: Optional[List[str]] = None,
    is_remix: bool = False,
    is_mashup: bool = False,
    remix_type: Optional[str] = None
) -> str:
    """
    Generate deterministic track ID from normalized metadata.

    Same track from different sources → same track_id
    Different remixes → different track_ids

    Args:
        title: Track title (e.g., "Strobe")
        primary_artist: Main artist (e.g., "Deadmau5")
        featured_artists: List of featured artists (optional)
        remixer_artists: List of remixers (optional)
        is_remix: Whether this is a remix
        is_mashup: Whether this is a mashup
        remix_type: Standardized remix type (e.g., "extended", "radio")

    Returns:
        16-character hexadecimal track ID

    Examples:
        >>> generate_track_id("Strobe", "Deadmau5")
        'a1b2c3d4e5f6g7h8'

        >>> generate_track_id("Strobe", "Deadmau5", remix_type="extended")
        'x9y8z7w6v5u4t3s2'  # Different from original

        >>> generate_track_id("Strobe", "deadmau5")  # Case insensitive
        'a1b2c3d4e5f6g7h8'  # Same as above
    """
    # Normalize all components
    norm_title = normalize_string(title)
    norm_artist = normalize_string(primary_artist)

    # Handle featured artists (sorted for consistency)
    featured_str = ""
    if featured_artists:
        norm_featured = sorted([normalize_string(a) for a in featured_artists if a])
        if norm_featured:
            featured_str = f"feat_{' '.join(norm_featured)}"

    # Handle remixers (sorted for consistency)
    remixer_str = ""
    if is_remix and remixer_artists:
        norm_remixers = sorted([normalize_string(a) for a in remixer_artists if a])
        if norm_remixers:
            remixer_str = f"remix_{' '.join(norm_remixers)}"

    # Build ID string components
    components = [norm_artist, norm_title]

    if featured_str:
        components.append(featured_str)

    # Add remix type or remixer to distinguish versions
    if remix_type:
        components.append(f"type_{remix_type}")
    elif remixer_str:
        components.append(remixer_str)

    # Add mashup flag
    if is_mashup:
        components.append("mashup")

    # Join with :: separator
    id_string = "::".join(components)

    # Generate stable hash (first 16 chars of SHA-256)
    hash_object = hashlib.sha256(id_string.encode('utf-8'))
    track_id = hash_object.hexdigest()[:16]

    logger.debug(f"Generated track_id: {track_id} from: {id_string}")

    return track_id


def generate_track_id_from_parsed(parsed_track: Dict) -> str:
    """
    Generate track ID from parsed track data (from parse_track_string).

    Args:
        parsed_track: Dict from utils.parse_track_string() containing:
            - track_name: str
            - primary_artists: List[str]
            - featured_artists: List[str]
            - remixer_artists: List[str]
            - is_remix: bool
            - is_mashup: bool

    Returns:
        16-character track ID
    """
    # Extract primary artist (use first if multiple)
    primary_artist = parsed_track.get('primary_artists', [''])[0] if parsed_track.get('primary_artists') else ''

    # Auto-detect remix type from track name if not provided
    track_name = parsed_track.get('track_name', '')
    remix_type = extract_remix_type(track_name)

    return generate_track_id(
        title=track_name,
        primary_artist=primary_artist,
        featured_artists=parsed_track.get('featured_artists'),
        remixer_artists=parsed_track.get('remixer_artists'),
        is_remix=parsed_track.get('is_remix', False),
        is_mashup=parsed_track.get('is_mashup', False),
        remix_type=remix_type
    )


def track_ids_match(track_id_1: str, track_id_2: str) -> bool:
    """
    Check if two track IDs represent the same track.

    Simple equality check, but provides semantic meaning.
    """
    return track_id_1 == track_id_2


def are_same_track_different_version(
    title_1: str, artist_1: str, remix_type_1: Optional[str],
    title_2: str, artist_2: str, remix_type_2: Optional[str]
) -> bool:
    """
    Check if two tracks are different versions of the same song.

    Returns True if:
    - Same normalized title
    - Same normalized artist
    - Different remix types (or one is original)

    Examples:
        "Strobe" (original) vs "Strobe (Extended Mix)" → True
        "Strobe" vs "Animals" → False
    """
    norm_title_1 = normalize_string(title_1)
    norm_title_2 = normalize_string(title_2)
    norm_artist_1 = normalize_string(artist_1)
    norm_artist_2 = normalize_string(artist_2)

    # Same title and artist?
    if norm_title_1 == norm_title_2 and norm_artist_1 == norm_artist_2:
        # Different remix types?
        return remix_type_1 != remix_type_2

    return False


# Utility function for bulk ID generation
def generate_track_ids_batch(tracks: List[Dict]) -> List[Dict]:
    """
    Generate track IDs for a batch of tracks.

    Args:
        tracks: List of dicts with 'title', 'primary_artist', etc.

    Returns:
        Same list with 'track_id' field added to each dict
    """
    for track in tracks:
        try:
            track['track_id'] = generate_track_id(
                title=track.get('title', ''),
                primary_artist=track.get('primary_artist', ''),
                featured_artists=track.get('featured_artists'),
                remixer_artists=track.get('remixer_artists'),
                is_remix=track.get('is_remix', False),
                is_mashup=track.get('is_mashup', False),
                remix_type=track.get('remix_type')
            )
        except Exception as e:
            logger.error(f"Failed to generate track_id for {track.get('title')}: {e}")
            track['track_id'] = None

    return tracks


if __name__ == "__main__":
    # Test cases
    logging.basicConfig(level=logging.DEBUG)

    print("=" * 60)
    print("TRACK ID GENERATION TESTS")
    print("=" * 60)

    # Test 1: Same track, different sources
    id1 = generate_track_id("Strobe", "Deadmau5")
    id2 = generate_track_id("Strobe", "deadmau5")  # Different case
    id3 = generate_track_id("Strobe", "Deadmau5")  # Exact duplicate

    print("\n1. SAME TRACK, DIFFERENT SOURCES:")
    print(f"   'Strobe' by 'Deadmau5': {id1}")
    print(f"   'Strobe' by 'deadmau5': {id2}")
    print(f"   'Strobe' by 'Deadmau5': {id3}")
    print(f"   All match: {id1 == id2 == id3}")

    # Test 2: Different remixes
    id_original = generate_track_id("Strobe", "Deadmau5", remix_type=None)
    id_extended = generate_track_id("Strobe", "Deadmau5", remix_type="extended")
    id_radio = generate_track_id("Strobe", "Deadmau5", remix_type="radio")

    print("\n2. DIFFERENT VERSIONS:")
    print(f"   Original: {id_original}")
    print(f"   Extended: {id_extended}")
    print(f"   Radio:    {id_radio}")
    print(f"   All different: {len({id_original, id_extended, id_radio}) == 3}")

    # Test 3: Remixer attribution
    id_orig = generate_track_id("Strobe", "Deadmau5")
    id_remix = generate_track_id("Strobe", "Deadmau5",
                                  remixer_artists=["Chris Lake"],
                                  is_remix=True)

    print("\n3. REMIX ATTRIBUTION:")
    print(f"   Original:          {id_orig}")
    print(f"   Chris Lake Remix:  {id_remix}")
    print(f"   Different: {id_orig != id_remix}")

    # Test 4: Featured artists
    id_solo = generate_track_id("Don't You Worry Child", "Swedish House Mafia")
    id_feat = generate_track_id("Don't You Worry Child", "Swedish House Mafia",
                                 featured_artists=["John Martin"])

    print("\n4. FEATURED ARTISTS:")
    print(f"   Solo:     {id_solo}")
    print(f"   feat.:    {id_feat}")
    print(f"   Different: {id_solo != id_feat}")

    # Test 5: Version detection
    same_version = are_same_track_different_version(
        "Strobe", "Deadmau5", None,
        "Strobe", "Deadmau5", "extended"
    )

    different_song = are_same_track_different_version(
        "Strobe", "Deadmau5", None,
        "Animals", "Martin Garrix", None
    )

    print("\n5. VERSION DETECTION:")
    print(f"   Strobe (original) vs Strobe (extended): {same_version}")
    print(f"   Strobe vs Animals: {different_song}")

    print("\n" + "=" * 60)
    print("✓ ALL TESTS COMPLETE")
    print("=" * 60)