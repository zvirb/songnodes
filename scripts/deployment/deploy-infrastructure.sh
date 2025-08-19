#!/bin/bash

# MusicDB Infrastructure Deployment Script
# Automates the deployment of the entire infrastructure stack

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-development}
PROJECT_NAME="musicdb"
BACKUP_DIR="/opt/musicdb/backups"
DATA_DIR="/opt/musicdb/data"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

setup_directories() {
    log_info "Setting up data directories..."
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        sudo mkdir -p ${DATA_DIR}/{postgres,redis,prometheus,grafana,elasticsearch,minio}
        sudo mkdir -p ${BACKUP_DIR}
        sudo chown -R 1000:1000 ${DATA_DIR}
        sudo chown -R 1000:1000 ${BACKUP_DIR}
    fi
    
    log_success "Directories setup completed"
}

load_environment() {
    log_info "Loading environment configuration for: $ENVIRONMENT"
    
    if [[ -f ".env.${ENVIRONMENT}" ]]; then
        set -a
        source ".env.${ENVIRONMENT}"
        set +a
        log_success "Environment configuration loaded"
    else
        log_warning "Environment file .env.${ENVIRONMENT} not found, using defaults"
    fi
}

validate_configuration() {
    log_info "Validating configuration..."
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if [[ "${POSTGRES_PASSWORD:-}" == "musicdb_secure_pass" ]]; then
            log_error "Default PostgreSQL password detected in production!"
            exit 1
        fi
        
        if [[ "${JWT_SECRET:-}" == "your_jwt_secret_here" ]]; then
            log_error "Default JWT secret detected in production!"
            exit 1
        fi
        
        if [[ "${GRAFANA_PASSWORD:-}" == "admin" ]]; then
            log_warning "Default Grafana password detected in production!"
        fi
    fi
    
    log_success "Configuration validation passed"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure stack..."
    
    # Stop existing services
    docker-compose down --remove-orphans || true
    
    # Pull latest images
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
    else
        docker-compose pull
    fi
    
    # Start infrastructure services first
    log_info "Starting database and message queue services..."
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis rabbitmq
    else
        docker-compose up -d postgres redis rabbitmq
    fi
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    for i in {1..60}; do
        if docker-compose exec -T postgres pg_isready -U musicdb_user -d musicdb; then
            break
        fi
        sleep 2
        if [[ $i -eq 60 ]]; then
            log_error "Database failed to start within 2 minutes"
            exit 1
        fi
    done
    
    # Start monitoring services
    log_info "Starting monitoring services..."
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d prometheus grafana elasticsearch kibana node-exporter cadvisor postgres-exporter redis-exporter
    else
        docker-compose up -d prometheus grafana elasticsearch kibana node-exporter cadvisor postgres-exporter redis-exporter
    fi
    
    # Start application services
    log_info "Starting application services..."
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    else
        docker-compose up -d
    fi
    
    log_success "Infrastructure deployment completed"
}

health_check() {
    log_info "Performing health checks..."
    
    local services=(
        "postgres:5433"
        "redis:6380"
        "rabbitmq:15673"
        "prometheus:9091"
        "grafana:3001"
        "api-gateway:8080"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -ra ADDR <<< "$service"
        service_name="${ADDR[0]}"
        port="${ADDR[1]}"
        
        log_info "Checking $service_name on port $port..."
        
        for i in {1..30}; do
            if nc -z localhost $port 2>/dev/null; then
                log_success "$service_name is healthy"
                break
            fi
            sleep 2
            if [[ $i -eq 30 ]]; then
                log_warning "$service_name health check failed"
            fi
        done
    done
}

show_status() {
    log_info "Infrastructure Status:"
    echo ""
    docker-compose ps
    echo ""
    
    log_info "Access URLs:"
    echo "  Grafana Dashboard: http://localhost:3001 (admin/admin)"
    echo "  Prometheus: http://localhost:9091"
    echo "  API Gateway: http://localhost:8080"
    echo "  RabbitMQ Management: http://localhost:15673"
    echo "  Kibana: http://localhost:5602"
    echo ""
}

backup_data() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "Creating backup..."
        
        local backup_timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_path="${BACKUP_DIR}/backup_${backup_timestamp}"
        
        mkdir -p "$backup_path"
        
        # Backup PostgreSQL
        docker-compose exec -T postgres pg_dumpall -U musicdb_user > "${backup_path}/postgres_backup.sql"
        
        # Backup Redis
        docker-compose exec -T redis redis-cli BGSAVE
        docker cp $(docker-compose ps -q redis):/data/dump.rdb "${backup_path}/redis_backup.rdb"
        
        # Backup Grafana
        docker cp $(docker-compose ps -q grafana):/var/lib/grafana "${backup_path}/grafana_backup"
        
        log_success "Backup created at: $backup_path"
    fi
}

# Main execution
main() {
    log_info "Starting MusicDB Infrastructure Deployment"
    log_info "Environment: $ENVIRONMENT"
    
    check_dependencies
    load_environment
    validate_configuration
    setup_directories
    
    case "${1:-deploy}" in
        deploy)
            deploy_infrastructure
            health_check
            show_status
            ;;
        backup)
            backup_data
            ;;
        status)
            show_status
            ;;
        stop)
            log_info "Stopping infrastructure..."
            docker-compose down
            log_success "Infrastructure stopped"
            ;;
        clean)
            log_warning "This will remove all containers and data!"
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker-compose down -v --remove-orphans
                docker system prune -f
                log_success "Infrastructure cleaned"
            fi
            ;;
        *)
            echo "Usage: $0 {deploy|backup|status|stop|clean}"
            echo "  deploy - Deploy the infrastructure"
            echo "  backup - Create a backup (production only)"
            echo "  status - Show infrastructure status"
            echo "  stop   - Stop all services"
            echo "  clean  - Remove all containers and volumes"
            exit 1
            ;;
    esac
    
    log_success "Operation completed successfully"
}

# Check if we're being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi