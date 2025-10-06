"""
🏷️ Label Hunter (Tier 0) - Pre-Enrichment Label Discovery

This module runs BEFORE artist resolution to find missing record labels.
The label is critical for downstream enrichment - it enables:
- Artist-label association matching (Tier 1)
- Targeted Discogs searches (Tier 2)
- Genre/subgenre inference

Primary Sources:
1. Beatport - Excellent label metadata, EDM-focused
2. Juno Download - Broad coverage, good label data
3. Traxsource - House/Techno specialist
4. Title parsing - Extract from [Label] brackets as fallback

Philosophy: Find the label FIRST, then finding the artist becomes easier.
"""

import re
import asyncio
import structlog
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup
from abbreviation_expander import get_abbreviation_expander

logger = structlog.get_logger(__name__)


@dataclass
class LabelCandidate:
    """A potential label match from external source"""
    label_name: str
    source: str  # 'beatport', 'juno', 'traxsource', 'title_parse', 'musicbrainz'
    confidence: float  # 0.0 - 1.0
    track_title_match: str  # The track title that matched
    catalog_number: Optional[str] = None
    release_name: Optional[str] = None
    url: Optional[str] = None
    search_terms: Optional[List[str]] = None  # Expanded abbreviations for downstream search


class LabelHunter:
    """
    Pre-enrichment module to discover missing record labels

    This is Tier 0 - runs before artist resolution to maximize
    the effectiveness of downstream enrichment stages.
    """

    def __init__(
        self,
        timeout: float = 15.0,
        max_results_per_source: int = 5,
        confidence_threshold: float = 0.60
    ):
        self.timeout = timeout
        self.max_results_per_source = max_results_per_source
        self.confidence_threshold = confidence_threshold

        # User agents for scraping
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        ]

    async def find_label(
        self,
        track_title: str,
        artist_name: Optional[str] = None,
        existing_label: Optional[str] = None,
        musicbrainz_client = None  # Optional MusicBrainz client
    ) -> Optional[LabelCandidate]:
        """
        Find the record label for a track using RISK-STRATIFIED ARCHITECTURE

        Search Priority (as per strategic analysis):
          Priority 1: Title parsing (free, instant, safe)
          Priority 2: MusicBrainz API (free, open-source, legally safe)
          Priority 3: Web scraping (higher risk, maintenance burden)

        Args:
            track_title: Track title to search for
            artist_name: Artist name if known (helps narrow search)
            existing_label: Skip search if label already exists
            musicbrainz_client: Optional MusicBrainz client instance

        Returns:
            LabelCandidate if found with confidence >= threshold, else None
        """
        # Skip if label already exists
        if existing_label and existing_label.strip():
            logger.debug(
                "Label already exists, skipping hunt",
                track_title=track_title,
                existing_label=existing_label
            )
            return None

        # ====================================================================
        # PRIORITY 1: TITLE PARSING (Instant, Free, Safe)
        # ====================================================================
        parsed_label = self._extract_label_from_title(track_title)
        if parsed_label:
            logger.info(
                "✅ Priority 1: Label extracted from title",
                track_title=track_title,
                label=parsed_label.label_name
            )

            # Check if label contains abbreviations and expand if needed
            label_text = parsed_label.label_name
            expander = get_abbreviation_expander()

            # Get all search variants (original + expansions + stripped)
            search_terms = await expander.get_search_variants(
                label_text,
                context="EDM record label"
            )

            if len(search_terms) > 1:
                logger.info(
                    "✅ Generated search variants for label",
                    original=label_text,
                    variants=search_terms,
                    count=len(search_terms)
                )

            # Store search terms for downstream use
            parsed_label.search_terms = search_terms
            return parsed_label

        # ====================================================================
        # PRIORITY 2: MUSICBRAINZ API (Free, Open, Legally Safe)
        # ====================================================================
        if musicbrainz_client:
            try:
                mb_label = await musicbrainz_client.get_label_for_track(
                    track_title=track_title,
                    artist_name=artist_name,
                    confidence_threshold=self.confidence_threshold
                )

                if mb_label:
                    logger.info(
                        "✅ Priority 2: Label found via MusicBrainz",
                        track_title=track_title,
                        label=mb_label
                    )
                    return LabelCandidate(
                        label_name=mb_label,
                        source='musicbrainz',
                        confidence=0.85,  # MusicBrainz is high-quality
                        track_title_match=track_title
                    )
            except Exception as e:
                logger.warning("MusicBrainz lookup failed", error=str(e))

        # ====================================================================
        # PRIORITY 3: WEB SCRAPING (Higher Risk, Maintenance Burden)
        # ====================================================================
        # IMPORTANT: Only attempt scraping as LAST RESORT
        logger.info(
            "⚠️ Priority 2 failed, falling back to web scraping (higher risk)",
            track_title=track_title
        )

        candidates = []

        # Search Beatport (best for EDM)
        # NOTE: This requires either API partnership OR scraping
        beatport_candidates = await self._search_beatport(track_title, artist_name)
        candidates.extend(beatport_candidates)

        # Search Juno Download (broader coverage)
        # NOTE: No public API - scraping only
        juno_candidates = await self._search_juno(track_title, artist_name)
        candidates.extend(juno_candidates)

        # Search Traxsource (house/techno specialist)
        # NOTE: No public API - scraping only
        traxsource_candidates = await self._search_traxsource(track_title, artist_name)
        candidates.extend(traxsource_candidates)

        # Filter by confidence threshold
        high_confidence = [c for c in candidates if c.confidence >= self.confidence_threshold]

        if not high_confidence:
            logger.warning(
                "❌ All priorities failed: No label found",
                track_title=track_title,
                candidates_found=len(candidates),
                threshold=self.confidence_threshold
            )
            return None

        # Return highest confidence match
        best_match = max(high_confidence, key=lambda c: c.confidence)

        logger.info(
            "✅ Priority 3: Label found via web scraping",
            track_title=track_title,
            label=best_match.label_name,
            source=best_match.source,
            confidence=best_match.confidence
        )

        return best_match

    def _extract_label_from_title(self, title: str) -> Optional[LabelCandidate]:
        """
        Extract label from [Label] or (Label) brackets in title

        Examples:
            "Track Name [Armada]" -> "Armada"
            "Track (Coldharbour)" -> "Coldharbour"
            "Track [Gold Music Kft.]" -> "Gold Music Kft." (abbreviation detected)
        """
        # Try square brackets first (most common)
        square_match = re.search(r'\[([^\]]+)\]', title)
        if square_match:
            label = square_match.group(1).strip()
            # Filter out common non-label brackets
            if not self._is_likely_label(label):
                return None

            return LabelCandidate(
                label_name=label,
                source='title_parse',
                confidence=0.70,  # Medium confidence - could be remix info
                track_title_match=title
            )

        # Try parentheses (less common for labels)
        paren_match = re.search(r'\(([^\)]+)\)$', title)
        if paren_match:
            label = paren_match.group(1).strip()
            if not self._is_likely_label(label):
                return None

            return LabelCandidate(
                label_name=label,
                source='title_parse',
                confidence=0.60,  # Lower confidence - often remix info
                track_title_match=title
            )

        return None

    def _is_likely_label(self, text: str) -> bool:
        """
        Filter out common non-label bracket contents

        Examples of NON-labels:
            "Original Mix", "Radio Edit", "Extended", "Clean", "feat. Artist"
            "ft. Someone" (featuring)

        Examples of LABELS (should NOT be filtered):
            "Gold Music Kft." (company suffix, not featuring)
            "XYZ Ltd." (company suffix)
        """
        text_lower = text.lower()

        # Common non-label terms
        # Use word boundaries to avoid false positives like "Kft." matching "ft."
        non_label_patterns = [
            r'\bmix\b', r'\bedit\b', r'\bversion\b', r'\bremix\b', r'\boriginal\b', r'\bradio\b',
            r'\bextended\b', r'\bclub\b', r'\bdub\b', r'\binstrumental\b', r'\bacapella\b',
            r'\bclean\b', r'\bexplicit\b', r'\bfeat\b', r'\bvs\b', r'\bmashup\b',
            # Special case: "ft." or "ft " (featuring) but NOT "kft." or other company suffixes
            r'(?<![a-z])ft\.?\s'
        ]

        return not any(re.search(pattern, text_lower) for pattern in non_label_patterns)

    async def _search_beatport(
        self,
        track_title: str,
        artist_name: Optional[str] = None
    ) -> List[LabelCandidate]:
        """
        Search Beatport for label information

        Beatport structure:
        - Search URL: https://www.beatport.com/search?q={query}
        - Track pages show: Label, Catalog #, Release date
        """
        try:
            # Build search query
            query = track_title
            if artist_name and artist_name.lower() != 'unknown':
                query = f"{artist_name} {track_title}"

            search_url = f"https://www.beatport.com/search?q={quote_plus(query)}"

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    search_url,
                    headers={'User-Agent': self.user_agents[0]},
                    follow_redirects=True
                )

                if response.status_code != 200:
                    logger.debug("Beatport search failed", status=response.status_code)
                    return []

                # Parse HTML
                soup = BeautifulSoup(response.text, 'html.parser')

                # Find track results
                # NOTE: This is a placeholder - actual selectors need to be
                # verified by inspecting Beatport's current HTML structure
                candidates = []

                # Beatport uses different selectors - need to inspect current site
                # This is a template for the pattern
                track_results = soup.select('.track-search-result')[:self.max_results_per_source]

                for result in track_results:
                    # Extract label (selector needs verification)
                    label_elem = result.select_one('.track-label')
                    if not label_elem:
                        continue

                    label_name = label_elem.text.strip()

                    # Extract track title for matching
                    title_elem = result.select_one('.track-title')
                    result_title = title_elem.text.strip() if title_elem else ''

                    # Calculate confidence based on title similarity
                    confidence = self._calculate_title_similarity(track_title, result_title)

                    candidates.append(LabelCandidate(
                        label_name=label_name,
                        source='beatport',
                        confidence=confidence * 0.95,  # Beatport is very reliable
                        track_title_match=result_title,
                        url=result.get('href')
                    ))

                logger.debug(
                    "Beatport search completed",
                    query=query,
                    results=len(candidates)
                )

                return candidates

        except httpx.TimeoutException:
            logger.warning("Beatport search timeout", query=track_title)
            return []
        except Exception as e:
            logger.error("Beatport search error", error=str(e))
            return []

    async def _search_juno(
        self,
        track_title: str,
        artist_name: Optional[str] = None
    ) -> List[LabelCandidate]:
        """
        Search Juno Download for label information

        Juno structure:
        - Search URL: https://www.junodownload.com/search/?q={query}
        - Good label metadata, broad genre coverage
        """
        try:
            query = track_title
            if artist_name and artist_name.lower() != 'unknown':
                query = f"{artist_name} {track_title}"

            search_url = f"https://www.junodownload.com/search/?q={quote_plus(query)}"

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    search_url,
                    headers={'User-Agent': self.user_agents[1]},
                    follow_redirects=True
                )

                if response.status_code != 200:
                    logger.debug("Juno search failed", status=response.status_code)
                    return []

                soup = BeautifulSoup(response.text, 'html.parser')

                # Juno selectors (need verification)
                candidates = []
                track_results = soup.select('.juno-product')[:self.max_results_per_source]

                for result in track_results:
                    label_elem = result.select_one('.juno-label')
                    if not label_elem:
                        continue

                    label_name = label_elem.text.strip()

                    title_elem = result.select_one('.juno-title')
                    result_title = title_elem.text.strip() if title_elem else ''

                    confidence = self._calculate_title_similarity(track_title, result_title)

                    candidates.append(LabelCandidate(
                        label_name=label_name,
                        source='juno',
                        confidence=confidence * 0.90,  # Juno is reliable
                        track_title_match=result_title
                    ))

                logger.debug("Juno search completed", query=query, results=len(candidates))
                return candidates

        except Exception as e:
            logger.error("Juno search error", error=str(e))
            return []

    async def _search_traxsource(
        self,
        track_title: str,
        artist_name: Optional[str] = None
    ) -> List[LabelCandidate]:
        """
        Search Traxsource for label information

        Traxsource is excellent for:
        - House music
        - Techno
        - Underground dance music
        """
        try:
            query = track_title
            if artist_name and artist_name.lower() != 'unknown':
                query = f"{artist_name} {track_title}"

            search_url = f"https://www.traxsource.com/search?term={quote_plus(query)}"

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    search_url,
                    headers={'User-Agent': self.user_agents[2]},
                    follow_redirects=True
                )

                if response.status_code != 200:
                    return []

                soup = BeautifulSoup(response.text, 'html.parser')
                candidates = []

                # Traxsource selectors (need verification)
                track_results = soup.select('.trax-item')[:self.max_results_per_source]

                for result in track_results:
                    label_elem = result.select_one('.label-name')
                    if not label_elem:
                        continue

                    label_name = label_elem.text.strip()
                    title_elem = result.select_one('.track-title')
                    result_title = title_elem.text.strip() if title_elem else ''

                    confidence = self._calculate_title_similarity(track_title, result_title)

                    candidates.append(LabelCandidate(
                        label_name=label_name,
                        source='traxsource',
                        confidence=confidence * 0.85,
                        track_title_match=result_title
                    ))

                return candidates

        except Exception as e:
            logger.error("Traxsource search error", error=str(e))
            return []

    def _calculate_title_similarity(self, title1: str, title2: str) -> float:
        """
        Calculate similarity between two track titles

        Uses multiple signals:
        - Exact match after normalization
        - Token overlap (handles remixes, versions)
        - Subsequence matching

        Returns: 0.0 - 1.0 confidence score
        """
        # Normalize
        t1 = self._normalize_title(title1)
        t2 = self._normalize_title(title2)

        # Exact match
        if t1 == t2:
            return 1.0

        # Token overlap
        tokens1 = set(t1.split())
        tokens2 = set(t2.split())

        if not tokens1 or not tokens2:
            return 0.0

        overlap = len(tokens1 & tokens2)
        total = len(tokens1 | tokens2)
        token_similarity = overlap / total

        # Bonus for main title match (first few words)
        main_title1 = ' '.join(t1.split()[:3])
        main_title2 = ' '.join(t2.split()[:3])

        if main_title1 == main_title2:
            token_similarity = min(1.0, token_similarity + 0.2)

        return token_similarity

    def _normalize_title(self, title: str) -> str:
        """Normalize title for comparison"""
        # Remove brackets and parentheses
        title = re.sub(r'\[.*?\]', '', title)
        title = re.sub(r'\(.*?\)', '', title)

        # Remove special characters
        title = re.sub(r'[^\w\s]', ' ', title)

        # Lowercase and strip
        title = title.lower().strip()

        # Remove extra whitespace
        title = re.sub(r'\s+', ' ', title)

        return title

    async def update_track_label(
        self,
        db_session,
        track_id: str,
        label_candidate: LabelCandidate
    ) -> bool:
        """
        Update track with discovered label

        Args:
            db_session: Database session
            track_id: Track UUID
            label_candidate: Label to add

        Returns:
            True if updated successfully
        """
        try:
            from sqlalchemy import text

            # Update metadata->original_data->label
            # Note: Nest jsonb_set calls since PostgreSQL doesn't allow multiple assignments to same column
            query = text("""
                UPDATE tracks
                SET
                    metadata = jsonb_set(
                        jsonb_set(
                            metadata,
                            '{original_data,label}',
                            to_jsonb(CAST(:label AS text)),
                            true
                        ),
                        '{label_hunter}',
                        jsonb_build_object(
                            'source', CAST(:source AS text),
                            'confidence', CAST(:confidence AS numeric),
                            'discovered_at', CURRENT_TIMESTAMP
                        ),
                        true
                    ),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = CAST(:track_id AS uuid)
            """)

            await db_session.execute(
                query,
                {
                    'track_id': str(track_id),
                    'label': str(label_candidate.label_name),
                    'source': str(label_candidate.source),
                    'confidence': float(label_candidate.confidence)
                }
            )
            await db_session.commit()

            logger.info(
                "✅ Label updated in database",
                track_id=track_id,
                label=label_candidate.label_name,
                source=label_candidate.source
            )

            return True

        except Exception as e:
            await db_session.rollback()
            logger.error(
                "Failed to update track label",
                error=str(e),
                track_id=track_id
            )
            return False


# ============================================================================
# BATCH PROCESSING
# ============================================================================

async def enrich_tracks_with_labels(
    db_session_factory,
    limit: int = 100,
    skip_with_labels: bool = True,
    use_musicbrainz: bool = True
) -> Dict[str, int]:
    """
    Batch process tracks to find missing labels

    This is Tier 0 - runs before artist resolution.

    Uses RISK-STRATIFIED architecture:
      Priority 1: Title parsing (instant, free)
      Priority 2: MusicBrainz API (free, open, safe)
      Priority 3: Web scraping (fallback, higher risk)

    Args:
        db_session_factory: Database session factory
        limit: Maximum tracks to process
        skip_with_labels: Skip tracks that already have labels
        use_musicbrainz: Enable MusicBrainz Priority 2 (default True)

    Returns:
        Stats dict with success/failure counts
    """
    hunter = LabelHunter()

    # Initialize MusicBrainz client if enabled
    musicbrainz_client = None
    if use_musicbrainz:
        try:
            from musicbrainz_client import create_musicbrainz_client
            musicbrainz_client = await create_musicbrainz_client()
            logger.info("✅ MusicBrainz enabled for Label Hunter")
        except Exception as e:
            logger.warning("⚠️ MusicBrainz initialization failed", error=str(e))

    stats = {
        'processed': 0,
        'labels_found': 0,
        'labels_updated': 0,
        'failed': 0,
        'skipped': 0,
        'by_source': {
            'title_parse': 0,
            'musicbrainz': 0,
            'web_scraping': 0
        }
    }

    try:
        async with db_session_factory() as session:
            from sqlalchemy import text

            # Query tracks without labels
            if skip_with_labels:
                where_clause = "AND (t.metadata->'original_data'->>'label' IS NULL OR t.metadata->'original_data'->>'label' = '')"
            else:
                where_clause = ""

            query = text(f"""
                SELECT
                    t.id,
                    t.title,
                    a.name as artist_name,
                    t.metadata->'original_data'->>'label' as existing_label
                FROM tracks t
                LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.role = 'primary'
                LEFT JOIN artists a ON ta.artist_id = a.artist_id
                WHERE t.id IS NOT NULL
                {where_clause}
                LIMIT :limit
            """)

            result = await session.execute(query, {'limit': limit})
            tracks = result.fetchall()

            logger.info(f"🏷️ Label Hunter: Processing {len(tracks)} tracks")

            for track in tracks:
                stats['processed'] += 1

                # Find label (with MusicBrainz support)
                label_candidate = await hunter.find_label(
                    track_title=track.title,
                    artist_name=track.artist_name,
                    existing_label=track.existing_label,
                    musicbrainz_client=musicbrainz_client
                )

                if label_candidate:
                    stats['labels_found'] += 1

                    # Track by source
                    if label_candidate.source == 'title_parse':
                        stats['by_source']['title_parse'] += 1
                    elif label_candidate.source == 'musicbrainz':
                        stats['by_source']['musicbrainz'] += 1
                    else:
                        stats['by_source']['web_scraping'] += 1

                    # Update database
                    async with db_session_factory() as update_session:
                        success = await hunter.update_track_label(
                            update_session,
                            track.id,
                            label_candidate
                        )

                        if success:
                            stats['labels_updated'] += 1
                        else:
                            stats['failed'] += 1
                else:
                    stats['failed'] += 1

                # Rate limiting (important for MusicBrainz 1 req/sec limit)
                await asyncio.sleep(1.1)  # Slightly over 1 second for safety

            logger.info(
                "🏷️ Label Hunter completed",
                **stats
            )

            return stats

    except Exception as e:
        logger.error("Label Hunter batch processing failed", error=str(e))
        raise
