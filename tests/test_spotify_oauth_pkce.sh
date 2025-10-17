#!/bin/bash
# Spotify OAuth PKCE Testing Script
# Tests the security fixes implemented on 2025-10-17
# Usage: ./tests/test_spotify_oauth_pkce.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:8082}"
REDIS_PASSWORD="${REDIS_PASSWORD:-redis_secure_pass_2024}"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Spotify OAuth PKCE Security Testing Suite                  ║${NC}"
echo -e "${BLUE}║  Testing fixes implemented: 2025-10-17                       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function for test results
pass_test() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((TESTS_PASSED++))
}

fail_test() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((TESTS_FAILED++))
}

warn_test() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

info_test() {
    echo -e "${BLUE}ℹ️  INFO:${NC} $1"
}

# ============================================================================
# TEST 1: Verify Services are Running
# ============================================================================
echo -e "\n${BLUE}[TEST 1]${NC} Verifying Docker services..."

if docker compose ps rest-api | grep -q "Up"; then
    pass_test "REST API service is running"
else
    fail_test "REST API service is not running"
    echo "    Run: docker compose up -d rest-api"
    exit 1
fi

if docker compose ps redis | grep -q "Up"; then
    pass_test "Redis service is running"
else
    fail_test "Redis service is not running"
    exit 1
fi

if docker compose ps postgres | grep -q "Up"; then
    pass_test "PostgreSQL service is running"
else
    fail_test "PostgreSQL service is not running"
    exit 1
fi

# ============================================================================
# TEST 2: Verify Environment Variables
# ============================================================================
echo -e "\n${BLUE}[TEST 2]${NC} Checking environment variables..."

# Check if .env file exists
if [ -f .env ]; then
    pass_test ".env file exists"

    # Check for Spotify credentials
    if grep -q "^SPOTIFY_CLIENT_ID=" .env && [ -n "$(grep "^SPOTIFY_CLIENT_ID=" .env | cut -d'=' -f2)" ]; then
        pass_test "SPOTIFY_CLIENT_ID is set"
    else
        fail_test "SPOTIFY_CLIENT_ID is not set in .env"
        warn_test "OAuth flow will fail without credentials"
    fi

    if grep -q "^SPOTIFY_CLIENT_SECRET=" .env && [ -n "$(grep "^SPOTIFY_CLIENT_SECRET=" .env | cut -d'=' -f2)" ]; then
        pass_test "SPOTIFY_CLIENT_SECRET is set"
    else
        fail_test "SPOTIFY_CLIENT_SECRET is not set in .env"
        warn_test "OAuth flow will fail without credentials"
    fi
else
    fail_test ".env file not found"
    warn_test "Copy .env.example to .env and configure credentials"
fi

# ============================================================================
# TEST 3: Test Redis Connection and OAuth State Storage
# ============================================================================
echo -e "\n${BLUE}[TEST 3]${NC} Testing Redis connection..."

if docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q "PONG"; then
    pass_test "Redis connection successful"
else
    fail_test "Redis connection failed"
    echo "    Check REDIS_PASSWORD in .env"
    exit 1
fi

# Check for any existing OAuth states
OAUTH_KEYS=$(docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:spotify:*" 2>/dev/null | wc -l)
info_test "Found ${OAUTH_KEYS} active Spotify OAuth states in Redis"

if [ "$OAUTH_KEYS" -gt 0 ]; then
    echo -e "    ${YELLOW}Active OAuth sessions:${NC}"
    docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:spotify:*" 2>/dev/null | while read key; do
        TTL=$(docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" TTL "$key" 2>/dev/null)
        echo "    - $key (TTL: ${TTL}s)"
    done
fi

# ============================================================================
# TEST 4: Test Health Endpoint
# ============================================================================
echo -e "\n${BLUE}[TEST 4]${NC} Testing health endpoint..."

HEALTH_RESPONSE=$(curl -s "${API_BASE_URL}/api/v1/music-auth/health" || echo "FAILED")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    pass_test "Health endpoint responding correctly"
else
    fail_test "Health endpoint not responding"
    echo "    Response: $HEALTH_RESPONSE"
fi

# ============================================================================
# TEST 5: Test Authorization Endpoint (Simulated - checks redirect only)
# ============================================================================
echo -e "\n${BLUE}[TEST 5]${NC} Testing authorization endpoint..."

info_test "Testing /spotify/authorize endpoint (redirect check only)"

# Make request and capture redirect location
REDIRECT_URL=$(curl -s -o /dev/null -w "%{redirect_url}" "${API_BASE_URL}/api/v1/music-auth/spotify/authorize?redirect_uri=http://127.0.0.1:8082/callback" || echo "")

if [[ "$REDIRECT_URL" == *"accounts.spotify.com/authorize"* ]]; then
    pass_test "Authorization endpoint returns Spotify redirect"

    # Check for PKCE parameters
    if [[ "$REDIRECT_URL" == *"code_challenge="* ]] && [[ "$REDIRECT_URL" == *"code_challenge_method=S256"* ]]; then
        pass_test "PKCE parameters present in authorization URL"
        info_test "✓ code_challenge found"
        info_test "✓ code_challenge_method=S256 found"
    else
        fail_test "PKCE parameters MISSING from authorization URL"
        warn_test "This is a CRITICAL security issue!"
        echo "    URL: $REDIRECT_URL"
    fi

    # Check for state parameter
    if [[ "$REDIRECT_URL" == *"state="* ]]; then
        pass_test "State parameter present (CSRF protection)"
    else
        fail_test "State parameter missing"
    fi
else
    fail_test "Authorization endpoint not redirecting to Spotify"
    echo "    Response: $REDIRECT_URL"
fi

# ============================================================================
# TEST 6: Verify OAuth State Storage in Redis
# ============================================================================
echo -e "\n${BLUE}[TEST 6]${NC} Verifying OAuth state storage..."

# Count OAuth states created in last minute
RECENT_STATES=$(docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:spotify:*" 2>/dev/null | wc -l)

if [ "$RECENT_STATES" -gt 0 ]; then
    pass_test "OAuth state stored in Redis"

    # Check if state contains PKCE verifier
    FIRST_STATE=$(docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern "oauth:spotify:*" 2>/dev/null | head -1)
    if [ -n "$FIRST_STATE" ]; then
        STATE_DATA=$(docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" GET "$FIRST_STATE" 2>/dev/null)

        if echo "$STATE_DATA" | grep -q "code_verifier"; then
            pass_test "PKCE code_verifier stored in Redis state"
        else
            fail_test "PKCE code_verifier NOT found in Redis state"
            warn_test "PKCE implementation may be incomplete"
            echo "    State data: $STATE_DATA"
        fi

        # Check TTL
        TTL=$(docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" TTL "$FIRST_STATE" 2>/dev/null)
        if [ "$TTL" -gt 0 ] && [ "$TTL" -le 600 ]; then
            pass_test "State TTL is within expected range (${TTL}s / 600s)"
        else
            warn_test "State TTL unexpected: ${TTL}s (expected: ≤600s)"
        fi
    fi
else
    warn_test "No OAuth states found (test may need to run after authorization attempt)"
fi

# ============================================================================
# TEST 7: Test Refresh Endpoint Security
# ============================================================================
echo -e "\n${BLUE}[TEST 7]${NC} Testing refresh endpoint security..."

info_test "Verifying refresh endpoint does NOT accept client credentials from frontend"

# This should FAIL if old vulnerable code is still present
REFRESH_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/api/v1/music-auth/spotify/refresh?refresh_token=test_token&client_id=fake&client_secret=fake" || echo "")

if echo "$REFRESH_RESPONSE" | grep -q "Invalid refresh token" || echo "$REFRESH_RESPONSE" | grep -q "invalid_grant"; then
    pass_test "Refresh endpoint correctly uses backend credentials (client_id/secret parameters ignored)"
    info_test "Expected error received (invalid token), proving credentials come from env vars"
elif echo "$REFRESH_RESPONSE" | grep -q "Invalid client"; then
    warn_test "Response suggests frontend credentials were used (SECURITY ISSUE!)"
    fail_test "Refresh endpoint may still be using frontend-provided credentials"
else
    info_test "Response: ${REFRESH_RESPONSE:0:100}"
fi

# ============================================================================
# TEST 8: Check Database Schema
# ============================================================================
echo -e "\n${BLUE}[TEST 8]${NC} Verifying database schema..."

# Check if user_oauth_tokens table exists
TABLE_EXISTS=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_oauth_tokens');" 2>/dev/null || echo "false")

if [ "$TABLE_EXISTS" = "t" ]; then
    pass_test "user_oauth_tokens table exists"

    # Check for any Spotify tokens
    TOKEN_COUNT=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -tAc "SELECT COUNT(*) FROM user_oauth_tokens WHERE service = 'spotify';" 2>/dev/null || echo "0")
    info_test "Found ${TOKEN_COUNT} Spotify token(s) in database"

    if [ "$TOKEN_COUNT" -gt 0 ]; then
        # Show token status (masked)
        echo -e "    ${BLUE}Token Status:${NC}"
        docker compose exec -T postgres psql -U musicdb_user -d musicdb -c "SELECT user_id, expires_at, CASE WHEN expires_at > NOW() THEN 'valid' ELSE 'expired' END as status FROM user_oauth_tokens WHERE service = 'spotify';" 2>/dev/null
    fi
else
    fail_test "user_oauth_tokens table does not exist"
    warn_test "Run database migrations: sql/migrations/006_user_oauth_tokens_up.sql"
fi

# ============================================================================
# TEST 9: Check REST API Logs for PKCE Messages
# ============================================================================
echo -e "\n${BLUE}[TEST 9]${NC} Checking REST API logs..."

RECENT_LOGS=$(docker compose logs --tail=100 rest-api 2>/dev/null | grep "SPOTIFY")

if echo "$RECENT_LOGS" | grep -q "Stored OAuth state with PKCE"; then
    pass_test "PKCE implementation confirmed in logs"
elif echo "$RECENT_LOGS" | grep -q "SPOTIFY"; then
    warn_test "Spotify logs found but no PKCE confirmation"
    info_test "Try initiating an OAuth flow to generate logs"
else
    info_test "No recent Spotify OAuth activity in logs"
fi

# Check for errors
if echo "$RECENT_LOGS" | grep -qi "error\|failed\|exception"; then
    warn_test "Errors detected in recent logs"
    echo "$RECENT_LOGS" | grep -i "error\|failed\|exception" | tail -5
fi

# ============================================================================
# TEST 10: API Documentation Check
# ============================================================================
echo -e "\n${BLUE}[TEST 10]${NC} Checking API documentation..."

# Check if the manual token endpoint has deprecation warning
CODE_CHECK=$(grep -n "DEPRECATED" services/rest-api/routers/music_auth.py | grep "spotify/token" || echo "")

if [ -n "$CODE_CHECK" ]; then
    pass_test "Manual token exchange endpoint marked as DEPRECATED"
else
    warn_test "Manual token exchange endpoint should have deprecation warning"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        TEST SUMMARY                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Spotify OAuth PKCE implementation looks good.${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Test the complete OAuth flow from your frontend"
    echo "  2. Monitor logs: docker compose logs -f rest-api | grep '🎵'"
    echo "  3. Verify tokens are stored: psql user_oauth_tokens table"
    echo "  4. Test token refresh after 1 hour (or manually trigger)"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the failures above.${NC}"
    echo ""
    echo -e "${YELLOW}Common Issues:${NC}"
    echo "  • Missing Spotify credentials in .env"
    echo "  • Services not running (docker compose up -d)"
    echo "  • Database migrations not applied"
    echo "  • Code changes not deployed (docker compose build rest-api)"
    echo ""
    exit 1
fi
