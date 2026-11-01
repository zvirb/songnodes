"""
BRZ2: bronze playlist and track rows store raw_json as a JSON object.

Before BRZ2 the pipeline ran ``json.dumps(item, default=str)`` on a scrapy Item.
An Item is not a dict, so json fell back to ``str(item)`` and the column held a
JSON *string* of the Item repr; ingest's ``raw_object`` then read ``{}`` and
never saw fields such as ``total_tracks``.
"""
import json
import sys
from datetime import date
from pathlib import Path

import pytest

from scrapers.items import PlaylistItem
from scrapers.pipelines.persistence_pipeline import PersistencePipeline, _bronze_raw_json
from scrapers.tests.test_persistence_bronze_every_track import (
    PLAYLISTS,
    FakeConn,
    FakePool,
    _spider_yield_order,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'services'))
from common.datalayer.ingest import raw_object  # noqa: E402


class RawJsonConn(FakeConn):
    """FakeConn that also keeps the raw_json argument of each bronze insert."""

    def __init__(self):
        super().__init__()
        self.playlist_raw = {}  # playlist_name -> raw_json text
        self.track_raw = []

    async def fetchval(self, query, *args):
        if 'INSERT INTO bronze_scraped_playlists' in query:
            self.playlist_raw[args[5]] = args[4]
        elif 'INSERT INTO bronze_scraped_tracks' in query:
            self.track_raw.append(args[4])
        return await super().fetchval(query, *args)


@pytest.mark.asyncio
async def test_bronze_raw_json_is_an_object_ingest_can_read(mock_db_config, mock_spider):
    pipeline = PersistencePipeline(mock_db_config)
    pool = FakePool()
    pool.conn = RawJsonConn()
    pipeline.connection_pool = pool

    for item in _spider_yield_order():
        await pipeline.process_item(item, mock_spider)
    await pipeline.flush_all_batches()

    conn = pool.conn
    assert set(conn.playlist_raw) == set(PLAYLISTS)
    for name, tracks in PLAYLISTS.items():
        stored = json.loads(conn.playlist_raw[name])
        assert isinstance(stored, dict), f'{name}: raw_json is {type(stored).__name__}, not an object'
        raw = raw_object(conn.playlist_raw[name])
        assert raw['total_tracks'] == len(tracks)
        assert raw['name'] == name
        assert raw['tracks'] == [title for _, title in tracks]

    assert len(conn.track_raw) == sum(len(t) for t in PLAYLISTS.values())
    for text in conn.track_raw:
        stored = json.loads(text)
        assert isinstance(stored, dict), f'track raw_json is {type(stored).__name__}, not an object'
        assert stored.get('track_name') and stored.get('artist_name')


def test_nested_items_and_odd_values_serialise_as_objects():
    inner = PlaylistItem(name='inner', total_tracks=2)
    outer = {'playlist': inner, 'tracks': [inner, ('a', 'b')], 'event_date': date(2024, 5, 1)}
    stored = json.loads(_bronze_raw_json(outer))
    assert stored['playlist'] == {'name': 'inner', 'total_tracks': 2}
    assert stored['tracks'] == [{'name': 'inner', 'total_tracks': 2}, ['a', 'b']]
    assert stored['event_date'] == '2024-05-01'
    # A bare Item at the top level becomes an object too.
    assert json.loads(_bronze_raw_json(inner)) == {'name': 'inner', 'total_tracks': 2}
