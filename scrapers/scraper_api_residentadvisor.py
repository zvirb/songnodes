# DEPRECATED: This file uses the removed database_pipeline. Use modern pipelines instead.
"""
FastAPI wrapper for Resident Advisor scraper
Extracts __NEXT_DATA__ JSON from Next.js pages for contextual metadata
Includes comprehensive NLP fallback for structure changes

⚠️  WARNING: This file imports the deprecated database_pipeline.DatabasePipeline
    which has been replaced by pipelines.persistence_pipeline.PersistencePipeline.
    This scraper may require refactoring to use the modern pipeline architecture.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import asyncio
import json
import os
import logging
import re
from typing import Dict, Any, Optional, List
from datetime import datetime
from bs4 import BeautifulSoup
from prometheus_client import Counter

from database_pipeline import DatabasePipeline
from nlp_fallback_utils import extract_text_from_html, extract_via_nlp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Resident Advisor Scraper", version="1.0.0")

# Configuration
ENABLE_NLP_FALLBACK = os.getenv('ENABLE_NLP_FALLBACK', 'true').lower() == 'true'

# Prometheus metrics for tracking extraction methods
extraction_method_counter = Counter(
    'ra_extraction_method_total',
    'RA extraction methods used',
    ['method', 'success']
)

class ScrapeRequest(BaseModel):
    url: Optional[str] = None
    params: Optional[Dict[str, Any]] = {}
    task_id: Optional[str] = None
    target_track: Optional[Dict[str, Any]] = None

# Rate limiting configuration
RATE_LIMIT_DELAY = 2.0  # Conservative delay

# Database configuration
DATABASE_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'postgres'),
    'port': int(os.getenv('POSTGRES_PORT', '5432')),
    'database': os.getenv('POSTGRES_DB', 'musicdb'),
    'user': os.getenv('POSTGRES_USER', 'musicdb_user'),
    'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass')
}

def extract_next_data(html: str) -> Optional[Dict]:
    """Extract embedded __NEXT_DATA__ JSON from Next.js page"""
    try:
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
        if match:
            json_str = match.group(1)
            return json.loads(json_str)
    except Exception as e:
        logger.error(f"Error extracting __NEXT_DATA__: {e}")
    return None


def extract_lineup_section(text: str) -> Optional[str]:
    """
    Extract lineup-specific text from page content.

    Looks for common lineup section markers and returns the relevant text.

    Args:
        text: Full page text content

    Returns:
        Extracted lineup section or None
    """
    # Common lineup section patterns
    patterns = [
        r'lineup[:\s]+(.*?)(?:tickets|venue|location|date)',
        r'artists[:\s]+(.*?)(?:event|date|time|venue)',
        r'featuring[:\s]+(.*?)(?:\n\n|\Z)',
        r'line[\-\s]?up[:\s]+(.*?)(?:event details|information)',
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            extracted = match.group(1).strip()
            if len(extracted) > 20:  # Ensure meaningful content
                logger.info(f"Extracted lineup section ({len(extracted)} chars)")
                return extracted

    return None


def extract_artists_regex(html: str) -> List[str]:
    """
    Fallback regex extraction for artist names from HTML.

    Uses multiple heuristics:
    1. Links with /dj/ or /artist/ paths
    2. Capitalized names in lineup sections
    3. Common HTML patterns for artist lists

    Args:
        html: Raw HTML content

    Returns:
        List of extracted artist names
    """
    soup = BeautifulSoup(html, 'html.parser')
    artists = set()

    # Method 1: Extract from artist/dj links
    artist_links = soup.find_all('a', href=re.compile(r'/dj/|/artist/|/artists/'))
    for link in artist_links:
        name = link.get_text(strip=True)
        if name and len(name) > 2 and len(name) < 50:
            artists.add(name)

    # Method 2: Look for lineup/artist sections
    lineup_sections = soup.find_all(
        ['div', 'section', 'ul', 'ol'],
        class_=re.compile(r'lineup|artist|roster|performer', re.IGNORECASE)
    )

    for section in lineup_sections:
        # Extract from list items
        items = section.find_all(['li', 'a', 'span', 'div'])
        for item in items:
            text = item.get_text(strip=True)

            # Filter artist names (2-50 chars, starts with capital)
            if text and 2 < len(text) < 50:
                if re.match(r'^[A-Z]', text):
                    # Remove common noise words
                    if not any(noise in text.lower() for noise in [
                        'lineup', 'featuring', 'tickets', 'event', 'date',
                        'venue', 'time', 'buy', 'more info', 'read more'
                    ]):
                        artists.add(text)

    # Method 3: Find structured data (JSON-LD)
    json_ld_scripts = soup.find_all('script', type='application/ld+json')
    for script in json_ld_scripts:
        try:
            data = json.loads(script.string)

            # Look for performers in event schema
            if isinstance(data, dict):
                performers = data.get('performer', [])
                if not isinstance(performers, list):
                    performers = [performers]

                for performer in performers:
                    if isinstance(performer, dict):
                        name = performer.get('name')
                        if name:
                            artists.add(name)
                    elif isinstance(performer, str):
                        artists.add(performer)

        except (json.JSONDecodeError, TypeError) as e:
            logger.debug(f"Could not parse JSON-LD: {e}")
            continue

    # Convert to sorted list, limit to reasonable count
    artist_list = sorted(list(artists))[:30]

    if artist_list:
        logger.info(f"Regex extraction found {len(artist_list)} artists")

    return artist_list

async def scrape_ra_event(url: str) -> Dict[str, Any]:
    """
    Scrape a Resident Advisor event page with comprehensive NLP fallback.

    Extraction pipeline:
    1. PRIMARY: __NEXT_DATA__ JSON extraction
    2. SECONDARY: NLP-based artist/track extraction
    3. TERTIARY: Regex pattern matching
    4. QUATERNARY: HTML parsing fallback

    Args:
        url: Resident Advisor event URL

    Returns:
        Event data with lineup and extraction metadata
    """
    extraction_method = "unknown"
    confidence = 0.0

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        headers = {
            'User-Agent': 'SongNodes/1.0 (+https://github.com/songnodes)'
        }

        response = await client.get(url, headers=headers)
        response.raise_for_status()

        html = response.text

        event_data = {
            'name': '',
            'venue': '',
            'lineup': [],
            'event_date': None,
            'source_url': url,
            'platform': 'resident_advisor',
            'extraction_method': extraction_method,
            'confidence': confidence
        }

        # PRIMARY: Try __NEXT_DATA__ JSON extraction
        try:
            next_data = extract_next_data(html)

            if next_data:
                # Navigate __NEXT_DATA__ structure
                props = next_data.get('props', {})
                page_props = props.get('pageProps', {})

                # Event data is typically in pageProps
                event = page_props.get('event', {})

                event_data['name'] = event.get('title', '')
                event_data['venue'] = event.get('venue', {}).get('name', '')

                # Extract lineup
                lineup = event.get('lineup', [])
                for artist in lineup:
                    if isinstance(artist, dict):
                        event_data['lineup'].append(artist.get('name', ''))
                    elif isinstance(artist, str):
                        event_data['lineup'].append(artist)

                # Extract date
                date_str = event.get('date', '') or event.get('startTime', '')
                if date_str:
                    try:
                        event_data['event_date'] = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    except Exception as e:
                        logger.warning(f"Could not parse date: {e}")

                # Success if we got artists
                if event_data['lineup']:
                    extraction_method = "json"
                    confidence = 0.95
                    event_data['extraction_method'] = extraction_method
                    event_data['confidence'] = confidence

                    # Record success metrics
                    extraction_method_counter.labels(
                        method='json',
                        success='true'
                    ).inc()

                    logger.info(f"JSON extraction succeeded: {len(event_data['lineup'])} artists")
                    return event_data

        except Exception as e:
            logger.warning(f"JSON extraction failed: {e}")
            extraction_method_counter.labels(method='json', success='false').inc()

        # SECONDARY: Try NLP fallback
        if ENABLE_NLP_FALLBACK:
            try:
                logger.info("Attempting NLP fallback for Resident Advisor")

                # Extract clean text from HTML
                text = await extract_text_from_html(html)

                # Try to extract lineup-specific section
                lineup_text = extract_lineup_section(text)

                # Use NLP to extract artists/tracks
                tracks = await extract_via_nlp(lineup_text or text, url)

                if tracks and len(tracks) > 0:
                    # Extract unique artists from tracks
                    artists = list(set([t.get('artist_name', t.get('artist', '')) for t in tracks]))
                    artists = [a for a in artists if a]  # Filter empty strings

                    if artists:
                        extraction_method = "nlp"
                        confidence = 0.7
                        event_data['lineup'] = artists
                        event_data['tracks'] = tracks
                        event_data['extraction_method'] = extraction_method
                        event_data['confidence'] = confidence

                        # Record success metrics
                        extraction_method_counter.labels(
                            method='nlp',
                            success='true'
                        ).inc()

                        logger.info(f"NLP extraction succeeded: {len(artists)} artists")

                        # Continue to get event name if missing
                        if not event_data['name']:
                            soup = BeautifulSoup(html, 'html.parser')
                            title_elem = soup.find('h1') or soup.find('meta', property='og:title')
                            if title_elem:
                                event_data['name'] = (
                                    title_elem.get('content')
                                    if title_elem.name == 'meta'
                                    else title_elem.get_text(strip=True)
                                )

                        return event_data

            except Exception as e:
                logger.warning(f"NLP fallback failed: {e}")
                extraction_method_counter.labels(method='nlp', success='false').inc()

        # TERTIARY: Try regex pattern extraction
        try:
            logger.info("Attempting regex fallback for Resident Advisor")

            artists = extract_artists_regex(html)

            if artists and len(artists) > 0:
                extraction_method = "regex"
                confidence = 0.5
                event_data['lineup'] = artists
                event_data['extraction_method'] = extraction_method
                event_data['confidence'] = confidence

                # Record success metrics
                extraction_method_counter.labels(
                    method='regex',
                    success='true'
                ).inc()

                logger.info(f"Regex extraction succeeded: {len(artists)} artists")

                # Get event name if missing
                if not event_data['name']:
                    soup = BeautifulSoup(html, 'html.parser')
                    title_elem = soup.find('h1') or soup.find('meta', property='og:title')
                    if title_elem:
                        event_data['name'] = (
                            title_elem.get('content')
                            if title_elem.name == 'meta'
                            else title_elem.get_text(strip=True)
                        )

                return event_data

        except Exception as e:
            logger.warning(f"Regex fallback failed: {e}")
            extraction_method_counter.labels(method='regex', success='false').inc()

        # QUATERNARY: HTML parsing fallback for event metadata only
        soup = BeautifulSoup(html, 'html.parser')
        title_elem = soup.find('h1') or soup.find('meta', property='og:title')
        if title_elem:
            event_data['name'] = (
                title_elem.get('content')
                if title_elem.name == 'meta'
                else title_elem.get_text(strip=True)
            )

        # All extraction methods failed
        extraction_method = "failed"
        confidence = 0.0
        event_data['extraction_method'] = extraction_method
        event_data['confidence'] = confidence

        extraction_method_counter.labels(method='all', success='false').inc()
        logger.error(f"All extraction methods failed for {url}")

        return event_data

async def scrape_ra_artist(url: str) -> Dict[str, Any]:
    """Scrape Resident Advisor artist page"""
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        headers = {
            'User-Agent': 'SongNodes/1.0 (+https://github.com/songnodes)'
        }

        response = await client.get(url, headers=headers)
        response.raise_for_status()

        html = response.text
        next_data = extract_next_data(html)

        artist_data = {
            'name': '',
            'bio': '',
            'genres': [],
            'country': '',
            'source_url': url,
            'platform': 'resident_advisor'
        }

        if next_data:
            props = next_data.get('props', {})
            page_props = props.get('pageProps', {})
            artist = page_props.get('artist', {})

            artist_data['name'] = artist.get('name', '')
            artist_data['bio'] = artist.get('bio', '')
            artist_data['country'] = artist.get('country', {}).get('name', '')

            # Extract genres/styles
            genres = artist.get('genres', []) or artist.get('styles', [])
            if genres:
                artist_data['genres'] = [g if isinstance(g, str) else g.get('name', '') for g in genres]

        return artist_data

async def save_event_to_database(event_data: Dict[str, Any], spider_context: Any = None):
    """Save RA event data as a playlist with artist context"""
    db_pipeline = DatabasePipeline(DATABASE_CONFIG)

    try:
        await db_pipeline.open_spider(spider_context)

        # Create playlist item for the event
        playlist_item = {
            'item_type': 'playlist',
            'name': f"{event_data['name']} @ {event_data.get('venue', '')}",
            'source_url': event_data['source_url'],
            'platform': event_data['platform'],
            'playlist_date': event_data.get('event_date'),
            'playlist_type': 'event'
        }

        await db_pipeline.process_item(playlist_item, spider_context)

        # Create artist items for lineup
        for artist_name in event_data.get('lineup', []):
            if artist_name:
                artist_item = {
                    'item_type': 'artist',
                    'artist_name': artist_name
                }
                await db_pipeline.process_item(artist_item, spider_context)

        await db_pipeline.flush_all_batches()

        logger.info(f"Successfully saved event '{event_data['name']}' to database")

    finally:
        await db_pipeline.close_spider(spider_context)

async def save_artist_to_database(artist_data: Dict[str, Any], spider_context: Any = None):
    """Save RA artist data"""
    db_pipeline = DatabasePipeline(DATABASE_CONFIG)

    try:
        await db_pipeline.open_spider(spider_context)

        artist_item = {
            'item_type': 'artist',
            'artist_name': artist_data['name'],
            'genre': artist_data['genres'][0] if artist_data['genres'] else None,
            'country': artist_data.get('country')
        }

        await db_pipeline.process_item(artist_item, spider_context)
        await db_pipeline.flush_all_batches()

        logger.info(f"Successfully saved artist '{artist_data['name']}' to database")

    finally:
        await db_pipeline.close_spider(spider_context)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "resident_advisor"}

@app.post("/scrape")
async def scrape_url(request: ScrapeRequest):
    """Execute scraping task for Resident Advisor page"""
    task_id = request.task_id or f"ra_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required for Resident Advisor scraper")

    if 'residentadvisor.net' not in request.url and 'ra.co' not in request.url:
        raise HTTPException(status_code=400, detail="URL must be a Resident Advisor URL")

    try:
        # Rate limiting delay
        await asyncio.sleep(RATE_LIMIT_DELAY)

        # Determine page type from URL
        if '/events/' in request.url:
            # Event page
            event_data = await scrape_ra_event(request.url)
            await save_event_to_database(event_data)

            lineup_count = len(event_data.get('lineup', []))
            extraction_method = event_data.get('extraction_method', 'unknown')
            confidence = event_data.get('confidence', 0.0)

            return {
                "status": "success",
                "task_id": task_id,
                "url": request.url,
                "type": "event",
                "event_name": event_data['name'],
                "lineup_count": lineup_count,
                "lineup": event_data.get('lineup', []),
                "extraction_method": extraction_method,
                "confidence": confidence,
                "tracks": event_data.get('tracks', []),
                "message": f"Extracted {lineup_count} artists via {extraction_method} method (confidence: {confidence:.2f})"
            }

        elif '/dj/' in request.url or '/artists/' in request.url:
            # Artist page
            artist_data = await scrape_ra_artist(request.url)
            await save_artist_to_database(artist_data)

            return {
                "status": "success",
                "task_id": task_id,
                "url": request.url,
                "type": "artist",
                "artist_name": artist_data['name'],
                "message": f"Successfully scraped artist metadata"
            }

        else:
            raise HTTPException(status_code=400, detail="URL type not supported (only events and artists)")

    except httpx.HTTPError as e:
        logger.error(f"HTTP error scraping {request.url}: {e}")
        return {
            "status": "error",
            "task_id": task_id,
            "error": f"HTTP error: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Error scraping {request.url}: {e}")
        return {
            "status": "error",
            "task_id": task_id,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8023)