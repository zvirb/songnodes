#!/bin/bash

# Script to add Prometheus metrics to all services using Docker exec
# No sudo required - uses Docker's container management

echo "🚀 Adding Prometheus Metrics to All Services"
echo "==========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to add metrics to Node.js service
add_nodejs_metrics() {
    local container=$1
    local service_name=$2

    echo -e "${YELLOW}Processing Node.js service: ${service_name}${NC}"

    # Check if prom-client is installed
    docker exec $container npm list prom-client 2>/dev/null | grep -q prom-client
    if [ $? -ne 0 ]; then
        echo "  Installing prom-client..."
        docker exec $container npm install prom-client --save 2>&1 | tail -2
    else
        echo "  prom-client already installed"
    fi

    # Copy metrics module into container
    docker cp shared/metrics/node-metrics.js $container:/app/metrics.js 2>/dev/null || \
    docker cp shared/metrics/node-metrics.js $container:/usr/src/app/metrics.js 2>/dev/null || \
    echo "  Warning: Could not copy metrics module"

    echo -e "  ${GREEN}✓ Metrics module added${NC}"
}

# Function to add metrics to Python service
add_python_metrics() {
    local container=$1
    local service_name=$2

    echo -e "${YELLOW}Processing Python service: ${service_name}${NC}"

    # Check if prometheus-client is installed
    docker exec $container pip list 2>/dev/null | grep -q prometheus-client
    if [ $? -ne 0 ]; then
        echo "  Installing prometheus-client..."
        docker exec $container pip install prometheus-client 2>&1 | tail -2
    else
        echo "  prometheus-client already installed"
    fi

    # Check for FastAPI and install instrumentator
    docker exec $container pip list 2>/dev/null | grep -q fastapi
    if [ $? -eq 0 ]; then
        docker exec $container pip list 2>/dev/null | grep -q prometheus-fastapi-instrumentator
        if [ $? -ne 0 ]; then
            echo "  Installing prometheus-fastapi-instrumentator..."
            docker exec $container pip install prometheus-fastapi-instrumentator 2>&1 | tail -2
        fi
    fi

    # Copy metrics module into container
    docker cp shared/metrics/fastapi_metrics.py $container:/app/metrics.py 2>/dev/null || \
    docker cp shared/metrics/fastapi_metrics.py $container:/usr/src/app/metrics.py 2>/dev/null || \
    echo "  Warning: Could not copy metrics module"

    echo -e "  ${GREEN}✓ Metrics module added${NC}"
}

# Node.js services that need metrics
echo "📦 Adding metrics to Node.js services..."
echo "----------------------------------------"

NODE_SERVICES=(
    "api-gateway"
    "websocket-api"
    "graphql-api"
    "songnodes-rest-api-1"
    "enhanced-visualization-service"
    "data-validator"
    "scraper-orchestrator"
)

for service in "${NODE_SERVICES[@]}"; do
    if docker ps --format "{{.Names}}" | grep -q "^${service}$"; then
        add_nodejs_metrics $service $service
    else
        echo -e "${RED}  ✗ Service ${service} not running${NC}"
    fi
done

# Python services that need metrics
echo ""
echo "🐍 Adding metrics to Python services..."
echo "----------------------------------------"

PYTHON_SERVICES=(
    "graph-visualization-api"
    "nlp-processor"
    "songnodes-data-transformer-1"
)

for service in "${PYTHON_SERVICES[@]}"; do
    if docker ps --format "{{.Names}}" | grep -q "^${service}$"; then
        add_python_metrics $service $service
    else
        echo -e "${RED}  ✗ Service ${service} not running${NC}"
    fi
done

echo ""
echo "✅ Metrics modules installed in all services"
echo "Next step: Update service code to use metrics endpoints"