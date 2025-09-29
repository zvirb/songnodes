"""
FastAPI wrapper for 1001tracklists scraper
Now uses API-based data collection instead of web scraping
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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="1001Tracklists Scraper", version="2.0.0")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "1001tracklists"}

@app.post("/scrape")
async def scrape_url(request: Dict[str, Any]):
    """
    Execute API-based data collection or process URL directly
    """
    task_id = request.get("task_id") or f"1001_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    url = request.get("url")

    try:
        logger.info(f"Starting data collection for task {task_id}")

        # Create API client
        client = OneThousandOneTracklistsAPIClient()

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

        # Process data through API
        items_processed = 0
        for query in queries:
            logger.info(f"Processing query: {query}")
            tracklists = client.search_tracklists(query, limit=3)

            for tracklist in tracklists:
                details = client.get_tracklist_details(tracklist['id'])
                if details and 'tracks' in details:
                    items_processed += len(details['tracks'])

        # Store results in database
        await client.process_tracklists_to_db(queries)

        # Close the client if it has a close method
        if hasattr(client.pipeline, 'close'):
            await client.pipeline.close()

        return {
            "status": "success",
            "task_id": task_id,
            "url": url,
            "mode": "api",
            "items_processed": items_processed,
            "queries_processed": len(queries),
            "message": f"API data collection completed. Processed {items_processed} tracks from {len(queries)} queries"
        }

    except Exception as e:
        logger.error(f"Error in API data collection: {str(e)}")
        return {
            "status": "error",
            "task_id": task_id,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)