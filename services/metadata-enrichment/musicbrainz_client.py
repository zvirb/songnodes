"""
🎶 MusicBrainz API Client - Open-Source Music Encyclopedia

MusicBrainz is a community-maintained open music encyclopedia that provides
comprehensive metadata for millions of tracks, albums, and artists.

Strategic Value for Label Hunter:
- FREE and OPEN: No licensing costs, no rate limits beyond reasonable use
- LEGALLY SAFE: Open data licenses, explicitly designed for reuse
- HIGH QUALITY: Community-validated, professional-grade metadata
- COMPREHENSIVE: Excellent coverage of electronic music releases

This client is PRIORITY 2 in the Label Hunter's risk-stratified architecture:
  Priority 1: Official Partner APIs (Beatport with license)
  Priority 2: MusicBrainz (THIS CLIENT) ← Open, free, safe
  Priority 3: Web scraping (Juno, Traxsource) ← Higher risk

API Documentation: https://musicbrainz.org/doc/MusicBrainz_API
Rate Limiting: 1 req/sec (we respect this with built-in throttling)
"""

import asyncio
import structlog
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

import httpx

logger = structlog.get_logger(__name__)


@dataclass
class MusicBrainzRelease:
    """A release (album/EP/single) from MusicBrainz"""
    release_id: str
    title: str
    artist: str
    label: Optional[str]
    catalog_number: Optional[str]
    release_date: Optional[str]
    country: Optional[str]
    format: Optional[str]  # CD, Vinyl, Digital, etc.
    barcode: Optional[str]
    confidence_score: float  # How well this matches our search


class MusicBrainzClient:
    """
    Async client for MusicBrainz API

    Provides label information lookup with built-in rate limiting
    to respect MusicBrainz's usage guidelines (1 request/second).
    """

    def __init__(
        self,
        app_name: str = "SongNodes",
        app_version: str = "1.0",
        contact_email: str = "dev@songnodes.local",
        base_url: str = "https://musicbrainz.org/ws/2",
        requests_per_second: float = 0.9  # Slightly under 1/sec for safety
    ):
        """
        Initialize MusicBrainz API client

        Args:
            app_name: Your application name (required by MusicBrainz)
            app_version: Your application version
            contact_email: Contact email (MusicBrainz asks for this)
            base_url: API base URL
            requests_per_second: Rate limit (default 0.9 to stay under 1/sec)
        """
        self.base_url = base_url
        self.min_request_interval = 1.0 / requests_per_second
        self.last_request_time = datetime.min

        # MusicBrainz requires User-Agent with app name/version/contact
        self.headers = {
            'User-Agent': f'{app_name}/{app_version} ( {contact_email} )',
            'Accept': 'application/json'
        }

    async def _rate_limit(self):
        """
        Enforce rate limiting (1 request per second)

        MusicBrainz requires this - exceeding rate limits can result in
        temporary IP bans.
        """
        now = datetime.utcnow()
        time_since_last = (now - self.last_request_time).total_seconds()

        if time_since_last < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last
            await asyncio.sleep(sleep_time)

        self.last_request_time = datetime.utcnow()

    async def search_release(
        self,
        track_title: str,
        artist_name: Optional[str] = None,
        limit: int = 10
    ) -> List[MusicBrainzRelease]:
        """
        Search for releases (albums/EPs/singles) by track title

        Args:
            track_title: Track title to search for
            artist_name: Optional artist name to narrow search
            limit: Maximum results to return

        Returns:
            List of MusicBrainzRelease objects
        """
        await self._rate_limit()

        try:
            # Build Lucene query
            # https://musicbrainz.org/doc/Indexed_Search_Syntax
            if artist_name:
                query = f'recording:"{track_title}" AND artist:"{artist_name}"'
            else:
                query = f'recording:"{track_title}"'

            params = {
                'query': query,
                'limit': limit,
                'fmt': 'json'
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/recording/",
                    headers=self.headers,
                    params=params
                )

                response.raise_for_status()
                data = response.json()

                recordings = data.get('recordings', [])

                logger.debug(
                    "MusicBrainz search completed",
                    query=track_title,
                    results=len(recordings)
                )

                # Extract releases from recordings
                return await self._process_recordings(
                    recordings,
                    track_title,
                    artist_name
                )

        except httpx.HTTPStatusError as e:
            logger.error(
                "MusicBrainz API error",
                status=e.response.status_code,
                error=str(e)
            )
            return []
        except Exception as e:
            logger.error("MusicBrainz search failed", error=str(e))
            return []

    async def _process_recordings(
        self,
        recordings: List[Dict[str, Any]],
        target_title: str,
        target_artist: Optional[str]
    ) -> List[MusicBrainzRelease]:
        """
        Process recording results to extract label information

        Args:
            recordings: Raw recording data from MusicBrainz
            target_title: Original search title for confidence scoring
            target_artist: Original search artist for confidence scoring

        Returns:
            List of MusicBrainzRelease objects with confidence scores
        """
        releases = []

        for recording in recordings:
            # Each recording can have multiple releases
            for release_data in recording.get('releases', []):
                try:
                    # Extract label from label-info
                    label = None
                    catalog_number = None

                    label_info = release_data.get('label-info', [])
                    if label_info:
                        first_label = label_info[0]
                        if 'label' in first_label:
                            label = first_label['label'].get('name')
                        catalog_number = first_label.get('catalog-number')

                    # Calculate confidence score
                    confidence = self._calculate_confidence(
                        release_title=release_data.get('title', ''),
                        release_artist=recording.get('artist-credit', [{}])[0].get('name', ''),
                        target_title=target_title,
                        target_artist=target_artist,
                        has_label=label is not None,
                        score=recording.get('score', 0)  # MusicBrainz search score
                    )

                    release = MusicBrainzRelease(
                        release_id=release_data.get('id', ''),
                        title=release_data.get('title', ''),
                        artist=recording.get('artist-credit', [{}])[0].get('name', ''),
                        label=label,
                        catalog_number=catalog_number,
                        release_date=release_data.get('date'),
                        country=release_data.get('country'),
                        format=release_data.get('media', [{}])[0].get('format') if release_data.get('media') else None,
                        barcode=release_data.get('barcode'),
                        confidence_score=confidence
                    )

                    releases.append(release)

                except Exception as e:
                    logger.warning("Failed to process release", error=str(e))
                    continue

        # Sort by confidence score (descending)
        releases.sort(key=lambda r: r.confidence_score, reverse=True)

        return releases

    def _calculate_confidence(
        self,
        release_title: str,
        release_artist: str,
        target_title: str,
        target_artist: Optional[str],
        has_label: bool,
        score: int  # MusicBrainz's own relevance score (0-100)
    ) -> float:
        """
        Calculate confidence score for a release match

        Args:
            release_title: Title from MusicBrainz
            release_artist: Artist from MusicBrainz
            target_title: Our search title
            target_artist: Our search artist
            has_label: Whether release has label information
            score: MusicBrainz's search score (0-100)

        Returns:
            Confidence score (0.0 - 1.0)
        """
        # Base confidence from MusicBrainz's own scoring
        base_confidence = score / 100.0

        # Bonus if we have label data
        if has_label:
            base_confidence = min(1.0, base_confidence + 0.2)

        # Penalty if artist doesn't match (when we have artist hint)
        if target_artist:
            artist_match = self._fuzzy_match(
                release_artist.lower(),
                target_artist.lower()
            )
            base_confidence *= artist_match

        return base_confidence

    def _fuzzy_match(self, str1: str, str2: str) -> float:
        """
        Calculate fuzzy string similarity

        Returns: 0.0 - 1.0 similarity score
        """
        # Simple token overlap
        tokens1 = set(str1.split())
        tokens2 = set(str2.split())

        if not tokens1 or not tokens2:
            return 0.0

        overlap = len(tokens1 & tokens2)
        total = len(tokens1 | tokens2)

        return overlap / total

    async def get_label_for_track(
        self,
        track_title: str,
        artist_name: Optional[str] = None,
        confidence_threshold: float = 0.70
    ) -> Optional[str]:
        """
        Get label for a track (simplified interface)

        This is the main entry point for the Label Hunter.

        Args:
            track_title: Track title
            artist_name: Optional artist name
            confidence_threshold: Minimum confidence to return result

        Returns:
            Label name if found with sufficient confidence, else None
        """
        releases = await self.search_release(
            track_title=track_title,
            artist_name=artist_name,
            limit=5
        )

        # Filter by confidence and label availability
        high_confidence = [
            r for r in releases
            if r.confidence_score >= confidence_threshold and r.label
        ]

        if not high_confidence:
            logger.debug(
                "No high-confidence label found",
                track=track_title,
                results=len(releases)
            )
            return None

        # Return highest confidence match
        best_match = high_confidence[0]

        logger.info(
            "✅ MusicBrainz label found",
            track=track_title,
            label=best_match.label,
            confidence=best_match.confidence_score
        )

        return best_match.label

    async def health_check(self) -> bool:
        """
        Check if MusicBrainz API is accessible

        Returns:
            True if API is healthy
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.base_url}/recording/?query=test&limit=1",
                    headers=self.headers
                )
                return response.status_code == 200
        except:
            return False


# ============================================================================
# INTEGRATION FUNCTIONS
# ============================================================================

async def create_musicbrainz_client() -> MusicBrainzClient:
    """
    Factory function to create MusicBrainz client

    Returns:
        Initialized MusicBrainzClient
    """
    client = MusicBrainzClient(
        app_name="SongNodes",
        app_version="1.0",
        contact_email="dev@songnodes.local"
    )

    # Verify API access
    if await client.health_check():
        logger.info("✅ MusicBrainz API connected")
        return client
    else:
        logger.warning("⚠️ MusicBrainz API health check failed")
        return client  # Return anyway - might be temporary issue
