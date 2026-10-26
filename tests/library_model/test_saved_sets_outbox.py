import pytest
import uuid
from unittest.mock import AsyncMock, patch

from library.model.library_db import save_set, SET_NAMESPACE

@pytest.mark.asyncio
async def test_save_set_outbox_event():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    conn.fetchval = AsyncMock(return_value=123)

    with patch('library.model.library_db.append_outbox', new_callable=AsyncMock) as mock_append_outbox:
        # Create a set
        set_id = await save_set(conn, set_id=None, name="My Set", description="A test set", tracks=[])

        # Verify append_outbox was called
        mock_append_outbox.assert_called_once()

        args, kwargs = mock_append_outbox.call_args

        assert args[0] == conn
        assert args[1] == 'library_set'

        # Check aggregate_id
        aggregate_id = args[2]
        assert isinstance(aggregate_id, uuid.UUID)

        # Calculate expected UUID
        expected_uuid = uuid.uuid5(SET_NAMESPACE, "123")
        assert aggregate_id == expected_uuid

        assert args[3] == 'library.set.saved.v1'

        # Check payload
        payload = args[4]
        assert payload['set_id'] == 123
        assert payload['name'] == "My Set"
        assert payload['description'] == "A test set"
        assert payload['tracks'] == []

@pytest.mark.asyncio
async def test_save_set_outbox_event_update():
    conn = AsyncMock()
    conn.execute = AsyncMock()

    with patch('library.model.library_db.append_outbox', new_callable=AsyncMock) as mock_append_outbox:
        # Update a set
        set_id = await save_set(conn, set_id=456, name="Updated Set", description="An updated test set", tracks=[])

        # Verify append_outbox was called
        mock_append_outbox.assert_called_once()

        args, kwargs = mock_append_outbox.call_args

        # Check aggregate_id
        aggregate_id = args[2]
        assert isinstance(aggregate_id, uuid.UUID)

        # Calculate expected UUID
        expected_uuid = uuid.uuid5(SET_NAMESPACE, "456")
        assert aggregate_id == expected_uuid

        # Check payload
        payload = args[4]
        assert payload['set_id'] == 456
        assert payload['name'] == "Updated Set"
