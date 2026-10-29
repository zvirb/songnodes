import pytest
import uuid
from unittest.mock import AsyncMock, patch

from library.model.library_db import save_set, SET_NAMESPACE

@pytest.mark.asyncio
async def test_save_set_outbox_uuid_aggregate_id_insert():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    conn.fetchval = AsyncMock(return_value=123)

    with patch('library.model.library_db.append_outbox', new_callable=AsyncMock) as mock_append_outbox:
        set_id = await save_set(conn, set_id=None, name="Test Set", description="A set description", tracks=[])

        assert set_id == 123
        mock_append_outbox.assert_called_once()

        args, _ = mock_append_outbox.call_args

        # args: (conn, aggregate_type, aggregate_id, event_type, payload)
        assert args[0] == conn
        assert args[1] == 'library_set'

        aggregate_id = args[2]
        assert isinstance(aggregate_id, uuid.UUID)
        expected_uuid = uuid.uuid5(SET_NAMESPACE, "123")
        assert aggregate_id == expected_uuid

        assert args[3] == 'library.set.saved.v1'

        payload = args[4]
        assert payload['set_id'] == 123
        assert payload['name'] == "Test Set"
        assert payload['description'] == "A set description"
        assert payload['tracks'] == []

@pytest.mark.asyncio
async def test_save_set_outbox_uuid_aggregate_id_update():
    conn = AsyncMock()
    conn.execute = AsyncMock()

    with patch('library.model.library_db.append_outbox', new_callable=AsyncMock) as mock_append_outbox:
        set_id = await save_set(conn, set_id=456, name="Updated Set", description="Updated description", tracks=[])

        assert set_id == 456
        mock_append_outbox.assert_called_once()

        args, _ = mock_append_outbox.call_args

        assert args[0] == conn
        assert args[1] == 'library_set'

        aggregate_id = args[2]
        assert isinstance(aggregate_id, uuid.UUID)
        expected_uuid = uuid.uuid5(SET_NAMESPACE, "456")
        assert aggregate_id == expected_uuid

        assert args[3] == 'library.set.saved.v1'

        payload = args[4]
        assert payload['set_id'] == 456
        assert payload['name'] == "Updated Set"
