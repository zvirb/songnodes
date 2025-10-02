# Testing Quick Start Guide

## Installation

### For a single service:
```bash
cd services/rest-api
pip install -r requirements-test.txt
```

### For all critical services:
```bash
for service in rest-api graphql-api websocket-api; do
  cd services/$service
  pip install -r requirements-test.txt
  cd ../..
done
```

## Running Tests

### Run all tests for a service:
```bash
cd services/rest-api
pytest
```

### Run with verbose output:
```bash
pytest -v
```

### Run only unit tests:
```bash
pytest -m unit
```

### Run only integration tests:
```bash
pytest -m integration
```

### Run with coverage report:
```bash
pytest --cov=. --cov-report=html
# Open tests/coverage/index.html in browser
```

### Run specific test file:
```bash
pytest tests/unit/test_main.py
```

### Run specific test:
```bash
pytest tests/unit/test_main.py::test_health_endpoint
```

## Docker Testing

### Run tests inside Docker container:
```bash
docker compose exec rest-api pytest
```

### With coverage:
```bash
docker compose exec rest-api pytest --cov=. --cov-report=term-missing
```

## Test Files Location

```
services/[service-name]/
├── pytest.ini               # Configuration
├── requirements-test.txt    # Dependencies
└── tests/
    ├── conftest.py         # Fixtures
    ├── unit/
    │   └── test_main.py    # Unit tests
    └── integration/
        └── test_api.py     # Integration tests
```

## Test Markers

- `@pytest.mark.unit` - Fast, isolated unit tests
- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.slow` - Slow-running tests
- `@pytest.mark.asyncio` - Async tests

## Common Commands

```bash
# Run tests and show coverage summary
pytest --cov=. --cov-report=term-missing

# Run tests excluding slow ones
pytest -m "not slow"

# Run tests with detailed output
pytest -vv

# Run tests and stop on first failure
pytest -x

# Run tests matching pattern
pytest -k "test_health"

# Show available fixtures
pytest --fixtures

# Show test collection without running
pytest --collect-only
```

## Debugging Tests

```bash
# Run with Python debugger
pytest --pdb

# Show local variables on failure
pytest -l

# Capture stdout/stderr
pytest -s
```

## Coverage Reports

```bash
# Generate HTML coverage report
pytest --cov=. --cov-report=html

# Generate XML coverage report (for CI/CD)
pytest --cov=. --cov-report=xml

# Terminal coverage report
pytest --cov=. --cov-report=term-missing
```

## Continuous Integration

Example GitHub Actions workflow:

```yaml
- name: Run tests
  run: |
    cd services/rest-api
    pip install -r requirements-test.txt
    pytest --cov=. --cov-report=xml
```

## Troubleshooting

### ImportError: No module named pytest
```bash
pip install -r requirements-test.txt
```

### Tests fail with connection errors
- Tests use mocks - ensure conftest.py is present
- Check that all fixtures are properly defined

### Async tests fail
- Ensure pytest-asyncio is installed
- Check that `asyncio_mode = auto` is in pytest.ini

## Next Steps

1. Run tests for critical services
2. Review coverage reports
3. Add more tests for uncovered code
4. Integrate with CI/CD pipeline

For detailed documentation, see: [TEST_INFRASTRUCTURE_COMPLETE.md](/mnt/my_external_drive/programming/songnodes/TEST_INFRASTRUCTURE_COMPLETE.md)
