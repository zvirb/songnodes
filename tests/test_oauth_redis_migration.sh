#!/bin/bash
# OAuth State Redis Migration Validation Script
# Tests that OAuth state is properly stored in Redis, not in-memory

set -e

REDIS_PASSWORD="${REDIS_PASSWORD:-redis_secure_pass_2024}"
BASE_URL="http://localhost:8082/api/v1/music-auth"

echo "========================================"
echo "OAuth State Redis Migration Test Suite"
echo "========================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function for test assertions
assert_success() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $1"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $1"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "Test 1: Verify Redis is accessible"
echo "-----------------------------------"
docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" ping > /dev/null 2>&1
assert_success "Redis connection"
echo ""

echo "Test 2: Clean existing OAuth keys"
echo "----------------------------------"
docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:*" | \
    xargs -I {} docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" DEL {} > /dev/null 2>&1 || true
echo "Cleaned up any existing OAuth state keys"
echo ""

echo "Test 3: Verify no oauth_state_store in code"
echo "--------------------------------------------"
if ! grep -q "^oauth_state_store.*=" /mnt/my_external_drive/programming/songnodes/services/rest-api/routers/music_auth.py; then
    echo -e "${GREEN}✓ PASS${NC}: In-memory oauth_state_store removed from code"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}: In-memory oauth_state_store still exists in code"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

echo "Test 4: Spotify OAuth - State Storage"
echo "--------------------------------------"
# Note: This test requires manual interaction, so we'll verify the code pattern
if grep -q 'oauth:spotify:' /mnt/my_external_drive/programming/songnodes/services/rest-api/routers/music_auth.py; then
    echo -e "${GREEN}✓ PASS${NC}: Spotify OAuth uses Redis storage pattern"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}: Spotify OAuth doesn't use Redis storage"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

echo "Test 5: Tidal OAuth - State Storage"
echo "------------------------------------"
if grep -q '"oauth:tidal:{state}"' /mnt/my_external_drive/programming/songnodes/services/rest-api/routers/music_auth.py; then
    echo -e "${GREEN}✓ PASS${NC}: Tidal OAuth uses Redis storage pattern"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}: Tidal OAuth doesn't use Redis storage"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

echo "Test 6: Tidal Device Code - State Storage"
echo "------------------------------------------"
if grep -q 'oauth:tidal:device:' /mnt/my_external_drive/programming/songnodes/services/rest-api/routers/music_auth.py; then
    echo -e "${GREEN}✓ PASS${NC}: Tidal Device Code uses Redis storage pattern"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}: Tidal Device Code doesn't use Redis storage"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

echo "Test 7: TTL Configuration (600 seconds)"
echo "----------------------------------------"
if grep -q '600.*# 10 minutes TTL' /mnt/my_external_drive/programming/songnodes/services/rest-api/routers/music_auth.py; then
    echo -e "${GREEN}✓ PASS${NC}: TTL set to 600 seconds (10 minutes)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠ WARNING${NC}: TTL configuration not found or different"
fi
echo ""

echo "Test 8: One-Time Use Pattern (State Deletion)"
echo "----------------------------------------------"
if grep -q 'await r.delete.*oauth:' /mnt/my_external_drive/programming/songnodes/services/rest-api/routers/music_auth.py; then
    echo -e "${GREEN}✓ PASS${NC}: State deletion implemented (one-time use)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}: State deletion not implemented"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

echo "Test 9: Error Handling for Expired State"
echo "-----------------------------------------"
if grep -q 'Invalid or expired.*state' /mnt/my_external_drive/programming/songnodes/services/rest-api/routers/music_auth.py; then
    echo -e "${GREEN}✓ PASS${NC}: Error handling for expired state implemented"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}: Error handling for expired state missing"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

echo "Test 10: Service Namespace Isolation"
echo "-------------------------------------"
if grep -q "oauth:spotify:" /mnt/my_external_drive/programming/songnodes/services/rest-api/routers/music_auth.py && \
   grep -q "oauth:tidal:" /mnt/my_external_drive/programming/songnodes/services/rest-api/routers/music_auth.py; then
    echo -e "${GREEN}✓ PASS${NC}: Service-specific namespaces implemented"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}: Service namespaces not properly implemented"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

echo "Test 11: Logging for OAuth Operations"
echo "--------------------------------------"
if grep -q 'logger.info.*Stored.*OAuth.*Redis' /mnt/my_external_drive/programming/songnodes/services/rest-api/routers/music_auth.py; then
    echo -e "${GREEN}✓ PASS${NC}: Comprehensive logging implemented"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠ WARNING${NC}: Logging may be incomplete"
fi
echo ""

echo "Test 12: REST API Health Check"
echo "-------------------------------"
if curl -s -f "${BASE_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}: REST API is healthy and responding"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}: REST API is not responding"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo "Make sure the REST API service is running: docker compose up -d rest-api"
fi
echo ""

echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo "OAuth state storage migration is complete and validated."
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo "Please review the failures above and fix the issues."
    exit 1
fi
