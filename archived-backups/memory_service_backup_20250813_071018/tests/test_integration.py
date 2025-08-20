"""
Integration Tests for Memory Service
Tests the complete 4-step pipeline and hybrid retrieval
"""

import pytest
import asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient

from ..main import app
from ..config import get_settings
from ..database import init_database
from ..models import DocumentProcessingRequest, HybridQueryRequest, SearchType

settings = get_settings()


class TestMemoryServiceIntegration:
    """Integration tests for the complete memory service pipeline"""
    
    @pytest.fixture(scope="class")
    async def setup_database(self):
        """Set up test database"""
        await init_database()
    
    @pytest.fixture
    def test_client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def sample_document_request(self):
        """Sample document processing request"""
        return DocumentProcessingRequest(
            content="""
            Dr. Sarah Johnson is a senior machine learning engineer at TechCorp Inc. 
            She has been working on the AutoML project for the past 2 years, specializing in 
            deep learning and natural language processing. Sarah collaborates with the data 
            science team led by Dr. Michael Chen. The AutoML project uses TensorFlow and 
            PyTorch frameworks to build automated machine learning pipelines. The project 
            aims to democratize AI by making machine learning accessible to non-experts.
            """,
            document_metadata={
                "source": "employee_profile",
                "document_id": "emp_sarah_johnson",
                "department": "AI Research",
                "timestamp": "2025-08-09T12:00:00Z"
            },
            processing_options={
                "extract_relationships": True,
                "enable_curation": True
            }
        )
    
    @pytest.fixture
    def valid_jwt_token(self):
        """Create a valid JWT token for testing"""
        from ..services.authentication_service import AuthenticationService
        auth_service = AuthenticationService()
        return auth_service.create_service_token(
            user_id=1,
            service_name="memory-service-test"
        )
    
    async def test_health_endpoint(self, test_client):
        """Test health check endpoint"""
        response = test_client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] in ["healthy", "unhealthy"]
        assert "services" in data
        assert "version" in data
    
    async def test_complete_pipeline_integration(
        self, 
        test_client, 
        sample_document_request,
        valid_jwt_token,
        setup_database
    ):
        """Test the complete 4-step processing pipeline"""
        # Step 1: Process document
        headers = {"Authorization": f"Bearer {valid_jwt_token}"}
        response = test_client.post(
            "/process_document",
            json=sample_document_request.dict(),
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "processing_id" in data
        assert data["status"] == "started"
        
        processing_id = data["processing_id"]
        
        # Wait for processing to complete (simplified for testing)
        await asyncio.sleep(5)
        
        # Step 2: Check processing status
        status_response = test_client.get(
            f"/processing_status/{processing_id}",
            headers=headers
        )
        assert status_response.status_code == 200
        
        # Step 3: Test hybrid search
        search_request = HybridQueryRequest(
            query="Sarah Johnson machine learning",
            search_type=SearchType.HYBRID,
            limit=5
        )
        
        search_response = test_client.post(
            "/hybrid_search",
            json=search_request.dict(),
            headers=headers
        )
        
        assert search_response.status_code == 200
        search_data = search_response.json()
        assert "results" in search_data
        assert len(search_data["results"]) <= 5
    
    async def test_semantic_search(
        self,
        test_client,
        valid_jwt_token
    ):
        """Test semantic search functionality"""
        headers = {"Authorization": f"Bearer {valid_jwt_token}"}
        
        response = test_client.get(
            "/semantic_memory/search",
            params={
                "query": "machine learning engineer",
                "limit": 3,
                "threshold": 0.6
            },
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert isinstance(data["results"], list)
    
    async def test_knowledge_graph_queries(
        self,
        test_client,
        valid_jwt_token
    ):
        """Test knowledge graph query endpoints"""
        headers = {"Authorization": f"Bearer {valid_jwt_token}"}
        
        # Test entities endpoint
        entities_response = test_client.get(
            "/knowledge_graph/entities",
            params={"entity_type": "person", "limit": 5},
            headers=headers
        )
        
        assert entities_response.status_code == 200
        entities_data = entities_response.json()
        assert "entities" in entities_data
        
        # Test relationships endpoint
        relationships_response = test_client.get(
            "/knowledge_graph/relationships",
            params={"relationship_type": "works_for", "limit": 5},
            headers=headers
        )
        
        assert relationships_response.status_code == 200
        relationships_data = relationships_response.json()
        assert "relationships" in relationships_data
    
    async def test_authentication_required(self, test_client):
        """Test that authentication is required for protected endpoints"""
        # Test without auth header
        response = test_client.post(
            "/process_document",
            json={"content": "test content"}
        )
        assert response.status_code == 403  # or 401
        
        # Test with invalid token
        headers = {"Authorization": "Bearer invalid_token"}
        response = test_client.post(
            "/process_document",
            json={"content": "test content"},
            headers=headers
        )
        assert response.status_code == 401
    
    async def test_hybrid_search_types(
        self,
        test_client,
        valid_jwt_token
    ):
        """Test different search types in hybrid search"""
        headers = {"Authorization": f"Bearer {valid_jwt_token}"}
        
        search_types = [SearchType.SEMANTIC, SearchType.STRUCTURED, SearchType.HYBRID]
        
        for search_type in search_types:
            search_request = HybridQueryRequest(
                query="test query",
                search_type=search_type,
                limit=3
            )
            
            response = test_client.post(
                "/hybrid_search",
                json=search_request.dict(),
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["search_type"] == search_type.value
    
    async def test_error_handling(
        self,
        test_client,
        valid_jwt_token
    ):
        """Test error handling in various scenarios"""
        headers = {"Authorization": f"Bearer {valid_jwt_token}"}
        
        # Test with invalid processing request
        response = test_client.post(
            "/process_document",
            json={"invalid": "data"},
            headers=headers
        )
        assert response.status_code == 422  # Validation error
        
        # Test with non-existent processing status
        status_response = test_client.get(
            "/processing_status/non_existent_id",
            headers=headers
        )
        assert status_response.status_code == 200  # Should return empty or default status
    
    async def test_websocket_connection(self, test_client):
        """Test WebSocket connection functionality"""
        # This would require a WebSocket test client
        # For now, just test that the endpoint exists
        with test_client.websocket_connect("/ws/1") as websocket:
            # Test connection establishment
            data = websocket.receive_text()
            assert "connection_established" in data or "Received" in data


class TestMemoryServiceComponents:
    """Test individual service components"""
    
    @pytest.fixture
    def mock_extraction_result(self):
        """Mock langextract result"""
        return {
            "entities": [
                {
                    "entity_id": "person_12345",
                    "entity_type": "person",
                    "name": "Sarah Johnson",
                    "properties": {
                        "role": "machine learning engineer",
                        "organization": "TechCorp Inc",
                        "skills": ["deep learning", "NLP"]
                    },
                    "confidence_score": 0.9
                }
            ],
            "relationships": [
                {
                    "source_entity_id": "person_12345",
                    "target_entity_id": "org_67890",
                    "relationship_type": "works_for",
                    "confidence_score": 0.8
                }
            ],
            "metadata": {
                "model_used": "test_model",
                "processing_time_ms": 1000
            }
        }
    
    async def test_langextract_service_initialization(self):
        """Test LangExtract service initialization"""
        from ..services.langextract_service import LangExtractService
        
        service = LangExtractService()
        assert service.ollama_url is not None
        assert service.model is not None
    
    async def test_knowledge_graph_service(self, mock_extraction_result):
        """Test knowledge graph service operations"""
        from ..services.knowledge_graph_service import KnowledgeGraphService
        
        kg_service = KnowledgeGraphService()
        
        # Test update method (would need database setup)
        # This is a simplified test
        assert callable(kg_service.update_knowledge_graph)
        assert callable(kg_service.get_entities)
        assert callable(kg_service.get_relationships)
    
    async def test_semantic_memory_service(self):
        """Test semantic memory service operations"""
        from ..services.semantic_memory_service import SemanticMemoryService
        
        semantic_service = SemanticMemoryService()
        assert semantic_service.qdrant_url is not None
        assert semantic_service.collection_name is not None
    
    async def test_memory_curation_service(self):
        """Test memory curation service"""
        from ..services.memory_curation_service import MemoryCurationService
        
        curation_service = MemoryCurationService()
        assert curation_service.ollama_url is not None
        assert curation_service.curation_model is not None
    
    async def test_hybrid_retrieval_service(self):
        """Test hybrid retrieval service initialization"""
        from ..services.hybrid_retrieval_service import HybridRetrievalService
        from ..services.knowledge_graph_service import KnowledgeGraphService
        from ..services.semantic_memory_service import SemanticMemoryService
        
        kg_service = KnowledgeGraphService()
        semantic_service = SemanticMemoryService()
        
        hybrid_service = HybridRetrievalService(kg_service, semantic_service)
        assert hybrid_service.kg_service is not None
        assert hybrid_service.semantic_service is not None
    
    async def test_authentication_service(self):
        """Test authentication service token operations"""
        from ..services.authentication_service import AuthenticationService
        
        auth_service = AuthenticationService()
        
        # Test token creation
        token = auth_service.create_service_token(
            user_id=123,
            service_name="test-service"
        )
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Test token validation
        user_info = await auth_service.validate_token(token)
        assert user_info["user_id"] == 123
        assert user_info["service"] == "test-service"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


if __name__ == "__main__":
    pytest.main([__file__])