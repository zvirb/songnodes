#!/bin/bash
# Production Rollback Procedures
# Automated rollback for failed deployments with health validation

set -euo pipefail

# Configuration
DEPLOYMENT_LOG="${DEPLOYMENT_LOG:-/tmp/musicdb/logs/deployment.log}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/musicdb/backups}"
ROLLBACK_TIMEOUT="${ROLLBACK_TIMEOUT:-300}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-60}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Health check function
health_check() {
    local service_url=$1
    local service_name=$2
    local timeout=${3:-$HEALTH_CHECK_TIMEOUT}
    
    log "Health checking $service_name at $service_url"
    
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

# Stop blue environment
stop_blue_environment() {
    log "Stopping blue environment services..."
    
    # Stop in reverse dependency order
    docker stop nginx-proxy-blue 2>/dev/null || warning "nginx-proxy-blue was not running"
    docker stop monitoring-grafana-blue 2>/dev/null || warning "monitoring-grafana-blue was not running"
    docker stop metrics-prometheus-blue 2>/dev/null || warning "metrics-prometheus-blue was not running"
    docker stop data-transformer-blue 2>/dev/null || warning "data-transformer-blue was not running"
    docker stop scraper-orchestrator-blue 2>/dev/null || warning "scraper-orchestrator-blue was not running"
    docker stop musicdb-rabbitmq-blue 2>/dev/null || warning "musicdb-rabbitmq-blue was not running"
    docker stop musicdb-redis-blue 2>/dev/null || warning "musicdb-redis-blue was not running"
    docker stop musicdb-postgres-blue 2>/dev/null || warning "musicdb-postgres-blue was not running"
    
    success "Blue environment stopped"
}

# Start green environment (original services)
start_green_environment() {
    log "Starting green environment (original) services..."
    
    # Check if original services are already running
    local running_services=$(docker ps --format "table {{.Names}}" | grep -E "(musicdb-postgres|musicdb-redis|musicdb-rabbitmq|scraper-orchestrator|data-transformer)" | wc -l)
    
    if [[ $running_services -gt 0 ]]; then
        success "Green environment services already running: $running_services services detected"
        return 0
    fi
    
    # Start original services
    docker compose -f docker-compose.yml up -d postgres redis rabbitmq
    
    # Wait for database services
    sleep 30
    
    # Start application services
    docker compose -f docker-compose.yml up -d scraper-orchestrator data-transformer
    
    success "Green environment services started"
}

# Validate green environment
validate_green_environment() {
    log "Validating green environment health..."
    
    # Wait for services to stabilize
    sleep 30
    
    local validation_errors=0
    
    # Check database connectivity
    if ! docker exec musicdb-postgres pg_isready -U musicdb_user -d musicdb > /dev/null 2>&1; then
        error "Green PostgreSQL not ready"
        ((validation_errors++))
    fi
    
    # Check Redis connectivity
    if ! docker exec musicdb-redis redis-cli ping > /dev/null 2>&1; then
        error "Green Redis not ready"
        ((validation_errors++))
    fi
    
    # Check application services
    if ! health_check "http://localhost:8001/health" "scraper-orchestrator-green" 30; then
        ((validation_errors++))
    fi
    
    if ! health_check "http://localhost:8002/health" "data-transformer-green" 30; then
        ((validation_errors++))
    fi
    
    if [[ $validation_errors -eq 0 ]]; then
        success "Green environment validation passed"
        return 0
    else
        error "Green environment validation failed with $validation_errors errors"
        return 1
    fi
}

# Database rollback
rollback_database() {
    local backup_file=${1:-""}
    
    if [[ -z "$backup_file" ]]; then
        # Find the most recent backup
        backup_file=$(find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz" -type f -exec ls -t {} + | head -1)
        
        if [[ -z "$backup_file" ]]; then
            warning "No backup file specified and no automatic backup found"
            warning "Database rollback skipped - manual intervention may be required"
            return 0
        fi
        
        log "Using most recent backup: $backup_file"
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    log "Rolling back database to: $backup_file"
    
    # Stop application services
    docker stop scraper-orchestrator data-transformer 2>/dev/null || true
    
    # Restore database
    if [[ "$backup_file" == *.gz ]]; then
        zcat "$backup_file" | docker exec -i musicdb-postgres psql -U musicdb_user -d postgres > /dev/null 2>&1
    else
        cat "$backup_file" | docker exec -i musicdb-postgres psql -U musicdb_user -d postgres > /dev/null 2>&1
    fi
    
    # Restart application services
    docker start scraper-orchestrator data-transformer 2>/dev/null || true
    
    success "Database rollback completed"
}

# Service-specific rollback
rollback_service() {
    local service_name=$1
    local rollback_strategy=${2:-"restart"}
    
    log "Rolling back service: $service_name (strategy: $rollback_strategy)"
    
    case "$rollback_strategy" in
        "restart")
            docker restart "$service_name"
            ;;
        "recreate")
            docker stop "$service_name" 2>/dev/null || true
            docker rm "$service_name" 2>/dev/null || true
            docker compose -f docker-compose.yml up -d "${service_name#*-}"
            ;;
        "revert")
            # This would involve pulling previous image versions
            warning "Image revert not implemented - using restart strategy"
            docker restart "$service_name"
            ;;
    esac
    
    success "Service $service_name rollback completed"
}

# Network rollback
rollback_networking() {
    log "Rolling back networking configuration..."
    
    # Reset to original port mappings and configurations
    # This is handled by stopping blue environment and starting green
    
    success "Network rollback completed"
}

# Cleanup blue environment resources
cleanup_blue_environment() {
    log "Cleaning up blue environment resources..."
    
    # Remove containers
    docker rm nginx-proxy-blue monitoring-grafana-blue metrics-prometheus-blue \
               data-transformer-blue scraper-orchestrator-blue \
               musicdb-rabbitmq-blue musicdb-redis-blue musicdb-postgres-blue 2>/dev/null || true
    
    # Remove volumes (optional - preserves data)
    # docker volume rm songnodes_postgres_blue_data songnodes_redis_blue_data \
    #                 songnodes_rabbitmq_blue_data songnodes_prometheus_blue_data \
    #                 songnodes_grafana_blue_data 2>/dev/null || true
    
    # Remove networks
    docker network rm songnodes_musicdb-backend-blue \
                      songnodes_musicdb-frontend-blue \
                      songnodes_musicdb-monitoring-blue 2>/dev/null || true
    
    success "Blue environment cleanup completed"
}

# Full system rollback
full_system_rollback() {
    local backup_file=${1:-""}
    
    log "Initiating full system rollback..."
    
    # Step 1: Stop blue environment
    stop_blue_environment
    
    # Step 2: Start green environment
    start_green_environment
    
    # Step 3: Rollback database if needed
    if [[ -n "$backup_file" ]]; then
        rollback_database "$backup_file"
    fi
    
    # Step 4: Validate green environment
    if validate_green_environment; then
        success "Green environment validation passed"
    else
        error "Green environment validation failed - manual intervention required"
        return 1
    fi
    
    # Step 5: Cleanup blue environment (optional)
    # cleanup_blue_environment
    
    success "Full system rollback completed successfully"
}

# Partial rollback for specific components
partial_rollback() {
    local component=$1
    local strategy=${2:-"restart"}
    
    log "Initiating partial rollback for component: $component"
    
    case "$component" in
        "database")
            rollback_database
            ;;
        "application")
            rollback_service "scraper-orchestrator" "$strategy"
            rollback_service "data-transformer" "$strategy"
            ;;
        "monitoring")
            rollback_service "metrics-prometheus-blue" "$strategy"
            rollback_service "monitoring-grafana-blue" "$strategy"
            ;;
        "networking")
            rollback_networking
            ;;
        *)
            error "Unknown component: $component"
            echo "Available components: database, application, monitoring, networking"
            return 1
            ;;
    esac
    
    success "Partial rollback for $component completed"
}

# Emergency rollback (fastest possible)
emergency_rollback() {
    log "EMERGENCY ROLLBACK INITIATED"
    warning "This will forcefully stop all blue environment services"
    
    # Force stop all blue services
    docker stop $(docker ps -q --filter "name=blue") 2>/dev/null || true
    
    # Ensure green services are running
    docker compose -f docker-compose.yml up -d
    
    # Quick health check
    sleep 10
    if health_check "http://localhost:8001/health" "scraper-orchestrator" 30 && \
       health_check "http://localhost:8002/health" "data-transformer" 30; then
        success "Emergency rollback completed - services restored"
    else
        error "Emergency rollback failed - manual intervention required"
        return 1
    fi
}

# Rollback status check
check_rollback_status() {
    log "Checking rollback status..."
    
    # Check which environment is active
    local blue_services=$(docker ps --filter "name=blue" --format "{{.Names}}" | wc -l)
    local green_services=$(docker ps --filter "name=musicdb" --format "{{.Names}}" | grep -v blue | wc -l)
    
    cat << EOF

Rollback Status Report
=====================
Blue Environment Services: $blue_services running
Green Environment Services: $green_services running
Timestamp: $(date)

Active Services:
$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")

Environment Health:
$(curl -s http://localhost:8001/health 2>/dev/null | jq . || echo "Green scraper: Not accessible")
$(curl -s http://localhost:8002/health 2>/dev/null | jq . || echo "Green transformer: Not accessible")

EOF
}

# Main function
main() {
    local action=${1:-"full"}
    local component=${2:-""}
    local backup_file=${3:-""}
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$DEPLOYMENT_LOG")"
    
    case "$action" in
        "full")
            full_system_rollback "$backup_file"
            ;;
        "partial")
            if [[ -z "$component" ]]; then
                error "Component required for partial rollback"
                echo "Usage: $0 partial <component> [strategy]"
                echo "Components: database, application, monitoring, networking"
                exit 1
            fi
            partial_rollback "$component" "${3:-restart}"
            ;;
        "emergency")
            emergency_rollback
            ;;
        "status")
            check_rollback_status
            ;;
        "cleanup")
            cleanup_blue_environment
            ;;
        *)
            cat << EOF
Usage: $0 {full|partial|emergency|status|cleanup}

Commands:
  full [backup_file]           # Complete system rollback to green environment
  partial <component> [strategy] # Rollback specific component
  emergency                    # Emergency rollback (fastest)
  status                      # Check rollback status
  cleanup                     # Cleanup blue environment resources

Examples:
  $0 full                                    # Full rollback to green
  $0 full /path/to/backup.sql.gz           # Full rollback with database restore
  $0 partial application restart            # Restart application services
  $0 emergency                              # Emergency rollback
  $0 status                                 # Check current status

EOF
            exit 1
            ;;
    esac
}

# Trap for emergency rollback on script interruption
trap 'warning "Rollback script interrupted - consider running emergency rollback"; exit 1' INT TERM

# Execute main function
main "$@"