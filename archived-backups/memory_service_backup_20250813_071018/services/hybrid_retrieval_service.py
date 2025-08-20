"""
Hybrid Retrieval Service
Combines structured knowledge graph queries with semantic vector search
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional

from ..models import SearchType

logger = logging.getLogger(__name__)


class HybridRetrievalService:
    """
    Service for hybrid retrieval combining structured and semantic search
    Provides unified interface for querying both knowledge graph and vector memory
    """
    
    def __init__(self, knowledge_graph_service, semantic_memory_service):
        self.kg_service = knowledge_graph_service
        self.semantic_service = semantic_memory_service
    
    async def hybrid_search(
        self,
        query: str,
        user_id: int,
        search_type: SearchType = SearchType.HYBRID,
        limit: int = 10,
        filters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid search combining structured and semantic approaches
        
        Args:
            query: Search query text
            user_id: User ID for data isolation
            search_type: Type of search to perform
            limit: Maximum number of results
            filters: Additional search filters
            
        Returns:
            List of unified search results
        """
        filters = filters or {}
        
        try:
            if search_type == SearchType.SEMANTIC:
                return await self._semantic_only_search(query, user_id, limit, filters)
            elif search_type == SearchType.STRUCTURED:
                return await self._structured_only_search(query, user_id, limit, filters)
            else:  # HYBRID
                return await self._hybrid_combined_search(query, user_id, limit, filters)
                
        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            raise
    
    async def _semantic_only_search(
        self,
        query: str,
        user_id: int,
        limit: int,
        filters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Perform semantic-only search"""
        try:
            # Extract semantic search parameters
            threshold = filters.get("similarity_threshold", 0.7)
            chunk_types = filters.get("chunk_types")
            entity_types = filters.get("entity_types")
            
            # Perform semantic search
            semantic_results = await self.semantic_service.semantic_search(
                query=query,
                user_id=user_id,
                limit=limit,
                threshold=threshold,
                chunk_types=chunk_types,
                entity_types=entity_types
            )
            
            # Convert to unified format
            unified_results = []
            for result in semantic_results:
                unified_results.append({
                    "content": result["content"],
                    "score": result["score"],
                    "source": "semantic",
                    "entities": [],
                    "relationships": [],
                    "semantic_metadata": result["metadata"],
                    "result_type": "semantic_chunk"
                })
            
            return unified_results
            
        except Exception as e:
            logger.error(f"Semantic-only search failed: {e}")
            raise
    
    async def _structured_only_search(
        self,
        query: str,
        user_id: int,
        limit: int,
        filters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Perform structured-only search on knowledge graph"""
        try:
            unified_results = []
            
            # Search entities by properties (text-based search)
            entity_filters = self._extract_entity_filters(query, filters)
            if entity_filters:
                entities = await self.kg_service.search_entities_by_properties(
                    user_id=user_id,
                    property_filters=entity_filters,
                    entity_types=filters.get("entity_types"),
                    limit=limit // 2  # Split limit between entities and relationships
                )
                
                for entity in entities:
                    unified_results.append({
                        "content": self._format_entity_content(entity),
                        "score": entity["confidence_score"],
                        "source": "structured",
                        "entities": [entity],
                        "relationships": [],
                        "semantic_metadata": None,
                        "result_type": "entity"
                    })
            
            # Search for relationships
            relationships = await self.kg_service.get_relationships(
                user_id=user_id,
                relationship_type=filters.get("relationship_type"),
                limit=limit // 2
            )
            
            for rel in relationships[:limit - len(unified_results)]:
                unified_results.append({
                    "content": self._format_relationship_content(rel),
                    "score": rel["confidence_score"],
                    "source": "structured", 
                    "entities": [],
                    "relationships": [rel],
                    "semantic_metadata": None,
                    "result_type": "relationship"
                })
            
            # Sort by confidence score
            unified_results.sort(key=lambda x: x["score"], reverse=True)
            
            return unified_results[:limit]
            
        except Exception as e:
            logger.error(f"Structured-only search failed: {e}")
            raise
    
    async def _hybrid_combined_search(
        self,
        query: str,
        user_id: int,
        limit: int,
        filters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Perform hybrid search combining both approaches"""
        try:
            # Run both searches concurrently
            semantic_task = asyncio.create_task(
                self._semantic_only_search(query, user_id, limit, filters)
            )
            structured_task = asyncio.create_task(
                self._structured_only_search(query, user_id, limit, filters)
            )
            
            semantic_results, structured_results = await asyncio.gather(
                semantic_task, structured_task, return_exceptions=True
            )
            
            # Handle exceptions
            if isinstance(semantic_results, Exception):
                logger.error(f"Semantic search failed in hybrid: {semantic_results}")
                semantic_results = []
            
            if isinstance(structured_results, Exception):
                logger.error(f"Structured search failed in hybrid: {structured_results}")
                structured_results = []
            
            # Combine and deduplicate results
            combined_results = []
            seen_content_hashes = set()
            
            # Add semantic results
            for result in semantic_results[:limit//2]:
                content_hash = hash(result["content"])
                if content_hash not in seen_content_hashes:
                    combined_results.append(result)
                    seen_content_hashes.add(content_hash)
            
            # Add structured results
            for result in structured_results[:limit//2]:
                content_hash = hash(result["content"])
                if content_hash not in seen_content_hashes:
                    combined_results.append(result)
                    seen_content_hashes.add(content_hash)
            
            # Enhance results with cross-references
            enhanced_results = await self._enhance_with_cross_references(
                combined_results, user_id
            )
            
            # Re-score and sort results
            rescored_results = await self._rescore_hybrid_results(
                enhanced_results, query
            )
            
            return rescored_results[:limit]
            
        except Exception as e:
            logger.error(f"Hybrid combined search failed: {e}")
            raise
    
    def _extract_entity_filters(self, query: str, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Extract entity search filters from query and filters"""
        entity_filters = {}
        
        # Simple keyword extraction for property searches
        query_lower = query.lower()
        
        # Look for name mentions
        if "name" in query_lower or any(word in query_lower for word in ["called", "named", "titled"]):
            # Extract potential names (simplified)
            words = query.split()
            capitalized_words = [w for w in words if w.istitle()]
            if capitalized_words:
                entity_filters["name"] = " ".join(capitalized_words)
        
        # Look for role/occupation mentions
        if any(word in query_lower for word in ["engineer", "manager", "developer", "analyst", "specialist"]):
            for word in ["engineer", "manager", "developer", "analyst", "specialist"]:
                if word in query_lower:
                    entity_filters["role"] = word
                    break
        
        # Look for organization mentions
        if any(word in query_lower for word in ["company", "organization", "corp", "inc", "ltd"]):
            words = query.split()
            for i, word in enumerate(words):
                if word.lower() in ["company", "corp", "inc", "ltd"] and i > 0:
                    entity_filters["organization"] = words[i-1]
                    break
        
        # Add explicit filters from filters dict
        entity_filters.update(filters.get("entity_properties", {}))
        
        return entity_filters
    
    def _format_entity_content(self, entity: Dict[str, Any]) -> str:
        """Format entity information as readable content"""
        name = entity.get("properties", {}).get("name") or entity["entity_id"]
        entity_type = entity["entity_type"]
        properties = entity.get("properties", {})
        
        content_parts = [f"Entity: {name} (Type: {entity_type})"]
        
        for key, value in properties.items():
            if key != "name" and value:
                if isinstance(value, list):
                    value = ", ".join(str(v) for v in value)
                content_parts.append(f"{key.title()}: {value}")
        
        return " | ".join(content_parts)
    
    def _format_relationship_content(self, relationship: Dict[str, Any]) -> str:
        """Format relationship information as readable content"""
        source = relationship["source_entity_id"]
        target = relationship["target_entity_id"]
        rel_type = relationship["relationship_type"]
        
        content = f"Relationship: {source} {rel_type} {target}"
        
        properties = relationship.get("properties", {})
        if properties:
            prop_strs = [f"{k}: {v}" for k, v in properties.items() if v]
            if prop_strs:
                content += " | " + " | ".join(prop_strs)
        
        return content
    
    async def _enhance_with_cross_references(
        self,
        results: List[Dict[str, Any]],
        user_id: int
    ) -> List[Dict[str, Any]]:
        """Enhance results with cross-references between semantic and structured data"""
        enhanced_results = []
        
        for result in results:
            enhanced_result = dict(result)
            
            try:
                if result["source"] == "semantic":
                    # For semantic results, find related entities
                    entities_in_content = result.get("semantic_metadata", {}).get("entities", [])
                    
                    if entities_in_content:
                        # Get entity details from knowledge graph
                        related_entities = []
                        for entity_data in entities_in_content[:3]:  # Limit to 3
                            entity_id = entity_data.get("entity_id")
                            if entity_id:
                                try:
                                    connections = await self.kg_service.get_entity_connections(
                                        user_id=user_id,
                                        entity_id=entity_id,
                                        max_depth=1
                                    )
                                    if connections["entity"]:
                                        related_entities.append(connections["entity"])
                                        enhanced_result["relationships"].extend(
                                            connections["relationships"][:2]
                                        )
                                except Exception as e:
                                    logger.debug(f"Could not get connections for entity {entity_id}: {e}")
                        
                        enhanced_result["entities"] = related_entities
                
                elif result["source"] == "structured":
                    # For structured results, find related semantic content
                    if result["result_type"] == "entity":
                        entity = result["entities"][0] if result["entities"] else None
                        if entity:
                            entity_name = entity.get("properties", {}).get("name", "")
                            if entity_name:
                                try:
                                    # Search for semantic content mentioning this entity
                                    semantic_matches = await self.semantic_service.semantic_search(
                                        query=entity_name,
                                        user_id=user_id,
                                        limit=2,
                                        threshold=0.6
                                    )
                                    
                                    if semantic_matches:
                                        # Add semantic context to structured result
                                        enhanced_result["semantic_metadata"] = {
                                            "related_content": [
                                                {
                                                    "content": match["content"][:200] + "...",
                                                    "score": match["score"]
                                                }
                                                for match in semantic_matches
                                            ]
                                        }
                                except Exception as e:
                                    logger.debug(f"Could not find semantic matches for entity: {e}")
                
                enhanced_results.append(enhanced_result)
                
            except Exception as e:
                logger.debug(f"Cross-reference enhancement failed for result: {e}")
                # Add original result if enhancement fails
                enhanced_results.append(result)
        
        return enhanced_results
    
    async def _rescore_hybrid_results(
        self,
        results: List[Dict[str, Any]],
        query: str
    ) -> List[Dict[str, Any]]:
        """Rescore results based on hybrid relevance"""
        rescored_results = []
        
        for result in results:
            original_score = result["score"]
            
            # Boost score based on cross-references
            cross_ref_boost = 0.0
            if result["entities"] and result["source"] == "semantic":
                cross_ref_boost += 0.1  # Semantic result with entity connections
            if result.get("semantic_metadata") and result["source"] == "structured":
                cross_ref_boost += 0.1  # Structured result with semantic context
            
            # Boost based on content relevance (simple keyword matching)
            content_relevance = self._calculate_content_relevance(result["content"], query)
            
            # Combined hybrid score
            hybrid_score = min(1.0, original_score + cross_ref_boost + content_relevance * 0.2)
            
            result["score"] = hybrid_score
            result["scoring_details"] = {
                "original_score": original_score,
                "cross_ref_boost": cross_ref_boost,
                "content_relevance": content_relevance,
                "hybrid_score": hybrid_score
            }
            
            rescored_results.append(result)
        
        # Sort by hybrid score
        rescored_results.sort(key=lambda x: x["score"], reverse=True)
        
        return rescored_results
    
    def _calculate_content_relevance(self, content: str, query: str) -> float:
        """Calculate simple content relevance score"""
        if not content or not query:
            return 0.0
        
        content_lower = content.lower()
        query_words = query.lower().split()
        
        if not query_words:
            return 0.0
        
        matches = sum(1 for word in query_words if word in content_lower)
        return matches / len(query_words)
    
    async def get_entity_neighborhood(
        self,
        entity_id: str,
        user_id: int,
        depth: int = 2
    ) -> Dict[str, Any]:
        """Get comprehensive neighborhood view of an entity (structured + semantic)"""
        try:
            # Get knowledge graph connections
            kg_neighborhood = await self.kg_service.get_entity_connections(
                user_id=user_id,
                entity_id=entity_id,
                max_depth=depth
            )
            
            # Get semantic content related to this entity
            entity = kg_neighborhood.get("entity")
            if entity:
                entity_name = entity.get("properties", {}).get("name", entity_id)
                
                semantic_content = await self.semantic_service.semantic_search(
                    query=entity_name,
                    user_id=user_id,
                    limit=5,
                    threshold=0.6
                )
                
                return {
                    "entity": entity,
                    "connected_entities": kg_neighborhood.get("connected_entities", []),
                    "relationships": kg_neighborhood.get("relationships", []),
                    "semantic_context": semantic_content,
                    "neighborhood_depth": depth
                }
            else:
                return {"error": "Entity not found"}
                
        except Exception as e:
            logger.error(f"Failed to get entity neighborhood: {e}")
            raise