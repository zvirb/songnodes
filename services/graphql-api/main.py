"""GraphQL API Service for SongNodes"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import strawberry
from strawberry.asgi import GraphQL
from typing import List, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "graphql-api",
        "version": "1.0.0"
    }

# Mount GraphQL app
graphql_app = GraphQL(schema)
app.add_route("/graphql", graphql_app)
app.add_websocket_route("/graphql", graphql_app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)