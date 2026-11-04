import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID
from fastapi import HTTPException
from catalog import track_uuid, node_from_row, neighborhood_ids, nodes, edges, graph, search, statistics

def test_track_uuid():
    # Valid
    assert track_uuid('song_12345678-1234-5678-1234-567812345678') == UUID('12345678-1234-5678-1234-567812345678')
    assert track_uuid('12345678-1234-5678-1234-567812345678') == UUID('12345678-1234-5678-1234-567812345678')

    # Invalid
    with pytest.raises(HTTPException) as exc:
        track_uuid('invalid_uuid')
    assert exc.value.status_code == 422

@pytest.mark.asyncio
async def test_search():
    session = AsyncMock()
    session.scalar.return_value = 1

    mock_row = MagicMock()
    mock_row.id = UUID('12345678-1234-5678-1234-567812345678')
    mock_row.track_title = "Test Song"
    mock_row.artist_name = "Test Artist"

    mock_result = MagicMock()
    mock_result.__iter__.return_value = [mock_row]
    session.execute.return_value = mock_result

    res = await search(session, "test", limit=10, offset=0)

    assert res['total'] == 1
    assert len(res['results']) == 1
    assert res['results'][0]['title'] == "Test Song"
    assert res['results'][0]['artist'] == "Test Artist"

    with pytest.raises(HTTPException) as exc:
        await search(session, "   ")
    assert exc.value.status_code == 422


def test_node_from_row_library_fields():
    row = MagicMock()
    row.id = UUID('12345678-1234-5678-1234-567812345678')
    row.track_title = "Orchid"
    row.artist_name = "nthng"
    row.genre = None
    row.release_date = None
    row.bpm = 132.0
    row.key = "5A"
    row.energy = 0.8
    row.danceability = None
    row.valence = None
    row.duration_ms = 360000
    row.spotify_id = None
    row.isrc = None
    row._mapping = {'in_library': True, 'library_rotation': '2'}

    node = node_from_row(row)
    assert node['in_library'] is True
    assert node['library_rotation'] == 2
    assert node['metadata']['in_library'] is True
    assert node['metadata']['library_rotation'] == 2

    row._mapping = {}
    node_non_lib = node_from_row(row)
    assert node_non_lib['in_library'] is False
    assert node_non_lib['library_rotation'] is None
    assert node_non_lib['metadata']['in_library'] is False
    assert node_non_lib['metadata']['library_rotation'] is None


@pytest.mark.asyncio
async def test_nodes_includes_library_fields():
    session = AsyncMock()
    session.scalar.return_value = 1

    row = MagicMock()
    row.id = UUID('12345678-1234-5678-1234-567812345678')
    row.track_title = "Watermark"
    row.artist_name = "Djrum"
    row.genre = row.release_date = row.bpm = row.key = row.energy = None
    row.danceability = row.valence = row.duration_ms = row.spotify_id = row.isrc = None
    row._mapping = {'in_library': True, 'library_rotation': 1}

    mock_result = MagicMock()
    mock_result.__iter__.return_value = [row]
    session.execute.return_value = mock_result

    res = await nodes(session, limit=10, offset=0)
    assert res['total'] == 1
    assert res['nodes'][0]['in_library'] is True
    assert res['nodes'][0]['library_rotation'] == 1
    sql_executed = str(session.execute.call_args[0][0])
    assert 'LEFT JOIN library.tracks lt ON lt.id = t.id' in sql_executed
    assert 'library.rotation_history' in sql_executed
