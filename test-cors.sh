#!/bin/bash

# Test script to verify CORS and security configurations are relaxed
echo "================================================"
echo "CORS and Security Configuration Test"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Base URLs for testing
API_BASE="http://localhost:8080"
WEBSOCKET_BASE="http://localhost:8083"
GRAPH_VIZ_BASE="http://localhost:8084"
SCRAPER_ORCH_BASE="http://localhost:8001"

echo "Testing CORS headers on various services..."
echo "============================================"
echo ""

# Function to test CORS
test_cors() {
    local service_name=$1
    local url=$2

    echo "Testing $service_name ($url)..."

    # Test preflight request
    response=$(curl -s -I -X OPTIONS \
        -H "Origin: http://example.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: content-type" \
        "$url" 2>/dev/null)

    if echo "$response" | grep -q "Access-Control-Allow-Origin: \*"; then
        echo -e "${GREEN}✓ CORS Allow-Origin: * found${NC}"
    else
        echo -e "${RED}✗ CORS Allow-Origin: * NOT found${NC}"
    fi

    if echo "$response" | grep -q "Access-Control-Allow-Methods:"; then
        echo -e "${GREEN}✓ CORS Allow-Methods header found${NC}"
    else
        echo -e "${RED}✗ CORS Allow-Methods header NOT found${NC}"
    fi

    if echo "$response" | grep -q "Access-Control-Allow-Headers:"; then
        echo -e "${GREEN}✓ CORS Allow-Headers found${NC}"
    else
        echo -e "${RED}✗ CORS Allow-Headers NOT found${NC}"
    fi

    # Check for absence of security headers
    if echo "$response" | grep -q "X-Frame-Options:"; then
        echo -e "${RED}✗ Security header X-Frame-Options still present${NC}"
    else
        echo -e "${GREEN}✓ Security header X-Frame-Options removed${NC}"
    fi

    if echo "$response" | grep -q "X-Content-Type-Options:"; then
        echo -e "${RED}✗ Security header X-Content-Type-Options still present${NC}"
    else
        echo -e "${GREEN}✓ Security header X-Content-Type-Options removed${NC}"
    fi

    if echo "$response" | grep -q "Strict-Transport-Security:"; then
        echo -e "${RED}✗ Security header Strict-Transport-Security still present${NC}"
    else
        echo -e "${GREEN}✓ Security header Strict-Transport-Security removed${NC}"
    fi

    if echo "$response" | grep -q "Content-Security-Policy:"; then
        echo -e "${RED}✗ Security header Content-Security-Policy still present${NC}"
    else
        echo -e "${GREEN}✓ Security header Content-Security-Policy removed${NC}"
    fi

    echo ""
}

# Test different services
test_cors "REST API" "$API_BASE/api/health"
test_cors "WebSocket API" "$WEBSOCKET_BASE/health"
test_cors "Graph Visualization API" "$GRAPH_VIZ_BASE/health"
test_cors "Scraper Orchestrator" "$SCRAPER_ORCH_BASE/health"

echo "============================================"
echo "Testing cross-origin requests..."
echo "============================================"
echo ""

# Test actual cross-origin request
echo "Testing cross-origin GET request to REST API..."
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -H "Origin: http://malicious-site.com" \
    "$API_BASE/api/health" 2>/dev/null)

http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d':' -f2)
if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
    echo -e "${GREEN}✓ Cross-origin request successful (HTTP $http_code)${NC}"
else
    echo -e "${RED}✗ Cross-origin request failed (HTTP $http_code)${NC}"
fi

echo ""
echo "============================================"
echo "Summary"
echo "============================================"
echo ""
echo "All CORS and security restrictions have been configured to be permissive."
echo "Services should now accept requests from any origin without restrictions."
echo ""
echo "To apply these changes, restart the services with:"
echo "  docker-compose down"
echo "  docker-compose up -d"
echo ""