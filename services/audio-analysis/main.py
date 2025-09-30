"""
Audio Analysis Service for SongNodes
Extracts DJ-specific features from audio files using librosa and essentia.

This service processes audio tracks to extract:
- Intro/outro durations
- Breakdown positions
- Vocal presence and segments
- Beat grid and tempo
- Energy curve
"""
import os
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import asyncpg
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi.responses import Response
import aio_pika
import httpx

from analysis_modules.intro_outro_detector import IntroOutroDetector
from analysis_modules.vocal_detector import VocalDetector
from analysis_modules.breakdown_detector import BreakdownDetector
from analysis_modules.beat_grid_analyzer import BeatGridAnalyzer
from analysis_modules.audio_fetcher import AudioFetcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
TRACKS_ANALYZED = Counter('audio_analysis_tracks_analyzed_total', 'Total tracks analyzed')
TRACKS_FAILED = Counter('audio_analysis_tracks_failed_total', 'Total tracks failed')
ANALYSIS_DURATION = Histogram('audio_analysis_duration_seconds', 'Audio analysis duration')
QUEUE_SIZE = Gauge('audio_analysis_queue_size', 'Current queue size')
ACTIVE_ANALYSES = Gauge('audio_analysis_active_count', 'Active analysis tasks')

# Global state
db_pool: Optional[asyncpg.Pool] = None
rabbitmq_connection: Optional[aio_pika.Connection] = None
rabbitmq_channel: Optional[aio_pika.Channel] = None


class AudioAnalysisRequest(BaseModel):
    track_id: str = Field(..., description="Track UUID")
    spotify_preview_url: Optional[str] = Field(None, description="Spotify preview URL")
    audio_file_path: Optional[str] = Field(None, description="Path to audio file in MinIO")


class AudioAnalysisResult(BaseModel):
    track_id: str
    intro_duration_seconds: Optional[float]
    outro_duration_seconds: Optional[float]
    breakdown_timestamps: list
    vocal_segments: list
    energy_curve: list
    beat_grid: list
    bpm: Optional[float]
    analysis_version: str
    analyzed_at: datetime
    status: str
    error_message: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources"""
    global db_pool, rabbitmq_connection, rabbitmq_channel

    # Initialize database connection pool
    database_url = os.getenv('DATABASE_URL')
    try:
        db_pool = await asyncpg.create_pool(
            database_url,
            min_size=5,
            max_size=15,
            command_timeout=30
        )
        logger.info("Database connection pool created")
    except Exception as e:
        logger.error(f"Failed to create database pool: {e}")
        raise

    # Initialize RabbitMQ
    rabbitmq_host = os.getenv('RABBITMQ_HOST', 'rabbitmq')
    rabbitmq_port = int(os.getenv('RABBITMQ_PORT', '5672'))
    rabbitmq_user = os.getenv('RABBITMQ_USER', 'musicdb')
    rabbitmq_pass = os.getenv('RABBITMQ_PASS', 'musicdb_pass')

    try:
        rabbitmq_connection = await aio_pika.connect_robust(
            f"amqp://{rabbitmq_user}:{rabbitmq_pass}@{rabbitmq_host}:{rabbitmq_port}/musicdb"
        )
        rabbitmq_channel = await rabbitmq_connection.channel()
        await rabbitmq_channel.set_qos(prefetch_count=1)

        # Declare queue
        queue = await rabbitmq_channel.declare_queue(
            'audio_analysis_queue',
            durable=True
        )
        logger.info("RabbitMQ connection established")

        # Start consuming messages
        asyncio.create_task(consume_analysis_requests(queue))

    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ: {e}")
        raise

    yield

    # Cleanup
    if db_pool:
        await db_pool.close()
        logger.info("Database pool closed")

    if rabbitmq_channel:
        await rabbitmq_channel.close()
    if rabbitmq_connection:
        await rabbitmq_connection.close()
        logger.info("RabbitMQ connection closed")


app = FastAPI(
    title="Audio Analysis Service",
    description="DJ-specific audio feature extraction service",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    health = {
        "status": "healthy",
        "service": "audio-analysis",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "unknown",
        "rabbitmq": "unknown"
    }

    # Check database
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            health["database"] = "healthy"
        except Exception as e:
            health["database"] = f"unhealthy: {str(e)}"
            health["status"] = "degraded"

    # Check RabbitMQ
    if rabbitmq_connection and not rabbitmq_connection.is_closed:
        health["rabbitmq"] = "healthy"
    else:
        health["rabbitmq"] = "unhealthy"
        health["status"] = "degraded"

    return health


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type="text/plain")


@app.post("/analyze", response_model=AudioAnalysisResult)
async def analyze_track(request: AudioAnalysisRequest):
    """
    Manually trigger audio analysis for a track.
    Primarily for testing - production uses queue consumer.
    """
    ACTIVE_ANALYSES.inc()
    try:
        result = await process_track_analysis(
            request.track_id,
            request.spotify_preview_url,
            request.audio_file_path
        )
        TRACKS_ANALYZED.inc()
        return result
    except Exception as e:
        TRACKS_FAILED.inc()
        logger.error(f"Analysis failed for track {request.track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        ACTIVE_ANALYSES.dec()


async def consume_analysis_requests(queue: aio_pika.Queue):
    """Consume audio analysis requests from RabbitMQ queue"""
    logger.info("Starting to consume audio analysis requests")

    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            async with message.process():
                QUEUE_SIZE.dec()
                ACTIVE_ANALYSES.inc()

                try:
                    # Parse message
                    import json
                    data = json.loads(message.body.decode())
                    track_id = data.get('track_id')
                    spotify_preview_url = data.get('spotify_preview_url')
                    audio_file_path = data.get('audio_file_path')

                    logger.info(f"Processing analysis request for track {track_id}")

                    # Process analysis with timeout
                    result = await asyncio.wait_for(
                        process_track_analysis(track_id, spotify_preview_url, audio_file_path),
                        timeout=60.0  # 60 second timeout per track
                    )

                    TRACKS_ANALYZED.inc()
                    logger.info(f"Successfully analyzed track {track_id}")

                except asyncio.TimeoutError:
                    TRACKS_FAILED.inc()
                    logger.error(f"Analysis timeout for track {track_id}")
                    await store_failed_analysis(track_id, "Analysis timeout exceeded")

                except Exception as e:
                    TRACKS_FAILED.inc()
                    logger.error(f"Analysis failed for track {track_id}: {e}")
                    await store_failed_analysis(track_id, str(e))

                finally:
                    ACTIVE_ANALYSES.dec()


@ANALYSIS_DURATION.time()
async def process_track_analysis(
    track_id: str,
    spotify_preview_url: Optional[str] = None,
    audio_file_path: Optional[str] = None
) -> AudioAnalysisResult:
    """
    Process audio analysis for a single track.

    Args:
        track_id: UUID of the track
        spotify_preview_url: Spotify preview URL (30 seconds)
        audio_file_path: Path to full audio file in MinIO storage

    Returns:
        AudioAnalysisResult with extracted features
    """
    logger.info(f"Starting analysis for track {track_id}")

    # Check if already analyzed
    if await is_track_analyzed(track_id):
        logger.info(f"Track {track_id} already analyzed, skipping")
        return await get_existing_analysis(track_id)

    # Fetch audio
    audio_fetcher = AudioFetcher()
    audio_data, sample_rate = await audio_fetcher.fetch_audio(
        spotify_preview_url=spotify_preview_url,
        audio_file_path=audio_file_path
    )

    if audio_data is None:
        raise ValueError("Failed to fetch audio from any source")

    # Initialize analyzers
    intro_outro_detector = IntroOutroDetector()
    vocal_detector = VocalDetector()
    breakdown_detector = BreakdownDetector()
    beat_grid_analyzer = BeatGridAnalyzer()

    # Run analysis modules
    intro_duration, outro_duration = intro_outro_detector.detect(audio_data, sample_rate)
    vocal_segments = vocal_detector.detect(audio_data, sample_rate)
    breakdown_timestamps = breakdown_detector.detect(audio_data, sample_rate)
    beat_grid, bpm = beat_grid_analyzer.analyze(audio_data, sample_rate)

    # Calculate energy curve
    energy_curve = intro_outro_detector.calculate_energy_curve(audio_data, sample_rate)

    # Build result
    result = AudioAnalysisResult(
        track_id=track_id,
        intro_duration_seconds=intro_duration,
        outro_duration_seconds=outro_duration,
        breakdown_timestamps=breakdown_timestamps,
        vocal_segments=vocal_segments,
        energy_curve=energy_curve,
        beat_grid=beat_grid,
        bpm=bpm,
        analysis_version="1.0.0",
        analyzed_at=datetime.utcnow(),
        status="completed"
    )

    # Store in database
    await store_analysis_result(result)

    logger.info(f"Completed analysis for track {track_id}")
    return result


async def is_track_analyzed(track_id: str) -> bool:
    """Check if track has already been analyzed"""
    async with db_pool.acquire() as conn:
        result = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM tracks_audio_analysis WHERE track_id = $1)",
            track_id
        )
        return result


async def get_existing_analysis(track_id: str) -> AudioAnalysisResult:
    """Retrieve existing analysis from database"""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT track_id, intro_duration_seconds, outro_duration_seconds,
                   breakdown_timestamps, vocal_segments, energy_curve, beat_grid,
                   bpm, analysis_version, analyzed_at, status, error_message
            FROM tracks_audio_analysis
            WHERE track_id = $1
            """,
            track_id
        )

        if row:
            return AudioAnalysisResult(**dict(row))
        raise ValueError(f"Track {track_id} not found in database")


async def store_analysis_result(result: AudioAnalysisResult):
    """Store analysis result in database"""
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO tracks_audio_analysis (
                track_id, intro_duration_seconds, outro_duration_seconds,
                breakdown_timestamps, vocal_segments, energy_curve, beat_grid,
                bpm, analysis_version, analyzed_at, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (track_id) DO UPDATE SET
                intro_duration_seconds = EXCLUDED.intro_duration_seconds,
                outro_duration_seconds = EXCLUDED.outro_duration_seconds,
                breakdown_timestamps = EXCLUDED.breakdown_timestamps,
                vocal_segments = EXCLUDED.vocal_segments,
                energy_curve = EXCLUDED.energy_curve,
                beat_grid = EXCLUDED.beat_grid,
                bpm = EXCLUDED.bpm,
                analysis_version = EXCLUDED.analysis_version,
                analyzed_at = EXCLUDED.analyzed_at,
                status = EXCLUDED.status
            """,
            result.track_id,
            result.intro_duration_seconds,
            result.outro_duration_seconds,
            result.breakdown_timestamps,
            result.vocal_segments,
            result.energy_curve,
            result.beat_grid,
            result.bpm,
            result.analysis_version,
            result.analyzed_at,
            result.status
        )


async def store_failed_analysis(track_id: str, error_message: str):
    """Store failed analysis attempt"""
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO tracks_audio_analysis (
                track_id, status, error_message, analyzed_at, analysis_version
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (track_id) DO UPDATE SET
                status = EXCLUDED.status,
                error_message = EXCLUDED.error_message,
                analyzed_at = EXCLUDED.analyzed_at
            """,
            track_id,
            "failed",
            error_message,
            datetime.utcnow(),
            "1.0.0"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8020)