#!/bin/bash

# SongNodes Docker Stack Quick Start Script
# This script sets up and starts the complete SongNodes Docker environment

set -e

echo "🎵 SongNodes Docker Stack Setup"
echo "================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose V2."
        exit 1
    fi

    # Check available memory
    total_mem=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$total_mem" -lt 8 ]; then
        print_warning "System has less than 8GB RAM. Some services may fail."
    fi

    # Check available disk space
    available_space=$(df . | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 10485760 ]; then  # 10GB in KB
        print_warning "Less than 10GB disk space available."
    fi

    print_success "Prerequisites check passed"
}

# Create necessary directories
setup_directories() {
    print_status "Creating data directories..."

    directories=(
        "data/postgres"
        "data/redis"
        "data/rabbitmq"
        "data/elasticsearch"
        "data/prometheus"
        "data/grafana"
        "data/minio"
        "data/nlp_models"
        "logs/nginx"
    )

    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
    done

    print_success "Data directories created"
}

# Validate docker-compose configuration
validate_config() {
    print_status "Validating Docker Compose configuration..."

    if docker compose config --quiet; then
        print_success "Docker Compose configuration is valid"
    else
        print_error "Docker Compose configuration has errors"
        exit 1
    fi
}

# Stop any running containers
stop_existing() {
    print_status "Stopping any existing containers..."
    docker compose down --remove-orphans 2>/dev/null || true
    print_success "Stopped existing containers"
}

# Pull latest images
pull_images() {
    print_status "Pulling latest Docker images..."
    docker compose pull --quiet
    print_success "Images pulled successfully"
}

# Start core services first
start_core_services() {
    print_status "Starting core infrastructure services..."

    # Start database and cache first
    docker compose up -d postgres redis rabbitmq

    print_status "Waiting for core services to be ready..."
    sleep 10

    # Wait for postgres to be ready
    while ! docker compose exec postgres pg_isready -U musicdb_user -d musicdb -q; do
        print_status "Waiting for PostgreSQL..."
        sleep 5
    done

    # Wait for redis to be ready
    while ! docker compose exec redis redis-cli ping | grep -q PONG; do
        print_status "Waiting for Redis..."
        sleep 5
    done

    print_success "Core services are ready"
}

# Start application services
start_app_services() {
    print_status "Starting application services..."

    # Start connection pool and APIs
    docker compose up -d db-connection-pool
    sleep 5

    docker compose up -d rest-api graphql-api websocket-api graph-visualization-api enhanced-visualization-service
    sleep 10

    # Start API gateway
    docker compose up -d api-gateway
    sleep 5

    print_success "Application services started"
}

# Start frontend and proxy
start_frontend() {
    print_status "Starting frontend and reverse proxy..."

    docker compose up -d frontend nginx
    sleep 10

    print_success "Frontend services started"
}

# Start monitoring stack
start_monitoring() {
    print_status "Starting monitoring stack..."

    docker compose up -d prometheus grafana node-exporter postgres-exporter redis-exporter
    sleep 5

    print_success "Monitoring services started"
}

# Start optional services
start_optional() {
    print_status "Starting optional services..."

    # Start scrapers and processors (if needed)
    docker compose up -d scraper-orchestrator data-transformer data-validator

    # Start logging stack
    docker compose up -d elasticsearch kibana

    print_success "Optional services started"
}

# Check service health
check_health() {
    print_status "Checking service health..."

    # Wait a bit for all services to initialize
    sleep 30

    # List all services and their status
    echo -e "\n📊 Service Status:"
    echo "=================="
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

    # Check critical endpoints
    echo -e "\n🔍 Health Checks:"
    echo "=================="

    endpoints=(
        "http://localhost:8088/health:API Gateway"
        "http://localhost:3006:Frontend"
        "http://localhost:3001:Grafana"
        "http://localhost:9091:Prometheus"
    )

    for endpoint in "${endpoints[@]}"; do
        url="${endpoint%:*}"
        name="${endpoint#*:}"

        if curl -sf "$url" &>/dev/null; then
            print_success "$name is responding"
        else
            print_warning "$name is not responding yet"
        fi
    done
}

# Display connection information
show_info() {
    echo -e "\n🚀 SongNodes Stack Started Successfully!"
    echo "========================================"
    echo ""
    echo "🌐 Application URLs:"
    echo "  Frontend:     http://localhost:3006"
    echo "  API Gateway:  http://localhost:8088"
    echo "  Nginx Proxy:  https://localhost:8443"
    echo ""
    echo "📊 Monitoring URLs:"
    echo "  Grafana:      http://localhost:3001 (admin/admin)"
    echo "  Prometheus:   http://localhost:9091"
    echo "  Kibana:       http://localhost:5602"
    echo ""
    echo "🗄️  Database Access:"
    echo "  PostgreSQL:   localhost:5433 (musicdb_user/musicdb_secure_pass)"
    echo "  Redis:        localhost:6380"
    echo ""
    echo "🛠️  Management Commands:"
    echo "  View logs:    docker compose logs -f"
    echo "  Stop stack:   docker compose down"
    echo "  Restart:      docker compose restart <service>"
    echo ""
    echo "📚 For troubleshooting, see: DOCKER_SETUP_GUIDE.md"
}

# Main execution
main() {
    echo ""
    check_prerequisites
    setup_directories
    validate_config
    stop_existing

    if [ "${1:-}" != "--skip-pull" ]; then
        pull_images
    fi

    start_core_services
    start_app_services
    start_frontend

    if [ "${1:-}" != "--minimal" ]; then
        start_monitoring
        start_optional
    fi

    check_health
    show_info

    print_success "Setup complete! 🎉"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "SongNodes Docker Stack Setup Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --minimal      Start only core services (no monitoring/logging)"
        echo "  --skip-pull    Skip pulling latest images"
        echo "  --help         Show this help message"
        echo ""
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
