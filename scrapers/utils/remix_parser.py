"""
Remix/Version Information Parser

Intelligently extracts remix, version, and label information from track titles.

Key distinctions:
- Square brackets [...] usually contain LABEL information, NOT remix info
- Parentheses (...) often contain VERSION/REMIX information
- Remix artist names typically appear at the END of titles

Examples:
- "Take It Off [Catch & Release]" → label="Catch & Release", is_remix=False
- "Levels (Avicii by Avicii Remix)" → remixer="Avicii", is_remix=True
- "Animals (Martin Garrix Extended Mix)" → remix_type="extended", is_remix=True
- "Clarity (Tiësto Remix) [Interscope]" → remixer="Tiësto", label="Interscope", is_remix=True
"""
import re
from typing import Dict, Optional, Tuple
from enum import Enum


class RemixType(str, Enum):
    """Remix/version types"""
    ORIGINAL = "original"
    EXTENDED = "extended"
    RADIO = "radio"
    CLUB = "club"
    VIP = "vip"
    INSTRUMENTAL = "instrumental"
    ACAPPELLA = "acappella"
    REMIX = "remix"
    EDIT = "edit"
    REWORK = "rework"
    BOOTLEG = "bootleg"
    MASHUP = "mashup"
    DUB = "dub"
    UNKNOWN = "unknown"


class TrackTitleParser:
    """Parse track titles to extract remix, version, and label information"""

    # Known record labels (to avoid mistaking them for remix info)
    KNOWN_LABELS = {
        'spinnin', 'armada', 'ultra', 'defected', 'anjunabeats', 'anjunadeep',
        'mau5trap', 'monstercat', 'owsla', 'mad decent', 'dim mak',
        'protokol', 'revealed', 'atlantic', 'columbia', 'interscope',
        'universal', 'sony', 'warner', 'emi', 'island', 'capitol',
        'parlophone', 'epic', 'rca', 'virgin', 'polydor', 'elektra',
        'hospital', 'ram', 'metalheadz', 'viper', 'shogun', 'liquicity',
        'toolroom', 'dirtybird', 'drumcode', 'afterlife', 'diynamic',
        'bedrock', 'mobilee', 'get physical', 'suara', 'hot creations',
        'crosstown rebels', 'cadenza', 'cocoon', 'kompakt', 'ostgut ton',
        'ninja tune', 'warp', 'xl', 'domino', 'mute', 'touch', '4ad',
        'catch & release', 'etcetc au', 'awal', 'nettwerk', 'formation',
        'coldharbour', 'fools gold label', 'allsorts', 'mosaik', 'earstorm',
        'solmatic', 'scorpio', 'nukleuz', 'urban sickness', 'helix',
        'black hole', 'zombie', 'white labek', 'brigand', 'wonderwheel',
        'sweat it out', 'shock one', 'pacha', 'the end of genesys',
        'recordjet', 'mixmash', 'hexagon', 'stmpd rcrds', 'musical freedom',
        'big beat', 'astralwerks', 'confession', 'heldeep'
    }

    # Remix/version keywords
    REMIX_KEYWORDS = [
        'remix', 'rmx', 'rework', 'edit', 'bootleg', 'flip', 'vip',
        'extended mix', 'extended', 'radio edit', 'radio mix', 'club mix',
        'dub mix', 'instrumental', 'acappella', 'a cappella', 'vocal mix',
        'original mix', 'club edit', 'festival mix', 'festival edit'
    ]

    # Words that indicate it's NOT a remix (even if parentheses/brackets present)
    NON_REMIX_INDICATORS = [
        'feat', 'featuring', 'ft', 'with', 'vs', 'versus', 'pres', 'presents',
        'original', 'official', 'audio', 'video', 'lyric', 'lyrics', 'hd', 'hq',
        'free download', 'out now', 'available', 'release'
    ]

    def __init__(self):
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile regex patterns for performance"""
        # Match content in square brackets [...]
        self.bracket_pattern = re.compile(r'\[([^\]]+)\]')

        # Match content in parentheses (...)
        self.paren_pattern = re.compile(r'\(([^\)]+)\)')

        # Match remix artist pattern: "Artist Name Remix/Edit/Rework"
        # Support Unicode characters for international artist names (Tiësto, etc.)
        remix_keywords_str = '|'.join(self.REMIX_KEYWORDS)
        self.remix_artist_pattern = re.compile(
            rf'([A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F\s&]+?)\s+(?:{remix_keywords_str})',
            re.IGNORECASE
        )

    def parse(self, title: str) -> Dict[str, any]:
        """
        Parse track title and extract all remix/version/label information.

        Args:
            title: Full track title

        Returns:
            Dictionary with keys:
                - clean_title: Title with remix/label info removed
                - is_remix: Boolean indicating if this is a remix
                - is_mashup: Boolean indicating if this is a mashup
                - is_live: Boolean indicating if this is a live version
                - is_cover: Boolean indicating if this is a cover
                - remix_type: Type of remix (extended, radio, etc.)
                - remixer: Name of remixer/editor
                - label: Record label
                - version_info: Any additional version information
        """
        result = {
            'clean_title': title,
            'is_remix': False,
            'is_mashup': False,
            'is_live': False,
            'is_cover': False,
            'remix_type': None,
            'remixer': None,
            'label': None,
            'version_info': None
        }

        if not title:
            return result

        working_title = title

        # Step 1: Extract and classify bracketed content [...]
        brackets = self.bracket_pattern.findall(title)
        for bracket_content in brackets:
            bracket_lower = bracket_content.lower().strip()

            # Check if it's a known label
            if any(label in bracket_lower for label in self.KNOWN_LABELS):
                result['label'] = bracket_content.strip()
                # Remove from working title
                working_title = working_title.replace(f'[{bracket_content}]', '')
            # Check if it contains remix keywords (less common but possible)
            elif any(keyword in bracket_lower for keyword in self.REMIX_KEYWORDS):
                remix_info = self._parse_remix_string(bracket_content)
                result.update(remix_info)
                working_title = working_title.replace(f'[{bracket_content}]', '')

        # Step 2: Extract and classify parenthesized content (...)
        parens = self.paren_pattern.findall(working_title)
        for paren_content in parens:
            paren_lower = paren_content.lower().strip()

            # Skip if it's a non-remix indicator
            if any(indicator in paren_lower for indicator in self.NON_REMIX_INDICATORS):
                working_title = working_title.replace(f'({paren_content})', '')
                continue

            # Check if it contains remix information
            if any(keyword in paren_lower for keyword in self.REMIX_KEYWORDS):
                remix_info = self._parse_remix_string(paren_content)
                result.update(remix_info)
                working_title = working_title.replace(f'({paren_content})', '')

        # Step 3: Check for inline remix artist at end of title (without parentheses/brackets)
        # E.g., "Track Name Artist Name Remix"
        if not result['is_remix']:
            remix_match = self.remix_artist_pattern.search(working_title)
            if remix_match:
                result['is_remix'] = True
                result['remixer'] = remix_match.group(1).strip()
                result['remix_type'] = RemixType.REMIX
                # Remove from working title
                working_title = working_title[:remix_match.start()].strip()

        # Step 4: Check for mashup indicators
        if 'mashup' in title.lower() or 'mash up' in title.lower() or ' x ' in title:
            result['is_mashup'] = True

        # Step 5: Check for live indicators
        if re.search(r'\b(live|live at|live from)\b', title, re.IGNORECASE):
            result['is_live'] = True

        # Step 6: Check for cover indicators
        if re.search(r'\b(cover|covering)\b', title, re.IGNORECASE):
            result['is_cover'] = True

        # Clean up the working title
        result['clean_title'] = ' '.join(working_title.split()).strip()

        return result

    def _parse_remix_string(self, remix_str: str) -> Dict[str, any]:
        """
        Parse a remix/version string to extract specific information.

        Args:
            remix_str: The remix/version string (e.g., "Tiësto Remix", "Extended Mix")

        Returns:
            Dictionary with is_remix, remix_type, and remixer fields
        """
        result = {
            'is_remix': True,
            'remix_type': RemixType.REMIX,
            'remixer': None
        }

        remix_lower = remix_str.lower().strip()

        # Determine remix type
        if 'extended' in remix_lower:
            result['remix_type'] = RemixType.EXTENDED
        elif 'radio' in remix_lower:
            result['remix_type'] = RemixType.RADIO
        elif 'club' in remix_lower:
            result['remix_type'] = RemixType.CLUB
        elif 'vip' in remix_lower:
            result['remix_type'] = RemixType.VIP
        elif 'instrumental' in remix_lower:
            result['remix_type'] = RemixType.INSTRUMENTAL
        elif 'acappella' in remix_lower or 'a cappella' in remix_lower:
            result['remix_type'] = RemixType.ACAPPELLA
        elif 'edit' in remix_lower:
            result['remix_type'] = RemixType.EDIT
        elif 'rework' in remix_lower:
            result['remix_type'] = RemixType.REWORK
        elif 'bootleg' in remix_lower:
            result['remix_type'] = RemixType.BOOTLEG
        elif 'dub' in remix_lower:
            result['remix_type'] = RemixType.DUB
        elif 'original mix' in remix_lower:
            result['is_remix'] = False
            result['remix_type'] = RemixType.ORIGINAL
            return result

        # Extract remixer name if present
        # Pattern: "Artist Name Remix/Edit/etc."
        remix_match = self.remix_artist_pattern.search(remix_str)
        if remix_match:
            result['remixer'] = remix_match.group(1).strip()

        return result


# Convenience function for use in ItemLoaders
def parse_track_remix_info(title: str) -> Dict[str, any]:
    """
    Parse track title for remix information (ItemLoader processor).

    Usage in ItemLoader:
        track_loader.add_value('title', response.xpath(...), MapCompose(parse_track_remix_info))

    Args:
        title: Track title string

    Returns:
        Dictionary with parsed remix information
    """
    parser = TrackTitleParser()
    return parser.parse(title)


# Example usage
if __name__ == "__main__":
    parser = TrackTitleParser()

    test_cases = [
        "Take It Off [Catch & Release]",
        "Take It Off (Extended Mix) [Catch & Release]",
        "Levels (Avicii by Avicii Remix)",
        "Animals (Martin Garrix Remix)",
        "Clarity (Tiësto Remix) [Interscope]",
        "Ghosts n Stuff (Sub Focus Remix)",
        "Strobe (Original Mix)",
        "One (Swedish House Mafia x Alesso)",
        "Satisfaction (Benny Benassi Presents The Biz)",
        "Promises (Calvin Harris & Sam Smith)",
        "Lose Control (Meduza Extended Remix) [Island]",
        "Feel It Still (Meduza Remix) [Atlantic]",
    ]

    for title in test_cases:
        print(f"\nTitle: {title}")
        result = parser.parse(title)
        print(f"  Clean: {result['clean_title']}")
        print(f"  Is Remix: {result['is_remix']}")
        if result['remixer']:
            print(f"  Remixer: {result['remixer']}")
        if result['remix_type']:
            print(f"  Type: {result['remix_type']}")
        if result['label']:
            print(f"  Label: {result['label']}")
