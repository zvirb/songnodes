#!/usr/bin/env python3
"""
Configuration Validator for Generic Archive Spider
==================================================

Validates YAML configuration files against the schema and checks for common issues.

Usage:
    python validate_configs.py
    python validate_configs.py phish_net.yaml
"""

import yaml
import sys
from pathlib import Path


def validate_config(config_file: Path) -> bool:
    """
    Validate a single configuration file.

    Returns:
        True if valid, False otherwise
    """
    print(f"\n{'='*70}")
    print(f"Validating: {config_file.name}")
    print(f"{'='*70}")

    try:
        # Load YAML
        with open(config_file, 'r') as f:
            config = yaml.safe_load(f)

        # Check required top-level fields
        required_fields = ['source_name', 'source_type', 'base_url', 'selectors']
        missing_fields = [f for f in required_fields if f not in config]

        if missing_fields:
            print(f"❌ Missing required fields: {', '.join(missing_fields)}")
            return False

        print(f"✅ Required fields present")

        # Check selectors
        selectors = config.get('selectors', {})
        recommended_selectors = [
            'tracklist_container', 'track_row', 'track_title',
            'artist_name', 'venue', 'date', 'setlist_name'
        ]

        present_selectors = [s for s in recommended_selectors if s in selectors]
        missing_selectors = [s for s in recommended_selectors if s not in selectors]

        print(f"\nSelectors:")
        print(f"  ✅ Present ({len(present_selectors)}): {', '.join(present_selectors)}")
        if missing_selectors:
            print(f"  ⚠️  Missing ({len(missing_selectors)}): {', '.join(missing_selectors)}")

        # Check regex patterns
        regex_patterns = config.get('regex_patterns', {})
        if regex_patterns:
            print(f"\n✅ Regex patterns defined: {', '.join(regex_patterns.keys())}")
        else:
            print(f"\n⚠️  No regex patterns defined")

        # Check data mapping
        data_mapping = config.get('data_mapping', {})
        if data_mapping:
            print(f"\n✅ Data mapping present")
            if 'default_artist' in data_mapping:
                print(f"   Default artist: {data_mapping['default_artist']}")
            if 'default_genre' in data_mapping:
                print(f"   Default genre: {data_mapping['default_genre']}")
            if 'source_identifier' in data_mapping:
                print(f"   Source identifier: {data_mapping['source_identifier']}")
        else:
            print(f"\n⚠️  No data mapping defined")

        # Check validation rules
        validation = config.get('validation', {})
        if validation:
            print(f"\n✅ Validation rules defined")
            if 'min_tracks' in validation:
                print(f"   Min tracks: {validation['min_tracks']}")
            if 'max_tracks' in validation:
                print(f"   Max tracks: {validation['max_tracks']}")
        else:
            print(f"\n⚠️  No validation rules defined")

        # Check rate limiting
        rate_limiting = config.get('rate_limiting', {})
        if rate_limiting:
            print(f"\n✅ Rate limiting configured")
            if 'download_delay' in rate_limiting:
                print(f"   Download delay: {rate_limiting['download_delay']}s")
        else:
            print(f"\n⚠️  No rate limiting configured")

        # Check pagination
        pagination = config.get('pagination', {})
        if pagination.get('enabled', False):
            print(f"\n✅ Pagination enabled (max_pages: {pagination.get('max_pages', 'unlimited')})")
        else:
            print(f"\n⚠️  Pagination disabled")

        # Check metadata
        metadata = config.get('metadata', {})
        if metadata:
            print(f"\n✅ Metadata present")
            if 'example_urls' in metadata:
                print(f"   Example URLs: {len(metadata['example_urls'])} provided")

        print(f"\n{'='*70}")
        print(f"✅ Configuration is valid: {config_file.name}")
        print(f"{'='*70}")

        return True

    except yaml.YAMLError as e:
        print(f"❌ YAML parsing error: {e}")
        return False
    except Exception as e:
        print(f"❌ Validation error: {e}")
        return False


def main():
    """Validate all or specific configuration files."""
    config_dir = Path(__file__).parent

    # Get list of config files to validate
    if len(sys.argv) > 1:
        # Validate specific files
        config_files = [config_dir / arg for arg in sys.argv[1:]]
    else:
        # Validate all YAML files except SCHEMA.yaml
        config_files = [f for f in config_dir.glob('*.yaml') if f.name != 'SCHEMA.yaml']

    print(f"\n🔍 Validating {len(config_files)} configuration file(s)...")

    results = []
    for config_file in config_files:
        if not config_file.exists():
            print(f"\n❌ File not found: {config_file}")
            results.append(False)
            continue

        results.append(validate_config(config_file))

    # Summary
    print(f"\n{'='*70}")
    print(f"VALIDATION SUMMARY")
    print(f"{'='*70}")
    print(f"Total configurations: {len(results)}")
    print(f"✅ Valid: {sum(results)}")
    print(f"❌ Invalid: {len(results) - sum(results)}")
    print(f"{'='*70}\n")

    # Exit with error code if any failed
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main()
