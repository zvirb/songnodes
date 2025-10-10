"""
Configuration-Driven Waterfall Enrichment

This module implements a metadata enrichment pipeline that uses database-driven
configuration instead of hardcoded provider priorities.

Benefits:
- Dynamic reconfiguration without code changes
- Per-field provider priorities
- Confidence thresholds per provider
- Provenance tracking (which provider supplied which field)
- Hot-reload support for configuration changes
"""

import time
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

import structlog
from prometheus_client import Counter

from config_loader import EnrichmentConfigLoader

logger = structlog.get_logger(__name__)

# Prometheus metrics for provider usage
provider_field_usage = Counter(
    'enrichment_provider_field_usage_total',
    'Provider usage per metadata field',
    ['provider', 'field', 'success']
)

provider_waterfall_position = Counter(
    'enrichment_provider_waterfall_position_total',
    'Provider waterfall position usage',
    ['provider', 'field', 'priority']
)


class ConfigDrivenEnricher:
    """
    Configuration-driven metadata enrichment using database waterfall priorities
    """

    def __init__(
        self,
        config_loader: EnrichmentConfigLoader,
        api_clients: Dict[str, Any]
    ):
        """
        Initialize configuration-driven enricher

        Args:
            config_loader: EnrichmentConfigLoader instance
            api_clients: Dictionary mapping provider names to client instances
                         e.g., {'spotify': spotify_client, 'beatport': beatport_client}
        """
        self.config_loader = config_loader
        self.api_clients = api_clients

        # Field extractor mapping (provider name + field -> method)
        self.field_extractors = self._build_field_extractors()

    def _build_field_extractors(self) -> Dict[Tuple[str, str], callable]:
        """
        Build mapping of (provider, field) -> extractor function

        Returns:
            Dictionary mapping (provider_name, field_name) to extraction method
        """
        extractors = {}

        # Spotify extractors
        if 'spotify' in self.api_clients:
            client = self.api_clients['spotify']
            extractors.update({
                ('spotify', 'spotify_id'): lambda data: data.get('id'),
                ('spotify', 'isrc'): lambda data: data.get('external_ids', {}).get('isrc'),
                ('spotify', 'duration_ms'): lambda data: data.get('duration_ms'),
                ('spotify', 'bpm'): lambda data: data.get('audio_features', {}).get('tempo'),
                ('spotify', 'key'): lambda data: self._extract_spotify_key(data),
                ('spotify', 'energy'): lambda data: data.get('audio_features', {}).get('energy'),
                ('spotify', 'danceability'): lambda data: data.get('audio_features', {}).get('danceability'),
                ('spotify', 'valence'): lambda data: data.get('audio_features', {}).get('valence'),
                ('spotify', 'genre'): lambda data: self._extract_spotify_genre(data),
                ('spotify', 'release_date'): lambda data: data.get('album', {}).get('release_date'),
                ('spotify', 'artist_name'): lambda data: ', '.join(a['name'] for a in data.get('artists', [])),
                ('spotify', 'track_title'): lambda data: data.get('name'),
            })

        # MusicBrainz extractors
        if 'musicbrainz' in self.api_clients:
            extractors.update({
                ('musicbrainz', 'musicbrainz_id'): lambda data: data.get('id'),
                ('musicbrainz', 'isrc'): lambda data: data.get('isrc'),
                ('musicbrainz', 'artist_name'): lambda data: data.get('artist-credit-phrase'),
                ('musicbrainz', 'track_title'): lambda data: data.get('title'),
                ('musicbrainz', 'release_date'): lambda data: data.get('first-release-date'),
                ('musicbrainz', 'duration_ms'): lambda data: data.get('length'),
            })

        # Beatport extractors
        if 'beatport' in self.api_clients:
            extractors.update({
                ('beatport', 'beatport_id'): lambda data: data.get('id'),
                ('beatport', 'bpm'): lambda data: data.get('bpm'),
                ('beatport', 'key'): lambda data: data.get('key'),
                ('beatport', 'genre'): lambda data: data.get('genre', {}).get('name'),
                ('beatport', 'release_date'): lambda data: data.get('publish_date'),
            })

        # AcousticBrainz extractors
        if 'acousticbrainz' in self.api_clients:
            extractors.update({
                ('acousticbrainz', 'bpm'): lambda data: data.get('rhythm', {}).get('bpm'),
                ('acousticbrainz', 'key'): lambda data: data.get('tonal', {}).get('key_key'),
                ('acousticbrainz', 'energy'): lambda data: data.get('highlevel', {}).get('mood_aggressive', {}).get('probability'),
                ('acousticbrainz', 'danceability'): lambda data: data.get('highlevel', {}).get('danceability', {}).get('probability'),
            })

        # Last.fm extractors
        if 'lastfm' in self.api_clients:
            extractors.update({
                ('lastfm', 'genre'): lambda data: self._extract_lastfm_genre(data),
            })

        # Discogs extractors
        if 'discogs' in self.api_clients:
            extractors.update({
                ('discogs', 'discogs_id'): lambda data: data.get('id'),
                ('discogs', 'genre'): lambda data: data.get('genre', [{}])[0] if data.get('genre') else None,
                ('discogs', 'release_date'): lambda data: data.get('year'),
            })

        return extractors

    async def enrich_fields_from_config(
        self,
        task,
        existing_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Enrich metadata fields using configuration-driven waterfall

        Args:
            task: EnrichmentTask with track information
            existing_data: Optional dictionary with existing API responses

        Returns:
            Dictionary with enriched metadata and provenance tracking
        """
        # Reload config if stale (hot-reload support)
        await self.config_loader.reload_if_stale()

        enriched_metadata = {}
        provenance = {}  # Track which provider supplied which field

        # Get all configured fields
        configured_fields = self.config_loader.get_all_configured_fields()

        logger.info(
            "Starting configuration-driven enrichment",
            fields_to_enrich=len(configured_fields),
            track_id=task.track_id
        )

        for field_name in configured_fields:
            # Get waterfall priorities for this field
            priorities = self.config_loader.get_providers_for_field(field_name)

            if not priorities:
                logger.debug(f"No providers configured for field: {field_name}")
                continue

            # Try each provider in priority order
            for priority_idx, (provider_name, min_confidence) in enumerate(priorities, start=1):
                try:
                    value, confidence = await self._extract_field_from_provider(
                        provider_name=provider_name,
                        field_name=field_name,
                        task=task,
                        existing_data=existing_data
                    )

                    # Track waterfall position usage
                    provider_waterfall_position.labels(
                        provider=provider_name,
                        field=field_name,
                        priority=priority_idx
                    ).inc()

                    if value is not None and confidence >= min_confidence:
                        # Success! Accept this value
                        enriched_metadata[field_name] = value
                        provenance[field_name] = {
                            'provider': provider_name,
                            'confidence': confidence,
                            'priority': priority_idx,
                            'timestamp': datetime.utcnow().isoformat()
                        }

                        # Track successful provider usage
                        provider_field_usage.labels(
                            provider=provider_name,
                            field=field_name,
                            success='true'
                        ).inc()

                        logger.debug(
                            f"✓ {field_name} enriched from {provider_name}",
                            confidence=confidence,
                            priority=priority_idx,
                            value=str(value)[:50]  # Truncate for logging
                        )

                        # Stop waterfall - we have a good value
                        break

                    elif value is not None:
                        # Value exists but confidence too low
                        logger.debug(
                            f"⚠ {field_name} from {provider_name} has low confidence",
                            confidence=confidence,
                            min_required=min_confidence,
                            priority=priority_idx
                        )
                        # Continue to next provider

                    # Track failed provider usage
                    provider_field_usage.labels(
                        provider=provider_name,
                        field=field_name,
                        success='false'
                    ).inc()

                except Exception as e:
                    logger.warning(
                        f"Failed to extract {field_name} from {provider_name}",
                        error=str(e),
                        priority=priority_idx
                    )
                    # Continue to next provider
                    provider_field_usage.labels(
                        provider=provider_name,
                        field=field_name,
                        success='error'
                    ).inc()

            # Log if waterfall exhausted without success
            if field_name not in enriched_metadata:
                logger.info(
                    f"✗ {field_name} waterfall exhausted - no acceptable value found",
                    providers_tried=len(priorities)
                )

        # Add provenance to metadata
        enriched_metadata['_provenance'] = provenance

        logger.info(
            "Configuration-driven enrichment completed",
            fields_enriched=len(enriched_metadata) - 1,  # -1 for _provenance
            total_fields=len(configured_fields),
            success_rate=f"{(len(enriched_metadata) - 1) / len(configured_fields) * 100:.1f}%"
        )

        return enriched_metadata

    async def _extract_field_from_provider(
        self,
        provider_name: str,
        field_name: str,
        task,
        existing_data: Optional[Dict[str, Any]] = None
    ) -> Tuple[Any, float]:
        """
        Extract a specific field from a provider

        Args:
            provider_name: Provider name (e.g., 'spotify', 'beatport')
            field_name: Field to extract (e.g., 'bpm', 'key')
            task: EnrichmentTask
            existing_data: Optional cached API responses

        Returns:
            (value, confidence) tuple
        """
        client = self.api_clients.get(provider_name)

        if not client:
            logger.warning(f"Provider {provider_name} not available (no client)")
            return None, 0.0

        # Check if we already have data from this provider
        provider_data = None
        if existing_data and provider_name in existing_data:
            provider_data = existing_data[provider_name]
        else:
            # Fetch data from provider
            provider_data = await self._fetch_from_provider(provider_name, client, task)

        if not provider_data:
            return None, 0.0

        # Extract field using configured extractor
        extractor_key = (provider_name, field_name)
        extractor = self.field_extractors.get(extractor_key)

        if not extractor:
            logger.debug(f"No extractor for {provider_name}.{field_name}")
            return None, 0.0

        try:
            value = extractor(provider_data)

            # Calculate confidence (simplified - could be more sophisticated)
            confidence = self._calculate_field_confidence(
                provider_name,
                field_name,
                value,
                provider_data
            )

            return value, confidence

        except Exception as e:
            logger.warning(
                f"Extractor failed for {provider_name}.{field_name}",
                error=str(e)
            )
            return None, 0.0

    async def _fetch_from_provider(
        self,
        provider_name: str,
        client: Any,
        task
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch track data from provider API

        Args:
            provider_name: Provider name
            client: API client instance
            task: EnrichmentTask

        Returns:
            API response data or None
        """
        try:
            if provider_name == 'spotify':
                # Try ID-based lookup first
                if task.existing_spotify_id:
                    return await client.get_track_by_id(task.existing_spotify_id)
                elif task.existing_isrc:
                    return await client.search_by_isrc(task.existing_isrc)
                else:
                    return await client.search_track(task.artist_name, task.track_title)

            elif provider_name == 'musicbrainz':
                if task.existing_isrc:
                    return await client.search_by_isrc(task.existing_isrc)
                else:
                    return await client.search_recording(task.artist_name, task.track_title)

            elif provider_name == 'beatport':
                return await client.search(task.artist_name, task.track_title)

            elif provider_name == 'acousticbrainz':
                if task.existing_musicbrainz_id:
                    return await client.get_audio_features(task.existing_musicbrainz_id)

            elif provider_name == 'lastfm':
                return await client.get_track_info(task.artist_name, task.track_title)

            elif provider_name == 'discogs':
                return await client.search(task.artist_name, task.track_title)

            return None

        except Exception as e:
            logger.error(
                f"Failed to fetch from {provider_name}",
                error=str(e),
                track_id=task.track_id
            )
            return None

    def _calculate_field_confidence(
        self,
        provider_name: str,
        field_name: str,
        value: Any,
        provider_data: Dict[str, Any]
    ) -> float:
        """
        Calculate confidence score for a field value

        Args:
            provider_name: Provider that supplied the value
            field_name: Field name
            value: Extracted value
            provider_data: Full provider response

        Returns:
            Confidence score (0.0-1.0)
        """
        if value is None:
            return 0.0

        # Base confidence by provider (could be loaded from config)
        provider_base_confidence = {
            'spotify': 0.95,
            'beatport': 0.98,  # Beatport is very accurate for EDM
            'musicbrainz': 0.90,
            'acousticbrainz': 0.75,
            'lastfm': 0.70,
            'discogs': 0.80
        }

        base = provider_base_confidence.get(provider_name, 0.60)

        # Adjust based on match quality indicators
        if provider_name == 'spotify' and provider_data.get('external_ids', {}).get('isrc'):
            # ISRC match = very high confidence
            base = min(1.0, base + 0.05)

        # Could add more sophisticated confidence calculation here
        # - Fuzzy match score
        # - Data completeness
        # - Historical provider accuracy

        return round(base, 2)

    def _extract_spotify_key(self, data: Dict) -> Optional[str]:
        """Extract musical key from Spotify data"""
        audio_features = data.get('audio_features', {})
        key_num = audio_features.get('key')
        mode = audio_features.get('mode')

        if key_num is None or mode is None:
            return None

        key_map = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_str = f"{key_map[key_num]} {'Major' if mode == 1 else 'Minor'}"

        return key_str

    def _extract_spotify_genre(self, data: Dict) -> Optional[str]:
        """Extract genre from Spotify data"""
        # Spotify doesn't provide genre at track level, but at artist level
        artists = data.get('artists', [])
        if artists and 'genres' in artists[0]:
            genres = artists[0]['genres']
            return genres[0] if genres else None
        return None

    def _extract_lastfm_genre(self, data: Dict) -> Optional[str]:
        """Extract genre from Last.fm tags"""
        tags = data.get('toptags', {}).get('tag', [])
        if tags:
            # Return the most popular tag as genre
            return tags[0].get('name') if isinstance(tags, list) else tags.get('name')
        return None
