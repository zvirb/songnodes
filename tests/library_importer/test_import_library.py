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

async def test_importer_processes_musiclibrary_export_runs(mock_conn):
    payload = {
        "runs": [
            {"date": "2026-10-24", "added": 25, "demoted": 0, "archived": 0, "promoted": 0, "rejected": 234, "review_queue": 319},
            {"date": "2026-10-27", "added": 20, "demoted": 0, "archived": 0, "promoted": 0, "rejected": 7, "review_queue": 339}
        ]
    }

    stats = await _process_payload(mock_conn, payload)

    assert stats['runs']['inserted'] == 2
    assert stats['runs']['skipped'] == 0

    calls = mock_conn.fetchval.call_args_list
    run_calls = [c for c in calls if "INSERT INTO library.runs" in c[0][0]]
    assert len(run_calls) == 2

    # 2026-10-24 midnight Melbourne
    assert run_calls[0][0][1] == '2026-10-24T00:00:00+11:00'
    assert run_calls[0][0][2] == 'completed'
    assert '"added": 25' in run_calls[0][0][3]

    # 2026-10-27 midnight Melbourne
    assert run_calls[1][0][1] == '2026-10-27T00:00:00+11:00'
    assert run_calls[1][0][2] == 'completed'
    assert '"added": 20' in run_calls[1][0][3]

async def test_importer_processes_canonical_runs(mock_conn):
    payload = {
        "runs": [
            {"run_date": "2026-10-28T04:35:31+00", "status": "failed", "metrics": {"retry_count": 3}}
        ]
    }

    stats = await _process_payload(mock_conn, payload)

    assert stats['runs']['inserted'] == 1
    assert stats['runs']['skipped'] == 0

    calls = mock_conn.fetchval.call_args_list
    run_calls = [c for c in calls if "INSERT INTO library.runs" in c[0][0]]
    assert len(run_calls) == 1

    assert run_calls[0][0][1] == "2026-10-28T04:35:31+00"
    assert run_calls[0][0][2] == "failed"
    assert '"retry_count": 3' in run_calls[0][0][3]

async def test_importer_skips_runs_without_valid_dates(mock_conn, caplog):
    payload = {
        "runs": [
            {"date": "2026-10-24", "added": 25},
            {"status": "completed", "added": 10},
            {"date": "not-a-date", "added": 5}
        ]
    }

    stats = await _process_payload(mock_conn, payload)

    assert stats['runs']['inserted'] == 1
    assert stats['runs']['skipped'] == 2

    assert "Skipping run at index 1 due to missing valid date" in caplog.text
    assert "Skipping run at index 2 due to missing valid date" in caplog.text
