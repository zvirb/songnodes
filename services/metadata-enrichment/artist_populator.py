"""
Artist Population Service

Populates artist records from Spotify track metadata. Used by fuzzy matcher
to create artist records for tracks with missing/unknown artists.

Workflow:
1. Fuzzy matcher finds Spotify match for track with unknown artist
2. Artist populator gets full track details from Spotify
3. Creates artist records if they don't exist
4. Links artists to track via track_artists table
"""

import re
import asyncio
import structlog
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from sqlalchemy.exc import IntegrityError

logger = structlog.get_logger(__name__)


class ArtistPopulator:
    """
    Populates artist records from Spotify metadata.

    Handles:
    - Artist creation with Spotify IDs
    - Name normalization
    - Duplicate detection
    - Track-artist linkage
    """

    def __init__(self, db_session_factory: async_sessionmaker, spotify_client):
        self.db_session_factory = db_session_factory
        self.spotify = spotify_client

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

    async def get_or_create_artist(
        self,
        name: str,
        spotify_id: Optional[str] = None,
        genres: Optional[List[str]] = None
    ) -> Optional[UUID]:
        """
        Get existing artist or create new one.

        Args:
            name: Artist name
            spotify_id: Spotify artist ID (if available)
            genres: List of genres (if available)

        Returns:
            artist_id (UUID) if successful, None if failed

        Duplicate Detection Priority:
        1. Match by spotify_id (exact match)
        2. Match by normalized_name (fuzzy match)
        3. Create new artist
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
                # 1. Try to find by spotify_id
                if spotify_id:
                    result = await session.execute(
                        text("SELECT artist_id FROM artists WHERE spotify_id = :spotify_id"),
                        {"spotify_id": spotify_id}
                    )
                    row = result.first()
                    if row:
                        logger.debug(
                            "Artist found by spotify_id",
                            name=name,
                            spotify_id=spotify_id,
                            artist_id=str(row.artist_id)
                        )
                        return row.artist_id

                # 2. Try to find by normalized_name
                result = await session.execute(
                    text("SELECT artist_id, spotify_id FROM artists WHERE normalized_name = :normalized_name"),
                    {"normalized_name": normalized_name}
                )
                row = result.first()
                if row:
                    # Found by name - update spotify_id if we have a new one
                    if spotify_id and not row.spotify_id:
                        await session.execute(
                            text("UPDATE artists SET spotify_id = :spotify_id WHERE artist_id = :artist_id"),
                            {"spotify_id": spotify_id, "artist_id": row.artist_id}
                        )
                        await session.commit()
                        logger.info(
                            "Updated existing artist with spotify_id",
                            name=name,
                            artist_id=str(row.artist_id),
                            spotify_id=spotify_id
                        )

                    return row.artist_id

                # 3. Create new artist
                result = await session.execute(
                    text("""
                        INSERT INTO artists (name, spotify_id, normalized_name, genres)
                        VALUES (:name, :spotify_id, :normalized_name, :genres)
                        RETURNING artist_id
                    """),
                    {
                        "name": name,
                        "spotify_id": spotify_id,
                        "normalized_name": normalized_name,
                        "genres": genres or []
                    }
                )
                row = result.first()
                await session.commit()

                logger.info(
                    "Created new artist",
                    name=name,
                    artist_id=str(row.artist_id),
                    spotify_id=spotify_id,
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
                # Retry lookup
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
