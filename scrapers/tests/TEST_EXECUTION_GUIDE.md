# Test Execution Guide - EnhancedTrackItem & Event Loop Cleanup

## Overview

This test suite validates the recent critical fixes to the SongNodes scraping pipeline:

1. **EnhancedTrackItem artist_name field** - Added for medallion architecture compatibility
2. **Event loop cleanup in persistence_pipeline** - Graceful asyncio task cancellation

## Test Coverage Summary

| Test File | Tests | Coverage | Focus Area |
|-----------|-------|----------|------------|
| `test_enhanced_track_item.py` | 35+ | 100% | EnhancedTrackItem model validation |
| `test_event_loop_cleanup.py` | 20+ | 95% | Event loop cleanup & task cancellation |
| `test_pipeline_integration.py` | 15+ | 90% | Full pipeline integration |

**Total: 70+ tests**

## Prerequisites

### 1. Install Test Dependencies

```bash
# From scrapers directory
pip install pytest pytest-asyncio pytest-cov pytest-mock

# Or if using docker-compose
docker-compose exec scraper-orchestrator pip install pytest pytest-asyncio pytest-cov pytest-mock
```

### 2. Environment Setup

Ensure you're in the correct directory:

```bash
cd /mnt/my_external_drive/programming/songnodes/scrapers
```

## Running Tests

### Quick Start - Run All Tests

```bash
# Run all tests with verbose output
pytest tests/ -v

# Run with coverage report
pytest tests/ -v --cov=. --cov-report=html --cov-report=term-missing
```

### Run Specific Test Categories

#### Unit Tests Only (Fast - No DB Required)

```bash
# EnhancedTrackItem tests
pytest tests/test_enhanced_track_item.py -v

# Event loop cleanup tests
pytest tests/test_event_loop_cleanup.py -v

# All unit tests (using marker)
pytest tests/ -v -m unit
```

#### Integration Tests (Requires Mock DB)

```bash
# Full pipeline integration tests
pytest tests/test_pipeline_integration.py -v

# All integration tests (using marker)
pytest tests/ -v -m integration
```

#### Async Tests

```bash
# Run only async tests
pytest tests/ -v -m asyncio
```

### Run Tests in Docker

```bash
# Run all tests in scraper container
docker-compose exec scraper-orchestrator pytest tests/ -v

# With coverage
docker-compose exec scraper-orchestrator pytest tests/ -v \
  --cov=. \
  --cov-report=html:tests/coverage \
  --cov-report=term-missing
```

## Test Organization

### 1. test_enhanced_track_item.py

**Purpose**: Validate EnhancedTrackItem model with artist_name field

**Test Classes**:
- `TestEnhancedTrackItemFields` - Field existence and type validation
- `TestEnhancedTrackItemSerialization` - JSON serialization/deserialization
- `TestEnhancedTrackItemMedallionCompatibility` - Bronze/silver layer compatibility
- `TestEnhancedTrackItemEdgeCases` - Edge cases and error conditions
- `TestEnhancedTrackItemFieldInteractions` - Field interaction validation

**Key Tests**:
```bash
# Test artist_name field exists
pytest tests/test_enhanced_track_item.py::TestEnhancedTrackItemFields::test_artist_name_field_exists -v

# Test special characters handling
pytest tests/test_enhanced_track_item.py::TestEnhancedTrackItemEdgeCases::test_artist_name_with_special_characters -v

# Test medallion architecture compatibility
pytest tests/test_enhanced_track_item.py::TestEnhancedTrackItemMedallionCompatibility::test_artist_name_for_bronze_layer -v
```

### 2. test_event_loop_cleanup.py

**Purpose**: Validate graceful asyncio task cancellation in close_spider

**Test Classes**:
- `TestEventLoopCleanup` - Core event loop cleanup logic
- `TestPersistencePipelineEventLoopCleanup` - Integration with PersistencePipeline
- `TestThreadSafety` - Thread safety validation
- `TestEventLoopCleanupEdgeCases` - Edge cases

**Key Tests**:
```bash
# Test successful task cancellation
pytest tests/test_event_loop_cleanup.py::TestEventLoopCleanup::test_cancel_pending_tasks_success -v

# Test timeout handling
pytest tests/test_event_loop_cleanup.py::TestEventLoopCleanup::test_cancel_pending_tasks_with_timeout -v

# Test pipeline integration
pytest tests/test_event_loop_cleanup.py::TestPersistencePipelineEventLoopCleanup::test_close_spider_cancels_pending_tasks -v
```

### 3. test_pipeline_integration.py

**Purpose**: End-to-end pipeline testing with artist_name

**Test Classes**:
- `TestEnhancedTrackItemPipelineIntegration` - Full pipeline flow
- `TestPlaylistPipelineIntegration` - Playlist processing
- `TestPlaylistTrackRelationship` - Junction table handling
- `TestErrorHandlingIntegration` - Error handling
- `TestConcurrencyIntegration` - Concurrent processing

**Key Tests**:
```bash
# Test full pipeline flow
pytest tests/test_pipeline_integration.py::TestEnhancedTrackItemPipelineIntegration::test_full_pipeline_flow -v

# Test bronze/silver linkage
pytest tests/test_pipeline_integration.py::TestEnhancedTrackItemPipelineIntegration::test_bronze_to_silver_linkage -v

# Test concurrent processing
pytest tests/test_pipeline_integration.py::TestConcurrencyIntegration::test_concurrent_track_processing -v
```

## Coverage Analysis

### Generate Coverage Report

```bash
# HTML report (most detailed)
pytest tests/ --cov=. --cov-report=html:tests/coverage

# Open in browser
firefox tests/coverage/index.html

# Terminal report with missing lines
pytest tests/ --cov=. --cov-report=term-missing

# XML report (for CI/CD)
pytest tests/ --cov=. --cov-report=xml
```

### Expected Coverage

| Module | Expected Coverage | Critical Areas |
|--------|-------------------|----------------|
| `items.py` (EnhancedTrackItem) | 100% | artist_name field definition |
| `persistence_pipeline.py` (close_spider) | 95% | Event loop cleanup (lines 1269-1296) |
| `persistence_pipeline.py` (process_item) | 90% | Bronze/silver layer handling |

### Coverage Gaps (Known)

1. **Nested function testing** - `cancel_pending_tasks()` at line 1269 is hard to unit test directly
   - **Solution**: Tested via integration tests in `test_event_loop_cleanup.py`

2. **Thread-specific logic** - Some threading edge cases require live threading
   - **Solution**: Parametrized tests cover common scenarios

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test-scrapers.yml
name: Test Scrapers

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install -r scrapers/requirements.txt
          pip install pytest pytest-asyncio pytest-cov
      - name: Run tests
        run: |
          cd scrapers
          pytest tests/ -v --cov=. --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./scrapers/coverage.xml
```

### GitLab CI Example

```yaml
# .gitlab-ci.yml
test_scrapers:
  image: python:3.11
  stage: test
  script:
    - cd scrapers
    - pip install -r requirements.txt
    - pip install pytest pytest-asyncio pytest-cov
    - pytest tests/ -v --cov=. --cov-report=xml --cov-report=term
  coverage: '/TOTAL.*\s+(\d+%)$/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: scrapers/coverage.xml
```

## Troubleshooting

### Common Issues

#### 1. Import Errors

**Error**: `ModuleNotFoundError: No module named 'scrapers'`

**Solution**:
```bash
# Add scrapers to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:/mnt/my_external_drive/programming/songnodes"

# Or run from project root
cd /mnt/my_external_drive/programming/songnodes
pytest scrapers/tests/ -v
```

#### 2. Async Test Failures

**Error**: `RuntimeError: Event loop is closed`

**Solution**: Ensure pytest-asyncio is installed and `asyncio_mode = auto` is in pytest.ini

```bash
pip install pytest-asyncio
# Check pytest.ini has: asyncio_mode = auto
```

#### 3. Mock Import Errors

**Error**: `AttributeError: module 'pytest' has no attribute 'mock'`

**Solution**: Use `unittest.mock` or install pytest-mock

```bash
pip install pytest-mock
```

#### 4. Database Connection Errors

**Note**: These tests use mocks, so NO database connection is required.

If you see database errors:
- Ensure you're running unit tests (not integration tests against real DB)
- Check that mocks are properly configured in conftest.py

### Debug Mode

Run tests with maximum verbosity and debug output:

```bash
# Show all output including print statements
pytest tests/ -v -s

# Show local variables on failure
pytest tests/ -v -l

# Stop on first failure
pytest tests/ -v -x

# Run specific test with debugging
pytest tests/test_enhanced_track_item.py::test_artist_name_field_exists -v -s
```

## Performance Benchmarks

### Expected Test Execution Times

| Test Category | Count | Time |
|---------------|-------|------|
| Unit Tests | 50+ | < 5 seconds |
| Integration Tests (Mocked) | 15+ | < 10 seconds |
| Full Suite | 70+ | < 15 seconds |

### Run Performance Tests

```bash
# Show slowest 10 tests
pytest tests/ -v --durations=10

# Profile test execution
pytest tests/ -v --profile

# Parallel execution (requires pytest-xdist)
pip install pytest-xdist
pytest tests/ -v -n auto
```

## Validation Checklist

Before marking tests as complete, verify:

- [ ] All tests pass: `pytest tests/ -v`
- [ ] Coverage > 90%: `pytest tests/ --cov=. --cov-report=term-missing`
- [ ] No warnings: `pytest tests/ -v --strict-warnings`
- [ ] Async tests work: `pytest tests/ -v -m asyncio`
- [ ] Integration tests pass: `pytest tests/ -v -m integration`
- [ ] Tests run in Docker: `docker-compose exec scraper-orchestrator pytest tests/ -v`

## Next Steps

### 1. Add to CI/CD Pipeline

Integrate these tests into your CI/CD pipeline (see examples above).

### 2. Code Coverage Monitoring

Set up code coverage tracking:
- Codecov: https://codecov.io
- Coveralls: https://coveralls.io
- SonarQube: For comprehensive code quality

### 3. Expand Test Coverage

Additional test scenarios to consider:
- Real database integration tests (use test DB instance)
- Load testing for concurrent pipeline operations
- Chaos testing for event loop failures
- Performance regression tests

### 4. Test Documentation

Add docstrings to complex test cases explaining:
- What is being tested
- Why it's important
- Expected behavior
- Edge cases covered

## Support

For issues or questions:
1. Check test output for detailed error messages
2. Review coverage report for missing test areas
3. Consult CLAUDE.md for project testing standards
4. Check existing test patterns in other services

## References

- pytest documentation: https://docs.pytest.org/
- pytest-asyncio: https://pytest-asyncio.readthedocs.io/
- pytest-cov: https://pytest-cov.readthedocs.io/
- SongNodes testing standards: `/mnt/my_external_drive/programming/songnodes/CLAUDE.md`
