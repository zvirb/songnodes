"""
MDB1: MixesDB tracks reach silver_enriched_tracks with a bronze_id.

The MixesDB spider yields a standalone EnhancedTrackItem (no playlist context,
so it never gets a bronze row) before the positioned EnhancedSetlistTrackItem.
Silver tracks must link to the bronze row of the positioned item, not be
skipped with "Missing bronze_id FK reference".

Reuses the SC6 fake pool and MixesDB yield order.
"""
import pytest

from scrapers.pipelines.persistence_pipeline import PersistencePipeline
from scrapers.tests.test_persistence_bronze_every_track import (
    PLAYLISTS,
    FakePool,
    _spider_yield_order,
)


class RecordingPool(FakePool):
    def __init__(self):
        super().__init__()
        self.silver_rows = []
        conn = self.conn

        async def executemany(query, rows, **kwargs):
            if 'INSERT INTO silver_enriched_tracks' in query:
                self.silver_rows.extend(rows)

        conn.executemany = executemany


async def _run(mock_db_config, mock_spider, batch_size=None):
    pipeline = PersistencePipeline(mock_db_config)
    if batch_size is not None:
        pipeline.batch_size = batch_size
    pool = RecordingPool()
    pipeline.connection_pool = pool
    for item in _spider_yield_order():
        await pipeline.process_item(item, mock_spider)
    await pipeline.flush_all_batches()
    return pool


def _expected_tracks():
    return {(artist, title) for tracks in PLAYLISTS.values() for artist, title in tracks}


def _assert_every_track_linked(pool):
    bronze_ids = {row['id'] for row in pool.conn.bronze_tracks.values()}
    silver = {(row[1], row[2]): row[0] for row in pool.silver_rows}
    assert set(silver) == _expected_tracks(), 'silver tracks skipped'
    for key, bronze_id in silver.items():
        assert bronze_id in bronze_ids, f'{key}: silver row not linked to a bronze row'


@pytest.mark.asyncio
async def test_mixesdb_tracks_reach_silver_with_bronze_id(mock_db_config, mock_spider):
    _assert_every_track_linked(await _run(mock_db_config, mock_spider))


@pytest.mark.asyncio
async def test_silver_flush_mid_run_never_outruns_bronze(mock_db_config, mock_spider):
    # Small batches force mid-run silver flushes while bronze rows are still queued.
    _assert_every_track_linked(await _run(mock_db_config, mock_spider, batch_size=3))
