import pytest
from unittest.mock import AsyncMock, call

from services.library.importer.import_library import _process_payload

pytestmark = pytest.mark.asyncio

@pytest.fixture
def mock_conn():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    conn.fetchval = AsyncMock(return_value=1)
    return conn

async def test_importer_records_only_allowed_evidence_fields(mock_conn, mocker, caplog):
    mocker.patch('services.library.importer.import_library.upsert_track', AsyncMock(return_value={'id': 'test_track_id', 'status': 'created'}))
    mocker.patch('services.library.importer.import_library.record_evidence', AsyncMock())
    mocker.patch('services.library.importer.import_library.append_outbox', AsyncMock())

    from services.library.importer.import_library import record_evidence

    payload = {
        'tracks': [
            {
                'id': 'source_track_id',
                'artist': 'Test Artist',
                'title': 'Test Title',
                'label': 'Test Label',
                'release_year': '2023',
                'isrc': 'US1234567890',
                'tidal_id': 'tidal123',
                'deezer_id': 'deezer123',
                'genre': 'House',
                'norm_key': 'test_norm_key'
            }
        ]
    }

    stats = await _process_payload(mock_conn, payload)

    assert stats['tracks']['inserted'] == 1
    # Check that skipped field stats are updated
    assert 'skipped' in stats['tracks']
    assert stats['tracks']['skipped'] == 1

    # Verify log output for skipped fields
    assert "Skipped 1 tracks due to unallowed evidence fields (e.g. release_year)" in caplog.text or "release_year" in caplog.text

    expected_calls = [
        call(mock_conn, 'test_track_id', 'isrc', 'US1234567890', 'musiclibrary', method='importer'),
        call(mock_conn, 'test_track_id', 'tidal_id', 'tidal123', 'musiclibrary', method='importer'),
        call(mock_conn, 'test_track_id', 'deezer_id', 'deezer123', 'musiclibrary', method='importer'),
        call(mock_conn, 'test_track_id', 'genre', 'House', 'musiclibrary', method='importer'),
        call(mock_conn, 'test_track_id', 'record_label', 'Test Label', 'musiclibrary', method='importer')
    ]

    record_evidence.assert_has_calls(expected_calls, any_order=True)

    # Assert release_year is not recorded
    for call_args in record_evidence.call_args_list:
        assert call_args[0][2] != 'release_year'
        assert call_args[0][2] != 'label'

# Note: In Python, rewriting this test using caplog works.
