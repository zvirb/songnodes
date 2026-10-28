import pytest
from unittest.mock import AsyncMock, call

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from services.library.importer.import_library import _from_export, _is_export, _process_payload, _service_id, _ts

MELBOURNE = ZoneInfo('Australia/Melbourne')

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
    mocker.patch('services.library.importer.import_library.apply_evidence', AsyncMock())

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
    assert run_calls[0][0][1] == datetime(2026, 10, 24, tzinfo=MELBOURNE)
    assert run_calls[0][0][2] == 'completed'
    assert '"added": 25' in run_calls[0][0][3]

    # 2026-10-27 midnight Melbourne
    assert run_calls[1][0][1] == datetime(2026, 10, 27, tzinfo=MELBOURNE)
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

    assert run_calls[0][0][1] == datetime(2026, 10, 28, 4, 35, 31, tzinfo=timezone.utc)
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


# asyncpg rejects text for timestamptz parameters ("expected a datetime.date or datetime.datetime instance"),
# so every date from the payload must reach the query as a datetime.
def test_ts_turns_payload_dates_into_datetimes():
    assert _ts('2026-10-24') == datetime(2026, 10, 24, tzinfo=MELBOURNE)
    assert _ts('2026-10-23T20:27:14') == datetime(2026, 10, 23, 20, 27, 14, tzinfo=MELBOURNE)
    assert _ts('2026-10-28T04:35:31Z') == datetime(2026, 10, 28, 4, 35, 31, tzinfo=timezone.utc)
    assert _ts(None) is None and _ts('') is None and _ts('not-a-date') is None


def test_service_id_takes_the_numeric_id_from_a_link():
    assert _service_id('https://tidal.com/browse/track/503838165') == '503838165'
    assert _service_id('https://www.deezer.com/track/2378543155?utm=x') == '2378543155'
    assert _service_id('https://www.beatport.com/search/tracks?q=x') is None and _service_id(None) is None


EXPORT = {
    'generated': '2026-10-23T20:27:14',
    'runs': [{'date': '2026-10-24', 'added': 294}],
    'sources': [{'id': 'PBS_Elektrosophy', 'prior': 8, 'club': True, 'on': True}],
    'tracks': [
        {'id': 'x1', 'a': 'Bicep', 't': 'Glue', 'm': 'Original Mix', 'lbl': 'Ninja Tune', 'g': 'Electro', 'p': 'House',
         'e': 7, 'd': 269, 'bpm': None, 'k': None, 'rot': 2, 'tags': ['peak'], 'src': ['PBS_Elektrosophy', 'RRR_Dance'],
         'first': '2026-10-05', 'last': '2026-10-19', 'tidal': 'https://tidal.com/browse/track/1', 'dz': None},
        {'id': 'x2', 'a': '', 't': 'No artist', 'src': [], 'tags': []},
    ],
}


def test_export_is_mapped_onto_the_ingest_sections():
    assert _is_export(EXPORT) and not _is_export({'tracks': [{'artist': 'A', 'title': 'T'}]})
    out = _from_export(EXPORT)
    assert [t['id'] for t in out['tracks']] == ['x1']  # a track without an artist is never imported
    t = out['tracks'][0]
    assert (t['artist'], t['title'], t['mix_name'], t['label'], t['genre'], t['energy']) == ('Bicep', 'Glue', 'Original Mix', 'Ninja Tune', 'House', 7)
    assert t['duration_ms'] == 269000 and t['tidal_id'] == '1' and t['deezer_id'] is None
    assert out['track_tags'] == [{'track_id': 'x1', 'tag': 'peak'}]
    assert out['rotation_history'] == [{'track_id': 'x1', 'rotation': 2, 'changed_at': '2026-10-23T20:27:14'}]
    dates = sorted((a['source'], a['date']) for a in out['appearances'])
    assert dates == [('PBS_Elektrosophy', '2026-10-05'), ('PBS_Elektrosophy', '2026-10-19'), ('RRR_Dance', '2026-10-19')]
    assert out['runs'] == EXPORT['runs'] and out['sources'] == [{'name': 'PBS_Elektrosophy', 'type': 'radio'}]
