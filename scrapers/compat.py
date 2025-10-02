"""
Backward Compatibility Layer for Scrapy Migration

Allows old spiders (direct item population) and new spiders (ItemLoaders)
to coexist during gradual migration.

Usage in old spiders:
    from compat import ensure_item_fields

    item = EnhancedTrackItem()
    item['track_name'] = track_name
    item = ensure_item_fields(item)  # Adds missing fields

Architecture Notes:
- Detects ItemLoader usage via _values attribute
- Automatically adds missing timestamp/system fields
- Provides middleware for automatic compatibility fixes
- Zero impact on new ItemLoader-based spiders
"""

from items import (
    EnhancedTrackItem,
    EnhancedArtistItem,
    EnhancedSetlistItem,
    EnhancedTrackArtistItem,
    EnhancedSetlistTrackItem,
    EnhancedTrackAdjacencyItem,
    EnhancedVenueItem,
)
from datetime import datetime
from typing import Any


# ============================================================================
# FIELD DEFAULT MAPPING
# ============================================================================

# Default values for required system fields that old spiders may not populate
SYSTEM_FIELD_DEFAULTS = {
    'scrape_timestamp': lambda: datetime.utcnow().isoformat(),
    'created_at': lambda: datetime.utcnow().isoformat(),
    'updated_at': lambda: datetime.utcnow().isoformat(),
}

# Item-specific defaults for optional fields
ITEM_TYPE_DEFAULTS = {
    EnhancedTrackItem: {
        'normalized_title': None,
        'is_remix': False,
        'is_mashup': False,
        'is_live': False,
        'is_cover': False,
        'is_instrumental': False,
        'is_explicit': False,
        'popularity_score': 0,
    },
    EnhancedArtistItem: {
        'normalized_name': None,
        'aliases': [],
        'genre_preferences': [],
        'is_verified': False,
        'follower_count': 0,
        'monthly_listeners': 0,
        'popularity_score': 0,
        'social_media': {},
        'external_urls': {},
    },
    EnhancedSetlistItem: {
        'normalized_name': None,
        'supporting_artists': [],
        'genre_tags': [],
        'mood_tags': [],
        'total_tracks': 0,
        'external_urls': {},
    },
    EnhancedTrackArtistItem: {
        'artist_role': 'primary',
        'position': 0,
        'is_alias': False,
    },
    EnhancedSetlistTrackItem: {
        'key_lock': False,
        'is_peak_time': False,
        'is_opener': False,
        'is_closer': False,
    },
    EnhancedTrackAdjacencyItem: {
        'transition_type': 'sequential',
        'occurrence_count': 1,
    },
    EnhancedVenueItem: {
        'normalized_name': None,
        'external_urls': {},
    },
}


# ============================================================================
# COMPATIBILITY FUNCTIONS
# ============================================================================

def ensure_item_fields(item: Any) -> Any:
    """
    Ensure item has all required fields with defaults.

    Used for backward compatibility with spiders that don't use ItemLoaders.
    This function is idempotent and safe to call multiple times.

    Args:
        item: Scrapy item instance

    Returns:
        Item with all required fields populated

    Examples:
        >>> item = EnhancedTrackItem()
        >>> item['track_name'] = 'Test Track'
        >>> item = ensure_item_fields(item)
        >>> assert 'scrape_timestamp' in item
        >>> assert 'created_at' in item
    """
    # Add system fields if missing
    for field_name, default_factory in SYSTEM_FIELD_DEFAULTS.items():
        if field_name not in item or item[field_name] is None:
            item[field_name] = default_factory()

    # Add item-specific defaults based on item type
    item_type = type(item)
    if item_type in ITEM_TYPE_DEFAULTS:
        for field_name, default_value in ITEM_TYPE_DEFAULTS[item_type].items():
            if field_name not in item or item[field_name] is None:
                # Handle mutable defaults (lists, dicts) - create new instances
                if isinstance(default_value, list):
                    item[field_name] = []
                elif isinstance(default_value, dict):
                    item[field_name] = {}
                else:
                    item[field_name] = default_value

    return item


def is_using_itemloader(item: Any) -> bool:
    """
    Detect if item was created via ItemLoader.

    We use a simple marker attribute approach: ItemLoaders in item_loaders.py
    should set item._itemloader_used = True after load_item().

    For backward compatibility, we also check for typical ItemLoader patterns:
    - Has _loader attribute (set during ItemLoader initialization)
    - Has _cached_values attribute (used by ItemLoader internally)

    Args:
        item: Scrapy item instance

    Returns:
        True if item was created via ItemLoader, False otherwise

    Examples:
        >>> from item_loaders import ItemLoader
        >>> loader = ItemLoader(item=EnhancedTrackItem())
        >>> item = loader.load_item()
        >>> item._itemloader_used = True  # Mark as ItemLoader
        >>> assert is_using_itemloader(item) == True

        >>> item = EnhancedTrackItem()
        >>> item['track_name'] = 'Test'
        >>> assert is_using_itemloader(item) == False
    """
    # Primary check: explicit marker attribute
    if hasattr(item, '_itemloader_used') and item._itemloader_used:
        return True

    # Fallback checks for ItemLoader patterns
    # Note: These are heuristics and may need adjustment
    if hasattr(item, '_loader'):
        return True

    if hasattr(item, '_cached_values'):
        return True

    # No ItemLoader detected
    return False


def get_compat_status(spider) -> dict:
    """
    Get compatibility status information for a spider.

    Useful for monitoring migration progress and identifying which
    spiders still need to be migrated to ItemLoaders.

    Args:
        spider: Scrapy spider instance

    Returns:
        Dictionary with compatibility status information

    Examples:
        >>> status = get_compat_status(my_spider)
        >>> print(f"Using ItemLoaders: {status['using_itemloader']}")
    """
    return {
        'spider_name': spider.name,
        'using_itemloader': hasattr(spider, 'uses_itemloader') and spider.uses_itemloader,
        'compat_mode': 'legacy' if not (hasattr(spider, 'uses_itemloader') and spider.uses_itemloader) else 'modern',
        'timestamp': datetime.utcnow().isoformat(),
    }


# ============================================================================
# SPIDER MIDDLEWARE
# ============================================================================

class BackwardCompatibilityMiddleware:
    """
    Spider middleware that automatically applies compatibility fixes
    to items from old spiders.

    This middleware:
    1. Detects items that were NOT created via ItemLoader
    2. Automatically applies ensure_item_fields() to add missing fields
    3. Tracks statistics on old vs new spider usage
    4. Zero impact on ItemLoader-based spiders

    Add to settings.py:
        SPIDER_MIDDLEWARES = {
            'compat.BackwardCompatibilityMiddleware': 100,
        }

    Configuration (optional):
        COMPAT_MIDDLEWARE_ENABLED = True  # Default: True
        COMPAT_MIDDLEWARE_LOG_FIXES = True  # Log when fixes are applied
        COMPAT_MIDDLEWARE_STATS = True  # Track statistics
    """

    def __init__(self, settings):
        """Initialize middleware with settings."""
        self.enabled = settings.getbool('COMPAT_MIDDLEWARE_ENABLED', True)
        self.log_fixes = settings.getbool('COMPAT_MIDDLEWARE_LOG_FIXES', True)
        self.track_stats = settings.getbool('COMPAT_MIDDLEWARE_STATS', True)

        # Statistics tracking
        self.stats = {
            'items_processed': 0,
            'items_fixed': 0,
            'itemloader_items': 0,
            'legacy_items': 0,
        }

    @classmethod
    def from_crawler(cls, crawler):
        """Create middleware from crawler."""
        return cls(crawler.settings)

    async def process_spider_output(self, response, result, spider):
        """
        Process spider output and apply compatibility fixes.

        Supports both sync and async spider output generators.

        Args:
            response: Response object
            result: Generator or async generator of items/requests from spider
            spider: Spider instance

        Yields:
            Items with compatibility fixes applied, or requests unchanged
        """
        if not self.enabled:
            # Pass through if middleware is disabled
            async for item in result:
                yield item
            return

        async for item_or_request in result:
            # Only process items (not requests)
            if self._is_supported_item(item_or_request):
                self.stats['items_processed'] += 1

                # Check if item is using ItemLoader
                if is_using_itemloader(item_or_request):
                    self.stats['itemloader_items'] += 1
                    # Modern spider - no fixes needed
                    yield item_or_request
                else:
                    self.stats['legacy_items'] += 1
                    # Old spider - apply compatibility fixes
                    fixed_item = ensure_item_fields(item_or_request)
                    self.stats['items_fixed'] += 1

                    if self.log_fixes:
                        spider.logger.debug(
                            f"Applied compatibility fixes to {type(item_or_request).__name__} "
                            f"from spider {spider.name}"
                        )

                    yield fixed_item
            else:
                # Pass through requests and non-supported items unchanged
                yield item_or_request

    def _is_supported_item(self, item) -> bool:
        """Check if item is a supported type for compatibility fixes."""
        return isinstance(item, (
            EnhancedTrackItem,
            EnhancedArtistItem,
            EnhancedSetlistItem,
            EnhancedTrackArtistItem,
            EnhancedSetlistTrackItem,
            EnhancedTrackAdjacencyItem,
            EnhancedVenueItem,
        ))

    def spider_closed(self, spider, reason):
        """Log statistics when spider closes."""
        if self.track_stats and self.stats['items_processed'] > 0:
            legacy_percentage = (
                self.stats['legacy_items'] / self.stats['items_processed'] * 100
                if self.stats['items_processed'] > 0 else 0
            )

            spider.logger.info(
                f"Compatibility Middleware Stats for {spider.name}:\n"
                f"  Total items: {self.stats['items_processed']}\n"
                f"  ItemLoader items: {self.stats['itemloader_items']}\n"
                f"  Legacy items: {self.stats['legacy_items']} ({legacy_percentage:.1f}%)\n"
                f"  Fixes applied: {self.stats['items_fixed']}"
            )

            # Suggest migration if spider is using legacy approach
            if legacy_percentage > 50:
                spider.logger.warning(
                    f"Spider {spider.name} is using legacy item population "
                    f"({legacy_percentage:.1f}% of items). Consider migrating to ItemLoaders."
                )


# ============================================================================
# MIGRATION UTILITIES
# ============================================================================

def check_spider_compatibility(spider) -> tuple[bool, str]:
    """
    Check if spider is compatible with ItemLoader migration.

    Args:
        spider: Spider instance

    Returns:
        Tuple of (is_compatible, message)

    Examples:
        >>> is_compat, msg = check_spider_compatibility(my_spider)
        >>> if not is_compat:
        ...     print(f"Incompatibility: {msg}")
    """
    # Check if spider has required attributes
    if not hasattr(spider, 'name'):
        return False, "Spider missing 'name' attribute"

    # Check if spider yields items
    if not hasattr(spider, 'parse'):
        return False, "Spider missing 'parse' method"

    # All checks passed
    return True, "Spider is compatible with ItemLoader migration"


def migration_report(stats: dict) -> str:
    """
    Generate a migration progress report.

    Args:
        stats: Dictionary of statistics from multiple spiders

    Returns:
        Formatted report string

    Examples:
        >>> report = migration_report({
        ...     'total_spiders': 10,
        ...     'migrated_spiders': 3,
        ...     'legacy_spiders': 7,
        ... })
        >>> print(report)
    """
    total = stats.get('total_spiders', 0)
    migrated = stats.get('migrated_spiders', 0)
    legacy = stats.get('legacy_spiders', 0)

    if total == 0:
        return "No spider data available for migration report."

    progress_percentage = (migrated / total * 100) if total > 0 else 0

    return f"""
ItemLoader Migration Progress Report
=====================================
Total Spiders: {total}
Migrated to ItemLoader: {migrated} ({progress_percentage:.1f}%)
Still Using Legacy: {legacy} ({100 - progress_percentage:.1f}%)

Status: {"✓ Migration Complete" if legacy == 0 else f"⚠ {legacy} spiders need migration"}
"""
