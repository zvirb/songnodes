"""
Title Normalization and Remix Parsing Utilities

Implements the title normalization and remix/edit parsing logic from the
Artist Attribution Framework (Section III & IV).
"""

import re
from typing import Dict, Optional, List
from dataclasses import dataclass
import structlog

logger = structlog.get_logger(__name__)


@dataclass
class ParsedTitle:
    """Structured representation of a parsed track title"""
    original_title: str
    normalized_title: str
    clean_title: str  # Without remix/edit info
    remixer: Optional[str] = None
    remix_type: Optional[str] = None  # remix, edit, rework, bootleg, etc.
    label: Optional[str] = None  # Extracted from [Label] notation
    is_remix: bool = False


class TitleNormalizer:
    """
    Normalizes track titles and parses remix/edit information.

    Based on Artist Attribution Framework Section III & IV:
    - Handles remix notation parsing (parentheses, brackets, dashes)
    - Extracts label information from [Label] notation
    - Applies comprehensive normalization pipeline
    """

    # Common suffixes to strip (case-insensitive)
    STRIP_SUFFIXES = [
        'original mix',
        'extended version',
        'extended mix',
        'club edit',
        'club mix',
        'radio edit',
        'radio mix',
        'vocal mix',
        'instrumental',
        'acapella',
        'dub mix',
        'bonus track',
    ]

    # Remix keywords (for pattern matching)
    REMIX_KEYWORDS = [
        'remix', 'mix', 'edit', 'rework', 'bootleg', 'flip', 'vip', 'refix'
    ]

    # Abbreviation expansions
    ABBREVIATIONS = {
        'ft.': 'featuring',
        'feat.': 'featuring',
        'vs.': 'versus',
        'vs': 'versus',
        'w/': 'with',
        'pt.': 'part',
        '&': 'and',
    }

    def __init__(self):
        # Compile regex patterns for performance
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile all regex patterns used for parsing"""
        # Label extraction: [Label Name]
        self.label_pattern = re.compile(r'\[([^\]]+)\]')

        # Remix patterns with named groups (Section III)
        remix_keywords = '|'.join(self.REMIX_KEYWORDS)

        # Pattern 1: (Remixer Remix/Edit/etc)
        self.remix_pattern_parens = re.compile(
            rf'\(+\s*(?P<remixer>.+?)\s+(?P<type>{remix_keywords})\s*\)+',
            re.IGNORECASE
        )

        # Pattern 2: [Remixer Remix/Edit/etc]
        self.remix_pattern_brackets = re.compile(
            rf'\[+\s*(?P<remixer>.+?)\s+(?P<type>{remix_keywords})\s*\]+',
            re.IGNORECASE
        )

        # Pattern 3: - Remixer Remix/Edit/etc
        self.remix_pattern_dash = re.compile(
            rf'\s+-\s+(?P<remixer>.+?)\s+(?P<type>{remix_keywords})\s*$',
            re.IGNORECASE
        )

        # Pattern 4: Track Name (Remixer Mix) - handles variations
        self.remix_pattern_generic = re.compile(
            rf'[(\[](?P<remixer>[^)\]]+?)\s+(?P<type>{remix_keywords})[)\]]',
            re.IGNORECASE
        )

        # Mashup patterns: "Artist A vs Artist B", "Track A / Track B"
        self.mashup_vs_pattern = re.compile(r'\s+(?:vs\.?|versus)\s+', re.IGNORECASE)
        self.mashup_slash_pattern = re.compile(r'\s+/\s+')

        # Timestamp pattern: [MM:SS] or (MM:SS)
        self.timestamp_pattern = re.compile(r'[\[\(]\d{1,2}:\d{2}[\]\)]')

        # Additional label patterns (parentheses and dash at end)
        self.label_pattern_parens = re.compile(r'\s*\(([^)]+)\)\s*$')
        self.label_pattern_dash = re.compile(r'\s+-\s+([A-Z][A-Za-z\s]+(?:Records|Recordings|Music|Label)?)\s*$')

        # Whitespace normalization
        self.whitespace_pattern = re.compile(r'\s+')

    def parse_title(self, title: str) -> ParsedTitle:
        """
        Parse a track title into structured components.

        Args:
            title: Raw track title

        Returns:
            ParsedTitle object with all extracted components
        """
        original_title = title
        working_title = title
        remixer = None
        remix_type = None
        label = None

        # Step 1: Extract label (before other processing)
        label_match = self.label_pattern.search(working_title)
        if label_match:
            label = label_match.group(1).strip()
            working_title = self.label_pattern.sub('', working_title).strip()

        # Step 2: Try to parse remix information (cascading patterns)
        remix_match = None

        # Try parentheses pattern first
        remix_match = self.remix_pattern_parens.search(working_title)
        if remix_match:
            remixer = remix_match.group('remixer').strip()
            remix_type = remix_match.group('type').strip().lower()
            working_title = self.remix_pattern_parens.sub('', working_title).strip()

        # Try brackets pattern
        if not remix_match:
            remix_match = self.remix_pattern_brackets.search(working_title)
            if remix_match:
                remixer = remix_match.group('remixer').strip()
                remix_type = remix_match.group('type').strip().lower()
                working_title = self.remix_pattern_brackets.sub('', working_title).strip()

        # Try dash pattern
        if not remix_match:
            remix_match = self.remix_pattern_dash.search(working_title)
            if remix_match:
                remixer = remix_match.group('remixer').strip()
                remix_type = remix_match.group('type').strip().lower()
                working_title = self.remix_pattern_dash.sub('', working_title).strip()

        # Try generic pattern as fallback
        if not remix_match:
            remix_match = self.remix_pattern_generic.search(working_title)
            if remix_match:
                remixer = remix_match.group('remixer').strip()
                remix_type = remix_match.group('type').strip().lower()
                working_title = self.remix_pattern_generic.sub('', working_title).strip()

        # Step 3: Clean the title for search
        clean_title = working_title

        # Remove remaining parentheses/brackets content (non-remix info)
        clean_title = re.sub(r'\([^)]*\)', '', clean_title)
        clean_title = re.sub(r'\[[^\]]*\]', '', clean_title)

        # Step 4: Normalize the title
        normalized = self.normalize(clean_title)

        logger.debug(
            "Title parsed",
            original=original_title,
            clean=clean_title,
            normalized=normalized,
            remixer=remixer,
            remix_type=remix_type,
            label=label
        )

        return ParsedTitle(
            original_title=original_title,
            normalized_title=normalized,
            clean_title=clean_title,
            remixer=remixer,
            remix_type=remix_type,
            label=label,
            is_remix=remix_match is not None
        )

    def normalize(self, title: str) -> str:
        """
        Apply comprehensive normalization pipeline (Section IV).

        Normalization steps:
        0. Remove timestamps and extra label patterns
        1. Lowercase conversion
        2. Abbreviation expansion
        3. Suffix stripping
        4. Punctuation removal (except alphanumeric and spaces)
        5. Whitespace normalization
        6. Trim

        Args:
            title: Title to normalize

        Returns:
            Normalized title string
        """
        # 0. Pre-processing: Remove timestamps [MM:SS] and additional label patterns
        normalized = title

        # Remove timestamps
        normalized = self.timestamp_pattern.sub('', normalized)

        # Remove label patterns at end (if not already handled)
        normalized = self.label_pattern_dash.sub('', normalized)

        # 1. Lowercase
        normalized = normalized.lower()

        # 2. Expand abbreviations
        for abbrev, expansion in self.ABBREVIATIONS.items():
            normalized = normalized.replace(abbrev.lower(), expansion)

        # 3. Strip common suffixes (iterative)
        changed = True
        while changed:
            changed = False
            for suffix in self.STRIP_SUFFIXES:
                # Try with parentheses
                pattern = f'({suffix})'
                if pattern in normalized:
                    normalized = normalized.replace(pattern, '')
                    changed = True
                # Try plain suffix at end
                if normalized.endswith(suffix):
                    normalized = normalized[:-len(suffix)]
                    changed = True

        # 4. Remove most punctuation (keep alphanumeric and spaces)
        # Keep: letters, numbers, spaces
        normalized = re.sub(r'[^a-z0-9\s]', ' ', normalized)

        # 5. Collapse whitespace
        normalized = self.whitespace_pattern.sub(' ', normalized)

        # 6. Trim
        normalized = normalized.strip()

        return normalized

    def detect_mashup(self, title: str) -> tuple[bool, Optional[List[str]]]:
        """
        Detect if title is a mashup and extract component tracks.

        Args:
            title: Track title

        Returns:
            (is_mashup, component_tracks) tuple
        """
        # Check for "vs" pattern
        if self.mashup_vs_pattern.search(title):
            components = self.mashup_vs_pattern.split(title)
            return True, [c.strip() for c in components if c.strip()]

        # Check for slash pattern (but not in parentheses/brackets)
        # Remove content in parentheses/brackets first
        temp_title = re.sub(r'\([^)]*\)', '', title)
        temp_title = re.sub(r'\[[^\]]*\]', '', temp_title)

        if self.mashup_slash_pattern.search(temp_title):
            components = self.mashup_slash_pattern.split(temp_title)
            return True, [c.strip() for c in components if c.strip()]

        return False, None

    def extract_artist_from_title(self, title: str) -> Optional[str]:
        """
        Attempt to extract artist name from title if it follows 'Artist - Title' format.

        Args:
            title: Track title

        Returns:
            Artist name if found, None otherwise
        """
        # Common patterns: "Artist - Track" or "Artist: Track"
        dash_split = title.split(' - ', 1)
        if len(dash_split) == 2:
            return dash_split[0].strip()

        colon_split = title.split(': ', 1)
        if len(colon_split) == 2:
            return colon_split[0].strip()

        return None


class FuzzyTitleMatcher:
    """
    Fuzzy string matching for track titles with data imperfections.

    Implements Section IV of the Artist Attribution Framework using
    multiple fuzzy matching algorithms with configurable thresholds.
    """

    def __init__(self, threshold: int = 85):
        """
        Initialize fuzzy matcher.

        Args:
            threshold: Minimum similarity score (0-100) for valid match
        """
        self.threshold = threshold

        # Import fuzzy matching library (prefer rapidfuzz for performance)
        try:
            from rapidfuzz import fuzz, process
            self.fuzz = fuzz
            self.process = process
            self.using_rapidfuzz = True
            logger.info("Using RapidFuzz for fuzzy matching (high performance)")
        except ImportError:
            from thefuzz import fuzz, process
            self.fuzz = fuzz
            self.process = process
            self.using_rapidfuzz = False
            logger.info("Using TheFuzz for fuzzy matching (fallback)")

    def find_best_match(
        self,
        query: str,
        candidates: List[str],
        method: str = 'token_set_ratio'
    ) -> Optional[Dict[str, any]]:
        """
        Find the best fuzzy match from a list of candidates.

        Args:
            query: Query string to match
            candidates: List of candidate strings
            method: Matching method to use (ratio, partial_ratio, token_sort_ratio, token_set_ratio)

        Returns:
            Dict with 'match', 'score', and 'index' if match found above threshold, None otherwise
        """
        if not candidates:
            return None

        # Select matching function
        if method == 'ratio':
            scorer = self.fuzz.ratio
        elif method == 'partial_ratio':
            scorer = self.fuzz.partial_ratio
        elif method == 'token_sort_ratio':
            scorer = self.fuzz.token_sort_ratio
        elif method == 'token_set_ratio':
            scorer = self.fuzz.token_set_ratio
        else:
            raise ValueError(f"Unknown matching method: {method}")

        # Find best match using process.extractOne
        result = self.process.extractOne(
            query,
            candidates,
            scorer=scorer,
            score_cutoff=self.threshold
        )

        if result:
            match, score, index = result if self.using_rapidfuzz else (result[0], result[1], result[2])

            logger.debug(
                "Fuzzy match found",
                query=query,
                match=match,
                score=score,
                method=method
            )

            return {
                'match': match,
                'score': score,
                'index': index,
                'method': method,
                'confidence': self._score_to_confidence(score)
            }

        return None

    def _score_to_confidence(self, score: int) -> float:
        """
        Convert fuzzy match score (0-100) to confidence score (0.0-1.0).

        Uses formula from Section VII: maps threshold to 0.60, perfect match to 0.80
        """
        if score >= 100:
            return 0.80
        elif score >= self.threshold:
            # Linear interpolation: threshold=85 -> 0.60, 100 -> 0.80
            return 0.60 + ((score - self.threshold) / (100 - self.threshold)) * 0.20
        else:
            return 0.0

    def multi_method_match(
        self,
        query: str,
        candidates: List[str]
    ) -> Optional[Dict[str, any]]:
        """
        Try multiple fuzzy matching methods and return best result.

        This ensemble approach (Section IV) tries methods in order of specificity:
        1. token_set_ratio (most robust to extra words)
        2. token_sort_ratio (robust to word order)
        3. partial_ratio (substring matching)
        4. ratio (basic Levenshtein)

        Args:
            query: Query string
            candidates: List of candidate strings

        Returns:
            Best match result across all methods
        """
        methods = ['token_set_ratio', 'token_sort_ratio', 'partial_ratio', 'ratio']
        best_result = None
        best_score = 0

        for method in methods:
            result = self.find_best_match(query, candidates, method=method)
            if result and result['score'] > best_score:
                best_result = result
                best_score = result['score']

        if best_result:
            logger.info(
                "Multi-method fuzzy match",
                query=query,
                best_match=best_result['match'],
                best_score=best_score,
                method=best_result['method']
            )

        return best_result
