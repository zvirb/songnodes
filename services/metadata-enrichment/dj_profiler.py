"""
DJ Profiling System for Contextual Artist Attribution

Implements Section III of the Artist Attribution Framework:
- Builds probabilistic profiles of DJ musical preferences
- Analyzes setlist flow and context
- Provides Bayesian priors for artist disambiguation
"""

from typing import Dict, List, Optional, Tuple
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)


@dataclass
class DJProfile:
    """Statistical profile of a DJ's musical preferences"""
    dj_id: str
    dj_name: str
    total_tracks: int
    top_artists: List[Tuple[str, int]]  # (artist_name, count)
    top_labels: List[Tuple[str, int]]  # (label_name, count)
    top_genres: List[Tuple[str, int]]  # (genre, count)
    avg_bpm: Optional[float]
    bpm_range: Optional[Tuple[float, float]]  # (min, max)
    key_distribution: Dict[str, int]  # Camelot key -> count
    updated_at: datetime


@dataclass
class SetlistContext:
    """Musical context surrounding a track in a setlist"""
    position: int
    total_tracks: int
    prev_track: Optional[Dict]  # Previous track metadata
    next_track: Optional[Dict]  # Next track metadata
    normalized_position: float  # 0.0 to 1.0
    is_opening: bool
    is_closing: bool
    is_peak_time: bool  # Roughly middle 60% of set


class DJProfiler:
    """
    Builds and maintains probabilistic profiles of DJs for attribution.

    Based on Artist Attribution Framework Section III - uses a DJ's historical
    track selections to create a Bayesian prior for artist prediction.
    """

    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory

    async def build_profile(self, dj_name: str) -> Optional[DJProfile]:
        """
        Build a comprehensive statistical profile for a DJ.

        Args:
            dj_name: Name of the DJ

        Returns:
            DJProfile object with all computed statistics
        """
        async with self.db_session_factory() as session:
            # Get all successfully attributed tracks from this DJ's sets
            query = text("""
                WITH dj_tracks AS (
                    SELECT DISTINCT
                        t.id as track_id,
                        t.title,
                        t.genre,
                        t.bpm,
                        t.key,
                        t.metadata->>'label' as label,
                        a.name as artist_name
                    FROM playlists p
                    JOIN playlist_tracks pt ON pt.playlist_id = p.playlist_id
                    JOIN tracks t ON t.id = pt.song_id
                    LEFT JOIN track_artists ta ON ta.track_id = t.id AND ta.role = 'primary'
                    LEFT JOIN artists a ON a.artist_id = ta.artist_id
                    WHERE p.name ILIKE :dj_pattern
                        AND t.id IS NOT NULL
                )
                SELECT
                    track_id,
                    title,
                    artist_name,
                    genre,
                    label,
                    bpm,
                    key
                FROM dj_tracks
                WHERE artist_name IS NOT NULL
            """)

            result = await session.execute(
                query,
                {"dj_pattern": f"%{dj_name}%"}
            )
            tracks = result.fetchall()

            if not tracks:
                logger.warning("No attributed tracks found for DJ", dj_name=dj_name)
                return None

            # Compute statistics
            artist_counter = Counter()
            label_counter = Counter()
            genre_counter = Counter()
            key_counter = Counter()
            bpms = []

            for track in tracks:
                if track.artist_name:
                    artist_counter[track.artist_name] += 1
                if track.label:
                    label_counter[track.label] += 1
                if track.genre:
                    genre_counter[track.genre] += 1
                if track.key:
                    key_counter[track.key] += 1
                if track.bpm:
                    bpms.append(float(track.bpm))

            # Calculate BPM statistics
            avg_bpm = sum(bpms) / len(bpms) if bpms else None
            bpm_range = (min(bpms), max(bpms)) if bpms else None

            profile = DJProfile(
                dj_id=None,  # Could lookup DJ ID if we have a DJs table
                dj_name=dj_name,
                total_tracks=len(tracks),
                top_artists=artist_counter.most_common(20),
                top_labels=label_counter.most_common(15),
                top_genres=genre_counter.most_common(10),
                avg_bpm=avg_bpm,
                bpm_range=bpm_range,
                key_distribution=dict(key_counter),
                updated_at=datetime.now()
            )

            logger.info(
                "DJ profile built",
                dj_name=dj_name,
                total_tracks=profile.total_tracks,
                top_artist=profile.top_artists[0] if profile.top_artists else None,
                top_genre=profile.top_genres[0] if profile.top_genres else None
            )

            return profile

    async def get_setlist_context(
        self,
        playlist_id: str,
        track_position: int
    ) -> Optional[SetlistContext]:
        """
        Get the musical context surrounding a track in a setlist.

        Args:
            playlist_id: Playlist/setlist UUID
            track_position: Position of the track (1-indexed)

        Returns:
            SetlistContext with surrounding track metadata
        """
        async with self.db_session_factory() as session:
            # Get total tracks in setlist
            count_query = text("""
                SELECT COUNT(*) as total
                FROM playlist_tracks
                WHERE playlist_id = :playlist_id
            """)
            count_result = await session.execute(count_query, {"playlist_id": playlist_id})
            total_tracks = count_result.scalar()

            if not total_tracks:
                return None

            # Get previous track (if exists)
            prev_track = None
            if track_position > 1:
                prev_query = text("""
                    SELECT
                        t.title,
                        t.genre,
                        t.bpm,
                        t.key,
                        t.metadata->>'label' as label,
                        a.name as artist_name
                    FROM playlist_tracks pt
                    JOIN tracks t ON t.id = pt.song_id
                    LEFT JOIN track_artists ta ON ta.track_id = t.id AND ta.role = 'primary'
                    LEFT JOIN artists a ON a.artist_id = ta.artist_id
                    WHERE pt.playlist_id = :playlist_id
                        AND pt.position = :position
                """)
                prev_result = await session.execute(
                    prev_query,
                    {"playlist_id": playlist_id, "position": track_position - 1}
                )
                prev_row = prev_result.first()
                if prev_row:
                    prev_track = {
                        'title': prev_row.title,
                        'artist': prev_row.artist_name,
                        'genre': prev_row.genre,
                        'bpm': float(prev_row.bpm) if prev_row.bpm else None,
                        'key': prev_row.key,
                        'label': prev_row.label
                    }

            # Get next track (if exists)
            next_track = None
            if track_position < total_tracks:
                next_query = text("""
                    SELECT
                        t.title,
                        t.genre,
                        t.bpm,
                        t.key,
                        t.metadata->>'label' as label,
                        a.name as artist_name
                    FROM playlist_tracks pt
                    JOIN tracks t ON t.id = pt.song_id
                    LEFT JOIN track_artists ta ON ta.track_id = t.id AND ta.role = 'primary'
                    LEFT JOIN artists a ON a.artist_id = ta.artist_id
                    WHERE pt.playlist_id = :playlist_id
                        AND pt.position = :position
                """)
                next_result = await session.execute(
                    next_query,
                    {"playlist_id": playlist_id, "position": track_position + 1}
                )
                next_row = next_result.first()
                if next_row:
                    next_track = {
                        'title': next_row.title,
                        'artist': next_row.artist_name,
                        'genre': next_row.genre,
                        'bpm': float(next_row.bpm) if next_row.bpm else None,
                        'key': next_row.key,
                        'label': next_row.label
                    }

            # Calculate position metadata
            normalized_position = (track_position - 1) / (total_tracks - 1) if total_tracks > 1 else 0.5
            is_opening = normalized_position < 0.2
            is_closing = normalized_position > 0.8
            is_peak_time = 0.2 <= normalized_position <= 0.8

            context = SetlistContext(
                position=track_position,
                total_tracks=total_tracks,
                prev_track=prev_track,
                next_track=next_track,
                normalized_position=normalized_position,
                is_opening=is_opening,
                is_closing=is_closing,
                is_peak_time=is_peak_time
            )

            logger.debug(
                "Setlist context retrieved",
                playlist_id=playlist_id,
                position=track_position,
                has_prev=prev_track is not None,
                has_next=next_track is not None
            )

            return context

    def calculate_artist_affinity(
        self,
        profile: DJProfile,
        artist_candidate: str
    ) -> float:
        """
        Calculate the affinity score (0.0-1.0) between a DJ and an artist candidate.

        Uses the DJ's historical artist frequency as a Bayesian prior.

        Args:
            profile: DJ profile
            artist_candidate: Artist name to evaluate

        Returns:
            Affinity score (0.0 = never played, 1.0 = most frequently played)
        """
        if not profile.top_artists:
            return 0.5  # No data, neutral prior

        # Find artist in top artists
        for rank, (artist, count) in enumerate(profile.top_artists):
            if artist.lower() == artist_candidate.lower():
                # Normalize by top artist count for relative scoring
                top_count = profile.top_artists[0][1]
                relative_frequency = count / top_count

                # Rank-based bonus (top 5 artists get boosted)
                rank_bonus = max(0, (5 - rank) * 0.05)

                score = min(1.0, relative_frequency + rank_bonus)

                logger.debug(
                    "Artist affinity calculated",
                    artist=artist_candidate,
                    dj=profile.dj_name,
                    rank=rank + 1,
                    count=count,
                    score=score
                )

                return score

        # Artist not in profile
        return 0.1  # Low but non-zero (could still be valid)

    def check_contextual_coherence(
        self,
        context: SetlistContext,
        candidate_metadata: Dict
    ) -> Dict[str, float]:
        """
        Check how well a candidate track fits the musical context.

        Analyzes genre, BPM, key, and label coherence with surrounding tracks.

        Args:
            context: Setlist context
            candidate_metadata: Candidate track metadata (genre, bpm, key, label)

        Returns:
            Dict of coherence scores for different attributes
        """
        scores = {
            'genre_coherence': 0.5,
            'bpm_coherence': 0.5,
            'key_coherence': 0.5,
            'label_coherence': 0.5,
            'overall_coherence': 0.5
        }

        # Genre coherence
        candidate_genre = candidate_metadata.get('genre')
        if candidate_genre:
            prev_match = context.prev_track and context.prev_track.get('genre') == candidate_genre
            next_match = context.next_track and context.next_track.get('genre') == candidate_genre

            if prev_match and next_match:
                scores['genre_coherence'] = 1.0
            elif prev_match or next_match:
                scores['genre_coherence'] = 0.8
            else:
                scores['genre_coherence'] = 0.3

        # BPM coherence (Section III: typical DJs keep within 5% range)
        candidate_bpm = candidate_metadata.get('bpm')
        if candidate_bpm:
            bpm_diffs = []

            if context.prev_track and context.prev_track.get('bpm'):
                bpm_diff = abs(candidate_bpm - context.prev_track['bpm'])
                bpm_diffs.append(bpm_diff)

            if context.next_track and context.next_track.get('bpm'):
                bpm_diff = abs(candidate_bpm - context.next_track['bpm'])
                bpm_diffs.append(bpm_diff)

            if bpm_diffs:
                avg_diff = sum(bpm_diffs) / len(bpm_diffs)
                # Score: 1.0 if within 5 BPM, decreases linearly to 0.0 at 20+ BPM difference
                scores['bpm_coherence'] = max(0.0, 1.0 - (avg_diff / 20.0))

        # Key coherence (Camelot wheel compatibility)
        candidate_key = candidate_metadata.get('key')
        if candidate_key:
            compatible_count = 0
            total_checks = 0

            if context.prev_track and context.prev_track.get('key'):
                total_checks += 1
                if self._are_keys_compatible(context.prev_track['key'], candidate_key):
                    compatible_count += 1

            if context.next_track and context.next_track.get('key'):
                total_checks += 1
                if self._are_keys_compatible(candidate_key, context.next_track['key']):
                    compatible_count += 1

            if total_checks > 0:
                scores['key_coherence'] = compatible_count / total_checks

        # Label coherence
        candidate_label = candidate_metadata.get('label')
        if candidate_label:
            prev_match = context.prev_track and context.prev_track.get('label') == candidate_label
            next_match = context.next_track and context.next_track.get('label') == candidate_label

            if prev_match and next_match:
                scores['label_coherence'] = 0.9  # Same label is strong signal but not perfect
            elif prev_match or next_match:
                scores['label_coherence'] = 0.7
            else:
                scores['label_coherence'] = 0.4

        # Overall coherence (weighted average)
        scores['overall_coherence'] = (
            scores['genre_coherence'] * 0.3 +
            scores['bpm_coherence'] * 0.3 +
            scores['key_coherence'] * 0.25 +
            scores['label_coherence'] * 0.15
        )

        logger.debug(
            "Contextual coherence calculated",
            candidate_genre=candidate_genre,
            candidate_bpm=candidate_bpm,
            candidate_key=candidate_key,
            coherence_scores=scores
        )

        return scores

    def _are_keys_compatible(self, key1: str, key2: str) -> bool:
        """
        Check if two musical keys are harmonically compatible (Camelot wheel).

        Compatible transitions (Section III):
        - Same key
        - Adjacent numbers (e.g., 8A -> 9A or 7A)
        - Same number, different letter (e.g., 8A -> 8B)

        Args:
            key1: First key (Camelot notation or standard)
            key2: Second key

        Returns:
            True if keys are compatible for mixing
        """
        # Simplified check - full implementation would use Camelot wheel mapping
        # For now, exact match or similar patterns
        if key1 == key2:
            return True

        # Extract Camelot notation if present (e.g., "8A")
        import re
        camelot_pattern = re.compile(r'(\d+)([AB])')

        match1 = camelot_pattern.search(key1)
        match2 = camelot_pattern.search(key2)

        if match1 and match2:
            num1, letter1 = int(match1.group(1)), match1.group(2)
            num2, letter2 = int(match2.group(1)), match2.group(2)

            # Same number, different letter (relative major/minor)
            if num1 == num2 and letter1 != letter2:
                return True

            # Adjacent numbers, same letter
            if letter1 == letter2 and abs(num1 - num2) == 1:
                return True

            # Handle wraparound (12A -> 1A)
            if letter1 == letter2 and (
                (num1 == 12 and num2 == 1) or (num1 == 1 and num2 == 12)
            ):
                return True

        return False
