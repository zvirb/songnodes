"""
Advanced Fuzzy Matching Cascade (Framework Section 3.1)
========================================================

Implements the multi-stage matching cascade specified in Framework Table 3.1:
1. Exact Match (normalized strings)
2. High-Threshold Fuzzy Match (95%+ similarity)
3. Token Set Ratio (handles word reordering)
4. Jaro-Winkler Similarity (prefix matching)
5. Levenshtein Distance (character-level typos)
6. API Fallback (MusicBrainz/Spotify search)

Framework Quote:
"A failure to correctly match a track's scraped setlist data with its API-derived
audio features renders both pieces of information useless for the intended relational
analysis. A sophisticated matching cascade is required."

Usage:
    from fuzzy_matcher import FuzzyTrackMatcher

    matcher = FuzzyTrackMatcher()
    result = matcher.match_track(
        scraped_artist="FISHER",
        scraped_title="Losing It (Original Mix)",
        db_candidates=[
            {"artist": "Fisher", "title": "Losing It", "mbid": "123"},
            {"artist": "FISHER", "title": "Losing It - Extended", "mbid": "456"}
        ]
    )
    # Returns: {"artist": "FISHER", "title": "Losing It", "mbid": "123", "confidence": 0.98}
"""

import logging
from typing import Dict, List, Optional, Tuple
from difflib import SequenceMatcher

# Import fuzzy matching libraries
try:
    import jellyfish  # Jaro-Winkler, Levenshtein
    JELLYFISH_AVAILABLE = True
except ImportError:
    JELLYFISH_AVAILABLE = False

try:
    from fuzzywuzzy import fuzz
    FUZZYWUZZY_AVAILABLE = True
except ImportError:
    FUZZYWUZZY_AVAILABLE = False

logger = logging.getLogger(__name__)


class FuzzyTrackMatcher:
    """
    Advanced fuzzy matching engine implementing the framework cascade.

    Confidence Thresholds:
    - Exact: 1.0
    - High Fuzzy: >= 0.95
    - Token Set: >= 0.85
    - Jaro-Winkler: >= 0.90
    - Levenshtein: >= 0.85
    - Minimum Acceptable: 0.80
    """

    def __init__(self):
        self.exact_threshold = 1.0
        self.high_fuzzy_threshold = 0.95
        self.token_set_threshold = 0.85
        self.jaro_winkler_threshold = 0.90
        self.levenshtein_threshold = 0.85
        self.min_acceptable = 0.80

        # Check library availability
        if not JELLYFISH_AVAILABLE:
            logger.warning("⚠️ jellyfish library not installed - Jaro-Winkler and Levenshtein disabled")
        if not FUZZYWUZZY_AVAILABLE:
            logger.warning("⚠️ fuzzywuzzy library not installed - Token Set Ratio disabled")

    def match_track(
        self,
        scraped_artist: str,
        scraped_title: str,
        db_candidates: List[Dict],
        enable_api_fallback: bool = False
    ) -> Optional[Dict]:
        """
        Match scraped track against database candidates using cascade.

        Args:
            scraped_artist: Artist name from scraped source
            scraped_title: Track title from scraped source
            db_candidates: List of candidate tracks from database
            enable_api_fallback: Whether to use API fallback if no match

        Returns:
            Best matching candidate with confidence score, or None
        """
        if not db_candidates:
            return None

        # Normalize inputs
        scraped_artist_norm = self._normalize_string(scraped_artist)
        scraped_title_norm = self._normalize_string(scraped_title)

        best_match = None
        best_confidence = 0.0
        match_stage = None

        for candidate in db_candidates:
            candidate_artist_norm = self._normalize_string(candidate.get('artist', ''))
            candidate_title_norm = self._normalize_string(candidate.get('title', ''))

            # Stage 1: Exact Match
            if (scraped_artist_norm == candidate_artist_norm and
                scraped_title_norm == candidate_title_norm):
                logger.debug(f"✓ Exact match: {scraped_artist} - {scraped_title}")
                return {**candidate, 'confidence': 1.0, 'match_stage': 'exact'}

            # Stage 2: High-Threshold Fuzzy (95%+)
            fuzzy_score = self._calculate_fuzzy_similarity(
                scraped_artist_norm, scraped_title_norm,
                candidate_artist_norm, candidate_title_norm
            )
            if fuzzy_score >= self.high_fuzzy_threshold and fuzzy_score > best_confidence:
                best_match = candidate
                best_confidence = fuzzy_score
                match_stage = 'high_fuzzy'
                continue

            # Stage 3: Token Set Ratio (word reordering)
            if FUZZYWUZZY_AVAILABLE:
                token_score = self._calculate_token_set_similarity(
                    scraped_artist_norm, scraped_title_norm,
                    candidate_artist_norm, candidate_title_norm
                )
                if token_score >= self.token_set_threshold and token_score > best_confidence:
                    best_match = candidate
                    best_confidence = token_score
                    match_stage = 'token_set'
                    continue

            # Stage 4: Jaro-Winkler (prefix matching)
            if JELLYFISH_AVAILABLE:
                jw_score = self._calculate_jaro_winkler_similarity(
                    scraped_artist_norm, scraped_title_norm,
                    candidate_artist_norm, candidate_title_norm
                )
                if jw_score >= self.jaro_winkler_threshold and jw_score > best_confidence:
                    best_match = candidate
                    best_confidence = jw_score
                    match_stage = 'jaro_winkler'
                    continue

            # Stage 5: Levenshtein Distance (typo tolerance)
            if JELLYFISH_AVAILABLE:
                lev_score = self._calculate_levenshtein_similarity(
                    scraped_artist_norm, scraped_title_norm,
                    candidate_artist_norm, candidate_title_norm
                )
                if lev_score >= self.levenshtein_threshold and lev_score > best_confidence:
                    best_match = candidate
                    best_confidence = lev_score
                    match_stage = 'levenshtein'

        # Return best match if confidence meets minimum threshold
        if best_match and best_confidence >= self.min_acceptable:
            logger.debug(
                f"✓ Match via {match_stage} (confidence={best_confidence:.2f}): "
                f"{scraped_artist} - {scraped_title} → {best_match.get('artist')} - {best_match.get('title')}"
            )
            return {**best_match, 'confidence': best_confidence, 'match_stage': match_stage}

        # Stage 6: API Fallback (if enabled)
        if enable_api_fallback:
            logger.debug(f"No local match found, will trigger API fallback for: {scraped_artist} - {scraped_title}")
            return None  # Caller should trigger API search

        logger.debug(f"✗ No match found for: {scraped_artist} - {scraped_title} (best confidence: {best_confidence:.2f})")
        return None

    def _normalize_string(self, s: str) -> str:
        """Normalize string for comparison (lowercase, strip, remove punctuation)"""
        if not s:
            return ""

        import re
        # Lowercase and strip
        s = s.lower().strip()

        # Remove common punctuation
        s = re.sub(r'[^\w\s-]', '', s)

        # Collapse whitespace
        s = re.sub(r'\s+', ' ', s)

        return s

    def _calculate_fuzzy_similarity(
        self,
        artist1: str, title1: str,
        artist2: str, title2: str
    ) -> float:
        """Calculate basic fuzzy similarity using SequenceMatcher"""
        artist_sim = SequenceMatcher(None, artist1, artist2).ratio()
        title_sim = SequenceMatcher(None, title1, title2).ratio()

        # Weighted: artist 60%, title 40%
        return (artist_sim * 0.6) + (title_sim * 0.4)

    def _calculate_token_set_similarity(
        self,
        artist1: str, title1: str,
        artist2: str, title2: str
    ) -> float:
        """
        Token Set Ratio - handles word reordering.

        Example: "Artist A & Artist B - Title" matches "Artist B & Artist A - Title"
        """
        if not FUZZYWUZZY_AVAILABLE:
            return 0.0

        # Combine artist and title for full comparison
        string1 = f"{artist1} {title1}"
        string2 = f"{artist2} {title2}"

        # FuzzyWuzzy token_set_ratio compares sets of words
        score = fuzz.token_set_ratio(string1, string2) / 100.0
        return score

    def _calculate_jaro_winkler_similarity(
        self,
        artist1: str, title1: str,
        artist2: str, title2: str
    ) -> float:
        """
        Jaro-Winkler similarity - bonus for matching prefixes.

        Best for: Names where the beginning is correct but end differs
        Example: "John Smith" vs "John Smithe"
        """
        if not JELLYFISH_AVAILABLE:
            return 0.0

        artist_sim = jellyfish.jaro_winkler_similarity(artist1, artist2)
        title_sim = jellyfish.jaro_winkler_similarity(title1, title2)

        # Weighted: artist 60%, title 40%
        return (artist_sim * 0.6) + (title_sim * 0.4)

    def _calculate_levenshtein_similarity(
        self,
        artist1: str, title1: str,
        artist2: str, title2: str
    ) -> float:
        """
        Levenshtein distance converted to similarity score.

        Measures minimum single-character edits (insert, delete, substitute).
        Best for: Simple typos
        """
        if not JELLYFISH_AVAILABLE:
            return 0.0

        # Calculate Levenshtein distance
        artist_dist = jellyfish.levenshtein_distance(artist1, artist2)
        title_dist = jellyfish.levenshtein_distance(title1, title2)

        # Convert to similarity (0-1)
        max_artist_len = max(len(artist1), len(artist2))
        max_title_len = max(len(title1), len(title2))

        artist_sim = 1.0 - (artist_dist / max_artist_len) if max_artist_len > 0 else 0.0
        title_sim = 1.0 - (title_dist / max_title_len) if max_title_len > 0 else 0.0

        # Weighted: artist 60%, title 40%
        return (artist_sim * 0.6) + (title_sim * 0.4)


class FuzzyArtistMatcher:
    """
    Fuzzy matcher specifically for artist names.

    Handles:
    - Different spellings (DJ Snake vs. DJ-Snake)
    - Features/collaborations (Artist A feat. Artist B)
    - Aliases and stage names
    """

    def __init__(self):
        self.min_confidence = 0.85

    def match_artist(
        self,
        scraped_name: str,
        db_candidates: List[Dict]
    ) -> Optional[Dict]:
        """Match scraped artist name against database candidates"""
        if not db_candidates:
            return None

        scraped_norm = self._normalize_artist_name(scraped_name)

        best_match = None
        best_score = 0.0

        for candidate in db_candidates:
            candidate_norm = self._normalize_artist_name(candidate.get('name', ''))

            # Check main name
            score = self._calculate_artist_similarity(scraped_norm, candidate_norm)

            # Check aliases
            aliases = candidate.get('aliases', [])
            for alias in aliases:
                alias_norm = self._normalize_artist_name(alias)
                alias_score = self._calculate_artist_similarity(scraped_norm, alias_norm)
                score = max(score, alias_score)

            if score > best_score:
                best_score = score
                best_match = candidate

        if best_match and best_score >= self.min_confidence:
            return {**best_match, 'confidence': best_score}

        return None

    def _normalize_artist_name(self, name: str) -> str:
        """Normalize artist name for comparison"""
        if not name:
            return ""

        import re
        name = name.lower().strip()

        # Standardize separators
        name = re.sub(r'\s*&\s*', ' and ', name)
        name = re.sub(r'\s*feat\.?\s*', ' featuring ', name)
        name = re.sub(r'\s*ft\.?\s*', ' featuring ', name)
        name = re.sub(r'\s*vs\.?\s*', ' versus ', name)

        # Remove punctuation except spaces
        name = re.sub(r'[^\w\s]', '', name)

        # Collapse whitespace
        name = re.sub(r'\s+', ' ', name)

        return name

    def _calculate_artist_similarity(self, name1: str, name2: str) -> float:
        """Calculate artist name similarity"""
        # Try exact match first
        if name1 == name2:
            return 1.0

        # Use SequenceMatcher for basic similarity
        basic_sim = SequenceMatcher(None, name1, name2).ratio()

        # Use token-based matching if available
        if FUZZYWUZZY_AVAILABLE:
            token_sim = fuzz.token_set_ratio(name1, name2) / 100.0
            return max(basic_sim, token_sim)

        return basic_sim


# Convenience functions for pipeline integration
def match_track(scraped_artist: str, scraped_title: str, db_candidates: List[Dict]) -> Optional[Dict]:
    """Quick track matching function"""
    matcher = FuzzyTrackMatcher()
    return matcher.match_track(scraped_artist, scraped_title, db_candidates)


def match_artist(scraped_name: str, db_candidates: List[Dict]) -> Optional[Dict]:
    """Quick artist matching function"""
    matcher = FuzzyArtistMatcher()
    return matcher.match_artist(scraped_name, db_candidates)
