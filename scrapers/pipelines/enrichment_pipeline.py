"""
Enrichment Pipeline for SongNodes Scrapers (Priority 200)

Enriches validated items with additional data and transformations.
Implements Scrapy Specification Section VI.1: Separation of Concerns

Responsibilities:
- Remix/version/label parsing from track titles (2025 enhancement)
- NLP fallback for low-quality extractions (moved from nlp_fallback_pipeline.py)
- Fuzzy matching for genre normalization
- Add timestamps (created_at, updated_at)
- Derive fields from existing data
- External data augmentation
- Text normalization

Usage:
    ITEM_PIPELINES = {
        'pipelines.validation_pipeline.ValidationPipeline': 100,
        'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,
    }
"""
import logging
import os
import re
from typing import Dict, Any, Optional, List
from datetime import datetime
from scrapy import Spider

# Import remix parser (2025 Best Practice)
try:
    from utils.remix_parser import TrackTitleParser
    REMIX_PARSER_AVAILABLE = True
except ImportError:
    REMIX_PARSER_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("⚠️ Remix parser not available - remix extraction disabled")

# RapidFuzz for genre normalization (2025 Best Practice)
try:
    from rapidfuzz import fuzz, process
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("⚠️ RapidFuzz not available - genre normalization disabled")

logger = logging.getLogger(__name__)


# Genre taxonomy for fuzzy matching
STANDARD_GENRES = [
    # Electronic
    'Techno', 'House', 'Deep House', 'Tech House', 'Progressive House', 'Trance',
    'Drum and Bass', 'Dubstep', 'Garage', 'Hardstyle', 'Hardcore', 'Ambient',
    'Downtempo', 'Electronica', 'IDM', 'Breakbeat', 'Jungle', 'UK Garage',
    'Future Bass', 'Bass House', 'Melodic Techno', 'Minimal Techno',
    # Hip-Hop / Rap
    'Hip-Hop', 'Rap', 'Trap', 'Drill', 'Grime', 'R&B',
    # Rock / Metal
    'Rock', 'Alternative Rock', 'Indie Rock', 'Hard Rock', 'Metal', 'Heavy Metal',
    'Death Metal', 'Black Metal', 'Punk', 'Punk Rock', 'Post-Punk', 'Grunge',
    # Pop
    'Pop', 'Synth-Pop', 'Dream Pop', 'Indie Pop', 'K-Pop', 'J-Pop',
    # Jazz / Soul / Funk
    'Jazz', 'Soul', 'Funk', 'Disco', 'Blues', 'Gospel',
    # World / Folk
    'Reggae', 'Dancehall', 'Latin', 'Salsa', 'Reggaeton', 'Afrobeat',
    'World Music', 'Folk', 'Country', 'Bluegrass',
    # Classical
    'Classical', 'Opera', 'Symphony', 'Chamber Music',
]


class EnrichmentPipeline:
    """
    Pipeline that enriches validated items (Priority 200).

    Enrichment operations:
    - NLP fallback for low-quality extractions
    - Fuzzy genre normalization
    - Timestamp addition
    - Text normalization (titles, names)
    - Field derivation (normalized_name, duration_seconds)
    - BPM range calculation for setlists
    """

    def __init__(self):
        """Initialize enrichment pipeline."""
        # Remix parser configuration (2025 Best Practice)
        self.enable_remix_parser = REMIX_PARSER_AVAILABLE
        if self.enable_remix_parser:
            self.remix_parser = TrackTitleParser()

        # NLP Fallback configuration (moved from nlp_fallback_pipeline.py)
        self.enable_nlp_fallback = os.getenv('ENABLE_NLP_FALLBACK', 'true').lower() in ('true', '1', 'yes')
        self.min_track_threshold = int(os.getenv('NLP_MIN_TRACK_THRESHOLD', '3'))
        self.nlp_processor_url = os.getenv('NLP_PROCESSOR_URL', 'http://nlp-processor:8021')

        # Fuzzy matching configuration (2025 Best Practices)
        self.enable_fuzzy_genres = RAPIDFUZZ_AVAILABLE
        # Multi-tier thresholds based on 2025 research:
        # - High confidence: 90+ (exact match with minor variations)
        # - Medium confidence: 80-89 (probable match)
        # - Low confidence: 70-79 (possible match, needs review)
        self.fuzzy_high_threshold = 90
        self.fuzzy_medium_threshold = 80
        self.fuzzy_low_threshold = 70

        # Statistics
        self.stats = {
            'total_items': 0,
            'nlp_enriched': 0,
            'genre_normalized': 0,
            'timestamp_added': 0,
            'text_normalized': 0,
            'remix_parsed': 0,
        }

        if self.enable_remix_parser:
            logger.info("✅ EnrichmentPipeline initialized with Remix Parser enabled")
        if self.enable_nlp_fallback:
            logger.info("✅ EnrichmentPipeline initialized with NLP fallback enabled")
        if self.enable_fuzzy_genres:
            logger.info(
                "✅ EnrichmentPipeline initialized with RapidFuzz genre normalization "
                f"(thresholds: high={self.fuzzy_high_threshold}, "
                f"medium={self.fuzzy_medium_threshold}, low={self.fuzzy_low_threshold})"
            )

    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings."""
        pipeline = cls()
        return pipeline

    def process_item(self, item: Dict[str, Any], spider: Spider) -> Dict[str, Any]:
        """
        Enrich validated item with additional data.

        Args:
            item: Validated Scrapy item
            spider: Spider instance

        Returns:
            Enriched item
        """
        self.stats['total_items'] += 1

        # Apply enrichment operations
        item = self._add_timestamps(item)
        item = self._normalize_text_fields(item)
        item = self._parse_remix_info(item)  # NEW: Parse remix/version/label info
        item = self._normalize_genre(item)
        item = self._derive_fields(item)

        # NLP fallback enrichment (if needed)
        if self.enable_nlp_fallback:
            item = self._enrich_with_nlp_if_needed(item, spider)

        return item

    def _add_timestamps(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add created_at and updated_at timestamps if not present.

        Args:
            item: Item to enrich

        Returns:
            Item with timestamps
        """
        now = datetime.utcnow()

        # Safely add timestamps - Scrapy Items have fixed schemas, so use try/except
        try:
            if 'created_at' not in item or item.get('created_at') is None:
                item['created_at'] = now
                self.stats['timestamp_added'] += 1
        except KeyError:
            pass  # Item doesn't support this field

        try:
            if 'updated_at' not in item or item.get('updated_at') is None:
                item['updated_at'] = now
        except KeyError:
            pass  # Item doesn't support this field

        try:
            # Also add scrape_timestamp if not present
            if 'scrape_timestamp' not in item or item.get('scrape_timestamp') is None:
                item['scrape_timestamp'] = now
        except KeyError:
            pass  # Item doesn't support this field

        return item

    def _normalize_text_fields(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize text fields (titles, names).

        Operations:
        - Strip whitespace
        - Remove excessive spaces
        - Generate normalized_name/normalized_title fields
        - Clean special characters

        Args:
            item: Item to normalize

        Returns:
            Item with normalized text
        """
        text_fields = ['artist_name', 'track_name', 'title', 'setlist_name', 'name', 'dj_artist_name']

        for field in text_fields:
            if field in item and item[field]:
                # Strip and clean whitespace
                original = item[field]
                normalized = re.sub(r'\s+', ' ', str(original).strip())
                item[field] = normalized

                # Generate normalized version - wrapped in try/except for Scrapy Items
                try:
                    if field == 'artist_name' and 'normalized_name' not in item:
                        item['normalized_name'] = normalized.lower()
                        self.stats['text_normalized'] += 1
                    elif field == 'track_name' and 'normalized_title' not in item:
                        item['normalized_title'] = normalized.lower()
                        self.stats['text_normalized'] += 1
                    elif field == 'title' and 'normalized_title' not in item:
                        item['normalized_title'] = normalized.lower()
                        self.stats['text_normalized'] += 1
                    elif field == 'setlist_name' and 'normalized_name' not in item:
                        item['normalized_name'] = normalized.lower()
                        self.stats['text_normalized'] += 1
                    elif field == 'name' and 'normalized_name' not in item and 'setlist_name' not in item:
                        item['normalized_name'] = normalized.lower()
                        self.stats['text_normalized'] += 1
                except KeyError:
                    # Item doesn't support normalized fields (e.g., EnhancedTrackArtistItem)
                    pass

        return item

    def _parse_remix_info(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse remix/version/label information from track titles (2025 Best Practice).

        Extracts:
        - Remix artist name
        - Remix type (Extended, Radio, Club, VIP, Edit, etc.)
        - Record label
        - Clean title (without remix/label info)
        - is_remix, is_mashup, is_live, is_cover flags

        Args:
            item: Item to parse

        Returns:
            Item with remix information populated
        """
        if not self.enable_remix_parser:
            return item

        # Get track title from various possible fields
        title = item.get('track_name') or item.get('title') or item.get('name')

        if not title or not isinstance(title, str):
            return item

        try:
            # Parse the title
            parsed = self.remix_parser.parse(title)

            # Update item with parsed information
            # Only update fields that exist in the item schema (wrapped in try/except for Scrapy Items)
            try:
                # Update clean title if different
                if parsed['clean_title'] != title:
                    item['track_name'] = parsed['clean_title']
                    item['title'] = parsed['clean_title']
            except KeyError:
                pass

            # Update remix flags
            try:
                if parsed['is_remix']:
                    item['is_remix'] = True
                    if parsed['remix_type']:
                        item['remix_type'] = str(parsed['remix_type'].value) if hasattr(parsed['remix_type'], 'value') else str(parsed['remix_type'])
                    if parsed['remixer']:
                        item['remixer'] = parsed['remixer']
                    self.stats['remix_parsed'] += 1
                    logger.debug(f"Remix parsed: '{title}' → remixer='{parsed['remixer']}', type='{parsed['remix_type']}'")
            except KeyError:
                pass

            # Update other flags
            try:
                if parsed['is_mashup']:
                    item['is_mashup'] = True
                if parsed['is_live']:
                    item['is_live'] = True
                if parsed['is_cover']:
                    item['is_cover'] = True
            except KeyError:
                pass

            # Update label information
            try:
                if parsed['label']:
                    item['record_label'] = parsed['label']
            except KeyError:
                pass

        except Exception as e:
            logger.warning(f"Error parsing remix info from '{title}': {e}")

        return item

    def _normalize_genre(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize genre using multi-tier fuzzy matching (2025 Best Practices).

        Uses RapidFuzz with token_sort_ratio for word-order independence.
        Implements confidence tiers:
        - High (90+): Exact match with minor variations → auto-apply
        - Medium (80-89): Probable match → apply with confidence flag
        - Low (70-79): Possible match → store as suggestion only

        Args:
            item: Item to normalize

        Returns:
            Item with normalized genre and confidence metadata
        """
        if not self.enable_fuzzy_genres:
            return item

        genre = item.get('genre')
        if not genre or not isinstance(genre, str):
            return item

        # Find best match in standard genres using token_sort_ratio
        # (handles word reordering: "House Deep" matches "Deep House")
        best_match, score, _ = process.extractOne(
            genre,
            STANDARD_GENRES,
            scorer=fuzz.token_sort_ratio
        )

        # Multi-tier matching logic (2025 Best Practice)
        if score >= self.fuzzy_high_threshold:
            # High confidence - auto-apply
            if genre.lower() != best_match.lower():
                item['original_genre'] = genre
                item['genre'] = best_match
                item['genre_confidence'] = 'high'
                item['genre_match_score'] = score
                self.stats['genre_normalized'] += 1
                logger.debug(
                    f"Genre normalized (HIGH): '{genre}' → '{best_match}' (score: {score})"
                )
        elif score >= self.fuzzy_medium_threshold:
            # Medium confidence - apply with flag
            item['original_genre'] = genre
            item['genre'] = best_match
            item['genre_confidence'] = 'medium'
            item['genre_match_score'] = score
            self.stats['genre_normalized'] += 1
            logger.debug(
                f"Genre normalized (MEDIUM): '{genre}' → '{best_match}' (score: {score})"
            )
        elif score >= self.fuzzy_low_threshold:
            # Low confidence - store as suggestion only
            item['genre_suggestion'] = best_match
            item['genre_suggestion_score'] = score
            item['genre_confidence'] = 'low'
            logger.debug(
                f"Genre suggestion (LOW): '{genre}' → suggested: '{best_match}' (score: {score})"
            )

        return item

    def _derive_fields(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Derive fields from existing data.

        Derivations:
        - duration_seconds from duration_ms
        - bpm_range for setlists from track BPMs

        NOTE: Remix/mashup/live detection is now handled by _parse_remix_info()
        which uses the sophisticated TrackTitleParser (2025 Best Practice).

        Args:
            item: Item to derive fields for

        Returns:
            Item with derived fields
        """
        # Duration conversion
        if 'duration_ms' in item and item['duration_ms'] and 'duration_seconds' not in item:
            item['duration_seconds'] = int(item['duration_ms'] / 1000)

        # BPM range for setlists
        if 'tracks' in item and isinstance(item['tracks'], list):
            bpms = [t.get('bpm') for t in item['tracks'] if t.get('bpm') and isinstance(t.get('bpm'), (int, float))]
            if bpms:
                item['bpm_range'] = {
                    'min': min(bpms),
                    'max': max(bpms),
                    'avg': sum(bpms) / len(bpms)
                }

        return item

    def _enrich_with_nlp_if_needed(self, item: Dict[str, Any], spider: Spider) -> Dict[str, Any]:
        """
        Enrich item using NLP extraction if needed (moved from nlp_fallback_pipeline.py).

        Checks for low quality indicators:
        - Low track count (< minimum threshold)
        - Missing critical fields
        - Extraction method marked as 'failed'

        Args:
            item: Item to potentially enrich
            spider: Spider instance

        Returns:
            Enriched item (or original if enrichment not needed/failed)
        """
        # Check if item needs enrichment
        if not self._should_enrich_with_nlp(item, spider):
            return item

        # Try to enrich with NLP
        enriched_item = self._enrich_with_nlp(item, spider)

        if enriched_item:
            self.stats['nlp_enriched'] += 1
            logger.info(
                f"NLP enrichment success [{self.stats['nlp_enriched']}/{self.stats['total_items']}]: "
                f"{item.get('item_type', 'unknown')} from {spider.name}"
            )
            return enriched_item

        return item

    def _should_enrich_with_nlp(self, item: Dict[str, Any], spider: Spider) -> bool:
        """
        Determine if item should be enriched with NLP.

        Args:
            item: Scrapy item
            spider: Spider instance

        Returns:
            True if item needs NLP enrichment
        """
        item_type = item.get('item_type', '')

        # Check playlist/setlist items
        if item_type in ['playlist', 'setlist']:
            tracks = item.get('tracks', [])
            total_tracks = item.get('total_tracks', 0)

            # Enrich if track count is low
            if isinstance(tracks, list) and len(tracks) < self.min_track_threshold:
                logger.debug(f"Low track count detected: {len(tracks)} tracks")
                return True

            if total_tracks < self.min_track_threshold:
                logger.debug(f"Low total_tracks detected: {total_tracks}")
                return True

        # Check extraction method
        extraction_method = item.get('extraction_method', '')
        if extraction_method in ['failed', 'partial', 'incomplete']:
            logger.debug(f"Failed extraction method detected: {extraction_method}")
            return True

        # Check for missing critical fields
        if item_type in ['playlist', 'setlist']:
            if not item.get('name') and not item.get('setlist_name'):
                logger.debug("Missing critical fields detected")
                return True

        return False

    def _enrich_with_nlp(self, item: Dict[str, Any], spider: Spider) -> Optional[Dict[str, Any]]:
        """
        Enrich item using NLP extraction.

        Args:
            item: Original Scrapy item
            spider: Spider instance

        Returns:
            Enriched item or None if enrichment failed
        """
        try:
            source_url = item.get('source_url', '')
            if not source_url:
                logger.warning("Cannot enrich item without source_url")
                return None

            # Check if spider has NLP fallback capability
            if not hasattr(spider, 'extract_via_nlp_sync'):
                logger.debug(f"Spider {spider.name} does not support NLP fallback")
                return None

            # Get cached response if available
            if hasattr(spider, 'last_response') and spider.last_response:
                response = spider.last_response
                html = response.body.decode('utf-8') if isinstance(response.body, bytes) else str(response.body)
            else:
                # Fetch URL if no cached response
                import httpx
                import asyncio

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

                try:
                    async def fetch():
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            response = await client.get(source_url, follow_redirects=True)
                            response.raise_for_status()
                            return response.text

                    html = loop.run_until_complete(fetch())
                finally:
                    loop.close()

            # Extract tracks via NLP
            tracks = spider.extract_via_nlp_sync(html, source_url)

            if not tracks or len(tracks) < self.min_track_threshold:
                logger.debug(f"NLP extraction yielded insufficient tracks: {len(tracks) if tracks else 0}")
                return None

            # Enrich item with NLP tracks
            item['tracks'] = tracks
            item['total_tracks'] = len(tracks)
            item['extraction_method'] = 'nlp_enriched'

            logger.info(f"Successfully enriched item with {len(tracks)} NLP-extracted tracks")
            return item

        except Exception as e:
            logger.error(f"Error enriching item with NLP: {e}")
            return None

    def close_spider(self, spider: Spider):
        """
        Log enrichment statistics when spider closes.

        Args:
            spider: Spider instance
        """
        logger.info("=" * 80)
        logger.info("ENRICHMENT PIPELINE STATISTICS")
        logger.info("=" * 80)
        logger.info(f"  Spider: {spider.name}")
        logger.info(f"  Total items processed: {self.stats['total_items']}")
        logger.info(f"  🎧 Remix info parsed: {self.stats['remix_parsed']}")
        logger.info(f"  🔧 NLP enriched: {self.stats['nlp_enriched']}")
        logger.info(f"  🎵 Genres normalized: {self.stats['genre_normalized']}")
        logger.info(f"  ⏰ Timestamps added: {self.stats['timestamp_added']}")
        logger.info(f"  📝 Text normalized: {self.stats['text_normalized']}")

        # Calculate enrichment rates
        if self.stats['total_items'] > 0:
            remix_rate = (self.stats['remix_parsed'] / self.stats['total_items']) * 100
            nlp_rate = (self.stats['nlp_enriched'] / self.stats['total_items']) * 100
            logger.info(f"  📈 Remix parsing rate: {remix_rate:.2f}%")
            logger.info(f"  📈 NLP enrichment rate: {nlp_rate:.2f}%")

        logger.info("=" * 80)
