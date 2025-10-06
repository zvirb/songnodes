"""
Waterfall metadata enrichment pipeline
Follows the research-based sequential enrichment strategy
"""

import asyncio
import hashlib
import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

import redis.asyncio as aioredis
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from fuzzy_matcher import LabelAwareFuzzyMatcher
from artist_populator import ArtistPopulator

logger = structlog.get_logger(__name__)


class MetadataEnrichmentPipeline:
    """
    Waterfall enrichment pipeline implementing the strategy:
    1. spotify_id → Spotify API (get ISRC, audio features, basic metadata)
    2. ISRC → MusicBrainz (get musicbrainz_id, canonical identifiers)
    3. Text search fallback (artist/title) when no identifiers available
    4. Discogs for release-specific metadata
    5. Last.fm for user-generated tags and popularity
    """

    def __init__(
        self,
        spotify_client,
        musicbrainz_client,
        discogs_client,
        beatport_client,
        lastfm_client,
        acousticbrainz_client,
        getsongbpm_client,
        sonoteller_client,
        db_session_factory: async_sessionmaker,
        redis_client: aioredis.Redis
    ):
        self.spotify_client = spotify_client
        self.musicbrainz_client = musicbrainz_client
        self.discogs_client = discogs_client
        self.beatport_client = beatport_client
        self.lastfm_client = lastfm_client
        self.acousticbrainz_client = acousticbrainz_client
        self.getsongbpm_client = getsongbpm_client
        self.sonoteller_client = sonoteller_client
        self.db_session_factory = db_session_factory
        self.redis_client = redis_client

        # Initialize fuzzy matcher for Unknown artist detection
        self.fuzzy_matcher = LabelAwareFuzzyMatcher(
            spotify_client=spotify_client,
            musicbrainz_client=musicbrainz_client,
            discogs_client=discogs_client,
            tidal_client=None  # Not currently using Tidal
        )

        # Initialize artist populator
        self.artist_populator = ArtistPopulator(
            db_session_factory=db_session_factory,
            spotify_client=spotify_client
        )

    async def enrich_track(self, task) -> Any:
        """Execute the waterfall enrichment pipeline for a track"""
        from main import EnrichmentResult, EnrichmentStatus, EnrichmentSource

        start_time = time.time()
        sources_used = []
        metadata = {}
        errors = []
        cached = False

        correlation_id = task.correlation_id or "unknown"

        structlog.contextvars.bind_contextvars(
            track_id=task.track_id,
            correlation_id=correlation_id
        )

        logger.info(
            "Starting track enrichment",
            artist=task.artist_name,
            title=task.track_title
        )

        # Check if we should use cache
        if not task.force_refresh:
            cache_key = self._get_cache_key(task.track_id)
            cached_result = await self.redis_client.get(cache_key)

            if cached_result:
                logger.debug("Using cached enrichment result", track_id=task.track_id)
                cached = True
                cached_data = json.loads(cached_result)
                duration = time.time() - start_time

                return EnrichmentResult(
                    track_id=task.track_id,
                    status=EnrichmentStatus(cached_data['status']),
                    sources_used=[EnrichmentSource(s) for s in cached_data['sources_used']],
                    metadata_acquired=cached_data['metadata'],
                    errors=cached_data.get('errors', []),
                    duration_seconds=duration,
                    cached=True,
                    timestamp=datetime.now()
                )

        try:
            # STEP 0: Check ISRC availability (CRITICAL for deduplication)
            isrc = task.existing_isrc or metadata.get('isrc')
            if not isrc:
                logger.warning(
                    "Track missing ISRC - will attempt to populate from Spotify/MusicBrainz",
                    track_id=task.track_id,
                    artist=task.artist_name,
                    title=task.track_title
                )

            # STEP 0.5: Fuzzy match for tracks with Unknown/missing artists
            unknown_artist_indicators = ['unknown', 'various artists', 'various', 'unknown artist', None, '']
            artist_is_unknown = (
                not task.artist_name or
                task.artist_name.lower().strip() in unknown_artist_indicators
            )

            if artist_is_unknown:
                logger.info(
                    "Step 0.5: Fuzzy matching for Unknown artist",
                    title=task.track_title
                )

                try:
                    # Run fuzzy matcher
                    match = await self.fuzzy_matcher.match_track(
                        scraped_title=task.track_title,
                        scraped_artist=task.artist_name,
                        duration_ms=task.duration_ms if hasattr(task, 'duration_ms') else None,
                        release_year=task.release_year if hasattr(task, 'release_year') else None
                    )

                    if match:
                        logger.info(
                            "✓ Fuzzy match found",
                            title=match.title,
                            artists=match.artists,
                            label=match.label,
                            confidence=f"{match.confidence_score}%",
                            service=match.service
                        )

                        # Populate artists from the matched track
                        if match.service == 'spotify' and match.service_id:
                            populated = await self.artist_populator.populate_artists_from_spotify(
                                track_id=UUID(task.track_id),
                                spotify_track_id=match.service_id
                            )

                            if populated:
                                logger.info(
                                    "✓ Artists populated from fuzzy match",
                                    track_id=task.track_id,
                                    artists=match.artists
                                )
                                # Update metadata with fuzzy match results
                                metadata['fuzzy_matched'] = True
                                metadata['fuzzy_match_confidence'] = match.confidence_score
                                metadata['fuzzy_match_service'] = match.service

                                # Use the spotify_id for enrichment
                                if not task.existing_spotify_id:
                                    task.existing_spotify_id = match.service_id
                                    logger.info("Using fuzzy-matched spotify_id for enrichment")
                    else:
                        logger.info(
                            "✗ No fuzzy match found above threshold",
                            title=task.track_title
                        )

                except Exception as e:
                    logger.error(
                        "Fuzzy matching failed",
                        error=str(e),
                        exc_info=True
                    )
                    errors.append(f"Fuzzy matching error: {str(e)}")

            # STEP 1: Primary enrichment via Spotify (if spotify_id available)
            if task.existing_spotify_id:
                logger.info("Step 1: Enriching from Spotify ID", spotify_id=task.existing_spotify_id)
                spotify_data = await self._enrich_from_spotify_id(task.existing_spotify_id)

                if spotify_data:
                    sources_used.append(EnrichmentSource.SPOTIFY)
                    metadata.update(spotify_data)
                    logger.info("Spotify enrichment successful")

                    # CRITICAL: Check if ISRC was obtained from Spotify
                    if spotify_data.get('isrc') and not isrc:
                        isrc = spotify_data['isrc']
                        logger.info("✓ ISRC populated from Spotify", isrc=isrc)

                    # Get audio features - DISABLED due to Spotify API restrictions (Nov 2024)
                    # Spotify restricted audio-features endpoint to existing extended mode apps only
                    # See: https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api
                    # if self.spotify_client:
                    #     audio_features = await self.spotify_client.get_audio_features(
                    #         task.existing_spotify_id
                    #     )
                    #     if audio_features:
                    #         metadata['audio_features'] = audio_features
                    #         logger.info("Spotify audio features retrieved")

            # STEP 2: Enrichment via ISRC (if available or obtained from Spotify)
            if not isrc:
                isrc = metadata.get('isrc')  # Check again in case Spotify provided it

            if isrc:
                logger.info("Step 2: Enriching from ISRC", isrc=isrc)

                # Try Spotify ISRC search if we don't have Spotify data yet - only if client exists
                if self.spotify_client and EnrichmentSource.SPOTIFY not in sources_used:
                    spotify_isrc_data = await self.spotify_client.search_by_isrc(isrc)
                    if spotify_isrc_data:
                        sources_used.append(EnrichmentSource.SPOTIFY)
                        metadata.update(spotify_isrc_data)

                        # Get audio features - DISABLED (Spotify API restricted Nov 2024)
                        # if spotify_isrc_data.get('spotify_id'):
                        #     audio_features = await self.spotify_client.get_audio_features(
                        #         spotify_isrc_data['spotify_id']
                        #     )
                        #     if audio_features:
                        #         metadata['audio_features'] = audio_features
                        pass

                # MusicBrainz enrichment via ISRC
                mb_data = await self.musicbrainz_client.search_by_isrc(isrc)
                if mb_data:
                    sources_used.append(EnrichmentSource.MUSICBRAINZ)
                    metadata.update(mb_data)
                    logger.info("MusicBrainz ISRC enrichment successful")

            # STEP 3: Text-based search fallback
            if EnrichmentSource.SPOTIFY not in sources_used:
                logger.info(
                    "Step 3: Text-based search fallback",
                    artist=task.artist_name,
                    title=task.track_title
                )

                # Try Spotify search - only if client exists
                if self.spotify_client:
                    spotify_search = await self.spotify_client.search_track(
                        task.artist_name,
                        task.track_title
                    )
                    if spotify_search:
                        sources_used.append(EnrichmentSource.SPOTIFY)
                        metadata.update(spotify_search)
                        logger.info("Spotify search successful")

                        # Get audio features - DISABLED (Spotify API restricted Nov 2024)
                        # if spotify_search.get('spotify_id'):
                        #     audio_features = await self.spotify_client.get_audio_features(
                        #         spotify_search['spotify_id']
                        #     )
                        #     if audio_features:
                        #         metadata['audio_features'] = audio_features
                        pass

                # Update ISRC if we got it from search
                if metadata.get('isrc') and not isrc:
                    isrc = metadata['isrc']

            # STEP 4: MusicBrainz text search if we don't have MB data yet
            if EnrichmentSource.MUSICBRAINZ not in sources_used:
                logger.info("Step 4: MusicBrainz text search")

                mb_search = await self.musicbrainz_client.search_recording(
                    task.artist_name,
                    task.track_title
                )
                if mb_search:
                    sources_used.append(EnrichmentSource.MUSICBRAINZ)
                    metadata.update(mb_search)
                    logger.info("MusicBrainz search successful")

                    # CRITICAL: Check if ISRC was obtained from MusicBrainz
                    if mb_search.get('isrc') and not isrc:
                        isrc = mb_search['isrc']
                        logger.info("✓ ISRC populated from MusicBrainz", isrc=isrc)

            # STEP 5: Discogs for release-specific metadata
            logger.info("Step 5: Discogs enrichment")
            if self.discogs_client:
                discogs_data = await self.discogs_client.search(
                    task.artist_name,
                    task.track_title
                )
                if discogs_data:
                    sources_used.append(EnrichmentSource.DISCOGS)
                    metadata.update(discogs_data)
                    logger.info("Discogs enrichment successful")
            else:
                logger.debug("Skipping Discogs enrichment - no client available (missing credentials)")

            # STEP 6: Last.fm for tags and popularity
            logger.info("Step 6: Last.fm enrichment")
            if self.lastfm_client:
                lastfm_data = await self.lastfm_client.get_track_info(
                    task.artist_name,
                    task.track_title
                )
                if lastfm_data:
                    sources_used.append(EnrichmentSource.LASTFM)
                    metadata['lastfm'] = lastfm_data
                    logger.info("Last.fm enrichment successful")
            else:
                logger.debug("Skipping Last.fm enrichment - no client available (missing credentials)")

            # STEP 7: Audio features (BPM, key) enrichment
            logger.info("Step 7: Audio features enrichment (BPM, key)")

            # Try AcousticBrainz if we have MusicBrainz ID (free, good coverage for older tracks)
            musicbrainz_id = metadata.get('musicbrainz_id')
            if musicbrainz_id and self.acousticbrainz_client:
                ab_features = await self.acousticbrainz_client.get_audio_features(musicbrainz_id)
                if ab_features:
                    if 'bpm' in ab_features:
                        metadata['bpm'] = ab_features['bpm']
                    if 'key' in ab_features:
                        metadata['key'] = ab_features['key']
                        metadata['key_confidence'] = ab_features.get('key_confidence')
                    logger.info("✓ AcousticBrainz audio features retrieved", **ab_features)

            # Fallback: GetSongBPM if no BPM/key yet (free with attribution)
            if (not metadata.get('bpm') or not metadata.get('key')) and self.getsongbpm_client:
                gsbpm_features = await self.getsongbpm_client.search(task.artist_name, task.track_title)
                if gsbpm_features:
                    if 'bpm' in gsbpm_features and not metadata.get('bpm'):
                        metadata['bpm'] = gsbpm_features['bpm']
                    if 'key' in gsbpm_features and not metadata.get('key'):
                        metadata['key'] = gsbpm_features['key']
                    logger.info("✓ GetSongBPM audio features retrieved", **gsbpm_features)

            # Sonoteller.ai - Active data source (respects 5/month quota via internal tracking)
            # Use whenever BPM or key is missing (quota check happens inside client)
            if (not metadata.get('bpm') or not metadata.get('key')) and self.sonoteller_client:
                logger.info(
                    "🎵 Using Sonoteller.ai for audio analysis",
                    artist=task.artist_name,
                    title=task.track_title,
                    missing_bpm=not metadata.get('bpm'),
                    missing_key=not metadata.get('key')
                )

                sono_features = await self.sonoteller_client.analyze_track(
                    task.artist_name,
                    task.track_title,
                    spotify_id=metadata.get('spotify_id')
                )
                if sono_features:
                    if 'bpm' in sono_features and not metadata.get('bpm'):
                        metadata['bpm'] = sono_features['bpm']
                        if 'bpm_range' in sono_features:
                            metadata['bpm_range'] = sono_features['bpm_range']
                    if 'key' in sono_features and not metadata.get('key'):
                        metadata['key'] = sono_features['key']
                    if 'moods' in sono_features:
                        metadata['moods'] = sono_features['moods']
                    if 'genres' in sono_features:
                        metadata['ai_genres'] = sono_features['genres']
                    if 'instruments' in sono_features:
                        metadata['instruments'] = sono_features['instruments']
                    logger.info("✓ Sonoteller.ai comprehensive analysis complete", **sono_features)
                    sources_used.append('sonoteller')

            # Derive Camelot key from key/BPM data
            if metadata.get('key'):
                # Handle both string format ("C# minor") and numeric format (pitch class)
                key_str = metadata['key']
                if isinstance(key_str, str):
                    # Parse string format "C# minor" → Camelot
                    camelot_key = self._key_to_camelot(key_str)
                    if camelot_key:
                        metadata['camelot_key'] = camelot_key
                elif isinstance(key_str, (int, float)) and metadata.get('audio_features'):
                    # Old numeric format from Spotify (pitch class + mode)
                    camelot_key = self._derive_camelot_key(
                        metadata['audio_features'].get('key'),
                        metadata['audio_features'].get('mode')
                    )
                    if camelot_key:
                        metadata['camelot_key'] = camelot_key

            # FINAL ISRC CHECK: Log warning if still missing
            final_isrc = metadata.get('isrc')
            if not final_isrc:
                logger.warning(
                    "⚠️ Track enrichment completed WITHOUT ISRC - deduplication may fail",
                    track_id=task.track_id,
                    artist=task.artist_name,
                    title=task.track_title,
                    sources_used=[s.value for s in sources_used]
                )
            else:
                logger.info(
                    "✓ ISRC confirmed for track",
                    track_id=task.track_id,
                    isrc=final_isrc
                )

            # Update database with enriched metadata
            await self._update_track_in_database(task.track_id, metadata, sources_used)

            # Update enrichment status
            await self._update_enrichment_status(
                task.track_id,
                "completed" if sources_used else "failed",
                len(sources_used)
            )

            # Determine final status
            if len(sources_used) >= 2:
                status = EnrichmentStatus.COMPLETED
            elif len(sources_used) == 1:
                status = EnrichmentStatus.PARTIAL
            else:
                status = EnrichmentStatus.FAILED
                errors.append("No metadata sources returned data")

            duration = time.time() - start_time

            result = EnrichmentResult(
                track_id=task.track_id,
                status=status,
                sources_used=sources_used,
                metadata_acquired=metadata,
                errors=errors,
                duration_seconds=duration,
                cached=False,
                timestamp=datetime.now()
            )

            # Cache the result (cache for 7 days)
            cache_key = self._get_cache_key(task.track_id)
            cache_data = {
                'status': status.value,
                'sources_used': [s.value for s in sources_used],
                'metadata': metadata,
                'errors': errors
            }
            await self.redis_client.setex(
                cache_key,
                7 * 24 * 3600,
                json.dumps(cache_data, default=str)
            )

            logger.info(
                "Track enrichment completed",
                status=status.value,
                sources_used=len(sources_used),
                duration=f"{duration:.2f}s"
            )

            return result

        except Exception as e:
            duration = time.time() - start_time
            error_msg = str(e)
            errors.append(error_msg)

            logger.error(
                "Track enrichment failed",
                error=error_msg,
                duration=f"{duration:.2f}s"
            )

            # Update enrichment status as failed
            await self._update_enrichment_status(task.track_id, "failed", 0, error_msg)

            return EnrichmentResult(
                track_id=task.track_id,
                status=EnrichmentStatus.FAILED,
                sources_used=sources_used,
                metadata_acquired=metadata,
                errors=errors,
                duration_seconds=duration,
                cached=False,
                timestamp=datetime.now()
            )

    async def _enrich_from_spotify_id(self, spotify_id: str) -> Optional[Dict[str, Any]]:
        """Enrich from Spotify ID - only if client exists"""
        if not self.spotify_client:
            return None
        try:
            return await self.spotify_client.get_track_by_id(spotify_id)
        except Exception as e:
            logger.error("Spotify enrichment failed", error=str(e))
            return None

    async def _update_track_in_database(
        self,
        track_id: str,
        metadata: Dict[str, Any],
        sources_used: List
    ):
        """Update track in database with enriched metadata"""
        try:
            async with self.db_session_factory() as session:
                # Build update query dynamically based on available metadata
                updates = []
                params = {'track_id': track_id}

                if metadata.get('spotify_id'):
                    updates.append("spotify_id = :spotify_id")
                    params['spotify_id'] = metadata['spotify_id']

                if metadata.get('isrc'):
                    updates.append("isrc = :isrc")
                    params['isrc'] = metadata['isrc']

                if metadata.get('duration_ms'):
                    updates.append("duration_ms = :duration_ms")
                    params['duration_ms'] = metadata['duration_ms']

                # BPM from new sources or legacy audio_features
                if metadata.get('bpm'):
                    updates.append("bpm = :bpm")
                    params['bpm'] = round(metadata['bpm'], 2)
                elif metadata.get('audio_features', {}).get('tempo'):
                    # Legacy Spotify tempo
                    updates.append("bpm = :bpm")
                    params['bpm'] = round(metadata['audio_features']['tempo'], 2)

                # Key from new sources or legacy audio_features
                # Initialize audio_features to avoid scoping issues
                audio_features = metadata.get('audio_features', {})

                if metadata.get('key') and isinstance(metadata['key'], str):
                    # String format from AcousticBrainz/GetSongBPM/Sonoteller
                    updates.append("key = :key")
                    params['key'] = metadata['key']
                elif audio_features.get('key') is not None:
                    # Legacy Spotify numeric format
                    key_map = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
                    key_num = audio_features['key']
                    mode = audio_features.get('mode', 1)
                    key_str = f"{key_map[key_num]} {'Major' if mode == 1 else 'Minor'}"
                    updates.append("key = :key")
                    params['key'] = key_str

                # Only process additional audio features if they exist
                if audio_features.get('energy') is not None:
                    updates.append("energy = :energy")
                    params['energy'] = round(audio_features['energy'], 2)

                if audio_features.get('danceability') is not None:
                    updates.append("danceability = :danceability")
                    params['danceability'] = round(audio_features['danceability'], 2)

                if audio_features.get('valence') is not None:
                    updates.append("valence = :valence")
                    params['valence'] = round(audio_features['valence'], 2)

                # Release date
                album = metadata.get('album', {})
                if album.get('release_date'):
                    updates.append("release_date = :release_date")
                    # Handle different date formats - convert to date object
                    from datetime import date
                    date_str = album['release_date']
                    if len(date_str) == 4:  # Year only
                        params['release_date'] = date(int(date_str), 1, 1)
                    else:
                        # Parse YYYY-MM-DD or YYYY-MM format
                        parts = date_str.split('-')
                        year = int(parts[0])
                        month = int(parts[1]) if len(parts) > 1 else 1
                        day = int(parts[2]) if len(parts) > 2 else 1
                        params['release_date'] = date(year, month, day)

                # Genre from Discogs or Last.fm
                if metadata.get('genre'):
                    updates.append("genre = :genre")
                    if isinstance(metadata['genre'], list):
                        params['genre'] = metadata['genre'][0]
                    else:
                        params['genre'] = metadata['genre']

                # Update metadata JSONB with all enrichment data
                enrichment_data = {
                    'musicbrainz_id': metadata.get('musicbrainz_id'),
                    'discogs_id': metadata.get('discogs_id'),
                    'camelot_key': metadata.get('camelot_key'),
                    'label': metadata.get('label'),
                    'popularity': metadata.get('popularity'),
                    'lastfm_tags': metadata.get('lastfm', {}).get('tags', []),
                    'lastfm_playcount': metadata.get('lastfm', {}).get('playcount'),
                    'enrichment_sources': [s.value for s in sources_used],
                    'enriched_at': datetime.now().isoformat()
                }

                # Use named parameters for SQLAlchemy text()
                updates.append("metadata = COALESCE(metadata, '{}'::jsonb) || CAST(:enrichment_data AS jsonb)")
                params['enrichment_data'] = json.dumps(enrichment_data)

                updates.append("updated_at = CURRENT_TIMESTAMP")

                if updates:
                    query = text(f"""
                        UPDATE tracks
                        SET {', '.join(updates)}
                        WHERE id = :track_id
                    """)

                    await session.execute(query, params)
                    await session.commit()

                    logger.info("Track updated in database", track_id=track_id)

        except Exception as e:
            logger.error("Failed to update track in database", error=str(e), track_id=track_id)

    async def _update_enrichment_status(
        self,
        track_id: str,
        status: str,
        sources_count: int,
        error_message: Optional[str] = None
    ):
        """Update or create enrichment status record"""
        try:
            # Determine if this is a retriable error (circuit breaker)
            is_retriable = False
            if error_message and 'Circuit breaker' in error_message and 'is OPEN' in error_message:
                is_retriable = True
                logger.info(
                    "Marking circuit breaker failure as retriable",
                    track_id=track_id,
                    error=error_message
                )

            async with self.db_session_factory() as session:
                query = text("""
                    INSERT INTO enrichment_status (track_id, status, sources_enriched, last_attempt, error_message, is_retriable)
                    VALUES (:track_id, :status, :sources_count, CURRENT_TIMESTAMP, :error_message, :is_retriable)
                    ON CONFLICT (track_id)
                    DO UPDATE SET
                        status = :status,
                        sources_enriched = :sources_count,
                        last_attempt = CURRENT_TIMESTAMP,
                        error_message = :error_message,
                        is_retriable = :is_retriable,
                        retry_count = CASE
                            WHEN enrichment_status.status = 'failed' AND :status = 'failed' AND NOT :is_retriable
                            THEN enrichment_status.retry_count + 1
                            WHEN :is_retriable
                            THEN 0  -- Reset retry count for circuit breaker errors
                            ELSE enrichment_status.retry_count
                        END
                """)

                await session.execute(
                    query,
                    {
                        'track_id': track_id,
                        'status': status,
                        'sources_count': sources_count,
                        'error_message': error_message,
                        'is_retriable': is_retriable
                    }
                )
                await session.commit()

        except Exception as e:
            logger.error("Failed to update enrichment status", error=str(e), track_id=track_id)

    def _key_to_camelot(self, key_str: str) -> Optional[str]:
        """
        Convert string key notation (e.g., "C# minor", "D major") to Camelot notation

        Args:
            key_str: Key string like "C# minor" or "Ab major"

        Returns:
            Camelot notation like "5A" or "8B", or None if invalid
        """
        if not key_str:
            return None

        # Normalize and parse
        key_str = key_str.strip().lower()

        # Mapping from key names to Camelot
        key_to_camelot = {
            # Minor keys (A)
            'a minor': '1A',
            'e minor': '2A',
            'b minor': '3A',
            'f# minor': '4A', 'gb minor': '4A',
            'c# minor': '5A', 'db minor': '5A',
            'g# minor': '6A', 'ab minor': '6A',
            'd# minor': '7A', 'eb minor': '7A',
            'a# minor': '8A', 'bb minor': '8A',
            'f minor': '9A',
            'c minor': '10A',
            'g minor': '11A',
            'd minor': '12A',

            # Major keys (B)
            'c major': '8B',
            'g major': '9B',
            'd major': '10B',
            'a major': '11B',
            'e major': '12B',
            'b major': '1B',
            'f# major': '2B', 'gb major': '2B',
            'c# major': '3B', 'db major': '3B',
            'g# major': '4B', 'ab major': '4B',
            'd# major': '5B', 'eb major': '5B',
            'a# major': '6B', 'bb major': '6B',
            'f major': '7B'
        }

        return key_to_camelot.get(key_str)

    def _derive_camelot_key(self, key_num: Optional[int], mode: Optional[int]) -> Optional[str]:
        """
        Derive Camelot key notation from Spotify key and mode

        Camelot Wheel mapping:
        - A = Minor keys (mode = 0)
        - B = Major keys (mode = 1)
        - Numbers 1-12 represent the pitch class
        """
        if key_num is None or mode is None:
            return None

        # Camelot wheel mapping
        # Key number: 0=C, 1=C#/Db, 2=D, 3=D#/Eb, 4=E, 5=F, 6=F#/Gb, 7=G, 8=G#/Ab, 9=A, 10=A#/Bb, 11=B
        # Camelot numbers for minor (A) and major (B) keys
        camelot_minor = {
            9: '1A',   # A minor
            4: '2A',   # E minor
            11: '3A',  # B minor
            6: '4A',   # F# minor
            1: '5A',   # C# minor
            8: '6A',   # G# minor
            3: '7A',   # D# minor
            10: '8A',  # A# minor
            5: '9A',   # F minor
            0: '10A',  # C minor
            7: '11A',  # G minor
            2: '12A'   # D minor
        }

        camelot_major = {
            0: '8B',   # C major
            7: '9B',   # G major
            2: '10B',  # D major
            9: '11B',  # A major
            4: '12B',  # E major
            11: '1B',  # B major
            6: '2B',   # F# major
            1: '3B',   # C# major
            8: '4B',   # G# major
            3: '5B',   # D# major
            10: '6B',  # A# major
            5: '7B'    # F major
        }

        if mode == 0:  # Minor
            return camelot_minor.get(key_num)
        else:  # Major
            return camelot_major.get(key_num)

    def _get_cache_key(self, track_id: str) -> str:
        """Generate cache key for track enrichment"""
        return f"enrichment:result:{track_id}"