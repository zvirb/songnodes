"""
Validation Pipeline for SongNodes Scrapers (Priority 100)

Validates all items using Pydantic models before enrichment and persistence.
Implements Scrapy Specification Section VI.1: Separation of Concerns

Responsibilities:
- Holistic item validation using Pydantic models
- Required field checks
- Data type validation
- Business logic rules (BPM range, price > 0, etc.)
- Raise DropItem for invalid items
- Comprehensive logging and statistics

Usage:
    ITEM_PIPELINES = {
        'pipelines.validation_pipeline.ValidationPipeline': 100,
    }
"""
import logging
from typing import Dict, Any
from scrapy import Spider
from scrapy.exceptions import DropItem
from pydantic import ValidationError

# Import Pydantic validation functions
try:
    from pydantic_adapter import (
        validate_artist_item,
        validate_track_item,
        validate_setlist_item,
        validate_track_adjacency_item,
        validate_track_artist_item,
        validate_items_batch
    )
    PYDANTIC_AVAILABLE = True
except ImportError as e:
    PYDANTIC_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.error(f"❌ Pydantic validation not available: {e}")
    logger.error("ValidationPipeline requires pydantic_adapter.py to function properly")

logger = logging.getLogger(__name__)


class ValidationPipeline:
    """
    Pipeline that validates items using Pydantic models (Priority 100).

    Validates:
    - Artists: No generic names, valid ISO country codes, popularity 0-100
    - Tracks: Valid track_id format, BPM 60-200, no generic names, energy/danceability 0-1
    - Setlists: No generic names, valid date formats, valid sources
    - Track Adjacencies: Valid track names, distance >= 1, no self-adjacency
    - Track-Artist Relationships: Valid roles, no generic names

    Drops invalid items and logs detailed validation errors.
    """

    def __init__(self):
        """Initialize validation pipeline with statistics tracking."""
        self.stats = {
            'total_items': 0,
            'valid_items': 0,
            'invalid_items': 0,
            'items_by_type': {},
            'validation_errors': []
        }

        # Check if Pydantic is available
        if not PYDANTIC_AVAILABLE:
            logger.error("❌ ValidationPipeline cannot function without pydantic_adapter")
            logger.error("   Please ensure pydantic_adapter.py and pydantic_models.py are available")
        else:
            logger.info("✅ ValidationPipeline initialized with Pydantic validation")

    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings."""
        pipeline = cls()
        return pipeline

    def process_item(self, item: Dict[str, Any], spider: Spider) -> Dict[str, Any]:
        """
        Validate item using Pydantic models.

        Args:
            item: Scrapy item to validate
            spider: Spider instance

        Returns:
            Validated item

        Raises:
            DropItem: If validation fails
        """
        self.stats['total_items'] += 1

        # Check if Pydantic is available
        if not PYDANTIC_AVAILABLE:
            logger.warning("⚠️ Pydantic validation unavailable - passing item through without validation")
            return item

        # Determine item type
        item_type = self._determine_item_type(item)

        # Track items by type
        if item_type not in self.stats['items_by_type']:
            self.stats['items_by_type'][item_type] = {'total': 0, 'valid': 0, 'invalid': 0}
        self.stats['items_by_type'][item_type]['total'] += 1

        # Get data source from spider or item
        data_source = item.get('data_source') or item.get('source') or getattr(spider, 'name', 'unknown')

        try:
            # Validate based on item type
            if item_type == 'artist':
                self._validate_artist(item, data_source)
            elif item_type == 'track':
                self._validate_track(item, data_source)
            elif item_type == 'playlist' or item_type == 'setlist':
                self._validate_setlist(item, data_source)
            elif item_type == 'track_adjacency':
                self._validate_adjacency(item, data_source)
            elif item_type == 'track_artist' or item_type == 'playlist_track':
                self._validate_track_artist(item, data_source)
            else:
                # Unknown item type - log warning but pass through
                logger.warning(f"⚠️ Unknown item type '{item_type}' - skipping validation")
                return item

            # Validation succeeded
            self.stats['valid_items'] += 1
            self.stats['items_by_type'][item_type]['valid'] += 1

            logger.debug(f"✓ Validated {item_type}: {self._get_item_identifier(item, item_type)}")
            return item

        except ValidationError as e:
            # Validation failed - drop item
            self.stats['invalid_items'] += 1
            self.stats['items_by_type'][item_type]['invalid'] += 1

            error_msg = f"{item_type} validation failed: {self._get_item_identifier(item, item_type)}"
            self.stats['validation_errors'].append(f"{error_msg} - {str(e)}")

            logger.warning(f"❌ {error_msg}")
            logger.debug(f"   Validation errors: {e}")

            raise DropItem(f"Invalid {item_type}: {e}")

        except Exception as e:
            # Unexpected error - drop item
            self.stats['invalid_items'] += 1
            self.stats['items_by_type'][item_type]['invalid'] += 1

            error_msg = f"Validation error for {item_type}: {e}"
            self.stats['validation_errors'].append(error_msg)

            logger.error(f"❌ {error_msg}")
            raise DropItem(f"Validation error: {e}")

    def _determine_item_type(self, item: Dict[str, Any]) -> str:
        """
        Determine item type from item data.

        Args:
            item: Scrapy item

        Returns:
            Item type string
        """
        # Check explicit item_type field
        if 'item_type' in item:
            return item['item_type']

        # Infer from item class name
        if hasattr(item, '__class__'):
            class_name = item.__class__.__name__.lower()
            if 'artist' in class_name and 'track' not in class_name:
                return 'artist'
            # Check for setlist-track relationship items BEFORE generic setlist check
            elif ('setlist' in class_name and 'track' in class_name) or 'setlisttrack' in class_name:
                return 'playlist_track'
            # CRITICAL FIX: Explicit PlaylistItem detection for bronze_playlists routing
            elif 'playlistitem' in class_name:
                logger.info(f"✓ Detected playlist from PlaylistItem class: {class_name}")
                return 'playlist'
            elif 'track' in class_name and 'adjacency' not in class_name and 'artist' not in class_name:
                return 'track'
            # Check for EnhancedSetlistItem (legacy format) - also routes to playlist processing
            elif 'setlist' in class_name or 'enhancedsetlist' in class_name:
                logger.debug(f"Detected setlist from class name: {class_name}")
                return 'setlist'
            elif 'adjacency' in class_name:
                return 'track_adjacency'
            elif 'trackartist' in class_name:
                return 'track_artist'

        # Infer from item fields
        if 'artist_name' in item and 'track_name' not in item and 'setlist_name' not in item and 'name' not in item:
            return 'artist'
        elif 'track_name' in item or 'title' in item:
            if 'track1_name' in item or 'track2_name' in item:
                return 'track_adjacency'
            elif 'artist_role' in item:
                return 'track_artist'
            # Check for setlist-track relationship (has both setlist and track fields)
            elif 'setlist_name' in item and 'track_order' in item:
                return 'playlist_track'
            else:
                return 'track'
        # CRITICAL FIX: Explicit PlaylistItem field detection
        # PlaylistItem has 'name' + 'source' + ('dj_name' or 'total_tracks' or 'tracklist_count')
        elif 'name' in item and 'source' in item and ('total_tracks' in item or 'tracklist_count' in item or 'dj_name' in item):
            logger.info(f"✓ Detected playlist from fields: name + source + total_tracks/dj_name")
            return 'playlist'
        # EnhancedSetlistItem detection (legacy format with setlist_name or dj_artist_name)
        elif 'setlist_name' in item or ('name' in item and 'dj_artist_name' in item):
            logger.debug(f"Detected setlist from fields: setlist_name or name+dj_artist_name")
            return 'setlist'
        elif 'playlist_name' in item and 'position' in item:
            return 'playlist_track'

        return 'unknown'

    def _get_item_identifier(self, item: Dict[str, Any], item_type: str) -> str:
        """
        Get human-readable identifier for item.

        Args:
            item: Scrapy item
            item_type: Item type string

        Returns:
            Identifier string
        """
        if item_type == 'artist':
            return item.get('artist_name', 'unknown')
        elif item_type == 'track':
            track_name = item.get('track_name') or item.get('title', 'unknown')
            artist_name = item.get('artist_name', '')
            return f"{track_name} - {artist_name}" if artist_name else track_name
        elif item_type == 'setlist' or item_type == 'playlist':
            return item.get('setlist_name') or item.get('name', 'unknown')
        elif item_type == 'track_adjacency':
            track1 = item.get('track1_name', 'unknown')
            track2 = item.get('track2_name', 'unknown')
            return f"{track1} → {track2}"
        elif item_type == 'track_artist':
            return f"{item.get('track_name', 'unknown')} - {item.get('artist_name', 'unknown')}"
        else:
            return 'unknown'

    def _validate_artist(self, item: Dict[str, Any], data_source: str):
        """
        Validate artist item using Pydantic.

        Args:
            item: Artist item
            data_source: Data source name

        Raises:
            ValidationError: If validation fails
        """
        validate_artist_item(item, data_source=data_source)

    def _validate_track(self, item: Dict[str, Any], data_source: str):
        """
        Validate track item using Pydantic.

        Args:
            item: Track item
            data_source: Data source name

        Raises:
            ValidationError: If validation fails
        """
        validate_track_item(item, data_source=data_source)

    def _validate_setlist(self, item: Dict[str, Any], data_source: str):
        """
        Validate setlist/playlist item using Pydantic.

        Args:
            item: Setlist item
            data_source: Data source name

        Raises:
            ValidationError: If validation fails
        """
        validate_setlist_item(item, data_source=data_source)

    def _validate_adjacency(self, item: Dict[str, Any], data_source: str):
        """
        Validate track adjacency item using Pydantic.

        Args:
            item: Track adjacency item
            data_source: Data source name

        Raises:
            ValidationError: If validation fails
        """
        validate_track_adjacency_item(item, data_source=data_source)

    def _validate_track_artist(self, item: Dict[str, Any], data_source: str):
        """
        Validate track-artist relationship item using Pydantic.

        Args:
            item: Track-artist item
            data_source: Data source name

        Raises:
            ValidationError: If validation fails
        """
        # For playlist_track items, validate minimal fields
        # Handle both playlist_name+position and setlist_name+track_order
        if ('position' in item and 'playlist_name' in item) or ('track_order' in item and 'setlist_name' in item):
            # Minimal validation for playlist tracks
            if not item.get('track_name') and not item.get('title'):
                raise ValidationError("playlist_track requires track_name or title")
            position_value = item.get('position') or item.get('track_order', -1)
            if position_value < 0:
                raise ValidationError("position/track_order must be >= 0")
        else:
            # Full track-artist relationship validation
            validate_track_artist_item(item, data_source=data_source)

    def close_spider(self, spider: Spider):
        """
        Log validation statistics when spider closes.

        Args:
            spider: Spider instance
        """
        logger.info("=" * 80)
        logger.info("VALIDATION PIPELINE STATISTICS")
        logger.info("=" * 80)
        logger.info(f"  Spider: {spider.name}")
        logger.info(f"  Total items processed: {self.stats['total_items']}")
        logger.info(f"  ✅ Valid items: {self.stats['valid_items']}")
        logger.info(f"  ❌ Invalid items dropped: {self.stats['invalid_items']}")

        # Calculate validation rate
        if self.stats['total_items'] > 0:
            validation_rate = (self.stats['valid_items'] / self.stats['total_items']) * 100
            logger.info(f"  📈 Validation success rate: {validation_rate:.2f}%")

        # Log statistics by item type
        if self.stats['items_by_type']:
            logger.info("")
            logger.info("  Items by type:")
            for item_type, type_stats in self.stats['items_by_type'].items():
                logger.info(f"    {item_type}:")
                logger.info(f"      Total: {type_stats['total']}")
                logger.info(f"      Valid: {type_stats['valid']}")
                logger.info(f"      Invalid: {type_stats['invalid']}")
                if type_stats['total'] > 0:
                    type_rate = (type_stats['valid'] / type_stats['total']) * 100
                    logger.info(f"      Success rate: {type_rate:.2f}%")

        # Log sample validation errors (first 10)
        if self.stats['validation_errors']:
            logger.info("")
            logger.info(f"  ⚠️ Sample validation errors (showing first 10 of {len(self.stats['validation_errors'])}):")
            for i, error in enumerate(self.stats['validation_errors'][:10], 1):
                logger.info(f"    {i}. {error}")

        logger.info("=" * 80)
