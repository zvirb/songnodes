"""
Memory Service Data Models
Pydantic models for API requests/responses and database entities
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Integer, Text, JSON, DateTime, Float, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID as PostgreSQL_UUID
from sqlalchemy.sql import func

Base = declarative_base()


# Processing Status Enum
class ProcessingStatus(str, Enum):
    STARTED = "started"
    STEP_1 = "langextract_processing"
    STEP_2 = "graph_population" 
    STEP_3 = "semantic_storage"
    STEP_4 = "memory_curation"
    COMPLETED = "completed"
    FAILED = "failed"


# Search Type Enum
class SearchType(str, Enum):
    SEMANTIC = "semantic"
    STRUCTURED = "structured"
    HYBRID = "hybrid"


# Memory Operation Types
class MemoryOperation(str, Enum):
    ADD = "add"
    UPDATE = "update"
    DELETE = "delete"
    NOOP = "noop"


# =============================================================================
# DATABASE MODELS (SQLAlchemy ORM)
# =============================================================================

class GraphNode(Base):
    """
    Knowledge Graph Node Entity
    Stores extracted entities with their properties
    """
    __tablename__ = "graph_nodes"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(String(255), unique=True, nullable=False, index=True)
    entity_type = Column(String(100), nullable=False, index=True)
    properties = Column(JSON, nullable=False, default={})
    user_id = Column(Integer, nullable=False, index=True)
    confidence_score = Column(Float, default=0.0)
    source_document = Column(String(255))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Indexes for performance
    __table_args__ = (
        Index("idx_graph_nodes_user_type", "user_id", "entity_type"),
        Index("idx_graph_nodes_entity_user", "entity_id", "user_id"),
    )


class GraphEdge(Base):
    """
    Knowledge Graph Relationship Edge
    Stores relationships between entities
    """
    __tablename__ = "graph_edges"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_entity_id = Column(String(255), nullable=False, index=True)
    target_entity_id = Column(String(255), nullable=False, index=True)
    relationship_type = Column(String(100), nullable=False, index=True)
    properties = Column(JSON, default={})
    user_id = Column(Integer, nullable=False, index=True)
    confidence_score = Column(Float, default=0.0)
    source_document = Column(String(255))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Indexes for performance  
    __table_args__ = (
        Index("idx_graph_edges_source_target", "source_entity_id", "target_entity_id"),
        Index("idx_graph_edges_user_type", "user_id", "relationship_type"),
        Index("idx_graph_edges_source_user", "source_entity_id", "user_id"),
        Index("idx_graph_edges_target_user", "target_entity_id", "user_id"),
    )


class MemoryRecord(Base):
    """
    Memory processing records for tracking curation decisions
    """
    __tablename__ = "memory_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    content_hash = Column(String(64), nullable=False, index=True)  # SHA-256 hash
    operation = Column(String(20), nullable=False)  # ADD, UPDATE, DELETE, NOOP
    reasoning = Column(Text)
    qdrant_point_id = Column(String(255))  # Qdrant vector ID
    metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=func.now())
    
    __table_args__ = (
        Index("idx_memory_records_user_hash", "user_id", "content_hash"),
    )


class ProcessingJob(Base):
    """
    Document processing job status tracking
    """
    __tablename__ = "processing_jobs"
    
    id = Column(String(255), primary_key=True)  # processing_id
    user_id = Column(Integer, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="started")
    current_step = Column(String(100))
    progress_data = Column(JSON, default={})
    error_message = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime)


# =============================================================================
# API REQUEST/RESPONSE MODELS (Pydantic)
# =============================================================================

class DocumentProcessingRequest(BaseModel):
    """Request model for document processing"""
    content: str = Field(..., description="Text content to process")
    document_metadata: Optional[Dict[str, Any]] = Field(default={}, description="Additional document metadata")
    processing_options: Optional[Dict[str, Any]] = Field(default={}, description="Processing configuration options")
    
    class Config:
        schema_extra = {
            "example": {
                "content": "John Smith works as a software engineer at TechCorp. He specializes in machine learning and has published several papers on neural networks.",
                "document_metadata": {
                    "source": "employee_profile",
                    "document_id": "emp_12345",
                    "timestamp": "2025-08-09T12:00:00Z"
                },
                "processing_options": {
                    "extract_relationships": True,
                    "enable_curation": True
                }
            }
        }


class HybridQueryRequest(BaseModel):
    """Request model for hybrid search queries"""
    query: str = Field(..., description="Search query text")
    search_type: SearchType = Field(default=SearchType.HYBRID, description="Type of search to perform")
    limit: int = Field(default=10, ge=1, le=100, description="Maximum number of results")
    filters: Optional[Dict[str, Any]] = Field(default={}, description="Additional search filters")
    
    class Config:
        schema_extra = {
            "example": {
                "query": "machine learning projects by John Smith",
                "search_type": "hybrid",
                "limit": 10,
                "filters": {
                    "entity_type": "person",
                    "date_range": {
                        "start": "2024-01-01",
                        "end": "2025-12-31"
                    }
                }
            }
        }


class EntityResponse(BaseModel):
    """Response model for knowledge graph entities"""
    entity_id: str
    entity_type: str
    properties: Dict[str, Any]
    confidence_score: float
    source_document: Optional[str]
    created_at: datetime
    updated_at: datetime


class RelationshipResponse(BaseModel):
    """Response model for knowledge graph relationships"""
    source_entity_id: str
    target_entity_id: str
    relationship_type: str
    properties: Dict[str, Any]
    confidence_score: float
    source_document: Optional[str]
    created_at: datetime
    updated_at: datetime


class SemanticSearchResult(BaseModel):
    """Result from semantic search"""
    content: str
    score: float
    metadata: Dict[str, Any]
    qdrant_point_id: str


class HybridSearchResult(BaseModel):
    """Combined result from hybrid search"""
    content: str
    score: float
    source: str  # "semantic", "structured", or "combined"
    entities: List[EntityResponse] = []
    relationships: List[RelationshipResponse] = []
    semantic_metadata: Optional[Dict[str, Any]] = None


class ProcessingStatusResponse(BaseModel):
    """Response model for processing status"""
    processing_id: str
    status: ProcessingStatus
    current_step: Optional[str]
    progress_data: Dict[str, Any] = {}
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]


class LangExtractResult(BaseModel):
    """Results from langextract processing"""
    entities: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    processing_time_ms: int


class MemoryCurationDecision(BaseModel):
    """Memory curation decision from LLM"""
    operation: MemoryOperation
    reasoning: str
    content_hash: str
    metadata: Dict[str, Any] = {}


class WebSocketMessage(BaseModel):
    """WebSocket message format"""
    type: str  # "processing_status", "error", "completion"
    processing_id: Optional[str]
    status: Optional[ProcessingStatus]
    message: str
    data: Optional[Dict[str, Any]] = {}
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# UTILITY MODELS
# =============================================================================

class HealthStatus(BaseModel):
    """Health check response"""
    status: str  # "healthy" or "unhealthy"
    services: Dict[str, bool]
    version: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorResponse(BaseModel):
    """Standardized error response"""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)