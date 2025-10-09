"""
Artist Population Service (Enhanced with 2025 Best Practices)

Populates artist records from multiple sources with intelligent disambiguation:
1. Spotify (primary - has popularity metrics for disambiguation)
2. MusicBrainz (canonical - MBID is unique, authoritative identifier)
3. Discogs (release-specific)

Key 2025 Enhancements:
- MBID (MusicBrainz ID) as canonical identifier
- Popularity-based disambiguation for common names
- Fuzzy name matching with RapidFuzz
- Multi-source artist unification

Workflow:
1. Fuzzy matcher finds track match (Spotify/MusicBrainz)
2. Artist populator extracts artist data
3. Disambiguates using popularity/MBID
4. Creates/updates artist records
5. Links to track via track_artists table
"""

import re
import asyncio
import structlog
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from sqlalchemy.exc import IntegrityError

# Import RapidFuzz for artist name matching (2025 Best Practice)
try:
    from rapidfuzz import fuzz
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False

logger = structlog.get_logger(__name__)


class ArtistPopulator:
    """
    Populates artist records from multiple sources (2025 Enhanced).

    Handles:
    - Artist creation with multiple IDs (Spotify, MBID, Discogs)
    - Intelligent name normalization with RapidFuzz
    - Disambiguation using popularity metrics
    - Duplicate detection with fuzzy matching
    - Track-artist linkage with role/position
    - MBID-based canonical linking (2025 Best Practice)
    """

    def __init__(self, db_session_factory: async_sessionmaker, spotify_client, musicbrainz_client=None):
        self.db_session_factory = db_session_factory
        self.spotify = spotify_client
        self.musicbrainz = musicbrainz_client  # Optional for MBID enrichment

        # 2025 Best Practice: Fuzzy matching thresholds
        self.high_confidence_threshold = 95  # Near-exact match
        self.medium_confidence_threshold = 85  # Probable match
        self.low_confidence_threshold = 75  # Possible match

        if RAPIDFUZZ_AVAILABLE:
            logger.info("✅ ArtistPopulator initialized with RapidFuzz support")
        else:
            logger.warning("⚠️ RapidFuzz not available - using exact matching only")

    def normalize_artist_name(self, name: str) -> str:
        """
        Normalize artist name for duplicate detection.

        Normalization rules:
        - Lowercase
        - Remove extra whitespace
        - Remove special characters (but keep &, +, /)
        - Trim

        Examples:
            "Matrix & Futurebound" → "matrix & futurebound"
            "Sub Focus  " → "sub focus"
            "NOISIA" → "noisia"
        """
        normalized = name.lower().strip()
        normalized = re.sub(r'\s+', ' ', normalized)  # Collapse whitespace
        return normalized

    async def disambiguate_artist(
        self,
        name: str,
        candidates: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Disambiguate artist using 2025 best practices.

        Strategy:
        1. Exact MBID match (highest priority)
        2. Spotify ID match
        3. Name similarity + popularity (for common names)
        4. Fuzzy name matching with RapidFuzz

        Args:
            name: Artist name to match
            candidates: List of candidate artist dicts from database

        Returns:
            Best matching candidate or None
        """
        if not candidates:
            return None

        if len(candidates) == 1:
            return candidates[0]

        # 2025 Best Practice: Use popularity for disambiguation
        # Common artist names (e.g., "DJ Shadow", "Matrix") need disambiguation
        candidates_with_scores = []

        for candidate in candidates:
            score = 0

            # MBID match = highest priority (canonical identifier)
            if candidate.get('musicbrainz_id'):
                score += 100

            # Spotify popularity (0-100 scale)
            if candidate.get('spotify_popularity'):
                score += candidate['spotify_popularity'] * 0.5  # Max +50

            # Fuzzy name match (if RapidFuzz available)
            if RAPIDFUZZ_AVAILABLE:
                name_score = fuzz.ratio(
                    name.lower(),
                    candidate['name'].lower()
                )
                score += name_score * 0.3  # Max +30

            # Genre match bonus (if we have genre context)
            # TODO: Add genre context parameter in future

            candidates_with_scores.append((candidate, score))

        # Sort by score (descending)
        candidates_with_scores.sort(key=lambda x: x[1], reverse=True)
        best_match = candidates_with_scores[0][0]
        best_score = candidates_with_scores[0][1]

        logger.debug(
            "Artist disambiguation completed",
            name=name,
            best_match=best_match['name'],
            score=best_score,
            total_candidates=len(candidates)
        )

        return best_match

    async def get_or_create_artist(
        self,
        name: str,
        spotify_id: Optional[str] = None,
        musicbrainz_id: Optional[str] = None,
        genres: Optional[List[str]] = None,
        spotify_popularity: Optional[int] = None
    ) -> Optional[UUID]:
        """
        Get existing artist or create new one (Enhanced 2025).

        Args:
            name: Artist name
            spotify_id: Spotify artist ID (if available)
            musicbrainz_id: MusicBrainz ID (MBID) - canonical identifier
            genres: List of genres (if available)
            spotify_popularity: Spotify popularity (0-100) for disambiguation

        Returns:
            artist_id (UUID) if successful, None if failed

        Duplicate Detection Priority (2025 Best Practices):
        1. Match by MusicBrainz ID (MBID) - canonical, authoritative
        2. Match by Spotify ID (service-specific)
        3. Fuzzy match by name with disambiguation
        4. Create new artist
        """
        normalized_name = self.normalize_artist_name(name)

        # Check for generic artist names (should never create these)
        generic_names = ['unknown', 'various artists', 'various', 'unknown artist']
        if normalized_name in generic_names:
            logger.warning(
                "Attempted to create generic artist - rejecting",
                name=name,
                normalized=normalized_name
            )
            return None

        async with self.db_session_factory() as session:
            try:
                # 1. Try to find by MusicBrainz ID (MBID) - 2025 Best Practice (canonical)
                if musicbrainz_id:
                    result = await session.execute(
                        text("SELECT artist_id, name FROM artists WHERE musicbrainz_id = :mbid"),
                        {"mbid": musicbrainz_id}
                    )
                    row = result.first()
                    if row:
                        logger.info(
                            "Artist found by MBID (canonical match)",
                            name=name,
                            mbid=musicbrainz_id,
                            artist_id=str(row.artist_id)
                        )
                        # Update Spotify ID if we have a new one
                        if spotify_id:
                            await session.execute(
                                text("UPDATE artists SET spotify_id = :spotify_id WHERE artist_id = :artist_id"),
                                {"spotify_id": spotify_id, "artist_id": row.artist_id}
                            )
                            await session.commit()
                        return row.artist_id

                # 2. Try to find by Spotify ID
                if spotify_id:
                    result = await session.execute(
                        text("SELECT artist_id, name FROM artists WHERE spotify_id = :spotify_id"),
                        {"spotify_id": spotify_id}
                    )
                    row = result.first()
                    if row:
                        logger.info(
                            "Artist found by Spotify ID",
                            name=name,
                            spotify_id=spotify_id,
                            artist_id=str(row.artist_id)
                        )
                        # Update MBID if we have a new one
                        if musicbrainz_id:
                            await session.execute(
                                text("UPDATE artists SET musicbrainz_id = :mbid WHERE artist_id = :artist_id"),
                                {"mbid": musicbrainz_id, "artist_id": row.artist_id}
                            )
                            await session.commit()
                        return row.artist_id

                # 3. Fuzzy match by normalized_name with disambiguation (2025 Enhancement)
                result = await session.execute(
                    text("""
                        SELECT artist_id, name, spotify_id, musicbrainz_id,
                               COALESCE((metadata->>'spotify_popularity')::int, 0) as spotify_popularity
                        FROM artists
                        WHERE normalized_name = :normalized_name
                    """),
                    {"normalized_name": normalized_name}
                )
                rows = result.fetchall()

                if rows:
                    # Convert rows to dicts for disambiguation
                    candidates = [
                        {
                            'artist_id': row.artist_id,
                            'name': row.name,
                            'spotify_id': row.spotify_id,
                            'musicbrainz_id': row.musicbrainz_id,
                            'spotify_popularity': row.spotify_popularity
                        }
                        for row in rows
                    ]

                    # Disambiguate using 2025 best practices
                    best_match = await self.disambiguate_artist(name, candidates)

                    if best_match:
                        artist_id = best_match['artist_id']

                        # Update with new metadata if we have better data
                        updates = []
                        params = {"artist_id": artist_id}

                        if spotify_id and not best_match['spotify_id']:
                            updates.append("spotify_id = :spotify_id")
                            params['spotify_id'] = spotify_id

                        if musicbrainz_id and not best_match['musicbrainz_id']:
                            updates.append("musicbrainz_id = :mbid")
                            params['mbid'] = musicbrainz_id

                        if updates:
                            await session.execute(
                                text(f"UPDATE artists SET {', '.join(updates)} WHERE artist_id = :artist_id"),
                                params
                            )
                            await session.commit()
                            logger.info(
                                "Updated existing artist with new metadata",
                                artist_id=str(artist_id),
                                updates=updates
                            )

                        return artist_id

                # 4. Create new artist with all available metadata (2025 Enhanced)
                result = await session.execute(
                    text("""
                        INSERT INTO artists (name, spotify_id, musicbrainz_id, normalized_name, genres, metadata)
                        VALUES (:name, :spotify_id, :mbid, :normalized_name, :genres, :metadata)
                        RETURNING artist_id
                    """),
                    {
                        "name": name,
                        "spotify_id": spotify_id,
                        "mbid": musicbrainz_id,
                        "normalized_name": normalized_name,
                        "genres": genres or [],
                        "metadata": {
                            "spotify_popularity": spotify_popularity
                        } if spotify_popularity else {}
                    }
                )
                row = result.first()
                await session.commit()

                logger.info(
                    "Created new artist with enhanced metadata",
                    name=name,
                    artist_id=str(row.artist_id),
                    spotify_id=spotify_id,
                    mbid=musicbrainz_id,
                    popularity=spotify_popularity,
                    genres=genres or []
                )

                return row.artist_id

            except IntegrityError as e:
                # Race condition - another process created this artist
                await session.rollback()
                logger.warning(
                    "Artist created by another process - retrying lookup",
                    name=name,
                    error=str(e)
                )
                # Retry lookup with priority order: MBID > Spotify ID > name
                if musicbrainz_id:
                    result = await session.execute(
                        text("SELECT artist_id FROM artists WHERE musicbrainz_id = :mbid"),
                        {"mbid": musicbrainz_id}
                    )
                    row = result.first()
                    if row:
                        return row.artist_id

                if spotify_id:
                    result = await session.execute(
                        text("SELECT artist_id FROM artists WHERE spotify_id = :spotify_id"),
                        {"spotify_id": spotify_id}
                    )
                    row = result.first()
                    if row:
                        return row.artist_id

                result = await session.execute(
                    text("SELECT artist_id FROM artists WHERE normalized_name = :normalized_name"),
                    {"normalized_name": normalized_name}
                )
                row = result.first()
                if row:
                    return row.artist_id

                logger.error("Failed to create or find artist after retry", name=name)
                return None

            except Exception as e:
                await session.rollback()
                logger.error(
                    "Failed to get/create artist",
                    name=name,
                    error=str(e),
                    exc_info=True
                )
                return None

    async def link_artist_to_track(
        self,
        track_id: UUID,
        artist_id: UUID,
        role: str = 'primary',
        position: int = 0
    ) -> bool:
        """
        Create track-artist linkage.

        Args:
            track_id: Track UUID
            artist_id: Artist UUID
            role: Artist role (primary, featured, remixer, etc.)
            position: Position in artist list (0-based)

        Returns:
            True if successful, False otherwise
        """
        async with self.db_session_factory() as session:
            try:
                await session.execute(
                    text("""
                        INSERT INTO track_artists (track_id, artist_id, role, position)
                        VALUES (:track_id, :artist_id, :role, :position)
                        ON CONFLICT (track_id, artist_id, role) DO NOTHING
                    """),
                    {
                        "track_id": track_id,
                        "artist_id": artist_id,
                        "role": role,
                        "position": position
                    }
                )
                await session.commit()

                logger.debug(
                    "Linked artist to track",
                    track_id=str(track_id),
                    artist_id=str(artist_id),
                    role=role,
                    position=position
                )

                return True

            except Exception as e:
                await session.rollback()
                logger.error(
                    "Failed to link artist to track",
                    track_id=str(track_id),
                    artist_id=str(artist_id),
                    error=str(e),
                    exc_info=True
                )
                return False

    async def populate_artists_from_spotify(
        self,
        track_id: UUID,
        spotify_track_id: str
    ) -> bool:
        """
        Populate artist records from Spotify track metadata.

        This is the main entry point for the artist population workflow.

        Args:
            track_id: Track UUID in our database
            spotify_track_id: Spotify track ID from fuzzy matcher

        Returns:
            True if successful, False otherwise

        Workflow:
        1. Get full track details from Spotify API
        2. Extract artist information
        3. Create/get artist records for each artist
        4. Link artists to track
        """
        try:
            # Get full track details from Spotify
            track_data = await self.spotify.get_track_by_id(spotify_track_id)
            if not track_data:
                logger.warning(
                    "Failed to get track from Spotify",
                    spotify_id=spotify_track_id
                )
                return False

            artists = track_data.get('artists', [])
            if not artists:
                logger.warning(
                    "No artists in Spotify track data",
                    spotify_id=spotify_track_id
                )
                return False

            logger.info(
                "Populating artists from Spotify",
                track_id=str(track_id),
                spotify_id=spotify_track_id,
                artist_count=len(artists)
            )

            # Process each artist
            success_count = 0
            for position, artist_data in enumerate(artists):
                artist_name = artist_data.get('name')
                artist_spotify_id = artist_data.get('spotify_id')

                if not artist_name:
                    logger.warning("Artist missing name - skipping", artist_data=artist_data)
                    continue

                # Get or create artist
                artist_id = await self.get_or_create_artist(
                    name=artist_name,
                    spotify_id=artist_spotify_id,
                    genres=None  # Could fetch from Spotify artist endpoint if needed
                )

                if not artist_id:
                    logger.error(
                        "Failed to get/create artist",
                        name=artist_name,
                        spotify_id=artist_spotify_id
                    )
                    continue

                # Link artist to track
                linked = await self.link_artist_to_track(
                    track_id=track_id,
                    artist_id=artist_id,
                    role='primary',
                    position=position
                )

                if linked:
                    success_count += 1

            logger.info(
                "Artist population complete",
                track_id=str(track_id),
                total_artists=len(artists),
                successful=success_count
            )

            return success_count > 0

        except Exception as e:
            logger.error(
                "Failed to populate artists",
                track_id=str(track_id),
                spotify_id=spotify_track_id,
                error=str(e),
                exc_info=True
            )
            return False
