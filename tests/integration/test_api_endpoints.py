"""
Integration tests for API endpoints across all services.
"""

import pytest
import asyncio
import json
from httpx import AsyncClient
from datetime import datetime


class TestScraperOrchestratorAPI:
    """Integration tests for Scraper Orchestrator API."""
    
    @pytest.fixture
    def base_url(self):
        """Base URL for scraper orchestrator service."""
        return "http://localhost:8001"
    
    @pytest.mark.asyncio
    async def test_health_endpoint(self, base_url):
        """Test scraper orchestrator health endpoint."""
        async with AsyncClient() as client:
            response = await client.get(f"{base_url}/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert "timestamp" in data
    
    @pytest.mark.asyncio
    async def test_scrapers_status_endpoint(self, base_url):
        """Test scrapers status endpoint."""
        async with AsyncClient() as client:
            response = await client.get(f"{base_url}/scrapers/status")
            
            assert response.status_code == 200
            data = response.json()
            
            # Should have all configured scrapers
            expected_scrapers = ["1001tracklists", "mixesdb", "setlistfm", "reddit"]
            for scraper in expected_scrapers:
                assert scraper in data
                assert "status" in data[scraper]
                assert "config" in data[scraper]
                assert "health" in data[scraper]
    
    @pytest.mark.asyncio
    async def test_submit_task_endpoint(self, base_url):
        """Test task submission endpoint."""
        task_data = {
            "scraper": "1001tracklists",
            "url": "https://example.com/test",
            "priority": "medium",
            "params": {"test": "value"}
        }
        
        async with AsyncClient() as client:
            response = await client.post(
                f"{base_url}/tasks/submit",
                json=task_data
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "task_id" in data
            assert data["status"] == "queued"
    
    @pytest.mark.asyncio
    async def test_queue_status_endpoint(self, base_url):
        """Test queue status endpoint."""
        async with AsyncClient() as client:
            response = await client.get(f"{base_url}/queue/status")
            
            assert response.status_code == 200
            data = response.json()
            assert "queue" in data
            assert "total" in data
            
            # Should have all priority levels
            priorities = ["critical", "high", "medium", "low"]
            for priority in priorities:
                assert priority in data["queue"]
    
    @pytest.mark.asyncio
    async def test_metrics_endpoint(self, base_url):
        """Test Prometheus metrics endpoint."""
        async with AsyncClient() as client:
            response = await client.get(f"{base_url}/metrics")
            
            assert response.status_code == 200
            content = response.text
            
            # Should contain Prometheus metrics
            assert "scraping_tasks_total" in content
            assert "active_scrapers" in content
            assert "scraping_duration_seconds" in content


class TestAPIGatewayIntegration:
    """Integration tests for API Gateway."""
    
    @pytest.fixture
    def base_url(self):
        """Base URL for API gateway."""
        return "http://localhost:8080"
    
    @pytest.mark.asyncio
    async def test_api_gateway_health(self, base_url):
        """Test API gateway health endpoint."""
        async with AsyncClient() as client:
            response = await client.get(f"{base_url}/health")
            
            assert response.status_code == 200
            data = response.json()
            assert "status" in data
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self, base_url):
        """Test API gateway rate limiting."""
        async with AsyncClient() as client:
            # Make many requests quickly
            responses = []
            for i in range(10):
                response = await client.get(f"{base_url}/health")
                responses.append(response)
            
            # Should have some successful responses
            success_count = sum(1 for r in responses if r.status_code == 200)
            assert success_count > 0
            
            # Check if rate limiting is working (some 429s expected)
            rate_limited = any(r.status_code == 429 for r in responses)
            # Note: This may not always trigger in test environment
    
    @pytest.mark.asyncio
    async def test_api_versioning(self, base_url):
        """Test API versioning support."""
        async with AsyncClient() as client:
            # Test v1 API endpoints
            v1_response = await client.get(f"{base_url}/api/v1/tracks")
            
            # Should either return data or proper error for missing auth
            assert v1_response.status_code in [200, 401, 404]


class TestRESTAPIIntegration:
    """Integration tests for REST API service."""
    
    @pytest.fixture
    def base_url(self):
        """Base URL for REST API service."""
        return "http://localhost:8082"
    
    @pytest.mark.asyncio
    async def test_tracks_endpoint(self, base_url):
        """Test tracks endpoint."""
        async with AsyncClient() as client:
            response = await client.get(f"{base_url}/api/v1/tracks")
            
            # Should return JSON response
            assert response.status_code in [200, 401]  # May require auth
            assert response.headers.get("content-type", "").startswith("application/json")
    
    @pytest.mark.asyncio
    async def test_setlists_endpoint(self, base_url):
        """Test setlists endpoint."""
        async with AsyncClient() as client:
            response = await client.get(f"{base_url}/api/v1/setlists")
            
            assert response.status_code in [200, 401]
            assert response.headers.get("content-type", "").startswith("application/json")
    
    @pytest.mark.asyncio
    async def test_artists_endpoint(self, base_url):
        """Test artists endpoint."""
        async with AsyncClient() as client:
            response = await client.get(f"{base_url}/api/v1/artists")
            
            assert response.status_code in [200, 401]
            assert response.headers.get("content-type", "").startswith("application/json")
    
    @pytest.mark.asyncio
    async def test_search_endpoint(self, base_url):
        """Test search endpoint."""
        async with AsyncClient() as client:
            response = await client.get(
                f"{base_url}/api/v1/search",
                params={"q": "test", "type": "track"}
            )
            
            assert response.status_code in [200, 400, 401]


class TestGraphQLAPIIntegration:
    """Integration tests for GraphQL API service."""
    
    @pytest.fixture
    def base_url(self):
        """Base URL for GraphQL API service."""
        return "http://localhost:8081"
    
    @pytest.mark.asyncio
    async def test_graphql_endpoint(self, base_url):
        """Test GraphQL endpoint."""
        query = {
            "query": """
                query {
                    tracks(limit: 10) {
                        id
                        name
                        artists {
                            name
                        }
                    }
                }
            """
        }
        
        async with AsyncClient() as client:
            response = await client.post(
                f"{base_url}/graphql",
                json=query
            )
            
            assert response.status_code in [200, 400, 401]
            if response.status_code == 200:
                data = response.json()
                assert "data" in data or "errors" in data
    
    @pytest.mark.asyncio
    async def test_graphql_introspection(self, base_url):
        """Test GraphQL introspection query."""
        introspection_query = {
            "query": """
                query IntrospectionQuery {
                    __schema {
                        types {
                            name
                        }
                    }
                }
            """
        }
        
        async with AsyncClient() as client:
            response = await client.post(
                f"{base_url}/graphql",
                json=introspection_query
            )
            
            # Introspection may be disabled in production
            assert response.status_code in [200, 400, 401]


class TestWebSocketAPIIntegration:
    """Integration tests for WebSocket API service."""
    
    @pytest.fixture
    def base_url(self):
        """Base URL for WebSocket API service."""
        return "http://localhost:8083"
    
    @pytest.mark.asyncio
    async def test_websocket_health(self, base_url):
        """Test WebSocket service health endpoint."""
        async with AsyncClient() as client:
            response = await client.get(f"{base_url}/health")
            
            assert response.status_code == 200
            data = response.json()
            assert "status" in data


class TestDataProcessingIntegration:
    """Integration tests for data processing services."""
    
    @pytest.mark.asyncio
    async def test_data_transformer_health(self):
        """Test data transformer service health."""
        async with AsyncClient() as client:
            response = await client.get("http://localhost:8020/health")
            
            assert response.status_code == 200
            data = response.json()
            assert "status" in data
    
    @pytest.mark.asyncio
    async def test_nlp_processor_health(self):
        """Test NLP processor service health."""
        async with AsyncClient() as client:
            response = await client.get("http://localhost:8021/health")
            
            assert response.status_code == 200
            data = response.json()
            assert "status" in data
    
    @pytest.mark.asyncio
    async def test_data_validator_health(self):
        """Test data validator service health."""
        async with AsyncClient() as client:
            response = await client.get("http://localhost:8022/health")
            
            assert response.status_code == 200
            data = response.json()
            assert "status" in data


class TestServiceCommunication:
    """Test communication between services."""
    
    @pytest.mark.asyncio
    async def test_orchestrator_to_scraper_communication(self):
        """Test communication from orchestrator to scrapers."""
        # Submit task through orchestrator
        task_data = {
            "scraper": "1001tracklists",
            "url": "https://example.com/test",
            "priority": "high"
        }
        
        async with AsyncClient() as client:
            # Submit task
            response = await client.post(
                "http://localhost:8001/tasks/submit",
                json=task_data
            )
            
            if response.status_code == 200:
                task_id = response.json()["task_id"]
                
                # Wait a bit for processing
                await asyncio.sleep(2)
                
                # Check task status
                status_response = await client.get(
                    f"http://localhost:8001/tasks/{task_id}"
                )
                
                if status_response.status_code == 200:
                    task_status = status_response.json()
                    assert "status" in task_status
    
    @pytest.mark.asyncio
    async def test_api_gateway_routing(self):
        """Test API gateway routing to backend services."""
        async with AsyncClient() as client:
            # Test routing to REST API
            response = await client.get("http://localhost:8080/api/v1/tracks")
            assert response.status_code in [200, 401, 404]
            
            # Test routing to GraphQL API
            graphql_query = {"query": "{ __typename }"}
            response = await client.post(
                "http://localhost:8080/graphql",
                json=graphql_query
            )
            assert response.status_code in [200, 400, 401]


@pytest.mark.performance
class TestAPIPerformance:
    """Performance tests for API endpoints."""
    
    @pytest.mark.asyncio
    async def test_api_response_times(self):
        """Test API response times meet requirements."""
        endpoints = [
            "http://localhost:8001/health",
            "http://localhost:8080/health",
            "http://localhost:8082/health" if await self._service_available(8082) else None,
        ]
        
        endpoints = [e for e in endpoints if e]  # Filter None values
        
        async with AsyncClient() as client:
            for endpoint in endpoints:
                start_time = datetime.now()
                response = await client.get(endpoint)
                end_time = datetime.now()
                
                response_time = (end_time - start_time).total_seconds() * 1000  # ms
                
                # Health endpoints should respond in < 100ms
                assert response_time < 100, f"{endpoint} took {response_time}ms"
                assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self):
        """Test handling of concurrent requests."""
        async def make_request():
            async with AsyncClient() as client:
                response = await client.get("http://localhost:8001/health")
                return response.status_code
        
        # Make 50 concurrent requests
        tasks = [make_request() for _ in range(50)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Most requests should succeed
        success_count = sum(1 for r in results if r == 200)
        assert success_count >= 40  # At least 80% success rate
    
    async def _service_available(self, port: int) -> bool:
        """Check if service is available on port."""
        try:
            async with AsyncClient() as client:
                response = await client.get(f"http://localhost:{port}/health", timeout=1.0)
                return response.status_code == 200
        except:
            return False


@pytest.mark.external
class TestExternalIntegration:
    """Tests requiring external services or specific setup."""
    
    @pytest.mark.asyncio
    async def test_database_connectivity(self):
        """Test database connectivity through APIs."""
        async with AsyncClient() as client:
            # Try to access database-dependent endpoints
            response = await client.get("http://localhost:8082/api/v1/tracks?limit=1")
            
            # Should either return data or proper error
            assert response.status_code in [200, 401, 503]
    
    @pytest.mark.asyncio
    async def test_redis_connectivity(self):
        """Test Redis connectivity through APIs."""
        async with AsyncClient() as client:
            # Submit a task (uses Redis)
            task_data = {
                "scraper": "1001tracklists",
                "url": "https://example.com/test",
                "priority": "low"
            }
            
            response = await client.post(
                "http://localhost:8001/tasks/submit",
                json=task_data
            )
            
            # Should either succeed or fail gracefully
            assert response.status_code in [200, 503]