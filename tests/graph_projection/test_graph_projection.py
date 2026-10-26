import sys
import os
sys.path.insert(0, os.path.abspath('services'))

import pytest
from common.datalayer.graph_projection import handle_event, CONSUMER, ensure_constraints
from uuid import uuid4
import json
from unittest.mock import patch, MagicMock

@pytest.fixture
def mock_conn():
    return MagicMock()

@pytest.fixture
def mock_client():
    client = MagicMock()
    return client

@pytest.mark.asyncio
async def test_handle_event_create_track(mock_conn, mock_client):
    event = {
        'event_type': 'created',
        'aggregate_type': 'track',
        'aggregate_id': uuid4(),
        'payload': json.dumps({'id': str(uuid4()), 'track_title': 'Test Title'})
    }

    with patch('common.datalayer.graph_projection.client', mock_client):
        with patch('common.datalayer.graph_projection.project_track') as mock_project_track, \
             patch('common.datalayer.graph_projection.project_transitions') as mock_project_transitions, \
             patch('common.datalayer.graph_projection.project_ref_mb_edges') as mock_project_ref_mb_edges, \
             patch('common.datalayer.graph_projection.ensure_constraints') as mock_ensure_constraints:

            await handle_event(mock_conn, event)

            mock_ensure_constraints.assert_called_once()
            mock_project_track.assert_called_once_with(mock_conn, event['aggregate_id'])
            mock_project_transitions.assert_called_once_with(mock_conn, event['aggregate_id'])
            mock_project_ref_mb_edges.assert_called_once_with(mock_conn, event['aggregate_id'])

@pytest.mark.asyncio
async def test_handle_event_delete_track(mock_conn, mock_client):
    event = {
        'event_type': 'deleted',
        'aggregate_type': 'track',
        'aggregate_id': uuid4(),
        'payload': json.dumps({'id': str(uuid4())})
    }

    with patch('common.datalayer.graph_projection.client', mock_client):
        with patch('common.datalayer.graph_projection.project_track') as mock_project_track, \
             patch('common.datalayer.graph_projection.project_transitions') as mock_project_transitions, \
             patch('common.datalayer.graph_projection.project_ref_mb_edges') as mock_project_ref_mb_edges, \
             patch('common.datalayer.graph_projection.ensure_constraints') as mock_ensure_constraints:

            await handle_event(mock_conn, event)

            mock_ensure_constraints.assert_called_once()
            mock_project_track.assert_called_once_with(mock_conn, event['aggregate_id'])
            mock_project_transitions.assert_called_once_with(mock_conn, event['aggregate_id'])
            mock_project_ref_mb_edges.assert_called_once_with(mock_conn, event['aggregate_id'])
