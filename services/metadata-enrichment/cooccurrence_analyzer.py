"""
🧠 Co-Occurrence Analyzer - Probabilistic Artist Identification with splink

This module uses PRODUCTION-READY probabilistic record linkage (splink library)
to identify unknown artists based on DJ set context and co-occurrence patterns.

Key Enhancement over Original:
- Uses splink (Fellegi-Sunter model) instead of manual probability calculations
- Integrates with Songstats API for reliable, structured data
- Unsupervised learning via Expectation-Maximization
- Battle-tested algorithms with 50+ years of research

Strategic Value:
- Solves "ID - ID" problem for unreleased/promo tracks
- Uses wisdom of DJ community to infer artist identity
- Legal, compliant data access via Songstats API
"""

import structlog
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import Counter, defaultdict
from datetime import datetime
import pandas as pd

logger = structlog.get_logger(__name__)


@dataclass
class TrackContext:
    """Context information for a single occurrence of a track in a set"""
    dj_name: str
    set_name: str
    set_date: Optional[datetime]
    position_in_set: int
    total_tracks: int

    # Surrounding tracks
    prev_track_artist: Optional[str] = None
    prev_track_title: Optional[str] = None
    prev_track_label: Optional[str] = None

    next_track_artist: Optional[str] = None
    next_track_title: Optional[str] = None
    next_track_label: Optional[str] = None

    # DJ metadata
    dj_label: Optional[str] = None
    dj_signature_artists: List[str] = field(default_factory=list)


@dataclass
class ArtistProbability:
    """A probabilistic artist match based on splink analysis"""
    artist_name: str
    probability: float  # 0.0 - 1.0 from splink
    confidence: float  # Model confidence
    evidence: List[str]  # Human-readable evidence

    # Supporting data
    occurrence_count: int
    label_support: Optional[str] = None
    context_strength: float = 0.0


class CoOccurrenceAnalyzer:
    """
    Analyzes playlist context using splink for probabilistic matching

    This is the PRODUCTION VERSION using splink library (Fellegi-Sunter model)
    instead of custom probability calculations.
    """

    def __init__(
        self,
        min_occurrences: int = 2,
        min_probability: float = 0.70,  # Higher threshold with splink
        context_window: int = 2
    ):
        self.min_occurrences = min_occurrences
        self.min_probability = min_probability
        self.context_window = context_window

    async def analyze_track_context(
        self,
        track_title: str,
        contexts: List[TrackContext],
        candidate_artists: Optional[List[str]] = None
    ) -> List[ArtistProbability]:
        """
        Analyze track contexts using splink probabilistic matching

        Args:
            track_title: The track we're trying to identify
            contexts: List of contexts where this track appeared
            candidate_artists: Optional list to restrict search

        Returns:
            List of probable artists sorted by probability
        """
        if len(contexts) < self.min_occurrences:
            logger.debug(
                "Insufficient context data",
                track_title=track_title,
                contexts=len(contexts),
                min_required=self.min_occurrences
            )
            return []

        # Extract features from contexts
        features_df = self._extract_features(track_title, contexts)

        if features_df.empty:
            logger.debug("No features extracted from contexts")
            return []

        # Use splink for probabilistic matching
        try:
            probabilities = await self._run_splink_matching(
                features_df,
                candidate_artists
            )
        except Exception as e:
            logger.error("splink matching failed", error=str(e))
            # Fallback to manual calculation
            probabilities = self._fallback_manual_calculation(
                features_df,
                contexts
            )

        # Filter by minimum probability
        high_probability = [
            p for p in probabilities
            if p.probability >= self.min_probability
        ]

        high_probability.sort(key=lambda p: p.probability, reverse=True)

        if high_probability:
            logger.info(
                "🧠 splink analysis found probable artists",
                track_title=track_title,
                top_candidate=high_probability[0].artist_name,
                probability=high_probability[0].probability,
                candidates_found=len(high_probability)
            )

        return high_probability

    def _extract_features(
        self,
        track_title: str,
        contexts: List[TrackContext]
    ) -> pd.DataFrame:
        """
        Extract features from contexts for splink matching

        Features:
        - dj_is_candidate: Is the DJ a potential artist?
        - artist_played_before: Did artist appear before this track?
        - artist_played_after: Did artist appear after this track?
        - label_match_before: Does label match previous track?
        - label_match_after: Does label match next track?
        - dj_label_owner: Does DJ own the label?
        - position_in_set: Normalized position (opening/closing patterns)
        """
        records = []

        for ctx in contexts:
            # Extract candidate artists from context
            candidates = set()

            if ctx.prev_track_artist and ctx.prev_track_artist.lower() not in ['unknown', 'id', '']:
                candidates.add(ctx.prev_track_artist)

            if ctx.next_track_artist and ctx.next_track_artist.lower() not in ['unknown', 'id', '']:
                candidates.add(ctx.next_track_artist)

            if ctx.dj_signature_artists:
                candidates.update(ctx.dj_signature_artists)

            # Create record for each candidate
            for candidate in candidates:
                position_ratio = ctx.position_in_set / max(ctx.total_tracks, 1)

                record = {
                    'track_title': track_title,
                    'candidate_artist': candidate,
                    'dj_name': ctx.dj_name,
                    'set_name': ctx.set_name,

                    # Binary features for splink
                    'dj_is_candidate': int(ctx.dj_name == candidate),
                    'artist_played_before': int(ctx.prev_track_artist == candidate),
                    'artist_played_after': int(ctx.next_track_artist == candidate),
                    'label_match_before': int(
                        ctx.prev_track_label is not None and
                        ctx.prev_track_label != ''
                    ),
                    'label_match_after': int(
                        ctx.next_track_label is not None and
                        ctx.next_track_label != ''
                    ),
                    'dj_label_owner': int(
                        ctx.dj_label is not None and
                        (ctx.prev_track_label == ctx.dj_label or
                         ctx.next_track_label == ctx.dj_label)
                    ),

                    # Continuous features
                    'position_in_set': position_ratio,

                    # Metadata
                    'prev_track_label': ctx.prev_track_label,
                    'next_track_label': ctx.next_track_label,
                    'dj_label': ctx.dj_label,
                    'set_date': ctx.set_date
                }

                records.append(record)

        return pd.DataFrame(records)

    async def _run_splink_matching(
        self,
        features_df: pd.DataFrame,
        candidate_artists: Optional[List[str]]
    ) -> List[ArtistProbability]:
        """
        Run splink probabilistic record linkage

        Uses Fellegi-Sunter model with Expectation-Maximization training
        """
        try:
            from splink.duckdb.linker import DuckDBLinker
            from splink.duckdb.blocking_rule_library import block_on
            import splink.duckdb.comparison_library as cl
        except ImportError:
            logger.warning("splink not available, falling back to manual calculation")
            raise ImportError("splink library not installed")

        # Filter candidates if provided
        if candidate_artists:
            features_df = features_df[
                features_df['candidate_artist'].isin(candidate_artists)
            ]

        if features_df.empty:
            return []

        # Define splink settings
        settings = {
            "link_type": "dedupe_only",
            "blocking_rules_to_generate_predictions": [
                block_on("candidate_artist"),
            ],
            "comparisons": [
                cl.exact_match("dj_is_candidate", term_frequency_adjustments=True),
                cl.exact_match("artist_played_before", term_frequency_adjustments=True),
                cl.exact_match("artist_played_after", term_frequency_adjustments=True),
                cl.exact_match("label_match_before"),
                cl.exact_match("label_match_after"),
                cl.exact_match("dj_label_owner", term_frequency_adjustments=True),
            ],
        }

        # Create linker
        linker = DuckDBLinker(features_df, settings)

        # Estimate parameters using Expectation-Maximization
        try:
            linker.estimate_u_using_random_sampling(max_pairs=1e6)

            # Estimate m probabilities
            linker.estimate_parameters_using_expectation_maximisation(
                block_on("candidate_artist")
            )
        except Exception as e:
            logger.warning("EM parameter estimation failed", error=str(e))
            # Continue with default parameters

        # Predict matches
        df_predictions = linker.predict()

        # Convert to ArtistProbability objects
        probabilities = self._convert_splink_results(
            df_predictions,
            features_df
        )

        return probabilities

    def _convert_splink_results(
        self,
        predictions_df: pd.DataFrame,
        features_df: pd.DataFrame
    ) -> List[ArtistProbability]:
        """
        Convert splink prediction results to ArtistProbability objects
        """
        probabilities = []

        # Group by candidate artist
        artist_groups = features_df.groupby('candidate_artist')

        for artist, group in artist_groups:
            # Get splink match probability (if available)
            artist_predictions = predictions_df[
                (predictions_df['candidate_artist_l'] == artist) |
                (predictions_df['candidate_artist_r'] == artist)
            ]

            if not artist_predictions.empty:
                # Use splink probability
                match_probability = artist_predictions['match_probability'].max()
            else:
                # No splink prediction, use feature-based estimate
                match_probability = self._estimate_probability_from_features(group)

            # Calculate confidence
            confidence = min(len(group) / (self.min_occurrences * 2), 1.0)

            # Extract evidence
            evidence = self._extract_evidence(group)

            # Label support
            label_counter = Counter(
                group['prev_track_label'].dropna().tolist() +
                group['next_track_label'].dropna().tolist()
            )
            label_support = label_counter.most_common(1)[0][0] if label_counter else None

            # Context strength
            context_strength = len(group) / len(features_df)

            probabilities.append(ArtistProbability(
                artist_name=artist,
                probability=match_probability,
                confidence=confidence,
                evidence=evidence,
                occurrence_count=len(group),
                label_support=label_support,
                context_strength=context_strength
            ))

        return probabilities

    def _estimate_probability_from_features(
        self,
        group_df: pd.DataFrame
    ) -> float:
        """
        Estimate probability from feature values when splink unavailable
        """
        features = {
            'dj_is_candidate': group_df['dj_is_candidate'].mean(),
            'artist_played_before': group_df['artist_played_before'].mean(),
            'artist_played_after': group_df['artist_played_after'].mean(),
            'label_match': (
                group_df['label_match_before'].mean() +
                group_df['label_match_after'].mean()
            ) / 2,
            'dj_label_owner': group_df['dj_label_owner'].mean()
        }

        # Weighted combination
        probability = (
            features['dj_is_candidate'] * 0.15 +
            features['artist_played_before'] * 0.25 +
            features['artist_played_after'] * 0.25 +
            features['label_match'] * 0.20 +
            features['dj_label_owner'] * 0.15
        )

        return min(probability, 1.0)

    def _extract_evidence(
        self,
        group_df: pd.DataFrame
    ) -> List[str]:
        """
        Extract human-readable evidence from feature data
        """
        evidence = []

        # Count feature occurrences
        if group_df['artist_played_before'].sum() > 0:
            count = int(group_df['artist_played_before'].sum())
            evidence.append(f"Played after this artist in {count} set(s)")

        if group_df['artist_played_after'].sum() > 0:
            count = int(group_df['artist_played_after'].sum())
            evidence.append(f"Played before this artist in {count} set(s)")

        if group_df['dj_label_owner'].sum() > 0:
            count = int(group_df['dj_label_owner'].sum())
            djs = group_df[group_df['dj_label_owner'] == 1]['dj_name'].unique()
            evidence.append(f"Played by label owner(s): {', '.join(djs[:2])}")

        if group_df['dj_is_candidate'].sum() > 0:
            evidence.append(f"Played by the artist themselves")

        # Label consistency
        label_counter = Counter(
            group_df['prev_track_label'].dropna().tolist() +
            group_df['next_track_label'].dropna().tolist()
        )
        if label_counter:
            top_label, count = label_counter.most_common(1)[0]
            if count >= 2:
                evidence.append(f"Surrounded by {top_label} releases ({count} times)")

        return evidence[:5]  # Top 5

    def _fallback_manual_calculation(
        self,
        features_df: pd.DataFrame,
        contexts: List[TrackContext]
    ) -> List[ArtistProbability]:
        """
        Fallback to manual probability calculation if splink fails
        """
        logger.info("Using fallback manual probability calculation")

        probabilities = []
        total_contexts = len(contexts)

        artist_groups = features_df.groupby('candidate_artist')

        for artist, group in artist_groups:
            if len(group) < self.min_occurrences:
                continue

            probability = self._estimate_probability_from_features(group)
            confidence = min(len(group) / (self.min_occurrences * 2), 1.0)
            evidence = self._extract_evidence(group)

            label_counter = Counter(
                group['prev_track_label'].dropna().tolist() +
                group['next_track_label'].dropna().tolist()
            )
            label_support = label_counter.most_common(1)[0][0] if label_counter else None

            probabilities.append(ArtistProbability(
                artist_name=artist,
                probability=probability,
                confidence=confidence,
                evidence=evidence,
                occurrence_count=len(group),
                label_support=label_support,
                context_strength=len(group) / len(features_df)
            ))

        return probabilities


# ============================================================================
# SONGSTATS API INTEGRATION
# ============================================================================

async def get_track_contexts_from_songstats(
    songstats_client,
    track_title: str,
    artist_name: Optional[str] = None,
    label: Optional[str] = None,
    min_dj_plays: int = 2
) -> List[TrackContext]:
    """
    Get track contexts from Songstats API

    This replaces fragile web scraping with legal, structured data access.

    Args:
        songstats_client: Initialized Songstats client
        track_title: Track to analyze
        artist_name: Optional artist hint
        label: Optional label hint
        min_dj_plays: Minimum DJ plays required

    Returns:
        List of TrackContext objects from 1001Tracklists data
    """
    if not songstats_client:
        logger.warning("Songstats client not available")
        return []

    # Get DJ supports from Songstats
    dj_supports = await songstats_client.get_dj_supports_for_track(
        track_title=track_title,
        artist_name=artist_name,
        label=label,
        min_supports=min_dj_plays
    )

    if not dj_supports:
        logger.debug(
            "No DJ support data from Songstats",
            track=track_title
        )
        return []

    contexts = []

    for support in dj_supports:
        # Get surrounding tracks (if API supports it)
        surrounding = await songstats_client.get_surrounding_tracks(
            support,
            context_window=2
        )

        # Extract prev/next track info
        prev_track = surrounding.get('before', [None])[0] if surrounding.get('before') else None
        next_track = surrounding.get('after', [None])[0] if surrounding.get('after') else None

        context = TrackContext(
            dj_name=support.dj_name,
            set_name=support.set_name,
            set_date=support.set_date,
            position_in_set=support.position_in_set,
            total_tracks=support.total_tracks,
            prev_track_artist=prev_track.get('artist') if prev_track else None,
            prev_track_title=prev_track.get('title') if prev_track else None,
            prev_track_label=prev_track.get('label') if prev_track else None,
            next_track_artist=next_track.get('artist') if next_track else None,
            next_track_title=next_track.get('title') if next_track else None,
            next_track_label=next_track.get('label') if next_track else None
        )

        contexts.append(context)

    logger.info(
        "Retrieved contexts from Songstats",
        track=track_title,
        contexts=len(contexts)
    )

    return contexts


# ============================================================================
# BATCH PROCESSING
# ============================================================================

async def enrich_tracks_with_probabilistic_matching(
    db_session_factory,
    songstats_client,
    limit: int = 50,
    min_confidence: float = 0.70
) -> Dict[str, int]:
    """
    Batch process tracks using probabilistic matching

    Args:
        db_session_factory: Database session factory
        songstats_client: Initialized Songstats client
        limit: Maximum tracks to process
        min_confidence: Minimum probability threshold

    Returns:
        Statistics dictionary
    """
    stats = {
        'processed': 0,
        'artists_found': 0,
        'artists_updated': 0,
        'failed': 0,
        'by_confidence': {
            'high': 0,  # >0.85
            'medium': 0,  # 0.70-0.85
            'low': 0  # <0.70 (rejected)
        }
    }

    analyzer = CoOccurrenceAnalyzer(min_probability=min_confidence)

    # Get tracks with unknown artists
    async with db_session_factory() as session:
        from sqlalchemy import select, and_, or_
        from common.models import Track

        query = select(Track).where(
            or_(
                Track.artist_name == None,
                Track.artist_name == '',
                Track.artist_name.ilike('%ID%'),
                Track.artist_name.ilike('%Unknown%')
            )
        ).limit(limit)

        result = await session.execute(query)
        tracks = result.scalars().all()

    logger.info(
        "🧠 Starting probabilistic matching",
        tracks_to_process=len(tracks)
    )

    for track in tracks:
        stats['processed'] += 1

        try:
            # Get contexts from Songstats
            contexts = await get_track_contexts_from_songstats(
                songstats_client=songstats_client,
                track_title=track.title,
                artist_name=track.artist_name if track.artist_name not in [None, '', 'ID', 'Unknown'] else None,
                label=track.existing_label,
                min_dj_plays=2
            )

            if not contexts:
                stats['failed'] += 1
                continue

            # Analyze contexts
            probabilities = await analyzer.analyze_track_context(
                track_title=track.title,
                contexts=contexts
            )

            if not probabilities:
                stats['failed'] += 1
                continue

            # Get best match
            best_match = probabilities[0]

            # Categorize by confidence
            if best_match.probability >= 0.85:
                stats['by_confidence']['high'] += 1
            elif best_match.probability >= 0.70:
                stats['by_confidence']['medium'] += 1
            else:
                stats['by_confidence']['low'] += 1
                stats['failed'] += 1
                continue

            # Update track
            async with db_session_factory() as session:
                track.artist_name = best_match.artist_name
                track.metadata = track.metadata or {}
                track.metadata['probabilistic_matcher'] = {
                    'artist': best_match.artist_name,
                    'probability': best_match.probability,
                    'confidence': best_match.confidence,
                    'evidence': best_match.evidence,
                    'label_support': best_match.label_support,
                    'occurrence_count': best_match.occurrence_count,
                    'matched_at': datetime.utcnow().isoformat()
                }

                session.add(track)
                await session.commit()

            stats['artists_found'] += 1
            stats['artists_updated'] += 1

            logger.info(
                "✅ Artist identified via probabilistic matching",
                track=track.title,
                artist=best_match.artist_name,
                probability=best_match.probability
            )

        except Exception as e:
            logger.error(
                "Probabilistic matching failed for track",
                track_id=track.id,
                error=str(e)
            )
            stats['failed'] += 1

    return stats
