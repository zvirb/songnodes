#!/usr/bin/env python3
"""
Simple validation script for backward compatibility layer.
Run: python3 validate_compat.py
"""

import sys
from datetime import datetime
from items import EnhancedTrackItem, EnhancedArtistItem, EnhancedSetlistItem
from compat import (
    ensure_item_fields,
    is_using_itemloader,
    get_compat_status,
    check_spider_compatibility,
    migration_report,
)


def test_ensure_item_fields():
    """Test ensure_item_fields function."""
    print("Testing ensure_item_fields()...")

    # Test 1: Adds missing system fields
    item = EnhancedTrackItem()
    item['track_name'] = 'Test Track'
    result = ensure_item_fields(item)

    assert 'scrape_timestamp' in result, "Missing scrape_timestamp"
    assert 'created_at' in result, "Missing created_at"
    assert result['scrape_timestamp'] is not None, "scrape_timestamp is None"
    print("  ✓ Adds missing system fields")

    # Test 2: Preserves existing fields
    item2 = EnhancedTrackItem()
    item2['track_name'] = 'Test Track 2'
    item2['scrape_timestamp'] = '2024-01-01T00:00:00'
    result2 = ensure_item_fields(item2)
    assert result2['scrape_timestamp'] == '2024-01-01T00:00:00', "Overwrote existing field"
    print("  ✓ Preserves existing fields")

    # Test 3: Adds item-specific defaults
    assert result['is_remix'] is False, "Missing is_remix default"
    assert result['is_mashup'] is False, "Missing is_mashup default"
    print("  ✓ Adds item-specific defaults")

    # Test 4: Idempotent
    result3 = ensure_item_fields(result)
    timestamp1 = result['scrape_timestamp']
    timestamp2 = result3['scrape_timestamp']
    assert timestamp1 == timestamp2, "Timestamp changed on second call"
    print("  ✓ Idempotent (safe to call multiple times)")

    print("✓ ensure_item_fields() tests passed\n")


def test_is_using_itemloader():
    """Test is_using_itemloader detection."""
    print("Testing is_using_itemloader()...")

    # Test 1: Detects legacy item
    item = EnhancedTrackItem()
    item['track_name'] = 'Test Track'
    assert is_using_itemloader(item) is False, "Incorrectly detected as ItemLoader"
    print("  ✓ Detects legacy items")

    # Test 2: Detects ItemLoader item with marker
    item2 = EnhancedTrackItem()
    item2._itemloader_used = True  # Marker attribute
    assert is_using_itemloader(item2) is True, "Failed to detect ItemLoader"
    print("  ✓ Detects ItemLoader items with marker")

    # Test 3: Detects ItemLoader item with _loader attribute
    item3 = EnhancedTrackItem()
    item3._loader = object()  # Simulate ItemLoader attribute
    assert is_using_itemloader(item3) is True, "Failed to detect ItemLoader via _loader"
    print("  ✓ Detects ItemLoader items via _loader attribute")

    print("✓ is_using_itemloader() tests passed\n")


def test_get_compat_status():
    """Test get_compat_status function."""
    print("Testing get_compat_status()...")

    class MockSpider:
        name = 'test_spider'
        uses_itemloader = False

    spider = MockSpider()
    status = get_compat_status(spider)

    assert status['spider_name'] == 'test_spider', "Wrong spider name"
    assert status['using_itemloader'] is False, "Wrong itemloader status"
    assert status['compat_mode'] == 'legacy', "Wrong compat mode"
    assert 'timestamp' in status, "Missing timestamp"
    print("  ✓ Returns correct status dictionary")

    print("✓ get_compat_status() tests passed\n")


def test_check_spider_compatibility():
    """Test check_spider_compatibility function."""
    print("Testing check_spider_compatibility()...")

    # Test 1: Compatible spider
    class GoodSpider:
        name = 'good_spider'

        def parse(self, response):
            pass

    spider = GoodSpider()
    is_compat, msg = check_spider_compatibility(spider)
    assert is_compat is True, "Compatible spider marked as incompatible"
    print("  ✓ Detects compatible spiders")

    # Test 2: Missing name
    class BadSpider1:
        def parse(self, response):
            pass

    spider2 = BadSpider1()
    is_compat2, msg2 = check_spider_compatibility(spider2)
    assert is_compat2 is False, "Should fail without name"
    assert "name" in msg2.lower(), "Wrong error message"
    print("  ✓ Detects missing name attribute")

    # Test 3: Missing parse
    class BadSpider2:
        name = 'bad_spider'

    spider3 = BadSpider2()
    is_compat3, msg3 = check_spider_compatibility(spider3)
    assert is_compat3 is False, "Should fail without parse"
    assert "parse" in msg3.lower(), "Wrong error message"
    print("  ✓ Detects missing parse method")

    print("✓ check_spider_compatibility() tests passed\n")


def test_migration_report():
    """Test migration_report function."""
    print("Testing migration_report()...")

    stats = {
        'total_spiders': 10,
        'migrated_spiders': 3,
        'legacy_spiders': 7,
    }

    report = migration_report(stats)
    assert 'Total Spiders: 10' in report, "Missing total"
    assert 'Migrated to ItemLoader: 3' in report, "Missing migrated count"
    assert 'Still Using Legacy: 7' in report, "Missing legacy count"
    assert '30.0%' in report, "Missing percentage"
    print("  ✓ Generates correct report")

    # Test empty stats
    report2 = migration_report({})
    assert 'No spider data available' in report2, "Should handle empty stats"
    print("  ✓ Handles empty statistics")

    print("✓ migration_report() tests passed\n")


def test_middleware():
    """Test BackwardCompatibilityMiddleware."""
    print("Testing BackwardCompatibilityMiddleware...")

    from compat import BackwardCompatibilityMiddleware

    class MockSettings:
        def getbool(self, key, default):
            return default

    class MockSpider:
        name = 'test_spider'

        def __init__(self):
            import logging
            self.logger = logging.getLogger(self.name)

    settings = MockSettings()
    middleware = BackwardCompatibilityMiddleware(settings)

    assert middleware.enabled is True, "Middleware not enabled"
    assert middleware.log_fixes is True, "Log fixes not enabled"
    assert middleware.track_stats is True, "Stats tracking not enabled"
    print("  ✓ Middleware initialized correctly")

    spider = MockSpider()

    # Test legacy item processing
    item = EnhancedTrackItem()
    item['track_name'] = 'Test Track'

    result = list(middleware.process_spider_output(None, [item], spider))
    assert len(result) == 1, "Wrong number of items"
    fixed_item = result[0]
    assert 'scrape_timestamp' in fixed_item, "Missing scrape_timestamp"
    assert 'created_at' in fixed_item, "Missing created_at"
    print("  ✓ Processes legacy items correctly")

    # Test ItemLoader item pass-through
    item2 = EnhancedTrackItem()
    item2['track_name'] = 'Test Track 2'
    item2._itemloader_used = True  # Mark as ItemLoader

    result2 = list(middleware.process_spider_output(None, [item2], spider))
    assert len(result2) == 1, "Wrong number of items"
    assert middleware.stats['itemloader_items'] >= 1, "Didn't count ItemLoader items"
    print("  ✓ Passes through ItemLoader items")

    print("✓ BackwardCompatibilityMiddleware tests passed\n")


def main():
    """Run all validation tests."""
    print("=" * 60)
    print("Backward Compatibility Layer Validation")
    print("=" * 60)
    print()

    try:
        test_ensure_item_fields()
        test_is_using_itemloader()
        test_get_compat_status()
        test_check_spider_compatibility()
        test_migration_report()
        test_middleware()

        print("=" * 60)
        print("✓ ALL TESTS PASSED")
        print("=" * 60)
        print()
        print("The backward compatibility layer is working correctly!")
        print("Old and new spiders can now coexist during migration.")
        return 0

    except AssertionError as e:
        print()
        print("=" * 60)
        print("✗ TEST FAILED")
        print("=" * 60)
        print(f"Error: {e}")
        return 1

    except Exception as e:
        print()
        print("=" * 60)
        print("✗ UNEXPECTED ERROR")
        print("=" * 60)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 2


if __name__ == '__main__':
    sys.exit(main())
