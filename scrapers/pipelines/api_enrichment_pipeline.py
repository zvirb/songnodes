"""
General-Purpose API Enrichment Pipeline - Thin Client (Delegation Mode)
========================================================================

Delegates ALL enrichment to the metadata-enrichment microservice.

This pipeline is now a thin HTTP client that:
1. Extracts track info from scraped items
2. Calls metadata-enrichment service via HTTP
3. Applies returned enrichment data to item

Priority: 250 (after EnrichmentPipeline, before Persistence)

Architecture: Unified enrichment with shared resilience patterns
- Circuit breaker: Handled by metadata-enrichment service
- Caching: Handled by metadata-enrichment service
- Retries: Handled by metadata-enrichment service
- DLQ: Handled by metadata-enrichment service

Benefits:
- Single source of truth for enrichment logic
- Consistent resilience patterns across all consumers
- Reduced code duplication
- Easier maintenance and testing
- Centralized API key management
"""

import logging
import httpx
import os
import json
from typing import Dict, Optional
from itemadapter import ItemAdapter
from datetime import datetime

logger = logging.getLogger(__name__)

# Prometheus metrics (lazy import to avoid hard dependency)
try:
    from prometheus_client import Counter, Histogram
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    logger.warning("prometheus_client not available - metrics disabled")


class APIEnrichmentPipeline:
    """
    Thin client that delegates enrichment to the metadata-enrichment service.

    This eliminates code duplication and ensures consistent enrichment behavior
    across all data sources (scrapers, manual uploads, etc.).
    """

    def __init__(self,
                 enrichment_service_url: str = None,
                 enable_fallback: bool = False,
                 timeout: float = 60.0):
        """
        Initialize the enrichment client.

        Args:
            enrichment_service_url: URL of metadata-enrichment service
            enable_fallback: If True, fall back to legacy inline enrichment if service unavailable
            timeout: HTTP request timeout in seconds
        """
        self.enrichment_service_url = enrichment_service_url or os.getenv(
            "METADATA_ENRICHMENT_URL",
            "http://metadata-enrichment:8020"
        )

        self.enable_fallback = enable_fallback
        self.timeout = timeout

        # Create persistent HTTP client with connection pooling
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.timeout, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )

        # Prometheus metrics
        self._init_metrics()

        # Statistics
        self.stats = {
            'total_tracks': 0,
            'enriched': 0,
            'already_enriched': 0,
            'service_errors': 0,
            'service_unavailable': 0,
            'skipped': 0,
            'fallback_used': 0
        }

        logger.info(
            f"APIEnrichmentPipeline initialized in DELEGATION mode: {self.enrichment_service_url}"
        )

    def _init_metrics(self):
        """Initialize Prometheus metrics"""
        if not PROMETHEUS_AVAILABLE:
            self.metrics = None
            return

        try:
            self.metrics = {
                'enrichment_requests_total': Counter(
                    'scraper_enrichment_requests_total',
                    'Total enrichment requests to service',
                    ['status']
                ),
                'enrichment_duration_seconds': Histogram(
                    'scraper_enrichment_duration_seconds',
                    'Enrichment request duration',
                    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
                )
            }
            logger.info("Prometheus metrics initialized")
        except Exception as e:
            logger.warning(f"Could not initialize Prometheus metrics: {e}")
            self.metrics = None

    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings"""
        return cls(
            enrichment_service_url=crawler.settings.get('METADATA_ENRICHMENT_URL') or os.getenv('METADATA_ENRICHMENT_URL'),
            enable_fallback=crawler.settings.get('ENRICHMENT_FALLBACK_ENABLED', False),
            timeout=crawler.settings.get('ENRICHMENT_TIMEOUT', 60.0)
        )

    async def process_item(self, item, spider):
        """Delegate enrichment to metadata-enrichment service"""
        adapter = ItemAdapter(item)

        # Skip track-artist relationship items
        item_class_name = item.__class__.__name__
        if 'TrackArtist' in item_class_name or 'Adjacency' in item_class_name:
            return item

        # Only process tracks (not playlists, artists, etc.)
        item_type = adapter.get('item_type')
        if item_type and item_type != 'track':
            return item

        self.stats['total_tracks'] += 1

        # Skip if already enriched (has spotify_id)
        if adapter.get('spotify_id'):
            self.stats['already_enriched'] += 1
            logger.debug(f"Track already enriched (has spotify_id): {adapter.get('artist_name')} - {adapter.get('track_name')}")
            return item

        # Extract required fields
        artist = self._get_primary_artist(adapter)
        title = adapter.get('track_name') or adapter.get('title')

        # Try parsing from source_context if missing
        if not title:
            source_context = adapter.get('source_context')
            if source_context and ' - ' in source_context:
                title = source_context.split(' - ', 1)[1].strip()
                logger.debug(f"Parsed title from source_context: '{title}'")

        if not (artist and title):
            # Log which field is missing for better debugging
            missing_fields = []
            if not artist:
                missing_fields.append('artist')
            if not title:
                missing_fields.append('title')

            logger.warning(
                f"⚠️ Track missing required fields for enrichment: {', '.join(missing_fields)}. "
                f"Available fields: {list(adapter.keys())}",
                extra={
                    'missing_fields': missing_fields,
                    'available_fields': list(adapter.keys()),
                    'source': adapter.get('data_source', 'unknown')
                }
            )
            self.stats['skipped'] += 1
            return item

        logger.debug(f"Attempting to enrich track: {artist} - {title}")

        # Call enrichment service
        try:
            enrichment_data = await self._enrich_via_service(
                track_id=adapter.get('track_id') or adapter.get('id'),
                artist_name=artist,
                track_title=title,
                existing_spotify_id=adapter.get('spotify_id'),
                existing_isrc=adapter.get('isrc'),
                existing_musicbrainz_id=adapter.get('metadata', {}).get('musicbrainz_id') if isinstance(adapter.get('metadata'), dict) else None
            )

            if enrichment_data and enrichment_data.get('status') in ['completed', 'partial']:
                # Apply enrichment to item
                metadata_acquired = enrichment_data.get('metadata_acquired', {})
                sources_used = enrichment_data.get('sources_used', [])

                # Log what data was actually acquired
                acquired_fields = [k for k, v in metadata_acquired.items() if v is not None]
                logger.info(
                    f"✓ Enriched '{artist} - {title}': status={enrichment_data.get('status')}, "
                    f"sources={', '.join(sources_used)}, fields={', '.join(acquired_fields)}",
                    extra={
                        'artist': artist,
                        'title': title,
                        'status': enrichment_data.get('status'),
                        'sources': sources_used,
                        'fields_acquired': acquired_fields,
                        'cached': enrichment_data.get('cached', False)
                    }
                )

                self._apply_enrichment_data(adapter, enrichment_data)
                self.stats['enriched'] += 1

                # Track metrics
                if self.metrics:
                    self.metrics['enrichment_requests_total'].labels(status='success').inc()
            else:
                status = enrichment_data.get('status', 'no_response') if enrichment_data else 'no_response'
                errors = enrichment_data.get('errors', []) if enrichment_data else []

                logger.warning(
                    f"⚠️ No enrichment data for '{artist} - {title}': status={status}",
                    extra={
                        'artist': artist,
                        'title': title,
                        'status': status,
                        'errors': errors
                    }
                )

                if self.metrics:
                    self.metrics['enrichment_requests_total'].labels(status='no_data').inc()

        except httpx.ConnectError as e:
            logger.warning(f"Enrichment service unavailable: {e}")
            self.stats['service_unavailable'] += 1

            if self.enable_fallback:
                logger.info("Fallback mode enabled but not implemented - item will be queued for retry")
                self.stats['fallback_used'] += 1

            if self.metrics:
                self.metrics['enrichment_requests_total'].labels(status='service_unavailable').inc()

        except Exception as e:
            logger.error(f"Enrichment service error: {e}")
            self.stats['service_errors'] += 1

            if self.metrics:
                self.metrics['enrichment_requests_total'].labels(status='error').inc()

        return item

    async def _enrich_via_service(self, **kwargs) -> Optional[Dict]:
        """
        Call metadata-enrichment service.

        POST /enrich
        {
            "track_id": "uuid",
            "artist_name": "Artist Name",
            "track_title": "Track Title",
            "existing_spotify_id": "optional",
            "existing_isrc": "optional",
            "existing_musicbrainz_id": "optional"
        }

        Returns:
        {
            "track_id": "uuid",
            "status": "completed|partial|failed",
            "sources_used": ["spotify", "musicbrainz"],
            "metadata_acquired": {
                "spotify_id": "...",
                "isrc": "...",
                "bpm": 128,
                ...
            },
            "errors": [],
            "duration_seconds": 2.5,
            "cached": false,
            "timestamp": "2025-10-10T..."
        }
        """
        import time

        # Clean kwargs - remove None values
        payload = {k: v for k, v in kwargs.items() if v is not None}

        start_time = time.time()
        try:
            response = await self.http_client.post(
                f"{self.enrichment_service_url}/enrich",
                json=payload,
                timeout=self.timeout
            )

            duration = time.time() - start_time

            # Track duration metric
            if self.metrics:
                self.metrics['enrichment_duration_seconds'].observe(duration)

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 503:
                logger.warning(f"Enrichment service temporarily unavailable (503)")
                return None
            else:
                logger.warning(
                    f"Enrichment service returned {response.status_code}: {response.text[:200]}"
                )
                return None

        except httpx.TimeoutException:
            duration = time.time() - start_time
            logger.warning(f"Enrichment service timeout after {duration:.1f}s")
            if self.metrics:
                self.metrics['enrichment_duration_seconds'].observe(duration)
            return None

        except httpx.HTTPStatusError as e:
            logger.warning(f"Enrichment service HTTP error: {e.response.status_code}")
            return None

        except httpx.RequestError as e:
            logger.error(f"Failed to connect to enrichment service: {e}")
            raise  # Re-raise to be caught by ConnectError handler

    def _apply_enrichment_data(self, adapter: ItemAdapter, data: Dict):
        """
        Apply enrichment data to item.

        The metadata-enrichment service returns a flat dict of fields.
        We apply these directly to the item.
        """
        metadata_acquired = data.get('metadata_acquired', {})

        # Apply all enriched fields
        for field, value in metadata_acquired.items():
            if value is not None:
                # Handle JSONB fields specially
                if field in ['metadata', 'external_urls']:
                    # These are already JSON strings from the service
                    adapter[field] = value if isinstance(value, str) else json.dumps(value)
                else:
                    adapter[field] = value

        # Add enrichment provenance to metadata
        if metadata_acquired:
            try:
                metadata = json.loads(adapter.get('metadata', '{}'))
                metadata['enrichment'] = {
                    'service': 'metadata-enrichment',
                    'status': data.get('status'),
                    'sources_used': data.get('sources_used', []),
                    'cached': data.get('cached', False),
                    'enriched_at': data.get('timestamp') or datetime.utcnow().isoformat()
                }
                adapter['metadata'] = json.dumps(metadata)
            except Exception as e:
                logger.warning(f"Could not update enrichment metadata: {e}")

    def _get_primary_artist(self, adapter: ItemAdapter) -> Optional[str]:
        """Extract primary artist from various field names or parse from source_context"""
        # Try standard artist fields first
        artist = (
            adapter.get('original_artist') or
            adapter.get('artist_name') or
            adapter.get('artist') or
            (adapter.get('artists', [{}])[0].get('name') if adapter.get('artists') else None)
        )

        if artist:
            return artist

        # Fallback: Parse artist from source_context (format: "Artist - Title (Remix)")
        source_context = adapter.get('source_context')
        if source_context and ' - ' in source_context:
            artist = source_context.split(' - ')[0].strip()
            return artist if artist else None

        return None

    async def close_spider(self, spider):
        """Close HTTP client and log stats"""
        await self.http_client.aclose()

        # Calculate success rate
        total_processed = self.stats['enriched'] + self.stats['service_errors'] + self.stats['service_unavailable']
        success_rate = (self.stats['enriched'] / total_processed * 100) if total_processed > 0 else 0.0

        logger.info(
            f"\n{'='*60}\n"
            f"API Enrichment Pipeline Statistics (Service Delegation)\n"
            f"{'='*60}\n"
            f"Total tracks processed:     {self.stats['total_tracks']}\n"
            f"Already enriched:           {self.stats['already_enriched']}\n"
            f"Enriched via service:       {self.stats['enriched']}\n"
            f"Service errors:             {self.stats['service_errors']}\n"
            f"Service unavailable:        {self.stats['service_unavailable']}\n"
            f"Skipped (no artist/title):  {self.stats['skipped']}\n"
            f"Fallback used:              {self.stats['fallback_used']}\n"
            f"Success rate:               {success_rate:.1f}%\n"
            f"{'='*60}\n"
            f"Enrichment Service: {self.enrichment_service_url}\n"
            f"{'='*60}\n"
            f"NOTE: All enrichment logic is now handled by the metadata-enrichment\n"
            f"      microservice, which provides:\n"
            f"      - Circuit breaker pattern (auto-recovery from API failures)\n"
            f"      - Redis caching (7-30 day TTL)\n"
            f"      - Automatic retries with exponential backoff\n"
            f"      - DLQ for failed enrichments\n"
            f"      - Waterfall enrichment (Spotify -> MusicBrainz -> Last.fm)\n"
            f"{'='*60}\n"
        )
