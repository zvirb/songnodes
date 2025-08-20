#!/bin/bash
# Blue-Green Deployment Script for MusicDB
# Ensures zero-downtime production deployment with rollback capabilities

set -euo pipefail

# Configuration
ENVIRONMENT=${1:-production}
DEPLOYMENT_MODE=${2:-blue-green}
BACKUP_DIR="/opt/musicdb/backups"
DEPLOYMENT_LOG="/opt/musicdb/logs/deployment.log"
HEALTH_CHECK_TIMEOUT=60
ROLLBACK_TIMEOUT=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

# Pre-deployment checks
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check Docker availability
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not available"
        exit 1
    fi
    
    # Check Docker Compose availability
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed or not available"
        exit 1
    fi
    
    # Check required directories
    mkdir -p "$BACKUP_DIR" "$(dirname "$DEPLOYMENT_LOG")"
    
    # Verify production configurations exist
    if [[ ! -f "docker-compose.yml" ]] || [[ ! -f "docker-compose.prod.yml" ]]; then
        error "Docker Compose configuration files not found"
        exit 1
    fi
    
    success "Prerequisites check completed"
}

# Database backup
backup_database() {
    log "Creating database backup..."
    
    local backup_file="$BACKUP_DIR/postgres_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    docker exec musicdb-postgres pg_dump -U musicdb_user musicdb > "$backup_file" 2>/dev/null || {
        error "Database backup failed"
        exit 1
    }
    
    # Compress backup
    gzip "$backup_file"
    
    success "Database backup created: ${backup_file}.gz"
    echo "$backup_file.gz"
}

# Health check function
health_check() {
    local service_url=$1
    local service_name=$2
    local timeout=${3:-$HEALTH_CHECK_TIMEOUT}
    
    log "Performing health check for $service_name..."
    
    local count=0
    while [[ $count -lt $timeout ]]; do
        if curl -sf "$service_url" > /dev/null 2>&1; then
            success "$service_name health check passed"
            return 0
        fi
        
        count=$((count + 1))
        sleep 1
    done
    
    error "$service_name health check failed after $timeout seconds"
    return 1
}

# Deploy healthy services to blue environment
deploy_blue_environment() {
    log "Deploying healthy services to blue environment..."
    
    # Create blue environment override
    cat > docker-compose.blue.yml << EOF
version: '3.8'

services:
  # Database services (already healthy)
  postgres:
    container_name: musicdb-postgres-blue
    ports:
      - "5434:5432"  # Different port for blue
    
  redis:
    container_name: musicdb-redis-blue
    ports:
      - "6381:6379"  # Different port for blue
      
  rabbitmq:
    container_name: musicdb-rabbitmq-blue
    ports:
      - "5674:5672"    # Different port for blue
      - "15674:15672"  # Different port for blue
  
  # Healthy application services
  scraper-orchestrator:
    container_name: scraper-orchestrator-blue
    ports:
      - "8101:8001"  # Different port for blue
    environment:
      REDIS_HOST: musicdb-redis-blue
      RABBITMQ_HOST: musicdb-rabbitmq-blue
      DATABASE_URL: postgresql://musicdb_user:\${POSTGRES_PASSWORD:-musicdb_secure_pass}@musicdb-postgres-blue:5432/musicdb
  
  data-transformer:
    container_name: data-transformer-blue
    ports:
      - "8102:8002"  # Different port for blue
    environment:
      REDIS_HOST: musicdb-redis-blue
      POSTGRES_HOST: musicdb-postgres-blue
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-musicdb_secure_pass}
  
  # Monitoring services
  prometheus:
    container_name: metrics-prometheus-blue
    ports:
      - "9092:9090"  # Different port for blue
      
  grafana:
    container_name: monitoring-grafana-blue
    ports:
      - "3002:3000"  # Different port for blue

networks:
  musicdb-backend:
    external: true
  musicdb-monitoring:
    external: true
EOF
    
    # Deploy blue environment
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.blue.yml up -d \
        postgres redis rabbitmq scraper-orchestrator data-transformer prometheus grafana
    
    success "Blue environment deployed"
}

# Health validation for blue environment
validate_blue_environment() {
    log "Validating blue environment health..."
    
    # Wait for services to start
    sleep 30
    
    # Check database connectivity
    if ! docker exec musicdb-postgres-blue pg_isready -U musicdb_user -d musicdb > /dev/null 2>&1; then
        error "Blue PostgreSQL not ready"
        return 1
    fi
    
    # Check Redis connectivity
    if ! docker exec musicdb-redis-blue redis-cli ping > /dev/null 2>&1; then
        error "Blue Redis not ready"
        return 1
    fi
    
    # Check application services
    health_check "http://localhost:8101/health" "scraper-orchestrator-blue" || return 1
    health_check "http://localhost:8102/health" "data-transformer-blue" || return 1
    
    # Check monitoring services
    health_check "http://localhost:9092/-/healthy" "prometheus-blue" || return 1
    health_check "http://localhost:3002/api/health" "grafana-blue" || return 1
    
    success "Blue environment validation completed"
}

# Switch traffic to blue environment
switch_to_blue() {
    log "Switching traffic to blue environment..."
    
    # Update Nginx configuration for blue environment
    cat > /tmp/nginx-blue.conf << 'EOF'
upstream scraper_orchestrator {
    server localhost:8101;  # Blue environment
}

upstream data_transformer {
    server localhost:8102;  # Blue environment
}

upstream monitoring {
    server localhost:3002;  # Blue Grafana
}

server {
    listen 80;
    listen 443 ssl;
    server_name localhost;
    
    # SSL configuration
    ssl_certificate /etc/nginx/ssl/musicdb.crt;
    ssl_certificate_key /etc/nginx/ssl/musicdb.key;
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Route to blue environment
    location /api/scraper/ {
        proxy_pass http://scraper_orchestrator/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/transformer/ {
        proxy_pass http://data_transformer/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /monitoring/ {
        proxy_pass http://monitoring/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    # Apply new Nginx configuration (if Nginx container exists)
    if docker ps --format "table {{.Names}}" | grep -q nginx-proxy; then
        docker cp /tmp/nginx-blue.conf nginx-proxy:/etc/nginx/conf.d/default.conf
        docker exec nginx-proxy nginx -s reload
        success "Nginx configuration updated for blue environment"
    else
        warning "Nginx container not found, manual configuration required"
    fi
}

# Rollback to green environment
rollback_to_green() {
    error "Rolling back to green environment..."
    
    # Restore original Nginx configuration
    if docker ps --format "table {{.Names}}" | grep -q nginx-proxy; then
        # Reset to original configuration
        docker exec nginx-proxy cp /etc/nginx/nginx.conf.backup /etc/nginx/conf.d/default.conf 2>/dev/null || true
        docker exec nginx-proxy nginx -s reload
    fi
    
    # Stop blue environment
    docker-compose -f docker-compose.yml -f docker-compose.blue.yml down
    
    # Ensure green environment is running
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    
    success "Rollback to green environment completed"
}

# Cleanup old environment
cleanup_green() {
    log "Cleaning up green environment..."
    
    # Wait before cleanup
    sleep 10
    
    # Stop green environment containers
    docker stop $(docker ps --filter "name=-green" -q) 2>/dev/null || true
    docker rm $(docker ps -a --filter "name=-green" -q) 2>/dev/null || true
    
    success "Green environment cleanup completed"
}

# Production deployment validation
validate_production() {
    log "Validating production deployment..."
    
    local validation_errors=0
    
    # Test database connectivity
    if ! docker exec musicdb-postgres-blue psql -U musicdb_user -d musicdb -c "SELECT 1;" > /dev/null 2>&1; then
        error "Production database validation failed"
        ((validation_errors++))
    fi
    
    # Test Redis connectivity
    if ! docker exec musicdb-redis-blue redis-cli info > /dev/null 2>&1; then
        error "Production Redis validation failed"
        ((validation_errors++))
    fi
    
    # Test application endpoints
    local endpoints=(
        "http://localhost:8101/health:scraper-orchestrator"
        "http://localhost:8102/health:data-transformer"
        "http://localhost:9092/-/healthy:prometheus"
        "http://localhost:3002/api/health:grafana"
    )
    
    for endpoint in "${endpoints[@]}"; do
        IFS=':' read -r url service <<< "$endpoint"
        if ! health_check "$url" "$service" 30; then
            ((validation_errors++))
        fi
    done
    
    if [[ $validation_errors -eq 0 ]]; then
        success "Production deployment validation passed"
        return 0
    else
        error "Production deployment validation failed with $validation_errors errors"
        return 1
    fi
}

# Main deployment function
main() {
    log "Starting blue-green deployment for environment: $ENVIRONMENT"
    
    # Create backup of current database
    local backup_file
    backup_file=$(backup_database)
    
    # Pre-deployment checks
    check_prerequisites
    
    # Deploy to blue environment
    deploy_blue_environment
    
    # Validate blue environment
    if validate_blue_environment; then
        # Switch traffic to blue
        switch_to_blue
        
        # Final production validation
        if validate_production; then
            success "Blue-green deployment completed successfully"
            
            # Cleanup green environment after successful deployment
            cleanup_green
        else
            error "Production validation failed, initiating rollback"
            rollback_to_green
            exit 1
        fi
    else
        error "Blue environment validation failed, aborting deployment"
        docker-compose -f docker-compose.blue.yml down 2>/dev/null || true
        exit 1
    fi
    
    # Output deployment summary
    cat << EOF

Deployment Summary:
==================
Environment: $ENVIRONMENT
Mode: $DEPLOYMENT_MODE
Backup: $backup_file
Status: SUCCESS

Active Services (Blue Environment):
- PostgreSQL: localhost:5434
- Redis: localhost:6381
- RabbitMQ: localhost:5674
- Scraper Orchestrator: localhost:8101
- Data Transformer: localhost:8102
- Prometheus: localhost:9092
- Grafana: localhost:3002

Access URLs:
- Health Check: http://localhost/health
- Monitoring: http://localhost:3002
- Metrics: http://localhost:9092

EOF
    
    success "Blue-green deployment process completed"
}

# Trap for cleanup on script interruption
trap 'error "Deployment interrupted"; rollback_to_green; exit 1' INT TERM

# Execute main function
main "$@"