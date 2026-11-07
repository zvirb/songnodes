"""Multi-mode Pathfinder unit and regression tests (PF-02, PF-03, PF-04)."""

import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
for path in (os.path.join(ROOT, "services/rest_api"), os.path.join(ROOT, "services"), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from routers import pathfinder  # noqa: E402
from routers.pathfinder import (  # noqa: E402
    TrackNode,
    camelot_to_vector,
    find_path,
    find_similar_tracks,
    prepare_adjacency,
    transition_cost,
)

TRACK_MS = 300_000  # 5 minutes


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(pathfinder.router)
    return TestClient(app)


def build_dense_graph(num_tracks: int = 30, track_duration_ms: int = TRACK_MS):
    """Build a realistic branching DJ graph where a backbone chain 0->1->2->...->N-1 exists
    alongside high-degree side branches."""
    keys = ["8A", "8A", "9A", "9A", "10A", "3B", "4B", "8B", "7A", "6A"]
    tracks = []
    for i in range(num_tracks):
        tracks.append(
            {
                "id": f"T{i}",
                "name": f"Track {i}",
                "artist": f"Artist {i}",
                "duration_ms": track_duration_ms,
                "camelot_key": keys[i % len(keys)],
                "bpm": 124.0 + (i % 5),
            }
        )

    edges = []
    # Backbone chain T0 -> T1 -> T2 -> ... -> T(num_tracks-1)
    for i in range(num_tracks - 1):
        edges.append({"from_id": f"T{i}", "to_id": f"T{i+1}", "weight": 10.0})
    # Extra cross edges creating high branching factor
    for i in range(num_tracks):
        for offset in (2, 3, 5, 7):
            target = (i + offset) % num_tracks
            if target != i + 1 and target != i:
                edges.append({"from_id": f"T{i}", "to_id": f"T{target}", "weight": 2.0})
    return tracks, edges


def test_pf04_camelot_to_vector_handles_non_camelot_strings():
    """PF-04: camelot_to_vector must not raise ValueError on musical key names or invalid strings."""
    # Musical key names convertible via to_camelot ("A minor" -> "8A")
    vec_am = camelot_to_vector("A minor")
    vec_8a = camelot_to_vector("8A")
    assert vec_am == pytest.approx(vec_8a)
    assert vec_am != (0.0, 0.0)

    # Completely invalid / unparseable key strings return (0.0, 0.0) without raising
    assert camelot_to_vector("unknown_key") == (0.0, 0.0)
    assert camelot_to_vector("H# minor") == (0.0, 0.0)
    assert camelot_to_vector("") == (0.0, 0.0)
    assert camelot_to_vector(None) == (0.0, 0.0)


def test_pf04_endpoint_accepts_non_camelot_key_without_500():
    """PF-04: POST /api/v1/pathfinder/find-path with 'A minor' or invalid key returns 200, not 500."""
    client = make_client()
    tracks = [
        {"id": "1", "name": "One", "artist": "A", "duration_ms": TRACK_MS, "camelot_key": "A minor", "bpm": 124.0},
        {"id": "2", "name": "Two", "artist": "B", "duration_ms": TRACK_MS, "camelot_key": "C major", "bpm": 124.0},
        {"id": "3", "name": "Three", "artist": "C", "duration_ms": TRACK_MS, "camelot_key": "invalid??", "bpm": 124.0},
    ]
    edges = [
        {"from_id": "1", "to_id": "2", "weight": 5.0},
        {"from_id": "2", "to_id": "3", "weight": 5.0},
    ]
    res = client.post(
        "/api/v1/pathfinder/find-path",
        json={
            "start_track_id": "1",
            "end_track_id": "3",
            "target_duration_ms": 3 * TRACK_MS,
            "tolerance_ms": 60_000,
            "tracks": tracks,
            "edges": edges,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert [seg["track"]["id"] for seg in data["path"]] == ["1", "2", "3"]


def test_pf03_prefer_key_matching_false_zeroes_key_penalty():
    """PF-03: When prefer_key_matching=False, key clashes do not inflate transition_cost or prepare_adjacency."""
    t_base = TrackNode(id="a", name="A", artist="X", duration_ms=TRACK_MS, camelot_key="8A", bpm=124.0)
    t_same_key = TrackNode(id="b", name="B", artist="Y", duration_ms=TRACK_MS, camelot_key="8A", bpm=124.0)
    t_clash_key = TrackNode(id="c", name="C", artist="Z", duration_ms=TRACK_MS, camelot_key="3B", bpm=124.0)

    # With prefer_key_matching=True, clash costs more than same key
    assert transition_cost(t_base, t_clash_key, 3, prefer_key_matching=True) > transition_cost(
        t_base, t_same_key, 3, prefer_key_matching=True
    )

    # With prefer_key_matching=False, both have identical BPM and count, so cost is equal
    cost_same_no_key = transition_cost(t_base, t_same_key, 3, prefer_key_matching=False)
    cost_clash_no_key = transition_cost(t_base, t_clash_key, 3, prefer_key_matching=False)
    assert cost_same_no_key == pytest.approx(cost_clash_no_key)

    tracks_dict = {"a": t_base, "b": t_same_key, "c": t_clash_key}
    adj = {"a": [("b", 3.0), ("c", 3.0)]}
    prep_false = prepare_adjacency(adj, tracks_dict, prefer_key_matching=False)
    assert prep_false["a"][0][2] == pytest.approx(prep_false["a"][1][2])
    # key_compatible is still accurately reported on each edge
    assert prep_false["a"][0][3] is True
    assert prep_false["a"][1][3] is False


def test_pf02_mode1_start_only():
    """Mode 1: Start-only (end_track_id=None)."""
    client = make_client()
    tracks, edges = build_dense_graph(25)
    res = client.post(
        "/api/v1/pathfinder/find-path",
        json={
            "start_track_id": "T0",
            "end_track_id": None,
            "target_duration_ms": 5 * TRACK_MS,
            "tolerance_ms": 60_000,
            "tracks": tracks,
            "edges": edges,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["path"][0]["track"]["id"] == "T0"
    assert abs(body["total_duration_ms"] - 5 * TRACK_MS) <= 60_000


def test_pf02_mode2_and_mode3_start_and_end_3plus_hops():
    """Mode 2 & Mode 3: Start + End (3+ hops apart) with prefer_key_matching=True and False."""
    client = make_client()
    tracks, edges = build_dense_graph(25)

    for prefer_key in (True, False):
        res = client.post(
            "/api/v1/pathfinder/find-path",
            json={
                "start_track_id": "T0",
                "end_track_id": "T6",
                "target_duration_ms": 7 * TRACK_MS,
                "tolerance_ms": 60_000,
                "prefer_key_matching": prefer_key,
                "tracks": tracks,
                "edges": edges,
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        ids = [seg["track"]["id"] for seg in body["path"]]
        assert ids[0] == "T0"
        assert ids[-1] == "T6"
        assert len(ids) >= 4


def test_pf02_mode4_start_waypoints_end():
    """Mode 4: Start + Waypoints + End."""
    client = make_client()
    tracks, edges = build_dense_graph(25)
    waypoints = ["T3", "T7"]

    res = client.post(
        "/api/v1/pathfinder/find-path",
        json={
            "start_track_id": "T0",
            "end_track_id": "T10",
            "waypoint_track_ids": waypoints,
            "target_duration_ms": 11 * TRACK_MS,
            "tolerance_ms": 180_000,
            "tracks": tracks,
            "edges": edges,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    ids = [seg["track"]["id"] for seg in body["path"]]
    assert ids[0] == "T0"
    assert ids[-1] == "T10"
    for wp in waypoints:
        assert wp in ids
    assert set(body["waypoints_visited"]) == set(waypoints)
    assert body["waypoints_missed"] == []


def test_pf02_mode5_long_duration_tight_tolerance():
    """Mode 5: Start-only with long duration (5400s = 5,400,000ms) and tight tolerance (±60s = 60,000ms)."""
    client = make_client()
    # 25 tracks of 300,000ms (5 min) each -> 18 tracks = 5,400,000ms (90 mins)
    tracks, edges = build_dense_graph(25, track_duration_ms=300_000)

    res = client.post(
        "/api/v1/pathfinder/find-path",
        json={
            "start_track_id": "T0",
            "end_track_id": None,
            "target_duration_ms": 5_400_000,
            "tolerance_ms": 60_000,
            "tracks": tracks,
            "edges": edges,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["path"][0]["track"]["id"] == "T0"
    assert abs(body["total_duration_ms"] - 5_400_000) <= 60_000


def test_pf02_start_and_end_short_graph_path_with_high_target_duration():
    """When end_track_id is reachable only via a shorter path than target_duration, find_path still succeeds."""
    client = make_client()
    tracks = [
        {"id": f"S{i}", "name": f"Short {i}", "artist": "A", "duration_ms": 200_000, "camelot_key": "8A", "bpm": 124.0}
        for i in range(4)
    ]
    edges = [
        {"from_id": "S0", "to_id": "S1", "weight": 5.0},
        {"from_id": "S1", "to_id": "S2", "weight": 5.0},
        {"from_id": "S2", "to_id": "S3", "weight": 5.0},
    ]
    res = client.post(
        "/api/v1/pathfinder/find-path",
        json={
            "start_track_id": "S0",
            "end_track_id": "S3",
            "waypoint_track_ids": ["S1"],
            "target_duration_ms": 3_600_000,  # 60 mins, impossible with only 4 tracks
            "tolerance_ms": 60_000,
            "tracks": tracks,
            "edges": edges,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    ids = [seg["track"]["id"] for seg in body["path"]]
    assert ids[0] == "S0"
    assert ids[-1] == "S3"
    assert "S1" in ids
