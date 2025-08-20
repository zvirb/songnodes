"""
Memory Service Main Application
FastAPI microservice for hybrid memory & knowledge graph management
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from .config import get_settings
from .database import init_database, get_db_session
from .services import (
    LangExtractService,
    KnowledgeGraphService,
    SemanticMemoryService,
    MemoryCurationService,
    HybridRetrievalService,
    AuthenticationService
)
from .models import DocumentProcessingRequest, HybridQueryRequest, ProcessingStatus
from .websocket_manager import WebSocketManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

# Initialize services as global variables (will be set during startup)
langextract_service: Optional[LangExtractService] = None
knowledge_graph_service: Optional[KnowledgeGraphService] = None
semantic_memory_service: Optional[SemanticMemoryService] = None
memory_curation_service: Optional[MemoryCurationService] = None
hybrid_retrieval_service: Optional[HybridRetrievalService] = None
auth_service: Optional[AuthenticationService] = None

# WebSocket manager for real-time processing updates
websocket_manager = WebSocketManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown"""
    # Startup
    logger.info("Starting Memory Service...")
    
    try:
        # Initialize database
        await init_database()
        logger.info("Database initialized successfully")
        
        # Initialize services
        global langextract_service, knowledge_graph_service, semantic_memory_service
        global memory_curation_service, hybrid_retrieval_service, auth_service
        
        langextract_service = LangExtractService()
        knowledge_graph_service = KnowledgeGraphService()
        semantic_memory_service = SemanticMemoryService()
        memory_curation_service = MemoryCurationService()
        hybrid_retrieval_service = HybridRetrievalService(
            knowledge_graph_service, semantic_memory_service
        )
        auth_service = AuthenticationService()
        
        logger.info("All services initialized successfully")
        logger.info(f"Memory Service started on port {settings.PORT}")
        
    except Exception as e:
        logger.error(f"Failed to initialize Memory Service: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Memory Service...")


# Create FastAPI app with lifespan management
app = FastAPI(
    title="AI Workflow Engine - Memory Service",
    description="Hybrid memory & knowledge graph microservice with langextract integration",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://aiwfe.com", "http://aiwfe.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security scheme
security = HTTPBearer()


# Dependency to get current user from JWT token
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Validate JWT token and return user information"""
    if not auth_service:
        raise HTTPException(status_code=503, detail="Authentication service not initialized")
    
    try:
        user = await auth_service.validate_token(credentials.credentials)
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    services_status = {
        "langextract_service": langextract_service is not None,
        "knowledge_graph_service": knowledge_graph_service is not None, 
        "semantic_memory_service": semantic_memory_service is not None,
        "memory_curation_service": memory_curation_service is not None,
        "hybrid_retrieval_service": hybrid_retrieval_service is not None,
        "auth_service": auth_service is not None
    }
    
    all_healthy = all(services_status.values())
    
    return {
        "status": "healthy" if all_healthy else "unhealthy",
        "services": services_status,
        "version": "1.0.0"
    }


# Document processing endpoint (4-step pipeline)
@app.post("/process_document")
async def process_document(
    request: DocumentProcessingRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Process unstructured text through 4-step pipeline:
    1. langextract: Extract entities and relationships 
    2. Knowledge graph: Populate graph_nodes and graph_edges
    3. Semantic memory: Store in Qdrant vector database
    4. Memory curation: LLM-powered ADD/UPDATE/DELETE/NOOP decisions
    """
    if not all([langextract_service, knowledge_graph_service, 
                semantic_memory_service, memory_curation_service]):
        raise HTTPException(status_code=503, detail="Services not fully initialized")
    
    # Generate processing ID
    processing_id = f"proc_{current_user['user_id']}_{int(asyncio.get_event_loop().time())}"
    
    # Start background processing
    background_tasks.add_task(
        _process_document_pipeline,
        processing_id,
        request,
        current_user
    )
    
    return {
        "processing_id": processing_id,
        "status": "started",
        "message": "Document processing started in background"
    }


async def _process_document_pipeline(
    processing_id: str,
    request: DocumentProcessingRequest,
    user: Dict[str, Any]
):
    """Execute the complete 4-step document processing pipeline"""
    try:
        # Broadcast processing start
        await websocket_manager.broadcast_processing_status(
            processing_id, ProcessingStatus.STARTED, "Starting document processing pipeline"
        )
        
        # Step 1: langextract - Extract entities and relationships
        await websocket_manager.broadcast_processing_status(
            processing_id, ProcessingStatus.STEP_1, "Extracting entities with langextract"
        )
        
        extraction_result = await langextract_service.extract_entities(
            request.content, 
            request.document_metadata or {}
        )
        
        # Step 2: Knowledge Graph Population
        await websocket_manager.broadcast_processing_status(
            processing_id, ProcessingStatus.STEP_2, "Populating knowledge graph"
        )
        
        graph_result = await knowledge_graph_service.update_knowledge_graph(
            extraction_result, 
            user['user_id']
        )
        
        # Step 3: Semantic Memory Storage
        await websocket_manager.broadcast_processing_status(
            processing_id, ProcessingStatus.STEP_3, "Storing semantic memory"
        )
        
        semantic_result = await semantic_memory_service.store_semantic_memory(
            request.content,
            extraction_result,
            user['user_id']
        )
        
        # Step 4: Memory Curation
        await websocket_manager.broadcast_processing_status(
            processing_id, ProcessingStatus.STEP_4, "Curating memory with LLM"
        )
        
        curation_result = await memory_curation_service.curate_memory(
            extraction_result,
            semantic_result,
            user['user_id']
        )
        
        # Broadcast completion
        await websocket_manager.broadcast_processing_status(
            processing_id, 
            ProcessingStatus.COMPLETED, 
            "Document processing completed successfully",
            {
                "entities_extracted": len(extraction_result.get("entities", [])),
                "relationships_found": len(extraction_result.get("relationships", [])),
                "graph_nodes_updated": graph_result.get("nodes_updated", 0),
                "graph_edges_updated": graph_result.get("edges_updated", 0),
                "semantic_chunks_stored": semantic_result.get("chunks_stored", 0),
                "memory_operations": curation_result.get("operations", [])
            }
        )
        
    except Exception as e:
        logger.error(f"Document processing pipeline failed: {e}")
        await websocket_manager.broadcast_processing_status(
            processing_id, 
            ProcessingStatus.FAILED, 
            f"Processing failed: {str(e)}"
        )


# Hybrid retrieval endpoint
@app.post("/hybrid_search")
async def hybrid_search(
    request: HybridQueryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Perform hybrid search combining:
    - Structured queries on knowledge graph (PostgreSQL)
    - Semantic similarity search (Qdrant)
    - LLM-powered result synthesis
    """
    if not hybrid_retrieval_service:
        raise HTTPException(status_code=503, detail="Hybrid retrieval service not initialized")
    
    try:
        results = await hybrid_retrieval_service.hybrid_search(
            query=request.query,
            user_id=current_user['user_id'],
            search_type=request.search_type,
            limit=request.limit,
            filters=request.filters or {}
        )
        
        return {
            "results": results,
            "query": request.query,
            "search_type": request.search_type,
            "total_results": len(results)
        }
        
    except Exception as e:
        logger.error(f"Hybrid search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


# Processing status endpoint
@app.get("/processing_status/{processing_id}")
async def get_processing_status(
    processing_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get status of document processing job"""
    # Implementation would check database for processing status
    # For now, return a placeholder
    return {
        "processing_id": processing_id,
        "status": "completed",
        "message": "Processing status retrieved"
    }


# WebSocket endpoint for real-time processing updates
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    """WebSocket connection for real-time processing updates"""
    await websocket_manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive and handle any incoming messages
            data = await websocket.receive_text()
            # Echo back for now - could implement commands later
            await websocket.send_text(f"Received: {data}")
    except WebSocketDisconnect:
        websocket_manager.disconnect(user_id)


# Knowledge graph endpoints
@app.get("/knowledge_graph/entities")
async def get_entities(
    entity_type: Optional[str] = None,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get knowledge graph entities for user"""
    if not knowledge_graph_service:
        raise HTTPException(status_code=503, detail="Knowledge graph service not initialized")
    
    try:
        entities = await knowledge_graph_service.get_entities(
            user_id=current_user['user_id'],
            entity_type=entity_type,
            limit=limit
        )
        return {"entities": entities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/knowledge_graph/relationships")
async def get_relationships(
    source_entity: Optional[str] = None,
    target_entity: Optional[str] = None,
    relationship_type: Optional[str] = None,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get knowledge graph relationships for user"""
    if not knowledge_graph_service:
        raise HTTPException(status_code=503, detail="Knowledge graph service not initialized")
    
    try:
        relationships = await knowledge_graph_service.get_relationships(
            user_id=current_user['user_id'],
            source_entity=source_entity,
            target_entity=target_entity,
            relationship_type=relationship_type,
            limit=limit
        )
        return {"relationships": relationships}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Semantic memory endpoints  
@app.get("/semantic_memory/search")
async def semantic_search(
    query: str,
    limit: int = 10,
    threshold: float = 0.7,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Search semantic memory using vector similarity"""
    if not semantic_memory_service:
        raise HTTPException(status_code=503, detail="Semantic memory service not initialized")
    
    try:
        results = await semantic_memory_service.semantic_search(
            query=query,
            user_id=current_user['user_id'],
            limit=limit,
            threshold=threshold
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG
    )