# SongNodes Integration Test Suite

## Overview

Comprehensive integration testing for the SongNodes enrichment infrastructure covering:
- Medallion Architecture (Bronze → Silver → Gold)
- Dead-Letter Queue (DLQ) system
- API Integration Gateway
- Configuration-driven waterfall enrichment
- Circuit breaker patterns
- End-to-end enrichment workflows
- Metrics and observability

## Test Architecture

```
tests/integration/
├── conftest.py                     # Test fixtures and configuration
├── test_medallion_flow.py          # Medallion architecture tests (9 tests)
├── test_dlq_flow.py                # DLQ system tests (8 tests)
├── test_api_gateway.py             # API Gateway tests (11 tests)
├── test_waterfall_config.py        # Waterfall enrichment tests (8 tests)
├── test_enrichment_e2e.py          # End-to-end workflow tests (6 tests)
├── test_metrics.py                 # Metrics and observability tests (11 tests)
└── README.md                       # This file
```

**Total: 53 integration tests**

## Test Categories

### 1. Medallion Architecture Tests (`test_medallion_flow.py`)

Tests the layered data architecture:

- **Bronze Layer**: Raw data ingestion and immutability
- **Silver Layer**: Enriched data with quality scoring
- **Gold Layer**: Analytics and aggregations
- **Data Lineage**: Provenance tracking across layers
- **Performance**: Query performance benchmarks

**Key Tests:**
- `test_bronze_to_silver_flow` - Data progression with enrichment
- `test_data_quality_score` - Quality scoring validation
- `test_enrichment_completeness` - Completeness calculation
- `test_data_lineage` - Bronze → Silver → Gold lineage
- `test_bronze_immutability` - Append-only enforcement
- `test_layer_performance` - Query performance benchmarks

### 2. Dead-Letter Queue Tests (`test_dlq_flow.py`)

Tests the DLQ system for failed enrichments:

- **Message Publishing**: Failed enrichments route to DLQ
- **Message Inspection**: Retrieve and analyze DLQ messages
- **Replay Functionality**: Re-process failed messages
- **Batch Operations**: Batch replay and purge
- **Retention Policies**: TTL and retention enforcement

**Key Tests:**
- `test_dlq_failure_and_replay` - Failure → DLQ → Replay workflow
- `test_dlq_message_inspection` - Message details retrieval
- `test_dlq_batch_replay` - Batch processing
- `test_dlq_metrics_export` - Prometheus metrics

### 3. API Gateway Tests (`test_api_gateway.py`)

Tests the API Integration Gateway resilience patterns:

- **Rate Limiting**: Token bucket rate limiting
- **Caching**: Cache hit/miss behavior
- **Circuit Breakers**: State transitions and manual control
- **Provider Routing**: Request routing to correct APIs
- **Metrics Export**: Prometheus metrics

**Key Tests:**
- `test_rate_limiting` - Rate limiter activation
- `test_caching` - Cache performance and consistency
- `test_circuit_breaker_state` - Circuit breaker monitoring
- `test_provider_routing` - Multi-provider routing
- `test_gateway_metrics` - Metrics export

### 4. Waterfall Enrichment Tests (`test_waterfall_config.py`)

Tests configuration-driven waterfall enrichment:

- **Priority Order**: Provider priority configuration
- **Fallback Behavior**: Waterfall fallback on failure
- **Provenance Tracking**: Provider attribution
- **Confidence Thresholds**: Quality filtering
- **Configuration Updates**: Hot-reload capability

**Key Tests:**
- `test_waterfall_priority_order` - Priority enforcement
- `test_provenance_tracking` - Provider and confidence tracking
- `test_waterfall_fallback` - Multi-provider fallback
- `test_confidence_threshold_filtering` - Quality filtering
- `test_configuration_update` - Dynamic config updates

### 5. End-to-End Tests (`test_enrichment_e2e.py`)

Tests complete enrichment workflows:

- **Full Pipeline**: Bronze → Enrich → Silver → Gold
- **Missing Tracks**: Graceful handling of non-existent tracks
- **Waterfall Fallback**: Multi-provider enrichment
- **Idempotency**: Consistent results on repeat enrichment
- **Batch Processing**: Concurrent enrichment

**Key Tests:**
- `test_complete_enrichment_flow` - Full pipeline validation
- `test_enrichment_with_missing_track` - Error handling
- `test_enrichment_idempotency` - Result consistency
- `test_batch_enrichment` - Concurrent processing

### 6. Metrics Tests (`test_metrics.py`)

Tests observability and monitoring:

- **Prometheus Export**: All services export metrics
- **Metric Format**: Proper Prometheus format and labels
- **Custom Metrics**: Business-specific metrics
- **Performance**: Fast metrics scraping
- **Consistency**: Counter monotonicity

**Key Tests:**
- `test_prometheus_metrics_exported` - All services export metrics
- `test_api_gateway_metrics` - Gateway-specific metrics
- `test_enrichment_metrics` - Enrichment-specific metrics
- `test_metric_labels` - Proper label usage
- `test_metrics_consistency` - Counter monotonicity

## Running Tests

### Prerequisites

1. **Start Services**: All services must be running
   ```bash
   docker compose up -d
   ```

2. **Verify Services**: Check all services are healthy
   ```bash
   ./scripts/health_check.sh
   ```

3. **Environment Variables**: Configure test environment
   ```bash
   export DB_HOST=localhost
   export DB_PORT=5433
   export API_GATEWAY_URL=http://localhost:8100
   export METADATA_ENRICHMENT_URL=http://localhost:8020
   export DLQ_MANAGER_URL=http://localhost:8024
   ```

### Run All Integration Tests

```bash
# Complete test suite with coverage
./scripts/run_integration_tests.sh

# Or manually:
pytest tests/integration/ -v --cov=services --cov-report=html
```

### Run Specific Test Files

```bash
# Medallion architecture tests
pytest tests/integration/test_medallion_flow.py -v

# DLQ system tests
pytest tests/integration/test_dlq_flow.py -v

# API Gateway tests
pytest tests/integration/test_api_gateway.py -v

# Waterfall enrichment tests
pytest tests/integration/test_waterfall_config.py -v

# End-to-end tests
pytest tests/integration/test_enrichment_e2e.py -v

# Metrics tests
pytest tests/integration/test_metrics.py -v
```

### Run Specific Tests

```bash
# Single test
pytest tests/integration/test_medallion_flow.py::test_bronze_to_silver_flow -v

# Tests by marker
pytest tests/integration/ -m integration -v
pytest tests/integration/ -m e2e -v

# Tests by keyword
pytest tests/integration/ -k "cache" -v
pytest tests/integration/ -k "circuit_breaker" -v
```

### Run with Options

```bash
# Verbose output
pytest tests/integration/ -v

# Show print statements
pytest tests/integration/ -v -s

# Stop on first failure
pytest tests/integration/ -v -x

# Run in parallel (4 workers)
pytest tests/integration/ -v -n 4

# Generate HTML coverage report
pytest tests/integration/ --cov=services --cov-report=html

# Generate JUnit XML for CI
pytest tests/integration/ --junit-xml=test-results/integration.xml
```

## Test Configuration

### Pytest Configuration (`pytest.ini`)

```ini
[pytest]
asyncio_mode = auto
testpaths = tests/integration
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    integration: Integration tests
    e2e: End-to-end tests
    performance: Performance tests
    slow: Slow-running tests
```

### Fixtures (`conftest.py`)

Key fixtures available to all tests:

- **`db_connection`**: Async PostgreSQL connection
- **`http_client`**: HTTP client for API calls
- **`service_urls`**: Dictionary of service URLs
- **`test_track_data`**: Sample track data
- **`cleanup_test_data`**: Automatic cleanup after tests
- **`wait_for_service`**: Wait for service availability

## Service Dependencies

### Required Services

All tests require these services to be running:

| Service | URL | Port |
|---------|-----|------|
| PostgreSQL | localhost | 5433 |
| API Gateway | http://localhost:8100 | 8100 |
| Metadata Enrichment | http://localhost:8020 | 8020 |
| DLQ Manager | http://localhost:8024 | 8024 |
| Redis | localhost | 6380 |
| RabbitMQ | localhost | 5672 |

### Service Health Checks

Before running tests, verify services:

```bash
# Check all services
curl http://localhost:8100/health  # API Gateway
curl http://localhost:8020/health  # Metadata Enrichment
curl http://localhost:8024/health  # DLQ Manager

# Or use health check script
./scripts/health_check.sh
```

## Test Data Management

### Test Data Isolation

- Tests use `source='integration_test'` for Bronze records
- Tests use `artist_name LIKE 'IntegrationTest%'` for Silver records
- Automatic cleanup via `cleanup_test_data` fixture

### Cleanup Strategy

```python
# Automatic cleanup after each test
@pytest.fixture
async def cleanup_test_data(db_connection):
    yield
    # Cleanup runs here
    await db_connection.execute("""
        DELETE FROM bronze_scraped_tracks
        WHERE source = 'integration_test'
    """)
```

## Performance Benchmarks

### Expected Performance

| Test | Expected Time | Threshold |
|------|---------------|-----------|
| Bronze insert | < 100ms | 200ms |
| Silver enrichment | < 5s | 10s |
| DLQ replay | < 2s | 5s |
| Cache hit | < 10ms | 50ms |
| Metrics scrape | < 500ms | 1s |

### Performance Tests

```bash
# Run with timing
pytest tests/integration/ -v --durations=10

# Benchmark specific test
pytest tests/integration/test_api_gateway.py::test_caching -v --benchmark
```

## Troubleshooting

### Common Issues

**Services Not Running**
```bash
# Error: Connection refused
# Solution: Start services
docker compose up -d
```

**Database Connection Failed**
```bash
# Error: Could not connect to database
# Solution: Check PostgreSQL is running and credentials match
docker compose ps postgres
docker compose logs postgres
```

**DLQ Tests Timeout**
```bash
# Error: DLQ messages not appearing
# Solution: Check RabbitMQ and DLQ Manager
docker compose logs dlq-manager
docker compose logs rabbitmq
```

**Enrichment Timeouts**
```bash
# Error: Enrichment request timeout
# Solution: Increase timeout or check external APIs
# Check circuit breaker status
curl http://localhost:8100/admin/circuit-breakers
```

### Debug Mode

```bash
# Run with debug logging
pytest tests/integration/ -v -s --log-cli-level=DEBUG

# Run single test with breakpoint
pytest tests/integration/test_medallion_flow.py::test_bronze_to_silver_flow -v -s --pdb
```

### Clean Start

```bash
# Complete reset
docker compose down -v
docker compose up -d
./scripts/health_check.sh
pytest tests/integration/ -v
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: docker compose up -d

      - name: Wait for services
        run: ./scripts/health_check.sh

      - name: Run integration tests
        run: |
          pytest tests/integration/ \
            --junit-xml=test-results/integration.xml \
            --cov=services \
            --cov-report=xml

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

## Test Coverage Goals

### Current Coverage

- **Medallion Architecture**: 9 tests covering Bronze, Silver, Gold layers
- **DLQ System**: 8 tests covering failure handling and replay
- **API Gateway**: 11 tests covering resilience patterns
- **Waterfall Enrichment**: 8 tests covering configuration and fallback
- **End-to-End**: 6 tests covering complete workflows
- **Metrics**: 11 tests covering observability

**Total: 53 integration tests**

### Coverage Targets

| Component | Target | Current |
|-----------|--------|---------|
| Medallion Flow | 90% | ~85% |
| DLQ System | 90% | ~80% |
| API Gateway | 85% | ~75% |
| Enrichment | 90% | ~80% |
| Overall | 85% | ~80% |

## Best Practices

### Writing Integration Tests

1. **Use fixtures**: Leverage shared fixtures for setup
2. **Cleanup**: Always cleanup test data
3. **Independence**: Tests should be independent
4. **Idempotency**: Tests should be repeatable
5. **Realistic data**: Use real-world test cases
6. **Error cases**: Test failure scenarios
7. **Performance**: Set reasonable timeouts

### Example Test

```python
@pytest.mark.integration
@pytest.mark.asyncio
async def test_example(
    db_connection,
    http_client,
    service_urls,
    cleanup_test_data
):
    """Test description."""

    # 1. Setup
    test_data = {"artist": "Test", "title": "Track"}

    # 2. Execute
    response = await http_client.post(
        f"{service_urls['metadata_enrichment']}/enrich",
        json=test_data,
        timeout=60.0
    )

    # 3. Assert
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "completed"

    # 4. Cleanup (automatic via fixture)
```

## Metrics and Monitoring

### Test Execution Metrics

- Test duration
- Test success rate
- Coverage percentage
- Flaky test detection

### Integration with Monitoring

Tests validate that metrics are properly exported:

```bash
# Check metrics availability
curl http://localhost:8100/metrics | grep api_gateway
curl http://localhost:8020/metrics | grep enrichment
curl http://localhost:8024/metrics | grep dlq
```

## Maintenance

### Regular Tasks

- **Weekly**: Review failed tests and fix flaky tests
- **Monthly**: Update test data and fixtures
- **Quarterly**: Review coverage and add missing tests
- **Release**: Full test suite execution

### Test Health

```bash
# Check for flaky tests
pytest tests/integration/ --count=10

# Test coverage report
pytest tests/integration/ --cov=services --cov-report=term-missing
```

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [httpx](https://www.python-httpx.org/)
- [asyncpg](https://magicstack.github.io/asyncpg/)
- [SongNodes Architecture Docs](../../docs/)

## Contact

For questions or issues with tests:
- Check existing test failures in CI
- Review test logs in `test-results/`
- Consult team documentation
