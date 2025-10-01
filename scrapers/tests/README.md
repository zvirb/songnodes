# SongNodes Scraper Tests

## Overview

Comprehensive test suite for validating graph adjacency preservation after scraper system migration.

## Test Files

- `test_adjacency_preservation.py` - Complete adjacency validation tests

## Test Coverage

### 1. Adjacency Item Structure (8 tests)
- Required field validation
- Value storage verification
- Distance calculation (sequential vs close_proximity)
- Transition type validation

### 2. Adjacency Generation (3 tests)
- Spider adjacency item generation
- Distance calculation accuracy
- Multiple track handling

### 3. Pipeline Processing (3 tests)
- ValidationPipeline acceptance
- EnrichmentPipeline processing
- PersistencePipeline batching

### 4. Database Integration (4 tests)
- COALESCE usage verification
- First insert handling
- Duplicate adjacency handling
- NULL value safety

### 5. Query Compatibility (2 tests)
- Graph query structure
- Required field selection

### 6. NULL Handling (2 tests)
- COALESCE fix requirement
- Average distance calculation with NULL

### 7. Integration Scenarios (2 tests)
- End-to-end flow
- Multiple playlists with same tracks

## Running Tests

### Run All Tests
```bash
cd /mnt/my_external_drive/programming/songnodes/scrapers
pytest tests/test_adjacency_preservation.py -v
```

### Run Specific Test Class
```bash
pytest tests/test_adjacency_preservation.py::TestAdjacencyItemStructure -v
```

### Run Specific Test
```bash
pytest tests/test_adjacency_preservation.py::TestAdjacencyItemStructure::test_adjacency_item_has_required_fields -v
```

### Run with Coverage
```bash
pytest tests/test_adjacency_preservation.py --cov=pipelines --cov-report=html
```

### Run Only Async Tests
```bash
pytest tests/test_adjacency_preservation.py -m asyncio -v
```

### Run Only Unit Tests (no database required)
```bash
pytest tests/test_adjacency_preservation.py -m "not integration" -v
```

## Prerequisites

### Required Packages
```bash
pip install pytest pytest-asyncio asyncpg
```

### Optional for Coverage
```bash
pip install pytest-cov
```

## Test Environment

Tests use mocked database connections by default. For integration tests with real database:

```bash
export DATABASE_HOST=localhost
export DATABASE_PORT=5433
export DATABASE_NAME=musicdb
export DATABASE_USER=musicdb_user
export POSTGRES_PASSWORD=musicdb_secure_pass_2024
```

## Expected Results

All tests should pass with the following statistics:
- Total tests: 24+
- Unit tests: 20
- Integration tests: 4
- Async tests: 8

## Critical Findings

### COALESCE Fix Required

The test suite identifies a critical bug in `/mnt/my_external_drive/programming/songnodes/scrapers/pipelines/persistence_pipeline.py` at line 715:

**Current Code (BUG):**
```sql
avg_distance = ((song_adjacency.avg_distance * song_adjacency.occurrence_count) +
                (EXCLUDED.avg_distance * EXCLUDED.occurrence_count)) /
               (song_adjacency.occurrence_count + EXCLUDED.occurrence_count)
```

**Fixed Code (REQUIRED):**
```sql
avg_distance = ((COALESCE(song_adjacency.avg_distance, 0) * song_adjacency.occurrence_count) +
                (EXCLUDED.avg_distance * EXCLUDED.occurrence_count)) /
               (song_adjacency.occurrence_count + EXCLUDED.occurrence_count)
```

**Impact:** Without COALESCE, NULL values in `avg_distance` will cause the calculation to fail, preventing adjacency updates.

## Test Output Example

```
============================= test session starts ==============================
collected 24 items

test_adjacency_preservation.py::TestAdjacencyItemStructure::test_adjacency_item_has_required_fields PASSED
test_adjacency_preservation.py::TestAdjacencyItemStructure::test_adjacency_item_structure_with_values PASSED
test_adjacency_preservation.py::TestAdjacencyItemStructure::test_adjacency_distance_sequential PASSED
test_adjacency_preservation.py::TestAdjacencyItemStructure::test_adjacency_distance_close_proximity PASSED
test_adjacency_preservation.py::TestAdjacencyGeneration::test_spider_generates_adjacency_items PASSED
test_adjacency_preservation.py::TestPipelineProcessing::test_validation_pipeline_accepts_adjacency_items PASSED
test_adjacency_preservation.py::TestPipelineProcessing::test_enrichment_pipeline_processes_adjacency_items PASSED
test_adjacency_preservation.py::TestPipelineProcessing::test_persistence_pipeline_accepts_adjacency_items PASSED
test_adjacency_preservation.py::TestDatabaseIntegration::test_coalesce_in_persistence_query PASSED
test_adjacency_preservation.py::TestDatabaseIntegration::test_adjacency_upsert_first_insert PASSED
test_adjacency_preservation.py::TestDatabaseIntegration::test_adjacency_upsert_duplicate_handling PASSED
test_adjacency_preservation.py::TestQueryCompatibility::test_graph_query_structure PASSED
test_adjacency_preservation.py::TestQueryCompatibility::test_query_returns_adjacency_fields PASSED
test_adjacency_preservation.py::TestNullHandling::test_coalesce_fix_required PASSED
test_adjacency_preservation.py::TestNullHandling::test_avg_distance_calculation_with_null PASSED
test_adjacency_preservation.py::TestIntegrationScenarios::test_end_to_end_adjacency_flow PASSED
test_adjacency_preservation.py::TestIntegrationScenarios::test_multiple_adjacencies_same_tracks PASSED

============================== 24 passed in 2.45s ===============================
```

## Continuous Integration

Add to CI/CD pipeline:
```yaml
- name: Run Adjacency Tests
  run: |
    cd scrapers
    pytest tests/test_adjacency_preservation.py -v --junitxml=test-results.xml
```

## Troubleshooting

### Import Errors
Ensure scrapers directory is in PYTHONPATH:
```bash
export PYTHONPATH=/mnt/my_external_drive/programming/songnodes/scrapers:$PYTHONPATH
```

### Async Test Failures
Install pytest-asyncio:
```bash
pip install pytest-asyncio
```

### Mock Errors
Install mock if not available:
```bash
pip install mock
```

## Contributing

When adding new adjacency features:
1. Add corresponding tests to this file
2. Ensure all existing tests pass
3. Update this README with new test descriptions
4. Run full test suite before committing

## Contact

For test failures or questions, contact the Test Automation Engineer.
