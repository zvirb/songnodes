#!/bin/bash

# Security Testing Script for MusicDB API Gateway
# Tests authentication, authorization, rate limiting, and security headers

set -euo pipefail

# Configuration
API_BASE_URL="${API_BASE_URL:-https://localhost:8443}"
API_GATEWAY_URL="${API_GATEWAY_URL:-http://localhost:8080}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
WARNINGS=0

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✓ $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠ $1${NC}"
    ((WARNINGS++))
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ✗ $1${NC}"
    ((FAILED++))
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] ℹ $1${NC}"
}

pass() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✓ $1${NC}"
    ((PASSED++))
}

# Test function template
test_function() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    info "Testing: $test_name"
    
    if [ "$VERBOSE" = "true" ]; then
        echo "Command: $test_command"
    fi
    
    local result
    if result=$(eval "$test_command" 2>&1); then
        if [[ "$result" == *"$expected_result"* ]]; then
            pass "$test_name"
        else
            error "$test_name - Expected: $expected_result, Got: $result"
        fi
    else
        error "$test_name - Command failed: $result"
    fi
}

# Test SSL/TLS Configuration
test_ssl_configuration() {
    info "=== Testing SSL/TLS Configuration ==="
    
    # Test SSL certificate
    if openssl s_client -connect localhost:8443 -servername musicdb.local < /dev/null 2>/dev/null | grep -q "Verification: OK"; then
        pass "SSL certificate verification"
    else
        warn "SSL certificate verification failed (expected for self-signed)"
    fi
    
    # Test TLS version
    local tls_version=$(openssl s_client -connect localhost:8443 -servername musicdb.local < /dev/null 2>/dev/null | grep "Protocol" | head -1)
    if [[ "$tls_version" == *"TLSv1.3"* ]] || [[ "$tls_version" == *"TLSv1.2"* ]]; then
        pass "TLS version check: $tls_version"
    else
        error "Insecure TLS version: $tls_version"
    fi
    
    # Test cipher suite
    local cipher=$(openssl s_client -connect localhost:8443 -servername musicdb.local < /dev/null 2>/dev/null | grep "Cipher" | head -1)
    if [[ "$cipher" == *"ECDHE"* ]] || [[ "$cipher" == *"CHACHA20"* ]]; then
        pass "Strong cipher suite: $cipher"
    else
        warn "Weak cipher suite: $cipher"
    fi
}

# Test Security Headers
test_security_headers() {
    info "=== Testing Security Headers ==="
    
    local headers=$(curl -I -k -s "$API_BASE_URL/health" || echo "ERROR")
    
    if [[ "$headers" == *"ERROR"* ]]; then
        error "Failed to connect to API"
        return
    fi
    
    # Test HSTS
    if [[ "$headers" == *"Strict-Transport-Security"* ]]; then
        pass "HSTS header present"
    else
        error "HSTS header missing"
    fi
    
    # Test X-Frame-Options
    if [[ "$headers" == *"X-Frame-Options: DENY"* ]]; then
        pass "X-Frame-Options header present"
    else
        error "X-Frame-Options header missing or incorrect"
    fi
    
    # Test X-Content-Type-Options
    if [[ "$headers" == *"X-Content-Type-Options: nosniff"* ]]; then
        pass "X-Content-Type-Options header present"
    else
        error "X-Content-Type-Options header missing"
    fi
    
    # Test CSP
    if [[ "$headers" == *"Content-Security-Policy"* ]]; then
        pass "Content-Security-Policy header present"
    else
        error "Content-Security-Policy header missing"
    fi
    
    # Test server header hiding
    if [[ "$headers" == *"Server:"* ]]; then
        warn "Server header exposed"
    else
        pass "Server header hidden"
    fi
}

# Test Authentication
test_authentication() {
    info "=== Testing Authentication ==="
    
    # Test unauthenticated access to protected endpoint
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$API_GATEWAY_URL/api/v1/tracks" || echo "000")
    if [ "$response" = "401" ]; then
        pass "Protected endpoint blocks unauthenticated access"
    else
        error "Protected endpoint allows unauthenticated access (HTTP $response)"
    fi
    
    # Test invalid token
    response=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid_token" "$API_GATEWAY_URL/api/v1/tracks" || echo "000")
    if [ "$response" = "401" ]; then
        pass "Invalid token rejected"
    else
        error "Invalid token accepted (HTTP $response)"
    fi
    
    # Test malformed authorization header
    response=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: InvalidFormat" "$API_GATEWAY_URL/api/v1/tracks" || echo "000")
    if [ "$response" = "401" ]; then
        pass "Malformed authorization header rejected"
    else
        error "Malformed authorization header accepted (HTTP $response)"
    fi
}

# Test Rate Limiting
test_rate_limiting() {
    info "=== Testing Rate Limiting ==="
    
    # Test general rate limiting
    local rate_limited=false
    for i in {1..15}; do
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$API_GATEWAY_URL/health" || echo "000")
        if [ "$response" = "429" ]; then
            rate_limited=true
            break
        fi
        sleep 0.1
    done
    
    if [ "$rate_limited" = "true" ]; then
        pass "Rate limiting is working"
    else
        warn "Rate limiting may not be working (test may need adjustment)"
    fi
    
    # Test auth endpoint rate limiting (more strict)
    rate_limited=false
    for i in {1..3}; do
        local response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d '{"email":"test@example.com","password":"wrongpass"}' \
            "$API_GATEWAY_URL/api/auth/login" || echo "000")
        if [ "$response" = "429" ]; then
            rate_limited=true
            break
        fi
        sleep 0.1
    done
    
    if [ "$rate_limited" = "true" ]; then
        pass "Auth endpoint rate limiting is working"
    else
        warn "Auth endpoint rate limiting may not be working"
    fi
}

# Test Input Validation
test_input_validation() {
    info "=== Testing Input Validation ==="
    
    # Test SQL injection attempt
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        "$API_GATEWAY_URL/api/v1/tracks?search='; DROP TABLE users; --" || echo "000")
    if [ "$response" = "400" ] || [ "$response" = "404" ]; then
        pass "SQL injection attempt blocked"
    else
        warn "SQL injection attempt not properly handled (HTTP $response)"
    fi
    
    # Test XSS attempt
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d '{"search":"<script>alert(\"xss\")</script>"}' \
        "$API_GATEWAY_URL/api/v1/search" || echo "000")
    if [ "$response" = "400" ] || [ "$response" = "401" ]; then
        pass "XSS attempt blocked"
    else
        warn "XSS attempt not properly handled (HTTP $response)"
    fi
    
    # Test path traversal attempt
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        "$API_GATEWAY_URL/api/v1/../../../etc/passwd" || echo "000")
    if [ "$response" = "400" ] || [ "$response" = "404" ]; then
        pass "Path traversal attempt blocked"
    else
        warn "Path traversal attempt not properly handled (HTTP $response)"
    fi
}

# Test CORS Configuration
test_cors_configuration() {
    info "=== Testing CORS Configuration ==="
    
    # Test preflight request
    local cors_headers=$(curl -s -H "Origin: https://malicious.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS "$API_GATEWAY_URL/api/auth/login" -I | grep -i "access-control" || echo "")
    
    if [ -n "$cors_headers" ]; then
        if [[ "$cors_headers" == *"access-control-allow-origin"* ]]; then
            warn "CORS may be too permissive - check allowed origins"
        else
            pass "CORS preflight handled correctly"
        fi
    else
        info "No CORS headers found (may be intentional)"
    fi
}

# Test API Gateway Health
test_api_gateway_health() {
    info "=== Testing API Gateway Health ==="
    
    # Test health endpoint
    local health_response=$(curl -s "$API_GATEWAY_URL/health" || echo "ERROR")
    if [[ "$health_response" == *"healthy"* ]] || [[ "$health_response" == *"status"* ]]; then
        pass "Health endpoint accessible"
    else
        error "Health endpoint not accessible: $health_response"
    fi
    
    # Test API info endpoint
    local api_response=$(curl -s "$API_GATEWAY_URL/api" || echo "ERROR")
    if [[ "$api_response" == *"MusicDB"* ]] || [[ "$api_response" == *"version"* ]]; then
        pass "API info endpoint accessible"
    else
        warn "API info endpoint not accessible: $api_response"
    fi
}

# Test Error Handling
test_error_handling() {
    info "=== Testing Error Handling ==="
    
    # Test 404 handling
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$API_GATEWAY_URL/nonexistent-endpoint" || echo "000")
    if [ "$response" = "404" ]; then
        pass "404 errors handled correctly"
    else
        warn "404 errors not handled correctly (HTTP $response)"
    fi
    
    # Test method not allowed
    response=$(curl -s -o /dev/null -w "%{http_code}" -X TRACE "$API_GATEWAY_URL/api/auth/login" || echo "000")
    if [ "$response" = "405" ] || [ "$response" = "404" ]; then
        pass "TRACE method blocked"
    else
        warn "TRACE method not blocked (HTTP $response)"
    fi
}

# Test Redis Connection
test_redis_connection() {
    info "=== Testing Redis Connection ==="
    
    # This is indirect - we test if rate limiting works, which requires Redis
    local redis_test_response=$(curl -s -o /dev/null -w "%{http_code}" "$API_GATEWAY_URL/health" || echo "000")
    if [ "$redis_test_response" = "200" ]; then
        pass "Redis connection appears healthy (API Gateway responding)"
    else
        error "Redis connection may be failing (API Gateway not responding)"
    fi
}

# Main test execution
main() {
    echo "=========================================="
    echo "MusicDB API Gateway Security Test Suite"
    echo "=========================================="
    echo ""
    
    info "Starting security tests for API Gateway"
    info "API Base URL: $API_BASE_URL"
    info "API Gateway URL: $API_GATEWAY_URL"
    echo ""
    
    # Wait for services to be ready
    info "Waiting for services to be ready..."
    sleep 5
    
    # Run tests
    test_api_gateway_health
    test_ssl_configuration
    test_security_headers
    test_authentication
    test_rate_limiting
    test_input_validation
    test_cors_configuration
    test_error_handling
    test_redis_connection
    
    # Summary
    echo ""
    echo "=========================================="
    echo "Test Results Summary"
    echo "=========================================="
    echo -e "${GREEN}Passed: $PASSED${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    echo -e "${RED}Failed: $FAILED${NC}"
    echo ""
    
    if [ $FAILED -gt 0 ]; then
        echo -e "${RED}Some security tests failed. Please review the issues above.${NC}"
        exit 1
    elif [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}Some security tests generated warnings. Review recommended.${NC}"
        exit 0
    else
        echo -e "${GREEN}All security tests passed successfully!${NC}"
        exit 0
    fi
}

# Usage information
usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Enable verbose output"
    echo ""
    echo "Environment variables:"
    echo "  API_BASE_URL     Base URL for HTTPS API tests (default: https://localhost:8443)"
    echo "  API_GATEWAY_URL  URL for HTTP API tests (default: http://localhost:8080)"
    echo "  VERBOSE          Enable verbose output (default: false)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run with default settings"
    echo "  VERBOSE=true $0                       # Run with verbose output"
    echo "  API_BASE_URL=https://api.musicdb.local $0  # Use custom base URL"
}

# Handle command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run main function
main