# SongNodes Test Automation Framework

## Overview
Comprehensive test automation framework for the SongNodes music database project covering unit, integration, API, performance, and end-to-end testing.

## Python test suites

The repository-root `pytest.ini` governs every Python run below (its `testpaths` is
`tests`). There is no other pytest config under `tests/`. Install
`tests/requirements.txt` and `tests/requirements-test.txt`; the latter provides the
plugins its `addopts` need.
Output goes to `tests/reports/`, which is git-ignored.

| Suite | Command (from the repository root unless noted) | Needs |
|---|---|---|
| Root suite (`tests/`) | `python -m pytest` | Development Compose stack for `tests/integration` |
| Collection check | `python -m pytest --collect-only -q` | Nothing; runs in CI |
| Unit tests (`tests/unit`) | `python -m pytest tests/unit` | Nothing (Redis, Postgres, robots.txt and the LLM are stubbed); runs in CI |
| Development API tests | `python -m pytest tests/integration -k test_dev_`, or `python -m unittest discover -s tests/integration -p 'test_dev_*.py' -v` | `scripts/start-dev.sh` (REST 8082, graph 8084, worker) |
| Shared library (`services/common`) | `cd services && python -m pytest common/tests` | Nothing; runs in CI (`.github/workflows/python-tests.yml`) |
| Live provider contracts | `RUN_LIVE_PROVIDER_TESTS=1 python -m pytest tests/live` | Real provider credentials; opt-in |

- `tests/integration/conftest.py` puts `tests/integration` on `sys.path` so the
  `test_dev_*` modules can import `hygiene`, `scenario_runner` and `test_dev_workflows`.
- `tests/unit/scrapers/conftest.py` puts `scrapers/` on `sys.path`, as the scraper
  image does (`/app`), so scraper modules resolve `items`, `utils` and `spiders`.

Per-service folders `services/*/tests/` (and `scrapers/tests/`) hold only a
`conftest.py` and empty `unit/` and `integration/` packages; none contains a test
module, so they are not run. `services/common/tests` is the only service suite with
tests. A service that gains tests runs them from its own directory with its own
`pytest.ini`, for example `cd services/rest_api && python -m pytest`. Add it to
`python-tests.yml` once it passes.

## Testing Strategy

### Test Coverage Goals
- **Unit Tests**: >90% code coverage for critical components
- **Integration Tests**: Service communication validation
- **API Tests**: REST/GraphQL endpoint validation
- **Performance Tests**: 20,000+ tracks/hour validation
- **E2E Tests**: Complete workflow validation

### Test Architecture

```
tests/
├── unit/                  # Unit tests for individual components
│   ├── scrapers/         # Scraper logic tests
│   ├── services/         # Service layer tests
│   └── utils/            # Utility function tests
├── integration/          # Service integration tests
│   ├── api/             # API integration tests
│   ├── database/        # Database integration tests
│   └── messaging/       # Message queue tests
├── performance/         # Performance and load tests
│   ├── load/           # Load testing scenarios
│   ├── stress/         # Stress testing scenarios
│   └── spike/          # Spike testing scenarios
├── e2e/                # End-to-end tests
│   ├── workflows/      # Complete workflow tests
│   └── user_scenarios/ # User journey tests
├── fixtures/           # Test data and fixtures
├── utils/              # Test utilities and helpers
└── conftest.py        # Pytest configuration
```

### Test Technologies
- **Python**: pytest, pytest-asyncio, pytest-cov, httpx, factory_boy
- **JavaScript/Node.js**: Jest, Supertest, Playwright
- **Performance**: Locust, K6
- **API Testing**: Postman/Newman, httpx
- **Database**: pytest-postgresql, alembic

## Quick Start

### Setup
```bash
# Install test dependencies
pip install -r tests/requirements.txt
npm install --save-dev jest @playwright/test

# Run all tests
make test

# Run specific test suites
make test-unit
make test-integration
make test-performance
make test-e2e
```

### Test Execution
```bash
# Unit tests with coverage
pytest tests/unit/ --cov=src --cov-report=html

# Integration tests
pytest tests/integration/

# Performance tests
locust -f tests/performance/load_tests.py --host=http://localhost:8080

# E2E tests
playwright test
```

## Test Environment

### Docker Test Environment
- Isolated test database
- Test Redis instance
- Test message queues
- Mock external services

### CI/CD Integration
- Automated test execution on PR
- Coverage reporting
- Performance regression detection
- Test result notifications

## Quality Metrics

### Coverage Thresholds
- Unit tests: >90%
- Integration tests: >80%
- Overall coverage: >85%

### Performance Benchmarks
- API response time: <100ms (95th percentile)
- Scraping throughput: >20,000 tracks/hour
- Database query time: <50ms (average)
- Error rate: <1%

### Quality Gates
- All tests must pass
- Coverage thresholds met
- Performance benchmarks met
- Security scans clean
- Code quality checks pass