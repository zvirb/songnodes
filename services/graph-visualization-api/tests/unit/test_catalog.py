import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID
from fastapi import HTTPException
from catalog import track_uuid, neighborhood_ids, nodes, edges, graph, search, statistics

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
