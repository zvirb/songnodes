"""
Generic Archive Spider for SongNodes
====================================

A configurable spider that uses YAML configuration files to scrape artist-specific
archives and setlist sources. This enables rapid onboarding of new Tier 2 sources
in minutes rather than hours.

Usage:
    scrapy crawl generic_archive -a config=phish_net -a start_url=https://phish.net/setlists/...
    scrapy crawl generic_archive -a config=panic_stream -a start_url=https://panicstream.com/vault/...

Features:
    - YAML-driven configuration
    - CSS and XPath selector support
    - Regex-based text cleanup
    - NLP fallback for unstructured pages
    - Pagination support
    - Validation and rate limiting
"""

import scrapy
import yaml
import os
import re
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from urllib.parse import urljoin

try:
    from ..items import (
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem,
        EnhancedSetlistTrackItem,
        PlaylistItem
    )
    from ..nlp_spider_mixin import NLPFallbackSpiderMixin
    from ..track_id_generator import generate_track_id
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from items import (
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem,
        EnhancedSetlistTrackItem,
        PlaylistItem
    )
    from nlp_spider_mixin import NLPFallbackSpiderMixin
    from track_id_generator import generate_track_id


class GenericArchiveSpider(NLPFallbackSpiderMixin, scrapy.Spider):
    """
    Generic spider that loads parsing configuration from YAML files.
    Enables rapid onboarding of new artist-specific archives.
    """
    name = 'generic_archive'

    def __init__(self, config=None, start_url=None, *args, **kwargs):
        """
        Initialize spider with configuration file.

        Args:
            config: Name of YAML config file (without .yaml extension)
            start_url: Starting URL to scrape (optional, can also specify in config)
        """
        super().__init__(*args, **kwargs)

        if not config:
            raise ValueError("Must specify config parameter: scrapy crawl generic_archive -a config=phish_net")

        # Load configuration from YAML file
        self.config_name = config
        self.parser_config = self._load_config(config)
        self.logger.info(f"Loaded configuration: {self.parser_config.get('source_name', config)}")

        # Set spider attributes from config
        self.source_name = self.parser_config.get('source_name', config)
        self.source_type = self.parser_config.get('source_type', 'artist_archive')
        self.base_url = self.parser_config.get('base_url', '')

        # Set start URLs
        if start_url:
            self.start_urls = [start_url]
        elif 'start_urls' in self.parser_config:
            self.start_urls = self.parser_config['start_urls']
        else:
            raise ValueError("Must specify start_url parameter or start_urls in config")

        # Configure rate limiting from config
        rate_config = self.parser_config.get('rate_limiting', {})
        self.download_delay = rate_config.get('download_delay', 2.0)
        self.randomize_download_delay = rate_config.get('randomize_delay', 0.3)

        # Configure pagination
        self.pagination_config = self.parser_config.get('pagination', {})
        self.max_pages = self.pagination_config.get('max_pages', 10)
        self.current_page = 0

        # Statistics
        self.stats = {
            'pages_scraped': 0,
            'tracks_extracted': 0,
            'setlists_extracted': 0,
            'validation_failures': 0
        }

    def _load_config(self, config_name: str) -> Dict:
        """
        Load YAML configuration file from parser_configs directory.

        Args:
            config_name: Name of config file (without .yaml extension)

        Returns:
            Parsed YAML configuration as dictionary
        """
        # Determine config file path
        config_dir = Path(__file__).parent.parent / 'parser_configs'
        config_file = config_dir / f"{config_name}.yaml"

        if not config_file.exists():
            raise FileNotFoundError(
                f"Configuration file not found: {config_file}\n"
                f"Available configs: {list(config_dir.glob('*.yaml'))}"
            )

        # Load and parse YAML
        with open(config_file, 'r') as f:
            config = yaml.safe_load(f)

        self.logger.info(f"✓ Loaded configuration from {config_file}")
        return config

    def parse(self, response):
        """
        Main parsing method that uses configured selectors to extract data.
        """
        self.stats['pages_scraped'] += 1
        self.logger.info(f"Parsing page {self.stats['pages_scraped']}: {response.url}")

        # Try structured extraction first
        tracks_data = self._extract_tracks_structured(response)

        # If structured extraction fails and NLP fallback is enabled, try NLP
        if not tracks_data and self.parser_config.get('data_mapping', {}).get('enable_nlp_fallback', True):
            self.logger.info("Structured extraction failed, trying NLP fallback...")
            tracks_data = self._extract_tracks_nlp(response)

        # If still no tracks, log warning and return
        if not tracks_data:
            self.logger.warning(f"No tracks extracted from {response.url}")
            return

        # Extract setlist metadata
        setlist_data = self._extract_setlist_metadata(response)

        # Validate extracted data
        if not self._validate_data(tracks_data, setlist_data):
            self.stats['validation_failures'] += 1
            self.logger.warning(f"Data validation failed for {response.url}")
            return

        # Yield setlist item if we have metadata
        if setlist_data:
            setlist_item = self._create_setlist_item(setlist_data, response.url)
            if setlist_item:
                yield setlist_item
                self.stats['setlists_extracted'] += 1

        # Yield track items
        track_names = []
        for i, track_data in enumerate(tracks_data, start=1):
            track_item = self._create_track_item(track_data, i, response.url)
            if track_item:
                yield track_item
                self.stats['tracks_extracted'] += 1
                track_names.append(track_data.get('title', ''))

                # Yield track-artist relationship
                artist_item = self._create_track_artist_item(track_data)
                if artist_item:
                    yield artist_item

                # Yield setlist-track relationship if we have a setlist
                if setlist_data:
                    setlist_track_item = self._create_setlist_track_item(
                        setlist_data, track_data, i
                    )
                    if setlist_track_item:
                        yield setlist_track_item

        # Create playlist item for database storage
        if setlist_data and track_names:
            playlist_item = self._create_playlist_item(setlist_data, track_names, response.url)
            if playlist_item:
                yield playlist_item

        # Handle pagination if enabled
        if self.pagination_config.get('enabled', False):
            self.current_page += 1
            if self.current_page < self.max_pages:
                next_url = self._extract_next_page(response)
                if next_url:
                    self.logger.info(f"Following pagination to page {self.current_page + 1}: {next_url}")
                    yield scrapy.Request(next_url, callback=self.parse)

    def _extract_tracks_structured(self, response) -> List[Dict]:
        """
        Extract tracks using configured selectors.

        Returns:
            List of track dictionaries with extracted data
        """
        tracks = []
        selectors_config = self.parser_config.get('selectors', {})

        # Find tracklist container
        container_selectors = selectors_config.get('tracklist_container', [])
        container = self._find_element(response, container_selectors)

        if not container:
            self.logger.debug("Could not find tracklist container")
            return tracks

        # Find all track rows
        track_row_selectors = selectors_config.get('track_row', [])
        track_rows = self._find_elements(container, track_row_selectors)

        # Add fallback selectors for common track structures
        if not track_rows:
            fallback_selectors = ['div.list-track', 'li.tracklist-item', 'div.tlpItem', 'div.bItm']
            track_rows = self._find_elements(container, fallback_selectors)

        if not track_rows:
            self.logger.debug("Could not find track rows")
            return tracks

        self.logger.info(f"Found {len(track_rows)} track rows")

        # Extract data from each track row
        for row in track_rows:
            track_data = {}

            # Extract track title
            title_selectors = selectors_config.get('track_title', [])
            title = self._extract_text(row, title_selectors)
            if title:
                track_data['title'] = self._apply_regex_patterns(title, 'clean_track_title')

            # Extract artist name
            artist_selectors = selectors_config.get('artist_name', [])
            artist = self._extract_text(row, artist_selectors)
            if artist:
                track_data['artist'] = self._apply_regex_patterns(artist, 'clean_artist_name')
            else:
                # Use default artist from config
                track_data['artist'] = self.parser_config.get('data_mapping', {}).get('default_artist', '')

            # Extract timestamp if configured
            timestamp_selectors = selectors_config.get('timestamp', [])
            timestamp = self._extract_text(row, timestamp_selectors)
            if timestamp:
                track_data['timestamp'] = self._apply_regex_patterns(timestamp, 'extract_timestamp')

            # Only add track if we have at least a title
            if track_data.get('title'):
                tracks.append(track_data)

        return tracks

    def _extract_tracks_nlp(self, response) -> List[Dict]:
        """
        Extract tracks using NLP fallback.

        Returns:
            List of track dictionaries with extracted data
        """
        try:
            tracks_data = self.extract_via_nlp_sync(
                html_or_text=response.text,
                url=response.url,
                extract_timestamps=self.parser_config.get('data_mapping', {}).get('extract_timestamps', True)
            )

            if tracks_data:
                self.logger.info(f"✅ NLP extraction succeeded: {len(tracks_data)} tracks")
                return tracks_data
            else:
                self.logger.warning("⚠️ NLP extraction returned no tracks")
                return []

        except Exception as e:
            self.logger.error(f"NLP extraction failed: {e}")
            return []

    def _extract_setlist_metadata(self, response) -> Dict:
        """
        Extract setlist/show metadata from page.

        Returns:
            Dictionary with setlist metadata
        """
        metadata = {}
        selectors_config = self.parser_config.get('selectors', {})

        # Extract setlist name
        name_selectors = selectors_config.get('setlist_name', [])
        name = self._extract_text(response, name_selectors)
        if name:
            metadata['name'] = name.strip()

        # Extract venue
        venue_selectors = selectors_config.get('venue', [])
        venue = self._extract_text(response, venue_selectors)
        if venue:
            metadata['venue'] = venue.strip()

        # Extract date
        date_selectors = selectors_config.get('date', [])
        date_str = self._extract_text(response, date_selectors)
        if date_str:
            date_str = self._apply_regex_patterns(date_str, 'extract_date')
            metadata['date'] = self._parse_date(date_str)

        # Extract notes
        notes_selectors = selectors_config.get('notes', [])
        notes = self._extract_text(response, notes_selectors)
        if notes:
            metadata['notes'] = notes.strip()

        return metadata

    def _validate_data(self, tracks_data: List[Dict], setlist_data: Dict) -> bool:
        """
        Validate extracted data against configuration rules.

        Returns:
            True if data is valid, False otherwise
        """
        validation_config = self.parser_config.get('validation', {})

        # Check minimum tracks
        min_tracks = validation_config.get('min_tracks', 1)
        if len(tracks_data) < min_tracks:
            self.logger.warning(f"Too few tracks: {len(tracks_data)} < {min_tracks}")
            return False

        # Check maximum tracks
        max_tracks = validation_config.get('max_tracks', 200)
        if len(tracks_data) > max_tracks:
            self.logger.warning(f"Too many tracks: {len(tracks_data)} > {max_tracks}")
            return False

        # Check required venue
        if validation_config.get('require_venue', False):
            if not setlist_data.get('venue'):
                self.logger.warning("Venue required but not found")
                return False

        # Check required date
        if validation_config.get('require_date', False):
            if not setlist_data.get('date'):
                self.logger.warning("Date required but not found")
                return False

        return True

    def _create_track_item(self, track_data: Dict, position: int, source_url: str) -> EnhancedTrackItem:
        """
        Create EnhancedTrackItem from extracted track data.
        """
        try:
            track_item = EnhancedTrackItem()

            # Basic info
            track_item['track_name'] = track_data.get('title', '')
            track_item['normalized_title'] = track_data.get('title', '').lower().strip()

            # Artist info
            artist_name = track_data.get('artist', '')

            # Detect remix/mashup
            track_item['is_remix'] = bool(re.search(r'(remix|edit|mix)\b', track_item['track_name'], re.IGNORECASE))
            track_item['is_mashup'] = bool(re.search(r'\b(vs\.|mashup)\b', track_item['track_name'], re.IGNORECASE))

            # Generate track ID
            track_id = generate_track_id(
                title=track_item['track_name'],
                primary_artist=artist_name,
                is_remix=track_item.get('is_remix', False),
                is_mashup=track_item.get('is_mashup', False),
                remix_type=None
            )
            track_item['track_id'] = track_id

            # Metadata
            track_item['track_type'] = 'Setlist'
            track_item['position_in_source'] = position
            track_item['start_time'] = track_data.get('timestamp')
            track_item['source_context'] = f"{self.source_name}:{source_url}"

            # Genre from config
            track_item['genre'] = self.parser_config.get('data_mapping', {}).get('default_genre')

            # System fields
            track_item['data_source'] = self.parser_config.get('data_mapping', {}).get('source_identifier', self.config_name)
            track_item['scrape_timestamp'] = datetime.utcnow()
            track_item['created_at'] = datetime.utcnow()

            return track_item

        except Exception as e:
            self.logger.error(f"Error creating track item: {e}")
            return None

    def _create_setlist_item(self, setlist_data: Dict, source_url: str) -> EnhancedSetlistItem:
        """
        Create EnhancedSetlistItem from extracted setlist metadata.
        """
        try:
            setlist_item = EnhancedSetlistItem()

            # Basic info
            setlist_item['setlist_name'] = setlist_data.get('name', f"{self.source_name} Setlist")
            setlist_item['normalized_name'] = setlist_item['setlist_name'].lower().strip()

            # Venue and date
            setlist_item['venue_name'] = setlist_data.get('venue')
            setlist_item['set_date'] = setlist_data.get('date')

            # Artist info
            default_artist = self.parser_config.get('data_mapping', {}).get('default_artist', '')
            setlist_item['dj_artist_name'] = default_artist

            # Description
            setlist_item['description'] = setlist_data.get('notes')

            # External URLs
            import json
            setlist_item['external_urls'] = json.dumps({self.source_name: source_url})

            # System fields
            setlist_item['data_source'] = self.parser_config.get('data_mapping', {}).get('source_identifier', self.config_name)
            setlist_item['scrape_timestamp'] = datetime.utcnow()
            setlist_item['created_at'] = datetime.utcnow()

            return setlist_item

        except Exception as e:
            self.logger.error(f"Error creating setlist item: {e}")
            return None

    def _create_track_artist_item(self, track_data: Dict) -> EnhancedTrackArtistItem:
        """
        Create EnhancedTrackArtistItem for track-artist relationship.
        """
        try:
            item = EnhancedTrackArtistItem()
            item['track_name'] = track_data.get('title', '')
            item['artist_name'] = track_data.get('artist', '')
            item['artist_role'] = 'primary'
            item['position'] = 0
            item['data_source'] = self.parser_config.get('data_mapping', {}).get('source_identifier', self.config_name)
            item['scrape_timestamp'] = datetime.utcnow()
            item['created_at'] = datetime.utcnow()
            return item
        except Exception as e:
            self.logger.error(f"Error creating track artist item: {e}")
            return None

    def _create_setlist_track_item(self, setlist_data: Dict, track_data: Dict, position: int) -> EnhancedSetlistTrackItem:
        """
        Create EnhancedSetlistTrackItem for setlist-track relationship.
        """
        try:
            item = EnhancedSetlistTrackItem()
            item['setlist_name'] = setlist_data.get('name', f"{self.source_name} Setlist")
            item['track_name'] = track_data.get('title', '')
            item['track_order'] = position
            item['start_time'] = track_data.get('timestamp')
            item['data_source'] = self.parser_config.get('data_mapping', {}).get('source_identifier', self.config_name)
            item['scrape_timestamp'] = datetime.utcnow()
            item['created_at'] = datetime.utcnow()
            return item
        except Exception as e:
            self.logger.error(f"Error creating setlist track item: {e}")
            return None

    def _create_playlist_item(self, setlist_data: Dict, track_names: List[str], source_url: str) -> PlaylistItem:
        """
        Create PlaylistItem for database storage.
        """
        try:
            item = PlaylistItem()
            item['item_type'] = 'playlist'
            item['name'] = setlist_data.get('name', f"{self.source_name} Setlist")
            item['source'] = self.parser_config.get('data_mapping', {}).get('source_identifier', self.config_name)
            item['source_url'] = source_url
            item['dj_name'] = self.parser_config.get('data_mapping', {}).get('default_artist', '')
            item['artist_name'] = item['dj_name']
            item['curator'] = item['dj_name']
            item['event_date'] = setlist_data.get('date')
            item['venue_name'] = setlist_data.get('venue')
            item['tracks'] = track_names
            item['total_tracks'] = len(track_names)
            item['description'] = setlist_data.get('notes')
            item['data_source'] = self.parser_config.get('data_mapping', {}).get('source_identifier', self.config_name)
            item['scrape_timestamp'] = datetime.utcnow()
            item['created_at'] = datetime.utcnow()
            return item
        except Exception as e:
            self.logger.error(f"Error creating playlist item: {e}")
            return None

    def _extract_next_page(self, response) -> Optional[str]:
        """
        Extract next page URL for pagination.
        """
        next_page_selectors = self.pagination_config.get('next_page', [])
        next_url = self._extract_text(response, next_page_selectors)

        if next_url:
            # Convert relative URL to absolute
            next_url = urljoin(response.url, next_url)
            return next_url

        return None

    def _find_element(self, response_or_selector, selectors: List[str]):
        """
        Find first element matching any of the provided selectors.
        Supports both CSS and XPath selectors.
        """
        for selector in selectors:
            try:
                if selector.startswith('css:'):
                    result = response_or_selector.css(selector[4:])
                elif selector.startswith('xpath:'):
                    result = response_or_selector.xpath(selector[6:])
                else:
                    # Default to CSS
                    result = response_or_selector.css(selector)

                if result:
                    return result[0] if isinstance(result, list) else result

            except Exception as e:
                self.logger.debug(f"Selector failed: {selector} - {e}")
                continue

        return None

    def _find_elements(self, response_or_selector, selectors: List[str]) -> List:
        """
        Find all elements matching any of the provided selectors.
        """
        for selector in selectors:
            try:
                if selector.startswith('css:'):
                    result = response_or_selector.css(selector[4:])
                elif selector.startswith('xpath:'):
                    result = response_or_selector.xpath(selector[6:])
                else:
                    result = response_or_selector.css(selector)

                if result:
                    return result

            except Exception as e:
                self.logger.debug(f"Selector failed: {selector} - {e}")
                continue

        return []

    def _extract_text(self, selector, selectors_list: List[str]) -> Optional[str]:
        """
        Extract text using first matching selector.
        """
        for sel in selectors_list:
            try:
                if sel.startswith('css:'):
                    result = selector.css(sel[4:]).get()
                elif sel.startswith('xpath:'):
                    result = selector.xpath(sel[6:]).get()
                else:
                    result = selector.css(sel).get()

                if result:
                    return result.strip()

            except Exception as e:
                self.logger.debug(f"Text extraction failed: {sel} - {e}")
                continue

        return None

    def _apply_regex_patterns(self, text: str, pattern_name: str) -> str:
        """
        Apply configured regex patterns to text.
        """
        regex_config = self.parser_config.get('regex_patterns', {})
        patterns = regex_config.get(pattern_name, [])

        for pattern_config in patterns:
            if isinstance(pattern_config, dict):
                pattern = pattern_config.get('pattern', '')
                replace = pattern_config.get('replace', '')
                flags_str = pattern_config.get('flags', '')
                group = pattern_config.get('group')

                # Parse regex flags
                flags = 0
                if 'IGNORECASE' in flags_str:
                    flags |= re.IGNORECASE
                if 'MULTILINE' in flags_str:
                    flags |= re.MULTILINE

                # Apply regex
                if group is not None:
                    # Extract group
                    match = re.search(pattern, text, flags)
                    if match:
                        text = match.group(group)
                else:
                    # Replace
                    text = re.sub(pattern, replace, text, flags=flags)

        return text.strip()

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """
        Parse date string using configured format.
        """
        if not date_str:
            return None

        date_format = self.parser_config.get('data_mapping', {}).get('date_format', '%Y-%m-%d')

        try:
            return datetime.strptime(date_str, date_format).date()
        except ValueError:
            # Try common formats
            formats = ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%B %d, %Y']
            for fmt in formats:
                try:
                    return datetime.strptime(date_str, fmt).date()
                except ValueError:
                    continue

        self.logger.warning(f"Could not parse date: {date_str}")
        return None

    def closed(self, reason):
        """
        Log statistics when spider closes.
        """
        self.logger.info("=" * 70)
        self.logger.info(f"GENERIC ARCHIVE SPIDER COMPLETED: {self.source_name}")
        self.logger.info("=" * 70)
        self.logger.info(f"Configuration: {self.config_name}")
        self.logger.info(f"Pages scraped: {self.stats['pages_scraped']}")
        self.logger.info(f"Setlists extracted: {self.stats['setlists_extracted']}")
        self.logger.info(f"Tracks extracted: {self.stats['tracks_extracted']}")
        self.logger.info(f"Validation failures: {self.stats['validation_failures']}")
        self.logger.info("=" * 70)
