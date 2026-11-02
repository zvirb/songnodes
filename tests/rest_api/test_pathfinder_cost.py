"""HS6: the REST route finder costs edges with the harmonic-1 path cost (spec section 2.6).

Callers send each transition's occurrence count as `weight`, so a transition DJs play more often must
cost less, every cost must stay above zero, and an unknown key or BPM falls back to the spec's neutral cost.
"""
import itertools
import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
for path in (os.path.join(ROOT, 'services/rest_api'), os.path.join(ROOT, 'services'), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

pytest.importorskip('annoy')  # the router builds its fallback graph with Annoy

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from common.metadata.transition_scoring import EPSILON, UNKNOWN_COST  # noqa: E402
from routers import pathfinder  # noqa: E402
from routers.pathfinder import (  # noqa: E402
    TrackNode, occurrence_count, prepare_adjacency, transition_cost,
)

TRACK_MS = 300_000


def track(track_id, key='8A', bpm=124.0, duration_ms=TRACK_MS):
    return TrackNode(id=track_id, name=f'Title {track_id}', artist=f'Artist {track_id}',
                     duration_ms=duration_ms, camelot_key=key, bpm=bpm)


def cost(from_kw=None, to_kw=None, n=1):
    return transition_cost(track('a', **(from_kw or {})), track('b', **(to_kw or {})), n)


def test_more_played_transition_costs_less():
    costs = [cost(n=n) for n in (1, 2, 5, 50, 1000)]
    assert costs == sorted(costs, reverse=True)
    assert len(set(costs)) == len(costs)


def test_better_compatibility_costs_less_at_the_same_count():
    perfect = cost(n=3)
    compatible = cost(to_kw={'key': '9A'}, n=3)
    clash = cost(to_kw={'key': '3B'}, n=3)
    assert perfect < compatible < clash


@pytest.mark.parametrize('key_from,key_to,bpm_from,bpm_to,n', [
    *itertools.product(['8A', '3B', None], ['8A', '9A', '2B', None], [124.0, None], [124.0, 174.0, 60.0, None],
                       [0, 1, 10**6]),
])
def test_cost_is_always_positive(key_from, key_to, bpm_from, bpm_to, n):
    value = cost({'key': key_from, 'bpm': bpm_from}, {'key': key_to, 'bpm': bpm_to}, n)
    assert value > EPSILON / 2


def test_unknown_parts_fall_back_to_the_neutral_cost():
    unknown_both = cost({'key': None, 'bpm': None}, n=4)
    perfect = cost(n=4)
    # Coverage 0 costs exactly U for compatibility; never less than a known perfect edge.
    assert unknown_both == pytest.approx(cost(n=4) + UNKNOWN_COST)
    assert cost({'key': None}, n=4) >= perfect
    assert cost({'bpm': None}, n=4) >= perfect
    # Unknown is cheaper than a known clash: it is not treated as one.
    assert unknown_both < cost(to_kw={'key': '3B', 'bpm': 150.0}, n=4)


@pytest.mark.parametrize('weight,expected', [(None, 0), (-3.0, 0), (0.0, 0), (0.5, 0), (1.0, 1), (7.9, 7),
                                             (float('inf'), 0), (float('nan'), 0)])
def test_request_weight_is_read_as_occurrence_count(weight, expected):
    assert occurrence_count(weight) == expected


def test_fallback_edges_cost_as_inferred_never_less_than_observed_once():
    tracks = {t.id: t for t in (track('a'), track('b'))}
    observed = prepare_adjacency({'a': [('b', 1.0)]}, tracks, True)['a'][0][2]
    synthetic = prepare_adjacency({'a': [('b', 1.0)]}, tracks, True, {('a', 'b')})['a'][0][2]
    assert synthetic > observed


def test_each_direction_is_costed_separately():
    # 8A -> 3A is a +7 lift (possible); 3A -> 8A is a clash.
    lift = transition_cost(track('a', key='8A'), track('b', key='3A'), 2)
    back = transition_cost(track('b', key='3A'), track('a', key='8A'), 2)
    assert lift < back


def route(edges, waypoints=()):
    tracks = [{'id': t, 'name': f'Title {t}', 'artist': f'Artist {t}', 'duration_ms': TRACK_MS,
               'camelot_key': '8A', 'bpm': 124.0} for t in 'ABCD']
    app = FastAPI()
    app.include_router(pathfinder.router)
    response = TestClient(app).post('/api/v1/pathfinder/find-path', json={
        'start_track_id': 'A', 'end_track_id': 'D', 'target_duration_ms': 3 * TRACK_MS, 'tolerance_ms': 1000,
        'waypoint_track_ids': list(waypoints), 'tracks': tracks,
        'edges': [{'from_id': f, 'to_id': t, 'weight': w} for f, t, w in edges],
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['success'] is True
    return [segment['track']['id'] for segment in body['path']]


def test_route_takes_the_more_played_transition():
    # A -> B played 50 times, A -> C once; both continue to D once. Same keys, BPM and durations.
    assert route([('A', 'B', 50), ('A', 'C', 1), ('B', 'D', 1), ('C', 'D', 1)]) == ['A', 'B', 'D']
    assert route([('A', 'B', 1), ('A', 'C', 50), ('B', 'D', 1), ('C', 'D', 1)]) == ['A', 'C', 'D']


def test_waypoint_steers_the_route_without_negative_costs():
    assert route([('A', 'B', 50), ('A', 'C', 1), ('B', 'D', 1), ('C', 'D', 1)], waypoints=['C']) == ['A', 'C', 'D']
    assert 0 < pathfinder.WAYPOINT_COST_FACTOR < 1
