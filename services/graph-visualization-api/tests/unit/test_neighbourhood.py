"""Neighbourhood view (design system 1.9.0, DR-057): the anchor and the tracks within `steps` links, at most
`max_nodes`, strongest link first, the same rule as SongNodes.neighbourhood in the design-system bundle."""
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import HTTPException

from catalog import neighbourhood, strongest_first


def undirected(pairs):
    adjacency = {}
    for a, b, w in pairs:
        adjacency.setdefault(a, []).append((b, w))
        adjacency.setdefault(b, []).append((a, w))
    return adjacency


def ternary(n):
    return undirected([(f't{(i - 1) // 3}', f't{i}', 1 + i % 3) for i in range(1, n)])


def test_three_steps_of_a_ternary_tree_give_forty_tracks_like_the_bundle():
    ids, capped = strongest_first(ternary(500), 't0', steps=3, max_nodes=200)
    assert len(ids) == 1 + 3 + 9 + 27
    assert not capped


def test_strongest_link_first_even_if_further_out():
    adjacency = undirected([('a', 'b', 1), ('a', 'c', 3), ('c', 'd', 2)])
    assert strongest_first(adjacency, 'a', steps=3, max_nodes=3) == (['a', 'c', 'd'], True)
    assert strongest_first(adjacency, 'a', steps=1, max_nodes=10) == (['a', 'c', 'b'], False)


def test_cap_matches_the_bundle_order():
    ids, capped = strongest_first(ternary(20000), 't0', steps=10, max_nodes=200)
    assert len(ids) == 200 and capped
    assert ids[:4] == ['t0', 't2', 't8', 't26']


def test_unknown_anchor_gives_nothing():
    assert strongest_first({}, 'x') == ([], False)


ANCHOR = UUID('00000000-0000-0000-0000-000000000001')
NEAR = UUID('00000000-0000-0000-0000-000000000002')


def track_row(track_id, title):
    row = MagicMock()
    row.id, row.track_title, row.artist_name = track_id, title, 'Artist'
    row.genre = row.release_date = row.bpm = row.key = row.energy = None
    row.danceability = row.valence = row.duration_ms = row.spotify_id = row.isrc = None
    row._mapping = {}
    return row


def edge_row(source, target, count):
    row = MagicMock()
    row.from_track_id, row.to_track_id, row.occurrence_count = source, target, count
    return row


@pytest.mark.asyncio
async def test_neighbourhood_reads_only_the_ball_and_reports_the_anchor():
    session = AsyncMock()
    session.scalar.side_effect = [ANCHOR, 1264, 1264]  # anchor exists, edge total, library size
    level_one = [(ANCHOR, NEAR, 3)]
    nodes = MagicMock(); nodes.__iter__.return_value = [track_row(NEAR, 'Near'), track_row(ANCHOR, 'Anchor')]
    edges = MagicMock(); edges.__iter__.return_value = [edge_row(ANCHOR, NEAR, 3)]
    session.execute.side_effect = [level_one, [], nodes, edges]
    result = await neighbourhood(session, f'song_{ANCHOR}', steps=2, max_nodes=200)
    assert [n['title'] for n in result['nodes']] == ['Anchor', 'Near']  # in the order taken
    assert result['metadata']['anchor'] == f'song_{ANCHOR}'
    assert result['metadata']['capped'] is False
    assert result['metadata']['library_nodes'] == 1264
    assert result['edges'][0]['weight'] == 3.0


@pytest.mark.asyncio
async def test_unknown_center_is_a_404():
    session = AsyncMock()
    session.scalar.return_value = None
    with pytest.raises(HTTPException) as exc:
        await neighbourhood(session, f'song_{ANCHOR}')
    assert exc.value.status_code == 404


def test_graph_data_routes_the_view(monkeypatch):
    from unittest.mock import patch
    from fastapi.testclient import TestClient
    import main
    calls = {}

    async def fake_hood(session, center, steps, max_nodes):
        calls.setdefault('hood', []).append((center, steps, max_nodes))
        return {'nodes': [], 'edges': [], 'metadata': {'view': 'neighbourhood'}}

    async def fake_graph(session, limit):
        calls['graph'] = limit
        return {'nodes': [], 'edges': [], 'metadata': {}}

    session = AsyncMock()
    with patch('main.async_session') as maker, patch('main.catalog.neighbourhood', fake_hood), patch('main.catalog.graph', fake_graph):
        maker.return_value.__aenter__.return_value = session
        maker.return_value.__aexit__.return_value = None
        client = TestClient(main.app)
        assert client.get('/api/graph/data?limit=10').status_code == 200
        assert client.get(f'/api/graph/data?view=neighbourhood&center=song_{ANCHOR}&steps=2&max=50').status_code == 200
        assert client.get('/api/graph/data?view=neighbourhood').status_code == 200
        assert client.get('/api/graph/data?view=bogus').status_code == 422
    assert calls['graph'] == 10
    assert calls['hood'] == [(f'song_{ANCHOR}', 2, 50), (None, 3, 200)]
