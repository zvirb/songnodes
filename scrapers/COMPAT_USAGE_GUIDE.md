# Backward Compatibility Layer - Usage Guide

## Overview

The backward compatibility layer (`compat.py`) ensures old spiders (using direct item population) and new spiders (using ItemLoaders) can coexist during gradual migration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Spider Output                             │
│  (Items from old or new spiders)                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│       BackwardCompatibilityMiddleware                        │
│                                                              │
│  1. Detects ItemLoader usage (has _values attribute)        │
│  2. If legacy item → apply ensure_item_fields()             │
│  3. If modern item → pass through unchanged                 │
│  4. Track statistics for migration monitoring               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│            Item Pipelines                                    │
│  (All items now have required fields)                       │
└─────────────────────────────────────────────────────────────┘
```

## Usage Patterns

### Pattern 1: Old Spider (Direct Population) - AUTOMATIC

Old spiders continue working without any changes:

```python
# spiders/old_spider.py
class OldSpider(scrapy.Spider):
    name = 'old_spider'

    def parse(self, response):
        item = EnhancedTrackItem()
        item['track_name'] = 'Test Track'
        item['data_source'] = 'old_spider'

        # NO NEED TO MANUALLY ADD scrape_timestamp, created_at, etc.
        # BackwardCompatibilityMiddleware will add them automatically

        yield item
```

**Result**: Middleware automatically adds `scrape_timestamp`, `created_at`, and other required fields.

### Pattern 2: Manual Compatibility (Optional)

If you want explicit control in the spider:

```python
# spiders/explicit_spider.py
from compat import ensure_item_fields

class ExplicitSpider(scrapy.Spider):
    name = 'explicit_spider'

    def parse(self, response):
        item = EnhancedTrackItem()
        item['track_name'] = 'Test Track'

        # Manually ensure fields are present
        item = ensure_item_fields(item)

        yield item
```

**Use case**: When you need to validate fields before yielding.

### Pattern 3: New Spider (ItemLoader) - RECOMMENDED

New spiders should use ItemLoaders (automatically detected, no fixes applied):

```python
# spiders/new_spider.py
from item_loaders import ItemLoader

class NewSpider(scrapy.Spider):
    name = 'new_spider'
    uses_itemloader = True  # Optional flag for clarity

    def parse(self, response):
        loader = ItemLoader(item=EnhancedTrackItem(), response=response)
        loader.add_value('track_name', 'Test Track')
        loader.add_value('data_source', 'new_spider')

        # ItemLoader automatically adds required fields via input/output processors
        yield loader.load_item()
```

**Result**: Middleware detects `_values` attribute and passes through unchanged.

## Configuration

### Enable/Disable Middleware

In `settings/base.py` or spider `custom_settings`:

```python
SPIDER_MIDDLEWARES = {
    'compat.BackwardCompatibilityMiddleware': 100,
}

# Configuration options
COMPAT_MIDDLEWARE_ENABLED = True  # Enable/disable middleware
COMPAT_MIDDLEWARE_LOG_FIXES = True  # Log when fixes are applied
COMPAT_MIDDLEWARE_STATS = True  # Track migration statistics
```

### Disable for Specific Spider

```python
class MySpider(scrapy.Spider):
    name = 'my_spider'

    custom_settings = {
        'COMPAT_MIDDLEWARE_ENABLED': False,  # Disable for this spider only
    }
```

## Monitoring Migration Progress

### View Spider Statistics

At spider close, middleware logs statistics:

```
[my_spider] INFO: Compatibility Middleware Stats for my_spider:
  Total items: 150
  ItemLoader items: 45
  Legacy items: 105 (70.0%)
  Fixes applied: 105
```

### Check Individual Spider

```python
from compat import get_compat_status

# In your spider or script
status = get_compat_status(spider)
print(f"Spider {status['spider_name']} mode: {status['compat_mode']}")
# Output: Spider my_spider mode: legacy
```

### Generate Migration Report

```python
from compat import migration_report

stats = {
    'total_spiders': 10,
    'migrated_spiders': 3,
    'legacy_spiders': 7,
}

print(migration_report(stats))
```

Output:
```
ItemLoader Migration Progress Report
=====================================
Total Spiders: 10
Migrated to ItemLoader: 3 (30.0%)
Still Using Legacy: 7 (70.0%)

Status: ⚠ 7 spiders need migration
```

## Field Defaults

### System Fields (Added Automatically)

```python
SYSTEM_FIELD_DEFAULTS = {
    'scrape_timestamp': datetime.utcnow().isoformat(),
    'created_at': datetime.utcnow().isoformat(),
    'updated_at': datetime.utcnow().isoformat(),
}
```

### Item-Specific Defaults

#### EnhancedTrackItem
```python
{
    'normalized_title': None,
    'is_remix': False,
    'is_mashup': False,
    'is_live': False,
    'is_cover': False,
    'is_instrumental': False,
    'is_explicit': False,
    'popularity_score': 0,
}
```

#### EnhancedArtistItem
```python
{
    'normalized_name': None,
    'aliases': [],
    'genre_preferences': [],
    'is_verified': False,
    'follower_count': 0,
    'monthly_listeners': 0,
    'popularity_score': 0,
    'social_media': {},
    'external_urls': {},
}
```

#### EnhancedSetlistItem
```python
{
    'normalized_name': None,
    'supporting_artists': [],
    'genre_tags': [],
    'mood_tags': [],
    'total_tracks': 0,
    'external_urls': {},
}
```

## Testing

### Run Compatibility Tests

```bash
cd /mnt/my_external_drive/programming/songnodes/scrapers
pytest test_compat.py -v
```

### Test Your Spider

```python
# Test that middleware fixes your items
from compat import ensure_item_fields, is_using_itemloader

# Create item like your spider does
item = EnhancedTrackItem()
item['track_name'] = 'Test Track'

# Check if it needs fixes
print(f"Using ItemLoader: {is_using_itemloader(item)}")  # False

# Apply fixes
fixed_item = ensure_item_fields(item)
print(f"Has scrape_timestamp: {'scrape_timestamp' in fixed_item}")  # True
```

## Migration Checklist

When migrating a spider from legacy to ItemLoader:

- [ ] **Step 1**: Verify spider works with current compatibility layer
  ```bash
  scrapy crawl my_spider -s LOG_LEVEL=INFO
  # Check for "Applied compatibility fixes" messages
  ```

- [ ] **Step 2**: Create ItemLoader version in parallel
  ```python
  # Keep old spider as my_spider_legacy.py
  # Create new spider as my_spider.py with ItemLoaders
  ```

- [ ] **Step 3**: Compare outputs
  ```bash
  scrapy crawl my_spider_legacy -o legacy.json
  scrapy crawl my_spider -o modern.json
  # Compare JSON outputs for equivalence
  ```

- [ ] **Step 4**: Test in production
  ```bash
  # Run new spider for 24 hours
  # Monitor error rates and data quality
  ```

- [ ] **Step 5**: Deprecate old spider
  ```python
  # Move old spider to deprecated/ directory
  # Update documentation
  ```

- [ ] **Step 6**: Update migration statistics
  ```python
  # Update your migration tracking spreadsheet
  # Generate new migration report
  ```

## Best Practices

### DO ✓

- **Keep middleware enabled globally** - Zero cost for modern spiders
- **Use ensure_item_fields() explicitly** - When you need to validate before yielding
- **Add `uses_itemloader = True`** - To new spiders for self-documentation
- **Monitor statistics** - Track migration progress via logs
- **Test both modes** - Ensure compatibility layer doesn't break anything

### DON'T ✗

- **Don't disable middleware in production** - Unless you're 100% migrated
- **Don't rely on middleware forever** - It's a temporary bridge
- **Don't mix patterns in one spider** - Use either legacy OR ItemLoader, not both
- **Don't skip testing** - Always test after migration
- **Don't hardcode timestamps** - Let middleware/ItemLoader handle them

## Troubleshooting

### Issue: "Item missing required fields" in pipeline

**Cause**: Middleware is disabled or not in SPIDER_MIDDLEWARES

**Solution**:
```python
# Check settings/base.py
SPIDER_MIDDLEWARES = {
    'compat.BackwardCompatibilityMiddleware': 100,  # Must be present
}
```

### Issue: "Compatibility fixes not being applied"

**Cause**: Item already has _values attribute (looks like ItemLoader)

**Solution**:
```python
# Don't manually add _values to legacy items
item = EnhancedTrackItem()
# item._values = {}  # ← REMOVE THIS
```

### Issue: "Multiple timestamp values differ"

**Cause**: Calling ensure_item_fields() multiple times

**Solution**: Function is idempotent - safe to call multiple times. Timestamps won't change.

### Issue: "Statistics not appearing in logs"

**Cause**: `COMPAT_MIDDLEWARE_STATS = False` or log level too high

**Solution**:
```python
# In settings
COMPAT_MIDDLEWARE_STATS = True
LOG_LEVEL = 'INFO'  # Not 'WARNING' or 'ERROR'
```

## Examples

### Example 1: Old 1001tracklists Spider (Automatic)

```python
# No changes needed - middleware handles everything
class Tracklists1001Spider(scrapy.Spider):
    name = '1001tracklists'

    def parse(self, response):
        item = EnhancedSetlistItem()
        item['setlist_name'] = response.css('h1::text').get()
        item['data_source'] = '1001tracklists'
        yield item  # Middleware adds scrape_timestamp, created_at automatically
```

### Example 2: New Generic Archive Spider (ItemLoader)

```python
from item_loaders import ItemLoader

class GenericArchiveSpider(scrapy.Spider):
    name = 'generic_archive'
    uses_itemloader = True

    def parse(self, response):
        loader = ItemLoader(item=EnhancedSetlistItem(), response=response)
        loader.add_css('setlist_name', 'h1::text')
        loader.add_value('data_source', 'generic_archive')
        yield loader.load_item()  # Middleware detects ItemLoader, passes through
```

### Example 3: Mixed Codebase (Coexistence)

```python
# Run both spiders simultaneously
# Old spider uses middleware fixes
# New spider uses ItemLoader
# Both produce compatible output
```

## Performance Impact

- **ItemLoader items**: Zero overhead (pass-through)
- **Legacy items**: Minimal overhead (~0.1ms per item)
- **Memory**: ~1KB per spider for statistics
- **Production**: Negligible impact, safe to enable globally

## Future Deprecation

Once all spiders are migrated to ItemLoaders:

1. Remove `COMPAT_MIDDLEWARE_ENABLED = False` from settings
2. Remove `compat.py` module
3. Update documentation
4. Archive old spider versions

Target: **Q2 2025** (after all spiders migrated)
