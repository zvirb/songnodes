"""
SC5: the scrape job result counts what bronze holds.

Runs PersistencePipeline over the SC6 fixture (two MixesDB-style playlists of
five tracks, both containing 'Deadmau5 - Strobe', in the spider's yield order)
against a fake asyncpg pool, feeds the captured pipeline log to the unified
scraper API as the spider's output, and checks that the job result's playlist
and track counts equal the bronze rows written.
"""
import logging

import pytest

from scrapers import unified_scraper_api as api
from scrapers.pipelines.persistence_pipeline import PersistencePipeline
from scrapers.tests.test_persistence_bronze_every_track import (
    PLAYLISTS,
    FakeConn,
    FakePool,
    _spider_yield_order,
)


class FailingTrackConn(FakeConn):
    """Rejects the bronze insert of one track, as a database error would."""

    def __init__(self, failing_title):
        super().__init__()
        self.failing_title = failing_title

    async def fetchval(self, query, *args):
        if 'INSERT INTO bronze_scraped_tracks' in query and args[6] == self.failing_title:
            raise RuntimeError('simulated insert failure')
        return await super().fetchval(query, *args)


async def _job_result(monkeypatch, caplog, mock_db_config, mock_spider, pool):
    """Run the pipeline on the fixture, then the API's success path on its log."""
    pipeline = PersistencePipeline(mock_db_config)
    pipeline.connection_pool = pool
    caplog.set_level(logging.INFO)
    for item in _spider_yield_order():
        await pipeline.process_item(item, mock_spider)
    await pipeline.flush_all_batches()
    pipeline.close_spider(mock_spider)
    spider_log = caplog.text

    async def fake_run_spider(cmd, timeout=900):
        return {'status': 'completed', 'returncode': 0, 'stdout': '', 'stderr': spider_log}

    monkeypatch.setattr(api, '_run_spider', fake_run_spider)
    result = await api._scrape_internal(api.ScrapeRequest(source='mixesdb', search_query='Deadmau5 Strobe'))
    return pipeline, result


@pytest.mark.asyncio
async def test_job_result_counts_equal_bronze_rows(monkeypatch, caplog, mock_db_config, mock_spider):
    pool = FakePool()
    pipeline, result = await _job_result(monkeypatch, caplog, mock_db_config, mock_spider, pool)
    conn = pool.conn

    assert result['status'] == 'success'
    # Bronze holds the full fixture: 2 playlists, 10 positioned tracks.
    assert len(conn.bronze_playlists) == len(PLAYLISTS) == 2
    assert len(conn.bronze_tracks) == sum(len(t) for t in PLAYLISTS.values()) == 10

    # Logged (pipeline stats), parsed (job result) and written (fake DB) agree.
    assert pipeline.stats['bronze_playlists_written'] == result['bronze_playlists_persisted'] == len(conn.bronze_playlists)
    assert pipeline.stats['bronze_tracks_written'] == result['bronze_tracks_persisted'] == len(conn.bronze_tracks)
    assert result['bronze_playlists_queued'] == 2
    assert result['bronze_tracks_queued'] == 10

    # Nothing was lost, although the spider yielded far more items than bronze rows.
    assert result['items_yielded'] == 0  # no scrapy stats line in this log
    assert result['pipeline_records_written'] > result['bronze_tracks_persisted']
    assert result['data_loss_detected'] is False
    assert result['data_loss_count'] == 0
    assert 'items_persisted' not in result


@pytest.mark.asyncio
async def test_data_loss_compares_bronze_queued_with_written(monkeypatch, caplog, mock_db_config, mock_spider):
    pool = FakePool()
    pool.conn = FailingTrackConn('Fingerprint')  # in both playlists
    _, result = await _job_result(monkeypatch, caplog, mock_db_config, mock_spider, pool)

    assert result['bronze_tracks_queued'] == 10
    assert result['bronze_tracks_persisted'] == len(pool.conn.bronze_tracks) == 8
    assert result['bronze_playlists_persisted'] == 2
    assert result['data_loss_detected'] is True
    assert result['data_loss_count'] == 2


def test_extract_stats_reads_scrapy_and_summary_lines():
    log = '\n'.join([
        "2026-10-30 [scrapy.statscollectors] INFO: Dumping Scrapy stats:",
        " 'item_scraped_count': 42,",
        "INFO: ✓ Inserted 2 playlists to bronze layer (total)",
        "INFO: ✓ Inserted 6 tracks to bronze layer (skipped=0, errors=0)",
        "INFO: ✓ Inserted 4 tracks to bronze layer (skipped=0, errors=0)",
        "INFO:   Bronze playlists queued: 2",
        "INFO:   Bronze tracks queued: 10",
        "INFO:   Pipeline records written (all tables): 51",
    ])
    stats = api._extract_stats(log, '')
    assert stats['bronze_playlists_persisted'] == 2
    assert stats['bronze_tracks_persisted'] == 10
    assert stats['bronze_playlists_queued'] == 2
    assert stats['bronze_tracks_queued'] == 10
    assert stats['items_yielded'] == 42
    assert stats['pipeline_records_written'] == 51
