# ============================================================================
# LEGACY FILE - NOT USED IN PRODUCTION
# ============================================================================
# This file is part of the legacy scraper_api_* family which is NOT used in
# docker-compose.yml. These files have been superseded by modern Scrapy-based
# spiders in the spiders/ directory.
#
# Retained for historical reference and potential future migration.
# See: /mnt/my_external_drive/programming/songnodes/scrapers/LEGACY_SCRAPERS_README.md
# ============================================================================
"""
FastAPI wrapper for 1001tracklists scraper
Now uses API-based data collection with NLP fallback for resilience

LEGACY: This file is not actively used. See Scrapy spiders in spiders/ directory.
"""
from fastapi import FastAPI, HTTPException
import asyncio
import json
import os
import logging
import sys
from typing import Dict, Any
from datetime import datetime

# Add current directory to path for imports
sys.path.append('/app')
from onethousandone_api_client import OneThousandOneTracklistsAPIClient
from nlp_fallback_utils import scrape_with_nlp_fallback, extract_via_nlp, extract_text_from_html

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment configuration
ENABLE_NLP_FALLBACK = os.getenv('ENABLE_NLP_FALLBACK', 'true').lower() == 'true'
NLP_PROCESSOR_URL = os.getenv('NLP_PROCESSOR_URL', 'http://nlp-processor:8021')

app = FastAPI(title="1001Tracklists Scraper", version="2.0.0")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "1001tracklists"}

async def scrape_1001_with_html_nlp(url: str) -> list:
    """
    Fallback method: Scrape 1001tracklists via HTML + NLP when API fails
    """
    import httpx

    logger.info(f"Using HTML+NLP fallback for {url}")

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        response = await client.get(url, headers=headers)
        response.raise_for_status()

        # Extract clean text from HTML
        text = await extract_text_from_html(response.text)

        # Use NLP to extract tracklist
        tracks = await extract_via_nlp(text, url)

        logger.info(f"HTML+NLP extracted {len(tracks)} tracks")
        return tracks


@app.post("/scrape")
async def scrape_url(request: Dict[str, Any]):
    """
    Execute API-based data collection with NLP fallback for resilience
    """
    task_id = request.get("task_id") or f"1001_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    url = request.get("url")
    extraction_method = "unknown"
    items_processed = 0

    try:
        logger.info(f"Starting data collection for task {task_id}")

        # Extract query from URL if provided
        queries = []
        if url:
            logger.info(f"Processing URL: {url}")
            # Extract search query from 1001tracklists URL
            # URL format could be: https://www.1001tracklists.com/search/?q=Artist+Track
            # or just a search query
            if "1001tracklists.com" in url:
                # Extract query parameter
                from urllib.parse import urlparse, parse_qs
                parsed = urlparse(url)
                query_params = parse_qs(parsed.query)
                if 'q' in query_params:
                    queries = [query_params['q'][0]]
                else:
                    # Try to extract from path or use the full URL as query
                    path_parts = parsed.path.strip('/').split('/')
                    if path_parts:
                        queries = [path_parts[-1].replace('-', ' ')]
            else:
                # Treat the URL as a direct search query
                queries = [url]

        # Fallback to default queries only if no URL provided
        if not queries:
            logger.warning("No URL provided, using default DJ queries for testing")
            queries = [
                "Carl Cox", "Charlotte de Witte", "Amelie Lens",
                "Tale of Us", "Solomun"
            ]

        logger.info(f"Processing {len(queries)} queries: {queries}")

        # Try API method first (primary)
        try:
            logger.info("Attempting primary method: 1001tracklists API")
            client = OneThousandOneTracklistsAPIClient()

            # Process data through API
            for query in queries:
                logger.info(f"Processing query: {query}")
                tracklists = client.search_tracklists(query, limit=3)

                for tracklist in tracklists:
                    details = client.get_tracklist_details(tracklist['id'])
                    if details and 'tracks' in details:
                        items_processed += len(details['tracks'])

            if items_processed > 0:
                # Store results in database
                await client.process_tracklists_to_db(queries)

                # Close the client if it has a close method
                if hasattr(client.pipeline, 'close'):
                    await client.pipeline.close()

                extraction_method = "api"
                logger.info(f"API method succeeded: {items_processed} tracks")

                return {
                    "status": "success",
                    "task_id": task_id,
                    "url": url,
                    "mode": "api",
                    "extraction_method": extraction_method,
                    "items_processed": items_processed,
                    "queries_processed": len(queries),
                    "message": f"API data collection completed. Processed {items_processed} tracks from {len(queries)} queries"
                }

        except Exception as e:
            logger.warning(f"API method failed: {e}")

        # Try NLP fallback if API failed and URL is provided
        if url and "1001tracklists.com" in url and ENABLE_NLP_FALLBACK:
            try:
                logger.info("Attempting NLP fallback method")
                tracks = await scrape_1001_with_html_nlp(url)

                if tracks and len(tracks) > 0:
                    extraction_method = "nlp"
                    items_processed = len(tracks)

                    # Store in database (would need to adapt client to handle this)
                    logger.info(f"NLP fallback succeeded: {items_processed} tracks")

                    return {
                        "status": "success",
                        "task_id": task_id,
                        "url": url,
                        "mode": "html_nlp",
                        "extraction_method": extraction_method,
                        "items_processed": items_processed,
                        "message": f"NLP fallback completed. Processed {items_processed} tracks"
                    }

            except Exception as e:
                logger.error(f"NLP fallback failed: {e}")

        # If everything failed
        raise Exception("All extraction methods failed")

    except Exception as e:
        logger.error(f"Error in data collection: {str(e)}")
        return {
            "status": "error",
            "task_id": task_id,
            "url": url,
            "extraction_method": extraction_method,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)