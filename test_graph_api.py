#!/usr/bin/env python3
"""
Graph Visualization API Test Suite
Tests all the implemented endpoints for functionality and performance
"""

import asyncio
import aiohttp
import json
import time
import websockets
from datetime import datetime
from typing import Dict, List, Any

# Configuration
BASE_URL = "http://localhost:8084"
WS_URL = "ws://localhost:8084"

class GraphAPITester:
    def __init__(self):
        self.session = None
        self.test_results = []

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def test_health_endpoint(self):
        """Test the health check endpoint"""
        print("🔍 Testing health endpoint...")
        try:
            start_time = time.time()
            async with self.session.get(f"{BASE_URL}/health") as response:
                duration = time.time() - start_time
                data = await response.json()

                success = response.status == 200 and data.get("status") == "healthy"
                self.test_results.append({
                    "test": "health_endpoint",
                    "success": success,
                    "duration": duration,
                    "status_code": response.status,
                    "response": data
                })

                if success:
                    print(f"✅ Health endpoint working - {duration:.3f}s")
                else:
                    print(f"❌ Health endpoint failed - Status: {response.status}")

        except Exception as e:
            print(f"❌ Health endpoint error: {e}")
            self.test_results.append({
                "test": "health_endpoint",
                "success": False,
                "error": str(e)
            })

    async def test_get_nodes_endpoint(self):
        """Test the GET /api/graph/nodes endpoint"""
        print("🔍 Testing nodes endpoint...")
        try:
            start_time = time.time()
            params = {"limit": 10, "offset": 0}
            async with self.session.get(f"{BASE_URL}/api/graph/nodes", params=params) as response:
                duration = time.time() - start_time
                data = await response.json()

                success = response.status == 200 and "nodes" in data
                self.test_results.append({
                    "test": "get_nodes",
                    "success": success,
                    "duration": duration,
                    "status_code": response.status,
                    "node_count": len(data.get("nodes", [])),
                    "total": data.get("total", 0)
                })

                if success:
                    print(f"✅ Nodes endpoint working - {len(data['nodes'])} nodes in {duration:.3f}s")
                    print(f"   Total available: {data.get('total', 0)}")
                else:
                    print(f"❌ Nodes endpoint failed - Status: {response.status}")
                    print(f"   Response: {data}")

        except Exception as e:
            print(f"❌ Nodes endpoint error: {e}")
            self.test_results.append({
                "test": "get_nodes",
                "success": False,
                "error": str(e)
            })

    async def test_get_edges_endpoint(self):
        """Test the GET /api/graph/edges endpoint"""
        print("🔍 Testing edges endpoint...")
        try:
            start_time = time.time()
            params = {"limit": 10, "offset": 0}
            async with self.session.get(f"{BASE_URL}/api/graph/edges", params=params) as response:
                duration = time.time() - start_time
                data = await response.json()

                success = response.status == 200 and "edges" in data
                self.test_results.append({
                    "test": "get_edges",
                    "success": success,
                    "duration": duration,
                    "status_code": response.status,
                    "edge_count": len(data.get("edges", [])),
                    "total": data.get("total", 0)
                })

                if success:
                    print(f"✅ Edges endpoint working - {len(data['edges'])} edges in {duration:.3f}s")
                    print(f"   Total available: {data.get('total', 0)}")
                else:
                    print(f"❌ Edges endpoint failed - Status: {response.status}")
                    print(f"   Response: {data}")

        except Exception as e:
            print(f"❌ Edges endpoint error: {e}")
            self.test_results.append({
                "test": "get_edges",
                "success": False,
                "error": str(e)
            })

    async def test_search_endpoint(self):
        """Test the GET /api/graph/search endpoint"""
        print("🔍 Testing search endpoint...")
        try:
            start_time = time.time()
            params = {"q": "music", "limit": 5}
            async with self.session.get(f"{BASE_URL}/api/graph/search", params=params) as response:
                duration = time.time() - start_time
                data = await response.json()

                success = response.status == 200 and "results" in data
                self.test_results.append({
                    "test": "search",
                    "success": success,
                    "duration": duration,
                    "status_code": response.status,
                    "result_count": len(data.get("results", [])),
                    "query": "music"
                })

                if success:
                    print(f"✅ Search endpoint working - {len(data['results'])} results in {duration:.3f}s")
                    if data.get("suggestions"):
                        print(f"   Suggestions: {data['suggestions']}")
                else:
                    print(f"❌ Search endpoint failed - Status: {response.status}")
                    print(f"   Response: {data}")

        except Exception as e:
            print(f"❌ Search endpoint error: {e}")
            self.test_results.append({
                "test": "search",
                "success": False,
                "error": str(e)
            })

    async def test_pagination(self):
        """Test pagination functionality"""
        print("🔍 Testing pagination...")
        try:
            # Test nodes pagination
            params1 = {"limit": 5, "offset": 0}
            async with self.session.get(f"{BASE_URL}/api/graph/nodes", params=params1) as response1:
                data1 = await response1.json()

            params2 = {"limit": 5, "offset": 5}
            async with self.session.get(f"{BASE_URL}/api/graph/nodes", params=params2) as response2:
                data2 = await response2.json()

            success = (
                response1.status == 200 and response2.status == 200 and
                "nodes" in data1 and "nodes" in data2 and
                data1.get("offset") == 0 and data2.get("offset") == 5
            )

            self.test_results.append({
                "test": "pagination",
                "success": success,
                "page1_count": len(data1.get("nodes", [])),
                "page2_count": len(data2.get("nodes", []))
            })

            if success:
                print(f"✅ Pagination working - Page 1: {len(data1['nodes'])}, Page 2: {len(data2['nodes'])}")
            else:
                print(f"❌ Pagination failed")

        except Exception as e:
            print(f"❌ Pagination test error: {e}")
            self.test_results.append({
                "test": "pagination",
                "success": False,
                "error": str(e)
            })

    async def test_large_dataset_performance(self):
        """Test performance with larger datasets"""
        print("🔍 Testing large dataset performance...")
        try:
            start_time = time.time()
            params = {"limit": 1000, "offset": 0}
            async with self.session.get(f"{BASE_URL}/api/graph/nodes", params=params) as response:
                duration = time.time() - start_time
                data = await response.json()

                success = response.status == 200 and duration < 2.0  # Should be under 2 seconds
                self.test_results.append({
                    "test": "large_dataset_performance",
                    "success": success,
                    "duration": duration,
                    "node_count": len(data.get("nodes", [])),
                    "under_2s": duration < 2.0
                })

                if success:
                    print(f"✅ Large dataset performance good - {len(data['nodes'])} nodes in {duration:.3f}s")
                else:
                    print(f"⚠️  Large dataset performance slow - {duration:.3f}s (target: <2s)")

        except Exception as e:
            print(f"❌ Large dataset performance test error: {e}")
            self.test_results.append({
                "test": "large_dataset_performance",
                "success": False,
                "error": str(e)
            })

    async def test_websocket_endpoint(self):
        """Test the WebSocket endpoint"""
        print("🔍 Testing WebSocket endpoint...")
        try:
            room_id = "test_room"
            ws_url = f"{WS_URL}/api/graph/ws/{room_id}"

            start_time = time.time()
            async with websockets.connect(ws_url) as websocket:
                # Test connection
                await websocket.send(json.dumps({
                    "type": "graph_update",
                    "data": {"test": "data"}
                }))

                # Wait for potential response
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    duration = time.time() - start_time

                    self.test_results.append({
                        "test": "websocket",
                        "success": True,
                        "duration": duration,
                        "connected": True
                    })
                    print(f"✅ WebSocket endpoint working - Connected in {duration:.3f}s")

                except asyncio.TimeoutError:
                    # No response expected for broadcasts, connection success is enough
                    duration = time.time() - start_time
                    self.test_results.append({
                        "test": "websocket",
                        "success": True,
                        "duration": duration,
                        "connected": True
                    })
                    print(f"✅ WebSocket endpoint working - Connected in {duration:.3f}s")

        except Exception as e:
            print(f"❌ WebSocket endpoint error: {e}")
            self.test_results.append({
                "test": "websocket",
                "success": False,
                "error": str(e)
            })

    async def test_metrics_endpoint(self):
        """Test the Prometheus metrics endpoint"""
        print("🔍 Testing metrics endpoint...")
        try:
            start_time = time.time()
            async with self.session.get(f"{BASE_URL}/metrics") as response:
                duration = time.time() - start_time
                text = await response.text()

                success = response.status == 200 and "graph_api_requests_total" in text
                self.test_results.append({
                    "test": "metrics",
                    "success": success,
                    "duration": duration,
                    "status_code": response.status,
                    "has_metrics": "graph_api_requests_total" in text
                })

                if success:
                    print(f"✅ Metrics endpoint working - {duration:.3f}s")
                else:
                    print(f"❌ Metrics endpoint failed - Status: {response.status}")

        except Exception as e:
            print(f"❌ Metrics endpoint error: {e}")
            self.test_results.append({
                "test": "metrics",
                "success": False,
                "error": str(e)
            })

    def generate_report(self):
        """Generate a comprehensive test report"""
        print("\n" + "="*60)
        print("📊 GRAPH VISUALIZATION API TEST REPORT")
        print("="*60)

        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result.get("success", False))

        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()

        print("📋 Test Details:")
        print("-" * 40)

        for result in self.test_results:
            status = "✅ PASS" if result.get("success", False) else "❌ FAIL"
            test_name = result["test"].replace("_", " ").title()
            duration = result.get("duration", 0)

            print(f"{status} {test_name}")
            if duration > 0:
                print(f"    Duration: {duration:.3f}s")

            if "node_count" in result:
                print(f"    Nodes: {result['node_count']}")
            if "edge_count" in result:
                print(f"    Edges: {result['edge_count']}")
            if "total" in result:
                print(f"    Total Available: {result['total']}")
            if "error" in result:
                print(f"    Error: {result['error']}")
            print()

        # Performance analysis
        print("⚡ Performance Analysis:")
        print("-" * 40)

        response_times = [r.get("duration", 0) for r in self.test_results if r.get("duration")]
        if response_times:
            avg_response = sum(response_times) / len(response_times)
            max_response = max(response_times)
            print(f"Average Response Time: {avg_response:.3f}s")
            print(f"Max Response Time: {max_response:.3f}s")
            print(f"Performance Rating: {'🔥 Excellent' if avg_response < 0.1 else '⚡ Good' if avg_response < 0.5 else '⚠️  Acceptable' if avg_response < 1.0 else '🐌 Slow'}")

        print()
        print("💡 API Endpoint Examples:")
        print("-" * 40)
        print(f"Health Check:    GET {BASE_URL}/health")
        print(f"Get Nodes:       GET {BASE_URL}/api/graph/nodes?limit=100&offset=0")
        print(f"Get Edges:       GET {BASE_URL}/api/graph/edges?limit=1000&offset=0")
        print(f"Search:          GET {BASE_URL}/api/graph/search?q=music&limit=20")
        print(f"WebSocket:       WS  {WS_URL}/api/graph/ws/room_id")
        print(f"Metrics:         GET {BASE_URL}/metrics")

        return {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": total_tests - passed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "results": self.test_results
        }

async def main():
    """Run all API tests"""
    print("🚀 Starting Graph Visualization API Tests")
    print(f"Target: {BASE_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)

    async with GraphAPITester() as tester:
        # Run all tests
        await tester.test_health_endpoint()
        await tester.test_get_nodes_endpoint()
        await tester.test_get_edges_endpoint()
        await tester.test_search_endpoint()
        await tester.test_pagination()
        await tester.test_large_dataset_performance()
        await tester.test_websocket_endpoint()
        await tester.test_metrics_endpoint()

        # Generate report
        report = tester.generate_report()

        # Save detailed results
        with open("graph_api_test_results.json", "w") as f:
            json.dump(report, f, indent=2, default=str)

        print(f"\n📄 Detailed results saved to: graph_api_test_results.json")

if __name__ == "__main__":
    asyncio.run(main())