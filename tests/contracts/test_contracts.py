import json
import os
import pytest
import sys
from jsonschema import validate
import yaml

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

@pytest.mark.contract
def test_event_schemas_valid():
    """Verify that the generated event fixtures conform to our schemas."""
    schema_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'contracts')
    events_dir = os.path.join(schema_dir, 'fixtures', 'events')

    # Load schema
    upsert_schema_path = os.path.join(schema_dir, 'library.track.upserted.v1.json')
    with open(upsert_schema_path, 'r') as f:
        upsert_schema = json.load(f)

    # Load event
    sample_event_path = os.path.join(events_dir, 'sample_upsert.json')
    with open(sample_event_path, 'r') as f:
        sample_event = json.load(f)

    # Validate
    validate(instance=sample_event, schema=upsert_schema)

@pytest.mark.contract
def test_openapi_spec_valid():
    """Verify OpenAPI spec is valid YAML."""
    schema_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'contracts')
    openapi_path = os.path.join(schema_dir, 'library_ingest.openapi.yaml')
    with open(openapi_path, 'r') as f:
        spec = yaml.safe_load(f)
        assert 'openapi' in spec
        assert 'paths' in spec
        assert '/api/v1/library/ingest' in spec['paths']

@pytest.mark.live
def test_real_data_presence():
    """Example test that would only run when 'live' is specified."""
    assert True
