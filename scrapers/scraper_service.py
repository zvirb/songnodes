#!/usr/bin/env python3
"""
Framework Scraper Service
=========================
FastAPI wrapper for framework-compliant spiders (MusicBrainz, Beatport, etc.)
Runs in Docker containers with health checks and API endpoints.
"""

import os
import sys
import logging
import asyncio
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Framework Scraper Service")

# Spider registry
AVAILABLE_SPIDERS = {
    'musicbrainz': 'spiders.musicbrainz_spider.MusicBrainzSpider',
    'beatport': 'spiders.beatport_spider.BeatportSpider',
    'spotify': 'spiders.stores.spotify_spider.SpotifySpider',
    'mixesdb': 'spiders.mixesdb_spider.MixesdbSpider'
}

# Active crawls tracking
active_crawls: Dict[str, Dict] = {}


class SpiderRunRequest(BaseModel):
    """Request model for spider execution"""
    spider_name: str
    args: Optional[Dict] = {}
    settings: Optional[Dict] = {}


class SpiderStatus(BaseModel):
    """Spider execution status"""
    spider_name: str
    status: str
    started_at: Optional[str]
    items_scraped: int
    errors: List[str]


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Framework Scraper Service",
        "version": "1.0.0",
        "available_spiders": list(AVAILABLE_SPIDERS.keys())
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "active_crawls": len(active_crawls)
    }


@app.get("/spiders")
async def list_spiders():
    """List available framework spiders"""
    return {
        "spiders": [
            {
                "name": "musicbrainz",
                "description": "MusicBrainz canonical entity resolution (MBID/ISRC)",
                "layer": "Foundational (Section 1.1)"
            },
            {
                "name": "beatport",
                "description": "DJ-centric genre charts and trend tracking",
                "layer": "Trend & Genre (Section 1.4)"
            },
            {
                "name": "spotify",
                "description": "Audio features enrichment (BPM, key, energy, etc.)",
                "layer": "Enrichment (Section 1.2)"
            },
            {
                "name": "mixesdb",
                "description": "Contextual setlist data and co-occurrence",
                "layer": "Contextual (Section 1.3)"
            }
        ]
    }


@app.post("/run/{spider_name}")
async def run_spider(
    spider_name: str,
    background_tasks: BackgroundTasks,
    request: Optional[SpiderRunRequest] = None
):
    """Start a spider crawl"""
    if spider_name not in AVAILABLE_SPIDERS:
        raise HTTPException(status_code=404, detail=f"Spider '{spider_name}' not found")

    if spider_name in active_crawls:
        return {
            "status": "already_running",
            "spider": spider_name,
            "started_at": active_crawls[spider_name]['started_at']
        }

    # Register crawl
    crawl_id = f"{spider_name}_{datetime.utcnow().timestamp()}"
    active_crawls[spider_name] = {
        "id": crawl_id,
        "started_at": datetime.utcnow().isoformat(),
        "status": "running",
        "items_scraped": 0,
        "errors": []
    }

    # Start crawl in background
    background_tasks.add_task(
        execute_spider,
        spider_name,
        request.args if request else {},
        request.settings if request else {}
    )

    return {
        "status": "started",
        "crawl_id": crawl_id,
        "spider": spider_name
    }


@app.get("/status/{spider_name}")
async def get_spider_status(spider_name: str):
    """Get spider execution status"""
    if spider_name not in AVAILABLE_SPIDERS:
        raise HTTPException(status_code=404, detail=f"Spider '{spider_name}' not found")

    if spider_name not in active_crawls:
        return {
            "spider": spider_name,
            "status": "idle",
            "message": "No active crawl"
        }

    return active_crawls[spider_name]


async def execute_spider(spider_name: str, args: Dict, custom_settings: Dict):
    """Execute spider in background"""
    try:
        logger.info(f"Starting {spider_name} spider with args: {args}")

        # Get Scrapy settings
        settings = get_project_settings()

        # Apply custom settings
        for key, value in custom_settings.items():
            settings.set(key, value)

        # Enable framework integration pipeline
        settings.set('ITEM_PIPELINES', {
            'pipelines.validation_pipeline.ValidationPipeline': 100,
            'pipelines.framework_integration_pipeline.FrameworkIntegrationPipeline': 150,
            'pipelines.discogs_enrichment_pipeline.DiscogsEnrichmentPipeline': 200,
            'pipelines.reddit_validation_pipeline.RedditValidationPipeline': 250,
            'database_pipeline.DatabasePipeline': 300,
        })

        # Create crawler process
        process = CrawlerProcess(settings)

        # Add spider to process
        process.crawl(spider_name, **args)

        # Run crawler (blocking)
        process.start()

        # Update status
        active_crawls[spider_name]['status'] = 'completed'
        logger.info(f"{spider_name} spider completed successfully")

    except Exception as e:
        logger.error(f"Error running {spider_name} spider: {e}")
        active_crawls[spider_name]['status'] = 'failed'
        active_crawls[spider_name]['errors'].append(str(e))

    finally:
        # Clean up after delay
        await asyncio.sleep(300)  # Keep status for 5 minutes
        if spider_name in active_crawls:
            del active_crawls[spider_name]


@app.post("/migrate")
async def run_migration():
    """Run database migration manually"""
    try:
        import subprocess

        db_host = os.getenv('DATABASE_HOST', 'postgres')
        db_port = os.getenv('DATABASE_PORT', '5432')
        db_name = os.getenv('DATABASE_NAME', 'musicdb')
        db_user = os.getenv('DATABASE_USER', 'musicdb_user')
        db_password = os.getenv('DATABASE_PASSWORD', 'musicdb_secure_pass_2024')

        migration_file = '/app/sql/migrations/001_add_mbid_and_camelot.sql'

        cmd = [
            'psql',
            f'-h', db_host,
            f'-p', db_port,
            f'-U', db_user,
            f'-d', db_name,
            f'-f', migration_file
        ]

        env = os.environ.copy()
        env['PGPASSWORD'] = db_password

        result = subprocess.run(cmd, env=env, capture_output=True, text=True)

        if result.returncode == 0:
            return {
                "status": "success",
                "message": "Migration completed successfully",
                "output": result.stdout
            }
        else:
            return {
                "status": "error",
                "message": "Migration failed",
                "error": result.stderr
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Migration error: {str(e)}")


@app.get("/config")
async def get_configuration():
    """Show current configuration"""
    return {
        "database": {
            "host": os.getenv('DATABASE_HOST', 'postgres'),
            "port": os.getenv('DATABASE_PORT', '5432'),
            "name": os.getenv('DATABASE_NAME', 'musicdb'),
            "user": os.getenv('DATABASE_USER', 'musicdb_user')
        },
        "redis": {
            "host": os.getenv('REDIS_HOST', 'redis'),
            "port": os.getenv('REDIS_PORT', '6379')
        },
        "framework": {
            "fuzzy_matching": "enabled (jellyfish, fuzzywuzzy)",
            "text_normalization": "enabled",
            "camelot_wheel": "enabled",
            "musicbrainz": "enabled",
            "beatport": "enabled"
        }
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv('SCRAPER_PORT', '8080'))

    logger.info("=" * 60)
    logger.info("Framework Scraper Service Starting")
    logger.info("=" * 60)
    logger.info(f"Port: {port}")
    logger.info(f"Available spiders: {list(AVAILABLE_SPIDERS.keys())}")
    logger.info("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=port)
