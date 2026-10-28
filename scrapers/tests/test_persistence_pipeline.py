"""
Unit tests for PersistencePipeline shutdown and artist insertion.
"""
import asyncio
import time
import pytest
from unittest.mock import Mock, AsyncMock
from scrapers.pipelines.persistence_pipeline import PersistencePipeline


@pytest.mark.unit
def test_close_spider_shutdown_flow(mock_db_config, mock_spider):
    """Test that close_spider stops the background thread, flushes batches, closes pool and loop directly."""
    pipeline = PersistencePipeline(mock_db_config)

    # Mock persistent loop and connection pool
    mock_loop = Mock()
    mock_pool = AsyncMock()

    # Define side effect for run_until_complete to actually run async coroutines
    def run_until_complete_side_effect(coro):
        return asyncio.run(coro)

    mock_loop.run_until_complete.side_effect = run_until_complete_side_effect
    mock_loop.is_closed.return_value = False

    pipeline._persistent_loop = mock_loop
    pipeline.connection_pool = mock_pool

    # Mock flush thread
    mock_thread = Mock()
    mock_thread.is_alive.return_value = True
    pipeline.flush_thread = mock_thread

    start_time = time.time()
    pipeline.close_spider(mock_spider)
    duration = time.time() - start_time

    # 1. Check thread stop signal and join called
    assert pipeline._stop_flushing.is_set()
    mock_thread.join.assert_called_once_with(timeout=5.0)

    # 2. Check run_until_complete calls and loop close
    assert mock_loop.run_until_complete.call_count == 2
    mock_loop.close.assert_called_once()

    # 3. Shutdown must complete in under 1 second
    assert duration < 1.0


@pytest.mark.asyncio
async def test_insert_artists_batch_targets_bronze_scraped_artists(mock_db_config):
    """Test that _insert_artists_batch executes INSERT INTO bronze_scraped_artists."""
    pipeline = PersistencePipeline(mock_db_config)
    mock_conn = AsyncMock()

    batch = [
        {
            'name': 'Carl Cox',
            'data_source': 'test_source',
            'source_url': 'https://example.com/carlcox',
            'spotify_id': 'spotify_123',
            'scraper_version': 'v1.0.0'
        }
    ]

    await pipeline._insert_artists_batch(mock_conn, batch)

    assert mock_conn.executemany.called
    query, records = mock_conn.executemany.call_args[0]

    assert 'INSERT INTO bronze_scraped_artists' in query
    assert 'ON CONFLICT (source, source_artist_id)' in query
    assert len(records) == 1
    source, source_url, source_artist_id, scraper_version, raw_json, artist_name = records[0]

    assert source == 'test_source'
    assert source_url == 'https://example.com/carlcox'
    assert source_artist_id == 'spotify_123'
    assert scraper_version == 'v1.0.0'
    assert artist_name == 'Carl Cox'
