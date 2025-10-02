"""
Advanced Text Normalization Pipeline (Framework Section 3.1)
=============================================================

Pre-processing cascade for scraped track strings before fuzzy matching.

Framework Quote:
"Before any matching occurs, all string-based data (artist and track titles)
must be passed through a rigorous cleaning pipeline. This involves: converting
text to a consistent case, removing extraneous whitespace and special characters,
standardizing artist separators, and parsing/removing common suffixes like
'(Original Mix)', '(Extended Edit)', or '(Club Mix)' into a separate 'version' field."

Normalization Stages:
1. Unicode normalization (handle accents, special chars)
2. Case normalization (lowercase)
3. Artist separator standardization (feat., vs., &)
4. Version extraction (remix type, edit type)
5. Punctuation removal
6. Whitespace collapse

Usage:
    from text_normalizer import normalize_track_string, extract_version_info

    # Full normalization
    result = normalize_track_string("FISHER & Chris Lake - Losing It (Original Mix)")
    # Returns:
    # {
    #   'artist': 'fisher and chris lake',
    #   'title': 'losing it',
    #   'version': 'original mix',
    #   'is_remix': False,
    #   'normalized_full': 'fisher and chris lake losing it'
    # }
"""

import re
import unicodedata
from typing import Dict, Optional, List, Tuple


class TextNormalizer:
    """
    Advanced text normalization for music metadata.

    Implements framework specification Section 3.1 normalization cascade.
    """

    # Separator standardization mappings
    ARTIST_SEPARATORS = {
        r'\s*&\s*': ' and ',
        r'\s*feat\.?\s*': ' featuring ',
        r'\s*ft\.?\s*': ' featuring ',
        r'\s*vs\.?\s*': ' versus ',
        r'\s*x\s+': ' and ',  # "Artist A x Artist B"
        r'\s*,\s*': ' and ',
    }

    # Version/Remix type patterns (Framework Table 3.1)
    VERSION_PATTERNS = [
        # Remix types
        (r'\((.*?)\s*remix\)', 'remix', True),
        (r'\[(.*?)\s*remix\]', 'remix', True),
        (r'-\s*(.*?)\s*remix', 'remix', True),

        # Mix types
        (r'\(original\s*mix\)', 'original mix', False),
        (r'\(extended\s*mix\)', 'extended mix', False),
        (r'\(club\s*mix\)', 'club mix', False),
        (r'\(radio\s*edit\)', 'radio edit', False),
        (r'\(dub\s*mix\)', 'dub mix', False),
        (r'\(vocal\s*mix\)', 'vocal mix', False),
        (r'\(instrumental\)', 'instrumental', False),
        (r'\(acapella\)', 'acapella', False),

        # Generic patterns
        (r'\((.*?)\s*version\)', 'version', False),
        (r'\((.*?)\s*edit\)', 'edit', False),
        (r'\[(.*?)\s*edit\]', 'edit', False),
    ]

    def normalize_track_string(self, track_string: str) -> Dict[str, any]:
        """
        Full normalization pipeline for scraped track strings.

        Args:
            track_string: Raw scraped string (e.g., "Artist - Title (Remix)")

        Returns:
            Dict with normalized components
        """
        if not track_string:
            return {
                'artist': '',
                'title': '',
                'version': None,
                'is_remix': False,
                'normalized_full': ''
            }

        # Stage 1: Unicode normalization
        normalized = self._normalize_unicode(track_string)

        # Stage 2: Extract version info BEFORE splitting
        version_info = self._extract_version(normalized)
        clean_string = version_info['clean_string']

        # Stage 3: Split artist and title
        artist, title = self._split_artist_title(clean_string)

        # Stage 4: Normalize artist separators
        artist = self._normalize_artist_separators(artist)

        # Stage 5: Case normalization and punctuation removal
        artist = self._normalize_case_and_punctuation(artist)
        title = self._normalize_case_and_punctuation(title)

        # Stage 6: Whitespace collapse
        artist = self._collapse_whitespace(artist)
        title = self._collapse_whitespace(title)

        return {
            'artist': artist,
            'title': title,
            'version': version_info.get('version'),
            'remix_type': version_info.get('remix_type'),
            'is_remix': version_info.get('is_remix', False),
            'normalized_full': f"{artist} {title}".strip()
        }

    def normalize_artist_name(self, artist_name: str) -> str:
        """Normalize artist name only"""
        if not artist_name:
            return ''

        # Unicode normalization
        normalized = self._normalize_unicode(artist_name)

        # Separator standardization
        normalized = self._normalize_artist_separators(normalized)

        # Case and punctuation
        normalized = self._normalize_case_and_punctuation(normalized)

        # Whitespace
        normalized = self._collapse_whitespace(normalized)

        return normalized

    def normalize_title_only(self, title: str, extract_version: bool = True) -> Dict[str, str]:
        """Normalize track title only, optionally extracting version"""
        if not title:
            return {'title': '', 'version': None, 'is_remix': False}

        # Unicode normalization
        normalized = self._normalize_unicode(title)

        # Extract version if requested
        if extract_version:
            version_info = self._extract_version(normalized)
            clean_title = version_info['clean_string']
            version = version_info.get('version')
            is_remix = version_info.get('is_remix', False)
        else:
            clean_title = normalized
            version = None
            is_remix = False

        # Case and punctuation
        clean_title = self._normalize_case_and_punctuation(clean_title)

        # Whitespace
        clean_title = self._collapse_whitespace(clean_title)

        return {
            'title': clean_title,
            'version': version,
            'is_remix': is_remix
        }

    def _normalize_unicode(self, text: str) -> str:
        """Normalize Unicode characters (handle accents, special chars)"""
        # NFD decomposition (separate base chars from accents)
        nfd = unicodedata.normalize('NFD', text)

        # Remove combining characters (accents)
        # But keep the base characters
        ascii_text = ''.join(
            char for char in nfd
            if unicodedata.category(char) != 'Mn'  # Mn = Mark, Nonspacing
        )

        return ascii_text

    def _extract_version(self, text: str) -> Dict[str, any]:
        """Extract version/remix information from title"""
        clean_text = text
        version = None
        remix_type = None
        is_remix = False

        for pattern, version_name, is_remix_flag in self.VERSION_PATTERNS:
            match = re.search(pattern, clean_text, re.IGNORECASE)
            if match:
                # Extract remixer name if present (e.g., "Chris Lake Remix")
                if match.groups():
                    remix_type = match.group(1).strip()
                else:
                    remix_type = version_name

                version = version_name
                is_remix = is_remix_flag

                # Remove version string from text
                clean_text = re.sub(pattern, '', clean_text, flags=re.IGNORECASE)
                break

        return {
            'clean_string': clean_text.strip(),
            'version': version,
            'remix_type': remix_type,
            'is_remix': is_remix
        }

    def _split_artist_title(self, text: str) -> Tuple[str, str]:
        """Split combined string into artist and title"""
        # Common patterns: "Artist - Title", "Artist: Title", "Artist | Title"
        separators = [' - ', ' – ', ' — ', ': ', ' | ']

        for sep in separators:
            if sep in text:
                parts = text.split(sep, 1)  # Split only on first occurrence
                if len(parts) == 2:
                    return parts[0].strip(), parts[1].strip()

        # No separator found - assume entire string is title
        return '', text.strip()

    def _normalize_artist_separators(self, artist: str) -> str:
        """Standardize artist collaboration separators"""
        normalized = artist

        for pattern, replacement in self.ARTIST_SEPARATORS.items():
            normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)

        return normalized

    def _normalize_case_and_punctuation(self, text: str) -> str:
        """Lowercase and remove punctuation (except hyphens in words)"""
        # Lowercase
        text = text.lower()

        # Remove punctuation except hyphens between letters
        # Keep: "drum-n-bass", "hip-hop"
        # Remove: "title!", "what?", "hey..."
        text = re.sub(r'(?<![a-z])-|-(?![a-z])', ' ', text)  # Remove standalone hyphens
        text = re.sub(r'[^\w\s-]', '', text)  # Remove other punctuation

        return text

    def _collapse_whitespace(self, text: str) -> str:
        """Collapse multiple spaces into single space"""
        return re.sub(r'\s+', ' ', text).strip()


# Convenience functions
def normalize_track_string(track_string: str) -> Dict[str, any]:
    """Quick track normalization"""
    normalizer = TextNormalizer()
    return normalizer.normalize_track_string(track_string)


def normalize_artist_name(artist_name: str) -> str:
    """Quick artist normalization"""
    normalizer = TextNormalizer()
    return normalizer.normalize_artist_name(artist_name)


def extract_version_info(title: str) -> Dict[str, any]:
    """Quick version extraction"""
    normalizer = TextNormalizer()
    return normalizer.normalize_title_only(title, extract_version=True)


def clean_for_comparison(text: str) -> str:
    """
    Quick clean for fuzzy matching comparison.

    Removes all noise to maximize matching accuracy.
    """
    normalizer = TextNormalizer()

    # Unicode normalization
    text = normalizer._normalize_unicode(text)

    # Case and punctuation
    text = normalizer._normalize_case_and_punctuation(text)

    # Whitespace
    text = normalizer._collapse_whitespace(text)

    return text
