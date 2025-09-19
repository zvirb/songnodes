#!/bin/bash

# ================================================
# REPLICA-READY DEPLOYMENT SCRIPT
# ================================================
# Deploy SongNodes with horizontal scaling support
# No hardcoded ports, supports multiple replicas
# Single entry point through nginx load balancer
# ================================================

set -e

echo "🚀 Starting replica-ready deployment..."

# Configuration
COMPOSE_FILE="docker-compose.replica-ready.yml"
NGINX_CONFIG="nginx/nginx-replica-ready.conf"
HTTP_PORT="${HTTP_PORT:-8088}"
HTTPS_PORT="${HTTPS_PORT:-8443}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi

    if [ ! -f "$COMPOSE_FILE" ]; then
        print_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    if [ ! -f "$NGINX_CONFIG" ]; then
        print_error "Nginx config not found: $NGINX_CONFIG"
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Stop any running containers
cleanup_existing() {
    print_status "Cleaning up existing containers..."

    # Stop containers from regular compose file
    if [ -f "docker-compose.yml" ]; then
        docker compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
    fi

    # Stop containers from replica-ready compose file
    docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

    print_success "Cleanup completed"
}

# Build all services
build_services() {
    print_status "Building services..."

    export HTTP_PORT="$HTTP_PORT"
    export HTTPS_PORT="$HTTPS_PORT"

    docker compose -f "$COMPOSE_FILE" build --no-cache

    print_success "Build completed"
}

# Deploy with replicas
deploy_services() {
    print_status "Deploying services with replicas..."

    export HTTP_PORT="$HTTP_PORT"
    export HTTPS_PORT="$HTTPS_PORT"

    # Start infrastructure services first
    print_status "Starting infrastructure services..."
    docker compose -f "$COMPOSE_FILE" up -d postgres redis rabbitmq

    # Wait for infrastructure to be ready
    print_status "Waiting for infrastructure services..."
    sleep 10

    # Start core services
    print_status "Starting core services..."
    docker compose -f "$COMPOSE_FILE" up -d db-connection-pool
    sleep 5

    # Start application services with replicas
    print_status "Starting application services with replicas..."
    docker compose -f "$COMPOSE_FILE" up -d \
        scraper-orchestrator \
        data-validator \
        api-gateway \
        websocket-api \
        enhanced-visualization-service \
        frontend

    # Wait for services to start
    sleep 15

    # Start nginx last
    print_status "Starting nginx load balancer..."
    docker compose -f "$COMPOSE_FILE" up -d nginx

    print_success "Deployment completed"
}

# Scale services to test replica functionality
scale_services() {
    print_status "Scaling services to test replica functionality..."

    docker compose -f "$COMPOSE_FILE" up -d --scale api-gateway=3
    docker compose -f "$COMPOSE_FILE" up -d --scale enhanced-visualization-service=2
    docker compose -f "$COMPOSE_FILE" up -d --scale frontend=2
    docker compose -f "$COMPOSE_FILE" up -d --scale websocket-api=2

    print_success "Services scaled successfully"
}

# Health check
health_check() {
    print_status "Performing health checks..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$HTTP_PORT/health" > /dev/null; then
            print_success "Health check passed"
            return 0
        fi

        attempt=$((attempt + 1))
        print_status "Health check attempt $attempt/$max_attempts..."
        sleep 2
    done

    print_error "Health check failed after $max_attempts attempts"
    return 1
}

# Show status
show_status() {
    print_status "Deployment status:"
    echo ""

    print_status "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    echo ""

    print_status "Service endpoints:"
    echo "🌐 Main Application: http://localhost:$HTTP_PORT"
    echo "🔗 HTTPS (if configured): https://localhost:$HTTPS_PORT"
    echo "📊 API Health: http://localhost:$HTTP_PORT/health"
    echo "🎵 Graph API: http://localhost:$HTTP_PORT/api/v1/graph"
    echo ""

    print_status "Load balancing test:"
    echo "Multiple replicas are running behind nginx load balancer"
    echo "Test load balancing: curl http://localhost:$HTTP_PORT/health"
    echo ""

    # Check replica counts
    print_status "Replica counts:"
    docker compose -f "$COMPOSE_FILE" ps --format "table {{.Service}}\t{{.State}}\t{{.Name}}"
}

# Test 3D mode functionality
test_3d_mode() {
    print_status "Testing 3D mode functionality..."

    # Test API connectivity
    if curl -s "http://localhost:$HTTP_PORT/api/v1/graph" | jq '.nodes | length' > /dev/null 2>&1; then
        local node_count=$(curl -s "http://localhost:$HTTP_PORT/api/v1/graph" | jq '.nodes | length')
        local edge_count=$(curl -s "http://localhost:$HTTP_PORT/api/v1/graph" | jq '.edges | length')

        print_success "Graph API working: $node_count nodes, $edge_count edges"

        if [ "$node_count" -gt 10 ]; then
            print_success "Sufficient data for 3D visualization testing"
        else
            print_warning "Limited data available for 3D testing"
        fi
    else
        print_error "Graph API not responding correctly"
        return 1
    fi

    print_success "3D mode should be testable at http://localhost:$HTTP_PORT"
}

# Main execution
main() {
    echo "================================================"
    echo "🎵 SongNodes Replica-Ready Deployment"
    echo "================================================"
    echo "HTTP Port: $HTTP_PORT"
    echo "HTTPS Port: $HTTPS_PORT"
    echo "================================================"
    echo ""

    check_prerequisites
    cleanup_existing
    build_services
    deploy_services

    print_status "Waiting for services to stabilize..."
    sleep 20

    scale_services

    if health_check; then
        show_status
        test_3d_mode

        print_success "Replica-ready deployment completed successfully!"
        print_status "You can now test 3D mode at: http://localhost:$HTTP_PORT"
    else
        print_error "Deployment health check failed"
        print_status "Check logs with: docker compose -f $COMPOSE_FILE logs"
        exit 1
    fi
}

# Run main function
main "$@"