"""
FastAPI wrapper for REAL 1001tracklists scraper
Uses actual web scraping instead of mock data
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
# Import the simple database pipeline
sys.path.append('/app')
from real_data_scraper import RealDataScraper

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="1001Tracklists Real Scraper", version="1.0.0")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "1001tracklists-real", "mode": "web_scraping"}

@app.post("/scrape")
async def scrape_url(request: Dict[str, Any]):
    """
    Execute REAL web scraping for actual music data
    """
    task_id = request.get("task_id") or f"real_1001_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    url = request.get("url")
    target_track = request.get("target_track", {})

    try:
        logger.info(f"Starting REAL web scraping for task {task_id}")
        if url:
            logger.info(f"Scraping URL: {url}")
        if target_track:
            logger.info(f"Target track: {target_track.get('title')} by {target_track.get('primary_artist')}")

        # Create real scraper instance
        scraper = RealDataScraper()

        # Extract search query from URL if provided
        track_name = None
        if url:
            # Extract search query from 1001tracklists URL
            # URL formats:
            # - https://www.1001tracklists.com/search?q=Artist+Track
            # - https://www.1001tracklists.com/search/result.php?main_search=Artist+Track
            from urllib.parse import urlparse, parse_qs, unquote

            parsed = urlparse(url)
            query_params = parse_qs(parsed.query)

            if 'q' in query_params:
                track_name = unquote(query_params['q'][0])
            elif 'main_search' in query_params:
                track_name = unquote(query_params['main_search'][0])
            elif 'query' in query_params:
                track_name = unquote(query_params['query'][0])

        # If we have a specific target track from request, use it
        if not track_name and target_track and target_track.get('title') and target_track.get('primary_artist'):
            track_name = f"{target_track['primary_artist']} - {target_track['title']}"

        # If we have a track name to search for
        if track_name:
            logger.info(f"Searching for real playlists containing: {track_name}")

            # Execute real search
            results = await scraper.search_for_playlists(track_name)
            items_processed = 0

            # Process each found playlist and save to database
            for playlist in results:
                items = await scraper.process_playlist(playlist)
                if items:
                    logger.info(f"Saving {len(items)} items from playlist to database")
                    # Save items to database using the pipeline
                    class MockSpider:
                        name = "real_scraper_api"

                    spider = MockSpider()
                    for item in items:
                        await scraper.db_pipeline.process_item(item, spider)

                items_processed += len(items) if items else 0

        else:
            # Process a few target tracks from the scraper's internal list
            logger.info("Processing real target tracks for playlist discovery")
            results = []
            items_processed = 0

            # Process up to 3 target tracks
            for i, track_name in enumerate(scraper.target_tracks[:3]):
                logger.info(f"Searching for playlists containing: {track_name}")
                playlists = await scraper.search_for_playlists(track_name)
                for playlist in playlists:
                    items = await scraper.process_playlist(playlist)
                    if items:
                        logger.info(f"Saving {len(items)} items from playlist to database")
                        # Save items to database using the pipeline
                        class MockSpider:
                            name = "real_scraper_api"

                        spider = MockSpider()
                        for item in items:
                            await scraper.db_pipeline.process_item(item, spider)

                    items_processed += len(items) if items else 0
                results.extend(playlists)

        # Close the scraper properly
        if hasattr(scraper, 'close'):
            await scraper.close()

        return {
            "status": "success",
            "task_id": task_id,
            "url": url,
            "mode": "real_web_scraping",
            "items_processed": items_processed,
            "target_track": target_track,
            "message": f"Real web scraping completed. Processed {items_processed} tracks from actual websites"
        }

    except Exception as e:
        logger.error(f"Error in real web scraping: {str(e)}")
        return {
            "status": "error",
            "task_id": task_id,
            "error": str(e),
            "mode": "real_web_scraping"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)