"""HS4: Silver transitions store their harmonic scoring (fake connections, no database)."""
import asyncio
import re
import sys
import unittest
import uuid
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.datalayer import handlers, ingest, transition_scores as ts  # noqa: E402


def track(key=None, bpm=None, energy=None, source=None, calibrated=None, camelot=None):
    return {'id': uuid.uuid4(), 'key': key, 'camelot_key': camelot, 'bpm': bpm,
            'energy_canonical': Decimal(energy) if energy is not None else None,
            'energy_source': source, 'energy_calibrated': calibrated}


def as_dict(values):
    return dict(zip(ts.NAMES, values))


class _Tx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class EdgeValues(unittest.TestCase):
    def test_known_inputs_give_spec_row_3_with_provenance(self):
        a = track('8A', 124, '6', 'essentia', True)
        b = track('9A', 127, '7', 'essentia', True)
        v = as_dict(ts.edge_values(a, b))
        self.assertEqual((v['key_relation'], v['key_level'], v['key_score']), ('plus_one', 'compatible', 0.8))
        self.assertEqual((v['bpm_relation'], v['bpm_gap'], v['bpm_level'], v['bpm_score']), ('direct', 3, 'compatible', 0.8))
        self.assertAlmostEqual(v['compat_score'], 0.8)
        self.assertEqual(v['compat_coverage'], 1.0)
        self.assertEqual((v['energy_from'], v['energy_to'], v['energy_delta'], v['energy_move']),
                         (Decimal('6'), Decimal('7'), Decimal('1'), 'step_up'))
        self.assertEqual((v['energy_from_source'], v['energy_to_calibrated']), ('essentia', True))
        self.assertEqual((v['energy_contract'], v['move_version'], v['scoring_version']), ('energy-1', 'energy-move-1', 'harmonic-1'))

    def test_unknown_inputs_stay_unknown(self):
        v = as_dict(ts.edge_values(None, track(energy='7', source='essentia', calibrated=True)))
        self.assertEqual((v['key_level'], v['key_score'], v['bpm_level'], v['bpm_score'], v['bpm_gap']),
                         ('unknown', None, 'unknown', None, None))
        self.assertIsNone(v['compat_score'])
        self.assertEqual(v['compat_coverage'], 0.0)
        self.assertEqual((v['energy_move'], v['energy_delta'], v['energy_from']), ('unknown', None, None))
        self.assertIsNone(v['energy_from_source'])
        self.assertEqual(v['energy_to_source'], 'essentia')   # the known side keeps its provenance
        self.assertEqual(v['scoring_version'], 'harmonic-1')

    def test_repaired_camelot_code_wins_over_raw_key(self):
        v = as_dict(ts.edge_values(track(key='C major', camelot='8A'), track(key='A minor', camelot='8A')))
        self.assertEqual(v['key_relation'], 'same')

    def test_sql_binds_one_typed_parameter_per_column(self):
        self.assertEqual(max(int(n) for n in re.findall(r'\$(\d+)', ts.UPDATE_SQL)), 1 + len(ts.COLUMNS))
        self.assertEqual(max(int(n) for n in re.findall(r'\$(\d+)', ingest.TRANSITION_UPSERT)), 3 + len(ts.COLUMNS))
        for name in ts.NAMES:
            self.assertIn(f'EXCLUDED.{name}', ingest.TRANSITION_UPSERT)


class IngestConn:
    """A complete 3-track bronze playlist; track 2 has no key or BPM."""

    def __init__(self, tracks):
        self.bronze_id, self.silver_id = uuid.uuid4(), uuid.uuid4()
        self.tracks = tracks
        self.transitions = []

    def transaction(self):
        return _Tx()

    async def fetchrow(self, query, *args):
        if 'FROM bronze_scraped_playlists' in query:
            return {'id': self.bronze_id, 'raw_json': '{}', 'source': 'mixesdb', 'artist_name': None,
                    'playlist_name': 'Artist One @ Club A 2024', 'event_name': None, 'event_date': None,
                    'source_url': 'https://www.mixesdb.com/w/Mix_1'}
        return None

    async def fetch(self, query, *args):
        if query == ts.TRACKS_SQL:
            return [t for t in self.tracks if t['id'] in args[0]]
        return [{'id': uuid.uuid4(), 'position': p, 'artist_name': 'Deadmau5', 'track_title': f'Track {p}',
                 'raw_json': '{}', 'source': 'mixesdb'} for p in range(1, len(self.tracks) + 1)]

    async def fetchval(self, query, *args):
        if 'INSERT INTO silver_enriched_playlists' in query:
            return self.silver_id
        if 'INSERT INTO outbox_events' in query:
            return 1
        raise AssertionError(f'unexpected query: {query}')

    async def execute(self, query, *args):
        if query == ingest.TRANSITION_UPSERT:
            self.transitions.append(args)
        elif 'silver_playlist_tracks' not in query:
            raise AssertionError(f'unexpected query: {query}')


class IngestWritesScoring(unittest.TestCase):
    def test_each_new_edge_carries_its_scoring(self):
        tracks = [track('8A', 128, '6'), track(energy='6'), track('8A', 128, '9')]
        conn = IngestConn(tracks)
        by_title = {f'Track {i}': t['id'] for i, t in enumerate(tracks, start=1)}

        async def fake_upsert(conn_, artist, title, *rest, **kw):
            return {'id': by_title[title], 'status': 'created'}

        original = ingest.upsert_track
        ingest.upsert_track = fake_upsert
        try:
            result = asyncio.run(ingest.ingest_playlist(conn, conn.bronze_id))
        finally:
            ingest.upsert_track = original
        self.assertEqual(result['transitions'], 2)
        first, second = conn.transitions
        self.assertEqual(first[:2], (tracks[0]['id'], tracks[1]['id']))
        one, two = as_dict(first[3:]), as_dict(second[3:])
        self.assertEqual((one['key_level'], one['bpm_level'], one['compat_score'], one['energy_move']),
                         ('unknown', 'unknown', None, 'hold'))
        self.assertEqual((two['energy_move'], two['energy_delta']), ('lift', Decimal('3')))
        self.assertEqual(two['scoring_version'], 'harmonic-1')


class BackfillConn:
    """silver_track_transitions rows in memory; the UPDATE writes only when the stored scoring differs."""

    def __init__(self, tracks, edges):
        self.tracks = {t['id']: t for t in tracks}
        self.rows = {uuid.UUID(int=i + 1): {'id': uuid.UUID(int=i + 1), 'from_track_id': a, 'to_track_id': b,
                                            'stored': None, 'scored_at': None}
                     for i, (a, b) in enumerate(edges)}
        self.writes = 0

    async def fetch(self, query, *args):
        if query == ts.TRACKS_SQL:
            return [self.tracks[i] for i in args[0] if i in self.tracks]
        limit, after = args
        ids = sorted(i for i in self.rows if after is None or i > after)[:limit]
        return [self.rows[i] for i in ids]

    async def execute(self, query, *args):
        assert query == ts.UPDATE_SQL
        row = self.rows[args[0]]
        if row['scored_at'] is not None and row['stored'] == args[1:]:
            return 'UPDATE 0'
        row['stored'], row['scored_at'] = args[1:], 'now'
        self.writes += 1
        return 'UPDATE 1'


class Backfill(unittest.TestCase):
    def setUp(self):
        self.a, self.b, self.c = track('8A', 128, '6'), track('9A', 128, '7'), track()
        self.conn = BackfillConn([self.a, self.b, self.c],
                                 [(self.a['id'], self.b['id']), (self.b['id'], self.c['id']), (self.c['id'], uuid.uuid4())])

    def test_scores_every_row_then_rerun_writes_nothing(self):
        first = asyncio.run(ts.backfill(self.conn, limit=10))
        self.assertEqual((first['examined'], first['scored'], first['unchanged']), (3, 3, 0))
        again = asyncio.run(ts.backfill(self.conn, limit=10))
        self.assertEqual((again['scored'], again['unchanged']), (0, 3))
        missing_track_edge = as_dict(self.conn.rows[uuid.UUID(int=3)]['stored'])
        self.assertEqual((missing_track_edge['key_level'], missing_track_edge['energy_move']), ('unknown', 'unknown'))

    def test_changed_track_metadata_rescores_only_its_edges(self):
        asyncio.run(ts.backfill(self.conn, limit=10))
        self.c.update({'camelot_key': '9A', 'bpm': 128})
        result = asyncio.run(ts.backfill(self.conn, limit=10))
        self.assertEqual((result['scored'], result['unchanged']), (1, 2))  # c -> missing track stays all unknown
        self.assertEqual(as_dict(self.conn.rows[uuid.UUID(int=2)]['stored'])['key_relation'], 'same')

    def test_job_chains_keyset_batches_until_the_end(self):
        ctx = handlers.Context()
        run = handlers.HANDLERS['transition_scoring']
        first = asyncio.run(run(self.conn, ctx, {'limit': 2, 'job_id': 'j1'}))
        self.assertEqual(first['examined'], 2)
        follow = first['enqueue'][0]
        self.assertEqual((follow['kind'], follow['payload']['after']), ('transition_scoring', str(uuid.UUID(int=2))))
        last = asyncio.run(run(self.conn, ctx, {**follow['payload'], 'job_id': 'j2'}))
        self.assertEqual((last['examined'], last['enqueue']), (1, []))
        self.assertEqual(self.conn.writes, 3)


if __name__ == '__main__':
    unittest.main()
