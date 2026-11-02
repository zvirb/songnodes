"""HS7 (spec M6-U1): graph API edges carry the stored harmonic scoring, unchanged and never recomputed."""
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest

from catalog import edge_scoring, edges
from common.datalayer.transition_scores import NAMES

FROM = UUID('11111111-1111-1111-1111-111111111111')
TO = UUID('22222222-2222-2222-2222-222222222222')
SCORED = {
    'key_relation': 'plus_one', 'key_level': 'compatible', 'key_score': 0.8,
    'bpm_relation': 'direct', 'bpm_gap': 3, 'bpm_level': 'compatible', 'bpm_score': 0.8,
    'compat_score': 0.8, 'compat_coverage': 1.0,
    'energy_from': Decimal('6.0'), 'energy_to': Decimal('8.5'), 'energy_delta': Decimal('2.5'), 'energy_move': 'lift',
    'energy_contract': 'energy-1', 'move_version': 'energy-move-1',
    'energy_from_source': 'essentia', 'energy_to_source': 'essentia',
    'energy_from_calibrated': True, 'energy_to_calibrated': True,
    'scoring_version': 'harmonic-1', 'scored_at': datetime(2026, 11, 2, 1, 0, tzinfo=timezone.utc),
}


def row(**columns):
    mapping = {'from_track_id': FROM, 'to_track_id': TO, 'occurrence_count': 4, **columns}
    return SimpleNamespace(_mapping=mapping, **mapping)


def session_with(rows):
    session = AsyncMock()
    session.scalar.return_value = len(rows)
    result = MagicMock()
    result.__iter__.return_value = rows
    session.execute.return_value = result
    return session


def test_scored_edge_passes_the_stored_values_through():
    scoring = edge_scoring(row(**SCORED))
    assert set(scoring) == set(NAMES) | {'scored_at'}
    assert scoring['key_level'] == 'compatible' and scoring['bpm_gap'] == 3 and scoring['energy_move'] == 'lift'
    assert scoring['energy_delta'] == 2.5 and isinstance(scoring['energy_from'], float)
    assert scoring['scoring_version'] == 'harmonic-1'
    assert scoring['scored_at'] == '2026-11-02T01:00:00+00:00'


def test_unscored_edge_is_all_null_never_a_verdict():
    scoring = edge_scoring(row(**{name: None for name in NAMES}, scored_at=None))
    assert all(value is None for value in scoring.values())


def test_database_without_migration_270_reads_as_unscored():
    scoring = edge_scoring(row())
    assert all(value is None for value in scoring.values())


@pytest.mark.asyncio
async def test_edges_route_carries_scoring_and_count():
    result = await edges(session_with([row(**SCORED)]), [f'song_{FROM}', f'song_{TO}'])
    edge = result['edges'][0]
    assert edge['id'] == f'song_{FROM}__song_{TO}'
    assert edge['occurrence_count'] == 4 and edge['weight'] == 4.0
    assert edge['scoring']['key_relation'] == 'plus_one'
    assert edge['scoring']['energy_move'] == 'lift'
