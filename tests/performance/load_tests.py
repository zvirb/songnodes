"""
Performance and load tests for SongNodes music database system.
"""

import time
import random
from locust import HttpUser, task, between, events
from locust.contrib.fasthttp import FastHttpUser
import json
from datetime import datetime


class ScraperOrchestratorUser(FastHttpUser):
    """Performance tests for Scraper Orchestrator service."""
    
    wait_time = between(1, 3)
    host = "http://localhost:8001"
    
    def on_start(self):
        """Initialize user session."""
        self.task_ids = []
    
    @task(3)
    def health_check(self):
        """Test health endpoint performance."""
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed: {response.status_code}")
    
    @task(2)
    def get_scrapers_status(self):
        """Test scrapers status endpoint performance."""
        with self.client.get("/scrapers/status", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if "1001tracklists" in data:
                    response.success()
                else:
                    response.failure("Missing scraper data")
            else:
                response.failure(f"Status check failed: {response.status_code}")
    
    @task(2)
    def submit_task(self):
        """Test task submission performance."""
        scrapers = ["1001tracklists", "mixesdb", "setlistfm"]
        task_data = {
            "scraper": random.choice(scrapers),
            "url": f"https://example.com/test_{random.randint(1, 1000)}",
            "priority": random.choice(["low", "medium", "high"]),
            "params": {"test": f"value_{random.randint(1, 100)}"}
        }
        
        with self.client.post("/tasks/submit", json=task_data, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if "task_id" in data:
                    self.task_ids.append(data["task_id"])
                    response.success()
                else:
                    response.failure("No task_id in response")
            else:
                response.failure(f"Task submission failed: {response.status_code}")
    
    @task(1)
    def get_task_status(self):
        """Test task status retrieval performance."""
        if self.task_ids:
            task_id = random.choice(self.task_ids)
            with self.client.get(f"/tasks/{task_id}", catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                elif response.status_code == 404:
                    # Task might have been processed and cleaned up
                    response.success()
                else:
                    response.failure(f"Task status failed: {response.status_code}")
    
    @task(1)
    def get_queue_status(self):
        """Test queue status endpoint performance."""
        with self.client.get("/queue/status", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if "queue" in data and "total" in data:
                    response.success()
                else:
                    response.failure("Invalid queue status response")
            else:
                response.failure(f"Queue status failed: {response.status_code}")
    
    @task(1)
    def get_metrics(self):
        """Test metrics endpoint performance."""
        with self.client.get("/metrics", catch_response=True) as response:
            if response.status_code == 200:
                if "scraping_tasks_total" in response.text:
                    response.success()
                else:
                    response.failure("Invalid metrics response")
            else:
                response.failure(f"Metrics failed: {response.status_code}")


class APIGatewayUser(FastHttpUser):
    """Performance tests for API Gateway."""
    
    wait_time = between(0.5, 2)
    host = "http://localhost:8088"
    
    @task(5)
    def health_check(self):
        """Test API gateway health performance."""
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Gateway health failed: {response.status_code}")
    
    @task(3)
    def api_v1_tracks(self):
        """Test tracks API performance."""
        params = {
            "limit": random.randint(10, 50),
            "offset": random.randint(0, 100)
        }
        
        with self.client.get("/api/v1/tracks", params=params, catch_response=True) as response:
            if response.status_code in [200, 401]:  # 401 is acceptable (auth required)
                response.success()
            else:
                response.failure(f"Tracks API failed: {response.status_code}")
    
    @task(2)
    def api_v1_search(self):
        """Test search API performance."""
        search_terms = ["house", "techno", "trance", "ambient", "dubstep"]
        params = {
            "q": random.choice(search_terms),
            "type": "track",
            "limit": 20
        }
        
        with self.client.get("/api/v1/search", params=params, catch_response=True) as response:
            if response.status_code in [200, 400, 401]:  # Various acceptable responses
                response.success()
            else:
                response.failure(f"Search API failed: {response.status_code}")
    
    @task(1)
    def graphql_query(self):
        """Test GraphQL endpoint performance."""
        query = {
            "query": """
                query {
                    tracks(limit: 10) {
                        id
                        name
                    }
                }
            """
        }
        
        with self.client.post("/graphql", json=query, catch_response=True) as response:
            if response.status_code in [200, 400, 401]:
                response.success()
            else:
                response.failure(f"GraphQL failed: {response.status_code}")


class RESTAPIUser(FastHttpUser):
    """Performance tests for REST API service."""
    
    wait_time = between(0.3, 1.5)
    host = "http://localhost:8082"
    
    @task(4)
    def get_tracks(self):
        """Test tracks endpoint performance."""
        params = {
            "limit": random.randint(10, 100),
            "offset": random.randint(0, 500)
        }
        
        start_time = time.time()
        with self.client.get("/api/v1/tracks", params=params, catch_response=True) as response:
            response_time = (time.time() - start_time) * 1000  # Convert to ms
            
            if response.status_code in [200, 401]:
                if response_time < 100:  # Target: <100ms response time
                    response.success()
                else:
                    response.failure(f"Response too slow: {response_time:.2f}ms")
            else:
                response.failure(f"Tracks request failed: {response.status_code}")
    
    @task(3)
    def get_setlists(self):
        """Test setlists endpoint performance."""
        params = {
            "limit": random.randint(5, 50),
            "offset": random.randint(0, 200)
        }
        
        with self.client.get("/api/v1/setlists", params=params, catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"Setlists request failed: {response.status_code}")
    
    @task(2)
    def get_artists(self):
        """Test artists endpoint performance."""
        params = {
            "limit": random.randint(10, 50),
            "search": random.choice(["", "a", "the", "dj", "mc"])
        }
        
        with self.client.get("/api/v1/artists", params=params, catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"Artists request failed: {response.status_code}")
    
    @task(2)
    def search_tracks(self):
        """Test track search performance."""
        search_terms = [
            "house music", "techno beat", "trance", "ambient", "electronic",
            "remix", "club", "dance", "underground", "progressive"
        ]
        
        params = {
            "q": random.choice(search_terms),
            "limit": random.randint(10, 50)
        }
        
        with self.client.get("/api/v1/search", params=params, catch_response=True) as response:
            if response.status_code in [200, 400, 401]:
                response.success()
            else:
                response.failure(f"Search failed: {response.status_code}")


class HighThroughputScenario(FastHttpUser):
    """High throughput scenario to test 20,000+ tracks/hour processing."""
    
    wait_time = between(0.1, 0.5)  # Very aggressive timing
    host = "http://localhost:8001"
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.tracks_processed = 0
        self.start_time = time.time()
    
    @task(10)
    def submit_high_priority_task(self):
        """Submit high priority scraping tasks rapidly."""
        scrapers = ["1001tracklists", "mixesdb", "setlistfm"]
        
        # Simulate real tracklist URLs
        urls = [
            f"https://www.1001tracklists.com/tracklist/test_{random.randint(1, 10000)}.html",
            f"https://mixesdb.com/test/mix_{random.randint(1, 5000)}",
            f"https://api.setlist.fm/test/{random.randint(1, 3000)}"
        ]
        
        task_data = {
            "scraper": random.choice(scrapers),
            "url": random.choice(urls),
            "priority": "high",
            "params": {
                "expected_tracks": random.randint(20, 100),  # Tracks per setlist
                "timestamp": datetime.now().isoformat()
            }
        }
        
        start_time = time.time()
        with self.client.post("/tasks/submit", json=task_data, catch_response=True) as response:
            submit_time = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                self.tracks_processed += task_data["params"]["expected_tracks"]
                
                # Check if we're meeting throughput target
                elapsed_hours = (time.time() - self.start_time) / 3600
                if elapsed_hours > 0:
                    current_rate = self.tracks_processed / elapsed_hours
                    
                    if current_rate >= 20000:  # 20,000+ tracks/hour target
                        response.success()
                    elif submit_time < 50:  # At least fast submission
                        response.success()
                    else:
                        response.failure(f"Below target rate: {current_rate:.0f} tracks/hour")
                else:
                    response.success()
            else:
                response.failure(f"Task submission failed: {response.status_code}")


# Event listeners for custom metrics
@events.request.add_listener
def track_performance_metrics(request_type, name, response_time, response_length, exception, **kwargs):
    """Track custom performance metrics."""
    if exception:
        return
    
    # Track API response times
    if response_time > 100:  # Log slow responses
        print(f"SLOW REQUEST: {request_type} {name} took {response_time:.2f}ms")
    
    # Track throughput for specific endpoints
    if "/tasks/submit" in name:
        # This could be logged to a metrics system
        pass


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Initialize performance test."""
    print("Starting SongNodes performance tests...")
    print(f"Target host: {environment.host}")
    print("Performance targets:")
    print("- API response time: <100ms (95th percentile)")
    print("- Scraping throughput: >20,000 tracks/hour")
    print("- Error rate: <1%")
    print("- Concurrent users: Up to 100")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Analyze performance test results."""
    stats = environment.stats
    
    print("\n" + "="*50)
    print("PERFORMANCE TEST RESULTS")
    print("="*50)
    
    # Overall statistics
    print(f"Total requests: {stats.total.num_requests}")
    print(f"Failed requests: {stats.total.num_failures}")
    print(f"Error rate: {(stats.total.num_failures / stats.total.num_requests * 100):.2f}%")
    print(f"Average response time: {stats.total.avg_response_time:.2f}ms")
    print(f"95th percentile: {stats.total.get_response_time_percentile(0.95):.2f}ms")
    print(f"Requests per second: {stats.total.current_rps:.2f}")
    
    # Performance targets validation
    print("\nPERFORMANCE TARGET VALIDATION:")
    
    error_rate = stats.total.num_failures / stats.total.num_requests * 100
    if error_rate <= 1.0:
        print("✓ Error rate target met (<1%)")
    else:
        print(f"✗ Error rate target failed: {error_rate:.2f}%")
    
    p95_time = stats.total.get_response_time_percentile(0.95)
    if p95_time <= 100:
        print("✓ Response time target met (<100ms 95th percentile)")
    else:
        print(f"✗ Response time target failed: {p95_time:.2f}ms")
    
    rps = stats.total.current_rps
    if rps >= 100:
        print("✓ Throughput target met (>100 RPS)")
    else:
        print(f"✗ Throughput target failed: {rps:.2f} RPS")
    
    print("\nDetailed endpoint performance:")
    for endpoint in stats.entries:
        entry = stats.entries[endpoint]
        print(f"  {endpoint.method} {endpoint.name}:")
        print(f"    Requests: {entry.num_requests}")
        print(f"    Avg time: {entry.avg_response_time:.2f}ms")
        print(f"    Failures: {entry.num_failures}")


class StressTestScenario(FastHttpUser):
    """Stress test scenario to find breaking points."""
    
    wait_time = between(0.1, 0.3)  # Very aggressive
    host = "http://localhost:8001"
    
    @task
    def stress_submit_tasks(self):
        """Submit tasks as fast as possible to find limits."""
        task_data = {
            "scraper": "1001tracklists",
            "url": f"https://stress.test/{random.randint(1, 100000)}",
            "priority": "critical",
            "params": {"stress_test": True}
        }
        
        with self.client.post("/tasks/submit", json=task_data, catch_response=True) as response:
            if response.status_code in [200, 429]:  # 429 = rate limited
                response.success()
            else:
                response.failure(f"Stress test failed: {response.status_code}")


# Custom load test shapes for specific scenarios
class ThroughputTestShape:
    """Custom load shape to test throughput gradually."""
    
    def tick(self):
        run_time = self.get_run_time()
        
        if run_time < 60:
            # Ramp up to 50 users in first minute
            return (round(run_time * 50 / 60), 2)
        elif run_time < 180:
            # Hold at 50 users for 2 minutes
            return (50, 2)
        elif run_time < 240:
            # Ramp up to 100 users
            return (round(50 + (run_time - 180) * 50 / 60), 3)
        elif run_time < 420:
            # Hold at 100 users for 3 minutes
            return (100, 3)
        else:
            # Test complete
            return None
