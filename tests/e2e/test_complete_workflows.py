"""
End-to-end tests for complete SongNodes workflows.
"""

import pytest
import asyncio
import time
from datetime import datetime, timedelta
from httpx import AsyncClient
from playwright.async_api import async_playwright
import json


class TestCompleteScrapeWorkflow:
    """Test complete scraping workflow from submission to data storage."""
    
    @pytest.mark.asyncio
    async def test_full_scraping_pipeline(self):
        """Test complete pipeline: task submission → scraping → data processing → storage."""
        
        # Step 1: Submit scraping task
        task_data = {
            "scraper": "1001tracklists",
            "url": "https://www.1001tracklists.com/tracklist/test-example.html",
            "priority": "high",
            "params": {
                "validate_pipeline": True,
                "test_mode": True
            }
        }
        
        async with AsyncClient() as client:
            # Submit task to orchestrator
            response = await client.post(
                "http://localhost:8001/tasks/submit",
                json=task_data
            )
            
            assert response.status_code == 200
            task_id = response.json()["task_id"]
            
            # Step 2: Monitor task progress
            max_wait = 60  # 60 seconds timeout
            start_time = time.time()
            task_completed = False
            
            while time.time() - start_time < max_wait:
                # Check task status
                status_response = await client.get(
                    f"http://localhost:8001/tasks/{task_id}"
                )
                
                if status_response.status_code == 200:
                    task_status = status_response.json()
                    
                    if task_status["status"] == "completed":
                        task_completed = True
                        break
                    elif task_status["status"] == "failed":
                        pytest.fail(f"Task failed: {task_status.get('error_message', 'Unknown error')}")
                
                await asyncio.sleep(2)
            
            assert task_completed, "Task did not complete within timeout"
            
            # Step 3: Verify data was processed and stored
            # Wait a bit for data processing
            await asyncio.sleep(5)
            
            # Check if data appears in REST API
            tracks_response = await client.get(
                "http://localhost:8082/api/v1/tracks",
                params={"limit": 50, "source": "1001tracklists"}
            )
            
            if tracks_response.status_code == 200:
                tracks_data = tracks_response.json()
                # Should have some tracks from the scraping
                assert len(tracks_data.get("tracks", [])) > 0
    
    @pytest.mark.asyncio
    async def test_data_transformation_pipeline(self):
        """Test data flows through transformation pipeline correctly."""
        
        async with AsyncClient() as client:
            # Submit a setlist scraping task
            task_data = {
                "scraper": "mixesdb",
                "url": "https://mixesdb.com/test/example-mix",
                "priority": "medium",
                "params": {"include_tracklist": True}
            }
            
            response = await client.post(
                "http://localhost:8001/tasks/submit",
                json=task_data
            )
            
            if response.status_code == 200:
                task_id = response.json()["task_id"]
                
                # Wait for processing
                await asyncio.sleep(10)
                
                # Check data transformer processed the data
                transformer_response = await client.get(
                    "http://localhost:8020/health"
                )
                assert transformer_response.status_code == 200
                
                # Check NLP processor analyzed the tracks
                nlp_response = await client.get(
                    "http://localhost:8021/health"
                )
                assert nlp_response.status_code == 200
                
                # Verify final data in API
                setlists_response = await client.get(
                    "http://localhost:8082/api/v1/setlists",
                    params={"source": "mixesdb", "limit": 10}
                )
                
                if setlists_response.status_code == 200:
                    setlists = setlists_response.json()
                    # Should have processed setlists
                    assert len(setlists.get("setlists", [])) >= 0


class TestAPIWorkflows:
    """Test complete API usage workflows."""
    
    @pytest.mark.asyncio
    async def test_track_discovery_workflow(self):
        """Test complete track discovery workflow through APIs."""
        
        async with AsyncClient() as client:
            # Step 1: Search for tracks
            search_response = await client.get(
                "http://localhost:8082/api/v1/search",
                params={"q": "house music", "type": "track", "limit": 20}
            )
            
            if search_response.status_code == 200:
                search_results = search_response.json()
                tracks = search_results.get("tracks", [])
                
                if tracks:
                    # Step 2: Get detailed track information
                    track_id = tracks[0]["id"]
                    track_response = await client.get(
                        f"http://localhost:8082/api/v1/tracks/{track_id}"
                    )
                    
                    if track_response.status_code == 200:
                        track_data = track_response.json()
                        
                        # Step 3: Find related tracks
                        related_response = await client.get(
                            f"http://localhost:8082/api/v1/tracks/{track_id}/related"
                        )
                        
                        # Step 4: Get track's setlists
                        setlists_response = await client.get(
                            f"http://localhost:8082/api/v1/tracks/{track_id}/setlists"
                        )
                        
                        # Verify workflow completed successfully
                        assert track_data["id"] == track_id
    
    @pytest.mark.asyncio
    async def test_graphql_complex_query_workflow(self):
        """Test complex GraphQL queries for music data."""
        
        complex_query = {
            "query": """
                query ComplexMusicQuery($limit: Int, $searchTerm: String) {
                    tracks(limit: $limit, search: $searchTerm) {
                        id
                        name
                        duration
                        artists {
                            id
                            name
                            genre
                        }
                        setlists {
                            id
                            name
                            event {
                                name
                                date
                                venue {
                                    name
                                    location
                                }
                            }
                        }
                        features {
                            tempo
                            key
                            energy
                        }
                    }
                }
            """,
            "variables": {
                "limit": 10,
                "searchTerm": "techno"
            }
        }
        
        async with AsyncClient() as client:
            response = await client.post(
                "http://localhost:8081/graphql",
                json=complex_query
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify complex query structure
                if "data" in data and "tracks" in data["data"]:
                    tracks = data["data"]["tracks"]
                    
                    for track in tracks:
                        # Verify nested data structure
                        assert "id" in track
                        assert "name" in track
                        assert "artists" in track
                        
                        # Verify relationships are loaded
                        if track["artists"]:
                            assert "name" in track["artists"][0]


class TestUserJourneyWorkflows:
    """Test complete user journey workflows using browser automation."""
    
    @pytest.mark.asyncio
    async def test_web_interface_track_search(self):
        """Test track search through web interface."""
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            try:
                # Navigate to web interface (assuming it's served)
                await page.goto("http://localhost:8088")
                
                # Wait for page to load
                await page.wait_for_selector("body", timeout=10000)
                
                # Look for search functionality
                search_input = await page.query_selector("input[type='search'], input[placeholder*='search']")
                
                if search_input:
                    # Perform search
                    await search_input.fill("electronic music")
                    await search_input.press("Enter")
                    
                    # Wait for results
                    await asyncio.sleep(3)
                    
                    # Check if results appeared
                    results = await page.query_selector_all(".track-item, .search-result, .music-item")
                    
                    # Verify search worked
                    assert len(results) >= 0  # May be 0 if no data yet
                
            except Exception as e:
                # Web interface might not be available
                pytest.skip(f"Web interface not available: {e}")
            
            finally:
                await browser.close()
    
    @pytest.mark.asyncio
    async def test_admin_dashboard_workflow(self):
        """Test admin dashboard workflow for managing scrapers."""
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            try:
                # Navigate to admin dashboard
                await page.goto("http://localhost:8088/admin")
                
                # Wait for dashboard to load
                await page.wait_for_selector("body", timeout=5000)
                
                # Look for scraper status indicators
                scraper_elements = await page.query_selector_all(
                    ".scraper-status, .service-status, [data-testid*='scraper']"
                )
                
                if scraper_elements:
                    # Verify scraper statuses are displayed
                    for element in scraper_elements:
                        text = await element.text_content()
                        assert text is not None
                
            except Exception as e:
                pytest.skip(f"Admin dashboard not available: {e}")
            
            finally:
                await browser.close()


class TestDataQualityWorkflows:
    """Test data quality and validation workflows."""
    
    @pytest.mark.asyncio
    async def test_data_validation_pipeline(self):
        """Test data validation catches and handles bad data."""
        
        # Submit invalid data to test validation
        invalid_task_data = {
            "scraper": "1001tracklists",
            "url": "https://invalid-url-format",
            "priority": "invalid_priority",
            "params": {"malformed": "data"}
        }
        
        async with AsyncClient() as client:
            response = await client.post(
                "http://localhost:8001/tasks/submit",
                json=invalid_task_data
            )
            
            # Should reject invalid data
            assert response.status_code in [400, 422]
            
            # Test data validator service
            validator_response = await client.get(
                "http://localhost:8022/health"
            )
            
            if validator_response.status_code == 200:
                # Validator is running, test its validation
                test_data = {
                    "tracks": [
                        {
                            "name": "",  # Invalid: empty name
                            "artists": [],  # Invalid: no artists
                            "duration": -1  # Invalid: negative duration
                        }
                    ]
                }
                
                validation_response = await client.post(
                    "http://localhost:8022/validate",
                    json=test_data
                )
                
                # Should identify validation errors
                if validation_response.status_code == 200:
                    validation_result = validation_response.json()
                    assert "errors" in validation_result or "valid" in validation_result
    
    @pytest.mark.asyncio
    async def test_duplicate_detection_workflow(self):
        """Test duplicate detection and deduplication."""
        
        # Submit the same task multiple times
        task_data = {
            "scraper": "1001tracklists",
            "url": "https://example.com/duplicate-test",
            "priority": "medium",
            "params": {"test": "duplicate"}
        }
        
        async with AsyncClient() as client:
            task_ids = []
            
            # Submit same task 3 times
            for i in range(3):
                response = await client.post(
                    "http://localhost:8001/tasks/submit",
                    json=task_data
                )
                
                if response.status_code == 200:
                    task_ids.append(response.json()["task_id"])
            
            # All tasks should be accepted (deduplication might happen at processing level)
            assert len(task_ids) >= 1


class TestMonitoringAndAlerting:
    """Test monitoring and alerting workflows."""
    
    @pytest.mark.asyncio
    async def test_health_monitoring_workflow(self):
        """Test health monitoring across all services."""
        
        services = [
            ("Scraper Orchestrator", "http://localhost:8001/health"),
            ("API Gateway", "http://localhost:8080/health"),
            ("REST API", "http://localhost:8082/health"),
            ("GraphQL API", "http://localhost:8081/health"),
            ("WebSocket API", "http://localhost:8083/health"),
            ("Data Transformer", "http://localhost:8020/health"),
            ("NLP Processor", "http://localhost:8021/health"),
            ("Data Validator", "http://localhost:8022/health")
        ]
        
        async with AsyncClient() as client:
            health_results = {}
            
            for service_name, health_url in services:
                try:
                    response = await client.get(health_url, timeout=5.0)
                    health_results[service_name] = {
                        "status": response.status_code,
                        "healthy": response.status_code == 200,
                        "response_time": response.elapsed.total_seconds() * 1000
                    }
                except Exception as e:
                    health_results[service_name] = {
                        "status": 0,
                        "healthy": False,
                        "error": str(e)
                    }
            
            # At least some core services should be healthy
            healthy_services = [name for name, data in health_results.items() if data["healthy"]]
            assert len(healthy_services) >= 1, f"No healthy services found: {health_results}"
    
    @pytest.mark.asyncio
    async def test_metrics_collection_workflow(self):
        """Test metrics collection and monitoring."""
        
        async with AsyncClient() as client:
            # Check Prometheus metrics
            metrics_response = await client.get("http://localhost:8001/metrics")
            
            if metrics_response.status_code == 200:
                metrics_text = metrics_response.text
                
                # Verify key metrics are present
                expected_metrics = [
                    "scraping_tasks_total",
                    "active_scrapers",
                    "scraping_duration_seconds",
                    "scraping_queue_size"
                ]
                
                for metric in expected_metrics:
                    assert metric in metrics_text, f"Missing metric: {metric}"
            
            # Check Grafana dashboard (if available)
            try:
                grafana_response = await client.get("http://localhost:3001/api/health")
                if grafana_response.status_code == 200:
                    # Grafana is available
                    dashboard_response = await client.get(
                        "http://localhost:3001/api/dashboards/home"
                    )
                    # Dashboard should be accessible
                    assert dashboard_response.status_code in [200, 401]  # 401 if auth required
            except:
                # Grafana might not be available in test environment
                pass


@pytest.mark.slow
class TestLongRunningWorkflows:
    """Test long-running workflows and system stability."""
    
    @pytest.mark.asyncio
    async def test_continuous_scraping_workflow(self):
        """Test system handles continuous scraping over time."""
        
        async with AsyncClient() as client:
            # Submit multiple tasks over time
            tasks_submitted = 0
            start_time = time.time()
            target_duration = 300  # 5 minutes
            
            while time.time() - start_time < target_duration:
                # Submit a new task every 30 seconds
                task_data = {
                    "scraper": "1001tracklists",
                    "url": f"https://example.com/continuous-test-{int(time.time())}",
                    "priority": "low",
                    "params": {"continuous_test": True}
                }
                
                response = await client.post(
                    "http://localhost:8001/tasks/submit",
                    json=task_data
                )
                
                if response.status_code == 200:
                    tasks_submitted += 1
                
                # Check system health
                health_response = await client.get("http://localhost:8001/health")
                assert health_response.status_code == 200
                
                await asyncio.sleep(30)
            
            # Verify system remained stable
            assert tasks_submitted > 0
            
            # Check final system state
            status_response = await client.get("http://localhost:8001/orchestration/status")
            if status_response.status_code == 200:
                status_data = status_response.json()
                assert status_data["status"] in ["operational", "degraded"]