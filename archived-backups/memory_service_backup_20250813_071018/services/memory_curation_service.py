"""
Memory Curation Service (Step 4)
LLM-powered memory reconciliation and curation decisions (ADD/UPDATE/DELETE/NOOP)
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Dict, List, Any, Optional

import aiohttp
from sqlalchemy import select, and_

from ..config import get_settings
from ..database import get_db_session
from ..models import MemoryRecord, MemoryOperation

logger = logging.getLogger(__name__)
settings = get_settings()


class MemoryCurationService:
    """
    Service for LLM-powered memory curation and reconciliation
    Makes intelligent decisions about memory operations (ADD/UPDATE/DELETE/NOOP)
    """
    
    def __init__(self):
        self.ollama_url = settings.OLLAMA_URL.rstrip("/")
        self.curation_model = settings.OLLAMA_MODEL_CURATION
        self.duplicate_threshold = settings.DUPLICATE_THRESHOLD
    
    async def curate_memory(
        self,
        extraction_result: Dict[str, Any],
        semantic_result: Dict[str, Any],
        user_id: int
    ) -> Dict[str, Any]:
        """
        Perform memory curation using LLM to make ADD/UPDATE/DELETE/NOOP decisions
        
        Args:
            extraction_result: Results from langextract processing
            semantic_result: Results from semantic memory storage
            user_id: User ID for data isolation
            
        Returns:
            Dict with curation decisions and operation statistics
        """
        try:
            # Get existing memory records for comparison
            existing_memories = await self._get_existing_memories(user_id)
            
            # Prepare content for curation analysis
            new_content = self._prepare_content_for_curation(extraction_result, semantic_result)
            
            # Generate curation decisions using LLM
            curation_decisions = await self._generate_curation_decisions(
                new_content, existing_memories, user_id
            )
            
            # Execute curation decisions
            execution_results = await self._execute_curation_decisions(
                curation_decisions, user_id
            )
            
            # Store curation records
            await self._store_curation_records(curation_decisions, user_id)
            
            result = {
                "operations": curation_decisions,
                "execution_results": execution_results,
                "total_decisions": len(curation_decisions),
                "operation_counts": self._count_operations(curation_decisions)
            }
            
            logger.info(f"Memory curation completed for user {user_id}: {result['operation_counts']}")
            return result
            
        except Exception as e:
            logger.error(f"Memory curation failed: {e}")
            raise
    
    async def _get_existing_memories(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent memory records for comparison"""
        try:
            async with get_db_session() as session:
                stmt = select(MemoryRecord).where(
                    MemoryRecord.user_id == user_id
                ).order_by(
                    MemoryRecord.created_at.desc()
                ).limit(limit)
                
                result = await session.execute(stmt)
                records = result.scalars().all()
                
                return [
                    {
                        "content_hash": record.content_hash,
                        "operation": record.operation,
                        "reasoning": record.reasoning,
                        "metadata": record.metadata,
                        "created_at": record.created_at.isoformat()
                    }
                    for record in records
                ]
                
        except Exception as e:
            logger.error(f"Failed to get existing memories: {e}")
            return []
    
    def _prepare_content_for_curation(
        self,
        extraction_result: Dict[str, Any],
        semantic_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Prepare extracted content for curation analysis"""
        entities = extraction_result.get("entities", [])
        relationships = extraction_result.get("relationships", [])
        
        # Create content summary
        content_summary = {
            "entity_count": len(entities),
            "relationship_count": len(relationships),
            "entity_types": list(set(e.get("entity_type", "unknown") for e in entities)),
            "relationship_types": list(set(r.get("relationship_type", "unknown") for r in relationships)),
            "key_entities": [
                {
                    "name": e.get("name", ""),
                    "type": e.get("entity_type", ""),
                    "properties": e.get("properties", {})
                }
                for e in entities[:10]  # Top 10 entities
            ],
            "key_relationships": [
                {
                    "source": r.get("source_entity_id", ""),
                    "target": r.get("target_entity_id", ""),
                    "type": r.get("relationship_type", "")
                }
                for r in relationships[:10]  # Top 10 relationships
            ],
            "semantic_chunks": semantic_result.get("chunks_stored", 0),
            "processing_metadata": extraction_result.get("metadata", {})
        }
        
        return content_summary
    
    async def _generate_curation_decisions(
        self,
        new_content: Dict[str, Any],
        existing_memories: List[Dict[str, Any]],
        user_id: int
    ) -> List[Dict[str, Any]]:
        """Generate curation decisions using LLM"""
        try:
            # Build curation prompt
            prompt = self._build_curation_prompt(new_content, existing_memories)
            
            # Call LLM for curation decisions
            llm_response = await self._call_ollama_for_curation(prompt)
            
            # Parse and validate decisions
            decisions = self._parse_curation_decisions(llm_response, new_content)
            
            return decisions
            
        except Exception as e:
            logger.error(f"Failed to generate curation decisions: {e}")
            # Fallback: default to ADD for new content
            return [self._create_default_add_decision(new_content)]
    
    def _build_curation_prompt(
        self,
        new_content: Dict[str, Any],
        existing_memories: List[Dict[str, Any]]
    ) -> str:
        """Build comprehensive curation prompt for LLM"""
        prompt = f"""You are an expert memory curator. Analyze the new content and existing memories to make intelligent curation decisions.

Your task is to decide for each piece of new information whether to:
- ADD: Store as new memory (novel information)
- UPDATE: Merge with existing similar memory (refinement or additional detail)
- DELETE: Remove conflicting or outdated information
- NOOP: No operation needed (duplicate or irrelevant information)

NEW CONTENT ANALYSIS:
{json.dumps(new_content, indent=2)}

EXISTING MEMORIES (recent):
{json.dumps(existing_memories[:20], indent=2)}

CURATION GUIDELINES:
1. ADD when information is genuinely new and valuable
2. UPDATE when new content enhances or corrects existing memories
3. DELETE when new information contradicts and supersedes old information
4. NOOP when content is redundant or not worth storing

For each entity and relationship in the new content, make a decision.
Consider:
- Information novelty and value
- Potential duplicates or near-duplicates
- Conflicting information that needs resolution
- Memory consolidation opportunities

Return your decisions in this JSON format:
{{
    "decisions": [
        {{
            "content_type": "entity|relationship|concept",
            "content_id": "unique identifier",
            "operation": "ADD|UPDATE|DELETE|NOOP",
            "reasoning": "detailed explanation of the decision",
            "confidence": 0.0-1.0,
            "target_memory_id": "if UPDATE/DELETE, which existing memory",
            "metadata": {{
                "priority": "high|medium|low",
                "domain": "entity type or domain"
            }}
        }}
    ],
    "summary": {{
        "total_decisions": 0,
        "add_count": 0,
        "update_count": 0,
        "delete_count": 0,
        "noop_count": 0,
        "rationale": "overall curation strategy explanation"
    }}
}}

Focus on making thoughtful decisions that maintain memory quality and avoid redundancy.
"""
        return prompt
    
    async def _call_ollama_for_curation(self, prompt: str) -> Dict[str, Any]:
        """Call Ollama API for curation decisions"""
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "model": self.curation_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.2,  # Lower temperature for more consistent decisions
                        "top_p": 0.9,
                        "max_tokens": 2000
                    }
                }
                
                async with session.post(f"{self.ollama_url}/api/generate", json=payload) as response:
                    if response.status != 200:
                        raise RuntimeError(f"Ollama API error: {response.status}")
                    
                    result = await response.json()
                    response_text = result.get("response", "")
                    
                    # Parse JSON response
                    try:
                        if "```json" in response_text:
                            json_start = response_text.find("```json") + 7
                            json_end = response_text.find("```", json_start)
                            json_text = response_text[json_start:json_end].strip()
                        elif "{" in response_text and "}" in response_text:
                            json_start = response_text.find("{")
                            json_end = response_text.rfind("}") + 1
                            json_text = response_text[json_start:json_end]
                        else:
                            json_text = response_text
                        
                        return json.loads(json_text)
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse curation JSON: {e}")
                        logger.error(f"Response text: {response_text}")
                        # Return empty decision structure
                        return {"decisions": [], "summary": {"total_decisions": 0}}
                        
        except Exception as e:
            logger.error(f"Ollama curation call failed: {e}")
            return {"decisions": [], "summary": {"total_decisions": 0}}
    
    def _parse_curation_decisions(
        self,
        llm_response: Dict[str, Any],
        new_content: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Parse and validate LLM curation decisions"""
        decisions = []
        
        raw_decisions = llm_response.get("decisions", [])
        
        for decision in raw_decisions:
            if not isinstance(decision, dict):
                continue
            
            # Validate required fields
            operation = decision.get("operation", "").upper()
            if operation not in ["ADD", "UPDATE", "DELETE", "NOOP"]:
                operation = "ADD"  # Default to ADD for invalid operations
            
            content_id = decision.get("content_id", "")
            if not content_id:
                # Generate content ID from content
                content_text = json.dumps(decision.get("content", {}), sort_keys=True)
                content_id = hashlib.md5(content_text.encode()).hexdigest()[:16]
            
            # Create validated decision
            validated_decision = {
                "content_type": decision.get("content_type", "unknown"),
                "content_id": content_id,
                "operation": operation,
                "reasoning": decision.get("reasoning", "No reasoning provided"),
                "confidence": float(decision.get("confidence", 0.5)),
                "target_memory_id": decision.get("target_memory_id"),
                "metadata": decision.get("metadata", {}),
                "content_hash": hashlib.sha256(json.dumps(decision, sort_keys=True).encode()).hexdigest()
            }
            
            decisions.append(validated_decision)
        
        # If no decisions were made by LLM, create default ADD decision
        if not decisions:
            decisions.append(self._create_default_add_decision(new_content))
        
        return decisions
    
    def _create_default_add_decision(self, new_content: Dict[str, Any]) -> Dict[str, Any]:
        """Create a default ADD decision for content"""
        content_text = json.dumps(new_content, sort_keys=True)
        content_hash = hashlib.sha256(content_text.encode()).hexdigest()
        
        return {
            "content_type": "batch",
            "content_id": content_hash[:16],
            "operation": "ADD",
            "reasoning": "Default decision: adding new content as no curation decision was made",
            "confidence": 0.5,
            "target_memory_id": None,
            "metadata": {
                "priority": "medium",
                "domain": "general",
                "is_default": True
            },
            "content_hash": content_hash
        }
    
    async def _execute_curation_decisions(
        self,
        decisions: List[Dict[str, Any]],
        user_id: int
    ) -> Dict[str, Any]:
        """Execute the curation decisions"""
        execution_results = {
            "successful_operations": 0,
            "failed_operations": 0,
            "operations_by_type": {"ADD": 0, "UPDATE": 0, "DELETE": 0, "NOOP": 0},
            "errors": []
        }
        
        for decision in decisions:
            try:
                operation = decision["operation"]
                
                if operation == "ADD":
                    await self._execute_add_operation(decision, user_id)
                elif operation == "UPDATE":
                    await self._execute_update_operation(decision, user_id)
                elif operation == "DELETE":
                    await self._execute_delete_operation(decision, user_id)
                elif operation == "NOOP":
                    # No operation needed
                    pass
                
                execution_results["successful_operations"] += 1
                execution_results["operations_by_type"][operation] += 1
                
            except Exception as e:
                logger.error(f"Failed to execute {decision['operation']} operation: {e}")
                execution_results["failed_operations"] += 1
                execution_results["errors"].append({
                    "decision": decision,
                    "error": str(e)
                })
        
        return execution_results
    
    async def _execute_add_operation(self, decision: Dict[str, Any], user_id: int):
        """Execute ADD operation (content already stored in previous steps)"""
        # For ADD operations, the content has already been stored in the graph and semantic memory
        # This method could be used for additional processing if needed
        logger.info(f"ADD operation noted for content_id: {decision['content_id']}")
    
    async def _execute_update_operation(self, decision: Dict[str, Any], user_id: int):
        """Execute UPDATE operation (merge with existing memory)"""
        # This could involve updating existing graph nodes/edges or semantic chunks
        # Implementation depends on specific update strategy
        logger.info(f"UPDATE operation noted for content_id: {decision['content_id']}")
    
    async def _execute_delete_operation(self, decision: Dict[str, Any], user_id: int):
        """Execute DELETE operation (remove conflicting memory)"""
        # This could involve deleting specific graph nodes/edges or semantic chunks
        # Implementation depends on deletion strategy
        logger.info(f"DELETE operation noted for content_id: {decision['content_id']}")
    
    async def _store_curation_records(
        self,
        decisions: List[Dict[str, Any]],
        user_id: int
    ):
        """Store curation decision records for audit and learning"""
        try:
            async with get_db_session() as session:
                records = []
                
                for decision in decisions:
                    record = MemoryRecord(
                        user_id=user_id,
                        content_hash=decision["content_hash"],
                        operation=decision["operation"],
                        reasoning=decision["reasoning"],
                        metadata={
                            "content_type": decision["content_type"],
                            "content_id": decision["content_id"],
                            "confidence": decision["confidence"],
                            "target_memory_id": decision.get("target_memory_id"),
                            "decision_metadata": decision.get("metadata", {})
                        }
                    )
                    records.append(record)
                
                session.add_all(records)
                await session.commit()
                
                logger.info(f"Stored {len(records)} curation records for user {user_id}")
                
        except Exception as e:
            logger.error(f"Failed to store curation records: {e}")
            raise
    
    def _count_operations(self, decisions: List[Dict[str, Any]]) -> Dict[str, int]:
        """Count operations by type"""
        counts = {"ADD": 0, "UPDATE": 0, "DELETE": 0, "NOOP": 0}
        
        for decision in decisions:
            operation = decision.get("operation", "NOOP")
            if operation in counts:
                counts[operation] += 1
        
        return counts
    
    async def get_curation_history(
        self,
        user_id: int,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get curation decision history for a user"""
        try:
            async with get_db_session() as session:
                stmt = select(MemoryRecord).where(
                    MemoryRecord.user_id == user_id
                ).order_by(
                    MemoryRecord.created_at.desc()
                ).limit(limit)
                
                result = await session.execute(stmt)
                records = result.scalars().all()
                
                return [
                    {
                        "id": record.id,
                        "content_hash": record.content_hash,
                        "operation": record.operation,
                        "reasoning": record.reasoning,
                        "metadata": record.metadata,
                        "created_at": record.created_at.isoformat()
                    }
                    for record in records
                ]
                
        except Exception as e:
            logger.error(f"Failed to get curation history: {e}")
            raise
    
    async def analyze_curation_patterns(self, user_id: int) -> Dict[str, Any]:
        """Analyze curation patterns for insights and optimization"""
        try:
            async with get_db_session() as session:
                # Get recent curation records
                stmt = select(MemoryRecord).where(
                    MemoryRecord.user_id == user_id
                ).order_by(
                    MemoryRecord.created_at.desc()
                ).limit(500)
                
                result = await session.execute(stmt)
                records = result.scalars().all()
                
                if not records:
                    return {"message": "No curation history found"}
                
                # Analyze patterns
                operation_counts = {"ADD": 0, "UPDATE": 0, "DELETE": 0, "NOOP": 0}
                content_types = {}
                
                for record in records:
                    # Count operations
                    if record.operation in operation_counts:
                        operation_counts[record.operation] += 1
                    
                    # Count content types
                    content_type = record.metadata.get("content_type", "unknown")
                    content_types[content_type] = content_types.get(content_type, 0) + 1
                
                return {
                    "total_records": len(records),
                    "operation_distribution": operation_counts,
                    "content_type_distribution": content_types,
                    "most_common_operation": max(operation_counts.items(), key=lambda x: x[1])[0],
                    "analysis_period": f"Last {len(records)} decisions"
                }
                
        except Exception as e:
            logger.error(f"Failed to analyze curation patterns: {e}")
            raise