#!/bin/bash
# Health check script for SongNodes services
# Verifies all required services are running before integration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MAX_RETRIES=30
RETRY_DELAY=2

# Service URLs
declare -A SERVICES=(
    ["PostgreSQL"]="localhost:5433"
    ["Redis"]="localhost:6380"
    ["RabbitMQ Management"]="http://localhost:15672"
    ["API Gateway"]="http://localhost:8100/health"
    ["Metadata Enrichment"]="http://localhost:8020/health"
    ["DLQ Manager"]="http://localhost:8024/health"
)

echo "============================================"
echo "SongNodes Service Health Check"
echo "============================================"
echo ""

# Check if service is responding
check_http_service() {
    local name=$1
    local url=$2
    local retries=0

    echo -n "Checking $name... "

    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s -o /dev/null --connect-timeout 2 "$url"; then
            echo -e "${GREEN}✓ OK${NC}"
            return 0
        fi

        retries=$((retries + 1))
        sleep $RETRY_DELAY
    done

    echo -e "${RED}✗ FAILED (timeout after ${MAX_RETRIES} attempts)${NC}"
    return 1
}

# Check if TCP port is open
check_tcp_service() {
    local name=$1
    local host=$2
    local port=$3
    local retries=0

    echo -n "Checking $name... "

    while [ $retries -lt $MAX_RETRIES ]; do
        if timeout 2 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
            echo -e "${GREEN}✓ OK${NC}"
            return 0
        fi

        retries=$((retries + 1))
        sleep $RETRY_DELAY
    done

    echo -e "${RED}✗ FAILED (timeout after ${MAX_RETRIES} attempts)${NC}"
    return 1
}

# Main health check
failed=0

# Check PostgreSQL
if ! check_tcp_service "PostgreSQL" "localhost" "5433"; then
    failed=$((failed + 1))
    echo -e "${YELLOW}  Hint: docker compose ps postgres${NC}"
fi

# Check Redis
if ! check_tcp_service "Redis" "localhost" "6380"; then
    failed=$((failed + 1))
    echo -e "${YELLOW}  Hint: docker compose ps redis${NC}"
fi

# Check RabbitMQ Management UI
if ! check_http_service "RabbitMQ Management" "http://localhost:15672"; then
    failed=$((failed + 1))
    echo -e "${YELLOW}  Hint: docker compose ps rabbitmq${NC}"
fi

# Check API Gateway
if ! check_http_service "API Gateway" "http://localhost:8100/health"; then
    failed=$((failed + 1))
    echo -e "${YELLOW}  Hint: docker compose logs api-gateway${NC}"
fi

# Check Metadata Enrichment Service
if ! check_http_service "Metadata Enrichment" "http://localhost:8020/health"; then
    failed=$((failed + 1))
    echo -e "${YELLOW}  Hint: docker compose logs metadata-enrichment${NC}"
fi

# Check DLQ Manager
if ! check_http_service "DLQ Manager" "http://localhost:8024/health"; then
    failed=$((failed + 1))
    echo -e "${YELLOW}  Hint: docker compose logs dlq-manager${NC}"
fi

echo ""
echo "============================================"

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}All services healthy!${NC}"
    echo "Ready to run integration tests."
    exit 0
else
    echo -e "${RED}$failed service(s) failed health check${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Start services: docker compose up -d"
    echo "2. Check service status: docker compose ps"
    echo "3. Check service logs: docker compose logs [service-name]"
    echo "4. Restart failed services: docker compose restart [service-name]"
    exit 1
fi
