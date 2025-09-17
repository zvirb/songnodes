#!/bin/bash

# Production Deployment Validation Script
# Tests all critical production services and endpoints

echo "=== SongNodes Production Deployment Validation ==="
echo "Timestamp: $(date -u)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation results
PASSED=0
FAILED=0

# Function to test HTTP endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    
    echo -n "Testing $name... "
    
    if response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null); then
        status_code="${response: -3}"
        body="${response:0:-3}"
        
        if [ "$status_code" = "$expected_status" ]; then
            echo -e "${GREEN}PASS${NC} ($status_code)"
            ((PASSED++))
            # Show response if it's JSON
            if echo "$body" | jq . >/dev/null 2>&1; then
                echo "  Response: $(echo "$body" | jq -r '.status // .service // "OK"')"
            fi
        else
            echo -e "${RED}FAIL${NC} (Expected: $expected_status, Got: $status_code)"
            echo "  Response: $body"
            ((FAILED++))
        fi
    else
        echo -e "${RED}FAIL${NC} (Connection failed)"
        ((FAILED++))
    fi
}

# Function to test database connectivity
test_database() {
    echo -n "Testing Database Connectivity... "
    if docker exec songnodes-postgres-production pg_isready -U musicdb_user -d musicdb >/dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
        ((FAILED++))
    fi
}

# Function to test Redis connectivity
test_redis() {
    echo -n "Testing Redis Connectivity... "
    if docker exec songnodes-redis-production redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
        ((FAILED++))
    fi
}

# Function to test container health
test_containers() {
    echo "=== Container Health Status ==="
    containers=("songnodes-postgres-production" "songnodes-redis-production" "songnodes-scraper-orchestrator-production" "songnodes-websocket-production" "songnodes-rest-api-production")
    
    for container in "${containers[@]}"; do
        echo -n "Container $container... "
        if docker inspect "$container" --format='{{.State.Status}}' 2>/dev/null | grep -q "running"; then
            health=$(docker inspect "$container" --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-health-check")
            if [ "$health" = "healthy" ] || [ "$health" = "no-health-check" ]; then
                echo -e "${GREEN}PASS${NC} (running, $health)"
                ((PASSED++))
            else
                echo -e "${YELLOW}WARNING${NC} (running, $health)"
            fi
        else
            echo -e "${RED}FAIL${NC} (not running)"
            ((FAILED++))
        fi
    done
}

echo "=== Infrastructure Health ==="
test_database
test_redis

echo ""
echo "=== Container Health ==="
test_containers

echo ""
echo "=== API Endpoint Validation ==="
test_endpoint "Scraper Orchestrator Health" "http://localhost:8001/health" "200"
test_endpoint "REST API Health" "http://localhost:8082/health" "200"
test_endpoint "WebSocket API Health" "http://localhost:8083/health" "200"
test_endpoint "Graph Visualization API Health" "http://localhost:8084/health" "200"

echo ""
echo "=== Production Services Summary ==="
docker ps --filter "name=production" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Production containers listing failed"

echo ""
echo "=== Production Deployment Results ==="
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ "$FAILED" -eq 0 ]; then
    echo -e "\n${GREEN}✅ PRODUCTION DEPLOYMENT SUCCESSFUL${NC}"
    echo "All critical services are operational and responding correctly."
    exit 0
else
    echo -e "\n${RED}❌ PRODUCTION DEPLOYMENT HAS ISSUES${NC}"
    echo "Some services failed validation. Please check the logs above."
    exit 1
fi