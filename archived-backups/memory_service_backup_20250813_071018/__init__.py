"""
Memory Service - Hybrid Long-term and Short-term Memory Management

This service implements a comprehensive memory architecture that combines:
1. Structured knowledge graph storage (PostgreSQL)
2. Semantic vector memory (Qdrant) 
3. LLM-powered memory curation and reasoning
4. langextract integration for entity extraction

Architecture:
- 4-Step Ingestion Pipeline: langextract → graph → semantic → curated
- Hybrid retrieval combining structured and semantic search
- Memory reconciliation using llama-3-8b-instruct
- Real-time processing with WebSocket support
"""

__version__ = "1.0.0"
__author__ = "AI Workflow Engine Team"

from .main import app
from .models import GraphNode, GraphEdge, MemoryRecord
from .services import (
    LangExtractService,
    KnowledgeGraphService, 
    SemanticMemoryService,
    MemoryCurationService
)

__all__ = [
    "app",
    "GraphNode", 
    "GraphEdge",
    "MemoryRecord",
    "LangExtractService",
    "KnowledgeGraphService",
    "SemanticMemoryService", 
    "MemoryCurationService"
]