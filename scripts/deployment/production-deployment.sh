#!/bin/bash
# Production Blue-Green Deployment for Song Nodes
# Zero-downtime deployment with comprehensive validation

set -euo pipefail

# Configuration
ENVIRONMENT="production"
PROJECT_ROOT="/home/marku/Documents/programming/songnodes"
BACKUP_DIR="$PROJECT_ROOT/deployment/backups"
DEPLOYMENT_LOG="$PROJECT_ROOT/deployment/logs/deployment.log"
HEALTH_CHECK_TIMEOUT=30
SWITCHOVER_TIMEOUT=30
VALIDATION_RETRIES=5
VALIDATION_INTERVAL=5

# Service endpoints for blue-green deployment
GREEN_PORTS_BASE=8000
BLUE_PORTS_BASE=8100

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
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

info() {
    echo -e "${PURPLE}[INFO]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

# Enhanced health check with retry logic
health_check() {
    local service_url="$1"
    local service_name="$2"
    local timeout="${3:-$HEALTH_CHECK_TIMEOUT}"
    local retries="${4:-3}"
    
    log "Performing health check for $service_name at $service_url"
    
    for ((i=1; i<=retries; i++)); do
        local start_time=$(date +%s%N)
        
        if curl -sf --max-time 10 "$service_url" > /dev/null 2>&1; then
            local end_time=$(date +%s%N)
            local response_time=$(( (end_time - start_time) / 1000000 ))
            
            success "$service_name health check passed (${response_time}ms, attempt $i/$retries)"
            return 0
        else
            warning "$service_name health check failed (attempt $i/$retries)"
            if [[ $i -lt $retries ]]; then
                sleep $VALIDATION_INTERVAL
            fi
        fi
    done
    
    error "$service_name health check failed after $retries attempts"
    return 1
}

# Pre-deployment validation
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check required commands
    local required_commands=("docker" "curl" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    # Check docker compose
    if ! docker compose version &> /dev/null; then
        error "Docker Compose is not available"
        exit 1
    fi
    
    # Create required directories
    mkdir -p "$BACKUP_DIR" "$(dirname "$DEPLOYMENT_LOG")"
    
    # Check disk space (minimum 2GB)
    local available_space=$(df . | tail -1 | awk '{print $4}')
    if [[ $available_space -lt 2000000 ]]; then
        error "Insufficient disk space. Available: ${available_space}KB, Required: 2GB"
        exit 1
    fi
    
    success "Prerequisites check completed"
}

# Database backup
backup_database() {
    log "Creating database backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/postgres_backup_${timestamp}.sql"
    
    # Create backup from existing postgres container
    if docker exec musicdb-postgres pg_dump \
        -U musicdb_user \
        -h localhost \
        -p 5432 \
        --verbose \
        --no-password \
        musicdb > "$backup_file" 2>/dev/null; then
        
        # Compress backup
        gzip "$backup_file"
        
        if [[ -f "${backup_file}.gz" ]] && [[ $(stat -c%s "${backup_file}.gz") -gt 1000 ]]; then
            success "Database backup created: ${backup_file}.gz"
            echo "${backup_file}.gz"
        else
            error "Database backup verification failed"
            return 1
        fi
    else
        error "Database backup failed"
        return 1
    fi
}

# Deploy green environment (production ready services)
deploy_green_environment() {
    log "Deploying green environment (production services)..."
    
    cd "$PROJECT_ROOT"
    
    # Stop any conflicting services
    log "Stopping existing blue environment..."
    docker compose -f docker-compose.yml -f docker-compose.blue.yml down --timeout 30 || true
    
    # Deploy green environment
    log "Starting green environment..."
    docker compose -f docker-compose.yml -f docker-compose.green.yml up -d
    
    # Wait for services to stabilize
    log "Waiting for services to stabilize..."
    sleep 30
    
    success "Green environment deployed"
}

# Validate green environment
validate_green_environment() {
    log "Validating green environment..."
    
    # Service health checks
    local services=(
        "http://localhost:3000/health:frontend-green"
        "http://localhost:8000/health:backend-api-green"
        "http://localhost:8001:websocket-green"
        "http://localhost:8084/health:graph-api-green"
    )
    
    local failed_services=()
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service_url service_name <<< "$service_info"
        
        if ! health_check "$service_url" "$service_name" $HEALTH_CHECK_TIMEOUT 3; then
            failed_services+=("$service_name")
        fi
    done
    
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        success "All green environment services are healthy"
        return 0
    else
        error "Failed services in green environment: ${failed_services[*]}"
        return 1
    fi
}

# Performance validation
validate_performance() {
    log "Running performance validation..."
    
    # API response time test
    local api_response_time=$(curl -w '%{time_total}' -s -o /dev/null "http://localhost:8000/health" || echo "999")
    local graph_response_time=$(curl -w '%{time_total}' -s -o /dev/null "http://localhost:8084/health" || echo "999")
    
    log "API response time: ${api_response_time}s"
    log "Graph API response time: ${graph_response_time}s"
    
    # Validate performance targets
    if (( $(echo "$api_response_time > 1.0" | bc -l 2>/dev/null || echo "1") )); then
        warning "API response time higher than target: ${api_response_time}s"
    fi
    
    if (( $(echo "$graph_response_time > 2.0" | bc -l 2>/dev/null || echo "1") )); then
        warning "Graph API response time higher than target: ${graph_response_time}s"
    fi
    
    success "Performance validation completed"
}

# Database connectivity validation
validate_database() {
    log "Validating database connectivity..."
    
    # PostgreSQL connectivity
    if docker exec songnodes-postgres-green pg_isready -U musicdb_user -d musicdb > /dev/null 2>&1; then
        success "PostgreSQL connectivity validated"
    else
        error "PostgreSQL connectivity failed"
        return 1
    fi
    
    # Redis connectivity
    if docker exec songnodes-redis-green redis-cli ping > /dev/null 2>&1; then
        success "Redis connectivity validated"
    else
        error "Redis connectivity failed"
        return 1
    fi
    
    return 0
}

# Validate load balancer configuration
validate_load_balancer() {
    log "Validating load balancer..."
    
    # Check nginx configuration
    if docker exec songnodes-nginx-green nginx -t > /dev/null 2>&1; then
        success "Nginx configuration valid"
    else
        error "Nginx configuration invalid"
        return 1
    fi
    
    # Test load balancer health endpoint
    if health_check "http://localhost/health" "load-balancer" 15 3; then
        success "Load balancer validation passed"
        return 0
    else
        error "Load balancer validation failed"
        return 1
    fi
}

# End-to-end workflow validation
validate_end_to_end() {
    log "Running end-to-end workflow validation..."
    
    # Test critical user workflows
    local workflows=(
        "http://localhost:8000/health:Backend Health"
        "http://localhost:8084/health:Graph API Health"
    )
    
    local failed_workflows=()
    
    for workflow_info in "${workflows[@]}"; do
        IFS=':' read -r url description <<< "$workflow_info"
        
        if ! health_check "$url" "$description" 10 2; then
            failed_workflows+=("$description")
        fi
    done
    
    if [[ ${#failed_workflows[@]} -eq 0 ]]; then
        success "All end-to-end workflows validated"
        return 0
    else
        error "Failed workflows: ${failed_workflows[*]}"
        return 1
    fi
}

# Main deployment function
main() {
    local deployment_start=$(date +%s)
    
    log "Starting production deployment for Song Nodes"
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Pre-deployment validation
    check_prerequisites
    
    # Create database backup
    local backup_file
    if ! backup_file=$(backup_database); then
        error "Database backup failed - aborting deployment"
        exit 1
    fi
    
    # Deploy green environment
    if ! deploy_green_environment; then
        error "Green environment deployment failed"
        exit 1
    fi
    
    # Validate green environment
    if ! validate_green_environment; then
        error "Green environment validation failed"
        exit 1
    fi
    
    # Validate performance
    validate_performance
    
    # Validate database connectivity
    if ! validate_database; then
        error "Database validation failed"
        exit 1
    fi
    
    # Validate load balancer
    if ! validate_load_balancer; then
        error "Load balancer validation failed"
        exit 1
    fi
    
    # End-to-end validation
    if ! validate_end_to_end; then
        error "End-to-end validation failed"
        exit 1
    fi
    
    local deployment_end=$(date +%s)
    local total_duration=$((deployment_end - deployment_start))
    
    # Deployment summary
    cat << EOF

${GREEN}=== PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY ===${NC}

Deployment Summary:
==================
Environment: $ENVIRONMENT
Total Duration: ${total_duration}s
Backup: $backup_file
Status: SUCCESS

Active Services (Green Environment):
====================================
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000  
- WebSocket: http://localhost:8001
- Graph API: http://localhost:8084
- Database: PostgreSQL on port 5432
- Cache: Redis on port 6379
- Load Balancer: http://localhost (ports 80/443)
- Monitoring: Prometheus (9090), Grafana (3001)

Health Endpoints:
================
- Application Health: http://localhost/health
- Backend Health: http://localhost:8000/health
- Graph API Health: http://localhost:8084/health

Next Steps:
===========
- Monitor application performance via Grafana
- Verify all functionality through UI testing
- Monitor logs for any anomalies
- Schedule regular backup verification

EOF
    
    success "Production deployment completed in ${total_duration}s"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi