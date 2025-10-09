"""
Pydantic Validation Adapter for Scrapy Items

Bridges Scrapy items with Pydantic models for comprehensive validation.
Validates data at the scraper output layer before it enters the database pipeline.

Usage:
    from pydantic_adapter import validate_track_item, validate_artist_item

    # In spider
    track_item = TrackItem(...)
    validated_track = validate_track_item(track_item)  # Returns Pydantic model or raises ValidationError
"""
from typing import Dict, Any, Optional
from pydantic import ValidationError
import logging

from pydantic_models import (
    ArtistCreate,
    TrackCreate,
    SetlistCreate,
    TrackArtistRelationship,
    TrackAdjacency,
    TrackSource,
    DataSource
)

logger = logging.getLogger(__name__)


# ============================================================================
# SCRAPY ITEM TO PYDANTIC CONVERSION
# ============================================================================

def scrapy_item_to_dict(item) -> Dict[str, Any]:
    """
    Convert Scrapy Item to dict, handling None values and nested structures.

    Args:
        item: Scrapy Item instance

    Returns:
        Dictionary representation of the item
    """
    if hasattr(item, '__dict__'):
        # Handle Scrapy Item
        return {key: item.get(key) for key in item.keys()}
    elif isinstance(item, dict):
        # Already a dict
        return item
    else:
        raise TypeError(f"Unsupported item type: {type(item)}")


# ============================================================================
# ARTIST VALIDATION
# ============================================================================

def validate_artist_item(item, data_source: str = None) -> ArtistCreate:
    """
    Validate artist item using Pydantic.

    Args:
        item: Scrapy ArtistItem or dict
        data_source: Override data source (optional)

    Returns:
        Validated ArtistCreate Pydantic model

    Raises:
        ValidationError: If validation fails

    Example:
        >>> artist_item = EnhancedArtistItem(artist_name="Deadmau5", ...)
        >>> validated = validate_artist_item(artist_item, data_source="1001tracklists")
    """
    try:
        data = scrapy_item_to_dict(item)

        # Set data_source if not provided
        if data_source:
            data['data_source'] = data_source
        elif 'data_source' not in data:
            data['data_source'] = DataSource.TRACKLISTS_1001  # Default

        # Create and validate Pydantic model
        validated = ArtistCreate(**data)

        logger.debug(f"✓ Artist validated: {validated.artist_name}")
        return validated

    except ValidationError as e:
        logger.error(f"❌ Artist validation failed: {e}")
        logger.error(f"   Item data: {data}")
        raise


# ============================================================================
# TRACK VALIDATION
# ============================================================================

def validate_track_item(item, data_source: str = None) -> TrackCreate:
    """
    Validate track item using Pydantic.

    Args:
        item: Scrapy TrackItem or dict
        data_source: Override data source (optional)

    Returns:
        Validated TrackCreate Pydantic model

    Raises:
        ValidationError: If validation fails

    Example:
        >>> track_item = EnhancedTrackItem(track_name="Strobe", track_id="94148be74cbc9fa5", ...)
        >>> validated = validate_track_item(track_item, data_source="mixesdb")
    """
    try:
        data = scrapy_item_to_dict(item)

        # Set data_source if not provided
        if data_source:
            data['data_source'] = data_source
        elif 'data_source' not in data:
            data['data_source'] = DataSource.TRACKLISTS_1001  # Default

        # Create and validate Pydantic model
        validated = TrackCreate(**data)

        logger.debug(f"✓ Track validated: {validated.track_name} (track_id={validated.track_id})")
        return validated

    except ValidationError as e:
        logger.error(f"❌ Track validation failed: {e}")
        logger.error(f"   Item data: {data}")
        raise


# ============================================================================
# SETLIST/PLAYLIST VALIDATION
# ============================================================================

def validate_setlist_item(item, data_source: str = None) -> SetlistCreate:
    """
    Validate setlist/playlist item using Pydantic.

    Args:
        item: Scrapy SetlistItem or dict
        data_source: Override data source (optional)

    Returns:
        Validated SetlistCreate Pydantic model

    Raises:
        ValidationError: If validation fails

    Example:
        >>> setlist_item = EnhancedSetlistItem(setlist_name="...", dj_artist_name="...", ...)
        >>> validated = validate_setlist_item(setlist_item, data_source="setlistfm")
    """
    try:
        data = scrapy_item_to_dict(item)

        # Map legacy PlaylistItem fields to Pydantic SetlistCreate fields
        if 'name' in data and 'setlist_name' not in data:
            data['setlist_name'] = data.pop('name')

        # Map dj_artist_name from legacy fields (dj_name, artist_name, curator)
        if 'dj_artist_name' not in data:
            data['dj_artist_name'] = (
                data.get('dj_name') or
                data.get('artist_name') or
                data.get('curator') or
                'Unknown Artist'  # Fallback
            )

        # Set data_source if not provided
        if data_source:
            data['data_source'] = data_source
        elif 'data_source' not in data:
            data['data_source'] = DataSource.TRACKLISTS_1001  # Default

        # Create and validate Pydantic model
        validated = SetlistCreate(**data)

        logger.debug(f"✓ Setlist validated: {validated.setlist_name}")
        return validated

    except ValidationError as e:
        logger.error(f"❌ Setlist validation failed: {e}")
        logger.error(f"   Item data: {data}")
        raise


# ============================================================================
# TRACK-ARTIST RELATIONSHIP VALIDATION
# ============================================================================

def validate_track_artist_item(item, data_source: str = None) -> TrackArtistRelationship:
    """
    Validate track-artist relationship item using Pydantic.

    Args:
        item: Scrapy TrackArtistItem or dict
        data_source: Override data source (optional)

    Returns:
        Validated TrackArtistRelationship Pydantic model

    Raises:
        ValidationError: If validation fails

    Example:
        >>> relationship = EnhancedTrackArtistItem(track_name="...", artist_name="...", artist_role="primary")
        >>> validated = validate_track_artist_item(relationship)
    """
    try:
        data = scrapy_item_to_dict(item)

        # Set data_source if not provided
        if data_source:
            data['data_source'] = data_source
        elif 'data_source' not in data:
            data['data_source'] = DataSource.TRACKLISTS_1001  # Default

        # Create and validate Pydantic model
        validated = TrackArtistRelationship(**data)

        logger.debug(f"✓ Track-artist relationship validated: {validated.track_name} - {validated.artist_name} ({validated.artist_role})")
        return validated

    except ValidationError as e:
        logger.error(f"❌ Track-artist relationship validation failed: {e}")
        logger.error(f"   Item data: {data}")
        raise


# ============================================================================
# TRACK ADJACENCY VALIDATION
# ============================================================================

def validate_track_adjacency_item(item, data_source: str = None) -> TrackAdjacency:
    """
    Validate track adjacency item using Pydantic.

    Args:
        item: Scrapy TrackAdjacencyItem or dict
        data_source: Override data source (optional)

    Returns:
        Validated TrackAdjacency Pydantic model

    Raises:
        ValidationError: If validation fails

    Example:
        >>> adjacency = EnhancedTrackAdjacencyItem(track_1_name="...", track_2_name="...", distance=1)
        >>> validated = validate_track_adjacency_item(adjacency)
    """
    try:
        data = scrapy_item_to_dict(item)

        # Set data_source if not provided
        if data_source:
            data['data_source'] = data_source
        elif 'data_source' not in data:
            data['data_source'] = DataSource.TRACKLISTS_1001  # Default

        # Create and validate Pydantic model
        validated = TrackAdjacency(**data)

        logger.debug(f"✓ Track adjacency validated: {validated.track_1_name} → {validated.track_2_name}")
        return validated

    except ValidationError as e:
        logger.error(f"❌ Track adjacency validation failed: {e}")
        logger.error(f"   Item data: {data}")
        raise


# ============================================================================
# TRACK SOURCE VALIDATION
# ============================================================================

def validate_track_source_item(item, data_source: str = None) -> TrackSource:
    """
    Validate track source item using Pydantic.

    Args:
        item: Dict with track_id, source, and other fields
        data_source: Override data source (optional)

    Returns:
        Validated TrackSource Pydantic model

    Raises:
        ValidationError: If validation fails

    Example:
        >>> source_item = {"track_id": "94148be74cbc9fa5", "source": "spotify", "source_url": "..."}
        >>> validated = validate_track_source_item(source_item)
    """
    try:
        data = scrapy_item_to_dict(item) if not isinstance(item, dict) else item

        # Set source if not provided
        if data_source and 'source' not in data:
            data['source'] = data_source

        # Create and validate Pydantic model
        validated = TrackSource(**data)

        logger.debug(f"✓ Track source validated: track_id={validated.track_id}, source={validated.source}")
        return validated

    except ValidationError as e:
        logger.error(f"❌ Track source validation failed: {e}")
        logger.error(f"   Item data: {data}")
        raise


# ============================================================================
# BATCH VALIDATION
# ============================================================================

def validate_items_batch(items: list, item_type: str, data_source: str = None) -> tuple:
    """
    Validate a batch of items, collecting both valid and invalid items.

    Args:
        items: List of Scrapy items or dicts
        item_type: Type of item ("artist", "track", "setlist", "track_artist", "adjacency")
        data_source: Override data source (optional)

    Returns:
        Tuple of (valid_items, invalid_items, error_messages)

    Example:
        >>> tracks = [track1, track2, track3]
        >>> valid, invalid, errors = validate_items_batch(tracks, "track", "mixesdb")
        >>> print(f"Validated {len(valid)}/{len(tracks)} tracks")
    """
    validators = {
        "artist": validate_artist_item,
        "track": validate_track_item,
        "setlist": validate_setlist_item,
        "track_artist": validate_track_artist_item,
        "adjacency": validate_track_adjacency_item,
        "track_source": validate_track_source_item
    }

    if item_type not in validators:
        raise ValueError(f"Unknown item_type: {item_type}. Must be one of {list(validators.keys())}")

    validator = validators[item_type]

    valid_items = []
    invalid_items = []
    error_messages = []

    for i, item in enumerate(items):
        try:
            validated = validator(item, data_source=data_source)
            valid_items.append(validated)
        except ValidationError as e:
            invalid_items.append(item)
            error_messages.append(f"Item {i}: {str(e)}")
            logger.warning(f"Skipping invalid {item_type} item {i}: {e}")

    logger.info(f"Batch validation complete: {len(valid_items)}/{len(items)} {item_type} items valid")

    return valid_items, invalid_items, error_messages


# ============================================================================
# VALIDATION PIPELINE
# ============================================================================

class ValidationPipeline:
    """
    Scrapy Pipeline that validates items using Pydantic models.

    Add to settings.py:
        ITEM_PIPELINES = {
            'pydantic_adapter.ValidationPipeline': 100,  # Run first
            'pipelines.persistence_pipeline.PersistencePipeline': 300,
        }
    """

    def __init__(self):
        self.stats = {
            'valid': 0,
            'invalid': 0,
            'errors': []
        }

    def process_item(self, item, spider):
        """Process and validate item"""
        item_type_map = {
            'EnhancedArtistItem': 'artist',
            'ArtistItem': 'artist',
            'EnhancedTrackItem': 'track',
            'TrackItem': 'track',
            'EnhancedSetlistItem': 'setlist',
            'SetlistItem': 'setlist',
            'EnhancedTrackArtistItem': 'track_artist',
            'TrackArtistItem': 'track_artist',
            'EnhancedTrackAdjacencyItem': 'adjacency',
            'TrackAdjacencyItem': 'adjacency'
        }

        item_class_name = item.__class__.__name__
        item_type = item_type_map.get(item_class_name)

        if not item_type:
            # Unknown item type, pass through without validation
            logger.warning(f"Unknown item type: {item_class_name}, skipping validation")
            return item

        try:
            # Validate item
            data_source = getattr(spider, 'name', None)
            validated = validate_items_batch([item], item_type, data_source=data_source)

            if validated[0]:  # valid_items
                self.stats['valid'] += 1
                return item
            else:
                self.stats['invalid'] += 1
                self.stats['errors'].append(validated[2][0] if validated[2] else "Unknown error")
                logger.error(f"Dropping invalid {item_type} item: {validated[2]}")
                return None  # Drop invalid items

        except Exception as e:
            self.stats['invalid'] += 1
            self.stats['errors'].append(str(e))
            logger.error(f"Validation error for {item_type}: {e}")
            return None  # Drop items that fail validation

    def close_spider(self, spider):
        """Log validation statistics when spider closes"""
        logger.info("=" * 60)
        logger.info("PYDANTIC VALIDATION STATISTICS")
        logger.info(f"  Valid items: {self.stats['valid']}")
        logger.info(f"  Invalid items dropped: {self.stats['invalid']}")
        if self.stats['errors']:
            logger.info(f"  Sample errors:")
            for error in self.stats['errors'][:5]:  # Show first 5 errors
                logger.info(f"    - {error}")
        logger.info("=" * 60)