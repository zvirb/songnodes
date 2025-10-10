#!/bin/bash
# Integration test runner for SongNodes
# Ensures services are healthy and runs comprehensive integration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="tests/integration"
RESULTS_DIR="test-results"
COVERAGE_DIR="htmlcov"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse arguments
VERBOSE=false
COVERAGE=true
PARALLEL=false
WORKERS=4
STOP_ON_FAIL=false
MARKERS=""
KEYWORDS=""

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run SongNodes integration tests with service health checks.

OPTIONS:
    -h, --help              Show this help message
    -v, --verbose           Verbose output
    -n, --no-coverage       Skip coverage reporting
    -p, --parallel          Run tests in parallel
    -w, --workers NUM       Number of parallel workers (default: 4)
    -x, --stop-on-fail      Stop on first failure
    -m, --marker MARKER     Run tests with specific marker (integration, e2e, slow)
    -k, --keyword KEYWORD   Run tests matching keyword
    --skip-health-check     Skip service health check

EXAMPLES:
    $0                      # Run all integration tests
    $0 -v                   # Run with verbose output
    $0 -p -w 8              # Run with 8 parallel workers
    $0 -m e2e               # Run only e2e tests
    $0 -k "cache"           # Run tests matching "cache"

EOF
    exit 0
}

# Parse command line arguments
SKIP_HEALTH_CHECK=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -n|--no-coverage)
            COVERAGE=false
            shift
            ;;
        -p|--parallel)
            PARALLEL=true
            shift
            ;;
        -w|--workers)
            WORKERS="$2"
            shift 2
            ;;
        -x|--stop-on-fail)
            STOP_ON_FAIL=true
            shift
            ;;
        -m|--marker)
            MARKERS="$2"
            shift 2
            ;;
        -k|--keyword)
            KEYWORDS="$2"
            shift 2
            ;;
        --skip-health-check)
            SKIP_HEALTH_CHECK=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

echo ""
echo "============================================"
echo "SongNodes Integration Test Suite"
echo "============================================"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Step 1: Service health check
if [ "$SKIP_HEALTH_CHECK" = false ]; then
    echo -e "${BLUE}[1/4] Checking service health...${NC}"
    if [ -f "$SCRIPT_DIR/health_check.sh" ]; then
        bash "$SCRIPT_DIR/health_check.sh"
    else
        echo -e "${YELLOW}Warning: health_check.sh not found, skipping health check${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}Skipping health check (--skip-health-check)${NC}"
    echo ""
fi

# Step 2: Environment setup
echo -e "${BLUE}[2/4] Setting up test environment...${NC}"

# Create results directory
mkdir -p "$RESULTS_DIR"
mkdir -p "$COVERAGE_DIR"

# Set environment variables for tests
export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5433}"
export DB_USER="${DB_USER:-musicdb_user}"
export DB_PASSWORD="${DB_PASSWORD:-musicdb_secure_pass_2024}"
export DB_NAME="${DB_NAME:-musicdb}"

export API_GATEWAY_URL="${API_GATEWAY_URL:-http://localhost:8100}"
export METADATA_ENRICHMENT_URL="${METADATA_ENRICHMENT_URL:-http://localhost:8020}"
export DLQ_MANAGER_URL="${DLQ_MANAGER_URL:-http://localhost:8024}"

echo "Environment configured:"
echo "  Database: $DB_HOST:$DB_PORT"
echo "  API Gateway: $API_GATEWAY_URL"
echo "  Metadata Enrichment: $METADATA_ENRICHMENT_URL"
echo "  DLQ Manager: $DLQ_MANAGER_URL"
echo ""

# Step 3: Install test dependencies
echo -e "${BLUE}[3/4] Checking test dependencies...${NC}"
if [ -f "$TEST_DIR/../requirements-test.txt" ]; then
    pip install -q -r "$TEST_DIR/../requirements-test.txt"
    echo "Test dependencies installed"
else
    echo -e "${YELLOW}Warning: requirements-test.txt not found${NC}"
fi
echo ""

# Step 4: Run tests
echo -e "${BLUE}[4/4] Running integration tests...${NC}"
echo ""

# Build pytest command
PYTEST_CMD="pytest $TEST_DIR"

# Add verbose flag
if [ "$VERBOSE" = true ]; then
    PYTEST_CMD="$PYTEST_CMD -v -s"
else
    PYTEST_CMD="$PYTEST_CMD -v"
fi

# Add parallel execution
if [ "$PARALLEL" = true ]; then
    PYTEST_CMD="$PYTEST_CMD -n $WORKERS"
fi

# Add stop on fail
if [ "$STOP_ON_FAIL" = true ]; then
    PYTEST_CMD="$PYTEST_CMD -x"
fi

# Add marker filtering
if [ -n "$MARKERS" ]; then
    PYTEST_CMD="$PYTEST_CMD -m $MARKERS"
fi

# Add keyword filtering
if [ -n "$KEYWORDS" ]; then
    PYTEST_CMD="$PYTEST_CMD -k $KEYWORDS"
fi

# Add coverage
if [ "$COVERAGE" = true ]; then
    PYTEST_CMD="$PYTEST_CMD --cov=services --cov-report=html:$COVERAGE_DIR --cov-report=term --cov-report=xml:$RESULTS_DIR/coverage.xml"
fi

# Add JUnit XML output
PYTEST_CMD="$PYTEST_CMD --junit-xml=$RESULTS_DIR/integration.xml"

# Add test durations
PYTEST_CMD="$PYTEST_CMD --durations=10"

# Add color output
PYTEST_CMD="$PYTEST_CMD --color=yes"

# Run tests
echo "Running: $PYTEST_CMD"
echo ""

if $PYTEST_CMD; then
    TEST_RESULT=0
else
    TEST_RESULT=$?
fi

echo ""
echo "============================================"
echo "Test Results Summary"
echo "============================================"
echo ""

# Display test results
if [ -f "$RESULTS_DIR/integration.xml" ]; then
    # Parse JUnit XML for summary
    if command -v python3 &> /dev/null; then
        python3 << EOF
import xml.etree.ElementTree as ET
import sys

try:
    tree = ET.parse('$RESULTS_DIR/integration.xml')
    root = tree.getroot()

    tests = int(root.attrib.get('tests', 0))
    failures = int(root.attrib.get('failures', 0))
    errors = int(root.attrib.get('errors', 0))
    skipped = int(root.attrib.get('skipped', 0))
    time = float(root.attrib.get('time', 0))

    passed = tests - failures - errors - skipped

    print(f"Total tests:   {tests}")
    print(f"Passed:        {passed} ✓")
    print(f"Failed:        {failures}")
    print(f"Errors:        {errors}")
    print(f"Skipped:       {skipped}")
    print(f"Duration:      {time:.2f}s")
    print("")

    if failures > 0 or errors > 0:
        print("Failed/Error tests:")
        for testcase in root.iter('testcase'):
            failure = testcase.find('failure')
            error = testcase.find('error')
            if failure is not None or error is not None:
                name = testcase.attrib.get('name')
                classname = testcase.attrib.get('classname')
                print(f"  - {classname}.{name}")
except Exception as e:
    print(f"Could not parse test results: {e}")
EOF
    fi
fi

# Display coverage summary
if [ "$COVERAGE" = true ] && [ -f "$COVERAGE_DIR/index.html" ]; then
    echo ""
    echo "Coverage report: file://$PROJECT_ROOT/$COVERAGE_DIR/index.html"
fi

echo ""
echo "Test artifacts:"
echo "  JUnit XML:       $RESULTS_DIR/integration.xml"
if [ "$COVERAGE" = true ]; then
    echo "  Coverage HTML:   $COVERAGE_DIR/index.html"
    echo "  Coverage XML:    $RESULTS_DIR/coverage.xml"
fi

echo ""

# Exit with test result code
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}Integration tests PASSED ✓${NC}"
    exit 0
else
    echo -e "${RED}Integration tests FAILED ✗${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check service logs: docker compose logs [service-name]"
    echo "2. Run specific test: pytest $TEST_DIR/test_file.py::test_name -v -s"
    echo "3. Run with debug logging: pytest $TEST_DIR -v -s --log-cli-level=DEBUG"
    exit $TEST_RESULT
fi
