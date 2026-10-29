import pytest
from unittest.mock import AsyncMock

from services.library.importer.import_library import _process_payload

pytestmark = pytest.mark.asyncio

ALLOWED_MIGRATION_014_EVIDENCE_FIELDS = {
    'bpm',
    'key',
    'energy',
    'isrc',
    'duration_ms',
    'mix_name',
    'genre',
    'record_label',
    'tidal_id',
    'deezer_id',
    'musicbrainz_id',
    # Additional allowed metadata fields mentioned in specification:
    'title',
    'artist',
    'album',
    'release_date',
}


@pytest.fixture
def mock_conn():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    conn.fetchval = AsyncMock(return_value=1)
    return conn


async def test_import_evidence_fields_only_allowed(mock_conn, mocker):
    mocker.patch('services.library.importer.import_library.upsert_track', AsyncMock(return_value={'id': 'test_track_id', 'status': 'created'}))
    mock_record_evidence = mocker.patch('services.library.importer.import_library.record_evidence', AsyncMock())
    mocker.patch('services.library.importer.import_library.append_outbox', AsyncMock())
    mocker.patch('services.library.importer.import_library.apply_evidence', AsyncMock())

    payload = {
        'tracks': [
            {
                'id': 'track_1',
                'artist': 'Artist 1',
                'title': 'Title 1',
                'lbl': 'Label Short',
                'label': 'Label Full',
                'release_year': '2024',
                'isrc': 'US1234567890',
                'tidal_id': 'tidal123',
                'deezer_id': 'deezer123',
                'musicbrainz_id': 'mbid123',
                'genre': 'House',
                'bpm': 124.0,
                'key': '8A',
                'duration_ms': 300000,
                'mix_name': 'Original Mix',
            }
        ]
    }

    stats = await _process_payload(mock_conn, payload)

    assert stats['tracks']['inserted'] == 1
    assert stats['tracks']['skipped'] == 1

    assert mock_record_evidence.called
    recorded_fields = set()
    for call_args in mock_record_evidence.call_args_list:
        field = call_args[0][2]
        recorded_fields.add(field)
        assert field in ALLOWED_MIGRATION_014_EVIDENCE_FIELDS, f"Field '{field}' is not in allowed evidence fields"

    assert 'record_label' in recorded_fields
    assert 'label' not in recorded_fields
    assert 'lbl' not in recorded_fields
    assert 'release_year' not in recorded_fields
