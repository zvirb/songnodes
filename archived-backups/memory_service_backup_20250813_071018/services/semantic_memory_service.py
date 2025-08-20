"""
Semantic Memory Service (Step 3)
Stores semantic representations in Qdrant vector database
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Dict, List, Any, Optional

import aiohttp
from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import Distance, VectorParams, PointStruct

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SemanticMemoryService:
    """
    Service for storing and retrieving semantic memory using Qdrant vector database
    Handles text embedding, vector storage, and similarity search
    """
    
    def __init__(self):
        self.qdrant_url = settings.QDRANT_URL
        self.qdrant_api_key = settings.get_qdrant_api_key()
        self.collection_name = settings.QDRANT_COLLECTION_NAME
        self.ollama_url = settings.OLLAMA_URL.rstrip("/")
        self.embeddings_model = settings.OLLAMA_MODEL_EMBEDDINGS
        
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Qdrant client"""
        try:
            self.client = AsyncQdrantClient(
                url=self.qdrant_url,
                api_key=self.qdrant_api_key
            )
            logger.info(f"Qdrant client initialized for {self.qdrant_url}")
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant client: {e}")
            self.client = None
    
    async def initialize_collection(self):
        """Initialize Qdrant collection if it doesn't exist"""
        if not self.client:
            self._initialize_client()
            if not self.client:
                raise RuntimeError("Qdrant client not available")
        
        try:
            # Check if collection exists
            collections = await self.client.get_collections()
            collection_names = [col.name for col in collections.collections]
            
            if self.collection_name not in collection_names:
                # Create collection with appropriate vector size for embeddings
                await self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=768,  # nomic-embed-text embedding size
                        distance=Distance.COSINE
                    )
                )
                logger.info(f"Created Qdrant collection: {self.collection_name}")
            else:
                logger.info(f"Qdrant collection already exists: {self.collection_name}")
                
        except Exception as e:
            logger.error(f"Failed to initialize collection: {e}")
            raise
    
    async def store_semantic_memory(
        self,
        content: str,
        extraction_result: Dict[str, Any],
        user_id: int
    ) -> Dict[str, Any]:
        """
        Store semantic memory in Qdrant vector database
        
        Args:
            content: Original text content
            extraction_result: Results from langextract processing
            user_id: User ID for data isolation
            
        Returns:
            Dict with storage statistics and metadata
        """
        if not self.client:
            await self.initialize_collection()
        
        try:
            # Chunk content for semantic storage
            chunks = await self._chunk_content(content, extraction_result)
            
            # Generate embeddings for chunks
            chunk_embeddings = []
            for chunk in chunks:
                embedding = await self._generate_embedding(chunk["text"])
                chunk_embeddings.append({
                    "chunk": chunk,
                    "embedding": embedding
                })
            
            # Store chunks in Qdrant
            points = []
            for i, chunk_data in enumerate(chunk_embeddings):
                chunk = chunk_data["chunk"]
                embedding = chunk_data["embedding"]
                
                # Create unique point ID
                content_hash = hashlib.sha256(chunk["text"].encode()).hexdigest()
                point_id = f"user_{user_id}_{content_hash[:16]}"
                
                # Create metadata payload
                payload = {
                    "user_id": user_id,
                    "text": chunk["text"],
                    "chunk_index": i,
                    "chunk_type": chunk["type"],
                    "entities": chunk.get("entities", []),
                    "entity_types": chunk.get("entity_types", []),
                    "content_hash": content_hash,
                    "timestamp": int(time.time()),
                    "metadata": chunk.get("metadata", {}),
                    "original_length": len(content)
                }
                
                points.append(PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload
                ))
            
            # Batch insert points
            if points:
                await self.client.upsert(
                    collection_name=self.collection_name,
                    points=points
                )
            
            result = {
                "chunks_stored": len(points),
                "total_points": len(points),
                "collection_name": self.collection_name,
                "embeddings_model": self.embeddings_model
            }
            
            logger.info(f"Stored {len(points)} semantic chunks for user {user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to store semantic memory: {e}")
            raise
    
    async def _chunk_content(
        self,
        content: str,
        extraction_result: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Chunk content for semantic storage, considering extracted entities
        """
        chunks = []
        
        # Simple sentence-based chunking with entity awareness
        sentences = self._split_into_sentences(content)
        entities = extraction_result.get("entities", [])
        
        # Create entity name mapping for quick lookup
        entity_names = {entity.get("name", "").lower(): entity for entity in entities}
        
        current_chunk = ""
        current_entities = []
        current_entity_types = set()
        
        for sentence in sentences:
            # Check if adding this sentence would exceed chunk size
            if len(current_chunk + " " + sentence) > 500 and current_chunk:
                # Save current chunk
                chunks.append({
                    "text": current_chunk.strip(),
                    "type": "semantic_chunk",
                    "entities": current_entities,
                    "entity_types": list(current_entity_types),
                    "metadata": {"sentence_count": len(current_chunk.split("."))}
                })
                
                # Reset for next chunk
                current_chunk = sentence
                current_entities = []
                current_entity_types = set()
            else:
                current_chunk += " " + sentence if current_chunk else sentence
            
            # Find entities mentioned in this sentence
            sentence_lower = sentence.lower()
            for entity_name, entity in entity_names.items():
                if entity_name in sentence_lower:
                    if entity not in current_entities:
                        current_entities.append(entity)
                        current_entity_types.add(entity.get("entity_type", "unknown"))
        
        # Add final chunk
        if current_chunk:
            chunks.append({
                "text": current_chunk.strip(),
                "type": "semantic_chunk",
                "entities": current_entities,
                "entity_types": list(current_entity_types),
                "metadata": {"sentence_count": len(current_chunk.split("."))}
            })
        
        # Also create entity-focused chunks
        for entity in entities:
            entity_name = entity.get("name", "")
            if not entity_name:
                continue
            
            # Find sentences mentioning this entity
            entity_sentences = [
                s for s in sentences 
                if entity_name.lower() in s.lower()
            ]
            
            if entity_sentences:
                entity_chunk = " ".join(entity_sentences[:3])  # Max 3 sentences per entity chunk
                chunks.append({
                    "text": entity_chunk,
                    "type": "entity_chunk",
                    "entities": [entity],
                    "entity_types": [entity.get("entity_type", "unknown")],
                    "metadata": {
                        "focus_entity": entity_name,
                        "entity_type": entity.get("entity_type"),
                        "sentence_count": len(entity_sentences)
                    }
                })
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Simple sentence splitting"""
        import re
        # Split on sentence endings, keeping the delimiter
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using Ollama embeddings model"""
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "model": self.embeddings_model,
                    "prompt": text
                }
                
                async with session.post(f"{self.ollama_url}/api/embeddings", json=payload) as response:
                    if response.status != 200:
                        raise RuntimeError(f"Ollama embeddings API error: {response.status}")
                    
                    result = await response.json()
                    embedding = result.get("embedding", [])
                    
                    if not embedding:
                        raise RuntimeError("Empty embedding returned from Ollama")
                    
                    return embedding
                    
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            # Return zero vector as fallback
            return [0.0] * 768
    
    async def semantic_search(
        self,
        query: str,
        user_id: int,
        limit: int = 10,
        threshold: float = 0.7,
        chunk_types: Optional[List[str]] = None,
        entity_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search using vector similarity
        
        Args:
            query: Search query text
            user_id: User ID for data isolation
            limit: Maximum number of results
            threshold: Minimum similarity threshold
            chunk_types: Filter by chunk types (semantic_chunk, entity_chunk)
            entity_types: Filter by entity types
            
        Returns:
            List of search results with similarity scores
        """
        if not self.client:
            await self.initialize_collection()
        
        try:
            # Generate query embedding
            query_embedding = await self._generate_embedding(query)
            
            # Build search filter
            search_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="user_id",
                        match=models.MatchValue(value=user_id)
                    )
                ]
            )
            
            # Add optional filters
            if chunk_types:
                search_filter.must.append(
                    models.FieldCondition(
                        key="chunk_type",
                        match=models.MatchAny(any=chunk_types)
                    )
                )
            
            if entity_types:
                search_filter.must.append(
                    models.FieldCondition(
                        key="entity_types",
                        match=models.MatchAny(any=entity_types)
                    )
                )
            
            # Perform vector search
            search_result = await self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=search_filter,
                limit=limit,
                score_threshold=threshold,
                with_payload=True,
                with_vectors=False
            )
            
            # Format results
            results = []
            for hit in search_result:
                results.append({
                    "content": hit.payload.get("text", ""),
                    "score": float(hit.score),
                    "metadata": {
                        "chunk_type": hit.payload.get("chunk_type"),
                        "entities": hit.payload.get("entities", []),
                        "entity_types": hit.payload.get("entity_types", []),
                        "chunk_index": hit.payload.get("chunk_index"),
                        "timestamp": hit.payload.get("timestamp"),
                        "content_hash": hit.payload.get("content_hash"),
                        "original_length": hit.payload.get("original_length")
                    },
                    "qdrant_point_id": str(hit.id)
                })
            
            logger.info(f"Semantic search returned {len(results)} results for user {user_id}")
            return results
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            raise
    
    async def get_similar_chunks(
        self,
        point_id: str,
        user_id: int,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find chunks similar to a specific point
        """
        if not self.client:
            await self.initialize_collection()
        
        try:
            # Get the point to use its vector for similarity search
            points = await self.client.retrieve(
                collection_name=self.collection_name,
                ids=[point_id],
                with_vectors=True
            )
            
            if not points:
                return []
            
            point_vector = points[0].vector
            
            # Search for similar vectors
            search_result = await self.client.search(
                collection_name=self.collection_name,
                query_vector=point_vector,
                query_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="user_id",
                            match=models.MatchValue(value=user_id)
                        )
                    ],
                    must_not=[
                        models.FieldCondition(
                            key="id",
                            match=models.MatchValue(value=point_id)
                        )
                    ]
                ),
                limit=limit,
                with_payload=True
            )
            
            # Format results
            results = []
            for hit in search_result:
                results.append({
                    "content": hit.payload.get("text", ""),
                    "score": float(hit.score),
                    "metadata": hit.payload.get("metadata", {}),
                    "qdrant_point_id": str(hit.id)
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to get similar chunks: {e}")
            raise
    
    async def delete_user_memory(self, user_id: int) -> Dict[str, Any]:
        """Delete all semantic memory for a specific user"""
        if not self.client:
            await self.initialize_collection()
        
        try:
            # Delete all points for this user
            await self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="user_id",
                            match=models.MatchValue(value=user_id)
                        )
                    ]
                )
            )
            
            return {"status": "success", "message": f"Deleted all semantic memory for user {user_id}"}
            
        except Exception as e:
            logger.error(f"Failed to delete user memory: {e}")
            raise
    
    async def get_memory_statistics(self, user_id: int) -> Dict[str, Any]:
        """Get statistics about user's semantic memory"""
        if not self.client:
            await self.initialize_collection()
        
        try:
            # Count total points for user
            search_result = await self.client.search(
                collection_name=self.collection_name,
                query_vector=[0.0] * 768,  # Dummy vector
                query_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="user_id",
                            match=models.MatchValue(value=user_id)
                        )
                    ]
                ),
                limit=0  # Just get count
            )
            
            # Get collection info
            collection_info = await self.client.get_collection(self.collection_name)
            
            return {
                "user_chunks": len(search_result),
                "collection_name": self.collection_name,
                "total_points": collection_info.points_count,
                "vector_size": collection_info.config.params.vectors.size,
                "distance_metric": collection_info.config.params.vectors.distance.value
            }
            
        except Exception as e:
            logger.error(f"Failed to get memory statistics: {e}")
            raise