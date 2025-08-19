"""
Comprehensive API Integration Tests for Graph Visualization Service
"""
import pytest
import asyncio
import httpx
import json
import time
from typing import Dict, List, Any
from dataclasses import dataclass
from pathlib import Path

# Test configuration
API_BASE_URL = "http://localhost:8090"
WS_BASE_URL = "ws://localhost:8091"
TEST_TIMEOUT = 30


@dataclass
class PerformanceMetrics:
    """Performance metrics for API tests"""
    response_time: float
    memory_usage: int
    throughput: float
    error_rate: float


class GraphAPITestClient:
    """Enhanced test client for Graph API"""
    
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url, timeout=TEST_TIMEOUT)
        self.performance_metrics: List[PerformanceMetrics] = []
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    async def get(self, endpoint: str, **kwargs) -> httpx.Response:
        """GET request with performance monitoring"""
        start_time = time.time()
        response = await self.client.get(endpoint, **kwargs)
        end_time = time.time()
        
        # Record performance metrics
        self.performance_metrics.append(PerformanceMetrics(
            response_time=end_time - start_time,
            memory_usage=0,  # Would be filled by memory monitoring
            throughput=0,    # Would be calculated based on data size
            error_rate=1.0 if response.status_code >= 400 else 0.0
        ))
        
        return response
    
    async def post(self, endpoint: str, **kwargs) -> httpx.Response:
        """POST request with performance monitoring"""
        start_time = time.time()
        response = await self.client.post(endpoint, **kwargs)
        end_time = time.time()
        
        self.performance_metrics.append(PerformanceMetrics(
            response_time=end_time - start_time,
            memory_usage=0,
            throughput=0,
            error_rate=1.0 if response.status_code >= 400 else 0.0
        ))
        
        return response
    
    def get_average_response_time(self) -> float:
        """Calculate average response time"""
        if not self.performance_metrics:
            return 0.0
        return sum(m.response_time for m in self.performance_metrics) / len(self.performance_metrics)
    
    def get_error_rate(self) -> float:
        """Calculate error rate"""
        if not self.performance_metrics:
            return 0.0
        return sum(m.error_rate for m in self.performance_metrics) / len(self.performance_metrics)


@pytest.fixture
async def api_client():
    """Async API client fixture"""
    async with GraphAPITestClient() as client:
        yield client


@pytest.fixture
def sample_nodes():
    """Sample node data for testing"""
    return [
        {
            "id": "test-node-1",
            "name": "Test Track 1",
            "type": "track",
            "x": 100.0,
            "y": 100.0,
            "metadata": {
                "artist": "Test Artist 1",
                "album": "Test Album",
                "genre": "Electronic",
                "year": 2023
            }
        },
        {
            "id": "test-node-2",
            "name": "Test Track 2",
            "type": "track",
            "x": 200.0,
            "y": 200.0,
            "metadata": {
                "artist": "Test Artist 2",
                "album": "Test Album",
                "genre": "Rock",
                "year": 2023
            }
        }
    ]


@pytest.fixture
def sample_edges():
    """Sample edge data for testing"""
    return [
        {
            "id": "test-edge-1",
            "source": "test-node-1",
            "target": "test-node-2",
            "weight": 0.85,
            "type": "similarity",
            "metadata": {
                "strength": 0.85,
                "reason": "genre_similarity"
            }
        }
    ]


class TestBasicAPIFunctionality:
    """Test basic API endpoints and functionality"""
    
    @pytest.mark.asyncio
    async def test_health_check(self, api_client):
        """Test API health check endpoint"""
        response = await api_client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data
    
    @pytest.mark.asyncio
    async def test_api_info(self, api_client):
        """Test API information endpoint"""
        response = await api_client.get("/api/v1/info")
        
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "description" in data
    
    @pytest.mark.asyncio
    async def test_nodes_endpoint_empty(self, api_client):
        """Test nodes endpoint with empty database"""
        response = await api_client.get("/api/v1/nodes")
        
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "metadata" in data
        assert isinstance(data["nodes"], list)
    
    @pytest.mark.asyncio
    async def test_edges_endpoint_empty(self, api_client):
        """Test edges endpoint with empty database"""
        response = await api_client.get("/api/v1/edges")
        
        assert response.status_code == 200
        data = response.json()
        assert "edges" in data
        assert "metadata" in data
        assert isinstance(data["edges"], list)


class TestNodeOperations:
    """Test node creation, retrieval, and management"""
    
    @pytest.mark.asyncio
    async def test_create_single_node(self, api_client, sample_nodes):
        """Test creating a single node"""
        node_data = sample_nodes[0]
        
        response = await api_client.post(
            "/api/v1/nodes",
            json=node_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == node_data["id"]
        assert data["name"] == node_data["name"]
        assert data["type"] == node_data["type"]
    
    @pytest.mark.asyncio
    async def test_batch_node_creation(self, api_client, sample_nodes):
        """Test batch node creation"""
        batch_data = {
            "batch_id": "test-batch-1",
            "nodes": sample_nodes
        }
        
        response = await api_client.post(
            "/api/v1/nodes/batch",
            json=batch_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["batch_id"] == "test-batch-1"
        assert data["status"] in ["processing", "completed"]
    
    @pytest.mark.asyncio
    async def test_batch_status_check(self, api_client, sample_nodes):
        """Test batch processing status check"""
        # First create a batch
        batch_data = {
            "batch_id": "test-batch-status",
            "nodes": sample_nodes
        }
        
        await api_client.post("/api/v1/nodes/batch", json=batch_data)
        
        # Check status
        response = await api_client.get("/api/v1/batch/test-batch-status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["batch_id"] == "test-batch-status"
        assert "status" in data
        assert "progress" in data
    
    @pytest.mark.asyncio
    async def test_node_validation(self, api_client):
        """Test node data validation"""
        invalid_node = {
            "id": "",  # Invalid empty ID
            "name": "",  # Invalid empty name
            "type": "invalid_type",  # Invalid type
            "x": "not_a_number",  # Invalid coordinate
            "y": None  # Invalid coordinate
        }
        
        response = await api_client.post(
            "/api/v1/nodes",
            json=invalid_node
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert "validation" in data["error"].lower()
    
    @pytest.mark.asyncio
    async def test_get_node_by_id(self, api_client, sample_nodes):
        """Test retrieving a specific node by ID"""
        # First create a node
        node_data = sample_nodes[0]
        await api_client.post("/api/v1/nodes", json=node_data)
        
        # Then retrieve it
        response = await api_client.get(f"/api/v1/nodes/{node_data['id']}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == node_data["id"]
        assert data["name"] == node_data["name"]
    
    @pytest.mark.asyncio
    async def test_update_node(self, api_client, sample_nodes):
        """Test updating a node"""
        # First create a node
        node_data = sample_nodes[0]
        await api_client.post("/api/v1/nodes", json=node_data)
        
        # Update the node
        updated_data = {**node_data, "name": "Updated Test Track 1"}
        response = await api_client.client.put(
            f"/api/v1/nodes/{node_data['id']}",
            json=updated_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Test Track 1"
    
    @pytest.mark.asyncio
    async def test_delete_node(self, api_client, sample_nodes):
        """Test deleting a node"""
        # First create a node
        node_data = sample_nodes[0]
        await api_client.post("/api/v1/nodes", json=node_data)
        
        # Delete the node
        response = await api_client.client.delete(f"/api/v1/nodes/{node_data['id']}")
        
        assert response.status_code == 204
        
        # Verify it's deleted
        response = await api_client.get(f"/api/v1/nodes/{node_data['id']}")
        assert response.status_code == 404


class TestEdgeOperations:
    """Test edge creation, retrieval, and management"""
    
    @pytest.mark.asyncio
    async def test_create_edge(self, api_client, sample_nodes, sample_edges):
        """Test creating an edge between nodes"""
        # First create the nodes
        for node in sample_nodes:
            await api_client.post("/api/v1/nodes", json=node)
        
        # Then create the edge
        edge_data = sample_edges[0]
        response = await api_client.post("/api/v1/edges", json=edge_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["source"] == edge_data["source"]
        assert data["target"] == edge_data["target"]
        assert data["weight"] == edge_data["weight"]
    
    @pytest.mark.asyncio
    async def test_edge_validation(self, api_client):
        """Test edge data validation"""
        invalid_edge = {
            "source": "",  # Invalid empty source
            "target": "",  # Invalid empty target
            "weight": 1.5,  # Invalid weight > 1.0
            "type": ""  # Invalid empty type
        }
        
        response = await api_client.post("/api/v1/edges", json=invalid_edge)
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
    
    @pytest.mark.asyncio
    async def test_get_edges_for_node(self, api_client, sample_nodes, sample_edges):
        """Test retrieving edges for a specific node"""
        # Setup nodes and edges
        for node in sample_nodes:
            await api_client.post("/api/v1/nodes", json=node)
        
        edge_data = sample_edges[0]
        await api_client.post("/api/v1/edges", json=edge_data)
        
        # Get edges for source node
        response = await api_client.get(f"/api/v1/nodes/{edge_data['source']}/edges")
        
        assert response.status_code == 200
        data = response.json()
        assert "edges" in data
        assert len(data["edges"]) > 0


class TestPerformanceAndScaling:
    """Test API performance under load"""
    
    @pytest.mark.asyncio
    async def test_bulk_node_creation_performance(self, api_client):
        """Test performance of bulk node creation"""
        # Generate large dataset
        large_dataset = []
        for i in range(1000):
            large_dataset.append({
                "id": f"perf-node-{i}",
                "name": f"Performance Test Node {i}",
                "type": "track",
                "x": float(i % 100),
                "y": float(i // 100),
                "metadata": {
                    "artist": f"Artist {i % 50}",
                    "genre": ["Electronic", "Rock", "Jazz"][i % 3]
                }
            })
        
        batch_data = {
            "batch_id": "performance-test",
            "nodes": large_dataset
        }
        
        start_time = time.time()
        response = await api_client.post("/api/v1/nodes/batch", json=batch_data)
        end_time = time.time()
        
        assert response.status_code == 200
        
        # Performance assertion: should handle 1000 nodes in < 5 seconds
        processing_time = end_time - start_time
        assert processing_time < 5.0, f"Bulk creation took {processing_time:.2f}s, expected < 5s"
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, api_client, sample_nodes):
        """Test handling concurrent requests"""
        async def create_node(index):
            node_data = {
                **sample_nodes[0],
                "id": f"concurrent-node-{index}",
                "name": f"Concurrent Node {index}"
            }
            return await api_client.post("/api/v1/nodes", json=node_data)
        
        # Create 50 concurrent requests
        tasks = [create_node(i) for i in range(50)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Check that most requests succeeded
        success_count = sum(1 for r in responses if isinstance(r, httpx.Response) and r.status_code == 201)
        assert success_count >= 40, f"Only {success_count}/50 concurrent requests succeeded"
    
    @pytest.mark.asyncio
    async def test_response_time_consistency(self, api_client, sample_nodes):
        """Test response time consistency"""
        response_times = []
        
        for i in range(10):
            node_data = {
                **sample_nodes[0],
                "id": f"timing-node-{i}",
                "name": f"Timing Node {i}"
            }
            
            start_time = time.time()
            response = await api_client.post("/api/v1/nodes", json=node_data)
            end_time = time.time()
            
            assert response.status_code == 201
            response_times.append(end_time - start_time)
        
        # Check consistency: standard deviation should be low
        avg_time = sum(response_times) / len(response_times)
        variance = sum((t - avg_time) ** 2 for t in response_times) / len(response_times)
        std_dev = variance ** 0.5
        
        # Standard deviation should be < 50% of average time
        assert std_dev < avg_time * 0.5, f"Response time inconsistent: avg={avg_time:.3f}s, std={std_dev:.3f}s"


class TestRateLimiting:
    """Test API rate limiting functionality"""
    
    @pytest.mark.asyncio
    async def test_rate_limiting_basic(self, api_client):
        """Test basic rate limiting"""
        # Make rapid requests to trigger rate limiting
        responses = []
        for i in range(100):
            response = await api_client.get("/api/v1/nodes")
            responses.append(response)
            
            if response.status_code == 429:  # Rate limited
                break
        
        # Should eventually hit rate limit
        rate_limited_responses = [r for r in responses if r.status_code == 429]
        assert len(rate_limited_responses) > 0, "Rate limiting not triggered"
    
    @pytest.mark.asyncio
    async def test_rate_limit_headers(self, api_client):
        """Test rate limit headers are present"""
        response = await api_client.get("/api/v1/nodes")
        
        # Check for rate limit headers
        headers = response.headers
        assert "X-RateLimit-Limit" in headers or "RateLimit-Limit" in headers
        assert "X-RateLimit-Remaining" in headers or "RateLimit-Remaining" in headers


class TestErrorHandling:
    """Test API error handling and edge cases"""
    
    @pytest.mark.asyncio
    async def test_invalid_endpoint(self, api_client):
        """Test handling of invalid endpoints"""
        response = await api_client.get("/api/v1/nonexistent")
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_malformed_json(self, api_client):
        """Test handling of malformed JSON"""
        response = await api_client.client.post(
            "/api/v1/nodes",
            content="invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_missing_required_fields(self, api_client):
        """Test handling of missing required fields"""
        incomplete_node = {"name": "Incomplete Node"}  # Missing required fields
        
        response = await api_client.post("/api/v1/nodes", json=incomplete_node)
        assert response.status_code == 400
        
        data = response.json()
        assert "error" in data
    
    @pytest.mark.asyncio
    async def test_duplicate_node_id(self, api_client, sample_nodes):
        """Test handling of duplicate node IDs"""
        node_data = sample_nodes[0]
        
        # Create node first time
        response1 = await api_client.post("/api/v1/nodes", json=node_data)
        assert response1.status_code == 201
        
        # Try to create same node again
        response2 = await api_client.post("/api/v1/nodes", json=node_data)
        assert response2.status_code == 409  # Conflict


class TestDataIntegrity:
    """Test data integrity and consistency"""
    
    @pytest.mark.asyncio
    async def test_edge_referential_integrity(self, api_client):
        """Test that edges require valid node references"""
        invalid_edge = {
            "id": "invalid-edge",
            "source": "nonexistent-node-1",
            "target": "nonexistent-node-2",
            "weight": 0.5,
            "type": "similarity"
        }
        
        response = await api_client.post("/api/v1/edges", json=invalid_edge)
        assert response.status_code == 400  # Should fail due to invalid node references
    
    @pytest.mark.asyncio
    async def test_coordinate_validation(self, api_client):
        """Test coordinate validation"""
        invalid_coordinates = [
            {"x": float('inf'), "y": 100},
            {"x": 100, "y": float('nan')},
            {"x": -1e10, "y": 1e10},  # Extremely large values
        ]
        
        for i, coords in enumerate(invalid_coordinates):
            node_data = {
                "id": f"invalid-coords-{i}",
                "name": f"Invalid Coords Node {i}",
                "type": "track",
                **coords
            }
            
            response = await api_client.post("/api/v1/nodes", json=node_data)
            assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_weight_validation(self, api_client, sample_nodes):
        """Test edge weight validation"""
        # First create nodes
        for node in sample_nodes:
            await api_client.post("/api/v1/nodes", json=node)
        
        invalid_weights = [-0.5, 1.5, float('inf'), float('nan')]
        
        for i, weight in enumerate(invalid_weights):
            edge_data = {
                "id": f"invalid-weight-{i}",
                "source": sample_nodes[0]["id"],
                "target": sample_nodes[1]["id"],
                "weight": weight,
                "type": "similarity"
            }
            
            response = await api_client.post("/api/v1/edges", json=edge_data)
            assert response.status_code == 400


class TestSecurityAndAuthentication:
    """Test security measures and authentication"""
    
    @pytest.mark.asyncio
    async def test_sql_injection_protection(self, api_client):
        """Test protection against SQL injection"""
        malicious_inputs = [
            "'; DROP TABLE nodes; --",
            "1' OR '1'='1",
            "test'; DELETE FROM edges; --"
        ]
        
        for malicious_input in malicious_inputs:
            response = await api_client.get(f"/api/v1/nodes/{malicious_input}")
            # Should return 404 (not found) or 400 (bad request), not 500 (server error)
            assert response.status_code in [400, 404]
    
    @pytest.mark.asyncio
    async def test_xss_protection(self, api_client):
        """Test protection against XSS attacks"""
        xss_payload = "<script>alert('xss')</script>"
        
        node_data = {
            "id": "xss-test",
            "name": xss_payload,
            "type": "track",
            "x": 100,
            "y": 100
        }
        
        response = await api_client.post("/api/v1/nodes", json=node_data)
        
        if response.status_code == 201:
            # If created, check that the data is properly escaped
            data = response.json()
            assert "<script>" not in data.get("name", "")
    
    @pytest.mark.asyncio
    async def test_request_size_limits(self, api_client):
        """Test request size limits"""
        # Create a very large payload
        large_payload = {
            "id": "large-payload-test",
            "name": "A" * 10000,  # Very long name
            "type": "track",
            "x": 100,
            "y": 100,
            "metadata": {
                "description": "B" * 100000  # Very long description
            }
        }
        
        response = await api_client.post("/api/v1/nodes", json=large_payload)
        # Should either accept with truncation or reject with 413 (Payload Too Large)
        assert response.status_code in [201, 400, 413]


@pytest.mark.asyncio
async def test_api_performance_benchmarks():
    """Comprehensive performance benchmark test"""
    async with GraphAPITestClient() as client:
        # Test various scenarios
        scenarios = [
            ("GET /health", lambda: client.get("/health")),
            ("GET /api/v1/nodes", lambda: client.get("/api/v1/nodes")),
            ("POST single node", lambda: client.post("/api/v1/nodes", json={
                "id": f"bench-{time.time()}",
                "name": "Benchmark Node",
                "type": "track",
                "x": 100,
                "y": 100
            })),
        ]
        
        results = {}
        
        for scenario_name, scenario_func in scenarios:
            times = []
            
            # Run each scenario 10 times
            for _ in range(10):
                start_time = time.time()
                response = await scenario_func()
                end_time = time.time()
                
                if response.status_code < 400:
                    times.append(end_time - start_time)
            
            if times:
                results[scenario_name] = {
                    "avg_time": sum(times) / len(times),
                    "min_time": min(times),
                    "max_time": max(times),
                    "count": len(times)
                }
        
        # Assert performance requirements
        assert results["GET /health"]["avg_time"] < 0.1  # Health check < 100ms
        assert results["GET /api/v1/nodes"]["avg_time"] < 0.5  # Node list < 500ms
        assert results["POST single node"]["avg_time"] < 1.0  # Node creation < 1s
        
        # Log results for monitoring
        print("\nPerformance Benchmark Results:")
        for scenario, metrics in results.items():
            print(f"{scenario}: avg={metrics['avg_time']:.3f}s, "
                  f"min={metrics['min_time']:.3f}s, max={metrics['max_time']:.3f}s")


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])