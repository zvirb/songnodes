"""
Browser Automation Data Collector Service
Main service integrating human-like browser navigation with Ollama LLM extraction
"""
import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

import structlog
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from human_browser_navigator import HumanBrowserNavigator, BrowserConfig, CollectionResult
from ollama_extractor import OllamaExtractor, OllamaConfig, ExtractionResult
from common.secrets_manager import get_database_url, validate_secrets

# Configure structured logging
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),
    logger_factory=structlog.WriteLoggerFactory(),
    cache_logger_on_first_use=False,
)

logger = structlog.get_logger(__name__)

# Browser concurrency control - CRITICAL for production stability
MAX_CONCURRENT_BROWSERS = int(os.getenv("MAX_CONCURRENT_BROWSERS", "3"))
browser_semaphore = asyncio.Semaphore(MAX_CONCURRENT_BROWSERS)

# Prometheus metrics
collection_tasks_total = Counter('collection_tasks_total', 'Total collection tasks', ['status'])
extraction_tasks_total = Counter('extraction_tasks_total', 'Total extraction tasks', ['status'])
active_collections = Gauge('active_collections', 'Active collection sessions')
collection_duration = Histogram('collection_duration_seconds', 'Collection duration')
extraction_duration = Histogram('extraction_duration_seconds', 'Extraction duration')
queued_collections = Gauge('queued_collections', 'Collections waiting for browser slot')


# ===================
# DATA MODELS
# ===================
class NavigationStep(BaseModel):
    """Single navigation step"""
    type: str  # 'click', 'type', 'scroll', 'wait', 'wait_for_selector'
    selector: Optional[str] = None
    text: Optional[str] = None
    value: Optional[str] = None
    duration_ms: Optional[int] = None
    timeout_ms: Optional[int] = 10000
    screenshot: bool = False


class CollectionRequest(BaseModel):
    """Request to start a collection task"""
    session_name: str
    collector_type: str  # 'music_discovery', 'tracklist_finder', 'artist_info', etc.
    target_url: str
    navigation_steps: Optional[List[NavigationStep]] = []
    extraction_type: str  # 'tracklist', 'artist', 'event', 'metadata'
    ollama_model: Optional[str] = "llama3.2:3b"
    browser_config: Optional[Dict[str, Any]] = {}
    collect_screenshots: bool = True
    auto_extract: bool = True  # Automatically extract after collection


class CollectionResponse(BaseModel):
    """Response from collection task"""
    session_id: str
    status: str
    message: str
    collection_result: Optional[Dict[str, Any]] = None
    extraction_result: Optional[Dict[str, Any]] = None


class ExtractionRequest(BaseModel):
    """Request to extract data from raw collected data"""
    raw_data_id: str
    extraction_type: str
    ollama_model: Optional[str] = "llama3.2:3b"
    custom_prompt: Optional[str] = None


# ===================
# DATABASE MANAGER
# ===================
class DatabaseManager:
    """Manages database operations for collected data"""

    def __init__(self, db_url: str):
        self.engine = create_async_engine(
            db_url,
            pool_size=10,
            max_overflow=20,
            pool_timeout=30,
            pool_recycle=3600,
            pool_pre_ping=True
        )
        self.session_factory = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False
        )

    async def create_collection_session(
        self,
        session_name: str,
        collector_type: str,
        browser_config: Dict[str, Any],
        target_url: str
    ) -> str:
        """Create new collection session and return session_id"""
        session_id = str(uuid.uuid4())

        async with self.session_factory() as session:
            query = text("""
                INSERT INTO collection_sessions (
                    id, session_name, collector_type, browser_type,
                    headless, target_websites, status
                ) VALUES (
                    :id, :session_name, :collector_type, :browser_type,
                    :headless, :target_websites, 'active'
                )
            """)

            await session.execute(query, {
                "id": session_id,
                "session_name": session_name,
                "collector_type": collector_type,
                "browser_type": browser_config.get("browser_type", "chromium"),
                "headless": browser_config.get("headless", False),
                "target_websites": json.dumps([target_url])
            })

            await session.commit()

        return session_id

    async def save_collected_data(
        self,
        session_id: str,
        collection_result: CollectionResult
    ) -> str:
        """Save raw collected data to database"""
        raw_data_id = str(uuid.uuid4())

        async with self.session_factory() as session:
            query = text("""
                INSERT INTO raw_collected_data (
                    id, collection_session_id, source_url, raw_html, raw_text,
                    page_title, collection_method, collection_duration_ms,
                    page_load_time_ms, total_interactions, screenshots,
                    interactions_performed, processing_status
                ) VALUES (
                    :id, :session_id, :source_url, :raw_html, :raw_text,
                    :page_title, 'browser_automation', :collection_duration_ms,
                    :page_load_time_ms, :total_interactions, :screenshots,
                    :interactions_performed, 'pending'
                )
            """)

            await session.execute(query, {
                "id": raw_data_id,
                "session_id": session_id,
                "source_url": collection_result.source_url,
                "raw_html": collection_result.raw_html,
                "raw_text": collection_result.raw_text,
                "page_title": collection_result.page_title,
                "collection_duration_ms": collection_result.collection_duration_ms,
                "page_load_time_ms": collection_result.page_load_time_ms,
                "total_interactions": len(collection_result.interactions),
                "screenshots": json.dumps(collection_result.screenshots),
                "interactions_performed": json.dumps([
                    i.model_dump() for i in collection_result.interactions
                ], default=str)
            })

            await session.commit()

        return raw_data_id

    async def save_extraction_result(
        self,
        raw_data_id: str,
        extraction_result: ExtractionResult,
        extraction_type: str,
        prompt_template: str
    ):
        """Save extraction result to database"""
        async with self.session_factory() as session:
            # Create extraction job record
            job_query = text("""
                INSERT INTO ollama_extraction_jobs (
                    id, raw_data_id, model_name, extraction_type, prompt_template,
                    extracted_data, confidence_score, tokens_processed,
                    processing_time_ms, status, error_message
                ) VALUES (
                    :id, :raw_data_id, :model_name, :extraction_type, :prompt_template,
                    :extracted_data, :confidence_score, :tokens_processed,
                    :processing_time_ms, :status, :error_message
                )
            """)

            await session.execute(job_query, {
                "id": str(uuid.uuid4()),
                "raw_data_id": raw_data_id,
                "model_name": extraction_result.model_used,
                "extraction_type": extraction_type,
                "prompt_template": prompt_template,
                "extracted_data": json.dumps(extraction_result.extracted_data) if extraction_result.extracted_data else None,
                "confidence_score": extraction_result.confidence_score,
                "tokens_processed": extraction_result.tokens_processed,
                "processing_time_ms": extraction_result.processing_time_ms,
                "status": "completed" if extraction_result.success else "failed",
                "error_message": extraction_result.error_message
            })

            # Update raw data record
            update_query = text("""
                UPDATE raw_collected_data
                SET llm_extracted_data = :extracted_data,
                    llm_model_used = :model_used,
                    llm_confidence_score = :confidence_score,
                    extraction_status = :status,
                    extracted_at = NOW()
                WHERE id = :raw_data_id
            """)

            await session.execute(update_query, {
                "raw_data_id": raw_data_id,
                "extracted_data": json.dumps(extraction_result.extracted_data) if extraction_result.extracted_data else None,
                "model_used": extraction_result.model_used,
                "confidence_score": extraction_result.confidence_score,
                "status": "completed" if extraction_result.success else "failed"
            })

            await session.commit()

    async def update_session_status(
        self,
        session_id: str,
        status: str,
        error_message: Optional[str] = None
    ):
        """Update collection session status"""
        async with self.session_factory() as session:
            # Update session with proper completion timestamp
            if status in ('completed', 'failed'):
                query = text("""
                    UPDATE collection_sessions
                    SET status = :status,
                        completed_at = NOW(),
                        last_error = :error_message
                    WHERE id = :session_id
                """)
            else:
                query = text("""
                    UPDATE collection_sessions
                    SET status = :status,
                        last_error = :error_message
                    WHERE id = :session_id
                """)

            await session.execute(query, {
                "session_id": session_id,
                "status": status,
                "error_message": error_message
            })

            await session.commit()


# ===================
# APPLICATION LIFECYCLE
# ===================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager"""
    # Validate secrets
    if not validate_secrets():
        logger.error("Required secrets missing")
        raise RuntimeError("Required secrets missing")

    # Initialize database
    db_url = get_database_url(async_driver=True, use_connection_pool=True)
    app.state.db = DatabaseManager(db_url)

    # Initialize Ollama extractor
    ollama_url = os.getenv("OLLAMA_URL", "http://ollama:11434")
    app.state.ollama = OllamaExtractor(OllamaConfig(base_url=ollama_url))

    # Check Ollama health
    health = await app.state.ollama.health_check()
    if health["status"] == "healthy":
        logger.info("Ollama service connected", models=health["available_models"])
    else:
        logger.warning("Ollama service unavailable", error=health.get("error"))

    logger.info("Browser collector service started")

    yield

    # Cleanup
    await app.state.ollama.close()
    logger.info("Browser collector service stopped")


# ===================
# FASTAPI APPLICATION
# ===================
app = FastAPI(
    title="Browser Automation Data Collector",
    description="Human-like browser automation with Ollama LLM extraction",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    ollama_health = await app.state.ollama.health_check()

    return {
        "status": "healthy",
        "service": "browser-collector",
        "ollama": ollama_health
    }


@app.post("/collect", response_model=CollectionResponse)
async def collect_data(
    request: CollectionRequest,
    background_tasks: BackgroundTasks
):
    """
    Start browser automation collection task

    This endpoint:
    1. Launches a browser session (rate-limited to prevent resource exhaustion)
    2. Navigates to target URL with human-like interactions
    3. Collects raw HTML/text data
    4. Stores data in database
    5. Optionally extracts structured data using Ollama

    PRODUCTION NOTE: Limited to MAX_CONCURRENT_BROWSERS simultaneous collections
    to prevent memory exhaustion. Additional requests will wait in queue.
    """
    session_id = None

    try:
        logger.info(
            "Collection request received",
            session_name=request.session_name,
            target_url=request.target_url,
            max_concurrent=MAX_CONCURRENT_BROWSERS
        )

        active_collections.inc()
        collection_tasks_total.labels(status="started").inc()

        # Create database session
        session_id = await app.state.db.create_collection_session(
            session_name=request.session_name,
            collector_type=request.collector_type,
            browser_config=request.browser_config,
            target_url=request.target_url
        )

        # CRITICAL: Acquire semaphore to limit concurrent browsers
        # This prevents memory exhaustion and system crashes
        queued_collections.inc()
        logger.info(
            "Waiting for browser slot",
            session_id=session_id,
            max_concurrent=MAX_CONCURRENT_BROWSERS
        )

        async with browser_semaphore:
            queued_collections.dec()
            logger.info(
                "Browser slot acquired, starting collection",
                session_id=session_id
            )

            # Initialize browser navigator
            browser_config = BrowserConfig(**request.browser_config)

            async with HumanBrowserNavigator(config=browser_config) as navigator:
                # Convert navigation steps
                steps = [step.model_dump() for step in request.navigation_steps]

                # Perform collection with timeout to prevent hung requests
                collection_timeout = int(os.getenv("COLLECTION_TIMEOUT_SECONDS", "300"))

                try:
                    with collection_duration.time():
                        async with asyncio.timeout(collection_timeout):
                            collection_result = await navigator.navigate_and_collect(
                                url=request.target_url,
                                navigation_steps=steps,
                                collect_screenshots=request.collect_screenshots
                            )
                except asyncio.TimeoutError:
                    raise HTTPException(
                        status_code=504,
                        detail=f"Collection timeout after {collection_timeout} seconds"
                    )

                if not collection_result.success:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Collection failed: {collection_result.error_message}"
                    )

                # Save to database
                raw_data_id = await app.state.db.save_collected_data(
                    session_id=session_id,
                    collection_result=collection_result
                )

                logger.info(
                    "Collection completed",
                    session_id=session_id,
                    raw_data_id=raw_data_id,
                    duration_ms=collection_result.collection_duration_ms
                )

                # Auto-extract if requested
                extraction_result = None
                if request.auto_extract:
                    try:
                        with extraction_duration.time():
                            extraction_result = await app.state.ollama.extract_with_ollama(
                                raw_text=collection_result.raw_text,
                                extraction_type=request.extraction_type,
                                model=request.ollama_model
                            )

                        # Save extraction result
                        await app.state.db.save_extraction_result(
                            raw_data_id=raw_data_id,
                            extraction_result=extraction_result,
                            extraction_type=request.extraction_type,
                            prompt_template=f"{request.extraction_type}_extraction"
                        )

                        if extraction_result.success:
                            extraction_tasks_total.labels(status="success").inc()
                            logger.info(
                                "Extraction completed",
                                raw_data_id=raw_data_id,
                                confidence=extraction_result.confidence_score
                            )
                        else:
                            extraction_tasks_total.labels(status="failed").inc()

                    except Exception as e:
                        logger.error("Extraction failed", raw_data_id=raw_data_id, error=str(e))
                        extraction_tasks_total.labels(status="failed").inc()

                # Determine if collection was truly successful based on data quality
                has_useful_data = False
                failure_reason = None

                if extraction_result and extraction_result.success:
                    # Check if extraction actually found data
                    extracted_data = extraction_result.extracted_data
                    if extracted_data:
                        # For tracklist extraction, check if tracks were found
                        if request.extraction_type == "tracklist":
                            tracks = extracted_data.get("tracks", [])
                            has_useful_data = len(tracks) > 0
                            if not has_useful_data:
                                failure_reason = "No tracks found in tracklist"
                        else:
                            # For other extraction types, consider any extracted data as success
                            has_useful_data = True
                    else:
                        failure_reason = "Extraction returned empty data"
                elif collection_result.raw_text:
                    # Collection succeeded but extraction wasn't performed or failed
                    # Check if the page indicates a 404 or error
                    raw_text_lower = collection_result.raw_text.lower()
                    if any(phrase in raw_text_lower for phrase in [
                        "not found", "404", "page not found", "deleted",
                        "does not exist", "has been removed"
                    ]):
                        failure_reason = "Page not found (404 or deleted content)"
                    else:
                        # Got content but no extraction - consider partial success
                        has_useful_data = True
                else:
                    failure_reason = "No content collected"

                # Update session status and metrics based on data quality
                if has_useful_data:
                    await app.state.db.update_session_status(session_id, "completed")
                    collection_tasks_total.labels(status="success").inc()
                    status_msg = "completed"
                    message = "Collection completed successfully with usable data"
                else:
                    await app.state.db.update_session_status(
                        session_id,
                        "failed",
                        error_message=failure_reason
                    )
                    collection_tasks_total.labels(status="failed").inc()
                    status_msg = "completed_no_data"
                    message = f"Collection completed but no usable data: {failure_reason}"

                active_collections.dec()

                logger.info(
                    "Collection finished",
                    has_useful_data=has_useful_data,
                    failure_reason=failure_reason,
                    extraction_confidence=extraction_result.confidence_score if extraction_result else None
                )

                return CollectionResponse(
                    session_id=session_id,
                    status=status_msg,
                    message=message,
                    collection_result=collection_result.model_dump(),
                    extraction_result=extraction_result.model_dump() if extraction_result else None
                )

    except Exception as e:
        logger.error("Collection task failed", error=str(e), session_id=session_id)

        if session_id:
            await app.state.db.update_session_status(
                session_id=session_id,
                status="failed",
                error_message=str(e)
            )

        collection_tasks_total.labels(status="failed").inc()
        active_collections.dec()

        raise HTTPException(status_code=500, detail=str(e))


@app.post("/extract/{raw_data_id}")
async def extract_from_raw_data(raw_data_id: str, request: ExtractionRequest):
    """
    Extract structured data from previously collected raw data
    """
    try:
        # Fetch raw data from database
        async with app.state.db.session_factory() as session:
            query = text("SELECT raw_text, source_url FROM raw_collected_data WHERE id = :id")
            result = await session.execute(query, {"id": raw_data_id})
            row = result.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Raw data not found")

            raw_text, source_url = row

        # Perform extraction
        with extraction_duration.time():
            extraction_result = await app.state.ollama.extract_with_ollama(
                raw_text=raw_text,
                extraction_type=request.extraction_type,
                model=request.ollama_model,
                custom_prompt=request.custom_prompt
            )

        # Save result
        await app.state.db.save_extraction_result(
            raw_data_id=raw_data_id,
            extraction_result=extraction_result,
            extraction_type=request.extraction_type,
            prompt_template=request.custom_prompt or f"{request.extraction_type}_extraction"
        )

        if extraction_result.success:
            extraction_tasks_total.labels(status="success").inc()
        else:
            extraction_tasks_total.labels(status="failed").inc()

        return extraction_result.model_dump()

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Extraction failed", raw_data_id=raw_data_id, error=str(e))
        extraction_tasks_total.labels(status="failed").inc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(generate_latest())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8030)
