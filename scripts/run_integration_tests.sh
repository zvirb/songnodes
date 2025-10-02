#!/bin/bash
################################################################################
# SongNodes Integration Test Suite
# Comprehensive validation of all services, endpoints, and data flows
################################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Timestamp
TEST_START=$(date +%s)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    SongNodes Integration Test Suite - ${TIMESTAMP}    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

################################################################################
# Helper Functions
################################################################################

pass_test() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

fail_test() {
    echo -e "${RED}✗${NC} $1"
    echo -e "${RED}  Error: $2${NC}"
    ((TESTS_FAILED++))
}

skip_test() {
    echo -e "${YELLOW}⊘${NC} $1"
    echo -e "${YELLOW}  Reason: $2${NC}"
    ((TESTS_SKIPPED++))
}

test_http_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"

    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

    if [ "$response_code" = "$expected_code" ]; then
        pass_test "$name (HTTP $response_code)"
    else
        fail_test "$name" "Expected HTTP $expected_code, got $response_code"
    fi
}

test_json_endpoint() {
    local name="$1"
    local url="$2"
    local json_path="$3"
    local expected_value="$4"

    response=$(curl -s "$url" 2>/dev/null || echo "{}")
    actual_value=$(echo "$response" | jq -r "$json_path" 2>/dev/null || echo "null")

    if [ "$actual_value" = "$expected_value" ]; then
        pass_test "$name ($json_path = $expected_value)"
    else
        fail_test "$name" "Expected '$expected_value', got '$actual_value'"
    fi
}

test_database_query() {
    local name="$1"
    local query="$2"
    local expected_result="$3"

    result=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c "$query" 2>/dev/null | xargs || echo "")

    if [ "$result" = "$expected_result" ]; then
        pass_test "$name (result: $result)"
    else
        fail_test "$name" "Expected '$expected_result', got '$result'"
    fi
}

################################################################################
# Test Suite 1: Infrastructure Health
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 1: Infrastructure Health${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

# Check Docker Compose is running
if docker compose ps > /dev/null 2>&1; then
    pass_test "Docker Compose running"
else
    fail_test "Docker Compose running" "docker compose not available"
fi

# Count healthy services
HEALTHY_COUNT=$(docker compose ps --format json 2>/dev/null | jq -r 'select(.Health == "healthy") | .Service' | wc -l)
TOTAL_COUNT=$(docker compose ps --format json 2>/dev/null | jq -r '.Service' | wc -l)

if [ "$HEALTHY_COUNT" -ge 35 ]; then
    pass_test "Service health ($HEALTHY_COUNT/$TOTAL_COUNT healthy)"
else
    fail_test "Service health" "Only $HEALTHY_COUNT/$TOTAL_COUNT services healthy"
fi

################################################################################
# Test Suite 2: Core Service Endpoints
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 2: Core Service Endpoints${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_http_endpoint "Frontend" "http://localhost:3006/"
test_http_endpoint "API Gateway" "http://localhost:8080/health"
test_http_endpoint "REST API" "http://localhost:8082/health"
test_http_endpoint "GraphQL API" "http://localhost:8081/health"
test_http_endpoint "Graph Viz API" "http://localhost:8084/health"
test_http_endpoint "WebSocket API" "http://localhost:8083/health"

################################################################################
# Test Suite 3: Processing Services
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 3: Processing Services${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_http_endpoint "Scraper Orchestrator" "http://localhost:8001/health"
test_http_endpoint "Data Validator" "http://localhost:8003/health"
test_http_endpoint "NLP Processor" "http://localhost:8021/health"
test_http_endpoint "Audio Analysis" "http://localhost:8020/health"
test_http_endpoint "Metadata Enrichment" "http://localhost:8022/health"

################################################################################
# Test Suite 4: Health Check JSON Validation
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 4: Health Check JSON Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_json_endpoint "REST API status" "http://localhost:8082/health" ".status" "healthy"
test_json_endpoint "Scraper Orch status" "http://localhost:8001/health" ".status" "healthy"
test_json_endpoint "WebSocket API status" "http://localhost:8083/health" ".status" "healthy"

################################################################################
# Test Suite 5: Database Connectivity
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 5: Database Connectivity${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

# Test PostgreSQL connectivity
if docker compose exec -T postgres pg_isready -U musicdb_user > /dev/null 2>&1; then
    pass_test "PostgreSQL connection"
else
    fail_test "PostgreSQL connection" "pg_isready failed"
fi

# Test table count
TABLE_COUNT=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs || echo "0")

if [ "$TABLE_COUNT" -ge 40 ]; then
    pass_test "Database schema ($TABLE_COUNT tables)"
else
    fail_test "Database schema" "Expected ≥40 tables, found $TABLE_COUNT"
fi

################################################################################
# Test Suite 6: Redis Connectivity
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 6: Redis Connectivity${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

REDIS_PING=$(docker compose exec -T redis redis-cli -a redis_secure_pass_2024 PING 2>/dev/null || echo "FAIL")

if [ "$REDIS_PING" = "PONG" ]; then
    pass_test "Redis connection (PING -> PONG)"
else
    fail_test "Redis connection" "Expected PONG, got $REDIS_PING"
fi

# Test Redis memory info
REDIS_MEMORY=$(docker compose exec -T redis redis-cli -a redis_secure_pass_2024 INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r' || echo "unknown")

if [ "$REDIS_MEMORY" != "unknown" ]; then
    pass_test "Redis memory info ($REDIS_MEMORY)"
else
    fail_test "Redis memory info" "Could not retrieve memory stats"
fi

################################################################################
# Test Suite 7: RabbitMQ Connectivity
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 7: RabbitMQ Connectivity${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

RABBITMQ_STATUS=$(docker compose exec -T rabbitmq rabbitmqctl status 2>/dev/null | grep -c "Status of node" || echo "0")

if [ "$RABBITMQ_STATUS" -ge 1 ]; then
    pass_test "RabbitMQ connection"
else
    fail_test "RabbitMQ connection" "rabbitmqctl status failed"
fi

################################################################################
# Test Suite 8: Observability Stack
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 8: Observability Stack${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_http_endpoint "Prometheus" "http://localhost:9091/-/healthy"
test_http_endpoint "Grafana" "http://localhost:3001/api/health"
test_http_endpoint "Loki" "http://localhost:3100/ready"
test_http_endpoint "RabbitMQ Management" "http://localhost:15673/"
test_http_endpoint "MinIO" "http://localhost:9001/minio/health/live"

################################################################################
# Test Suite 9: Scraper Fleet Health
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 9: Scraper Fleet Health (10 scrapers)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_http_endpoint "1001tracklists" "http://localhost:8011/health"
test_http_endpoint "MixesDB" "http://localhost:8012/health"
test_http_endpoint "SetlistFM" "http://localhost:8013/health"
test_http_endpoint "Reddit" "http://localhost:8014/health"
test_http_endpoint "Mixcloud" "http://localhost:8015/health"
test_http_endpoint "SoundCloud" "http://localhost:8016/health"
test_http_endpoint "YouTube" "http://localhost:8017/health"
test_http_endpoint "Internet Archive" "http://localhost:8018/health"
test_http_endpoint "LiveTracklist" "http://localhost:8019/health"
test_http_endpoint "Resident Advisor" "http://localhost:8023/health"

################################################################################
# Test Suite 10: Resource Utilization
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 10: Resource Utilization${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

# Get highest memory usage container
HIGHEST_MEM=$(docker stats --no-stream --format "{{.MemPerc}}" 2>/dev/null | sed 's/%//' | sort -n | tail -1 || echo "0")

if (( $(echo "$HIGHEST_MEM < 85" | bc -l) )); then
    pass_test "Memory utilization (highest: ${HIGHEST_MEM}%)"
else
    fail_test "Memory utilization" "Container using ${HIGHEST_MEM}% memory"
fi

# Get highest CPU usage container
HIGHEST_CPU=$(docker stats --no-stream --format "{{.CPUPerc}}" 2>/dev/null | sed 's/%//' | sort -n | tail -1 || echo "0")

if (( $(echo "$HIGHEST_CPU < 80" | bc -l) )); then
    pass_test "CPU utilization (highest: ${HIGHEST_CPU}%)"
else
    fail_test "CPU utilization" "Container using ${HIGHEST_CPU}% CPU"
fi

################################################################################
# Test Suite 11: Data Integrity
################################################################################

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 11: Data Integrity${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

# Check for core tables
CORE_TABLES=("songs" "artists" "playlists" "target_tracks" "target_track_searches")

for table in "${CORE_TABLES[@]}"; do
    EXISTS=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null | xargs || echo "f")

    if [ "$EXISTS" = "t" ]; then
        pass_test "Table exists: $table"
    else
        fail_test "Table exists: $table" "Table not found in database"
    fi
done

################################################################################
# Test Summary
################################################################################

TEST_END=$(date +%s)
TEST_DURATION=$((TEST_END - TEST_START))

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

echo -e "Duration: ${TEST_DURATION}s"
echo -e "${GREEN}Passed:  $TESTS_PASSED${NC}"
echo -e "${RED}Failed:  $TESTS_FAILED${NC}"
echo -e "${YELLOW}Skipped: $TESTS_SKIPPED${NC}"
echo -e "Total:   $((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))"

PASS_RATE=$((TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED + 1)))

echo -e "\nPass Rate: ${PASS_RATE}%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                   ALL TESTS PASSED ✓                           ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}\n"
    exit 0
else
    echo -e "\n${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                  SOME TESTS FAILED ✗                           ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}\n"
    exit 1
fi
