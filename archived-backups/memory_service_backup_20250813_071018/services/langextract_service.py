"""
LangExtract Integration Service (Step 1)
Structured entity and relationship extraction using langextract library
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Dict, List, Any, Optional

import aiohttp
from langextract import LLMEntityExtractor

from ..config import get_settings
from ..models import LangExtractResult

logger = logging.getLogger(__name__)
settings = get_settings()


class LangExtractService:
    """
    Service for extracting structured entities and relationships from text
    using langextract with few-shot learning examples
    """
    
    def __init__(self):
        self.ollama_url = settings.OLLAMA_URL.rstrip("/")
        self.model = settings.LANGEXTRACT_MODEL
        self.max_tokens = settings.LANGEXTRACT_MAX_TOKENS
        self.extractor = None
        self._initialize_extractor()
    
    def _initialize_extractor(self):
        """Initialize langextract with Ollama backend"""
        try:
            # Configure langextract to use Ollama
            self.extractor = LLMEntityExtractor(
                model_name=self.model,
                api_base_url=self.ollama_url,
                api_type="ollama"
            )
            logger.info(f"LangExtract initialized with model {self.model}")
        except Exception as e:
            logger.error(f"Failed to initialize langextract: {e}")
            self.extractor = None
    
    async def extract_entities(
        self,
        content: str,
        document_metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Extract entities and relationships from text content
        
        Args:
            content: Text content to process
            document_metadata: Additional metadata about the document
            
        Returns:
            Dict containing extracted entities, relationships, and metadata
        """
        start_time = time.time()
        
        if not self.extractor:
            self._initialize_extractor()
            if not self.extractor:
                raise RuntimeError("LangExtract service not available")
        
        try:
            # Prepare schema for extraction
            schema = self._get_extraction_schema(document_metadata or {})
            
            # Prepare few-shot examples based on content type
            examples = self._get_few_shot_examples(content, document_metadata or {})
            
            # Run extraction with langextract
            result = await self._run_extraction(content, schema, examples)
            
            # Post-process and validate results
            processed_result = self._post_process_results(result, content, document_metadata or {})
            
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            return LangExtractResult(
                entities=processed_result.get("entities", []),
                relationships=processed_result.get("relationships", []),
                metadata={
                    "content_length": len(content),
                    "document_metadata": document_metadata or {},
                    "extraction_schema": schema,
                    "model_used": self.model,
                    "content_hash": hashlib.sha256(content.encode()).hexdigest()
                },
                processing_time_ms=processing_time_ms
            ).dict()
            
        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")
            raise
    
    def _get_extraction_schema(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Define extraction schema based on document type and metadata
        """
        base_schema = {
            "entities": {
                "person": {
                    "properties": ["name", "role", "organization", "location", "skills", "expertise"],
                    "description": "Individual people mentioned in the text"
                },
                "organization": {
                    "properties": ["name", "type", "location", "industry", "size"],
                    "description": "Companies, institutions, and organizations"
                },
                "project": {
                    "properties": ["name", "description", "technology", "status", "timeline"],
                    "description": "Projects, initiatives, and work items"
                },
                "technology": {
                    "properties": ["name", "category", "version", "purpose", "capabilities"],
                    "description": "Technologies, tools, frameworks, and systems"
                },
                "concept": {
                    "properties": ["name", "definition", "category", "related_concepts"],
                    "description": "Abstract concepts, ideas, and methodologies"
                },
                "event": {
                    "properties": ["name", "date", "location", "participants", "outcome"],
                    "description": "Events, meetings, milestones, and occurrences"
                }
            },
            "relationships": {
                "works_for": {"description": "Employment or affiliation relationship"},
                "works_on": {"description": "Person working on a project or technology"},
                "collaborates_with": {"description": "People working together"},
                "uses": {"description": "Person or organization using technology"},
                "part_of": {"description": "Component relationship"},
                "located_in": {"description": "Geographic or organizational location"},
                "specializes_in": {"description": "Area of expertise or specialization"},
                "created_by": {"description": "Authorship or creation relationship"},
                "related_to": {"description": "General association or connection"},
                "depends_on": {"description": "Dependency relationship"}
            }
        }
        
        # Customize schema based on document type
        doc_type = metadata.get("source", "").lower()
        
        if "employee" in doc_type or "profile" in doc_type:
            # Enhance for employee/profile documents
            base_schema["entities"]["skill"] = {
                "properties": ["name", "proficiency_level", "years_experience", "category"],
                "description": "Professional skills and competencies"
            }
            base_schema["relationships"]["has_skill"] = {
                "description": "Person possessing a skill"
            }
        
        if "project" in doc_type or "technical" in doc_type:
            # Enhance for technical documents
            base_schema["entities"]["requirement"] = {
                "properties": ["description", "priority", "status", "stakeholder"],
                "description": "Project requirements and specifications"
            }
            base_schema["relationships"]["requires"] = {
                "description": "Dependency or requirement relationship"
            }
        
        return base_schema
    
    def _get_few_shot_examples(self, content: str, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Provide few-shot examples based on content characteristics
        """
        examples = []
        
        # Example 1: Person and organization extraction
        examples.append({
            "text": "Sarah Johnson is a senior software engineer at Microsoft. She specializes in machine learning and has been working on the Azure AI platform for 3 years.",
            "entities": [
                {
                    "type": "person",
                    "name": "Sarah Johnson",
                    "properties": {
                        "role": "senior software engineer",
                        "organization": "Microsoft",
                        "skills": ["machine learning"],
                        "expertise": ["Azure AI platform"]
                    }
                },
                {
                    "type": "organization",
                    "name": "Microsoft",
                    "properties": {
                        "type": "technology company",
                        "industry": "software"
                    }
                },
                {
                    "type": "technology",
                    "name": "Azure AI platform",
                    "properties": {
                        "category": "cloud AI service",
                        "purpose": "AI development platform"
                    }
                }
            ],
            "relationships": [
                {
                    "source": "Sarah Johnson",
                    "target": "Microsoft",
                    "type": "works_for"
                },
                {
                    "source": "Sarah Johnson",
                    "target": "Azure AI platform",
                    "type": "works_on"
                },
                {
                    "source": "Sarah Johnson",
                    "target": "machine learning",
                    "type": "specializes_in"
                }
            ]
        })
        
        # Example 2: Project and technology extraction
        examples.append({
            "text": "The DataPipeline project uses Apache Kafka for real-time data streaming. The system was developed by the data engineering team and processes over 1 million events per day.",
            "entities": [
                {
                    "type": "project",
                    "name": "DataPipeline",
                    "properties": {
                        "description": "real-time data streaming system",
                        "technology": ["Apache Kafka"],
                        "performance": "1 million events per day"
                    }
                },
                {
                    "type": "technology",
                    "name": "Apache Kafka",
                    "properties": {
                        "category": "data streaming platform",
                        "purpose": "real-time data streaming"
                    }
                },
                {
                    "type": "organization",
                    "name": "data engineering team",
                    "properties": {
                        "type": "team",
                        "specialization": "data engineering"
                    }
                }
            ],
            "relationships": [
                {
                    "source": "DataPipeline",
                    "target": "Apache Kafka",
                    "type": "uses"
                },
                {
                    "source": "DataPipeline",
                    "target": "data engineering team",
                    "type": "created_by"
                }
            ]
        })
        
        return examples
    
    async def _run_extraction(
        self,
        content: str,
        schema: Dict[str, Any],
        examples: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Execute the extraction using langextract
        """
        try:
            # Use langextract to perform entity extraction
            extraction_prompt = self._build_extraction_prompt(content, schema, examples)
            
            # Call Ollama directly for now (langextract integration can be enhanced)
            result = await self._call_ollama_for_extraction(extraction_prompt)
            
            return result
            
        except Exception as e:
            logger.error(f"Extraction execution failed: {e}")
            raise
    
    def _build_extraction_prompt(
        self,
        content: str,
        schema: Dict[str, Any],
        examples: List[Dict[str, Any]]
    ) -> str:
        """
        Build a comprehensive extraction prompt
        """
        prompt = f"""You are an expert entity and relationship extractor. Extract structured information from the given text.

EXTRACTION SCHEMA:
{json.dumps(schema, indent=2)}

EXAMPLES:
"""
        for i, example in enumerate(examples, 1):
            prompt += f"\nExample {i}:\nText: {example['text']}\n"
            prompt += f"Entities: {json.dumps(example['entities'], indent=2)}\n"
            prompt += f"Relationships: {json.dumps(example['relationships'], indent=2)}\n"
        
        prompt += f"""

NOW EXTRACT FROM THIS TEXT:
{content}

Return the result in the following JSON format:
{{
    "entities": [list of entities with type, name, and properties],
    "relationships": [list of relationships with source, target, and type]
}}

Ensure all entity names in relationships exactly match the entity names in the entities list.
Focus on extracting factual, specific information. Avoid speculation.
"""
        
        return prompt
    
    async def _call_ollama_for_extraction(self, prompt: str) -> Dict[str, Any]:
        """
        Call Ollama API for entity extraction
        """
        async with aiohttp.ClientSession() as session:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "top_p": 0.9,
                    "max_tokens": self.max_tokens
                }
            }
            
            async with session.post(f"{self.ollama_url}/api/generate", json=payload) as response:
                if response.status != 200:
                    raise RuntimeError(f"Ollama API error: {response.status}")
                
                result = await response.json()
                response_text = result.get("response", "")
                
                # Parse JSON response
                try:
                    # Extract JSON from response (handle potential markdown formatting)
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
                    logger.error(f"Failed to parse JSON response: {e}")
                    logger.error(f"Response text: {response_text}")
                    # Return empty structure on parse failure
                    return {"entities": [], "relationships": []}
    
    def _post_process_results(
        self,
        results: Dict[str, Any],
        original_content: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Post-process and validate extraction results
        """
        processed = {
            "entities": [],
            "relationships": []
        }
        
        # Process entities
        entity_names = set()
        for entity in results.get("entities", []):
            if not isinstance(entity, dict):
                continue
                
            entity_name = entity.get("name", "").strip()
            entity_type = entity.get("type", "unknown").lower()
            
            if not entity_name:
                continue
            
            # Normalize entity
            normalized_entity = {
                "entity_id": f"{entity_type}_{hashlib.md5(entity_name.encode()).hexdigest()[:8]}",
                "entity_type": entity_type,
                "name": entity_name,
                "properties": entity.get("properties", {}),
                "confidence_score": 0.8,  # Default confidence
                "source_document": metadata.get("document_id", "unknown")
            }
            
            processed["entities"].append(normalized_entity)
            entity_names.add(entity_name)
        
        # Process relationships
        for relationship in results.get("relationships", []):
            if not isinstance(relationship, dict):
                continue
            
            source = relationship.get("source", "").strip()
            target = relationship.get("target", "").strip()
            rel_type = relationship.get("type", "related_to").lower()
            
            # Validate that entities exist
            if source not in entity_names or target not in entity_names:
                continue
            
            # Create source and target entity IDs
            source_id = None
            target_id = None
            
            for entity in processed["entities"]:
                if entity["name"] == source:
                    source_id = entity["entity_id"]
                if entity["name"] == target:
                    target_id = entity["entity_id"]
            
            if source_id and target_id:
                processed["relationships"].append({
                    "source_entity_id": source_id,
                    "target_entity_id": target_id,
                    "relationship_type": rel_type,
                    "properties": relationship.get("properties", {}),
                    "confidence_score": 0.8,  # Default confidence
                    "source_document": metadata.get("document_id", "unknown")
                })
        
        return processed