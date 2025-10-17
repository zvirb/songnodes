"""
Multi-Tiered Artist Identification System

Resolves artist information for tracks with missing or "Unknown" artists using:
- Tier 1: Internal database cross-referencing (artist-label associations, mashup component lookup)
- Tier 2: External community sources (1001Tracklists, MixesDB, Discogs)
- Tier 3: Feedback loop (enriches main database with successful identifications)

Author: Metadata Enrichment System
"""

import re
import sys
import asyncio
from typing import Optional, List, Dict, Tuple, Set
from dataclasses import dataclass
from collections import Counter, defaultdict
import structlog

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Add common directory to path for shared utilities
sys.path.insert(0, '/app/common')
from artist_name_cleaner import clean_artist_name, normalize_artist_name

logger = structlog.get_logger(__name__)


@dataclass
class ArtistCandidate:
    """A potential artist match with confidence score"""
    artist_names: List[str]
    label: Optional[str]
    source: str  # 'internal_label_map', 'internal_mashup', 'external_1001tl', etc.
    confidence: float  # 0.0 to 1.0
    track_title: str
    metadata: Dict  # Additional info (spotify_id, isrc, etc.)


@dataclass
class TrackComponent:
    """Individual component of a mashup or remix"""
    title: str
    artist: Optional[str] = None
    label: Optional[str] = None
    source: str = 'unknown'


class MultiTierArtistResolver:
    """
    Intelligent artist identification using internal DB + external sources
    
    Workflow:
    1. Parse track title (extract label, detect mashups)
    2. Tier 1: Query internal DB (artist-label map, mashup components)
    3. Tier 2: Query external sources if Tier 1 fails
    4. Tier 3: Update internal DB with successful matches (feedback loop)
    """
    
    def __init__(
        self,
        db_session_factory,
        discogs_client=None,
        tracklists_1001_client=None,
        mixesdb_client=None
    ):
        self.db_session_factory = db_session_factory
        self.discogs_client = discogs_client
        self.tracklists_1001_client = tracklists_1001_client
        self.mixesdb_client = mixesdb_client
        
        # In-memory cache for artist-label associations
        self._artist_label_map: Dict[str, Counter] = {}
        self._map_loaded = False
    
    async def resolve_artist(
        self,
        track_id: str,
        track_title: str,
        current_artist: str = "Unknown",
        existing_label: Optional[str] = None
    ) -> Optional[ArtistCandidate]:
        """
        Main entry point: Resolve artist for a track with missing artist info
        
        Args:
            track_id: UUID of the track
            track_title: Full track title (may include [Label], mashup indicators, etc.)
            current_artist: Current artist value (usually "Unknown")
            existing_label: Known label from other sources
            
        Returns:
            ArtistCandidate with identified artist(s) or None if no match found
        """
        logger.info(
            "Starting multi-tier artist resolution",
            track_id=track_id,
            track_title=track_title,
            current_artist=current_artist
        )
        
        # Step 1: Parse track title
        clean_title, extracted_label = self._extract_label_from_title(track_title)
        label = existing_label or extracted_label
        
        is_mashup, components = self._detect_mashup(clean_title)
        
        # Step 2: Tier 1 - Internal Database
        logger.info("🔍 Tier 1: Checking internal database", track_title=track_title)
        
        # Try mashup component lookup first (highest confidence)
        if is_mashup:
            candidate = await self._resolve_mashup_from_internal_db(components, label)
            if candidate:
                logger.info(
                    "✅ Tier 1 SUCCESS: Mashup resolved from internal DB",
                    artists=candidate.artist_names,
                    confidence=candidate.confidence
                )
                # Tier 3: Update database with successful match
                await self._update_track_with_artist(track_id, candidate)
                return candidate
        
        # Try artist-label association map
        if label:
            candidate = await self._resolve_from_artist_label_map(clean_title, label)
            if candidate:
                logger.info(
                    "✅ Tier 1 SUCCESS: Resolved via artist-label map",
                    artists=candidate.artist_names,
                    label=label,
                    confidence=candidate.confidence
                )
                # Tier 3: Update database
                await self._update_track_with_artist(track_id, candidate)
                return candidate
        
        # Step 3: Tier 2 - External Sources
        logger.info("🌐 Tier 2: Querying external sources", track_title=track_title)
        
        candidate = await self._resolve_from_external_sources(
            clean_title,
            label,
            is_mashup,
            components
        )
        
        if candidate:
            logger.info(
                "✅ Tier 2 SUCCESS: Resolved from external source",
                source=candidate.source,
                artists=candidate.artist_names,
                confidence=candidate.confidence
            )
            # Tier 3: Update database AND enrich internal knowledge base
            await self._update_track_with_artist(track_id, candidate)
            await self._enrich_internal_database(candidate)
            return candidate
        
        logger.warning(
            "❌ Artist resolution failed across all tiers",
            track_id=track_id,
            track_title=track_title
        )
        return None
    
    # ========================================================================
    # TIER 1: INTERNAL DATABASE
    # ========================================================================
    
    async def _load_artist_label_map(self) -> None:
        """
        Build in-memory map of artist-label associations from successful tracks
        
        Structure: {label_name: Counter({artist1: 50, artist2: 30, ...})}
        This allows us to find the most common artists for each label
        """
        if self._map_loaded:
            return
        
        logger.info("📊 Loading artist-label association map from database")
        
        async with self.db_session_factory() as session:
            query = text("""
                SELECT
                    t.metadata->>'label' as label,
                    a.name as artist_name,
                    COUNT(*) as track_count
                FROM tracks t
                JOIN track_artists ta ON t.id = ta.track_id
                JOIN artists a ON ta.artist_id = a.artist_id
                WHERE t.metadata->>'label' IS NOT NULL
                  AND ta.role = 'primary'
                GROUP BY t.metadata->>'label', a.name
                HAVING COUNT(*) >= 2  -- Only include artists with 2+ tracks on label
                ORDER BY t.metadata->>'label', track_count DESC
            """)
            
            result = await session.execute(query)
            rows = result.fetchall()
            
            # Build the map
            for row in rows:
                label = row.label.lower().strip()
                artist = row.artist_name
                count = row.track_count
                
                if label not in self._artist_label_map:
                    self._artist_label_map[label] = Counter()
                
                self._artist_label_map[label][artist] = count
        
        self._map_loaded = True
        logger.info(
            "✅ Artist-label map loaded",
            labels_count=len(self._artist_label_map),
            total_associations=sum(len(c) for c in self._artist_label_map.values())
        )
    
    async def _resolve_from_artist_label_map(
        self,
        clean_title: str,
        label: str
    ) -> Optional[ArtistCandidate]:
        """
        Use artist-label association map to find likely artist candidates
        
        Strategy:
        1. Get top 5 artists most associated with this label
        2. Search internal DB for each: "Artist + Track Title"
        3. Return highest confidence match
        """
        await self._load_artist_label_map()
        
        label_lower = label.lower().strip()
        
        # Check for exact label match
        artist_counter = self._artist_label_map.get(label_lower)
        
        if not artist_counter:
            # Try fuzzy label match (partial string matching)
            for map_label, counter in self._artist_label_map.items():
                if label_lower in map_label or map_label in label_lower:
                    artist_counter = counter
                    logger.debug(
                        "Fuzzy label match found",
                        search_label=label,
                        matched_label=map_label
                    )
                    break
        
        if not artist_counter:
            logger.debug("No artist-label associations found", label=label)
            return None
        
        # Get top 5 candidate artists for this label
        top_artists = artist_counter.most_common(5)
        
        logger.debug(
            "Artist candidates from label map",
            label=label,
            candidates=[(a, count) for a, count in top_artists]
        )
        
        # Search internal DB for each candidate
        async with self.db_session_factory() as session:
            for artist_name, track_count in top_artists:
                # Search for this artist + title combination in our DB
                search_query = text("""
                    SELECT
                        t.id,
                        t.title,
                        t.metadata->>'label' as label,
                        t.spotify_id,
                        t.isrc,
                        a.name as artist_name,
                        similarity(t.normalized_title, :search_title) as title_similarity
                    FROM tracks t
                    JOIN track_artists ta ON t.id = ta.track_id
                    JOIN artists a ON ta.artist_id = a.artist_id
                    WHERE a.name = :artist_name
                      AND ta.role = 'primary'
                      AND similarity(t.normalized_title, :search_title) > 0.6
                    ORDER BY title_similarity DESC
                    LIMIT 1
                """)
                
                result = await session.execute(
                    search_query,
                    {
                        'artist_name': artist_name,
                        'search_title': clean_title.lower()
                    }
                )
                match = result.fetchone()
                
                if match:
                    # Found a match! Calculate confidence
                    title_sim = match.title_similarity
                    label_weight = track_count / max(sum(artist_counter.values()), 1)
                    confidence = (title_sim * 0.7) + (label_weight * 0.3)
                    
                    logger.info(
                        "Artist-label map match found",
                        artist=artist_name,
                        matched_title=match.title,
                        title_similarity=title_sim,
                        confidence=confidence
                    )
                    
                    return ArtistCandidate(
                        artist_names=[artist_name],
                        label=match.label or label,
                        source='internal_label_map',
                        confidence=confidence,
                        track_title=clean_title,
                        metadata={
                            'spotify_id': match.spotify_id,
                            'isrc': match.isrc,
                            'matched_title': match.title
                        }
                    )
        
        return None
    
    async def _resolve_mashup_from_internal_db(
        self,
        components: List[TrackComponent],
        label: Optional[str]
    ) -> Optional[ArtistCandidate]:
        """
        Resolve mashup by looking up each component track in internal DB
        
        Strategy:
        1. For each component title, search internal DB
        2. If we find artists for ALL components, combine them
        3. Return high-confidence match
        """
        logger.info(
            "Resolving mashup from internal DB",
            component_count=len(components)
        )
        
        resolved_components = []
        
        async with self.db_session_factory() as session:
            for component in components:
                # Search for this track title in our database
                search_query = text("""
                    SELECT
                        t.title,
                        t.metadata->>'label' as label,
                        STRING_AGG(a.name, ', ') as artist_names,
                        MAX(similarity(t.normalized_title, :search_title)) as similarity
                    FROM tracks t
                    JOIN track_artists ta ON t.id = ta.track_id
                    JOIN artists a ON ta.artist_id = a.artist_id
                    WHERE ta.role = 'primary'
                      AND similarity(t.normalized_title, :search_title) > 0.7
                    GROUP BY t.id, t.title, t.metadata->>'label'
                    ORDER BY similarity DESC
                    LIMIT 1
                """)
                
                result = await session.execute(
                    search_query,
                    {'search_title': component.title.lower()}
                )
                match = result.fetchone()
                
                if match:
                    component.artist = match.artist_names
                    component.label = match.label or component.label
                    component.source = 'internal_db'
                    resolved_components.append(component)
                    
                    logger.debug(
                        "Mashup component resolved",
                        component_title=component.title,
                        artist=component.artist,
                        similarity=match.similarity
                    )
                else:
                    logger.debug(
                        "Mashup component NOT found in internal DB",
                        component_title=component.title
                    )
        
        # If we resolved ALL components, return success
        if len(resolved_components) == len(components):
            all_artists = []
            for comp in resolved_components:
                if comp.artist:
                    # Split in case of multi-artist tracks
                    all_artists.extend([a.strip() for a in comp.artist.split(',')])
            
            # Remove duplicates while preserving order
            unique_artists = list(dict.fromkeys(all_artists))
            
            # Confidence is high because all components matched
            confidence = 0.9
            
            logger.info(
                "✅ Mashup fully resolved from internal DB",
                artists=unique_artists,
                components_resolved=len(resolved_components)
            )
            
            return ArtistCandidate(
                artist_names=unique_artists,
                label=label or resolved_components[0].label,
                source='internal_mashup',
                confidence=confidence,
                track_title=' vs '.join([c.title for c in components]),
                metadata={
                    'components': [
                        {'title': c.title, 'artist': c.artist}
                        for c in resolved_components
                    ]
                }
            )
        
        # Partial match - not confident enough
        logger.debug(
            "Mashup partially resolved",
            resolved=len(resolved_components),
            total=len(components)
        )
        return None
    
    # ========================================================================
    # TIER 2: EXTERNAL SOURCES
    # ========================================================================
    
    async def _resolve_from_external_sources(
        self,
        clean_title: str,
        label: Optional[str],
        is_mashup: bool,
        components: List[TrackComponent]
    ) -> Optional[ArtistCandidate]:
        """
        Query external sources in priority order:
        1. 1001Tracklists (best for EDM)
        2. Discogs (best when label is known)
        3. MixesDB (fallback)
        """
        # Try 1001Tracklists first (primary source for EDM)
        if self.tracklists_1001_client:
            candidate = await self._query_1001tracklists(clean_title, label, is_mashup)
            if candidate:
                return candidate
        
        # Try Discogs (especially good with label context)
        if self.discogs_client and label:
            candidate = await self._query_discogs(clean_title, label)
            if candidate:
                return candidate
        
        # Try MixesDB (fallback)
        if self.mixesdb_client:
            candidate = await self._query_mixesdb(clean_title, label)
            if candidate:
                return candidate
        
        return None
    
    async def _query_1001tracklists(
        self,
        clean_title: str,
        label: Optional[str],
        is_mashup: bool
    ) -> Optional[ArtistCandidate]:
        """
        Query 1001Tracklists for artist information

        Strategy:
        - Search by track title (+ label if available)
        - Look for consistent artist attribution across multiple DJ sets
        - Higher confidence if 3+ DJs attribute to same artist
        """
        if not self.tracklists_1001_client:
            return None

        try:
            # Search 1001Tracklists
            search_query = f"{clean_title} {label}" if label else clean_title
            results = await self.tracklists_1001_client.search_track(search_query)

            if not results:
                logger.debug("No 1001Tracklists results", query=search_query)
                return None

            # Count artist attributions across different sets/results
            artist_counter = Counter()
            for result in results:
                artist = result.get('artist') or result.get('data', {}).get('artist')
                if artist and artist.lower() != 'unknown':
                    artist_counter[artist] += 1

            if not artist_counter:
                return None

            # Most common artist
            most_common_artist, occurrences = artist_counter.most_common(1)[0]

            # Confidence based on consistency across sets
            # More occurrences = higher confidence, cap at 0.95
            confidence = min(occurrences / 10.0, 0.95)

            logger.info(
                "1001Tracklists match found",
                artist=most_common_artist,
                occurrences=occurrences,
                total_results=len(results),
                confidence=confidence
            )

            return ArtistCandidate(
                artist_names=[most_common_artist],
                label=label,
                source='external_1001tracklists',
                confidence=confidence,
                track_title=clean_title,
                metadata={
                    'occurrences': occurrences,
                    'total_results': len(results),
                    'search_query': search_query
                }
            )

        except Exception as e:
            logger.error("1001Tracklists query failed", error=str(e), title=clean_title)
            return None
    
    async def _query_discogs(
        self,
        clean_title: str,
        label: str
    ) -> Optional[ArtistCandidate]:
        """
        Query Discogs with label filter for highly accurate results
        
        Strategy:
        - Search: "track title" + filter by label
        - Discogs has excellent label data
        - High confidence (0.85) if exact match found
        """
        try:
            # Search Discogs with label filter
            results = await self.discogs_client.search(
                query=clean_title,
                label=label,
                type='release'
            )
            
            if not results:
                return None
            
            # Take first result (Discogs ranking is good)
            first_result = results[0]
            
            # Extract artist(s)
            artists = first_result.get('artists', [])
            if not artists:
                return None
            
            artist_names = [a.get('name') for a in artists if a.get('name')]
            
            # High confidence for Discogs + label match
            confidence = 0.85
            
            logger.info(
                "Discogs match found",
                artists=artist_names,
                label=label,
                release_title=first_result.get('title')
            )
            
            return ArtistCandidate(
                artist_names=artist_names,
                label=label,
                source='external_discogs',
                confidence=confidence,
                track_title=clean_title,
                metadata={
                    'discogs_id': first_result.get('id'),
                    'release_title': first_result.get('title'),
                    'year': first_result.get('year')
                }
            )
            
        except Exception as e:
            logger.error("Discogs query failed", error=str(e), title=clean_title, label=label)
            return None
    
    async def _query_mixesdb(
        self,
        clean_title: str,
        label: Optional[str]
    ) -> Optional[ArtistCandidate]:
        """
        Query MixesDB as fallback source

        Strategy:
        - Search by track title (+ label if available)
        - Medium confidence (0.70)
        """
        if not self.mixesdb_client:
            return None

        try:
            search_query = f"{clean_title} {label}" if label else clean_title
            results = await self.mixesdb_client.search_track(search_query)

            if not results or len(results) == 0:
                logger.debug("No MixesDB results", query=search_query)
                return None

            first_result = results[0]
            artist = first_result.get('artist') or first_result.get('data', {}).get('artist')

            if not artist or artist.lower() == 'unknown':
                return None

            # Medium confidence for MixesDB
            confidence = 0.70

            logger.info(
                "MixesDB match found",
                artist=artist,
                title=first_result.get('title')
            )

            return ArtistCandidate(
                artist_names=[artist],
                label=label,
                source='external_mixesdb',
                confidence=confidence,
                track_title=clean_title,
                metadata={
                    'mixesdb_title': first_result.get('title'),
                    'search_query': search_query
                }
            )

        except Exception as e:
            logger.error("MixesDB query failed", error=str(e), title=clean_title)
            return None
    
    # ========================================================================
    # TIER 3: FEEDBACK LOOP
    # ========================================================================
    
    async def _update_track_with_artist(
        self,
        track_id: str,
        candidate: ArtistCandidate
    ) -> None:
        """
        Update the track with identified artist(s)
        
        Creates artist records if needed and establishes track_artists relationships
        """
        logger.info(
            "Updating track with identified artist(s)",
            track_id=track_id,
            artists=candidate.artist_names,
            source=candidate.source
        )
        
        async with self.db_session_factory() as session:
            for artist_name in candidate.artist_names:
                # Clean artist name to remove tracklist formatting artifacts
                clean_name = clean_artist_name(artist_name)

                # Get or create artist
                artist_query = text("""
                    INSERT INTO artists (name, normalized_name)
                    VALUES (:name, :normalized_name)
                    ON CONFLICT (normalized_name) DO UPDATE
                    SET name = EXCLUDED.name
                    RETURNING artist_id
                """)

                result = await session.execute(
                    artist_query,
                    {
                        'name': clean_name,
                        'normalized_name': normalize_artist_name(clean_name)
                    }
                )
                artist_id = result.scalar()
                
                # Create track_artists relationship
                track_artist_query = text("""
                    INSERT INTO track_artists (track_id, artist_id, role)
                    VALUES (:track_id, :artist_id, 'primary')
                    ON CONFLICT (track_id, artist_id, role) DO NOTHING
                """)
                
                await session.execute(
                    track_artist_query,
                    {
                        'track_id': track_id,
                        'artist_id': artist_id
                    }
                )
            
            # Update track label if we have it
            if candidate.label:
                update_label_query = text("""
                    UPDATE tracks
                    SET metadata = jsonb_set(
                        COALESCE(metadata, '{}'::jsonb),
                        '{label}',
                        to_jsonb(:label::text),
                        true
                    )
                    WHERE id = :track_id AND (metadata->>'label' IS NULL OR metadata->>'label' = '')
                """)

                await session.execute(
                    update_label_query,
                    {'track_id': track_id, 'label': candidate.label}
                )
            
            await session.commit()
        
        logger.info(
            "✅ Track updated with artist(s)",
            track_id=track_id,
            artists=candidate.artist_names
        )
    
    async def _enrich_internal_database(
        self,
        candidate: ArtistCandidate
    ) -> None:
        """
        CRITICAL: Enrich internal database with externally-sourced data
        
        This is the feedback loop - successful external matches are added to
        our internal DB, making future Tier 1 lookups more powerful
        """
        if candidate.source.startswith('internal'):
            # Already from internal DB, no need to enrich
            return
        
        logger.info(
            "🔄 Feedback loop: Enriching internal DB with external match",
            artists=candidate.artist_names,
            source=candidate.source,
            label=candidate.label
        )
        
        # The track record already exists (that's what we were trying to enrich)
        # The artist relationships were created in _update_track_with_artist
        # The feedback happens automatically because those relationships
        # will now be included in future artist-label map builds
        
        # Force reload of artist-label map on next use
        self._map_loaded = False
        
        logger.info(
            "✅ Internal database enriched - future lookups will benefit",
            artists=candidate.artist_names,
            label=candidate.label
        )
    
    # ========================================================================
    # UTILITY METHODS
    # ========================================================================
    
    def _extract_label_from_title(self, title: str) -> Tuple[str, Optional[str]]:
        """
        Extract label from title brackets
        
        Examples:
            "Take Off [Woofer]" -> ("Take Off", "Woofer")
            "Regular Track" -> ("Regular Track", None)
        """
        match = re.search(r'\s*\[([^\]]+)\]\s*$', title)
        
        if match:
            label = match.group(1).strip()
            clean_title = title[:match.start()].strip()
            return clean_title, label
        
        return title, None
    
    def _detect_mashup(self, title: str) -> Tuple[bool, List[TrackComponent]]:
        """
        Detect if track is a mashup and extract components
        
        Patterns:
            - "Track1 vs Track2" -> mashup
            - "Track1 vs Track2 vs Track3" -> multi-mashup
            - "Track (Remix)" -> NOT a mashup (just a remix)
        
        Returns:
            (is_mashup, [TrackComponent list])
        """
        # Check for "vs" or "vs." pattern
        if ' vs ' in title.lower() or ' vs. ' in title.lower():
            # Split on "vs" (case insensitive)
            parts = re.split(r'\s+vs\.?\s+', title, flags=re.IGNORECASE)
            
            # Clean each part
            components = []
            for part in parts:
                # Remove common suffixes like (Original Mix), (Extended Mix)
                clean_part = re.sub(r'\s*\([^)]*Mix\)\s*', '', part).strip()
                components.append(TrackComponent(title=clean_part))
            
            logger.debug(
                "Mashup detected",
                original_title=title,
                component_count=len(components),
                components=[c.title for c in components]
            )
            
            return True, components
        
        return False, []


# ============================================================================
# INTEGRATION WITH ENRICHMENT PIPELINE
# ============================================================================

async def enrich_failed_tracks_with_multi_tier_resolver(
    db_session_factory,
    discogs_client=None,
    tracklists_1001_client=None,
    mixesdb_client=None,
    limit: int = 100
) -> Dict[str, int]:
    """
    Batch process failed tracks using multi-tier artist resolver
    
    This is the main entry point for enriching failed tracks from the CSV
    or from the enrichment_status table.
    
    Args:
        db_session_factory: AsyncSession factory
        discogs_client: Optional Discogs API client
        tracklists_1001_client: Optional 1001Tracklists scraper
        mixesdb_client: Optional MixesDB scraper
        limit: Max tracks to process in this batch
        
    Returns:
        Dict with stats: {'success': int, 'failed': int, 'processed': int}
    """
    resolver = MultiTierArtistResolver(
        db_session_factory=db_session_factory,
        discogs_client=discogs_client,
        tracklists_1001_client=tracklists_1001_client,
        mixesdb_client=mixesdb_client
    )
    
    stats = {'success': 0, 'failed': 0, 'processed': 0}
    
    async with db_session_factory() as session:
        # Get failed tracks without artists
        query = text("""
            SELECT
                t.id,
                t.title,
                t.metadata->>'label' as label,
                COALESCE(
                    (SELECT string_agg(a.name, ', ')
                     FROM track_artists ta
                     JOIN artists a ON ta.artist_id = a.artist_id
                     WHERE ta.track_id = t.id),
                    'Unknown'
                ) as artist_names
            FROM tracks t
            LEFT JOIN enrichment_status es ON t.id = es.track_id
            WHERE NOT EXISTS (
                SELECT 1 FROM track_artists ta
                WHERE ta.track_id = t.id AND ta.role = 'primary'
            )
            AND (
                es.status = 'failed'
                OR es.status IS NULL
            )
            ORDER BY es.last_attempt DESC NULLS LAST
            LIMIT :limit
        """)
        
        result = await session.execute(query, {'limit': limit})
        failed_tracks = result.fetchall()
    
    logger.info(
        "🚀 Starting multi-tier batch enrichment",
        track_count=len(failed_tracks)
    )
    
    for track in failed_tracks:
        stats['processed'] += 1
        
        try:
            candidate = await resolver.resolve_artist(
                track_id=str(track.id),
                track_title=track.title,
                current_artist=track.artist_names,
                existing_label=track.label
            )
            
            if candidate and candidate.confidence >= 0.6:
                stats['success'] += 1
                logger.info(
                    f"✅ [{stats['processed']}/{len(failed_tracks)}] SUCCESS",
                    track_title=track.title,
                    artists=candidate.artist_names,
                    source=candidate.source,
                    confidence=candidate.confidence
                )
            else:
                stats['failed'] += 1
                logger.warning(
                    f"❌ [{stats['processed']}/{len(failed_tracks)}] FAILED",
                    track_title=track.title
                )
        
        except Exception as e:
            stats['failed'] += 1
            logger.error(
                "Error processing track",
                track_id=str(track.id),
                track_title=track.title,
                error=str(e)
            )
        
        # Rate limiting
        await asyncio.sleep(0.5)
    
    logger.info(
        "🎉 Multi-tier batch enrichment complete",
        **stats,
        success_rate=f"{stats['success'] / max(stats['processed'], 1) * 100:.1f}%"
    )
    
    return stats
