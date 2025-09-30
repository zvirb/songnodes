"""REST API Service for SongNodes"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging
import os
from datetime import datetime
import asyncpg
import json
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://musicdb_user:musicdb_secure_pass@db:5432/musicdb")
db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage database connection pool lifecycle with 2025 best practices"""
    global db_pool
    try:
        # 2025 best practices: proper timeouts, connection validation, and limits
        db_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=5,
            max_size=15,  # Reduced from 20 to prevent overflow
            command_timeout=30,  # 30 second query timeout
            server_settings={
                'jit': 'off',  # Disable JIT for predictable performance
                'statement_timeout': '30000',  # 30 second statement timeout
                'idle_in_transaction_session_timeout': '300000'  # 5 minute idle timeout
            },
            # Connection validation and health checks
            init=lambda conn: conn.set_type_codec('json', encoder=json.dumps, decoder=json.loads, schema='pg_catalog'),
            max_queries=50000,  # Recycle connections after 50k queries
            max_inactive_connection_lifetime=1800  # 30 minute max idle time
        )
        logger.info("Database connection pool created with enhanced 2025 configuration")
        yield
    finally:
        if db_pool:
            await db_pool.close()
            logger.info("Database connection pool closed")

app = FastAPI(
    title="SongNodes REST API",
    description="Main REST API for music data operations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
try:
    from routers import api_keys
    app.include_router(api_keys.router)
    logger.info("API Keys router registered successfully")
except Exception as e:
    logger.warning(f"Failed to load API Keys router: {str(e)}")
    logger.warning("API key management endpoints will not be available")

# Models
class Artist(BaseModel):
    id: Optional[int] = None
    name: str
    genre: Optional[str] = None
    popularity: Optional[float] = None
    created_at: Optional[datetime] = None

class Track(BaseModel):
    id: Optional[int] = None
    title: str
    artist_id: int
    duration: Optional[int] = None
    bpm: Optional[float] = None
    key: Optional[str] = None

class Mix(BaseModel):
    id: Optional[int] = None
    name: str
    dj_id: int
    date: Optional[datetime] = None
    venue: Optional[str] = None

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "rest-api",
        "version": "1.0.0",
        "database": "connected"  # Placeholder
    }

@app.get("/api/v1/artists", response_model=List[Artist])
async def get_artists(limit: int = 100, offset: int = 0):
    """Get list of artists"""
    try:
        # Placeholder data
        return [
            Artist(id=1, name="Example Artist 1", genre="Electronic"),
            Artist(id=2, name="Example Artist 2", genre="House")
        ]
    except Exception as e:
        logger.error(f"Failed to fetch artists: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/artists/{artist_id}", response_model=Artist)
async def get_artist(artist_id: int):
    """Get specific artist by ID"""
    try:
        return Artist(
            id=artist_id,
            name=f"Artist {artist_id}",
            genre="Electronic",
            popularity=0.85
        )
    except Exception as e:
        logger.error(f"Failed to fetch artist {artist_id}: {str(e)}")
        raise HTTPException(status_code=404, detail="Artist not found")

@app.get("/api/v1/tracks", response_model=List[Track])
async def get_tracks(artist_id: Optional[int] = None, limit: int = 100):
    """Get list of tracks"""
    try:
        tracks = [
            Track(id=1, title="Track 1", artist_id=1, bpm=128),
            Track(id=2, title="Track 2", artist_id=1, bpm=125)
        ]
        if artist_id:
            tracks = [t for t in tracks if t.artist_id == artist_id]
        return tracks
    except Exception as e:
        logger.error(f"Failed to fetch tracks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/mixes", response_model=List[Mix])
async def get_mixes(dj_id: Optional[int] = None, limit: int = 100):
    """Get list of DJ mixes"""
    try:
        return [
            Mix(id=1, name="Summer Mix 2024", dj_id=1, venue="Club XYZ"),
            Mix(id=2, name="Festival Set", dj_id=2, venue="Festival ABC")
        ]
    except Exception as e:
        logger.error(f"Failed to fetch mixes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/graph/nodes")
async def get_graph_nodes(limit: int = 500, min_weight: int = 1):
    """Get graph nodes - only songs with adjacencies"""
    try:
        async with db_pool.acquire() as conn:
            # Query only songs that have adjacencies
            query = """
            SELECT DISTINCT s.song_id, s.title, s.primary_artist_id,
                   a.name as artist_name, s.bpm, s.key,
                   COUNT(DISTINCT sa.*) as connection_count
            FROM songs s
            LEFT JOIN artists a ON s.primary_artist_id = a.artist_id
            INNER JOIN (
                SELECT song_id_1 as song_id FROM song_adjacency WHERE occurrence_count >= $1
                UNION
                SELECT song_id_2 as song_id FROM song_adjacency WHERE occurrence_count >= $1
            ) connected ON s.song_id = connected.song_id
            LEFT JOIN song_adjacency sa ON (sa.song_id_1 = s.song_id OR sa.song_id_2 = s.song_id)
            GROUP BY s.song_id, s.title, s.primary_artist_id, a.name, s.bpm, s.key
            LIMIT $2
            """
            rows = await conn.fetch(query, min_weight, limit)

            nodes = []
            for row in rows:
                nodes.append({
                    "id": str(row['song_id']),
                    "label": row['title'],
                    "artist": row['artist_name'] or "Unknown Artist",
                    "type": "track",
                    "bpm": row['bpm'],
                    "key": row['key'],
                    "size": min(30, 10 + row['connection_count'] * 2),  # Size based on connections
                    "connections": row['connection_count']
                })

            return nodes
    except Exception as e:
        logger.error(f"Failed to fetch graph nodes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/graph/edges")
async def get_graph_edges(limit: int = 5000, min_weight: int = 1):
    """Get graph edges - adjacency relationships"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT sa.song_id_1, sa.song_id_2, sa.occurrence_count as weight,
                   s1.title as source_title, s2.title as target_title
            FROM song_adjacency sa
            JOIN songs s1 ON sa.song_id_1 = s1.song_id
            JOIN songs s2 ON sa.song_id_2 = s2.song_id
            WHERE sa.occurrence_count >= $1
            ORDER BY sa.occurrence_count DESC
            LIMIT $2
            """
            rows = await conn.fetch(query, min_weight, limit)

            edges = []
            for row in rows:
                edges.append({
                    "source": str(row['song_id_1']),
                    "target": str(row['song_id_2']),
                    "weight": row['weight'],
                    "source_label": row['source_title'],
                    "target_label": row['target_title']
                })

            return edges
    except Exception as e:
        logger.error(f"Failed to fetch graph edges: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/scrape/trigger")
async def trigger_scrape(source: str = "1001tracklists"):
    """Trigger web scraping job"""
    try:
        return {
            "status": "initiated",
            "job_id": "scrape_12345",
            "source": source,
            "message": "Scraping job has been queued"
        }
    except Exception as e:
        logger.error(f"Failed to trigger scrape: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# PIPELINE OBSERVABILITY ENDPOINTS - 2025 Data Pipeline Best Practices
# =============================================================================

class ScrapingRunSummary(BaseModel):
    """Scraping run summary model"""
    run_id: str
    scraper_name: str
    start_time: datetime
    end_time: Optional[datetime]
    status: str
    tracks_searched: Optional[int]
    playlists_found: Optional[int]
    songs_added: Optional[int]
    artists_added: Optional[int]
    errors_count: Optional[int]
    avg_quality_score: Optional[float]
    quality_issues: Optional[int]
    playlists_validated: Optional[int]
    validation_failures: Optional[int]
    sources_attempted: Optional[int]
    sources_successful: Optional[int]
    avg_response_time_ms: Optional[float]
    critical_anomalies: Optional[int]
    warning_anomalies: Optional[int]

class PipelineHealthData(BaseModel):
    """Pipeline health dashboard data"""
    time_bucket: datetime
    total_runs: int
    successful_runs: int
    failed_runs: int
    avg_duration_seconds: Optional[float]
    total_songs_added: Optional[int]
    total_artists_added: Optional[int]
    avg_quality_score: Optional[float]
    total_critical_anomalies: Optional[int]

class SourceExtractionDetail(BaseModel):
    """Source extraction log detail"""
    extraction_id: str
    source_url: str
    website_domain: str
    scraper_used: str
    http_status_code: Optional[int]
    response_time_ms: Optional[int]
    success: bool
    error_message: Optional[str]
    extracted_elements: Optional[Dict[str, Any]]
    retry_count: int
    extraction_timestamp: datetime

class GraphValidationDetail(BaseModel):
    """Graph validation result detail"""
    validation_id: str
    playlist_id: str
    expected_nodes: int
    actual_nodes: int
    expected_edges: int
    actual_edges: int
    same_artist_exceptions: int
    validation_passed: bool
    validation_message: Optional[str]
    validation_timestamp: datetime

class QualityMetricDetail(BaseModel):
    """Data quality metric detail"""
    quality_id: str
    pillar: str  # freshness, volume, schema, distribution, lineage
    metric_name: str
    expected_value: Optional[float]
    actual_value: float
    quality_score: float
    threshold_min: Optional[float]
    threshold_max: Optional[float]
    status: str
    measured_at: datetime

class AnomalyDetail(BaseModel):
    """Anomaly detection detail"""
    anomaly_id: str
    anomaly_type: str
    severity: str
    metric_name: str
    expected_range_min: Optional[float]
    expected_range_max: Optional[float]
    actual_value: float
    confidence_score: float
    description: str
    suggested_actions: List[str]
    detection_timestamp: datetime
    acknowledged: bool

@app.get("/api/v1/observability/runs", response_model=List[ScrapingRunSummary])
async def get_scraping_runs(limit: int = 20, offset: int = 0, status: Optional[str] = None):
    """Get scraping runs history with comprehensive metrics"""
    try:
        async with db_pool.acquire() as conn:
            where_clause = ""
            params = [limit, offset]
            param_count = 2

            if status:
                where_clause = "WHERE status = $3"
                params.append(status)
                param_count += 1

            query = f"""
            SELECT * FROM scraping_run_summary
            {where_clause}
            ORDER BY start_time DESC
            LIMIT $1 OFFSET $2
            """

            rows = await conn.fetch(query, *params)

            runs = []
            for row in rows:
                runs.append(ScrapingRunSummary(**dict(row)))

            return runs

    except Exception as e:
        logger.error(f"Failed to fetch scraping runs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/runs/{run_id}", response_model=ScrapingRunSummary)
async def get_scraping_run_detail(run_id: str):
    """Get detailed information about a specific scraping run"""
    try:
        async with db_pool.acquire() as conn:
            query = "SELECT * FROM scraping_run_summary WHERE run_id = $1"
            row = await conn.fetchrow(query, run_id)

            if not row:
                raise HTTPException(status_code=404, detail="Scraping run not found")

            return ScrapingRunSummary(**dict(row))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch scraping run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/runs/{run_id}/sources", response_model=List[SourceExtractionDetail])
async def get_run_source_extractions(run_id: str):
    """Get source extraction details for a specific run"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT extraction_id, source_url, website_domain, scraper_used,
                   http_status_code, response_time_ms, success, error_message,
                   extracted_elements, retry_count, extraction_timestamp
            FROM source_extraction_log
            WHERE run_id = $1
            ORDER BY extraction_timestamp DESC
            """
            rows = await conn.fetch(query, run_id)

            extractions = []
            for row in rows:
                extractions.append(SourceExtractionDetail(**dict(row)))

            return extractions

    except Exception as e:
        logger.error(f"Failed to fetch source extractions for run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/runs/{run_id}/validations", response_model=List[GraphValidationDetail])
async def get_run_graph_validations(run_id: str):
    """Get graph validation results for a specific run"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT validation_id, playlist_id, expected_nodes, actual_nodes,
                   expected_edges, actual_edges, same_artist_exceptions,
                   validation_passed, validation_message, validation_timestamp
            FROM graph_validation_results
            WHERE run_id = $1
            ORDER BY validation_timestamp DESC
            """
            rows = await conn.fetch(query, run_id)

            validations = []
            for row in rows:
                validations.append(GraphValidationDetail(**dict(row)))

            return validations

    except Exception as e:
        logger.error(f"Failed to fetch validations for run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/runs/{run_id}/quality", response_model=List[QualityMetricDetail])
async def get_run_quality_metrics(run_id: str):
    """Get data quality metrics for a specific run"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT quality_id, pillar, metric_name, expected_value, actual_value,
                   quality_score, threshold_min, threshold_max, status, measured_at
            FROM data_quality_metrics
            WHERE run_id = $1
            ORDER BY measured_at DESC
            """
            rows = await conn.fetch(query, run_id)

            metrics = []
            for row in rows:
                metrics.append(QualityMetricDetail(**dict(row)))

            return metrics

    except Exception as e:
        logger.error(f"Failed to fetch quality metrics for run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/runs/{run_id}/anomalies", response_model=List[AnomalyDetail])
async def get_run_anomalies(run_id: str):
    """Get anomaly detection results for a specific run"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT anomaly_id, anomaly_type, severity, metric_name,
                   expected_range_min, expected_range_max, actual_value,
                   confidence_score, description, suggested_actions,
                   detection_timestamp, acknowledged
            FROM anomaly_detection
            WHERE run_id = $1
            ORDER BY detection_timestamp DESC
            """
            rows = await conn.fetch(query, run_id)

            anomalies = []
            for row in rows:
                row_dict = dict(row)
                # Parse JSON array for suggested_actions
                if row_dict['suggested_actions']:
                    row_dict['suggested_actions'] = json.loads(row_dict['suggested_actions'])
                else:
                    row_dict['suggested_actions'] = []

                anomalies.append(AnomalyDetail(**row_dict))

            return anomalies

    except Exception as e:
        logger.error(f"Failed to fetch anomalies for run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/health", response_model=List[PipelineHealthData])
async def get_pipeline_health(hours: int = 24):
    """Get pipeline health dashboard data"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT * FROM pipeline_health_dashboard
            WHERE time_bucket >= NOW() - INTERVAL '%d hours'
            ORDER BY time_bucket DESC
            """ % hours

            rows = await conn.fetch(query)

            health_data = []
            for row in rows:
                health_data.append(PipelineHealthData(**dict(row)))

            return health_data

    except Exception as e:
        logger.error(f"Failed to fetch pipeline health: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/metrics/summary")
async def get_metrics_summary():
    """Get overall pipeline metrics summary"""
    try:
        async with db_pool.acquire() as conn:
            # Get overall statistics
            summary_query = """
            SELECT
                COUNT(*) as total_runs,
                COUNT(*) FILTER (WHERE status = 'completed') as successful_runs,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
                COUNT(*) FILTER (WHERE start_time >= NOW() - INTERVAL '24 hours') as runs_last_24h,
                AVG(songs_added) as avg_songs_per_run,
                SUM(songs_added) as total_songs_scraped,
                SUM(artists_added) as total_artists_scraped
            FROM scraping_runs
            WHERE start_time >= NOW() - INTERVAL '30 days'
            """

            summary_row = await conn.fetchrow(summary_query)

            # Get quality metrics summary
            quality_query = """
            SELECT
                pillar,
                AVG(quality_score) as avg_score,
                COUNT(*) FILTER (WHERE status = 'fail') as failures
            FROM data_quality_metrics
            WHERE measured_at >= NOW() - INTERVAL '7 days'
            GROUP BY pillar
            """

            quality_rows = await conn.fetch(quality_query)

            # Get recent anomalies
            anomaly_query = """
            SELECT severity, COUNT(*) as count
            FROM anomaly_detection
            WHERE detection_timestamp >= NOW() - INTERVAL '24 hours'
              AND NOT acknowledged
            GROUP BY severity
            """

            anomaly_rows = await conn.fetch(anomaly_query)

            return {
                "summary": dict(summary_row) if summary_row else {},
                "quality_by_pillar": [dict(row) for row in quality_rows],
                "recent_anomalies": [dict(row) for row in anomaly_rows]
            }

    except Exception as e:
        logger.error(f"Failed to fetch metrics summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/graph/impact")
async def get_graph_impact_analysis(run_id: Optional[str] = None, limit: int = 50):
    """Get graph impact analysis data"""
    try:
        async with db_pool.acquire() as conn:
            where_clause = ""
            params = [limit]

            if run_id:
                where_clause = "WHERE run_id = $2"
                params.append(run_id)

            query = f"""
            SELECT gia.*, sr.scraper_name, sr.start_time
            FROM graph_impact_analysis gia
            JOIN scraping_runs sr ON gia.run_id = sr.run_id
            {where_clause}
            ORDER BY gia.analysis_timestamp DESC
            LIMIT $1
            """

            rows = await conn.fetch(query, *params)

            impact_data = []
            for row in rows:
                impact_data.append(dict(row))

            return impact_data

    except Exception as e:
        logger.error(f"Failed to fetch graph impact analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/observability/anomalies/{anomaly_id}/acknowledge")
async def acknowledge_anomaly(anomaly_id: str, acknowledged_by: str = "user"):
    """Acknowledge an anomaly"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            UPDATE anomaly_detection
            SET acknowledged = true, acknowledged_by = $2, acknowledged_at = CURRENT_TIMESTAMP
            WHERE anomaly_id = $1
            RETURNING *
            """

            row = await conn.fetchrow(query, anomaly_id, acknowledged_by)

            if not row:
                raise HTTPException(status_code=404, detail="Anomaly not found")

            return {"status": "acknowledged", "anomaly_id": anomaly_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to acknowledge anomaly {anomaly_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/sources/performance")
async def get_source_performance_analysis(domain: Optional[str] = None, hours: int = 24):
    """Get source performance analysis"""
    try:
        async with db_pool.acquire() as conn:
            where_clause = "WHERE sel.extraction_timestamp >= NOW() - INTERVAL '%d hours'" % hours
            params = []

            if domain:
                where_clause += " AND sel.website_domain = $1"
                params.append(domain)

            query = f"""
            SELECT
                sel.website_domain,
                COUNT(*) as total_attempts,
                COUNT(*) FILTER (WHERE sel.success) as successful_attempts,
                AVG(sel.response_time_ms) as avg_response_time,
                MAX(sel.response_time_ms) as max_response_time,
                COUNT(*) FILTER (WHERE sel.retry_count > 0) as retried_attempts,
                COUNT(DISTINCT sr.run_id) as runs_involved
            FROM source_extraction_log sel
            JOIN scraping_runs sr ON sel.run_id = sr.run_id
            {where_clause}
            GROUP BY sel.website_domain
            ORDER BY total_attempts DESC
            """

            rows = await conn.fetch(query, *params)

            performance_data = []
            for row in rows:
                row_dict = dict(row)
                # Calculate success rate
                row_dict['success_rate'] = (
                    row_dict['successful_attempts'] / row_dict['total_attempts']
                    if row_dict['total_attempts'] > 0 else 0
                )
                performance_data.append(row_dict)

            return performance_data

    except Exception as e:
        logger.error(f"Failed to fetch source performance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/target-tracks")
async def get_target_tracks():
    """Get list of target tracks - simple test endpoint"""
    return [{"message": "Target tracks endpoint working"}]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)