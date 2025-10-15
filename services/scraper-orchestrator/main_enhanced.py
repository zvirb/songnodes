"""
Enhanced Scraper Orchestrator with Automated Scheduling and Robots.txt Compliance
This is an enhanced version of the main orchestrator that includes intelligent scheduling
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis

from automated_scheduler import AutomatedScrapingScheduler
from robots_parser import RobotsChecker

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Enhanced Scraper Orchestrator",
    description="Orchestrates web scraping with robots.txt compliance and intelligent scheduling",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True
)

# Global scheduler instance
automated_scheduler: Optional[AutomatedScrapingScheduler] = None
robots_checker: Optional[RobotsChecker] = None


# =====================
# Data Models
# =====================

class ScraperConfigUpdate(BaseModel):
    """Model for updating scraper configuration"""
    enabled: Optional[bool] = None
    min_interval: Optional[int] = None
    max_interval: Optional[int] = None
    priority: Optional[str] = None
    respect_robots: Optional[bool] = None
    adaptive_scheduling: Optional[bool] = None
    max_concurrent_pages: Optional[int] = None


class RobotsCheckRequest(BaseModel):
    """Request model for checking robots.txt compliance"""
    url: str
    user_agent: Optional[str] = None


class SchedulingRequest(BaseModel):
    """Request to schedule or reschedule a scraper"""
    scraper_name: str
    immediate: bool = False


# =====================
# Startup and Shutdown
# =====================

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global automated_scheduler, robots_checker

    logger.info("Starting Enhanced Scraper Orchestrator...")

    try:
        # Initialize robots checker
        robots_checker = RobotsChecker()
        logger.info("Robots.txt checker initialized")

        # Define scraper service URLs
        scraper_urls = {
            "1001tracklists": os.getenv("SCRAPER_1001TRACKLISTS_URL", "http://scraper-1001tracklists:8011"),
            "mixesdb": os.getenv("SCRAPER_MIXESDB_URL", "http://scraper-mixesdb:8012"),
            "setlistfm": os.getenv("SCRAPER_SETLISTFM_URL", "http://scraper-setlistfm:8013"),
            "reddit": os.getenv("SCRAPER_REDDIT_URL", "http://scraper-reddit:8014"),
            "bbc_sounds_rave_forever": os.getenv("SCRAPER_BBC_SOUNDS_URL", "http://scraper-bbc-sounds:8026"),
        }

        # Initialize automated scheduler
        automated_scheduler = AutomatedScrapingScheduler(redis_client, scraper_urls)
        await automated_scheduler.start()

        logger.info("Enhanced Scraper Orchestrator started successfully with automated scheduling")

    except Exception as e:
        logger.error(f"Failed to initialize orchestrator: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global automated_scheduler, robots_checker

    logger.info("Shutting down Enhanced Scraper Orchestrator...")

    if automated_scheduler:
        await automated_scheduler.stop()

    if robots_checker:
        await robots_checker.close()

    logger.info("Enhanced Scraper Orchestrator stopped")


# =====================
# Health and Status Endpoints
# =====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "automated_scheduling": automated_scheduler is not None,
        "robots_compliance": robots_checker is not None
    }


@app.get("/status")
async def get_orchestrator_status():
    """Get comprehensive orchestrator status"""
    if not automated_scheduler:
        raise HTTPException(status_code=503, detail="Automated scheduler not initialized")

    return automated_scheduler.get_status()


# =====================
# Scraper Configuration Endpoints
# =====================

@app.get("/scrapers")
async def list_scrapers():
    """List all configured scrapers and their settings"""
    if not automated_scheduler:
        raise HTTPException(status_code=503, detail="Automated scheduler not initialized")

    scrapers = {}
    for name, config in automated_scheduler.scraper_configs.items():
        scrapers[name] = config.to_dict()

    return {"scrapers": scrapers}


@app.get("/scrapers/{scraper_name}")
async def get_scraper_config(scraper_name: str):
    """Get configuration for a specific scraper"""
    if not automated_scheduler:
        raise HTTPException(status_code=503, detail="Automated scheduler not initialized")

    if scraper_name not in automated_scheduler.scraper_configs:
        raise HTTPException(status_code=404, detail=f"Scraper '{scraper_name}' not found")

    config = automated_scheduler.scraper_configs[scraper_name]

    # Get next scheduled run if available
    next_run = None
    for job in automated_scheduler.scheduler.get_jobs():
        if f"scraper_{scraper_name}" in job.id:
            next_run = job.next_run_time.isoformat() if job.next_run_time else None
            break

    return {
        "config": config.to_dict(),
        "next_run": next_run,
        "domain_health": {
            domain: automated_scheduler.robots_checker.get_domain_health(domain)
            for domain in config.domains
        }
    }


@app.patch("/scrapers/{scraper_name}")
async def update_scraper_config(scraper_name: str, updates: ScraperConfigUpdate):
    """Update configuration for a specific scraper"""
    if not automated_scheduler:
        raise HTTPException(status_code=503, detail="Automated scheduler not initialized")

    if scraper_name not in automated_scheduler.scraper_configs:
        raise HTTPException(status_code=404, detail=f"Scraper '{scraper_name}' not found")

    try:
        # Update configuration
        config_dict = updates.dict(exclude_none=True)
        automated_scheduler.update_config(scraper_name, config_dict)

        return {
            "status": "updated",
            "scraper": scraper_name,
            "updates": config_dict
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================
# Scheduling Control Endpoints
# =====================

@app.post("/schedule")
async def schedule_scraper(request: SchedulingRequest):
    """Schedule or reschedule a scraper"""
    if not automated_scheduler:
        raise HTTPException(status_code=503, detail="Automated scheduler not initialized")

    if request.scraper_name not in automated_scheduler.scraper_configs:
        raise HTTPException(status_code=404, detail=f"Scraper '{request.scraper_name}' not found")

    try:
        if request.immediate:
            # Run immediately
            await automated_scheduler._run_scraper(request.scraper_name)
            return {
                "status": "executed",
                "scraper": request.scraper_name,
                "timestamp": datetime.now().isoformat()
            }
        else:
            # Schedule for next interval
            job = await automated_scheduler.schedule_scraper(request.scraper_name)
            return {
                "status": "scheduled",
                "scraper": request.scraper_name,
                "next_run": job.next_run_time.isoformat() if job and job.next_run_time else None
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/schedule/{scraper_name}")
async def unschedule_scraper(scraper_name: str):
    """Stop scheduling a scraper"""
    if not automated_scheduler:
        raise HTTPException(status_code=503, detail="Automated scheduler not initialized")

    try:
        job_id = f"scraper_{scraper_name}"
        automated_scheduler.scheduler.remove_job(job_id)

        # Disable in config
        if scraper_name in automated_scheduler.scraper_configs:
            automated_scheduler.scraper_configs[scraper_name].enabled = False

        return {
            "status": "unscheduled",
            "scraper": scraper_name
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================
# Robots.txt Compliance Endpoints
# =====================

@app.post("/robots/check")
async def check_robots_compliance(request: RobotsCheckRequest):
    """Check if a URL is allowed by robots.txt"""
    if not robots_checker:
        raise HTTPException(status_code=503, detail="Robots checker not initialized")

    try:
        # Use custom user agent if provided
        checker = robots_checker
        if request.user_agent:
            checker = RobotsChecker(user_agent=request.user_agent)

        # Check if URL is allowed
        is_allowed = await checker.is_allowed(request.url)
        rules = await checker.get_rules(request.url)

        result = {
            "url": request.url,
            "allowed": is_allowed,
            "crawl_delay": rules.get_delay() if rules else None,
            "user_agent": checker.user_agent
        }

        if request.user_agent:
            await checker.close()

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/robots/stats")
async def get_robots_statistics():
    """Get robots.txt statistics for all domains"""
    if not robots_checker:
        raise HTTPException(status_code=503, detail="Robots checker not initialized")

    stats = {}

    # Get stats for all configured domains
    if automated_scheduler:
        for config in automated_scheduler.scraper_configs.values():
            for domain in config.domains:
                health = robots_checker.get_domain_health(domain)
                if health["total_requests"] > 0:
                    stats[domain] = health

    return {"domain_statistics": stats}


# =====================
# History and Monitoring Endpoints
# =====================

@app.get("/history/{scraper_name}")
async def get_scraper_history(scraper_name: str, limit: int = 100):
    """Get execution history for a scraper"""
    try:
        key = f"scraper:history:{scraper_name}"
        history = redis_client.lrange(key, 0, limit - 1)

        return {
            "scraper": scraper_name,
            "history": [eval(h) for h in history],  # Convert JSON strings back to dicts
            "count": len(history)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/queue")
async def get_queue_status():
    """Get current task queue status"""
    if not automated_scheduler:
        raise HTTPException(status_code=503, detail="Automated scheduler not initialized")

    return automated_scheduler.smart_scheduler.get_queue_stats()


# =====================
# Manual Control Endpoints
# =====================

@app.post("/pause")
async def pause_all_scrapers():
    """Pause all automated scraping"""
    if not automated_scheduler:
        raise HTTPException(status_code=503, detail="Automated scheduler not initialized")

    try:
        automated_scheduler.scheduler.pause()
        return {"status": "paused", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/resume")
async def resume_all_scrapers():
    """Resume all automated scraping"""
    if not automated_scheduler:
        raise HTTPException(status_code=503, detail="Automated scheduler not initialized")

    try:
        automated_scheduler.scheduler.resume()
        return {"status": "resumed", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================
# Metrics Endpoint
# =====================

@app.get("/metrics")
async def get_metrics():
    """Get Prometheus-style metrics"""
    metrics = []

    if automated_scheduler:
        status = automated_scheduler.get_status()

        # Add custom metrics
        metrics.append(f"# HELP scrapers_scheduled_total Total number of scheduled scrapers")
        metrics.append(f"# TYPE scrapers_scheduled_total gauge")
        metrics.append(f"scrapers_scheduled_total {len(status['jobs'])}")

        metrics.append(f"# HELP scrapers_enabled_total Total number of enabled scrapers")
        metrics.append(f"# TYPE scrapers_enabled_total gauge")
        enabled = sum(1 for s in status['scrapers'].values() if s['enabled'])
        metrics.append(f"scrapers_enabled_total {enabled}")

        metrics.append(f"# HELP queue_size_total Current size of task queue")
        metrics.append(f"# TYPE queue_size_total gauge")
        queue_stats = status.get('queue_stats', {})
        metrics.append(f"queue_size_total {queue_stats.get('total_tasks', 0)}")

        # Domain health metrics
        for domain, health in status.get('domain_health', {}).items():
            safe_domain = domain.replace('.', '_').replace('-', '_')

            metrics.append(f"# HELP domain_success_rate Success rate for {domain}")
            metrics.append(f"# TYPE domain_success_rate gauge")
            metrics.append(f"domain_success_rate{{domain=\"{domain}\"}} {health['success_rate']}")

            metrics.append(f"# HELP domain_rate_limits Rate limit hits for {domain}")
            metrics.append(f"# TYPE domain_rate_limits counter")
            metrics.append(f"domain_rate_limits{{domain=\"{domain}\"}} {health['rate_limit_hits']}")

    return "\n".join(metrics)


@app.post("/data/import-setlist")
async def import_setlist_data(background_tasks: BackgroundTasks):
    """Import setlist data through the database pipeline"""
    logger.info("Setlist data import manually triggered")

    try:
        # Execute the import script in the scrapers directory
        import subprocess
        import os

        script_path = "/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/scrapers/import_setlist_data.py"

        # Ensure the script exists
        if not os.path.exists(script_path):
            raise HTTPException(status_code=404, detail="Import script not found")

        # Run the import script in background
        def run_import():
            try:
                logger.info("Starting setlist data import script")
                result = subprocess.run(
                    ["python", script_path],
                    cwd="/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/scrapers",
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )

                if result.returncode == 0:
                    logger.info("Setlist import completed successfully")
                    logger.info(f"Import output: {result.stdout}")
                else:
                    logger.error(f"Import failed with code {result.returncode}")
                    logger.error(f"Import error: {result.stderr}")

            except subprocess.TimeoutExpired:
                logger.error("Import script timed out after 5 minutes")
            except Exception as e:
                logger.error(f"Error running import script: {e}")

        background_tasks.add_task(run_import)

        return {
            "status": "started",
            "message": "Setlist data import started in background"
        }

    except Exception as e:
        logger.error(f"Error triggering setlist import: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
