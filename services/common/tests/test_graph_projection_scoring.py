"""HS5: graph edges carry the stored harmonic scoring of observed transitions only (fake connections, no database)."""
import asyncio
import sys
import unittest
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.datalayer import graph_projection as gp, transition_scores as ts  # noqa: E402

SCORED_AT = datetime(2026, 11, 1, 9, 30, tzinfo=timezone.utc)


def scored_row(**over):
    """A Silver transition as HS4 stores it: spec row 3 (8A -> 9A, 124 -> 127, 6 -> 7)."""
    row = {'id': uuid.uuid4(), 'from_track_id': uuid.uuid4(), 'to_track_id': uuid.uuid4(), 'occurrence_count': 4,
           'key_relation': 'plus_one', 'key_level': 'compatible', 'key_score': 0.8,
           'bpm_relation': 'direct', 'bpm_gap': 3, 'bpm_level': 'compatible', 'bpm_score': 0.8,
           'compat_score': 0.8, 'compat_coverage': 1.0,
           'energy_from': Decimal('6.0'), 'energy_to': Decimal('7.0'), 'energy_delta': Decimal('1.0'),
           'energy_move': 'step_up', 'energy_contract': 'energy-1', 'move_version': 'energy-move-1',
           'energy_from_source': 'essentia', 'energy_to_source': 'essentia',
           'energy_from_calibrated': True, 'energy_to_calibrated': True,
           'scoring_version': 'harmonic-1', 'scored_at': SCORED_AT}
    row.update(over)
    return row


def unscored_row():
    """A transition written before HS4's backfill reached it: every scoring column NULL."""
    return {'id': uuid.uuid4(), 'from_track_id': uuid.uuid4(), 'to_track_id': uuid.uuid4(), 'occurrence_count': 1,
            **{name: None for name in ts.NAMES}, 'scored_at': None}


class FakeConn:
    """Answers only the transition queries; any other SQL (for example an all-tracks scan) fails the test."""

    def __init__(self, rows):
        self.rows = rows
        self.queries = []

    async def fetch(self, sql, *args):
        self.queries.append((sql, args))
        if sql == gp.TRANSITIONS_FOR_TRACK_SQL:
            return [r for r in self.rows if args[0] in (r['from_track_id'], r['to_track_id'])]
        if sql == gp.TRANSITIONS_BATCH_SQL:
            limit, after = args
            ordered = sorted(self.rows, key=lambda r: r['id'])
            return [r for r in ordered if after is None or r['id'] > after][:limit]
        raise AssertionError(f'unexpected query: {sql}')

    async def fetchrow(self, sql, *args):
        raise AssertionError(f'unexpected query: {sql}')


class FakeClient:
    def __init__(self):
        self.writes = []

    async def execute_write(self, query, parameters=None):
        self.writes.append((query, parameters or {}))
        return []

    def edges(self):
        return [e for q, p in self.writes if q == gp.WRITE_EDGES for e in p['edges']]


def run(coro_fn, conn):
    fake = FakeClient()
    with patch.object(gp, 'client', fake):
        asyncio.run(coro_fn(conn))
    return fake


class ObservedEdges(unittest.TestCase):
    def test_observed_edge_carries_stored_fields(self):
        row = scored_row()
        fake = run(lambda c: gp.project_transitions(c, row['from_track_id']), FakeConn([row]))
        [edge] = fake.edges()
        self.assertEqual((edge['from_id'], edge['to_id']), (str(row['from_track_id']), str(row['to_track_id'])))
        props = edge['props']
        for name in ts.NAMES:
            self.assertIn(name, props)
        self.assertEqual(props['occurrence_count'], 4)
        self.assertEqual(props['transition_id'], str(row['id']))
        self.assertEqual((props['key_relation'], props['key_level'], props['key_score']), ('plus_one', 'compatible', 0.8))
        self.assertEqual((props['bpm_relation'], props['bpm_gap'], props['bpm_level']), ('direct', 3, 'compatible'))
        self.assertEqual((props['compat_score'], props['compat_coverage']), (0.8, 1.0))
        self.assertEqual((props['energy_from'], props['energy_to'], props['energy_delta']), (6.0, 7.0, 1.0))
        self.assertIsInstance(props['energy_delta'], float)   # Decimal is not a Bolt type
        self.assertEqual((props['energy_move'], props['move_version'], props['energy_contract']),
                         ('step_up', 'energy-move-1', 'energy-1'))
        self.assertEqual((props['energy_from_source'], props['energy_to_calibrated']), ('essentia', True))
        self.assertEqual(props['scoring_version'], 'harmonic-1')
        self.assertEqual(props['scored_at'], SCORED_AT.isoformat())
        # The old invented properties are gone.
        for legacy in ('key_compatibility', 'energy_step'):
            self.assertNotIn(legacy, props)

    def test_edges_into_the_track_are_projected_too(self):
        row = scored_row()
        fake = run(lambda c: gp.project_transitions(c, row['to_track_id']), FakeConn([row]))
        self.assertEqual(len(fake.edges()), 1)

    def test_unscored_edge_carries_nulls(self):
        row = unscored_row()
        fake = run(lambda c: gp.project_transitions(c, row['from_track_id']), FakeConn([row]))
        [edge] = fake.edges()
        for name in (*ts.NAMES, 'scored_at'):
            self.assertIsNone(edge['props'][name], name)
        self.assertEqual(edge['props']['occurrence_count'], 1)

    def test_unknown_energy_stays_null_not_zero(self):
        row = scored_row(energy_from=None, energy_delta=None, energy_move='unknown',
                         energy_from_source=None, energy_from_calibrated=None)
        fake = run(lambda c: gp.project_transitions(c, row['from_track_id']), FakeConn([row]))
        props = fake.edges()[0]['props']
        self.assertIsNone(props['energy_from'])
        self.assertIsNone(props['energy_delta'])
        self.assertEqual(props['energy_move'], 'unknown')
        self.assertNotIn(0.0, [props['energy_from'], props['energy_delta']])

    def test_scoring_fields_mirror_the_stored_columns(self):
        self.assertEqual(gp.TRANSITION_COLUMNS, ('occurrence_count', *ts.NAMES, 'scored_at'))
        for name in gp.TRANSITION_COLUMNS:
            self.assertIn(name, gp.TRANSITIONS_SELECT)


class NoInferredEdges(unittest.TestCase):
    def test_track_without_observed_transition_gets_no_edges(self):
        lonely = uuid.uuid4()
        conn = FakeConn([scored_row()])   # an unrelated observed edge
        fake = run(lambda c: gp.project_transitions(c, lonely), conn)
        self.assertEqual(fake.edges(), [])
        # Its stale edges (for example inferred ones from earlier projections) are cleared.
        [(query, params)] = fake.writes
        self.assertIn('DELETE r', query)
        self.assertEqual(params, {'id': str(lonely)})
        # Only the observed-transition query ran; no all-tracks scan by BPM.
        self.assertEqual([sql for sql, _ in conn.queries], [gp.TRANSITIONS_FOR_TRACK_SQL])

    def test_rebuild_walk_writes_exactly_the_observed_rows(self):
        rows = [scored_row(), unscored_row(), scored_row()]
        fake = run(lambda c: gp.project_all_transitions(c, chunk_size=2), FakeConn(rows))
        written = sorted(e['props']['transition_id'] for e in fake.edges())
        self.assertEqual(written, sorted(str(r['id']) for r in rows))


if __name__ == '__main__':
    unittest.main()
