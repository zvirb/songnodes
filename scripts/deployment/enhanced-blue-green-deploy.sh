#!/bin/bash
# Enhanced Blue-Green Deployment Script for Song Nodes
# Zero-downtime deployment with <30s switchover and automated rollback

set -euo pipefail

# Configuration
ENVIRONMENT=${1:-production}
DEPLOYMENT_MODE=${2:-blue-green}
BACKUP_DIR="/opt/songnodes/backups"
DEPLOYMENT_LOG="/opt/songnodes/logs/deployment.log"
HEALTH_CHECK_TIMEOUT=30
ROLLBACK_TIMEOUT=15
SWITCHOVER_TIMEOUT=30
VALIDATION_RETRIES=5
VALIDATION_INTERVAL=5

# Service endpoints
GREEN_HEALTH_URL="http://localhost:8000/health"
BLUE_HEALTH_URL="http://localhost:8100/health"
HEALTH_MONITOR_URL="http://localhost:8085/health"

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

# Deployment state tracking
DEPLOYMENT_STATE="/tmp/deployment_state.json"

save_deployment_state() {
    local state="$1"
    local details="$2"
    cat > "$DEPLOYMENT_STATE" << EOF
{
  "state": "$state",
  "timestamp": "$(date -Iseconds)",
  "details": "$details",
  "environment": "$ENVIRONMENT",
  "mode": "$DEPLOYMENT_MODE"
}
EOF
}

get_deployment_state() {
    if [[ -f "$DEPLOYMENT_STATE" ]]; then
        cat "$DEPLOYMENT_STATE" | jq -r '.state' 2>/dev/null || echo "unknown"
    else
        echo "not_started"
    fi
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

# Comprehensive health validation
comprehensive_health_check() {
    local environment="$1"
    local base_port="$2"
    
    log "Running comprehensive health check for $environment environment"
    
    local services=(
        "frontend:${base_port}:http://localhost:${base_port}/health"
        "backend-api:$((base_port + 1)):http://localhost:$((base_port + 1))/health"
        "websocket:$((base_port + 2)):http://localhost:$((base_port + 2))/health"
        "graph-api:$((base_port + 3)):http://localhost:$((base_port + 3))/health"
        "health-monitor:8085:http://localhost:8085/health/ready"
    )
    
    local failed_services=()
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service_name service_port service_url <<< "$service_info"
        
        if ! health_check "$service_url" "$service_name" $HEALTH_CHECK_TIMEOUT 3; then
            failed_services+=("$service_name")
        fi
    done
    
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        success "All services in $environment environment are healthy"
        return 0
    else
        error "Failed services in $environment environment: ${failed_services[*]}"
        return 1
    fi
}

# Database backup with compression and retention
backup_database() {
    log "Creating compressed database backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/postgres_backup_${timestamp}.sql"
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Create backup with connection timeout
    if timeout 300 docker exec songnodes-postgres-green pg_dump \
        -U musicdb_user \
        -h localhost \
        -p 5432 \
        --verbose \
        --no-password \
        --format=custom \
        --compress=9 \
        musicdb > "$backup_file" 2>/dev/null; then
        
        # Compress backup
        gzip "$backup_file"
        
        # Verify backup integrity
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
    
    # Cleanup old backups (keep last 10)
    find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz" -type f | \
        sort | head -n -10 | xargs -r rm -f
}

# Pre-deployment validation
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check required commands
    local required_commands=("docker" "docker-compose" "curl" "jq" "timeout")
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
    
    # Check required files
    local required_files=(
        "docker-compose.yml"
        "docker-compose.green.yml"
        "docker-compose.blue.yml"
        "nginx/conf.d/blue-production.conf"
        "nginx/conf.d/green-production.conf"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Required file not found: $file"
            exit 1
        fi
    done
    
    # Create required directories
    mkdir -p "$BACKUP_DIR" "$(dirname "$DEPLOYMENT_LOG")"
    
    # Check disk space (minimum 5GB)
    local available_space=$(df . | tail -1 | awk '{print $4}')
    if [[ $available_space -lt 5000000 ]]; then
        error "Insufficient disk space. Available: ${available_space}KB, Required: 5GB"
        exit 1
    fi
    
    success "Prerequisites check completed"
}

# Deploy blue environment with optimized startup
deploy_blue_environment() {
    log "Deploying services to blue environment..."
    save_deployment_state "deploying_blue" "Starting blue environment deployment"
    
    # Pre-pull images to reduce startup time
    log "Pre-pulling Docker images..."
    docker-compose -f docker-compose.yml -f docker-compose.blue.yml pull --quiet
    
    # Start core services first (database, cache)
    log "Starting core services..."
    docker-compose -f docker-compose.yml -f docker-compose.blue.yml up -d \
        postgres-blue redis-blue
    
    # Wait for core services
    sleep 10
    
    # Start application services
    log "Starting application services..."
    docker-compose -f docker-compose.yml -f docker-compose.blue.yml up -d \
        backend-api-blue websocket-service-blue graph-visualization-api-blue
    
    # Start frontend and load balancer
    log "Starting frontend and load balancer..."
    docker-compose -f docker-compose.yml -f docker-compose.blue.yml up -d \
        frontend-blue health-monitor-blue
    
    # Start monitoring services
    log "Starting monitoring services..."
    docker-compose -f docker-compose.yml -f docker-compose.blue.yml up -d \
        prometheus-blue grafana-blue alertmanager-blue
    
    success "Blue environment deployed"
}

# Validate blue environment with performance checks
validate_blue_environment() {
    log "Validating blue environment..."
    save_deployment_state "validating_blue" "Validating blue environment health"
    
    # Wait for services to stabilize
    log "Waiting for services to stabilize..."
    sleep 20
    
    # Comprehensive health check
    if ! comprehensive_health_check "blue" 8100; then
        error "Blue environment health validation failed"
        return 1
    fi
    
    # Performance validation
    log "Running performance validation..."
    local api_response_time=$(curl -w '%{time_total}' -s -o /dev/null "http://localhost:8101/health" || echo "999")
    local graph_response_time=$(curl -w '%{time_total}' -s -o /dev/null "http://localhost:8103/health" || echo "999")
    
    if (( $(echo "$api_response_time > 0.5" | bc -l) )); then
        warning "API response time higher than expected: ${api_response_time}s"
    fi
    
    if (( $(echo "$graph_response_time > 1.0" | bc -l) )); then
        warning "Graph API response time higher than expected: ${graph_response_time}s"
    fi
    
    # Database connectivity test
    if ! docker exec songnodes-postgres-blue pg_isready -U musicdb_user -d musicdb > /dev/null 2>&1; then
        error "Blue environment database not ready"
        return 1
    fi
    
    # Redis connectivity test
    if ! docker exec songnodes-redis-blue redis-cli ping > /dev/null 2>&1; then
        error "Blue environment Redis not ready"
        return 1
    fi
    
    success "Blue environment validation completed"
    return 0
}

# Fast traffic switchover with validation
switch_to_blue() {
    log "Initiating traffic switchover to blue environment..."
    save_deployment_state "switching_traffic" "Switching traffic to blue environment"
    
    local switch_start=$(date +%s)
    
    # Update Nginx configuration atomically
    log "Updating Nginx configuration..."
    
    # Copy blue configuration to active
    if docker cp nginx/conf.d/blue-production.conf songnodes-nginx-green:/etc/nginx/conf.d/default.conf; then
        # Test Nginx configuration
        if docker exec songnodes-nginx-green nginx -t > /dev/null 2>&1; then
            # Reload Nginx (graceful)
            docker exec songnodes-nginx-green nginx -s reload
            
            # Verify switch completed
            sleep 5
            
            local switch_end=$(date +%s)
            local switch_duration=$((switch_end - switch_start))
            
            success "Traffic switched to blue environment in ${switch_duration}s"
            
            # Validate traffic is flowing to blue
            if health_check "http://localhost/health" "load-balancer" 10 2; then
                success "Traffic switchover validation passed"
                return 0
            else
                error "Traffic switchover validation failed"
                return 1
            fi
        else
            error "Nginx configuration test failed"
            return 1
        fi
    else
        error "Failed to update Nginx configuration"
        return 1
    fi
}

# Automated rollback with state recovery
automated_rollback() {
    error "Initiating automated rollback to green environment..."
    save_deployment_state "rolling_back" "Automated rollback in progress"
    
    local rollback_start=$(date +%s)
    
    # Restore Nginx configuration to green
    log "Restoring Nginx configuration to green..."
    if docker cp nginx/conf.d/green-production.conf songnodes-nginx-green:/etc/nginx/conf.d/default.conf; then
        docker exec songnodes-nginx-green nginx -s reload
    fi
    
    # Ensure green environment is healthy
    log "Verifying green environment health..."
    if ! comprehensive_health_check "green" 8000; then
        error "Green environment is not healthy - manual intervention required"
        save_deployment_state "rollback_failed" "Green environment unhealthy during rollback"
        return 1
    fi
    
    # Stop blue environment to free resources
    log "Stopping blue environment..."
    docker-compose -f docker-compose.yml -f docker-compose.blue.yml down --timeout 30
    
    local rollback_end=$(date +%s)
    local rollback_duration=$((rollback_end - rollback_start))
    
    success "Rollback completed in ${rollback_duration}s"
    save_deployment_state "rollback_completed" "Rollback to green environment successful"
    return 0
}

# Production validation with end-to-end tests
validate_production() {
    log "Running production validation..."
    save_deployment_state "validating_production" "Production environment validation"
    
    local validation_errors=0
    local start_time=$(date +%s)
    
    # Test critical endpoints
    local critical_endpoints=(
        "http://localhost/health:load-balancer"
        "http://localhost/api/health:backend-api"
        "http://localhost:8085/health:health-monitor"
    )
    
    for endpoint_info in "${critical_endpoints[@]}"; do
        IFS=':' read -r url service <<< "$endpoint_info"
        if ! health_check "$url" "$service" 15 3; then
            ((validation_errors++))
        fi
    done
    
    # Test database functionality
    log "Testing database functionality..."
    if ! docker exec songnodes-postgres-blue psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM pg_stat_activity;" > /dev/null 2>&1; then
        error "Database functionality test failed"
        ((validation_errors++))
    fi
    
    # Test Redis functionality
    log "Testing Redis functionality..."
    if ! docker exec songnodes-redis-blue redis-cli set test_key "test_value" > /dev/null 2>&1; then
        error "Redis functionality test failed"
        ((validation_errors++))
    fi
    
    # Performance baseline check
    log "Running performance baseline check..."
    local api_perf=$(curl -w '%{time_total}' -s -o /dev/null "http://localhost/api/health" || echo "999")
    if (( $(echo "$api_perf > 1.0" | bc -l) )); then
        warning "API performance below baseline: ${api_perf}s"
        ((validation_errors++))
    fi
    
    local end_time=$(date +%s)
    local validation_duration=$((end_time - start_time))
    
    if [[ $validation_errors -eq 0 ]]; then
        success "Production validation passed in ${validation_duration}s"
        return 0
    else
        error "Production validation failed with $validation_errors errors in ${validation_duration}s"
        return 1
    fi
}

# Cleanup green environment after successful deployment
cleanup_green() {
    log "Cleaning up green environment..."
    
    # Graceful shutdown with timeout
    log "Stopping green environment services..."
    docker-compose -f docker-compose.yml -f docker-compose.green.yml down --timeout 30
    
    # Remove unused images and volumes
    log "Cleaning up unused Docker resources..."
    docker system prune -f --volumes
    
    success "Green environment cleanup completed"
}

# Deployment monitoring and alerting
monitor_deployment() {
    local deployment_start="$1"
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - deployment_start))
        
        # Check if deployment is taking too long (30 minutes max)
        if [[ $elapsed -gt 1800 ]]; then
            error "Deployment timeout reached (30 minutes) - initiating rollback"
            automated_rollback
            exit 1
        fi
        
        local state=$(get_deployment_state)
        case "$state" in
            "completed")
                info "Deployment monitoring completed"
                break
                ;;
            "rollback_completed"|"rollback_failed")
                info "Deployment monitoring stopped due to rollback"
                break
                ;;
        esac
        
        sleep 30
    done
}

# Main deployment orchestration
main() {
    local deployment_start=$(date +%s)
    
    log "Starting enhanced blue-green deployment for $ENVIRONMENT"
    save_deployment_state "started" "Deployment initiated"
    
    # Start deployment monitoring in background
    monitor_deployment "$deployment_start" &
    local monitor_pid=$!
    
    # Trap for cleanup on interruption
    trap 'kill $monitor_pid 2>/dev/null; automated_rollback; exit 1' INT TERM
    
    # Pre-deployment validation
    check_prerequisites
    
    # Create database backup
    local backup_file
    if ! backup_file=$(backup_database); then
        error "Database backup failed - aborting deployment"
        exit 1
    fi
    
    # Deploy blue environment
    if ! deploy_blue_environment; then
        error "Blue environment deployment failed"
        exit 1
    fi
    
    # Validate blue environment
    if ! validate_blue_environment; then
        error "Blue environment validation failed - cleaning up"
        docker-compose -f docker-compose.yml -f docker-compose.blue.yml down
        exit 1
    fi
    
    # Switch traffic to blue
    if ! switch_to_blue; then
        error "Traffic switchover failed - initiating rollback"
        automated_rollback
        exit 1
    fi
    
    # Final production validation
    if ! validate_production; then
        error "Production validation failed - initiating rollback"
        automated_rollback
        exit 1
    fi
    
    # Cleanup green environment
    cleanup_green
    
    # Stop monitoring
    kill $monitor_pid 2>/dev/null || true
    
    local deployment_end=$(date +%s)
    local total_duration=$((deployment_end - deployment_start))
    
    save_deployment_state "completed" "Deployment completed successfully"
    
    # Deployment summary
    cat << EOF

${GREEN}=== DEPLOYMENT COMPLETED SUCCESSFULLY ===${NC}

Deployment Summary:
==================
Environment: $ENVIRONMENT
Mode: $DEPLOYMENT_MODE
Total Duration: ${total_duration}s
Backup: $backup_file
Status: SUCCESS

Active Services (Blue Environment):
- Frontend: http://localhost:3100
- Backend API: http://localhost:8101
- WebSocket: http://localhost:8102
- Graph API: http://localhost:8103
- Health Monitor: http://localhost:8085
- Prometheus: http://localhost:9091
- Grafana: http://localhost:3101

Production URLs:
- Application: https://songnodes.com
- Health Check: https://songnodes.com/health
- Monitoring: https://monitoring.songnodes.com
- Metrics: https://metrics.songnodes.com

Next Steps:
- Monitor application performance
- Verify all functionality
- Schedule backup verification

EOF
    
    success "Enhanced blue-green deployment completed in ${total_duration}s"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi