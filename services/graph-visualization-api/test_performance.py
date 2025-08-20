#!/usr/bin/env python3
"""
Performance testing script for Graph Visualization API
Validates <50ms response time and 20,000+ tracks/hour processing capacity
"""

import asyncio
import aiohttp
import time
import json
import statistics
from typing import List, Dict, Any
import random
import uuid
from dataclasses import dataclass

@dataclass
class TestResults:
    endpoint: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time: float
    median_response_time: float
    p95_response_time: float
    p99_response_time: float
    min_response_time: float
    max_response_time: float
    requests_per_second: float

class GraphAPIPerformanceTester:
    def __init__(self, base_url: str = "http://localhost:8084"):
        self.base_url = base_url
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def health_check(self) -> bool:
        """Test if the API is healthy and responding."""
        try:
            async with self.session.get(f"{self.base_url}/health") as response:
                return response.status == 200
        except Exception:
            return False
    
    async def test_single_request(self, url: str, method: str = "GET", data: Dict = None) -> Dict[str, Any]:
        """Test a single API request and measure response time."""
        start_time = time.time()
        try:
            if method == "GET":
                async with self.session.get(url) as response:
                    response_data = await response.json()
                    end_time = time.time()
                    return {
                        'success': True,
                        'response_time': (end_time - start_time) * 1000,  # Convert to milliseconds
                        'status_code': response.status,
                        'data': response_data
                    }
            elif method == "POST":
                async with self.session.post(url, json=data) as response:
                    response_data = await response.json()
                    end_time = time.time()
                    return {
                        'success': True,
                        'response_time': (end_time - start_time) * 1000,
                        'status_code': response.status,
                        'data': response_data
                    }
        except Exception as e:
            end_time = time.time()
            return {
                'success': False,
                'response_time': (end_time - start_time) * 1000,
                'error': str(e)
            }
    
    async def load_test_endpoint(self, endpoint: str, num_requests: int = 100, 
                               concurrent_requests: int = 10, method: str = "GET", 
                               data_generator=None) -> TestResults:
        """Load test a specific endpoint."""
        print(f"Testing {endpoint} with {num_requests} requests, {concurrent_requests} concurrent...")
        
        semaphore = asyncio.Semaphore(concurrent_requests)
        results = []
        start_time = time.time()
        
        async def bounded_request(request_id: int):
            async with semaphore:
                url = f"{self.base_url}{endpoint}"
                data = data_generator(request_id) if data_generator else None
                return await self.test_single_request(url, method, data)
        
        tasks = [bounded_request(i) for i in range(num_requests)]
        results = await asyncio.gather(*tasks)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Analyze results
        successful_results = [r for r in results if r['success']]
        failed_results = [r for r in results if not r['success']]
        
        if successful_results:
            response_times = [r['response_time'] for r in successful_results]
            
            return TestResults(
                endpoint=endpoint,
                total_requests=num_requests,
                successful_requests=len(successful_results),
                failed_requests=len(failed_results),
                avg_response_time=statistics.mean(response_times),
                median_response_time=statistics.median(response_times),
                p95_response_time=self._percentile(response_times, 95),
                p99_response_time=self._percentile(response_times, 99),
                min_response_time=min(response_times),
                max_response_time=max(response_times),
                requests_per_second=len(successful_results) / total_time
            )
        else:
            return TestResults(
                endpoint=endpoint,
                total_requests=num_requests,
                successful_requests=0,
                failed_requests=len(failed_results),
                avg_response_time=0,
                median_response_time=0,
                p95_response_time=0,
                p99_response_time=0,
                min_response_time=0,
                max_response_time=0,
                requests_per_second=0
            )
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile of a dataset."""
        sorted_data = sorted(data)
        index = int((percentile / 100) * len(sorted_data))
        return sorted_data[min(index, len(sorted_data) - 1)]
    
    def generate_graph_query_data(self, request_id: int) -> Dict[str, Any]:
        """Generate test data for graph query endpoints."""
        return {
            "center_node_id": str(uuid.uuid4()) if random.random() > 0.3 else None,
            "max_depth": random.randint(1, 5),
            "max_nodes": random.randint(10, 200),
            "filters": {"genre": random.choice(["electronic", "house", "techno", "trance"])}
        }
    
    def generate_node_batch_data(self, request_id: int) -> Dict[str, Any]:
        """Generate test data for batch node creation."""
        nodes = []
        batch_size = random.randint(10, 100)
        
        for i in range(batch_size):
            nodes.append({
                "track_id": f"track_{request_id}_{i}",
                "x": random.uniform(-100, 100),
                "y": random.uniform(-100, 100),
                "metadata": {
                    "genre": random.choice(["electronic", "house", "techno", "trance"]),
                    "energy": random.uniform(0, 1),
                    "test_batch": True
                }
            })
        
        return {
            "nodes": nodes,
            "batch_id": f"test_batch_{request_id}_{int(time.time())}"
        }
    
    async def run_comprehensive_tests(self) -> Dict[str, TestResults]:
        """Run comprehensive performance tests on all endpoints."""
        print("Starting comprehensive performance tests...")
        
        # Check if API is healthy
        if not await self.health_check():
            print("ERROR: API health check failed. Make sure the service is running.")
            return {}
        
        print("✓ API health check passed")
        
        test_configs = [
            {
                'endpoint': '/health',
                'method': 'GET',
                'num_requests': 200,
                'concurrent_requests': 20,
                'data_generator': None
            },
            {
                'endpoint': '/api/v1/visualization/graph',
                'method': 'POST',
                'num_requests': 100,
                'concurrent_requests': 10,
                'data_generator': self.generate_graph_query_data
            },
            {
                'endpoint': '/api/v1/visualization/nodes/batch',
                'method': 'POST',
                'num_requests': 50,
                'concurrent_requests': 5,
                'data_generator': self.generate_node_batch_data
            },
            {
                'endpoint': '/metrics',
                'method': 'GET',
                'num_requests': 100,
                'concurrent_requests': 10,
                'data_generator': None
            }
        ]
        
        results = {}
        
        for config in test_configs:
            try:
                result = await self.load_test_endpoint(
                    endpoint=config['endpoint'],
                    num_requests=config['num_requests'],
                    concurrent_requests=config['concurrent_requests'],
                    method=config['method'],
                    data_generator=config['data_generator']
                )
                results[config['endpoint']] = result
                print(f"✓ Completed test for {config['endpoint']}")
            except Exception as e:
                print(f"✗ Failed test for {config['endpoint']}: {e}")
        
        return results
    
    def print_results(self, results: Dict[str, TestResults]):
        """Print formatted test results."""
        print("\n" + "="*80)
        print("GRAPH VISUALIZATION API PERFORMANCE TEST RESULTS")
        print("="*80)
        
        for endpoint, result in results.items():
            print(f"\nEndpoint: {endpoint}")
            print("-" * 60)
            print(f"Total Requests:       {result.total_requests}")
            print(f"Successful:           {result.successful_requests}")
            print(f"Failed:               {result.failed_requests}")
            print(f"Success Rate:         {(result.successful_requests/result.total_requests)*100:.1f}%")
            print(f"Requests/Second:      {result.requests_per_second:.1f}")
            
            if result.successful_requests > 0:
                print(f"\nResponse Times (ms):")
                print(f"  Average:            {result.avg_response_time:.1f}")
                print(f"  Median:             {result.median_response_time:.1f}")
                print(f"  95th Percentile:    {result.p95_response_time:.1f}")
                print(f"  99th Percentile:    {result.p99_response_time:.1f}")
                print(f"  Min:                {result.min_response_time:.1f}")
                print(f"  Max:                {result.max_response_time:.1f}")
                
                # Performance target validation
                if result.p95_response_time <= 50:
                    print(f"  ✓ P95 Response Time: PASSED (<50ms target)")
                else:
                    print(f"  ✗ P95 Response Time: FAILED (>{result.p95_response_time:.1f}ms > 50ms target)")
                
                if result.avg_response_time <= 100:
                    print(f"  ✓ Avg Response Time: PASSED (<100ms target)")
                else:
                    print(f"  ✗ Avg Response Time: FAILED (>{result.avg_response_time:.1f}ms > 100ms target)")
        
        # Overall assessment
        print(f"\n" + "="*80)
        print("OVERALL PERFORMANCE ASSESSMENT")
        print("="*80)
        
        graph_endpoint_result = results.get('/api/v1/visualization/graph')
        if graph_endpoint_result:
            meets_latency_target = graph_endpoint_result.p95_response_time <= 50
            meets_throughput_target = graph_endpoint_result.requests_per_second >= 5.5  # 20,000/hour = 5.5/sec
            
            print(f"Latency Target (<50ms P95):     {'✓ PASSED' if meets_latency_target else '✗ FAILED'}")
            print(f"Throughput Target (>5.5 RPS):   {'✓ PASSED' if meets_throughput_target else '✗ FAILED'}")
            
            if meets_latency_target and meets_throughput_target:
                print(f"\n🎉 ALL PERFORMANCE TARGETS MET!")
            else:
                print(f"\n⚠️  PERFORMANCE TARGETS NOT MET - OPTIMIZATION REQUIRED")

async def main():
    """Main test execution function."""
    print("Graph Visualization API Performance Testing")
    print("Target: <50ms P95 response time, 20,000+ tracks/hour capacity")
    print("="*60)
    
    async with GraphAPIPerformanceTester() as tester:
        results = await tester.run_comprehensive_tests()
        tester.print_results(results)

if __name__ == "__main__":
    asyncio.run(main())