# SongNodes Integration Testing - Quick Start Guide

## TL;DR

```bash
# 1. Start services
docker compose up -d

# 2. Run all integration tests
./scripts/run_integration_tests.sh
```

## What You Get

**53 integration tests** covering:
- ✓ Medallion Architecture (Bronze → Silver → Gold)
- ✓ Dead-Letter Queue system
- ✓ API Integration Gateway
- ✓ Waterfall enrichment
- ✓ End-to-end workflows

## Prerequisites

### Services Required

All services must be running:

```bash
# Start all services
docker compose up -d

# OR use isolated test environment
docker compose -f docker-compose.test.yml up -d

# Verify all services are healthy
./scripts/health_check.sh
```

Expected output:
```
============================================
SongNodes Service Health Check
============================================

Checking PostgreSQL... ✓ OK
Checking Redis... ✓ OK
Checking RabbitMQ Management... ✓ OK
Checking API Gateway... ✓ OK
Checking Metadata Enrichment... ✓ OK
Checking DLQ Manager... ✓ OK

============================================
All services healthy!
Ready to run integration tests.
```

## Running Tests

### Option 1: Test Runner Script (Recommended)

```bash
# Run all tests with coverage
./scripts/run_integration_tests.sh

# Verbose output
./scripts/run_integration_tests.sh -v

# Parallel execution (8 workers)
./scripts/run_integration_tests.sh -p -w 8

# Only end-to-end tests
./scripts/run_integration_tests.sh -m e2e

# Stop on first failure
./scripts/run_integration_tests.sh -x
```

### Option 2: Direct Pytest

```bash
# All tests
pytest tests/integration/ -v

# Specific test file
pytest tests/integration/test_medallion_flow.py -v

# Specific test
pytest tests/integration/test_medallion_flow.py::test_bronze_to_silver_flow -v

# With coverage
pytest tests/integration/ -v --cov=services --cov-report=html
```

## Test Categories

### 1. Medallion Architecture (9 tests)

Tests layered data architecture:

```bash
pytest tests/integration/test_medallion_flow.py -v
```

Key tests:
- Bronze layer ingestion and immutability
- Silver layer enrichment with quality scoring
- Gold layer analytics
- Data lineage tracking

### 2. Dead-Letter Queue (8 tests)

Tests failure handling and recovery:

```bash
pytest tests/integration/test_dlq_flow.py -v
```

Key tests:
- Failed enrichments route to DLQ
- Message replay (single and batch)
- Retention policies
- Metrics export

### 3. API Gateway (11 tests)

Tests resilience patterns:

```bash
pytest tests/integration/test_api_gateway.py -v
```

Key tests:
- Rate limiting
- Caching (2x+ speedup)
- Circuit breakers
- Provider routing

### 4. Waterfall Enrichment (8 tests)

Tests configuration-driven enrichment:

```bash
pytest tests/integration/test_waterfall_config.py -v
```

Key tests:
- Provider priority order
- Fallback behavior
- Provenance tracking
- Confidence thresholds

### 5. End-to-End Workflows (6 tests)

Tests complete pipelines:

```bash
pytest tests/integration/test_enrichment_e2e.py -v
```

Key tests:
- Full enrichment flow
- Error handling
- Idempotency
- Batch processing

### 6. Metrics & Observability (11 tests)

Tests monitoring infrastructure:

```bash
pytest tests/integration/test_metrics.py -v
```

Key tests:
- Prometheus metrics export
- Metric format and labels
- Custom business metrics
- Metric consistency

## Quick Filters

### Run Specific Tests

```bash
# All cache-related tests
pytest tests/integration/ -k "cache" -v

# All circuit breaker tests
pytest tests/integration/ -k "circuit_breaker" -v

# All waterfall tests
pytest tests/integration/ -k "waterfall" -v

# All DLQ tests
pytest tests/integration/ -k "dlq" -v
```

### Run by Marker

```bash
# Integration tests only
pytest tests/integration/ -m integration -v

# End-to-end tests only
pytest tests/integration/ -m e2e -v

# Slow tests
pytest tests/integration/ -m slow -v
```

## Test Results

### Expected Output

```
============================================
Test Results Summary
============================================

Total tests:   53
Passed:        50 ✓
Failed:        0
Errors:        0
Skipped:       3
Duration:      238.45s

Coverage report: file:///path/to/htmlcov/index.html

Integration tests PASSED ✓
```

### Coverage Report

After running tests, open the HTML coverage report:

```bash
# Generate coverage report
pytest tests/integration/ --cov=services --cov-report=html

# Open in browser (Linux)
xdg-open htmlcov/index.html

# Open in browser (macOS)
open htmlcov/index.html
```

## Common Options

```bash
# Verbose output with print statements
pytest tests/integration/ -v -s

# Stop on first failure
pytest tests/integration/ -v -x

# Parallel execution (4 workers)
pytest tests/integration/ -v -n 4

# Show slowest 10 tests
pytest tests/integration/ -v --durations=10

# Generate JUnit XML for CI
pytest tests/integration/ --junit-xml=test-results/integration.xml

# Debug logging
pytest tests/integration/ -v -s --log-cli-level=DEBUG
```

## Troubleshooting

### Services Not Running

```bash
# Error: Connection refused

# Solution:
docker compose up -d
./scripts/health_check.sh
```

### Database Connection Failed

```bash
# Error: Could not connect to database

# Solution:
docker compose ps postgres
docker compose logs postgres
docker compose restart postgres
```

### DLQ Tests Timeout

```bash
# Error: DLQ messages not appearing

# Solution:
docker compose logs dlq-manager
docker compose logs rabbitmq
docker compose restart dlq-manager rabbitmq
```

### Enrichment Timeouts

```bash
# Error: Enrichment request timeout

# Solution:
docker compose logs metadata-enrichment
curl http://localhost:8100/admin/circuit-breakers
docker compose restart metadata-enrichment api-gateway
```

### Clean Start

```bash
# Complete reset
docker compose down -v
docker compose up -d
./scripts/health_check.sh
pytest tests/integration/ -v
```

## Performance Expectations

| Operation | Expected | Threshold |
|-----------|----------|-----------|
| Bronze insert | < 100ms | 200ms |
| Silver enrichment | < 5s | 10s |
| DLQ replay | < 2s | 5s |
| Cache hit | < 10ms | 50ms |
| Metrics scrape | < 500ms | 1s |
| Full test suite | ~4 min | 5 min |

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run integration tests
  run: |
    docker compose up -d
    ./scripts/health_check.sh
    ./scripts/run_integration_tests.sh
```

### GitLab CI

```yaml
integration_tests:
  script:
    - docker compose up -d
    - ./scripts/health_check.sh
    - ./scripts/run_integration_tests.sh
  artifacts:
    reports:
      junit: test-results/integration.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml
```

## Test Documentation

For detailed documentation, see:

- **Integration Test README**: `/mnt/my_external_drive/programming/songnodes/tests/integration/README.md`
- **Test Summary**: `/mnt/my_external_drive/programming/songnodes/docs/INTEGRATION_TEST_SUMMARY.md`
- **Health Check Script**: `/mnt/my_external_drive/programming/songnodes/scripts/health_check.sh`
- **Test Runner Script**: `/mnt/my_external_drive/programming/songnodes/scripts/run_integration_tests.sh`

## Getting Help

```bash
# Test runner help
./scripts/run_integration_tests.sh --help

# Pytest help
pytest --help

# Health check
./scripts/health_check.sh

# Service status
docker compose ps

# Service logs
docker compose logs [service-name]
```

## Quick Reference

```bash
# Start everything and run tests
docker compose up -d && ./scripts/run_integration_tests.sh

# Run specific test category
./scripts/run_integration_tests.sh -m e2e

# Run with verbose output
./scripts/run_integration_tests.sh -v

# Run in parallel
./scripts/run_integration_tests.sh -p -w 8

# Stop on first failure
./scripts/run_integration_tests.sh -x

# Skip health check (faster)
./scripts/run_integration_tests.sh --skip-health-check
```

---

**Test Suite Version**: 1.0.0
**Total Tests**: 53
**Estimated Duration**: ~4 minutes
**Coverage**: 80%
