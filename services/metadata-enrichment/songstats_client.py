"""
🎵 Songstats API Client - Commercial Data Aggregation for Music Intelligence

Songstats is a commercial music analytics platform that aggregates data from
multiple sources including 1001Tracklists, Spotify, Apple Music, and charts.

Key Features:
- Structured access to 1001Tracklists "DJ Support" data
- ISRC-based track lookup
- Chart and playlist tracking
- Legal, ToS-compliant data access

Strategic Value:
This client solves the critical data acquisition challenge for the probabilistic
matcher (Tier 2). Instead of building fragile, legally questionable scrapers for
1001Tracklists, we leverage a commercial API that provides clean, structured,
and validated data.

API Documentation: https://api.songstats.com/docs
Pricing: Contact Songstats for commercial licensing
"""

import asyncio
import structlog
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

import httpx

logger = structlog.get_logger(__name__)


@dataclass
class DJSupport:
    """A single instance of a track being played by a DJ"""
    dj_name: str
    set_name: str
    set_date: Optional[datetime]
    venue: Optional[str]
    event: Optional[str]
    position_in_set: int
    total_tracks: int
    source: str = "1001tracklists"


@dataclass
class TrackContext:
    """Complete context for a track from Songstats"""
    track_title: str
    artist_name: Optional[str]
    isrc: Optional[str]
    label: Optional[str]

    # DJ Support data
    dj_supports: List[DJSupport]
    total_dj_plays: int

    # Chart data
    chart_entries: List[Dict[str, Any]]

    # Playlist data
    playlist_adds: List[Dict[str, Any]]


class SongstatsClient:
    """
    Async client for Songstats API

    Provides access to 1001Tracklists DJ support data and other
    music intelligence in a legal, structured, and reliable way.

    This is the PRIMARY data source for the probabilistic matcher
    in Tier 2 enrichment.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.songstats.com/v1",
        timeout: float = 30.0,
        max_retries: int = 3
    ):
        """
        Initialize Songstats API client

        Args:
            api_key: Songstats API key (commercial license required)
            base_url: API base URL (default production endpoint)
            timeout: Request timeout in seconds
            max_retries: Maximum retry attempts for failed requests
        """
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries

        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Accept': 'application/json',
            'User-Agent': 'SongNodes-Enrichment/1.0'
        }

    async def get_track_by_isrc(
        self,
        isrc: str
    ) -> Optional[TrackContext]:
        """
        Retrieve track context by ISRC

        Args:
            isrc: International Standard Recording Code

        Returns:
            TrackContext with DJ supports and other data, or None if not found
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/track/{isrc}",
                    headers=self.headers
                )

                if response.status_code == 404:
                    logger.debug("Track not found in Songstats", isrc=isrc)
                    return None

                response.raise_for_status()
                data = response.json()

                # Parse DJ supports from 1001Tracklists
                dj_supports = self._parse_dj_supports(data.get('dj_supports', []))

                context = TrackContext(
                    track_title=data.get('title', ''),
                    artist_name=data.get('artist', {}).get('name'),
                    isrc=isrc,
                    label=data.get('label'),
                    dj_supports=dj_supports,
                    total_dj_plays=len(dj_supports),
                    chart_entries=data.get('charts', []),
                    playlist_adds=data.get('playlists', [])
                )

                logger.info(
                    "Retrieved track context from Songstats",
                    isrc=isrc,
                    dj_plays=context.total_dj_plays
                )

                return context

        except httpx.HTTPStatusError as e:
            logger.error(
                "Songstats API error",
                status=e.response.status_code,
                error=str(e)
            )
            return None
        except Exception as e:
            logger.error("Songstats request failed", error=str(e))
            return None

    async def search_track(
        self,
        track_title: str,
        artist_name: Optional[str] = None,
        label: Optional[str] = None
    ) -> Optional[TrackContext]:
        """
        Search for track by title, artist, and/or label

        Args:
            track_title: Track title to search for
            artist_name: Optional artist name to narrow search
            label: Optional label name to narrow search

        Returns:
            TrackContext for best match, or None if not found
        """
        try:
            # Build search query
            params = {'q': track_title}
            if artist_name:
                params['artist'] = artist_name
            if label:
                params['label'] = label

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/search/tracks",
                    headers=self.headers,
                    params=params
                )

                if response.status_code == 404:
                    logger.debug("No search results", query=track_title)
                    return None

                response.raise_for_status()
                data = response.json()

                # Get first result (best match)
                results = data.get('items', [])
                if not results:
                    return None

                best_match = results[0]

                # Get full details including DJ supports
                if 'isrc' in best_match:
                    return await self.get_track_by_isrc(best_match['isrc'])

                # Fallback: construct context from search result
                dj_supports = self._parse_dj_supports(
                    best_match.get('dj_supports', [])
                )

                context = TrackContext(
                    track_title=best_match.get('title', track_title),
                    artist_name=best_match.get('artist', {}).get('name'),
                    isrc=best_match.get('isrc'),
                    label=best_match.get('label'),
                    dj_supports=dj_supports,
                    total_dj_plays=len(dj_supports),
                    chart_entries=best_match.get('charts', []),
                    playlist_adds=best_match.get('playlists', [])
                )

                logger.info(
                    "Found track via search",
                    query=track_title,
                    dj_plays=context.total_dj_plays
                )

                return context

        except Exception as e:
            logger.error("Songstats search failed", error=str(e))
            return None

    async def get_dj_supports_for_track(
        self,
        track_title: str,
        artist_name: Optional[str] = None,
        label: Optional[str] = None,
        min_supports: int = 2
    ) -> List[DJSupport]:
        """
        Get DJ support history for a track

        This is the PRIMARY method for the probabilistic matcher.
        Returns all instances where DJs have played this track.

        Args:
            track_title: Track title
            artist_name: Optional artist filter
            label: Optional label filter
            min_supports: Minimum DJ plays to return results

        Returns:
            List of DJSupport instances, or empty list if insufficient data
        """
        context = await self.search_track(track_title, artist_name, label)

        if not context:
            return []

        if context.total_dj_plays < min_supports:
            logger.debug(
                "Insufficient DJ supports",
                track=track_title,
                plays=context.total_dj_plays,
                required=min_supports
            )
            return []

        return context.dj_supports

    def _parse_dj_supports(
        self,
        raw_supports: List[Dict[str, Any]]
    ) -> List[DJSupport]:
        """
        Parse DJ support data from API response

        Args:
            raw_supports: Raw DJ support data from Songstats

        Returns:
            List of parsed DJSupport objects
        """
        supports = []

        for item in raw_supports:
            try:
                # Parse date if available
                set_date = None
                if item.get('date'):
                    from dateutil import parser
                    try:
                        set_date = parser.parse(item['date'])
                    except:
                        pass

                support = DJSupport(
                    dj_name=item.get('dj', {}).get('name', 'Unknown'),
                    set_name=item.get('set_name', ''),
                    set_date=set_date,
                    venue=item.get('venue'),
                    event=item.get('event'),
                    position_in_set=item.get('position', 0),
                    total_tracks=item.get('total_tracks', 0),
                    source=item.get('source', '1001tracklists')
                )

                supports.append(support)

            except Exception as e:
                logger.warning("Failed to parse DJ support", error=str(e))
                continue

        return supports

    async def get_surrounding_tracks(
        self,
        dj_support: DJSupport,
        context_window: int = 2
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get tracks played before and after a specific DJ support instance

        This is CRITICAL for co-occurrence analysis. We need to know what
        tracks appeared near the target track in the setlist.

        Args:
            dj_support: The DJ support instance
            context_window: How many tracks before/after to retrieve

        Returns:
            Dict with 'before' and 'after' track lists
        """
        # This would require additional Songstats API endpoints
        # for retrieving full setlist data

        # Placeholder for implementation
        logger.warning(
            "get_surrounding_tracks not fully implemented - requires extended API"
        )

        return {
            'before': [],
            'after': []
        }

    async def health_check(self) -> bool:
        """
        Check if Songstats API is accessible and API key is valid

        Returns:
            True if API is healthy and accessible
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.base_url}/health",
                    headers=self.headers
                )
                return response.status_code == 200
        except:
            return False


# ============================================================================
# FACTORY FUNCTION
# ============================================================================

async def create_songstats_client(
    api_key: Optional[str] = None
) -> Optional[SongstatsClient]:
    """
    Factory function to create Songstats client

    Args:
        api_key: Songstats API key (if None, tries to load from secrets)

    Returns:
        SongstatsClient instance if API key available, else None
    """
    if not api_key:
        try:
            from common.secrets_manager import get_secret
            api_key = get_secret('SONGSTATS_API_KEY')
        except:
            logger.warning(
                "Songstats API key not available - probabilistic matcher "
                "will have limited functionality"
            )
            return None

    if not api_key:
        return None

    client = SongstatsClient(api_key=api_key)

    # Verify API access
    if await client.health_check():
        logger.info("✅ Songstats API connected")
        return client
    else:
        logger.error("❌ Songstats API health check failed")
        return None


# ============================================================================
# INTEGRATION WITH CO-OCCURRENCE ANALYZER
# ============================================================================

async def get_track_context_for_matcher(
    songstats_client: SongstatsClient,
    track_title: str,
    artist_name: Optional[str] = None,
    label: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Get track context formatted for the co-occurrence analyzer

    This is the integration point between Songstats and the
    probabilistic matching logic.

    Args:
        songstats_client: Initialized Songstats client
        track_title: Track to analyze
        artist_name: Optional artist hint
        label: Optional label hint

    Returns:
        Dict formatted for CoOccurrenceAnalyzer, or None
    """
    # Get DJ supports
    dj_supports = await songstats_client.get_dj_supports_for_track(
        track_title=track_title,
        artist_name=artist_name,
        label=label,
        min_supports=2  # Require at least 2 DJ plays
    )

    if not dj_supports:
        return None

    # Format for co-occurrence analyzer
    contexts = []

    for support in dj_supports:
        # Get surrounding tracks (if available)
        surrounding = await songstats_client.get_surrounding_tracks(support)

        context = {
            'dj_name': support.dj_name,
            'set_name': support.set_name,
            'set_date': support.set_date,
            'position_in_set': support.position_in_set,
            'total_tracks': support.total_tracks,
            'tracks_before': surrounding.get('before', []),
            'tracks_after': surrounding.get('after', [])
        }

        contexts.append(context)

    return {
        'track_title': track_title,
        'contexts': contexts,
        'total_dj_plays': len(dj_supports),
        'data_source': 'songstats'
    }
