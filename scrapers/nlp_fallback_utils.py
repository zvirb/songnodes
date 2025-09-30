"""
NLP Fallback Utilities for SongNodes Scrapers
==============================================

Provides universal fallback mechanisms for all scrapers to handle
website structure changes gracefully using NLP-based extraction.

Multi-Layer Extraction Pipeline:
1. Primary Method - Structured extraction (API/JSON/HTML)
2. Secondary Method - Raw HTML text extraction + NLP
3. Tertiary Method - Basic regex pattern matching

Usage:
    from nlp_fallback_utils import scrape_with_nlp_fallback

    result = await scrape_with_nlp_fallback(
        url="https://example.com/tracklist",
        primary_method=my_structured_scraper,
        method_name="api"
    )
"""
import httpx
import logging
import re
from typing import Dict, Any, List, Optional, Callable
from bs4 import BeautifulSoup
from prometheus_client import Counter

logger = logging.getLogger(__name__)

# NLP processor configuration
NLP_PROCESSOR_URL = "http://nlp-processor:8021"

# Prometheus metrics for tracking extraction methods
extraction_method_used = Counter(
    'scraper_extraction_method_total',
    'Extraction methods used by scrapers',
    ['scraper', 'method', 'success']
)


async def extract_text_from_html(html: str) -> str:
    """
    Extract readable text from HTML, removing navigation, scripts, and styles.

    Args:
        html: Raw HTML content

    Returns:
        Clean text suitable for NLP processing
    """
    try:
        soup = BeautifulSoup(html, 'html.parser')

        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript']):
            element.decompose()

        # Extract text with line breaks
        text = soup.get_text(separator='\n', strip=True)

        # Clean up excessive whitespace
        text = re.sub(r'\n\s*\n', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)

        return text

    except Exception as e:
        logger.error(f"Error extracting text from HTML: {e}")
        return html  # Return raw HTML as fallback


async def extract_via_nlp(
    text: str,
    source_url: Optional[str] = None,
    extract_timestamps: bool = True
) -> List[Dict]:
    """
    Send text to NLP processor for tracklist extraction.

    Args:
        text: Text content to analyze
        source_url: Original source URL for context
        extract_timestamps: Whether to attempt timestamp extraction

    Returns:
        List of extracted tracks with artist/title information
    """
    if not text or len(text.strip()) < 50:
        logger.warning("Text too short for NLP processing")
        return []

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{NLP_PROCESSOR_URL}/extract_tracklist",
                json={
                    "text": text,
                    "source_url": source_url,
                    "extract_timestamps": extract_timestamps
                }
            )
            response.raise_for_status()

            data = response.json()
            tracks = data.get('tracks', [])

            logger.info(f"NLP extracted {len(tracks)} tracks from text ({len(text)} chars)")
            return tracks

    except httpx.HTTPError as e:
        logger.error(f"NLP processor HTTP error: {e}")
        return []
    except Exception as e:
        logger.error(f"NLP processor error: {e}")
        return []


async def basic_regex_extraction(text: str, url: Optional[str] = None) -> List[Dict]:
    """
    Basic regex pattern matching as last resort fallback.

    Tries multiple common tracklist patterns:
    - 00:00 Artist - Track
    - 1. Artist - Track
    - [00:00] Artist - Track
    - Artist - Track (no prefix)

    Args:
        text: Text to search for patterns
        url: Optional URL for context

    Returns:
        List of tracks found via regex patterns
    """
    tracks = []

    # Pattern 1: Timestamped with brackets [00:00] Artist - Track
    pattern1 = re.compile(
        r'\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[–\-−—]\s*([^–\-−—\n]+?)\s*[–\-−—]\s*([^\n]+)',
        re.MULTILINE
    )

    # Pattern 2: Numbered tracks: 1. Artist - Track or 01. Artist - Track
    pattern2 = re.compile(
        r'^\s*(\d+)\.\s*([^–\-−—\n]+?)\s*[–\-−—]\s*([^\n]+)',
        re.MULTILINE
    )

    # Pattern 3: Simple timestamp format: 00:00 Artist - Track
    pattern3 = re.compile(
        r'(\d{1,2}:\d{2}(?::\d{2})?)\s+([^–\-−—\n]+?)\s*[–\-−—]\s*([^\n]+)',
        re.MULTILINE
    )

    # Pattern 4: No prefix, just Artist - Track (must have capital letter)
    pattern4 = re.compile(
        r'(?:^|\n)([A-Z][^–\-−—\n]{2,40}?)\s*[–\-−—]\s*([A-Z][^\n]{2,100})',
        re.MULTILINE
    )

    # Try patterns in order of reliability
    for pattern_name, pattern in [
        ('timestamped_brackets', pattern1),
        ('numbered', pattern2),
        ('timestamped_simple', pattern3)
    ]:
        matches = pattern.findall(text)

        if matches and len(matches) >= 3:  # Require at least 3 matches
            logger.info(f"Found {len(matches)} tracks using pattern: {pattern_name}")

            for idx, match in enumerate(matches):
                if pattern_name in ['timestamped_brackets', 'timestamped_simple']:
                    timestamp, artist, track_title = match
                    tracks.append({
                        'position': idx + 1,
                        'artist_name': artist.strip(),
                        'track_name': track_title.strip(),
                        'start_time': timestamp,
                        'item_type': 'playlist_track',
                        'extraction_method': f'regex_{pattern_name}'
                    })
                elif pattern_name == 'numbered':
                    position, artist, track_title = match
                    tracks.append({
                        'position': int(position),
                        'artist_name': artist.strip(),
                        'track_name': track_title.strip(),
                        'item_type': 'playlist_track',
                        'extraction_method': f'regex_{pattern_name}'
                    })

            return tracks[:50]  # Limit to 50 tracks

    # Try pattern 4 only if others failed
    matches = pattern4.findall(text)
    if matches and len(matches) >= 5:  # Require more matches for this pattern
        logger.info(f"Found {len(matches)} tracks using simple Artist - Track pattern")

        for idx, match in enumerate(matches):
            artist, track_title = match

            # Filter out likely false positives
            if len(artist) < 2 or len(track_title) < 3:
                continue
            if any(x in artist.lower() for x in ['download', 'subscribe', 'follow', 'listen']):
                continue

            tracks.append({
                'position': idx + 1,
                'artist_name': artist.strip(),
                'track_name': track_title.strip(),
                'item_type': 'playlist_track',
                'extraction_method': 'regex_simple'
            })

        return tracks[:50]

    logger.warning("No regex patterns matched")
    return []


async def scrape_with_nlp_fallback(
    url: str,
    primary_method: Callable,
    method_name: str = "primary",
    scraper_name: str = "unknown",
    enable_nlp: bool = True,
    enable_regex: bool = True
) -> Dict[str, Any]:
    """
    Universal fallback wrapper for any scraping method.

    Implements multi-layer extraction pipeline:
    1. Try primary structured method (API/JSON/HTML parsing)
    2. Fall back to NLP extraction if primary fails
    3. Fall back to regex patterns if NLP fails

    Args:
        url: URL to scrape
        primary_method: Async function that takes URL and returns tracks
        method_name: Name of primary method for logging
        scraper_name: Name of scraper for metrics
        enable_nlp: Whether to enable NLP fallback
        enable_regex: Whether to enable regex fallback

    Returns:
        Dict with:
            - tracks: List of extracted tracks
            - method: Method used (primary/nlp/regex)
            - success: Boolean success status
            - confidence: Float 0-1 confidence score
            - error: Optional error message
    """
    result = {
        "tracks": [],
        "method": None,
        "success": False,
        "confidence": 0.0,
        "error": None
    }

    # Try primary method
    try:
        logger.info(f"[{scraper_name}] Attempting primary method: {method_name}")
        tracks = await primary_method(url)

        if tracks and len(tracks) > 0:
            result["tracks"] = tracks
            result["method"] = method_name
            result["success"] = True
            result["confidence"] = 1.0

            # Record metrics
            extraction_method_used.labels(
                scraper=scraper_name,
                method=method_name,
                success='true'
            ).inc()

            logger.info(f"[{scraper_name}] Primary method succeeded: {len(tracks)} tracks")
            return result

    except Exception as e:
        logger.warning(f"[{scraper_name}] Primary method '{method_name}' failed: {e}")
        result["error"] = str(e)

        # Record failure
        extraction_method_used.labels(
            scraper=scraper_name,
            method=method_name,
            success='false'
        ).inc()

    # Try NLP fallback if enabled
    if enable_nlp:
        try:
            logger.info(f"[{scraper_name}] Attempting NLP fallback for {url}")

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()

                # Extract clean text from HTML
                text = await extract_text_from_html(response.text)

                # Send to NLP processor
                tracks = await extract_via_nlp(text, url)

                if tracks and len(tracks) > 0:
                    result["tracks"] = tracks
                    result["method"] = "nlp"
                    result["success"] = True
                    result["confidence"] = 0.7
                    result["error"] = None

                    # Record metrics
                    extraction_method_used.labels(
                        scraper=scraper_name,
                        method='nlp',
                        success='true'
                    ).inc()

                    logger.info(f"[{scraper_name}] NLP fallback succeeded: {len(tracks)} tracks")
                    return result

        except Exception as e:
            logger.warning(f"[{scraper_name}] NLP fallback failed: {e}")

            # Record failure
            extraction_method_used.labels(
                scraper=scraper_name,
                method='nlp',
                success='false'
            ).inc()

    # Try regex fallback if enabled
    if enable_regex:
        try:
            logger.info(f"[{scraper_name}] Attempting regex fallback for {url}")

            # Fetch page if not already fetched
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()
                text = response.text

            tracks = await basic_regex_extraction(text, url)

            if tracks and len(tracks) > 0:
                result["tracks"] = tracks
                result["method"] = "regex"
                result["success"] = True
                result["confidence"] = 0.5
                result["error"] = None

                # Record metrics
                extraction_method_used.labels(
                    scraper=scraper_name,
                    method='regex',
                    success='true'
                ).inc()

                logger.info(f"[{scraper_name}] Regex fallback succeeded: {len(tracks)} tracks")
                return result

        except Exception as e:
            logger.error(f"[{scraper_name}] Regex fallback failed: {e}")

            # Record failure
            extraction_method_used.labels(
                scraper=scraper_name,
                method='regex',
                success='false'
            ).inc()

    # All methods failed
    logger.error(f"[{scraper_name}] All extraction methods failed for {url}")
    result["error"] = result["error"] or "All extraction methods failed"
    return result


async def enhance_tracks_with_metadata(
    tracks: List[Dict],
    source_platform: str,
    source_url: str
) -> List[Dict]:
    """
    Enhance extracted tracks with source metadata.

    Args:
        tracks: List of track dictionaries
        source_platform: Platform name (e.g., 'soundcloud', 'youtube')
        source_url: Original source URL

    Returns:
        Enhanced track list with metadata
    """
    for track in tracks:
        # Add source information
        track.setdefault('source', source_platform)
        track.setdefault('source_url', source_url)

        # Ensure required fields exist
        track.setdefault('item_type', 'playlist_track')
        track.setdefault('position', tracks.index(track) + 1)

        # Clean up artist and track names
        if 'artist_name' in track:
            track['artist_name'] = track['artist_name'].strip()
        if 'track_name' in track:
            track['track_name'] = track['track_name'].strip()

    return tracks


def get_extraction_confidence_level(method: str) -> float:
    """
    Get confidence score for extraction method.

    Args:
        method: Extraction method name

    Returns:
        Confidence score between 0 and 1
    """
    confidence_map = {
        'api': 1.0,
        'json': 0.95,
        'structured_html': 0.9,
        'nlp': 0.7,
        'regex': 0.5,
        'manual': 1.0
    }

    return confidence_map.get(method, 0.5)
