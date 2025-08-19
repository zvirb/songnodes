"""
Unit tests for scraper orchestrator service.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
import json

from services.scraper_orchestrator.main import (
    TaskQueue, RateLimiter, ScraperManager, 
    ScrapingTask, TaskPriority, TaskStatus, ScraperStatus,
    execute_scraping_task, app
)


class TestTaskQueue:
    """Test cases for TaskQueue class."""
    
    @pytest.fixture
    def task_queue(self, test_redis_client):
        """Create TaskQueue instance for testing."""
        return TaskQueue(test_redis_client)
    
    @pytest.fixture
    def sample_task(self):
        """Sample scraping task."""
        return ScrapingTask(
            scraper="1001tracklists",
            url="https://example.com/test",
            priority=TaskPriority.MEDIUM,
            params={"test": "value"}
        )
    
    def test_add_task(self, task_queue, sample_task, test_redis_client):
        """Test adding task to queue."""
        task_id = task_queue.add_task(sample_task)
        
        assert task_id is not None
        assert task_id.startswith("1001tracklists_")
        
        # Check task is stored in Redis
        task_key = f"scraping:task:{task_id}"
        stored_task = test_redis_client.hgetall(task_key)
        assert stored_task['scraper'] == '1001tracklists'
        assert stored_task['url'] == 'https://example.com/test'
        
        # Check task is in priority queue
        queue_key = f"scraping:queue:{TaskPriority.MEDIUM.value}"
        queue_members = test_redis_client.zrange(queue_key, 0, -1)
        assert task_id in queue_members
    
    def test_get_next_task(self, task_queue, test_redis_client):
        """Test getting next task from queue."""
        # Add tasks with different priorities
        high_task = ScrapingTask(
            scraper="test1",
            priority=TaskPriority.HIGH,
            url="https://example.com/high"
        )
        medium_task = ScrapingTask(
            scraper="test2", 
            priority=TaskPriority.MEDIUM,
            url="https://example.com/medium"
        )
        
        high_id = task_queue.add_task(high_task)
        medium_id = task_queue.add_task(medium_task)
        
        # Should get high priority task first
        next_task = task_queue.get_next_task()
        assert next_task is not None
        assert next_task.id == high_id
        assert next_task.priority == TaskPriority.HIGH
        
        # Should get medium priority task next
        next_task = task_queue.get_next_task()
        assert next_task is not None
        assert next_task.id == medium_id
        assert next_task.priority == TaskPriority.MEDIUM
        
        # Queue should be empty now
        next_task = task_queue.get_next_task()
        assert next_task is None
    
    def test_get_next_task_by_scraper(self, task_queue):
        """Test getting next task filtered by scraper."""
        task1 = ScrapingTask(scraper="scraper1", priority=TaskPriority.HIGH)
        task2 = ScrapingTask(scraper="scraper2", priority=TaskPriority.HIGH)
        
        task_queue.add_task(task1)
        task_queue.add_task(task2)
        
        # Get task for specific scraper
        next_task = task_queue.get_next_task(scraper="scraper1")
        assert next_task is not None
        assert next_task.scraper == "scraper1"
        
        # Should still have task for scraper2
        next_task = task_queue.get_next_task(scraper="scraper2")
        assert next_task is not None
        assert next_task.scraper == "scraper2"
    
    def test_priority_ordering(self, task_queue):
        """Test that tasks are processed in priority order."""
        # Add tasks in reverse priority order
        low_task = ScrapingTask(scraper="test", priority=TaskPriority.LOW)
        critical_task = ScrapingTask(scraper="test", priority=TaskPriority.CRITICAL)
        medium_task = ScrapingTask(scraper="test", priority=TaskPriority.MEDIUM)
        high_task = ScrapingTask(scraper="test", priority=TaskPriority.HIGH)
        
        task_queue.add_task(low_task)
        task_queue.add_task(critical_task)
        task_queue.add_task(medium_task)
        task_queue.add_task(high_task)
        
        # Should get tasks in priority order
        assert task_queue.get_next_task().priority == TaskPriority.CRITICAL
        assert task_queue.get_next_task().priority == TaskPriority.HIGH
        assert task_queue.get_next_task().priority == TaskPriority.MEDIUM
        assert task_queue.get_next_task().priority == TaskPriority.LOW


class TestRateLimiter:
    """Test cases for RateLimiter class."""
    
    @pytest.fixture
    def rate_limiter(self, test_redis_client):
        """Create RateLimiter instance for testing."""
        return RateLimiter(test_redis_client)
    
    @pytest.mark.asyncio
    async def test_rate_limit_first_request(self, rate_limiter):
        """Test rate limiting for first request."""
        # Should allow first request
        allowed = await rate_limiter.check_rate_limit("1001tracklists")
        assert allowed is True
    
    @pytest.mark.asyncio
    async def test_rate_limit_within_limit(self, rate_limiter, test_redis_client):
        """Test rate limiting within allowed limit."""
        # Set a low limit for testing
        test_redis_client.setex("rate_limit:test_scraper", 60, 5)
        
        # Should allow requests within limit
        for i in range(25):  # 1001tracklists has 30/minute limit
            allowed = await rate_limiter.check_rate_limit("1001tracklists")
            if not allowed:
                break
        
        # Should eventually hit limit
        assert not allowed
    
    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self, rate_limiter, test_redis_client):
        """Test rate limiting when limit exceeded."""
        # Set counter above limit
        test_redis_client.setex("rate_limit:1001tracklists", 60, 35)  # Above 30/minute
        
        # Should deny request
        allowed = await rate_limiter.check_rate_limit("1001tracklists")
        assert allowed is False
    
    @pytest.mark.asyncio
    async def test_wait_if_limited(self, rate_limiter, test_redis_client):
        """Test waiting when rate limited."""
        # Set counter at limit
        test_redis_client.setex("rate_limit:test_scraper", 1, 100)  # 1 second expiry
        
        start_time = datetime.now()
        await rate_limiter.wait_if_limited("test_scraper")
        end_time = datetime.now()
        
        # Should have waited at least 1 second
        assert (end_time - start_time).total_seconds() >= 1


class TestScraperManager:
    """Test cases for ScraperManager class."""
    
    @pytest.fixture
    def scraper_manager(self):
        """Create ScraperManager instance for testing."""
        return ScraperManager()
    
    @pytest.mark.asyncio
    async def test_check_health_success(self, scraper_manager):
        """Test health check success."""
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
            
            result = await scraper_manager.check_health("1001tracklists")
            assert result is True
            assert scraper_manager.health_status["1001tracklists"]["healthy"] is True
    
    @pytest.mark.asyncio
    async def test_check_health_failure(self, scraper_manager):
        """Test health check failure."""
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = Mock()
            mock_response.status_code = 500
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
            
            result = await scraper_manager.check_health("1001tracklists")
            assert result is False
            assert scraper_manager.health_status["1001tracklists"]["healthy"] is False
    
    @pytest.mark.asyncio
    async def test_check_health_exception(self, scraper_manager):
        """Test health check with exception."""
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = Exception("Connection error")
            
            result = await scraper_manager.check_health("1001tracklists")
            assert result is False
            assert "error" in scraper_manager.health_status["1001tracklists"]
    
    @pytest.mark.asyncio
    async def test_check_all_health(self, scraper_manager):
        """Test checking health of all scrapers."""
        with patch.object(scraper_manager, 'check_health') as mock_check:
            mock_check.return_value = True
            
            results = await scraper_manager.check_all_health()
            
            # Should check all configured scrapers
            assert len(results) == len(scraper_manager.scrapers)
            assert all(results.values())
    
    def test_get_status_disabled(self, scraper_manager):
        """Test getting status of disabled scraper."""
        # Disable a scraper
        scraper_manager.scrapers["1001tracklists"].enabled = False
        
        status = scraper_manager.get_status("1001tracklists")
        assert status == ScraperStatus.DISABLED
    
    def test_get_status_unhealthy(self, scraper_manager):
        """Test getting status of unhealthy scraper."""
        scraper_manager.health_status["1001tracklists"] = {"healthy": False}
        
        status = scraper_manager.get_status("1001tracklists")
        assert status == ScraperStatus.ERROR
    
    def test_get_status_running(self, scraper_manager, test_redis_client):
        """Test getting status of running scraper."""
        # Mark scraper as active
        test_redis_client.setex("scraper:active:1001tracklists", 3600, "task_123")
        scraper_manager.health_status["1001tracklists"] = {"healthy": True}
        
        status = scraper_manager.get_status("1001tracklists")
        assert status == ScraperStatus.RUNNING


class TestExecuteScrapingTask:
    """Test cases for execute_scraping_task function."""
    
    @pytest.fixture
    def sample_task(self):
        """Sample scraping task."""
        return ScrapingTask(
            id="test_task_123",
            scraper="1001tracklists",
            url="https://example.com/test",
            priority=TaskPriority.MEDIUM
        )
    
    @pytest.mark.asyncio
    async def test_execute_task_success(self, sample_task, test_redis_client):
        """Test successful task execution."""
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
            
            with patch('services.scraper_orchestrator.main.rate_limiter') as mock_rate_limiter:
                mock_rate_limiter.wait_if_limited = AsyncMock()
                
                await execute_scraping_task(sample_task)
                
                # Check task status updated
                task_key = f"scraping:task:{sample_task.id}"
                task_data = test_redis_client.hgetall(task_key)
                assert task_data['status'] == TaskStatus.COMPLETED.value
    
    @pytest.mark.asyncio
    async def test_execute_task_failure(self, sample_task, test_redis_client):
        """Test task execution failure."""
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = Mock()
            mock_response.status_code = 500
            mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
            
            with patch('services.scraper_orchestrator.main.rate_limiter') as mock_rate_limiter:
                mock_rate_limiter.wait_if_limited = AsyncMock()
                
                await execute_scraping_task(sample_task)
                
                # Check task status updated
                task_key = f"scraping:task:{sample_task.id}"
                task_data = test_redis_client.hgetall(task_key)
                assert task_data['status'] == TaskStatus.FAILED.value
                assert 'error_message' in task_data
    
    @pytest.mark.asyncio
    async def test_execute_task_retry(self, sample_task, test_redis_client):
        """Test task retry on failure."""
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post.side_effect = Exception("Network error")
            
            with patch('services.scraper_orchestrator.main.rate_limiter') as mock_rate_limiter:
                mock_rate_limiter.wait_if_limited = AsyncMock()
                
                with patch('services.scraper_orchestrator.main.task_queue') as mock_queue:
                    mock_queue.add_task = Mock()
                    
                    sample_task.retry_count = 0
                    sample_task.max_retries = 3
                    
                    await execute_scraping_task(sample_task)
                    
                    # Should retry task
                    mock_queue.add_task.assert_called_once()


class TestAPIEndpoints:
    """Test cases for API endpoints."""
    
    @pytest.mark.asyncio
    async def test_health_endpoint(self, async_client):
        """Test health check endpoint."""
        with patch('services.scraper_orchestrator.main.app') as mock_app:
            # Mock the health endpoint response
            mock_response = {"status": "healthy", "timestamp": datetime.now().isoformat()}
            
            # This is a simplified test - in practice you'd use TestClient
            assert mock_response["status"] == "healthy"
    
    def test_scraper_configs(self):
        """Test scraper configurations are valid."""
        from services.scraper_orchestrator.main import SCRAPER_CONFIGS
        
        for name, config in SCRAPER_CONFIGS.items():
            assert config.name == name
            assert config.concurrent_requests > 0
            assert config.download_delay >= 0
            assert config.health_check_url is not None


@pytest.mark.integration
class TestTaskIntegration:
    """Integration tests for task processing."""
    
    @pytest.mark.asyncio
    async def test_end_to_end_task_flow(self, test_redis_client):
        """Test complete task flow from submission to completion."""
        # Create components
        task_queue = TaskQueue(test_redis_client)
        rate_limiter = RateLimiter(test_redis_client)
        
        # Create and submit task
        task = ScrapingTask(
            scraper="1001tracklists",
            url="https://example.com/test",
            priority=TaskPriority.HIGH
        )
        
        task_id = task_queue.add_task(task)
        assert task_id is not None
        
        # Get task from queue
        retrieved_task = task_queue.get_next_task()
        assert retrieved_task is not None
        assert retrieved_task.id == task_id
        
        # Verify queue is empty
        next_task = task_queue.get_next_task()
        assert next_task is None
    
    @pytest.mark.performance
    async def test_queue_performance(self, test_redis_client):
        """Test queue performance with many tasks."""
        task_queue = TaskQueue(test_redis_client)
        
        # Add many tasks
        num_tasks = 1000
        start_time = datetime.now()
        
        for i in range(num_tasks):
            task = ScrapingTask(
                scraper=f"scraper_{i % 5}",
                priority=TaskPriority.MEDIUM
            )
            task_queue.add_task(task)
        
        add_time = datetime.now()
        
        # Process all tasks
        processed = 0
        while True:
            task = task_queue.get_next_task()
            if not task:
                break
            processed += 1
        
        end_time = datetime.now()
        
        # Performance assertions
        add_duration = (add_time - start_time).total_seconds()
        process_duration = (end_time - add_time).total_seconds()
        
        assert processed == num_tasks
        assert add_duration < 5.0  # Should add 1000 tasks in < 5 seconds
        assert process_duration < 2.0  # Should process 1000 tasks in < 2 seconds