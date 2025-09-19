#!/usr/bin/env python3
"""
Service validation script for Graph Visualization API
Validates all endpoints and integrations work correctly
"""

import asyncio
import json
import sys
from typing import Dict, Any, List
import aiohttp
import time

class ServiceValidator:
    def __init__(self, base_url: str = "http://localhost:8084"):
        self.base_url = base_url
        self.session = None
        self.results = []

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def validate_health_endpoint(self) -> Dict[str, Any]:
        """Validate health check endpoint."""
        try:
            async with self.session.get(f"{self.base_url}/health") as response:
                data = await response.json()
                return {
                    'test': 'Health Check',
                    'passed': response.status == 200 and data.get('status') == 'healthy',
                    'status_code': response.status,
                    'response': data
                }
        except Exception as e:
            return {
                'test': 'Health Check',
                'passed': False,
                'error': str(e)
            }

    async def validate_metrics_endpoint(self) -> Dict[str, Any]:
        """Validate Prometheus metrics endpoint."""
        try:
            async with self.session.get(f"{self.base_url}/metrics") as response:
                content = await response.text()
                has_metrics = 'graph_api_requests_total' in content
                return {
                    'test': 'Metrics Endpoint',
                    'passed': response.status == 200 and has_metrics,
                    'status_code': response.status,
                    'has_custom_metrics': has_metrics
                }
        except Exception as e:
            return {
                'test': 'Metrics Endpoint',
                'passed': False,
                'error': str(e)
            }

    async def validate_graph_query_endpoint(self) -> Dict[str, Any]:
        """Validate graph query endpoint against existing data."""
        query_data = {
            "center_node_id": None,  # Query all nodes
            "max_depth": 3,
            "max_nodes": 50,
            "filters": {}
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/visualization/graph",
                json=query_data
            ) as response:
                data = await response.json()
                
                # Check response structure
                has_nodes = 'nodes' in data
                has_edges = 'edges' in data
                has_metadata = 'metadata' in data
                
                return {
                    'test': 'Graph Query Endpoint',
                    'passed': response.status == 200 and has_nodes and has_edges,
                    'status_code': response.status,
                    'response_structure': {
                        'has_nodes': has_nodes,
                        'has_edges': has_edges,
                        'has_metadata': has_metadata,
                        'node_count': len(data.get('nodes', [])),
                        'edge_count': len(data.get('edges', []))
                    }
                }
        except Exception as e:
            return {
                'test': 'Graph Query Endpoint',
                'passed': False,
                'error': str(e)
            }

    async def validate_batch_endpoint(self) -> Dict[str, Any]:
        """Validate batch node creation endpoint."""
        batch_data = {
            "batch_id": f"test_batch_{int(time.time())}",
            "nodes": [
                {
                    "track_id": "test_track_1",
                    "x": 10.5,
                    "y": 20.3,
                    "metadata": {"test": True, "genre": "electronic"}
                },
                {
                    "track_id": "test_track_2", 
                    "x": -5.2,
                    "y": 15.7,
                    "metadata": {"test": True, "genre": "house"}
                }
            ]
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/visualization/nodes/batch",
                json=batch_data
            ) as response:
                data = await response.json()
                
                has_batch_id = 'batch_id' in data
                has_status = 'status' in data
                is_processing = data.get('status') == 'processing'
                
                return {
                    'test': 'Batch Creation Endpoint',
                    'passed': response.status == 200 and has_batch_id and is_processing,
                    'status_code': response.status,
                    'response': data
                }
        except Exception as e:
            return {
                'test': 'Batch Creation Endpoint',
                'passed': False,
                'error': str(e)
            }

    async def validate_performance(self) -> Dict[str, Any]:
        """Test basic performance characteristics."""
        num_requests = 10
        times = []
        
        try:
            for _ in range(num_requests):
                start_time = time.time()
                async with self.session.get(f"{self.base_url}/health") as response:
                    await response.json()
                    end_time = time.time()
                    if response.status == 200:
                        times.append((end_time - start_time) * 1000)  # Convert to ms
            
            if times:
                avg_time = sum(times) / len(times)
                max_time = max(times)
                meets_target = avg_time < 100  # Target <100ms average
                
                return {
                    'test': 'Performance Validation',
                    'passed': meets_target,
                    'avg_response_time_ms': round(avg_time, 2),
                    'max_response_time_ms': round(max_time, 2),
                    'meets_target': meets_target,
                    'target_ms': 100
                }
            else:
                return {
                    'test': 'Performance Validation',
                    'passed': False,
                    'error': 'No successful requests'
                }
        except Exception as e:
            return {
                'test': 'Performance Validation',
                'passed': False,
                'error': str(e)
            }

    async def run_all_validations(self) -> List[Dict[str, Any]]:
        """Run all validation tests."""
        validations = [
            self.validate_health_endpoint(),
            self.validate_metrics_endpoint(),
            self.validate_graph_query_endpoint(),
            self.validate_batch_endpoint(),
            self.validate_performance()
        ]
        
        results = await asyncio.gather(*validations, return_exceptions=True)
        
        # Convert exceptions to error results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    'test': f'Validation {i+1}',
                    'passed': False,
                    'error': str(result)
                })
            else:
                processed_results.append(result)
        
        return processed_results

    def print_results(self, results: List[Dict[str, Any]]):
        """Print formatted validation results."""
        print("\n" + "="*70)
        print("GRAPH VISUALIZATION API SERVICE VALIDATION")
        print("="*70)
        
        passed_count = 0
        total_count = len(results)
        
        for result in results:
            test_name = result.get('test', 'Unknown Test')
            passed = result.get('passed', False)
            status = "✓ PASSED" if passed else "✗ FAILED"
            
            print(f"\n{test_name}: {status}")
            
            if passed:
                passed_count += 1
                # Print additional details for successful tests
                if 'response_structure' in result:
                    structure = result['response_structure']
                    print(f"  - Nodes returned: {structure.get('node_count', 0)}")
                    print(f"  - Edges returned: {structure.get('edge_count', 0)}")
                
                if 'avg_response_time_ms' in result:
                    print(f"  - Average response time: {result['avg_response_time_ms']}ms")
                    print(f"  - Max response time: {result['max_response_time_ms']}ms")
                    
                if 'status_code' in result:
                    print(f"  - Status code: {result['status_code']}")
            else:
                # Print error details for failed tests
                if 'error' in result:
                    print(f"  - Error: {result['error']}")
                if 'status_code' in result:
                    print(f"  - Status code: {result['status_code']}")
        
        # Overall summary
        print(f"\n" + "="*70)
        print(f"SUMMARY: {passed_count}/{total_count} tests passed")
        
        if passed_count == total_count:
            print("🎉 ALL VALIDATIONS PASSED - Service is ready for production!")
            return True
        else:
            print("⚠️  SOME VALIDATIONS FAILED - Service requires attention")
            return False

async def main():
    """Main validation execution."""
    print("Graph Visualization API Service Validation")
    print("Testing all endpoints and functionality...")
    
    async with ServiceValidator() as validator:
        results = await validator.run_all_validations()
        success = validator.print_results(results)
        return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
