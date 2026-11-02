"""
BRZ3: a re-scraped MixesDB playlist updates its one bronze row.

The MixesDB spider yields an EnhancedSetlistItem (URL only in ``external_urls``)
before its PlaylistItem, so the bronze row was keyed ('mixesdb', 'unknown', NULL).
Postgres treats NULLs in UNIQUE(source, source_url, source_playlist_id) as
distinct, so every re-scrape inserted another copy. The fake connection below
applies that same rule, and the items come from the real spider on a fixture page.
"""
import json
import uuid
from pathlib import Path

import pytest
from scrapy.http import HtmlResponse

from scrapers.pipelines.persistence_pipeline import PersistencePipeline, _bronze_playlist_identity
from scrapers.spiders.mixesdb_spider import MixesdbSpider
from scrapers.tests.test_persistence_bronze_every_track import FakeConn, FakePool

FIXTURE = Path(__file__).resolve().parents[2] / 'tests' / 'unit' / 'scrapers' / 'fixtures' / 'mixesdb_two_lists.html'
MIX_URL = 'https://www.mixesdb.com/w/Test_DJ_-_Awesome_Mix'


class UpsertConn(FakeConn):
    """Bronze playlist inserts follow Postgres UNIQUE semantics (a NULL never conflicts)."""

    def __init__(self, rows):
        super().__init__()
        self.rows = rows  # (source, source_url, source_playlist_id) or a fresh token -> row

    async def fetchval(self, query, *args):
        if 'INSERT INTO bronze_scraped_playlists' in query:
            source, source_url, source_playlist_id, _version, raw_json, name = args[:6]
            key = (source, source_url, source_playlist_id)
            if None in key:
                key = object()  # NULL is distinct from every other value
            row = self.rows.setdefault(key, {'id': str(uuid.uuid4())})
            row.update(source_url=source_url, source_playlist_id=source_playlist_id, raw_json=raw_json)
            self.bronze_playlists[name] = row['id']
            return row['id']
        return await super().fetchval(query, *args)


async def _scrape(url, rows, mock_db_config, mock_spider):
    """One scrape run: a fresh spider and pipeline over the fixture page served at ``url``."""
    response = HtmlResponse(url=url, body=FIXTURE.read_bytes(), encoding='utf-8')
    pipeline = PersistencePipeline(mock_db_config)
    pool = FakePool()
    pool.conn = UpsertConn(rows)
    pipeline.connection_pool = pool
    for item in MixesdbSpider().parse(response):
        await pipeline.process_item(item, mock_spider)
    await pipeline.flush_all_batches()


@pytest.mark.asyncio
async def test_rescrape_of_same_mixesdb_playlist_updates_one_row(mock_db_config, mock_spider):
    rows = {}
    await _scrape(MIX_URL, rows, mock_db_config, mock_spider)
    await _scrape(MIX_URL, rows, mock_db_config, mock_spider)

    assert len(rows) == 1
    row = next(iter(rows.values()))
    assert row['source_url'] == MIX_URL
    assert row['source_playlist_id'] == MIX_URL
    assert isinstance(json.loads(row['raw_json']), dict)


@pytest.mark.asyncio
async def test_mixesdb_explorer_page_is_not_saved(mock_db_config, mock_spider):
    rows = {}
    await _scrape('https://www.mixesdb.com/w/MixesDB:Explorer/Mixes', rows, mock_db_config, mock_spider)
    assert rows == {}


def test_identity_reads_url_from_external_urls():
    item = {'external_urls': json.dumps({'mixesdb': MIX_URL})}
    assert _bronze_playlist_identity(item) == (MIX_URL, MIX_URL)


def test_identity_keeps_an_explicit_source_id():
    item = {'source_url': 'https://www.1001tracklists.com/tracklist/abc/x.html', 'playlist_id': 'abc'}
    assert _bronze_playlist_identity(item) == ('https://www.1001tracklists.com/tracklist/abc/x.html', 'abc')


def test_identity_without_any_url_stays_unknown():
    assert _bronze_playlist_identity({'name': 'x'}) == ('unknown', None)
