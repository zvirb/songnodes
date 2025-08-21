"""
Scraper Orchestrator Service
Manages and coordinates scraping tasks across multiple scrapers
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import asyncio
import logging
import json
import os
from enum import Enum

import redis
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from fastapi.responses import PlainTextResponse

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
scraping_tasks_total = Counter('scraping_tasks_total', 'Total number of scraping tasks', ['scraper', 'status'])
active_scrapers = Gauge('active_scrapers', 'Number of active scrapers', ['scraper'])
scraping_duration = Histogram('scraping_duration_seconds', 'Scraping task duration', ['scraper'])
queue_size = Gauge('scraping_queue_size', 'Number of tasks in queue', ['priority'])

# Initialize FastAPI app
app = FastAPI(
    title="Scraper Orchestrator",
    description="Orchestrates and manages web scraping tasks",
    version="1.0.0"
)

# Redis connection with connection pooling
redis_pool = redis.ConnectionPool(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    max_connections=10,
    decode_responses=True
)
redis_client = redis.Redis(connection_pool=redis_pool)

# Scheduler for periodic tasks
scheduler = AsyncIOScheduler()

# =====================
# Data Models
# =====================

class ScraperStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"
    DISABLED = "disabled"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ScrapingTask(BaseModel):
    model_config = {"use_enum_values": True}
    
    id: Optional[str] = Field(default=None)
    scraper: str
    url: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    params: Optional[Dict[str, Any]] = {}
    retry_count: int = 0
    max_retries: int = 3
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: TaskStatus = TaskStatus.PENDING
    error_message: Optional[str] = None

class ScraperConfig(BaseModel):
    name: str
    enabled: bool = True
    concurrent_requests: int = 8
    download_delay: float = 1.0
    rate_limit: Optional[str] = None  # e.g., "10/minute"
    priority: TaskPriority = TaskPriority.MEDIUM
    health_check_url: Optional[str] = None

class ScrapingSchedule(BaseModel):
    scraper: str
    cron_expression: str  # e.g., "0 2 * * *" for daily at 2 AM
    enabled: bool = True
    params: Optional[Dict[str, Any]] = {}

# =====================
# Scraper Registry
# =====================

SCRAPER_CONFIGS = {
    "1001tracklists": ScraperConfig(
        name="1001tracklists",
        enabled=True,
        concurrent_requests=8,
        download_delay=1.0,
        rate_limit="30/minute",
        health_check_url="http://scraper-1001tracklists:8011/health"
    ),
    "mixesdb": ScraperConfig(
        name="mixesdb",
        enabled=True,
        concurrent_requests=4,
        download_delay=2.0,
        rate_limit="20/minute",
        health_check_url="http://scraper-mixesdb:8012/health"
    ),
    "setlistfm": ScraperConfig(
        name="setlistfm",
        enabled=True,
        concurrent_requests=4,
        download_delay=1.5,
        rate_limit="60/minute",
        health_check_url="http://scraper-setlistfm:8013/health"
    ),
    "reddit": ScraperConfig(
        name="reddit",
        enabled=True,
        concurrent_requests=2,
        download_delay=3.0,
        rate_limit="60/minute",
        health_check_url="http://scraper-reddit:8014/health"
    ),
    "applemusic": ScraperConfig(
        name="applemusic",
        enabled=False,  # Disabled by default, needs API key
        concurrent_requests=4,
        download_delay=1.0,
        health_check_url="http://scraper-applemusic:8015/health"
    ),
    "watchthedj": ScraperConfig(
        name="watchthedj",
        enabled=True,
        concurrent_requests=2,
        download_delay=2.0,
        health_check_url="http://scraper-watchthedj:8016/health"
    )
}

# =====================
# Task Queue Management
# =====================

class TaskQueue:
    """Manages scraping task queue in Redis"""
    
    def __init__(self, redis_client):
        self.redis = redis_client
        self.queue_prefix = "scraping:queue"
        
    def add_task(self, task: ScrapingTask) -> str:
        """Add task to queue based on priority"""
        logger.info(f"Starting add_task for scraper: {task.scraper}")
        if not task.id:
            task.id = f"{task.scraper}_{datetime.now().timestamp()}"
        
        task.created_at = datetime.now()
        priority_value = task.priority if isinstance(task.priority, str) else task.priority.value
        queue_key = f"{self.queue_prefix}:{priority_value}"
        logger.info(f"Generated queue_key: {queue_key}")
        
        # Store task details
        task_key = f"scraping:task:{task.id}"
        # Convert task to JSON-serializable format for Redis
        task_data = self._serialize_task_for_redis(task)
        self.redis.hset(task_key, mapping=task_data)
        self.redis.expire(task_key, 86400)  # Expire after 24 hours
        
        # Add to priority queue
        score = self._get_priority_score(task.priority)
        logger.info(f"Adding to queue: queue_key={queue_key}, task.id={task.id}, score={score}")
        logger.info(f"task.id type: {type(task.id)}, score type: {type(score)}")
        self.redis.zadd(queue_key, {task.id: score})
        
        # Update metrics
        priority_value = task.priority if isinstance(task.priority, str) else task.priority.value
        queue_size.labels(priority=priority_value).inc()
        
        priority_value = task.priority if isinstance(task.priority, str) else task.priority.value
        logger.info(f"Added task {task.id} to {priority_value} priority queue")
        return task.id
    
    def get_next_task(self, scraper: Optional[str] = None) -> Optional[ScrapingTask]:
        """Get next task from highest priority queue"""
        for priority in [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW]:
            priority_value = priority.value if hasattr(priority, 'value') else str(priority)
            queue_key = f"{self.queue_prefix}:{priority_value}"
            
            # Get task with lowest score (oldest)
            task_ids = self.redis.zrange(queue_key, 0, 0)
            if task_ids:
                task_id = task_ids[0]
                
                # Get task details
                task_key = f"scraping:task:{task_id}"
                task_data = self.redis.hgetall(task_key)
                
                if not task_data:
                    # Remove orphaned task ID
                    self.redis.zrem(queue_key, task_id)
                    continue
                
                task = self._deserialize_task_from_redis(task_data)
                
                # Check if scraper matches (if specified)
                if scraper and task.scraper != scraper:
                    continue
                
                # Remove from queue
                self.redis.zrem(queue_key, task_id)
                priority_value = priority.value if hasattr(priority, 'value') else str(priority)
                queue_size.labels(priority=priority_value).dec()
                
                return task
        
        return None
    
    def _get_priority_score(self, priority: TaskPriority) -> float:
        """Convert priority to score (lower = higher priority)"""
        scores = {
            TaskPriority.CRITICAL: 0,
            TaskPriority.HIGH: 1000,
            TaskPriority.MEDIUM: 2000,
            TaskPriority.LOW: 3000
        }
        # Add timestamp to maintain FIFO within priority
        return scores[priority] + datetime.now().timestamp() / 1000000
    
    def _serialize_task_for_redis(self, task: ScrapingTask) -> Dict[str, str]:
        """Convert task to Redis-compatible format"""
        try:
            # Use model_dump with mode='json' to get values properly serialized
            task_dict = task.model_dump(mode='json')
            logger.info(f"Task dict after model_dump: {task_dict}")
            
            # Convert datetime objects to ISO strings
            for field in ['created_at', 'started_at', 'completed_at']:
                if task_dict.get(field):
                    if isinstance(task_dict[field], datetime):
                        task_dict[field] = task_dict[field].isoformat()
                    elif isinstance(task_dict[field], str):
                        # Already serialized by Pydantic
                        pass
            
            # Convert any dict/list fields to JSON strings
            for field in ['params']:
                if task_dict.get(field) and isinstance(task_dict[field], (dict, list)):
                    task_dict[field] = json.dumps(task_dict[field])
            
            # Convert all values to strings for Redis
            redis_data = {}
            for k, v in task_dict.items():
                if v is None:
                    redis_data[k] = ''
                elif isinstance(v, (dict, list)):
                    redis_data[k] = json.dumps(v)
                else:
                    redis_data[k] = str(v)
            
            logger.info(f"Redis data after serialization: {redis_data}")
            return redis_data
        except Exception as e:
            logger.error(f"Error in _serialize_task_for_redis: {e}")
            raise
    
    def _deserialize_task_from_redis(self, task_data: Dict[str, str]) -> ScrapingTask:
        """Convert Redis data back to ScrapingTask object"""
        if not task_data:
            return None
        
        # Convert string values back to appropriate types
        for field in ['created_at', 'started_at', 'completed_at']:
            if task_data.get(field) and task_data[field]:
                try:
                    task_data[field] = datetime.fromisoformat(task_data[field])
                except ValueError:
                    task_data[field] = None
        
        # Convert params back from JSON string
        if task_data.get('params') and task_data['params']:
            try:
                task_data['params'] = json.loads(task_data['params'])
            except json.JSONDecodeError:
                task_data['params'] = {}
        
        # Convert numeric fields
        if task_data.get('retry_count'):
            task_data['retry_count'] = int(task_data['retry_count'])
        if task_data.get('max_retries'):
            task_data['max_retries'] = int(task_data['max_retries'])
        
        # Handle enum fields - they should already be values, but handle legacy format
        if task_data.get('priority'):
            if 'TaskPriority.' in task_data['priority']:
                task_data['priority'] = task_data['priority'].split('.')[-1].lower()
            # Ensure it's a valid priority value
            if task_data['priority'] not in ['low', 'medium', 'high', 'critical']:
                task_data['priority'] = 'medium'  # Default fallback
        
        if task_data.get('status'):
            if 'TaskStatus.' in task_data['status']:
                task_data['status'] = task_data['status'].split('.')[-1].lower()
            # Ensure it's a valid status value
            if task_data['status'] not in ['pending', 'running', 'completed', 'failed', 'cancelled']:
                task_data['status'] = 'pending'  # Default fallback
        
        # Remove empty string values
        task_data = {k: v for k, v in task_data.items() if v != ''}
        
        return ScrapingTask(**task_data)

task_queue = TaskQueue(redis_client)

# =====================
# Rate Limiting
# =====================

class RateLimiter:
    """Manages rate limiting for scrapers"""
    
    def __init__(self, redis_client):
        self.redis = redis_client
        
    async def check_rate_limit(self, scraper: str) -> bool:
        """Check if scraper is within rate limit"""
        config = SCRAPER_CONFIGS.get(scraper)
        if not config or not config.rate_limit:
            return True
        
        # Parse rate limit (e.g., "30/minute")
        limit, period = config.rate_limit.split("/")
        limit = int(limit)
        
        # Convert period to seconds
        period_seconds = {
            "second": 1,
            "minute": 60,
            "hour": 3600
        }.get(period, 60)
        
        # Check current rate
        key = f"rate_limit:{scraper}"
        current = self.redis.get(key)
        
        if current is None:
            # First request
            self.redis.setex(key, period_seconds, 1)
            return True
        
        current = int(current)
        if current >= limit:
            return False
        
        # Increment counter
        self.redis.incr(key)
        return True
    
    async def wait_if_limited(self, scraper: str) -> None:
        """Wait if rate limited"""
        while not await self.check_rate_limit(scraper):
            await asyncio.sleep(1)

rate_limiter = RateLimiter(redis_client)

# =====================
# Scraper Management
# =====================

class ScraperManager:
    """Manages scraper instances and health checks"""
    
    def __init__(self):
        self.scrapers = SCRAPER_CONFIGS
        self.health_status = {}
        
    async def check_health(self, scraper: str) -> bool:
        """Check if scraper is healthy"""
        config = self.scrapers.get(scraper)
        if not config or not config.health_check_url:
            return False
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(config.health_check_url)
                is_healthy = response.status_code == 200
                
                # Update status
                self.health_status[scraper] = {
                    "healthy": is_healthy,
                    "last_check": datetime.now().isoformat(),
                    "status_code": response.status_code
                }
                
                # Update metrics
                if is_healthy:
                    active_scrapers.labels(scraper=scraper).set(1)
                else:
                    active_scrapers.labels(scraper=scraper).set(0)
                
                return is_healthy
        except Exception as e:
            logger.error(f"Health check failed for {scraper}: {str(e)}")
            self.health_status[scraper] = {
                "healthy": False,
                "last_check": datetime.now().isoformat(),
                "error": str(e)
            }
            active_scrapers.labels(scraper=scraper).set(0)
            return False
    
    async def check_all_health(self) -> Dict[str, bool]:
        """Check health of all scrapers"""
        results = {}
        for scraper in self.scrapers:
            results[scraper] = await self.check_health(scraper)
        return results
    
    def get_status(self, scraper: str) -> ScraperStatus:
        """Get current status of scraper"""
        if scraper not in self.scrapers:
            return ScraperStatus.ERROR
        
        if not self.scrapers[scraper].enabled:
            return ScraperStatus.DISABLED
        
        health = self.health_status.get(scraper, {})
        if not health.get("healthy", False):
            return ScraperStatus.ERROR
        
        # Check if actively processing
        active_key = f"scraper:active:{scraper}"
        if redis_client.exists(active_key):
            return ScraperStatus.RUNNING
        
        return ScraperStatus.IDLE

scraper_manager = ScraperManager()

# =====================
# Task Execution
# =====================

async def execute_scraping_task(task: ScrapingTask):
    """Execute a scraping task"""
    logger.info(f"Executing task {task.id} for scraper {task.scraper}")
    
    # Wait for rate limit
    await rate_limiter.wait_if_limited(task.scraper)
    
    # Mark as running
    task.status = TaskStatus.RUNNING
    task.started_at = datetime.now()
    
    # Store in Redis
    task_key = f"scraping:task:{task.id}"
    task_data = task_queue._serialize_task_for_redis(task)
    redis_client.hset(task_key, mapping=task_data)
    
    # Mark scraper as active
    active_key = f"scraper:active:{task.scraper}"
    redis_client.setex(active_key, 3600, task.id)  # Expire after 1 hour
    
    try:
        # Send task to scraper
        scraper_url = f"http://scraper-{task.scraper}:{8010 + list(SCRAPER_CONFIGS.keys()).index(task.scraper) + 1}/scrape"
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                scraper_url,
                json={
                    "url": task.url,
                    "params": task.params,
                    "task_id": task.id
                }
            )
            
            if response.status_code == 200:
                task.status = TaskStatus.COMPLETED
                task.completed_at = datetime.now()
                scraping_tasks_total.labels(scraper=task.scraper, status="success").inc()
                logger.info(f"Task {task.id} completed successfully")
            else:
                raise Exception(f"Scraper returned status {response.status_code}")
                
    except Exception as e:
        logger.error(f"Task {task.id} failed: {str(e)}")
        task.status = TaskStatus.FAILED
        task.error_message = str(e)
        task.completed_at = datetime.now()
        scraping_tasks_total.labels(scraper=task.scraper, status="failed").inc()
        
        # Retry logic
        if task.retry_count < task.max_retries:
            task.retry_count += 1
            task.status = TaskStatus.PENDING
            task_queue.add_task(task)
            logger.info(f"Retrying task {task.id} (attempt {task.retry_count}/{task.max_retries})")
    
    finally:
        # Update task in Redis
        task_data = task_queue._serialize_task_for_redis(task)
        redis_client.hset(task_key, mapping=task_data)
        
        # Remove active marker
        redis_client.delete(active_key)
        
        # Record duration
        if task.started_at and task.completed_at:
            duration = (task.completed_at - task.started_at).total_seconds()
            scraping_duration.labels(scraper=task.scraper).observe(duration)

# =====================
# Background Workers
# =====================

async def task_processor():
    """Background worker to process tasks from queue"""
    while True:
        try:
            # Get next task
            task = task_queue.get_next_task()
            
            if task:
                # Check if scraper is healthy
                if await scraper_manager.check_health(task.scraper):
                    # Execute task
                    asyncio.create_task(execute_scraping_task(task))
                else:
                    # Requeue task
                    logger.warning(f"Scraper {task.scraper} is unhealthy, requeuing task")
                    task_queue.add_task(task)
            
            await asyncio.sleep(1)  # Check queue every second
            
        except Exception as e:
            logger.error(f"Error in task processor: {str(e)}")
            await asyncio.sleep(5)

async def health_checker():
    """Background worker to check scraper health"""
    while True:
        try:
            await scraper_manager.check_all_health()
            await asyncio.sleep(30)  # Check every 30 seconds
        except Exception as e:
            logger.error(f"Error in health checker: {str(e)}")
            await asyncio.sleep(60)

# =====================
# Scheduled Tasks
# =====================

async def scheduled_scraping():
    """Execute scheduled scraping tasks"""
    schedules = [
        ScrapingSchedule(
            scraper="1001tracklists",
            cron_expression="0 2 * * *",  # Daily at 2 AM
            enabled=True
        ),
        ScrapingSchedule(
            scraper="mixesdb",
            cron_expression="0 3 * * *",  # Daily at 3 AM
            enabled=True
        ),
        ScrapingSchedule(
            scraper="setlistfm",
            cron_expression="0 4 * * *",  # Daily at 4 AM
            enabled=True
        )
    ]
    
    for schedule in schedules:
        if schedule.enabled:
            task = ScrapingTask(
                scraper=schedule.scraper,
                priority=TaskPriority.HIGH,
                params=schedule.params
            )
            task_id = task_queue.add_task(task)
            logger.info(f"Scheduled task {task_id} for {schedule.scraper}")

# =====================
# API Endpoints
# =====================

@app.on_event("startup")
async def startup_event():
    """Initialize background tasks on startup"""
    # Start background workers
    asyncio.create_task(task_processor())
    asyncio.create_task(health_checker())
    
    # Schedule periodic tasks
    scheduler.add_job(
        scheduled_scraping,
        CronTrigger(hour=2, minute=0),  # Daily at 2 AM
        id="daily_scraping"
    )
    scheduler.start()
    
    logger.info("Scraper Orchestrator started")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    scheduler.shutdown()
    logger.info("Scraper Orchestrator stopped")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/scrapers/status")
async def get_scrapers_status():
    """Get status of all scrapers"""
    statuses = {}
    for scraper in SCRAPER_CONFIGS:
        statuses[scraper] = {
            "status": scraper_manager.get_status(scraper).value,
            "config": SCRAPER_CONFIGS[scraper].dict(),
            "health": scraper_manager.health_status.get(scraper, {})
        }
    return statuses

@app.get("/scrapers/{scraper}/status")
async def get_scraper_status(scraper: str):
    """Get status of specific scraper"""
    if scraper not in SCRAPER_CONFIGS:
        raise HTTPException(status_code=404, detail="Scraper not found")
    
    return {
        "scraper": scraper,
        "status": scraper_manager.get_status(scraper).value,
        "config": SCRAPER_CONFIGS[scraper].dict(),
        "health": scraper_manager.health_status.get(scraper, {})
    }

@app.post("/scrapers/{scraper}/enable")
async def enable_scraper(scraper: str):
    """Enable a scraper"""
    if scraper not in SCRAPER_CONFIGS:
        raise HTTPException(status_code=404, detail="Scraper not found")
    
    SCRAPER_CONFIGS[scraper].enabled = True
    return {"message": f"Scraper {scraper} enabled"}

@app.post("/scrapers/{scraper}/disable")
async def disable_scraper(scraper: str):
    """Disable a scraper"""
    if scraper not in SCRAPER_CONFIGS:
        raise HTTPException(status_code=404, detail="Scraper not found")
    
    SCRAPER_CONFIGS[scraper].enabled = False
    return {"message": f"Scraper {scraper} disabled"}

@app.post("/tasks/submit")
async def submit_task(task: ScrapingTask, background_tasks: BackgroundTasks):
    """Submit a new scraping task"""
    logger.info(f"Received task submission request: {task}")
    
    try:
        if task.scraper not in SCRAPER_CONFIGS:
            raise HTTPException(status_code=400, detail="Invalid scraper")
        
        if not SCRAPER_CONFIGS[task.scraper].enabled:
            raise HTTPException(status_code=400, detail="Scraper is disabled")
        
        logger.info(f"About to call task_queue.add_task")
        task_id = task_queue.add_task(task)
        logger.info(f"Successfully added task: {task_id}")
        return {"task_id": task_id, "status": "queued"}
    except Exception as e:
        logger.error(f"Error in submit_task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Get status of a specific task"""
    task_key = f"scraping:task:{task_id}"
    task_data = redis_client.hgetall(task_key)
    
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Return deserialized task data
    task = task_queue._deserialize_task_from_redis(task_data)
    return task.model_dump() if task else task_data

@app.get("/tasks")
async def get_tasks(
    status: Optional[TaskStatus] = None,
    scraper: Optional[str] = None,
    limit: int = 100
):
    """Get list of tasks"""
    # Get all task keys
    task_keys = redis_client.keys("scraping:task:*")
    tasks = []
    
    for key in task_keys[:limit]:
        task_data = redis_client.hgetall(key)
        if task_data:
            task = task_queue._deserialize_task_from_redis(task_data)
            if not task:
                continue
            
            # Filter by status
            if status and task.status != status:
                continue
            # Filter by scraper
            if scraper and task.scraper != scraper:
                continue
            tasks.append(task.model_dump())
    
    return {"tasks": tasks, "count": len(tasks)}

@app.get("/queue/status")
async def get_queue_status():
    """Get queue status"""
    queue_stats = {}
    for priority in TaskPriority:
        priority_value = priority.value if hasattr(priority, 'value') else str(priority)
        queue_key = f"scraping:queue:{priority_value}"
        size = redis_client.zcard(queue_key)
        queue_stats[priority_value] = size
    
    return {"queue": queue_stats, "total": sum(queue_stats.values())}

@app.post("/queue/clear")
async def clear_queue(priority: Optional[TaskPriority] = None):
    """Clear task queue"""
    if priority:
        priority_value = priority.value if hasattr(priority, 'value') else str(priority)
        queue_key = f"scraping:queue:{priority_value}"
        count = redis_client.zcard(queue_key)
        redis_client.delete(queue_key)
        return {"message": f"Cleared {count} tasks from {priority_value} queue"}
    else:
        total = 0
        for p in TaskPriority:
            priority_value = p.value if hasattr(p, 'value') else str(p)
            queue_key = f"scraping:queue:{priority_value}"
            total += redis_client.zcard(queue_key)
            redis_client.delete(queue_key)
        return {"message": f"Cleared {total} tasks from all queues"}

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return PlainTextResponse(generate_latest())

@app.get("/orchestration/status")
async def get_orchestration_status():
    """Get overall orchestration status"""
    scrapers_status = await get_scrapers_status()
    queue_status = await get_queue_status()
    
    # Count healthy scrapers
    healthy_count = sum(1 for s in scrapers_status.values() if s["status"] == "idle" or s["status"] == "running")
    total_count = len(scrapers_status)
    
    return {
        "status": "operational" if healthy_count > 0 else "degraded",
        "healthy_scrapers": f"{healthy_count}/{total_count}",
        "queue_size": queue_status["total"],
        "scrapers": scrapers_status,
        "queue": queue_status
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)