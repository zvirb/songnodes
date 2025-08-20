"""
Knowledge Graph Service (Step 2)
Populates PostgreSQL graph storage with extracted entities and relationships
"""

import logging
from typing import Dict, List, Any, Optional

from sqlalchemy import select, update, and_, or_
from sqlalchemy.dialects.postgresql import insert

from ..database import get_db_session
from ..models import GraphNode, GraphEdge

logger = logging.getLogger(__name__)


class KnowledgeGraphService:
    """
    Service for populating and querying the knowledge graph in PostgreSQL
    Handles entity resolution, relationship mapping, and graph operations
    """
    
    def __init__(self):
        pass
    
    async def update_knowledge_graph(
        self,
        extraction_result: Dict[str, Any],
        user_id: int
    ) -> Dict[str, Any]:
        """
        Update knowledge graph with extracted entities and relationships
        
        Args:
            extraction_result: Result from langextract service
            user_id: ID of the user who owns this data
            
        Returns:
            Dict with statistics about nodes and edges updated
        """
        stats = {
            "nodes_created": 0,
            "nodes_updated": 0,
            "edges_created": 0,
            "edges_updated": 0,
            "errors": []
        }
        
        try:
            async with get_db_session() as session:
                # Process entities (nodes)
                entities = extraction_result.get("entities", [])
                node_stats = await self._process_entities(session, entities, user_id)
                stats.update(node_stats)
                
                # Process relationships (edges)
                relationships = extraction_result.get("relationships", [])
                edge_stats = await self._process_relationships(session, relationships, user_id)
                stats.update(edge_stats)
                
                await session.commit()
                logger.info(f"Knowledge graph updated for user {user_id}: {stats}")
                
        except Exception as e:
            logger.error(f"Failed to update knowledge graph: {e}")
            stats["errors"].append(str(e))
            raise
        
        return stats
    
    async def _process_entities(
        self,
        session,
        entities: List[Dict[str, Any]],
        user_id: int
    ) -> Dict[str, int]:
        """Process entities and insert/update graph nodes"""
        stats = {"nodes_created": 0, "nodes_updated": 0}
        
        for entity_data in entities:
            try:
                entity_id = entity_data.get("entity_id")
                if not entity_id:
                    continue
                
                # Check if entity already exists for this user
                existing_stmt = select(GraphNode).where(
                    and_(
                        GraphNode.entity_id == entity_id,
                        GraphNode.user_id == user_id
                    )
                )
                result = await session.execute(existing_stmt)
                existing_node = result.scalar_one_or_none()
                
                if existing_node:
                    # Update existing node
                    await self._update_existing_node(session, existing_node, entity_data)
                    stats["nodes_updated"] += 1
                else:
                    # Create new node
                    await self._create_new_node(session, entity_data, user_id)
                    stats["nodes_created"] += 1
                    
            except Exception as e:
                logger.error(f"Error processing entity {entity_data}: {e}")
                continue
        
        return stats
    
    async def _create_new_node(
        self,
        session,
        entity_data: Dict[str, Any],
        user_id: int
    ):
        """Create a new graph node"""
        node = GraphNode(
            entity_id=entity_data["entity_id"],
            entity_type=entity_data.get("entity_type", "unknown"),
            properties=entity_data.get("properties", {}),
            user_id=user_id,
            confidence_score=entity_data.get("confidence_score", 0.8),
            source_document=entity_data.get("source_document")
        )
        session.add(node)
    
    async def _update_existing_node(
        self,
        session,
        existing_node: GraphNode,
        entity_data: Dict[str, Any]
    ):
        """Update an existing graph node with new information"""
        # Merge properties (keep existing, add new)
        merged_properties = dict(existing_node.properties or {})
        new_properties = entity_data.get("properties", {})
        
        for key, value in new_properties.items():
            if key not in merged_properties or merged_properties[key] != value:
                merged_properties[key] = value
        
        # Update confidence score (take higher value)
        new_confidence = entity_data.get("confidence_score", existing_node.confidence_score)
        confidence_score = max(existing_node.confidence_score, new_confidence)
        
        # Update the node
        await session.execute(
            update(GraphNode)
            .where(GraphNode.id == existing_node.id)
            .values(
                properties=merged_properties,
                confidence_score=confidence_score,
                source_document=entity_data.get("source_document", existing_node.source_document)
            )
        )
    
    async def _process_relationships(
        self,
        session,
        relationships: List[Dict[str, Any]],
        user_id: int
    ) -> Dict[str, int]:
        """Process relationships and insert/update graph edges"""
        stats = {"edges_created": 0, "edges_updated": 0}
        
        for rel_data in relationships:
            try:
                source_id = rel_data.get("source_entity_id")
                target_id = rel_data.get("target_entity_id")
                rel_type = rel_data.get("relationship_type")
                
                if not all([source_id, target_id, rel_type]):
                    continue
                
                # Check if relationship already exists
                existing_stmt = select(GraphEdge).where(
                    and_(
                        GraphEdge.source_entity_id == source_id,
                        GraphEdge.target_entity_id == target_id,
                        GraphEdge.relationship_type == rel_type,
                        GraphEdge.user_id == user_id
                    )
                )
                result = await session.execute(existing_stmt)
                existing_edge = result.scalar_one_or_none()
                
                if existing_edge:
                    # Update existing edge
                    await self._update_existing_edge(session, existing_edge, rel_data)
                    stats["edges_updated"] += 1
                else:
                    # Create new edge
                    await self._create_new_edge(session, rel_data, user_id)
                    stats["edges_created"] += 1
                    
            except Exception as e:
                logger.error(f"Error processing relationship {rel_data}: {e}")
                continue
        
        return stats
    
    async def _create_new_edge(
        self,
        session,
        rel_data: Dict[str, Any],
        user_id: int
    ):
        """Create a new graph edge"""
        edge = GraphEdge(
            source_entity_id=rel_data["source_entity_id"],
            target_entity_id=rel_data["target_entity_id"],
            relationship_type=rel_data["relationship_type"],
            properties=rel_data.get("properties", {}),
            user_id=user_id,
            confidence_score=rel_data.get("confidence_score", 0.8),
            source_document=rel_data.get("source_document")
        )
        session.add(edge)
    
    async def _update_existing_edge(
        self,
        session,
        existing_edge: GraphEdge,
        rel_data: Dict[str, Any]
    ):
        """Update an existing graph edge with new information"""
        # Merge properties
        merged_properties = dict(existing_edge.properties or {})
        new_properties = rel_data.get("properties", {})
        
        for key, value in new_properties.items():
            if key not in merged_properties or merged_properties[key] != value:
                merged_properties[key] = value
        
        # Update confidence score (take higher value)
        new_confidence = rel_data.get("confidence_score", existing_edge.confidence_score)
        confidence_score = max(existing_edge.confidence_score, new_confidence)
        
        # Update the edge
        await session.execute(
            update(GraphEdge)
            .where(GraphEdge.id == existing_edge.id)
            .values(
                properties=merged_properties,
                confidence_score=confidence_score,
                source_document=rel_data.get("source_document", existing_edge.source_document)
            )
        )
    
    async def get_entities(
        self,
        user_id: int,
        entity_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get entities from the knowledge graph"""
        try:
            async with get_db_session() as session:
                stmt = select(GraphNode).where(GraphNode.user_id == user_id)
                
                if entity_type:
                    stmt = stmt.where(GraphNode.entity_type == entity_type)
                
                stmt = stmt.limit(limit).order_by(GraphNode.confidence_score.desc())
                
                result = await session.execute(stmt)
                nodes = result.scalars().all()
                
                return [
                    {
                        "entity_id": node.entity_id,
                        "entity_type": node.entity_type,
                        "properties": node.properties,
                        "confidence_score": node.confidence_score,
                        "source_document": node.source_document,
                        "created_at": node.created_at.isoformat(),
                        "updated_at": node.updated_at.isoformat()
                    }
                    for node in nodes
                ]
                
        except Exception as e:
            logger.error(f"Failed to get entities: {e}")
            raise
    
    async def get_relationships(
        self,
        user_id: int,
        source_entity: Optional[str] = None,
        target_entity: Optional[str] = None,
        relationship_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get relationships from the knowledge graph"""
        try:
            async with get_db_session() as session:
                stmt = select(GraphEdge).where(GraphEdge.user_id == user_id)
                
                if source_entity:
                    stmt = stmt.where(GraphEdge.source_entity_id == source_entity)
                
                if target_entity:
                    stmt = stmt.where(GraphEdge.target_entity_id == target_entity)
                
                if relationship_type:
                    stmt = stmt.where(GraphEdge.relationship_type == relationship_type)
                
                stmt = stmt.limit(limit).order_by(GraphEdge.confidence_score.desc())
                
                result = await session.execute(stmt)
                edges = result.scalars().all()
                
                return [
                    {
                        "source_entity_id": edge.source_entity_id,
                        "target_entity_id": edge.target_entity_id,
                        "relationship_type": edge.relationship_type,
                        "properties": edge.properties,
                        "confidence_score": edge.confidence_score,
                        "source_document": edge.source_document,
                        "created_at": edge.created_at.isoformat(),
                        "updated_at": edge.updated_at.isoformat()
                    }
                    for edge in edges
                ]
                
        except Exception as e:
            logger.error(f"Failed to get relationships: {e}")
            raise
    
    async def get_entity_connections(
        self,
        user_id: int,
        entity_id: str,
        max_depth: int = 2,
        relationship_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get all connections for a specific entity up to max_depth
        Returns a subgraph centered on the entity
        """
        try:
            async with get_db_session() as session:
                # Get the entity itself
                entity_stmt = select(GraphNode).where(
                    and_(GraphNode.entity_id == entity_id, GraphNode.user_id == user_id)
                )
                entity_result = await session.execute(entity_stmt)
                entity = entity_result.scalar_one_or_none()
                
                if not entity:
                    return {"entity": None, "connections": []}
                
                # Get all relationships involving this entity
                rel_stmt = select(GraphEdge).where(
                    and_(
                        or_(
                            GraphEdge.source_entity_id == entity_id,
                            GraphEdge.target_entity_id == entity_id
                        ),
                        GraphEdge.user_id == user_id
                    )
                )
                
                if relationship_types:
                    rel_stmt = rel_stmt.where(GraphEdge.relationship_type.in_(relationship_types))
                
                rel_result = await session.execute(rel_stmt)
                relationships = rel_result.scalars().all()
                
                # Collect connected entity IDs
                connected_entity_ids = set()
                for rel in relationships:
                    if rel.source_entity_id != entity_id:
                        connected_entity_ids.add(rel.source_entity_id)
                    if rel.target_entity_id != entity_id:
                        connected_entity_ids.add(rel.target_entity_id)
                
                # Get connected entities
                connected_entities = []
                if connected_entity_ids:
                    entities_stmt = select(GraphNode).where(
                        and_(
                            GraphNode.entity_id.in_(connected_entity_ids),
                            GraphNode.user_id == user_id
                        )
                    )
                    entities_result = await session.execute(entities_stmt)
                    connected_entities = entities_result.scalars().all()
                
                return {
                    "entity": {
                        "entity_id": entity.entity_id,
                        "entity_type": entity.entity_type,
                        "properties": entity.properties,
                        "confidence_score": entity.confidence_score
                    },
                    "connected_entities": [
                        {
                            "entity_id": e.entity_id,
                            "entity_type": e.entity_type,
                            "properties": e.properties,
                            "confidence_score": e.confidence_score
                        }
                        for e in connected_entities
                    ],
                    "relationships": [
                        {
                            "source_entity_id": r.source_entity_id,
                            "target_entity_id": r.target_entity_id,
                            "relationship_type": r.relationship_type,
                            "properties": r.properties,
                            "confidence_score": r.confidence_score
                        }
                        for r in relationships
                    ]
                }
                
        except Exception as e:
            logger.error(f"Failed to get entity connections: {e}")
            raise
    
    async def search_entities_by_properties(
        self,
        user_id: int,
        property_filters: Dict[str, Any],
        entity_types: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Search entities based on their properties using JSONB queries
        """
        try:
            async with get_db_session() as session:
                stmt = select(GraphNode).where(GraphNode.user_id == user_id)
                
                if entity_types:
                    stmt = stmt.where(GraphNode.entity_type.in_(entity_types))
                
                # Add property filters using JSONB operations
                for key, value in property_filters.items():
                    if isinstance(value, str):
                        # Text search in JSONB
                        stmt = stmt.where(GraphNode.properties[key].astext.ilike(f"%{value}%"))
                    else:
                        # Exact match
                        stmt = stmt.where(GraphNode.properties[key] == value)
                
                stmt = stmt.limit(limit).order_by(GraphNode.confidence_score.desc())
                
                result = await session.execute(stmt)
                nodes = result.scalars().all()
                
                return [
                    {
                        "entity_id": node.entity_id,
                        "entity_type": node.entity_type,
                        "properties": node.properties,
                        "confidence_score": node.confidence_score,
                        "source_document": node.source_document
                    }
                    for node in nodes
                ]
                
        except Exception as e:
            logger.error(f"Failed to search entities by properties: {e}")
            raise