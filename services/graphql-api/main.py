"""GraphQL API Service for SongNodes"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import strawberry
from strawberry.asgi import GraphQL
from typing import List, Optional
import logging
import sys
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import secrets manager for unified credential management
try:
    sys.path.insert(0, '/app/common')
    from secrets_manager import get_database_config, get_redis_config, get_rabbitmq_config, validate_secrets
    logger.info("✅ Secrets manager imported successfully")
except ImportError as e:
    logger.error(f"❌ Failed to import secrets_manager: {e}")
    logger.warning("Falling back to environment variables")

# GraphQL Schema
@strawberry.type
class Artist:
    id: int
    name: str
    genre: Optional[str] = None
    popularity: Optional[float] = None

@strawberry.type
class Track:
    id: int
    title: str
    artist_id: int
    duration: Optional[int] = None
    bpm: Optional[float] = None

@strawberry.type
class Mix:
    id: int
    name: str
    dj_id: int
    venue: Optional[str] = None

@strawberry.type
class GraphNode:
    id: str
    label: str
    type: str
    size: int

@strawberry.type
class GraphLink:
    source: str
    target: str
    type: str

@strawberry.type
class Query:
    @strawberry.field
    def artists(self, limit: int = 100) -> List[Artist]:
        """Get list of artists"""
        return [
            Artist(id=1, name="Example Artist 1", genre="Electronic"),
            Artist(id=2, name="Example Artist 2", genre="House")
        ]
    
    @strawberry.field
    def artist(self, id: int) -> Optional[Artist]:
        """Get specific artist by ID"""
        return Artist(id=id, name=f"Artist {id}", genre="Electronic")
    
    @strawberry.field
    def tracks(self, artist_id: Optional[int] = None) -> List[Track]:
        """Get list of tracks"""
        tracks = [
            Track(id=1, title="Track 1", artist_id=1, bpm=128),
            Track(id=2, title="Track 2", artist_id=1, bpm=125)
        ]
        if artist_id:
            tracks = [t for t in tracks if t.artist_id == artist_id]
        return tracks
    
    @strawberry.field
    def mixes(self, dj_id: Optional[int] = None) -> List[Mix]:
        """Get list of mixes"""
        return [
            Mix(id=1, name="Summer Mix 2024", dj_id=1, venue="Club XYZ"),
            Mix(id=2, name="Festival Set", dj_id=2, venue="Festival ABC")
        ]
    
    @strawberry.field
    def graph_nodes(self) -> List[GraphNode]:
        """Get graph visualization nodes"""
        return [
            GraphNode(id="artist1", label="Artist 1", type="artist", size=30),
            GraphNode(id="artist2", label="Artist 2", type="artist", size=25),
            GraphNode(id="track1", label="Track 1", type="track", size=15)
        ]
    
    @strawberry.field
    def graph_links(self) -> List[GraphLink]:
        """Get graph visualization links"""
        return [
            GraphLink(source="artist1", target="track1", type="performed"),
            GraphLink(source="artist1", target="artist2", type="collaborated")
        ]

@strawberry.type
class Mutation:
    @strawberry.mutation
    def trigger_scrape(self, source: str = "1001tracklists") -> str:
        """Trigger web scraping job"""
        return f"Scraping job initiated for {source}"

# Create GraphQL schema
schema = strawberry.Schema(query=Query, mutation=Mutation)

# Create FastAPI app
app = FastAPI(
    title="SongNodes GraphQL API",
    description="GraphQL API for music data",
    version="1.0.0"
)

# CORS middleware - configurable for security
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3006').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint with comprehensive resource monitoring per CLAUDE.md Section 5.3.4.

    Monitors:
    - System memory (503 if > 85%)

    Returns health status with resource metrics.
    Raises 503 Service Unavailable if resource thresholds exceeded.
    """
    try:
        import psutil
        from fastapi import HTTPException

        # Check system memory
        memory_percent = psutil.virtual_memory().percent
        if memory_percent > 85:
            raise HTTPException(
                status_code=503,
                detail=f"Memory usage critical: {memory_percent:.1f}% (threshold: 85%)"
            )

        return {
            "status": "healthy",
            "service": "graphql-api",
            "version": "1.0.0",
            "checks": {
                "memory": {
                    "status": "ok",
                    "usage": memory_percent,
                    "threshold": 85
                }
            }
        }
    except HTTPException:
        # Re-raise 503 errors
        raise
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Health check failed: {str(e)}"
        )

# Mount GraphQL app
graphql_app = GraphQL(schema)
app.add_route("/graphql", graphql_app)
app.add_websocket_route("/graphql", graphql_app)

if __name__ == "__main__":
    # Validate secrets before starting service
    if not validate_secrets():
        logger.error("❌ Required secrets missing - exiting")
        sys.exit(1)

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)