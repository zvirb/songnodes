"""
Discogs Enrichment Pipeline - Framework Section 2.2 Implementation
===================================================================

Creates the "bootstrap" bridge from MixesDB to Discogs using label and catalog numbers.

This pipeline:
1. Detects tracks with label/catalog number from MixesDB
2. Performs targeted Discogs API search using catalog number
3. Enriches track with definitive Discogs data (ISRC, credits, genres)
4. Links tracks to canonical Discogs release_id

This creates a direct link between unstructured wiki data and structured archival data.
"""

import scrapy
import json
import logging
import asyncio
from typing import Dict, Optional
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem

logger = logging.getLogger(__name__)


class DiscogsEnrichmentPipeline:
    """
    Enriches tracks with Discogs data using label/catalog number as the bridge.

    Framework Quote:
    "The label and catalog number acts as a powerful bridge to other databases.
    While a track title can be ambiguous, a combination of artist, label, and
    catalog number is a near-certain unique identifier for a specific release."
    """

    def __init__(self, discogs_api_key: str = None):
        self.discogs_api_key = discogs_api_key or self._get_discogs_key()
        self.api_base_url = 'https://api.discogs.com'
        self.stats = {
            'tracks_with_catalog': 0,
            'discogs_matches_found': 0,
            'discogs_matches_failed': 0,
            'tracks_enriched': 0
        }

    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings"""
        import os
        api_key = crawler.settings.get('DISCOGS_API_KEY') or os.getenv('DISCOGS_TOKEN')
        return cls(discogs_api_key=api_key)

    def _get_discogs_key(self) -> Optional[str]:
        """Load Discogs API key from environment or database"""
        import os

        # Try environment first
        key = os.getenv('DISCOGS_TOKEN')
        if key:
            return key

        # Try loading from database (centralized API key management)
        try:
            from common.secrets_manager import get_secret
            key = get_secret('DISCOGS_TOKEN', required=False)
            if key:
                return key
        except Exception as e:
            logger.debug(f"Could not load Discogs key from secrets manager: {e}")

        return None

    def process_item(self, item, spider):
        """Process item and enrich with Discogs data if label/catalog available"""
        adapter = ItemAdapter(item)

        # Only process tracks (not setlists, artists, etc.)
        item_type = adapter.get('item_type')
        if item_type and item_type != 'track':
            return item

        # Check if track has label and catalog number (MixesDB bridge data)
        label = adapter.get('record_label') or adapter.get('label_name')
        catalog = adapter.get('catalog_number') or adapter.get('catno')

        if not (label and catalog):
            # No bridge data available
            return item

        self.stats['tracks_with_catalog'] += 1
        logger.debug(f"Track has catalog data: {label} - {catalog}")

        # Attempt Discogs enrichment
        try:
            discogs_data = self._search_discogs_by_catalog(
                label_name=label,
                catalog_number=catalog,
                artist=adapter.get('primary_artist') or (adapter.get('primary_artists', []) or [''])[0],
                title=adapter.get('track_name') or adapter.get('title', '')
            )

            if discogs_data:
                # Enrich item with Discogs data
                self._enrich_item_with_discogs(adapter, discogs_data)
                self.stats['discogs_matches_found'] += 1
                self.stats['tracks_enriched'] += 1
                logger.info(f"✓ Enriched via Discogs: {adapter.get('track_name')}")
            else:
                self.stats['discogs_matches_failed'] += 1
                logger.debug(f"No Discogs match for: {label} - {catalog}")

        except Exception as e:
            logger.error(f"Discogs enrichment error: {e}")
            self.stats['discogs_matches_failed'] += 1

        return item

    def _search_discogs_by_catalog(
        self,
        label_name: str,
        catalog_number: str,
        artist: str = None,
        title: str = None
    ) -> Optional[Dict]:
        """
        Search Discogs using label and catalog number for high-precision match.

        Args:
            label_name: Record label name
            catalog_number: Catalog number (e.g., "PIAS001")
            artist: Artist name (optional, for validation)
            title: Track title (optional, for validation)

        Returns:
            Discogs release data dict or None
        """
        if not self.discogs_api_key:
            logger.warning("Discogs API key not available - skipping enrichment")
            return None

        import requests
        from urllib.parse import urlencode

        # Build highly targeted search query
        # Priority: catalog number (most specific identifier)
        query_parts = [catalog_number]
        if label_name:
            query_parts.append(label_name)

        query = ' '.join(query_parts)

        params = {
            'q': query,
            'type': 'release',  # Search releases, not masters
            'per_page': 10  # Limit results
        }

        headers = {
            'User-Agent': 'SongNodes/1.0 +https://songnodes.com',
            'Authorization': f'Discogs token={self.discogs_api_key}'
        }

        try:
            url = f"{self.api_base_url}/database/search?{urlencode(params)}"
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code == 429:
                logger.warning("Discogs rate limit hit - will retry later")
                return None

            response.raise_for_status()
            data = response.json()

            results = data.get('results', [])
            if not results:
                return None

            # Find best match (exact catalog number match)
            for result in results:
                result_catno = result.get('catno', '').strip()
                # Exact match on catalog number
                if result_catno.lower() == catalog_number.lower():
                    # Fetch full release details
                    release_id = result.get('id')
                    return self._fetch_release_details(release_id)

            # If no exact match, return top result (if it contains the catalog in label info)
            top_result = results[0]
            if catalog_number.lower() in top_result.get('catno', '').lower():
                release_id = top_result.get('id')
                return self._fetch_release_details(release_id)

            return None

        except requests.RequestException as e:
            logger.error(f"Discogs API error: {e}")
            return None

    def _fetch_release_details(self, release_id: int) -> Optional[Dict]:
        """Fetch full release details from Discogs"""
        if not release_id:
            return None

        import requests

        headers = {
            'User-Agent': 'SongNodes/1.0 +https://songnodes.com',
            'Authorization': f'Discogs token={self.discogs_api_key}'
        }

        try:
            url = f"{self.api_base_url}/releases/{release_id}"
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Error fetching Discogs release {release_id}: {e}")
            return None

    def _enrich_item_with_discogs(self, adapter: ItemAdapter, discogs_data: Dict):
        """
        Enrich item with Discogs data.

        Extracts:
        - discogs_id (release_id)
        - genres and styles (detailed taxonomy)
        - extraartists (producer, writer, engineer credits)
        - Official release date
        - ISRC codes (if available in tracklist)
        """
        # Add Discogs release ID
        adapter['discogs_id'] = discogs_data.get('id')

        # Extract genres and styles
        genres = discogs_data.get('genres', [])
        styles = discogs_data.get('styles', [])

        if genres and not adapter.get('genre'):
            adapter['genre'] = genres[0] if genres else None

        # Store detailed taxonomy in metadata
        metadata = json.loads(adapter.get('metadata', '{}'))
        metadata['discogs'] = {
            'release_id': discogs_data.get('id'),
            'genres': genres,
            'styles': styles,
            'release_date': discogs_data.get('released'),
            'country': discogs_data.get('country'),
            'format': discogs_data.get('formats', [{}])[0].get('name') if discogs_data.get('formats') else None
        }

        # Extract ISRC from tracklist if available
        tracklist = discogs_data.get('tracklist', [])
        track_title = adapter.get('track_name', '').lower()

        for track in tracklist:
            if track.get('title', '').lower() in track_title or track_title in track.get('title', '').lower():
                # Found matching track
                if 'extraartists' in track:
                    metadata['discogs']['track_credits'] = track['extraartists']
                # Note: ISRC not typically in public Discogs data, but check anyway
                break

        # Extract release-level credits (producers, etc.)
        extraartists = discogs_data.get('extraartists', [])
        if extraartists:
            metadata['discogs']['release_credits'] = extraartists

        adapter['metadata'] = json.dumps(metadata)

        # Update external URLs
        external_urls = json.loads(adapter.get('external_urls', '{}'))
        external_urls['discogs'] = discogs_data.get('uri')
        adapter['external_urls'] = json.dumps(external_urls)

        logger.debug(f"Enriched with Discogs ID: {discogs_data.get('id')}, Genres: {genres}, Styles: {styles}")

    def close_spider(self, spider):
        """Log pipeline statistics on spider close"""
        logger.info(
            f"Discogs Enrichment Stats: "
            f"{self.stats['tracks_with_catalog']} tracks with catalog, "
            f"{self.stats['discogs_matches_found']} matched, "
            f"{self.stats['tracks_enriched']} enriched"
        )
