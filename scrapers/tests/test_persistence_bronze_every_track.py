"""
SC6: every positioned playlist track reaches bronze_scraped_tracks.

Runs PersistencePipeline over two MixesDB-style playlists of five tracks each,
both containing 'Deadmau5 - Strobe', with items in the MixesDB spider's real
yield order (parse_mix_page): the PlaylistItem first, then for each track a
standalone EnhancedTrackItem, its EnhancedTrackArtistItem and then the
positioned EnhancedSetlistTrackItem. A fake asyncpg pool records the
bronze_scraped_tracks inserts.
"""
import uuid
from collections import defaultdict

import pytest

from scrapers.items import (
    EnhancedSetlistTrackItem,
    EnhancedTrackArtistItem,
    EnhancedTrackItem,
    PlaylistItem,
)
from scrapers.pipelines.persistence_pipeline import PersistencePipeline


class _AsyncCtx:
    def __init__(self, value=None):
        self._value = value

    async def __aenter__(self):
        return self._value

    async def __aexit__(self, *exc):
        return False


class FakeConn:
    """Records bronze inserts; answers playlist lookups like Postgres would."""

    def __init__(self):
        self.bronze_playlists = {}  # playlist_name -> id
        self.bronze_tracks = {}  # (source, source_url, source_track_id) -> row

    def transaction(self):
        return _AsyncCtx()

    async def fetchval(self, query, *args):
        if 'INSERT INTO bronze_scraped_playlists' in query:
            playlist_name = args[5]
            return self.bronze_playlists.setdefault(playlist_name, str(uuid.uuid4()))
        if 'INSERT INTO bronze_scraped_tracks' in query:
            source, source_url, source_track_id = args[0], args[1], args[2]
            key = (source, source_url, source_track_id)
            row = self.bronze_tracks.get(key)
            if row is None:
                row = {'id': str(uuid.uuid4())}
                self.bronze_tracks[key] = row
            row.update(artist_name=args[5], track_title=args[6], playlist_id=args[7], position=args[8])
            return row['id']
        if 'FROM bronze_scraped_playlists' in query:
            return self.bronze_playlists.get(args[0])
        return None

    async def execute(self, *args, **kwargs):
        return None

    async def executemany(self, *args, **kwargs):
        return None

    async def fetch(self, *args, **kwargs):
        return []

    async def fetchrow(self, *args, **kwargs):
        return None


class FakePool:
    def __init__(self):
        self.conn = FakeConn()

    def acquire(self):
        return _AsyncCtx(self.conn)


PLAYLISTS = {
    'Artist One @ Club A 2024': [
        ('Deadmau5', 'Strobe'),
        ('Eric Prydz', 'Opus'),
        ('Kaskade', 'Atmosphere'),
        ('Lane 8', 'Fingerprint'),
        ('Yotto', 'The One You Left'),
    ],
    'Artist Two @ Festival B 2024': [
        ('Eric Prydz', 'Opus'),
        ('Deadmau5', 'Strobe'),
        ('Ben Böhmer', 'Breathing'),
        ('Lane 8', 'Fingerprint'),
        ('Tinlicker', 'Children'),
    ],
}


def _spider_yield_order():
    """Items in the order MixesDBSpider.parse_mix_page yields them."""
    for index, (name, tracks) in enumerate(PLAYLISTS.items(), start=1):
        url = f'https://www.mixesdb.com/w/Mix_{index}'
        yield PlaylistItem(
            item_type='playlist', name=name, source='mixesdb', source_url=url,
            tracks=[title for _, title in tracks], total_tracks=len(tracks),
            tracklist_count=len(tracks), data_source='mixesdb',
            parsing_version='mixesdb_v1.1_xpath_fixed',
        )
        for position, (artist, title) in enumerate(tracks, start=1):
            yield EnhancedTrackItem(
                track_id=f'{artist}-{title}'.lower(), track_name=title, artist_name=artist,
                normalized_title=title.lower(), source_url=url,
                position_in_source=position, data_source='mixesdb',
            )
            yield EnhancedTrackArtistItem(
                track_name=title, artist_name=artist, artist_role='primary',
                position=0, data_source='mixesdb',
            )
            yield EnhancedSetlistTrackItem(
                setlist_name=name, track_name=title, artist_name=artist,
                track_order=position, source_url=url, data_source='mixesdb',
            )


@pytest.mark.asyncio
async def test_every_positioned_track_reaches_bronze(mock_db_config, mock_spider):
    pipeline = PersistencePipeline(mock_db_config)
    pool = FakePool()
    pipeline.connection_pool = pool

    for item in _spider_yield_order():
        await pipeline.process_item(item, mock_spider)
    await pipeline.flush_all_batches()

    conn = pool.conn
    assert set(conn.bronze_playlists) == set(PLAYLISTS)

    positions = defaultdict(list)
    for row in conn.bronze_tracks.values():
        positions[row['playlist_id']].append((row['position'], row['artist_name'], row['track_title']))

    for name, tracks in PLAYLISTS.items():
        playlist_id = conn.bronze_playlists[name]
        expected = [(pos, artist, title) for pos, (artist, title) in enumerate(tracks, start=1)]
        assert sorted(positions[playlist_id]) == expected, f'{name}: bronze rows incomplete'

    # Standalone EnhancedTrackItems carry no playlist context, so no extra rows.
    assert len(conn.bronze_tracks) == sum(len(t) for t in PLAYLISTS.values())
