"""
Confidence Scoring Framework for Artist Attribution

Implements Section VII of the Artist Attribution Framework.
Provides transparent, quantitative confidence scores for each attribution method.
"""

from enum import Enum
from typing import Dict, Optional
from dataclasses import dataclass
import structlog

logger = structlog.get_logger(__name__)


class AttributionMethod(str, Enum):
    """Attribution methods in order of confidence tier"""
    # Tier 1: Deterministic, Authoritative (0.99)
    EXACT_API_MATCH = "exact_api_match"

    # Tier 2: Heuristically-Assisted (0.90)
    DISAMBIGUATED_API_MATCH = "disambiguated_api_match"

    # Tier 3: Community-Verified (0.85)
    COMMUNITY_DATABASE_MATCH = "community_database_match"

    # Tier 4: Algorithmic Similarity (0.60-0.80)
    FUZZY_STRING_MATCH = "fuzzy_string_match"

    # Tier 5: Predictive Model (model probability)
    ML_PREDICTION = "ml_prediction"

    # Tier 6: Purely Inferential (0.40)
    CONTEXTUAL_INFERENCE = "contextual_inference"

    # Special: Manual verification (1.0)
    MANUAL_VERIFICATION = "manual_verification"


@dataclass
class ConfidenceScore:
    """Structured confidence score with metadata"""
    score: float  # 0.0 to 1.0
    method: AttributionMethod
    source_api: Optional[str] = None  # Which API provided the match
    disambiguation_factors: Optional[Dict] = None  # Factors used in disambiguation
    fuzzy_score: Optional[int] = None  # Raw fuzzy match score (0-100)
    ml_probability: Optional[float] = None  # Raw ML model probability
    contextual_boost: float = 0.0  # Adjustment from contextual analysis
    final_score: Optional[float] = None  # Score after adjustments


class ConfidenceScorer:
    """
    Calculates and manages confidence scores for artist attributions.

    Based on Section VII of the Artist Attribution Framework:
    - Tiered scoring based on attribution method
    - Dynamic adjustments from contextual evidence
    - Transparent scoring for data quality management
    """

    # Base confidence scores for each tier
    TIER_SCORES = {
        AttributionMethod.EXACT_API_MATCH: 0.99,
        AttributionMethod.DISAMBIGUATED_API_MATCH: 0.90,
        AttributionMethod.COMMUNITY_DATABASE_MATCH: 0.85,
        AttributionMethod.ML_PREDICTION: None,  # Uses model probability
        AttributionMethod.CONTEXTUAL_INFERENCE: 0.40,
        AttributionMethod.MANUAL_VERIFICATION: 1.0,
    }

    # API authority weights for disambiguation
    API_AUTHORITY = {
        'discogs': 1.0,
        'beatport': 0.95,
        'musicbrainz': 0.90,
        'spotify': 0.85,
        'soundcloud': 0.70,
        '1001tracklists': 0.85,
        'mixesdb': 0.80,
    }

    def __init__(self):
        pass

    def score_exact_api_match(
        self,
        api_name: str,
        match_quality: str = "exact"
    ) -> ConfidenceScore:
        """
        Score an exact API match (Tier 1).

        Args:
            api_name: Name of the API source
            match_quality: "exact" or "partial"

        Returns:
            ConfidenceScore with base score 0.99
        """
        base_score = self.TIER_SCORES[AttributionMethod.EXACT_API_MATCH]

        # Adjust for partial matches
        if match_quality == "partial":
            base_score = 0.95

        return ConfidenceScore(
            score=base_score,
            method=AttributionMethod.EXACT_API_MATCH,
            source_api=api_name.lower()
        )

    def score_disambiguated_match(
        self,
        api_name: str,
        disambiguation_factors: Dict,
        num_candidates: int
    ) -> ConfidenceScore:
        """
        Score a disambiguated API match (Tier 2).

        Args:
            api_name: Name of the API source
            disambiguation_factors: Dict of factors used (genre, year, popularity, etc.)
            num_candidates: Number of candidates that were disambiguated

        Returns:
            ConfidenceScore with base score 0.90, adjusted by disambiguation strength
        """
        base_score = self.TIER_SCORES[AttributionMethod.DISAMBIGUATED_API_MATCH]

        # Penalty for large number of candidates (more ambiguous)
        if num_candidates > 5:
            base_score -= 0.05
        elif num_candidates > 10:
            base_score -= 0.10

        # Boost for strong disambiguation factors
        strong_factors = sum(1 for k, v in disambiguation_factors.items()
                           if k in ['genre_match', 'label_match', 'year_match'] and v)
        if strong_factors >= 2:
            base_score += 0.03

        return ConfidenceScore(
            score=min(0.95, base_score),
            method=AttributionMethod.DISAMBIGUATED_API_MATCH,
            source_api=api_name.lower(),
            disambiguation_factors=disambiguation_factors
        )

    def score_community_match(
        self,
        platform: str,
        has_external_link: bool = False,
        dj_support_count: Optional[int] = None
    ) -> ConfidenceScore:
        """
        Score a community database match (Tier 3).

        Args:
            platform: Platform name (1001tracklists, mixesdb)
            has_external_link: Whether entry links to authoritative source
            dj_support_count: Number of DJs who have played this track

        Returns:
            ConfidenceScore with base score 0.85
        """
        base_score = self.TIER_SCORES[AttributionMethod.COMMUNITY_DATABASE_MATCH]

        # Boost if has external verification link
        if has_external_link:
            base_score += 0.05

        # Boost based on DJ support (popularity heuristic)
        if dj_support_count:
            if dj_support_count > 100:
                base_score += 0.05
            elif dj_support_count > 50:
                base_score += 0.03
            elif dj_support_count > 20:
                base_score += 0.01

        return ConfidenceScore(
            score=min(0.93, base_score),
            method=AttributionMethod.COMMUNITY_DATABASE_MATCH,
            source_api=platform.lower()
        )

    def score_fuzzy_match(
        self,
        fuzzy_score: int,
        threshold: int = 85,
        method: str = "token_set_ratio"
    ) -> ConfidenceScore:
        """
        Score a fuzzy string match (Tier 4).

        Uses formula from Section VII:
        - Threshold (85) maps to 0.60
        - Perfect match (100) maps to 0.80

        Args:
            fuzzy_score: Raw fuzzy match score (0-100)
            threshold: Minimum threshold for valid match
            method: Fuzzy matching method used

        Returns:
            ConfidenceScore with score 0.60-0.80 based on match quality
        """
        if fuzzy_score < threshold:
            # Below threshold - not a valid match
            score = 0.0
        elif fuzzy_score >= 100:
            score = 0.80
        else:
            # Linear interpolation: threshold -> 0.60, 100 -> 0.80
            score = 0.60 + ((fuzzy_score - threshold) / (100 - threshold)) * 0.20

        return ConfidenceScore(
            score=score,
            method=AttributionMethod.FUZZY_STRING_MATCH,
            fuzzy_score=fuzzy_score
        )

    def score_ml_prediction(
        self,
        model_probability: float,
        model_type: str = "xgboost"
    ) -> ConfidenceScore:
        """
        Score a machine learning prediction (Tier 5).

        Uses the model's own probability as the confidence score.

        Args:
            model_probability: Model's predicted probability (0.0-1.0)
            model_type: Type of ML model used

        Returns:
            ConfidenceScore with score = model probability
        """
        return ConfidenceScore(
            score=model_probability,
            method=AttributionMethod.ML_PREDICTION,
            ml_probability=model_probability,
            source_api=f"ml_{model_type}"
        )

    def score_contextual_inference(
        self,
        inference_strength: float = 0.5
    ) -> ConfidenceScore:
        """
        Score a purely contextual inference (Tier 6).

        Args:
            inference_strength: Strength of contextual evidence (0.0-1.0)

        Returns:
            ConfidenceScore with base score 0.40, adjusted by strength
        """
        base_score = self.TIER_SCORES[AttributionMethod.CONTEXTUAL_INFERENCE]

        # Adjust by inference strength
        adjusted_score = base_score + (inference_strength * 0.20)

        return ConfidenceScore(
            score=min(0.60, adjusted_score),
            method=AttributionMethod.CONTEXTUAL_INFERENCE
        )

    def apply_contextual_boost(
        self,
        base_confidence: ConfidenceScore,
        dj_affinity: float = 0.0,
        coherence_score: float = 0.0
    ) -> ConfidenceScore:
        """
        Apply contextual boost to a base confidence score.

        Section VII: Scores can be adjusted based on corroborating evidence.

        Args:
            base_confidence: Original confidence score
            dj_affinity: DJ's affinity for this artist (0.0-1.0)
            coherence_score: Musical coherence with context (0.0-1.0)

        Returns:
            Updated ConfidenceScore with contextual_boost applied
        """
        boost = 0.0

        # DJ affinity boost (max +0.10)
        if dj_affinity > 0.8:
            boost += 0.10
        elif dj_affinity > 0.6:
            boost += 0.05
        elif dj_affinity > 0.4:
            boost += 0.02

        # Coherence boost (max +0.10)
        if coherence_score > 0.8:
            boost += 0.10
        elif coherence_score > 0.6:
            boost += 0.05
        elif coherence_score > 0.4:
            boost += 0.02

        # Penalty for poor coherence
        if coherence_score < 0.3:
            boost -= 0.10

        final_score = min(0.99, max(0.0, base_confidence.score + boost))

        logger.debug(
            "Contextual boost applied",
            original_score=base_confidence.score,
            dj_affinity=dj_affinity,
            coherence=coherence_score,
            boost=boost,
            final_score=final_score
        )

        return ConfidenceScore(
            score=base_confidence.score,
            method=base_confidence.method,
            source_api=base_confidence.source_api,
            disambiguation_factors=base_confidence.disambiguation_factors,
            fuzzy_score=base_confidence.fuzzy_score,
            ml_probability=base_confidence.ml_probability,
            contextual_boost=boost,
            final_score=final_score
        )

    def get_quality_tier(self, confidence_score: float) -> str:
        """
        Classify a confidence score into quality tier for data governance.

        Args:
            confidence_score: Confidence score (0.0-1.0)

        Returns:
            Quality tier name
        """
        if confidence_score >= 0.95:
            return "VERIFIED"  # Highest quality, production-ready
        elif confidence_score >= 0.85:
            return "HIGH"  # High quality, suitable for most use cases
        elif confidence_score >= 0.70:
            return "MEDIUM"  # Moderate quality, use with caution
        elif confidence_score >= 0.50:
            return "LOW"  # Low quality, exploratory use only
        else:
            return "UNCERTAIN"  # Very low quality, likely incorrect

    def should_flag_for_review(
        self,
        confidence_score: float,
        threshold: float = 0.60
    ) -> bool:
        """
        Determine if an attribution should be flagged for manual review.

        Args:
            confidence_score: Confidence score
            threshold: Minimum acceptable confidence

        Returns:
            True if should be flagged for review
        """
        return confidence_score < threshold

    def get_confidence_explanation(self, confidence: ConfidenceScore) -> str:
        """
        Generate human-readable explanation of confidence score.

        Args:
            confidence: ConfidenceScore object

        Returns:
            Explanation string
        """
        method_explanations = {
            AttributionMethod.EXACT_API_MATCH: f"Exact match from {confidence.source_api} API",
            AttributionMethod.DISAMBIGUATED_API_MATCH: f"Disambiguated match from {confidence.source_api} using context",
            AttributionMethod.COMMUNITY_DATABASE_MATCH: f"Community-verified from {confidence.source_api}",
            AttributionMethod.FUZZY_STRING_MATCH: f"Fuzzy match (similarity: {confidence.fuzzy_score}%)",
            AttributionMethod.ML_PREDICTION: f"ML prediction (probability: {confidence.ml_probability:.2f})",
            AttributionMethod.CONTEXTUAL_INFERENCE: "Inferred from context",
            AttributionMethod.MANUAL_VERIFICATION: "Manually verified"
        }

        explanation = method_explanations.get(
            confidence.method,
            f"Attribution via {confidence.method}"
        )

        if confidence.contextual_boost != 0:
            boost_direction = "increased" if confidence.contextual_boost > 0 else "decreased"
            explanation += f" (confidence {boost_direction} by context: {abs(confidence.contextual_boost):.2f})"

        final_score = confidence.final_score or confidence.score
        tier = self.get_quality_tier(final_score)

        return f"{explanation} - Quality: {tier} ({final_score:.2f})"
