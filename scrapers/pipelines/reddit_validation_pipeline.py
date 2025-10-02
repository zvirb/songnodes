"""
Reddit→Spotify Validation Pipeline - Framework Section 2.4 Implementation
==========================================================================

Implements the two-stage validation pipeline for Reddit track mentions:

Stage 1 (Capture): Apply lenient regex to capture potential track mentions
Stage 2 (Validation): Query Spotify API to validate each mention
Stage 3 (Confirmation): Analyze search results for high-confidence match

This transforms Reddit from a source of raw mentions into a "social listening"
tool with validated track links.
"""

import scrapy
import json
import logging
import requests
import base64
from typing import Dict, Optional, List
from itemadapter import ItemAdapter
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RedditValidationPipeline:
    """
    Validates Reddit track mentions against Spotify API.

    Framework Quote:
    "Reddit should not be treated as a source of authoritative setlist data,
    but rather as a 'social listening' or lead-generation tool for track discovery."
    """

    # Minimum similarity threshold for Spotify match (0.0 - 1.0)
    SIMILARITY_THRESHOLD = 0.7

    def __init__(self, spotify_client_id: str = None, spotify_client_secret: str = None):
        self.spotify_client_id = spotify_client_id or self._get_spotify_credential('client_id')
        self.spotify_client_secret = spotify_client_secret or self._get_spotify_credential('client_secret')
        self.access_token = None
        self.token_expiry = None

        self.stats = {
            'reddit_mentions_processed': 0,
            'spotify_validated': 0,
            'spotify_rejected': 0,
            'validation_errors': 0
        }

    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings"""
        import os
        client_id = crawler.settings.get('SPOTIFY_CLIENT_ID') or os.getenv('SPOTIFY_CLIENT_ID')
        client_secret = crawler.settings.get('SPOTIFY_CLIENT_SECRET') or os.getenv('SPOTIFY_CLIENT_SECRET')
        return cls(
            spotify_client_id=client_id,
            spotify_client_secret=client_secret
        )

    def _get_spotify_credential(self, credential_type: str) -> Optional[str]:
        """Load Spotify credentials from environment or database"""
        import os

        env_var = f'SPOTIFY_{credential_type.upper()}'
        cred = os.getenv(env_var)
        if cred:
            return cred

        # Try centralized secrets manager
        try:
            from common.secrets_manager import get_secret
            cred = get_secret(env_var, required=False)
            if cred:
                return cred
        except Exception as e:
            logger.debug(f"Could not load {env_var} from secrets manager: {e}")

        return None

    def _get_spotify_token(self) -> Optional[str]:
        """Get or refresh Spotify access token (OAuth Client Credentials)"""
        # Check if token is still valid
        if self.access_token and self.token_expiry and datetime.utcnow() < self.token_expiry:
            return self.access_token

        if not (self.spotify_client_id and self.spotify_client_secret):
            logger.warning("Spotify credentials not available - skipping validation")
            return None

        # Request new token
        try:
            auth_str = f"{self.spotify_client_id}:{self.spotify_client_secret}"
            auth_bytes = auth_str.encode('utf-8')
            auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

            headers = {
                'Authorization': f'Basic {auth_base64}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }

            response = requests.post(
                'https://accounts.spotify.com/api/token',
                headers=headers,
                data={'grant_type': 'client_credentials'},
                timeout=10
            )

            response.raise_for_status()
            data = response.json()

            self.access_token = data['access_token']
            expires_in = data.get('expires_in', 3600)
            self.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in - 60)

            logger.debug(f"Spotify token refreshed (expires in {expires_in}s)")
            return self.access_token

        except requests.RequestException as e:
            logger.error(f"Failed to get Spotify token: {e}")
            return None

    def process_item(self, item, spider):
        """Process Reddit items and validate track mentions"""
        adapter = ItemAdapter(item)

        # Only process items from Reddit spider
        data_source = adapter.get('data_source')
        if data_source != 'reddit':
            return item

        self.stats['reddit_mentions_processed'] += 1

        # Get track mention data
        track_name = adapter.get('track_name')
        artist_name = adapter.get('original_artist') or adapter.get('artist_name')

        if not (track_name and artist_name):
            logger.debug("Reddit item missing track or artist - skipping validation")
            return item

        # Stage 2: Validate with Spotify
        try:
            spotify_match = self._validate_with_spotify(
                artist=artist_name,
                title=track_name
            )

            if spotify_match:
                # Stage 3: Confirmed match - enrich item
                self._enrich_with_spotify_data(adapter, spotify_match)
                self.stats['spotify_validated'] += 1
                logger.info(f"✓ Reddit mention validated: {artist_name} - {track_name}")
            else:
                # Rejected - low confidence or no match
                self.stats['spotify_rejected'] += 1
                logger.debug(f"✗ Reddit mention rejected: {artist_name} - {track_name}")
                # Mark as unvalidated in metadata
                metadata = json.loads(adapter.get('metadata', '{}'))
                metadata['spotify_validated'] = False
                adapter['metadata'] = json.dumps(metadata)

        except Exception as e:
            logger.error(f"Validation error: {e}")
            self.stats['validation_errors'] += 1

        return item

    def _validate_with_spotify(self, artist: str, title: str) -> Optional[Dict]:
        """
        Validate track mention against Spotify API.

        Args:
            artist: Artist name
            title: Track title

        Returns:
            Spotify track data dict if validated, None otherwise
        """
        token = self._get_spotify_token()
        if not token:
            return None

        # Construct search query
        query = f"artist:{artist} track:{title}"

        headers = {
            'Authorization': f'Bearer {token}'
        }

        try:
            response = requests.get(
                'https://api.spotify.com/v1/search',
                headers=headers,
                params={'q': query, 'type': 'track', 'limit': 5},
                timeout=10
            )

            if response.status_code == 429:
                logger.warning("Spotify rate limit hit")
                return None

            response.raise_for_status()
            data = response.json()

            tracks = data.get('tracks', {}).get('items', [])
            if not tracks:
                return None

            # Stage 3: Analyze results for high-confidence match
            top_result = tracks[0]

            # Calculate similarity score
            similarity = self._calculate_similarity(
                query_artist=artist.lower(),
                query_title=title.lower(),
                result_artist=top_result['artists'][0]['name'].lower(),
                result_title=top_result['name'].lower()
            )

            # Check against threshold
            if similarity >= self.SIMILARITY_THRESHOLD:
                logger.debug(f"Match score {similarity:.2f}: {artist} - {title}")
                return top_result
            else:
                logger.debug(f"Low match score {similarity:.2f}: {artist} - {title}")
                return None

        except requests.RequestException as e:
            logger.error(f"Spotify search error: {e}")
            return None

    def _calculate_similarity(
        self,
        query_artist: str,
        query_title: str,
        result_artist: str,
        result_title: str
    ) -> float:
        """
        Calculate similarity score between query and result.

        Uses simple substring matching (can be improved with fuzzy matching libraries).

        Returns:
            Similarity score 0.0 - 1.0
        """
        from difflib import SequenceMatcher

        # Artist similarity
        artist_sim = SequenceMatcher(None, query_artist, result_artist).ratio()

        # Title similarity
        title_sim = SequenceMatcher(None, query_title, result_title).ratio()

        # Weighted average (artist match more important)
        similarity = (artist_sim * 0.6) + (title_sim * 0.4)

        return similarity

    def _enrich_with_spotify_data(self, adapter: ItemAdapter, spotify_data: Dict):
        """Enrich Reddit item with validated Spotify data"""
        # Add canonical Spotify IDs
        adapter['spotify_id'] = spotify_data.get('id')
        adapter['isrc'] = spotify_data.get('external_ids', {}).get('isrc')

        # Add metadata
        metadata = json.loads(adapter.get('metadata', '{}'))
        metadata['spotify_validated'] = True
        metadata['spotify'] = {
            'track_id': spotify_data.get('id'),
            'track_name': spotify_data.get('name'),
            'artist_name': spotify_data['artists'][0]['name'] if spotify_data.get('artists') else None,
            'popularity': spotify_data.get('popularity'),
            'duration_ms': spotify_data.get('duration_ms'),
            'explicit': spotify_data.get('explicit'),
            'preview_url': spotify_data.get('preview_url'),
            'validation_timestamp': datetime.utcnow().isoformat()
        }
        adapter['metadata'] = json.dumps(metadata)

        # Update external URLs
        external_urls = json.loads(adapter.get('external_urls', '{}'))
        if 'spotify' in spotify_data.get('external_urls', {}):
            external_urls['spotify'] = spotify_data['external_urls']['spotify']
        adapter['external_urls'] = json.dumps(external_urls)

        logger.debug(f"Enriched Reddit mention with Spotify ID: {spotify_data.get('id')}")

    def close_spider(self, spider):
        """Log pipeline statistics"""
        logger.info(
            f"Reddit Validation Stats: "
            f"{self.stats['reddit_mentions_processed']} processed, "
            f"{self.stats['spotify_validated']} validated, "
            f"{self.stats['spotify_rejected']} rejected"
        )
