# SongNodes Test Automation Makefile
# Comprehensive test automation and quality assurance

.PHONY: help test test-unit test-integration test-performance test-e2e \
        test-coverage test-security test-quality test-all \
        install-test-deps setup-test-env clean-test \
        lint format security-scan \
        test-report test-ci test-docker

# Default target
help:
	@echo "SongNodes Test Automation Framework"
	@echo "===================================="
	@echo ""
	@echo "Available targets:"
	@echo "  test                 - Run all tests"
	@echo "  test-unit           - Run unit tests only"
	@echo "  test-integration    - Run integration tests only"
	@echo "  test-performance    - Run performance tests"
	@echo "  test-e2e            - Run end-to-end tests"
	@echo "  test-coverage       - Run tests with coverage report"
	@echo "  test-security       - Run security tests"
	@echo "  test-quality        - Run code quality checks"
	@echo "  test-all            - Run all test suites with reports"
	@echo ""
	@echo "Setup and maintenance:"
	@echo "  install-test-deps   - Install test dependencies"
	@echo "  setup-test-env      - Setup test environment"
	@echo "  clean-test          - Clean test artifacts"
	@echo ""
	@echo "Quality assurance:"
	@echo "  lint                - Run code linting"
	@echo "  format              - Format code"
	@echo "  security-scan       - Run security scans"
	@echo ""
	@echo "CI/CD:"
	@echo "  test-ci             - Run CI test suite"
	@echo "  test-docker         - Run tests in Docker"
	@echo "  test-report         - Generate test reports"

# Variables
PYTHON_VERSION = 3.11
VENV_DIR = tests/venv
TEST_DIR = tests
COVERAGE_MIN = 90
REPORTS_DIR = tests/reports
DOCKER_COMPOSE = docker-compose -f docker-compose.test.yml

# Test execution targets
test: test-unit test-integration
	@echo "✓ Basic test suite completed"

test-unit:
	@echo "Running unit tests..."
	@mkdir -p $(REPORTS_DIR)
	pytest $(TEST_DIR)/unit/ \
		--tb=short \
		--verbose \
		--junitxml=$(REPORTS_DIR)/unit-tests.xml \
		--html=$(REPORTS_DIR)/unit-tests.html \
		--self-contained-html
	@echo "✓ Unit tests completed"

test-integration:
	@echo "Running integration tests..."
	@mkdir -p $(REPORTS_DIR)
	pytest $(TEST_DIR)/integration/ \
		--tb=short \
		--verbose \
		--junitxml=$(REPORTS_DIR)/integration-tests.xml \
		--html=$(REPORTS_DIR)/integration-tests.html \
		--self-contained-html
	@echo "✓ Integration tests completed"

test-performance:
	@echo "Running performance tests..."
	@mkdir -p $(REPORTS_DIR)
	# Run Locust performance tests
	locust -f $(TEST_DIR)/performance/load_tests.py \
		--host=http://localhost:8080 \
		--users=50 \
		--spawn-rate=5 \
		--run-time=120s \
		--html=$(REPORTS_DIR)/performance-report.html \
		--headless
	
	# Run pytest performance tests
	pytest $(TEST_DIR)/performance/ \
		-m performance \
		--tb=short \
		--junitxml=$(REPORTS_DIR)/performance-tests.xml
	@echo "✓ Performance tests completed"

test-e2e:
	@echo "Running end-to-end tests..."
	@mkdir -p $(REPORTS_DIR)
	# Install Playwright browsers if needed
	playwright install chromium
	
	pytest $(TEST_DIR)/e2e/ \
		--tb=short \
		--verbose \
		--junitxml=$(REPORTS_DIR)/e2e-tests.xml \
		--html=$(REPORTS_DIR)/e2e-tests.html \
		--self-contained-html
	@echo "✓ End-to-end tests completed"

test-coverage:
	@echo "Running tests with coverage analysis..."
	@mkdir -p $(REPORTS_DIR)
	pytest $(TEST_DIR)/unit/ $(TEST_DIR)/integration/ \
		--cov=services \
		--cov=musicdb_scrapy \
		--cov-report=html:$(REPORTS_DIR)/coverage-html \
		--cov-report=xml:$(REPORTS_DIR)/coverage.xml \
		--cov-report=term-missing \
		--cov-fail-under=$(COVERAGE_MIN) \
		--junitxml=$(REPORTS_DIR)/coverage-tests.xml
	@echo "✓ Coverage analysis completed"
	@echo "Coverage report: $(REPORTS_DIR)/coverage-html/index.html"

test-security:
	@echo "Running security tests..."
	@mkdir -p $(REPORTS_DIR)
	
	# Run Bandit security scan
	bandit -r services/ musicdb_scrapy/ \
		-f json \
		-o $(REPORTS_DIR)/security-bandit.json \
		|| true
	
	# Run Safety dependency check
	safety check \
		--json \
		--output $(REPORTS_DIR)/security-safety.json \
		|| true
	
	# Run pytest security tests
	pytest $(TEST_DIR)/ \
		-m security \
		--tb=short \
		--junitxml=$(REPORTS_DIR)/security-tests.xml \
		|| true
	
	@echo "✓ Security tests completed"

test-quality:
	@echo "Running code quality checks..."
	@mkdir -p $(REPORTS_DIR)
	
	# Python linting
	flake8 services/ musicdb_scrapy/ \
		--output-file=$(REPORTS_DIR)/flake8-report.txt \
		--tee \
		|| true
	
	# Type checking
	mypy services/ \
		--html-report $(REPORTS_DIR)/mypy-html \
		--xml-report $(REPORTS_DIR) \
		|| true
	
	# JavaScript linting (if any JS files)
	if [ -f package.json ]; then \
		npm run lint > $(REPORTS_DIR)/eslint-report.txt 2>&1 || true; \
	fi
	
	@echo "✓ Code quality checks completed"

test-all: test-coverage test-performance test-e2e test-security test-quality
	@echo "Generating comprehensive test report..."
	@python $(TEST_DIR)/utils/generate_test_report.py
	@echo "✓ Complete test suite finished"
	@echo "Reports available in: $(REPORTS_DIR)/"

# Setup and maintenance targets
install-test-deps:
	@echo "Installing test dependencies..."
	pip install --upgrade pip
	pip install -r $(TEST_DIR)/requirements.txt
	
	# Install Node.js dependencies if package.json exists
	if [ -f package.json ]; then \
		npm install; \
	fi
	
	# Install Playwright browsers
	playwright install
	@echo "✓ Test dependencies installed"

setup-test-env:
	@echo "Setting up test environment..."
	
	# Create test environment file
	cp .env.example .env.test 2>/dev/null || true
	
	# Setup test database
	$(DOCKER_COMPOSE) up -d postgres redis
	sleep 10
	
	# Run database migrations
	alembic upgrade head || true
	
	@echo "✓ Test environment setup completed"

clean-test:
	@echo "Cleaning test artifacts..."
	rm -rf $(REPORTS_DIR)
	rm -rf .pytest_cache
	rm -rf .coverage
	rm -rf htmlcov
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	$(DOCKER_COMPOSE) down -v || true
	@echo "✓ Test cleanup completed"

# Code quality targets
lint:
	@echo "Running code linting..."
	flake8 services/ musicdb_scrapy/ tests/
	
	# JavaScript linting if applicable
	if [ -f package.json ]; then \
		npm run lint; \
	fi
	@echo "✓ Linting completed"

format:
	@echo "Formatting code..."
	black services/ musicdb_scrapy/ tests/
	isort services/ musicdb_scrapy/ tests/
	
	# JavaScript formatting if applicable
	if [ -f package.json ]; then \
		npm run format 2>/dev/null || true; \
	fi
	@echo "✓ Code formatting completed"

security-scan:
	@echo "Running security scans..."
	bandit -r services/ musicdb_scrapy/
	safety check
	@echo "✓ Security scan completed"

# CI/CD targets
test-ci:
	@echo "Running CI test suite..."
	@mkdir -p $(REPORTS_DIR)
	
	# Fast unit tests first
	pytest $(TEST_DIR)/unit/ \
		--tb=line \
		--maxfail=5 \
		--junitxml=$(REPORTS_DIR)/ci-unit-tests.xml
	
	# Integration tests
	pytest $(TEST_DIR)/integration/ \
		--tb=line \
		--maxfail=3 \
		--junitxml=$(REPORTS_DIR)/ci-integration-tests.xml
	
	# Coverage check
	pytest $(TEST_DIR)/unit/ $(TEST_DIR)/integration/ \
		--cov=services \
		--cov=musicdb_scrapy \
		--cov-fail-under=80 \
		--cov-report=xml:$(REPORTS_DIR)/ci-coverage.xml
	
	@echo "✓ CI test suite completed"

test-docker:
	@echo "Running tests in Docker environment..."
	
	# Build test image
	docker build -t songnodes-test -f Dockerfile.test .
	
	# Run tests in container
	docker run --rm \
		-v $(PWD)/$(REPORTS_DIR):/app/$(REPORTS_DIR) \
		-e ENVIRONMENT=test \
		songnodes-test \
		make test-ci
	
	@echo "✓ Docker tests completed"

test-report:
	@echo "Generating test reports..."
	@mkdir -p $(REPORTS_DIR)
	
	# Generate coverage badge
	coverage-badge -o $(REPORTS_DIR)/coverage-badge.svg || true
	
	# Generate performance report
	python $(TEST_DIR)/utils/generate_performance_report.py || true
	
	# Generate quality metrics
	python $(TEST_DIR)/utils/generate_quality_metrics.py || true
	
	@echo "✓ Test reports generated"

# Development targets
test-watch:
	@echo "Running tests in watch mode..."
	pytest-watch $(TEST_DIR)/unit/ -- --tb=short

test-debug:
	@echo "Running tests in debug mode..."
	pytest $(TEST_DIR)/unit/ --pdb --tb=long --verbose

test-specific:
	@echo "Running specific test..."
	@read -p "Enter test path or pattern: " TEST_PATH; \
	pytest $$TEST_PATH --verbose --tb=short

# Performance testing targets
test-load:
	@echo "Running load tests..."
	locust -f $(TEST_DIR)/performance/load_tests.py \
		--host=http://localhost:8080 \
		--users=100 \
		--spawn-rate=10 \
		--run-time=300s \
		--html=$(REPORTS_DIR)/load-test-report.html

test-stress:
	@echo "Running stress tests..."
	locust -f $(TEST_DIR)/performance/load_tests.py \
		--host=http://localhost:8080 \
		--users=500 \
		--spawn-rate=20 \
		--run-time=600s \
		--html=$(REPORTS_DIR)/stress-test-report.html

test-throughput:
	@echo "Testing throughput (20,000+ tracks/hour target)..."
	python $(TEST_DIR)/performance/throughput_test.py

# Database testing
test-db:
	@echo "Testing database operations..."
	pytest $(TEST_DIR)/integration/test_database.py \
		--verbose \
		--tb=short

test-migrations:
	@echo "Testing database migrations..."
	alembic check
	python $(TEST_DIR)/utils/test_migrations.py

# Service-specific testing
test-scrapers:
	@echo "Testing scrapers..."
	pytest $(TEST_DIR)/unit/scrapers/ \
		$(TEST_DIR)/integration/scrapers/ \
		--verbose

test-apis:
	@echo "Testing APIs..."
	pytest $(TEST_DIR)/integration/test_api_endpoints.py \
		--verbose

test-orchestrator:
	@echo "Testing orchestrator..."
	pytest $(TEST_DIR)/unit/services/test_scraper_orchestrator.py \
		--verbose

# Monitoring and alerts testing
test-monitoring:
	@echo "Testing monitoring and alerting..."
	pytest $(TEST_DIR)/integration/test_monitoring.py \
		--verbose

# Utility targets
test-env-check:
	@echo "Checking test environment..."
	@python -c "import sys; print(f'Python: {sys.version}')"
	@python -c "import pytest; print(f'Pytest: {pytest.__version__}')"
	@docker --version
	@docker-compose --version

test-requirements-check:
	@echo "Checking test requirements..."
	pip check
	pip list --outdated

# Help for specific test types
help-performance:
	@echo "Performance Testing Options:"
	@echo "  test-performance    - Standard performance test suite"
	@echo "  test-load          - Load testing (100 users, 5 minutes)"
	@echo "  test-stress        - Stress testing (500 users, 10 minutes)"
	@echo "  test-throughput    - Throughput testing (20,000+ tracks/hour)"

help-coverage:
	@echo "Coverage Testing Options:"
	@echo "  test-coverage      - Generate coverage report ($(COVERAGE_MIN)% minimum)"
	@echo "  Coverage reports:  $(REPORTS_DIR)/coverage-html/index.html"
	@echo "  Coverage XML:      $(REPORTS_DIR)/coverage.xml"