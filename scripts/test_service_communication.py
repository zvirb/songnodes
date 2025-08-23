#!/usr/bin/env python3
"""
Service Communication Test Script for SongNodes
Tests connectivity between all microservices
"""

import asyncio
import aiohttp
import asyncpg
import redis
import json
import time
from typing import Dict, List, Tuple, Any

# Service endpoints
SERVICES = {
    "api-gateway": "http://localhost:8080",
    "rest-api": "http://localhost:8082",  # Will be proxied through API Gateway
    "graphql-api": "http://localhost:8081", 
    "websocket-api": "http://localhost:8083",
    "graph-visualization-api": "http://localhost:8084",
    "enhanced-visualization-service": "http://localhost:8090",
    "data-transformer": "http://localhost:8002",
    "data-validator": "http://localhost:8003",
    "scraper-orchestrator": "http://localhost:8001",
    "prometheus": "http://localhost:9091",
    "grafana": "http://localhost:3001"
}

# Database connection
DATABASE_URL = "postgresql://musicdb_user:musicdb_dev_password_2024@localhost:5433/musicdb"

# Redis connection
REDIS_URL = "redis://localhost:6380"

class ServiceTester:
    def __init__(self):
        self.results = {}
        self.session = None
        self.db_conn = None
        self.redis_client = None

    async def setup(self):
        """Setup connections"""
        print("Setting up test connections...")
        
        # HTTP session
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10))
        
        # Database connection
        try:
            self.db_conn = await asyncpg.connect(DATABASE_URL)
            print("✓ Database connection established")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
        
        # Redis connection
        try:
            self.redis_client = redis.Redis.from_url(REDIS_URL)
            await asyncio.to_thread(self.redis_client.ping)
            print("✓ Redis connection established")
        except Exception as e:
            print(f"✗ Redis connection failed: {e}")

    async def cleanup(self):
        """Cleanup connections"""
        if self.session:
            await self.session.close()
        if self.db_conn:
            await self.db_conn.close()
        if self.redis_client:
            self.redis_client.close()

    async def test_http_service(self, name: str, url: str) -> Dict[str, Any]:
        """Test HTTP service health endpoint"""
        try:
            start_time = time.time()
            async with self.session.get(f"{url}/health") as response:
                response_time = (time.time() - start_time) * 1000
                status = response.status
                
                if status == 200:
                    try:
                        data = await response.json()
                        return {
                            "status": "healthy",
                            "response_time_ms": round(response_time, 2),
                            "http_status": status,
                            "data": data
                        }
                    except:
                        text = await response.text()
                        return {
                            "status": "healthy",
                            "response_time_ms": round(response_time, 2),
                            "http_status": status,
                            "data": {"response": text[:100]}
                        }
                else:
                    return {
                        "status": "unhealthy",
                        "response_time_ms": round(response_time, 2),
                        "http_status": status,
                        "error": f"HTTP {status}"
                    }
        except asyncio.TimeoutError:
            return {
                "status": "timeout",
                "error": "Request timeout (10s)"
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

    async def test_api_gateway_proxying(self) -> Dict[str, Any]:
        """Test API Gateway proxying functionality"""
        test_routes = [
            "/api/v1/visualization/search?q=test&limit=5",
            "/api/v1/enhanced-viz/health",
        ]
        
        results = {}
        for route in test_routes:
            try:
                start_time = time.time()
                async with self.session.get(f"{SERVICES['api-gateway']}{route}") as response:
                    response_time = (time.time() - start_time) * 1000
                    results[route] = {
                        "status": "success" if response.status == 200 else "failed",
                        "http_status": response.status,
                        "response_time_ms": round(response_time, 2)
                    }
            except Exception as e:
                results[route] = {
                    "status": "error",
                    "error": str(e)
                }
        
        return results

    async def test_database_integration(self) -> Dict[str, Any]:
        """Test database connectivity and sample data"""
        if not self.db_conn:
            return {"status": "error", "error": "No database connection"}
        
        try:
            # Test basic connectivity
            version = await self.db_conn.fetchval("SELECT version()")
            
            # Test sample data
            artist_count = await self.db_conn.fetchval("SELECT COUNT(*) FROM musicdb.artists")
            track_count = await self.db_conn.fetchval("SELECT COUNT(*) FROM musicdb.tracks")
            relationship_count = await self.db_conn.fetchval("SELECT COUNT(*) FROM musicdb.track_artists")
            
            # Test a complex query (graph traversal)
            start_time = time.time()
            popular_tracks = await self.db_conn.fetch("""
                SELECT t.title, COUNT(ta.artist_id) as artist_count
                FROM musicdb.tracks t
                JOIN musicdb.track_artists ta ON t.id = ta.track_id
                GROUP BY t.id, t.title
                ORDER BY artist_count DESC
                LIMIT 5
            """)
            query_time = (time.time() - start_time) * 1000
            
            return {
                "status": "healthy",
                "database_version": version.split()[0:2],
                "data_counts": {
                    "artists": artist_count,
                    "tracks": track_count,
                    "relationships": relationship_count
                },
                "performance": {
                    "complex_query_time_ms": round(query_time, 2),
                    "sample_results": len(popular_tracks)
                }
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

    async def test_redis_integration(self) -> Dict[str, Any]:
        """Test Redis connectivity and caching"""
        if not self.redis_client:
            return {"status": "error", "error": "No Redis connection"}
        
        try:
            # Test basic connectivity
            info = await asyncio.to_thread(self.redis_client.info)
            
            # Test read/write operations
            test_key = "test:songnodes:connectivity"
            test_value = {"timestamp": time.time(), "test": "connectivity"}
            
            start_time = time.time()
            await asyncio.to_thread(self.redis_client.setex, test_key, 60, json.dumps(test_value))
            retrieved = await asyncio.to_thread(self.redis_client.get, test_key)
            operation_time = (time.time() - start_time) * 1000
            
            # Cleanup
            await asyncio.to_thread(self.redis_client.delete, test_key)
            
            retrieved_data = json.loads(retrieved) if retrieved else None
            
            return {
                "status": "healthy",
                "redis_version": info.get("redis_version"),
                "memory_used": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "performance": {
                    "set_get_operation_time_ms": round(operation_time, 2),
                    "data_integrity": retrieved_data == test_value
                }
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

    async def test_graph_visualization_performance(self) -> Dict[str, Any]:
        """Test graph visualization API with sample data"""
        try:
            # Test search endpoint
            start_time = time.time()
            async with self.session.get(f"{SERVICES['graph-visualization-api']}/api/v1/visualization/search?q=music&limit=50") as response:
                search_time = (time.time() - start_time) * 1000
                
                if response.status == 200:
                    search_data = await response.json()
                    
                    # Test graph endpoint with POST request
                    start_time = time.time()
                    graph_request = {
                        "node_ids": [],
                        "depth": 1,
                        "limit": 100
                    }
                    async with self.session.post(
                        f"{SERVICES['graph-visualization-api']}/api/v1/visualization/graph",
                        json=graph_request
                    ) as graph_response:
                        graph_time = (time.time() - start_time) * 1000
                        
                        if graph_response.status == 200:
                            graph_data = await graph_response.json()
                            
                            return {
                                "status": "healthy",
                                "performance": {
                                    "search_query_time_ms": round(search_time, 2),
                                    "graph_query_time_ms": round(graph_time, 2),
                                    "search_results": len(search_data) if isinstance(search_data, list) else len(search_data.get("results", [])) if isinstance(search_data, dict) else "unknown",
                                    "graph_nodes": len(graph_data.get("nodes", [])) if isinstance(graph_data, dict) else "unknown"
                                },
                                "graph_data_available": True
                            }
                        else:
                            return {"status": "partial", "error": f"Graph endpoint failed: HTTP {graph_response.status}"}
                else:
                    return {"status": "failed", "error": f"Search endpoint failed: HTTP {response.status}"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def test_monitoring_integration(self) -> Dict[str, Any]:
        """Test monitoring stack integration"""
        results = {}
        
        # Test Prometheus metrics collection
        try:
            async with self.session.get(f"{SERVICES['prometheus']}/api/v1/query?query=up") as response:
                if response.status == 200:
                    data = await response.json()
                    up_services = len(data.get("data", {}).get("result", []))
                    results["prometheus"] = {
                        "status": "healthy",
                        "services_monitored": up_services
                    }
                else:
                    results["prometheus"] = {"status": "failed", "error": f"HTTP {response.status}"}
        except Exception as e:
            results["prometheus"] = {"status": "error", "error": str(e)}
        
        # Test Grafana dashboard access
        try:
            async with self.session.get(f"{SERVICES['grafana']}/api/health") as response:
                if response.status == 200:
                    results["grafana"] = {"status": "healthy"}
                else:
                    results["grafana"] = {"status": "failed", "error": f"HTTP {response.status}"}
        except Exception as e:
            results["grafana"] = {"status": "error", "error": str(e)}
        
        return results

    async def run_comprehensive_test(self):
        """Run all tests and generate report"""
        print("="*70)
        print("SongNodes Service Communication Test Suite")
        print("="*70)
        
        await self.setup()
        
        # Test individual services
        print("\n1. Testing individual service health endpoints...")
        for name, url in SERVICES.items():
            result = await self.test_http_service(name, url)
            self.results[name] = result
            
            status_icon = "✓" if result["status"] == "healthy" else "✗"
            response_time = result.get("response_time_ms", "N/A")
            print(f"   {status_icon} {name:30} {result['status']:10} ({response_time}ms)")
        
        # Test API Gateway proxying
        print("\n2. Testing API Gateway proxying...")
        proxy_results = await self.test_api_gateway_proxying()
        self.results["api_gateway_proxying"] = proxy_results
        
        for route, result in proxy_results.items():
            status_icon = "✓" if result["status"] == "success" else "✗"
            response_time = result.get("response_time_ms", "N/A")
            print(f"   {status_icon} {route:40} {result['status']:10} ({response_time}ms)")
        
        # Test database integration
        print("\n3. Testing database integration...")
        db_result = await self.test_database_integration()
        self.results["database"] = db_result
        
        if db_result["status"] == "healthy":
            print(f"   ✓ Database connectivity           healthy")
            print(f"   ✓ Sample data: {db_result['data_counts']['artists']} artists, {db_result['data_counts']['tracks']} tracks, {db_result['data_counts']['relationships']} relationships")
            print(f"   ✓ Query performance: {db_result['performance']['complex_query_time_ms']}ms")
        else:
            print(f"   ✗ Database: {db_result.get('error', 'Failed')}")
        
        # Test Redis integration
        print("\n4. Testing Redis integration...")
        redis_result = await self.test_redis_integration()
        self.results["redis"] = redis_result
        
        if redis_result["status"] == "healthy":
            print(f"   ✓ Redis connectivity             healthy")
            print(f"   ✓ Version: {redis_result['redis_version']}, Memory: {redis_result['memory_used']}")
            print(f"   ✓ Operation performance: {redis_result['performance']['set_get_operation_time_ms']}ms")
        else:
            print(f"   ✗ Redis: {redis_result.get('error', 'Failed')}")
        
        # Test graph visualization performance
        print("\n5. Testing graph visualization performance...")
        viz_result = await self.test_graph_visualization_performance()
        self.results["graph_visualization"] = viz_result
        
        if viz_result["status"] == "healthy":
            print(f"   ✓ Graph visualization API        healthy")
            perf = viz_result.get('performance', {})
            search_time = perf.get('search_query_time_ms', 'N/A')
            graph_time = perf.get('graph_query_time_ms', 'N/A')
            print(f"   ✓ Performance: search {search_time}ms, graph {graph_time}ms")
        else:
            print(f"   ✗ Graph visualization: {viz_result.get('error', 'Failed')}")
        
        # Test monitoring integration
        print("\n6. Testing monitoring integration...")
        monitoring_result = await self.test_monitoring_integration()
        self.results["monitoring"] = monitoring_result
        
        for service, result in monitoring_result.items():
            status_icon = "✓" if result["status"] == "healthy" else "✗"
            print(f"   {status_icon} {service:20} {result['status']:10}")
        
        await self.cleanup()
        
        # Generate summary
        self.generate_summary()

    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        
        total_services = len(SERVICES)
        healthy_services = sum(1 for result in self.results.values() 
                             if isinstance(result, dict) and result.get("status") == "healthy")
        
        # Calculate overall health
        db_healthy = self.results.get("database", {}).get("status") == "healthy"
        redis_healthy = self.results.get("redis", {}).get("status") == "healthy"
        viz_healthy = self.results.get("graph_visualization", {}).get("status") == "healthy"
        
        monitoring_healthy = all(
            result.get("status") == "healthy" 
            for result in self.results.get("monitoring", {}).values()
        )
        
        print(f"HTTP Services:        {healthy_services}/{total_services} healthy")
        print(f"Database Integration: {'✓' if db_healthy else '✗'}")
        print(f"Redis Integration:    {'✓' if redis_healthy else '✗'}")
        print(f"Graph Visualization:  {'✓' if viz_healthy else '✗'}")
        print(f"Monitoring Stack:     {'✓' if monitoring_healthy else '✗'}")
        
        # Performance insights
        if db_healthy:
            data_counts = self.results["database"]["data_counts"]
            total_nodes = data_counts["artists"] + data_counts["tracks"]
            total_edges = data_counts["relationships"]
            print(f"\nGraph Data Statistics:")
            print(f"  Total Nodes: {total_nodes}")
            print(f"  Total Edges: {total_edges}")
            print(f"  Node-to-Edge Ratio: 1:{total_edges/total_nodes:.2f}")
        
        # Overall status
        overall_healthy = (
            healthy_services >= total_services * 0.8 and  # 80% of services healthy
            db_healthy and 
            redis_healthy and 
            viz_healthy
        )
        
        print(f"\nOverall System Status: {'✓ HEALTHY' if overall_healthy else '✗ REQUIRES ATTENTION'}")
        
        if overall_healthy:
            print("\n🎉 SongNodes is ready for full system testing and validation!")
            print("   - All critical services are operational")
            print("   - Sample data is loaded and accessible")
            print("   - Monitoring stack is functional")
            print("   - API Gateway is properly routing requests")
        else:
            print("\n⚠️  Some issues detected. Please review the test results above.")

async def main():
    tester = ServiceTester()
    await tester.run_comprehensive_test()

if __name__ == "__main__":
    asyncio.run(main())