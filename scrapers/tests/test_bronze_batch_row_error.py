"""
BRZ1: one bad row no longer loses or miscounts a bronze batch.

Runs PersistencePipeline over the SC6 fixture (two MixesDB-style playlists of
five tracks, both containing 'Deadmau5 - Strobe', in the spider's yield order)
against a fake asyncpg connection that behaves like Postgres inside a
transaction: a failed statement aborts the transaction, every later statement
fails with "current transaction is aborted", and COMMIT of an aborted
transaction is a silent ROLLBACK. A nested ``conn.transaction()`` is a
savepoint: an error inside it rolls back to the savepoint and the outer
transaction carries on.
"""
import copy
import json
import logging

import pytest

from scrapers import unified_scraper_api as api
from scrapers.pipelines.persistence_pipeline import PersistencePipeline
from scrapers.tests.test_persistence_bronze_every_track import (
    PLAYLISTS,
    FakeConn,
    _spider_yield_order,
)


class InFailedSQLTransactionError(Exception):
    """What asyncpg raises for a statement sent inside an aborted transaction."""


class _Tx:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        self.conn.frames.append({'snapshot': self.conn.snapshot(), 'aborted': False})
        return self

    async def __aexit__(self, exc_type, exc, tb):
        frame = self.conn.frames.pop()
        outermost = not self.conn.frames
        if exc_type is not None or frame['aborted']:
            # ROLLBACK / ROLLBACK TO SAVEPOINT. Postgres turns COMMIT of an aborted
            # transaction into ROLLBACK without an error; RELEASE of a savepoint in an
            # aborted transaction is an error.
            self.conn.restore(frame['snapshot'])
            if exc_type is None and not outermost:
                self.conn.frames[-1]['aborted'] = True
                raise InFailedSQLTransactionError('current transaction is aborted')
            return False
        if outermost and self.conn.fail_commit:
            self.conn.restore(frame['snapshot'])
            raise RuntimeError('simulated commit failure')
        return False


class PostgresLikeConn(FakeConn):
    """FakeConn with transaction semantics and one bronze track insert that fails."""

    def __init__(self, failing_title=None, fail_commit=False):
        super().__init__()
        self.failing_title = failing_title
        self.fail_commit = fail_commit
        self.frames = []
        self.playlist_raw = {}  # bronze playlist id -> raw_json dict

    def snapshot(self):
        return copy.deepcopy((self.bronze_playlists, self.bronze_tracks, self.playlist_raw))

    def restore(self, snapshot):
        self.bronze_playlists, self.bronze_tracks, self.playlist_raw = copy.deepcopy(snapshot)

    def transaction(self):
        return _Tx(self)

    def _statement(self):
        if self.frames and self.frames[-1]['aborted']:
            raise InFailedSQLTransactionError('current transaction is aborted, commands ignored until end of transaction block')

    def _fail(self, message):
        if self.frames:
            self.frames[-1]['aborted'] = True
        raise RuntimeError(message)

    async def fetchval(self, query, *args):
        self._statement()
        if 'INSERT INTO bronze_scraped_tracks' in query and args[6] == self.failing_title:
            self._fail('value too long for type character varying(500)')
        result = await super().fetchval(query, *args)
        if 'INSERT INTO bronze_scraped_playlists' in query:
            self.playlist_raw[result] = json.loads(args[4])
        return result

    async def execute(self, query, *args):
        self._statement()
        if 'UPDATE bronze_scraped_playlists' in query:
            # raw_json of a scrapy Item is a JSON string today; the update wraps a non-object.
            raw = self.playlist_raw[args[0]]
            raw = raw if isinstance(raw, dict) else {'raw': raw}
            raw.update(json.loads(args[1]))
            self.playlist_raw[args[0]] = raw
        return 'UPDATE 1'


class PostgresLikePool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        conn = self.conn

        class _Acquire:
            async def __aenter__(self):
                return conn

            async def __aexit__(self, *exc):
                return False

        return _Acquire()


async def _run(monkeypatch, caplog, mock_db_config, mock_spider, conn):
    pipeline = PersistencePipeline(mock_db_config)
    pipeline.connection_pool = PostgresLikePool(conn)
    caplog.set_level(logging.INFO)
    for item in _spider_yield_order():
        await pipeline.process_item(item, mock_spider)
    try:
        await pipeline.flush_all_batches()
    except Exception:
        pass
    pipeline.close_spider(mock_spider)
    spider_log = caplog.text

    async def fake_run_spider(cmd, timeout=900):
        return {'status': 'completed', 'returncode': 0, 'stdout': '', 'stderr': spider_log}

    monkeypatch.setattr(api, '_run_spider', fake_run_spider)
    result = await api._scrape_internal(api.ScrapeRequest(source='mixesdb', search_query='Deadmau5 Strobe'))
    return pipeline, result, spider_log


@pytest.mark.asyncio
async def test_one_bad_row_keeps_the_good_rows_and_counts_only_committed(monkeypatch, caplog, mock_db_config, mock_spider):
    conn = PostgresLikeConn(failing_title='Atmosphere')  # playlist one, position 3
    pipeline, result, log = await _run(monkeypatch, caplog, mock_db_config, mock_spider, conn)

    # The other nine rows of the batch are committed, not rolled back with the bad one.
    assert len(conn.bronze_tracks) == 9
    assert all(row['track_title'] != 'Atmosphere' for row in conn.bronze_tracks.values())

    # Counted and logged: only committed rows, the bad row as an error. Log format unchanged.
    assert pipeline.stats['bronze_tracks_written'] == 9
    assert '✓ Inserted 9 tracks to bronze layer (skipped=0, errors=1)' in log
    assert 'Error inserting bronze track' in log and 'Atmosphere' in log
    assert result['bronze_tracks_queued'] == 10
    assert result['bronze_tracks_persisted'] == 9
    assert result['data_loss_detected'] is True
    assert result['data_loss_count'] == 1


@pytest.mark.asyncio
async def test_playlist_with_a_lost_track_is_marked_incomplete(monkeypatch, caplog, mock_db_config, mock_spider):
    conn = PostgresLikeConn(failing_title='Atmosphere')
    pipeline, _, log = await _run(monkeypatch, caplog, mock_db_config, mock_spider, conn)

    one = conn.bronze_playlists['Artist One @ Club A 2024']
    two = conn.bronze_playlists['Artist Two @ Festival B 2024']
    assert conn.playlist_raw[one]['bronze_incomplete'] == {
        'reason': 'track_insert_failed', 'failed_positions': [3],
    }
    assert 'bronze_incomplete' not in conn.playlist_raw[two]
    assert pipeline.stats['bronze_playlists_incomplete'] == 1
    assert 'incomplete in bronze' in log

    # The complete playlist keeps all five rows.
    assert sum(1 for row in conn.bronze_tracks.values() if row['playlist_id'] == two) == len(PLAYLISTS['Artist Two @ Festival B 2024'])


@pytest.mark.asyncio
async def test_failed_commit_counts_nothing(monkeypatch, caplog, mock_db_config, mock_spider):
    conn = PostgresLikeConn()
    await _run(monkeypatch, caplog, mock_db_config, mock_spider, conn)  # playlists and tracks committed
    # A later tracks batch fails at COMMIT: nothing of it is in the database, so nothing is counted.
    conn.fail_commit = True
    pipeline2 = PersistencePipeline(mock_db_config)
    pipeline2.connection_pool = PostgresLikePool(conn)
    pipeline2.item_batches['bronze_tracks'] = [dict(item) for item in _tracks_with_context(conn)]
    caplog.clear()
    with pytest.raises(RuntimeError):
        await pipeline2._flush_batch('bronze_tracks')
    assert pipeline2.stats['bronze_tracks_written'] == 0
    assert 'tracks to bronze layer' not in caplog.text
    assert len(pipeline2.item_batches['bronze_tracks']) == 2  # kept for the next flush


def _tracks_with_context(conn):
    playlist_id = conn.bronze_playlists['Artist One @ Club A 2024']
    return [
        {'track_name': 'New One', 'artist_name': 'Lane 8', 'source_track_id': 'Lane 8::New One#6',
         'data_source': 'mixesdb', 'source_url': 'https://www.mixesdb.com/w/Mix_1',
         '_bronze_playlist_id': playlist_id, '_track_position': 6},
        {'track_name': 'New Two', 'artist_name': 'Yotto', 'source_track_id': 'Yotto::New Two#7',
         'data_source': 'mixesdb', 'source_url': 'https://www.mixesdb.com/w/Mix_1',
         '_bronze_playlist_id': playlist_id, '_track_position': 7},
    ]
