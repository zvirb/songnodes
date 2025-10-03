"""
Label-Aware Fuzzy Matcher

Matches tracks with missing artists using label hints from title brackets.
Example: "Control [Viper]" -> Extracts "Viper" as label hint -> Searches with label context

Based on validated pattern:
- Input: Title="Control [Viper]", Artist="Unknown"
- Output: Artist="Matrix & Futurebound", Label="Viper Recordings"
"""

import re
import structlog
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from difflib import SequenceMatcher

logger = structlog.get_logger(__name__)


@dataclass
class MatchCandidate:
    """A potential match from an API search"""
    service: str  # 'spotify', 'musicbrainz', 'discogs'
    title: str
    artists: List[str]
    label: Optional[str]
    duration_ms: Optional[int]
    release_year: Optional[int]
    service_id: str  # spotify_id, musicbrainz_id, etc.
    confidence_score: float
    metadata: Dict[str, Any]  # Raw API response


class LabelAwareFuzzyMatcher:
    """
    Fuzzy matcher that uses record label hints to improve matching accuracy.

    Workflow:
    1. Extract label hint from title: "Track [Label]" -> "Label"
    2. Search APIs with label context
    3. Score candidates by label match, title similarity, year, duration
    4. Return high-confidence match (≥70%) or None
    """

    def __init__(
        self,
        spotify_client=None,
        musicbrainz_client=None,
        discogs_client=None,
        tidal_client=None
    ):
        self.spotify = spotify_client
        self.musicbrainz = musicbrainz_client
        self.discogs = discogs_client
        self.tidal = tidal_client

        # Confidence scoring weights
        self.LABEL_MATCH_WEIGHT = 40
        self.TITLE_SIMILARITY_WEIGHT = 30
        self.YEAR_MATCH_WEIGHT = 20
        self.DURATION_MATCH_WEIGHT = 10
        self.CONFIDENCE_THRESHOLD = 80  # Increased to prevent false positives
        self.MIN_LABEL_SIMILARITY = 0.5  # Require at least 50% label match

    def extract_label_hint(self, title: str) -> tuple[str, Optional[str]]:
        """
        Extract label hint from title brackets.

        Examples:
            "Control [Viper]" -> ("Control", "Viper")
            "Strobe [Mau5trap]" -> ("Strobe", "Mau5trap")
            "Regular Title" -> ("Regular Title", None)

        Returns:
            (clean_title, label_hint)
        """
        # Pattern: Match text in square brackets at end of title
        match = re.search(r'\s*\[([^\]]+)\]\s*$', title)

        if match:
            label_hint = match.group(1).strip()
            clean_title = title[:match.start()].strip()

            logger.debug(
                "Label hint extracted",
                original_title=title,
                clean_title=clean_title,
                label_hint=label_hint
            )

            return clean_title, label_hint

        return title, None

    def calculate_title_similarity(self, title1: str, title2: str) -> float:
        """
        Calculate similarity between two titles (0.0 to 1.0).

        Uses SequenceMatcher for fuzzy string matching.
        Normalizes titles by lowercasing and removing extra whitespace.
        """
        t1 = ' '.join(title1.lower().split())
        t2 = ' '.join(title2.lower().split())

        return SequenceMatcher(None, t1, t2).ratio()

    def calculate_confidence_score(
        self,
        candidate: MatchCandidate,
        scraped_title: str,
        label_hint: Optional[str],
        duration_ms: Optional[int],
        release_year: Optional[int]
    ) -> float:
        """
        Calculate confidence score for a match candidate (0-100).

        Scoring breakdown:
        - Label match (40 pts): Exact or partial match with label hint
        - Title similarity (30 pts): String similarity between titles
        - Release year (20 pts): Exact match or within 1 year
        - Duration (10 pts): Within 5% of expected duration

        Returns:
            Score from 0-100
        """
        score = 0.0

        # 1. Label matching (40 points) - CRITICAL
        label_similarity = 0.0
        if label_hint and candidate.label:
            label_lower = candidate.label.lower()
            hint_lower = label_hint.lower()

            if hint_lower in label_lower or label_lower in hint_lower:
                score += self.LABEL_MATCH_WEIGHT
                label_similarity = 1.0
                logger.debug(
                    "Label match",
                    hint=label_hint,
                    candidate_label=candidate.label,
                    points=self.LABEL_MATCH_WEIGHT
                )
            else:
                # Partial credit for similar labels
                label_similarity = SequenceMatcher(None, hint_lower, label_lower).ratio()
                partial_score = self.LABEL_MATCH_WEIGHT * label_similarity
                score += partial_score
                logger.debug(
                    "Partial label match",
                    similarity=f"{label_similarity:.1%}",
                    points=partial_score
                )

            # REJECT if label similarity is too low
            if label_similarity < self.MIN_LABEL_SIMILARITY:
                logger.warning(
                    "Label similarity below minimum threshold - rejecting",
                    similarity=f"{label_similarity:.1%}",
                    min_required=f"{self.MIN_LABEL_SIMILARITY:.1%}"
                )
                return 0.0  # Automatic rejection

        # 2. Title similarity (30 points)
        title_sim = self.calculate_title_similarity(scraped_title, candidate.title)
        title_score = self.TITLE_SIMILARITY_WEIGHT * title_sim
        score += title_score

        logger.debug(
            "Title similarity",
            scraped=scraped_title,
            candidate=candidate.title,
            similarity=f"{title_sim:.1%}",
            points=title_score
        )

        # 3. Release year matching (20 points)
        if release_year and candidate.release_year:
            year_diff = abs(release_year - candidate.release_year)
            if year_diff == 0:
                score += self.YEAR_MATCH_WEIGHT
            elif year_diff == 1:
                score += self.YEAR_MATCH_WEIGHT * 0.5  # Half credit for off-by-one

        # 4. Duration matching (10 points)
        if duration_ms and candidate.duration_ms:
            duration_diff = abs(duration_ms - candidate.duration_ms) / duration_ms
            if duration_diff <= 0.05:  # Within 5%
                score += self.DURATION_MATCH_WEIGHT
            elif duration_diff <= 0.10:  # Within 10%
                score += self.DURATION_MATCH_WEIGHT * 0.5

        return round(score, 1)

    async def match_track(
        self,
        scraped_title: str,
        scraped_artist: Optional[str] = None,
        duration_ms: Optional[int] = None,
        release_year: Optional[int] = None
    ) -> Optional[MatchCandidate]:
        """
        Find best match for a track using label-aware fuzzy matching.

        Args:
            scraped_title: Track title (may include [Label] hint)
            scraped_artist: Artist name (may be "Unknown" or None)
            duration_ms: Track duration in milliseconds
            release_year: Release year for validation

        Returns:
            MatchCandidate if confidence ≥ 70%, otherwise None
        """
        # Extract label hint from title
        clean_title, label_hint = self.extract_label_hint(scraped_title)

        if not label_hint:
            logger.info(
                "No label hint found - skipping fuzzy match",
                title=scraped_title
            )
            return None

        logger.info(
            "Starting fuzzy match with label context",
            title=clean_title,
            label_hint=label_hint
        )

        # Collect candidates from all APIs
        candidates: List[MatchCandidate] = []

        # Search Spotify
        if self.spotify:
            spotify_results = await self._search_spotify(clean_title, scraped_artist, label_hint)
            candidates.extend(spotify_results)

        # Search MusicBrainz
        if self.musicbrainz:
            mb_results = await self._search_musicbrainz(clean_title, scraped_artist, label_hint)
            candidates.extend(mb_results)

        # Search Discogs
        if self.discogs:
            discogs_results = await self._search_discogs(clean_title, scraped_artist, label_hint)
            candidates.extend(discogs_results)

        if not candidates:
            logger.warning("No candidates found from any API", title=scraped_title)
            return None

        # Score all candidates
        for candidate in candidates:
            candidate.confidence_score = self.calculate_confidence_score(
                candidate=candidate,
                scraped_title=clean_title,
                label_hint=label_hint,
                duration_ms=duration_ms,
                release_year=release_year
            )

        # Sort by confidence (highest first)
        candidates.sort(key=lambda c: c.confidence_score, reverse=True)

        best_match = candidates[0]

        logger.info(
            "Best match found",
            service=best_match.service,
            title=best_match.title,
            artists=best_match.artists,
            label=best_match.label,
            confidence=f"{best_match.confidence_score}%"
        )

        # Check confidence threshold
        if best_match.confidence_score >= self.CONFIDENCE_THRESHOLD:
            logger.info(
                "✓ High-confidence match accepted",
                confidence=f"{best_match.confidence_score}%",
                threshold=f"{self.CONFIDENCE_THRESHOLD}%"
            )
            return best_match
        else:
            logger.warning(
                "✗ Best match below threshold",
                title=scraped_title,
                best_score=f"{best_match.confidence_score}%",
                threshold=f"{self.CONFIDENCE_THRESHOLD}%"
            )
            return None

    async def _search_spotify(
        self,
        title: str,
        artist: Optional[str],
        label_hint: Optional[str]
    ) -> List[MatchCandidate]:
        """
        Search Spotify API with label context.

        Note: Spotify's search_track() returns a single best match.
        We wrap it in a list for consistent interface.
        """
        if not self.spotify:
            return []

        try:
            # Search by title (artist may be Unknown/None)
            # Spotify will use its own ranking
            result = await self.spotify.search_track(
                artist=artist or title,  # If no artist, search by title
                title=title
            )

            if not result:
                return []

            # Extract label from album metadata (if available)
            label = result.get('album', {}).get('label')

            # Parse release date for year
            release_year = None
            release_date = result.get('album', {}).get('release_date')
            if release_date:
                try:
                    release_year = int(release_date[:4])
                except (ValueError, TypeError):
                    pass

            candidate = MatchCandidate(
                service='spotify',
                title=result.get('title', ''),
                artists=[a.get('name', '') for a in result.get('artists', [])],
                label=label,
                duration_ms=result.get('duration_ms'),
                release_year=release_year,
                service_id=result.get('spotify_id', ''),
                confidence_score=0.0,  # Will be calculated later
                metadata=result
            )

            return [candidate]

        except Exception as e:
            logger.error("Spotify fuzzy search error", error=str(e), title=title)
            return []

    async def _search_musicbrainz(
        self,
        title: str,
        artist: Optional[str],
        label_hint: Optional[str]
    ) -> List[MatchCandidate]:
        """Search MusicBrainz API with label context"""
        if not self.musicbrainz:
            return []

        try:
            result = await self.musicbrainz.search_recording(
                artist=artist or title,  # If no artist, search by title
                title=title
            )

            if not result:
                return []

            # Parse release date for year
            release_year = None
            release_date = result.get('release_date')
            if release_date:
                try:
                    if isinstance(release_date, str):
                        release_year = int(release_date[:4])
                except (ValueError, TypeError):
                    pass

            # Extract artists
            artists = []
            if result.get('artists'):
                artists = [a.get('name', '') for a in result['artists']]
            elif result.get('artist'):
                artists = [result['artist']]

            candidate = MatchCandidate(
                service='musicbrainz',
                title=result.get('title', ''),
                artists=artists,
                label=result.get('label'),  # MusicBrainz includes label info
                duration_ms=result.get('duration_ms'),
                release_year=release_year,
                service_id=result.get('musicbrainz_id', ''),
                confidence_score=0.0,
                metadata=result
            )

            return [candidate]

        except Exception as e:
            logger.error("MusicBrainz fuzzy search error", error=str(e), title=title)
            return []

    async def _search_discogs(
        self,
        title: str,
        artist: Optional[str],
        label_hint: Optional[str]
    ) -> List[MatchCandidate]:
        """
        Search Discogs API with label context.

        Note: Discogs search is less reliable for fuzzy matching,
        so we give it lower priority.
        """
        # TODO: Implement Discogs search when needed
        # For now, focusing on Spotify + MusicBrainz
        return []
