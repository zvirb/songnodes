#!/usr/bin/env python3
"""
Performance Validation Script for Data Transformer Optimization
Tests the batch operation optimization that should improve response times from 2,957ms to <200ms
"""

import asyncio
import aiohttp
import json
import time
import statistics
from datetime import datetime, timedelta
from typing import List, Dict, Any

class PerformanceValidator:
    def __init__(self, base_url: str = "http://localhost:8002"):
        self.base_url = base_url
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def health_check(self) -> Dict[str, Any]:
        """Check service health and performance status"""
        try:
            start_time = time.time()
            async with self.session.get(f"{self.base_url}/health") as response:
                response_time = (time.time() - start_time) * 1000
                health_data = await response.json()
                health_data["endpoint_response_time_ms"] = response_time
                return health_data
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}
    
    def generate_test_tracks(self, count: int) -> List[Dict[str, Any]]:
        """Generate test track data for performance testing"""
        tracks = []
        for i in range(count):
            track = {
                "source": "1001tracklists",
                "source_id": f"test_track_{i}_{int(time.time())}",
                "title": f"Test Track {i}",
                "artist": f"Test Artist {i % 10}",  # Some duplicate artists for deduplication testing
                "album": f"Test Album {i % 5}" if i % 3 == 0 else None,
                "genre": ["House", "Techno", "Trance", "Electronic"][i % 4],
                "label": f"Test Label {i % 3}" if i % 4 == 0 else None,
                "release_date": "2024-01-01",
                "duration": f"{3 + (i % 5)}:30",
                "bpm": 120 + (i % 20),
                "key": ["C", "D", "E", "F", "G", "A", "B"][i % 7],
                "url": f"https://example.com/track/{i}",
                "metadata": {
                    "test_run": True,
                    "batch_size": count,
                    "track_index": i
                },
                "raw_data": {
                    "original_source": "performance_test"
                }
            }
            tracks.append(track)
        return tracks
    
    async def test_direct_normalization(self, batch_size: int) -> Dict[str, Any]:
        """Test direct track normalization endpoint"""
        tracks = self.generate_test_tracks(batch_size)
        
        start_time = time.time()
        
        try:
            async with self.session.post(
                f"{self.base_url}/normalize",
                json=tracks,
                headers={"Content-Type": "application/json"}
            ) as response:
                end_time = time.time()
                response_time = (end_time - start_time) * 1000  # Convert to ms
                
                if response.status == 200:
                    result = await response.json()
                    return {
                        "success": True,
                        "batch_size": batch_size,
                        "response_time_ms": response_time,
                        "input_count": result.get("input_count", 0),
                        "output_count": result.get("output_count", 0),
                        "avg_time_per_track_ms": response_time / batch_size if batch_size > 0 else 0,
                        "throughput_tracks_per_sec": batch_size / (response_time / 1000) if response_time > 0 else 0
                    }
                else:
                    error_text = await response.text()
                    return {
                        "success": False,
                        "batch_size": batch_size,
                        "response_time_ms": response_time,
                        "error": f"HTTP {response.status}: {error_text}"
                    }
                    
        except Exception as e:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000
            return {
                "success": False,
                "batch_size": batch_size,
                "response_time_ms": response_time,
                "error": str(e)
            }
    
    async def test_transformation_task(self, batch_size: int, operation: str = "normalize") -> Dict[str, Any]:
        """Test asynchronous transformation task"""
        tracks = self.generate_test_tracks(batch_size)
        
        # Submit transformation task
        task_data = {
            "operation": operation,
            "source_data": tracks,
            "priority": 5
        }
        
        submit_start = time.time()
        
        try:
            # Submit task
            async with self.session.post(
                f"{self.base_url}/transform",
                json=task_data,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    return {
                        "success": False,
                        "error": f"Task submission failed: HTTP {response.status}: {error_text}"
                    }
                
                task_response = await response.json()
                task_id = task_response.get("task_id")
                
                if not task_id:
                    return {"success": False, "error": "No task ID returned"}
            
            # Poll for completion
            max_wait_time = 60  # 60 seconds max
            poll_interval = 0.5  # 500ms
            total_wait_time = 0
            
            while total_wait_time < max_wait_time:
                await asyncio.sleep(poll_interval)
                total_wait_time += poll_interval
                
                async with self.session.get(f"{self.base_url}/tasks/{task_id}") as response:
                    if response.status == 200:
                        task_status = await response.json()
                        status = task_status.get("status", "unknown")
                        
                        if status == "completed":
                            total_time = (time.time() - submit_start) * 1000
                            
                            return {
                                "success": True,
                                "batch_size": batch_size,
                                "total_time_ms": total_time,
                                "processing_time": float(task_status.get("processing_time", 0)) * 1000,
                                "task_status": task_status,
                                "avg_time_per_track_ms": total_time / batch_size if batch_size > 0 else 0
                            }
                        elif status == "failed":
                            return {
                                "success": False,
                                "batch_size": batch_size,
                                "error": f"Task failed: {task_status.get('error_message', 'Unknown error')}"
                            }
            
            # Timeout
            return {
                "success": False,
                "batch_size": batch_size,
                "error": f"Task did not complete within {max_wait_time} seconds"
            }
            
        except Exception as e:
            return {
                "success": False,
                "batch_size": batch_size,
                "error": str(e)
            }
    
    async def run_performance_benchmark(self) -> Dict[str, Any]:
        """Run comprehensive performance benchmark"""
        print("🚀 Starting Data Transformer Performance Validation")
        print("=" * 60)
        
        # Test different batch sizes
        batch_sizes = [1, 10, 50, 100, 250, 500]
        results = {
            "timestamp": datetime.now().isoformat(),
            "health_check": {},
            "direct_normalization": [],
            "async_transformation": [],
            "performance_summary": {}
        }
        
        # Health check
        print("\n📊 Checking service health...")
        health = await self.health_check()
        results["health_check"] = health
        print(f"Service Status: {health.get('status', 'unknown')}")
        if health.get("performance_status"):
            print(f"Performance Status: {health['performance_status']}")
        
        # Test direct normalization
        print("\n🔄 Testing Direct Normalization Performance...")
        direct_results = []
        
        for batch_size in batch_sizes:
            print(f"Testing batch size: {batch_size} tracks...")
            result = await self.test_direct_normalization(batch_size)
            direct_results.append(result)
            
            if result["success"]:
                print(f"  ✅ Success: {result['response_time_ms']:.1f}ms "
                      f"({result['avg_time_per_track_ms']:.1f}ms per track, "
                      f"{result['throughput_tracks_per_sec']:.1f} tracks/sec)")
            else:
                print(f"  ❌ Failed: {result.get('error', 'Unknown error')}")
        
        results["direct_normalization"] = direct_results
        
        # Test async transformation
        print("\n⚡ Testing Asynchronous Transformation Performance...")
        async_results = []
        
        for batch_size in [10, 50, 100]:  # Smaller set for async testing
            print(f"Testing async batch size: {batch_size} tracks...")
            result = await self.test_transformation_task(batch_size)
            async_results.append(result)
            
            if result["success"]:
                print(f"  ✅ Success: {result['total_time_ms']:.1f}ms total "
                      f"({result['processing_time']:.1f}ms processing, "
                      f"{result['avg_time_per_track_ms']:.1f}ms per track)")
            else:
                print(f"  ❌ Failed: {result.get('error', 'Unknown error')}")
        
        results["async_transformation"] = async_results
        
        # Performance summary
        successful_direct = [r for r in direct_results if r["success"]]
        if successful_direct:
            response_times = [r["response_time_ms"] for r in successful_direct]
            per_track_times = [r["avg_time_per_track_ms"] for r in successful_direct]
            throughputs = [r["throughput_tracks_per_sec"] for r in successful_direct]
            
            summary = {
                "direct_normalization": {
                    "test_count": len(successful_direct),
                    "min_response_time_ms": min(response_times),
                    "max_response_time_ms": max(response_times),
                    "avg_response_time_ms": statistics.mean(response_times),
                    "min_per_track_ms": min(per_track_times),
                    "max_per_track_ms": max(per_track_times),
                    "avg_per_track_ms": statistics.mean(per_track_times),
                    "max_throughput_tracks_per_sec": max(throughputs),
                    "performance_target_met": max(response_times) < 200  # Target: <200ms
                }
            }
            
            results["performance_summary"] = summary
            
            print("\n📈 Performance Summary:")
            print(f"Response Time Range: {min(response_times):.1f}ms - {max(response_times):.1f}ms")
            print(f"Average Per-Track Time: {statistics.mean(per_track_times):.1f}ms")
            print(f"Maximum Throughput: {max(throughputs):.1f} tracks/sec")
            
            # Performance assessment
            if max(response_times) < 200:
                print("✅ PERFORMANCE TARGET MET: All operations under 200ms")
                print(f"🎯 Improvement from baseline 2,957ms: {((2957 - max(response_times)) / 2957 * 100):.1f}%")
            else:
                print(f"⚠️  PERFORMANCE TARGET MISSED: Max response time {max(response_times):.1f}ms > 200ms target")
        
        return results

async def main():
    """Main performance validation function"""
    validator = PerformanceValidator()
    
    try:
        async with validator:
            results = await validator.run_performance_benchmark()
            
            # Save results
            results_file = f"performance_validation_{int(time.time())}.json"
            with open(results_file, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            
            print(f"\n💾 Results saved to: {results_file}")
            return results
            
    except Exception as e:
        print(f"❌ Validation failed: {str(e)}")
        return None

if __name__ == "__main__":
    asyncio.run(main())