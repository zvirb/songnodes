#!/bin/bash
# Production Monitoring Script for SongNodes
# Continuous monitoring of production services with alerting

set -euo pipefail

# Configuration
MONITOR_INTERVAL=30  # seconds
MAX_RESPONSE_TIME=2000  # milliseconds
ALERT_THRESHOLD=3  # consecutive failures before alert

# Service endpoints
FRONTEND_URL="http://localhost:3001"
API_URL="http://localhost:8084/health"
HEALTH_ENDPOINTS=(
    "frontend:$FRONTEND_URL"
    "api:$API_URL"
    "data-transformer:http://localhost:8002/health"
    "data-validator:http://localhost:8003/health"
    "scraper:http://localhost:8001/health"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters for consecutive failures
declare -A failure_counts

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[HEALTHY]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ALERT]${NC} $1"
}

# Health check function
check_service() {
    local service_name="$1"
    local endpoint="$2"
    
    local start_time=$(date +%s%3N)
    local http_code
    
    if http_code=$(curl -w "%{http_code}" -s -o /dev/null --max-time 5 "$endpoint"); then
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        
        if [ "$http_code" = "200" ]; then
            failure_counts["$service_name"]=0
            if [ $response_time -gt $MAX_RESPONSE_TIME ]; then
                warning "$service_name: SLOW response (${response_time}ms) - HTTP $http_code"
            else
                success "$service_name: OK (${response_time}ms) - HTTP $http_code"
            fi
            return 0
        else
            ((failure_counts["$service_name"]++))
            warning "$service_name: BAD response (${response_time}ms) - HTTP $http_code"
            return 1
        fi
    else
        ((failure_counts["$service_name"]++))
        error "$service_name: CONNECTION FAILED (timeout or network error)"
        return 1
    fi
}

# Container health check
check_containers() {
    log "Checking container health..."
    
    local unhealthy_containers
    unhealthy_containers=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" 2>/dev/null || echo "")
    
    if [ -n "$unhealthy_containers" ]; then
        error "Unhealthy containers detected: $unhealthy_containers"
    fi
    
    local stopped_containers
    stopped_containers=$(docker ps -a --filter "status=exited" --filter "label=songnodes" --format "{{.Names}}" 2>/dev/null || echo "")
    
    if [ -n "$stopped_containers" ]; then
        error "Stopped SongNodes containers: $stopped_containers"
    fi
}

# Database performance check
check_database_performance() {
    local db_connections
    db_connections=$(docker exec musicdb-postgres psql -U musicdb_user -d musicdb -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs || echo "0")
    
    if [ "$db_connections" -gt 80 ]; then
        warning "High database connections: $db_connections"
    fi
    
    # Check for long-running queries
    local long_queries
    long_queries=$(docker exec musicdb-postgres psql -U musicdb_user -d musicdb -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '1 minute';" 2>/dev/null | xargs || echo "0")
    
    if [ "$long_queries" -gt 0 ]; then
        warning "Long-running database queries detected: $long_queries"
    fi
}

# Memory usage check
check_memory_usage() {
    local containers=("songnodes-frontend-production" "graph-visualization-api" "musicdb-postgres" "musicdb-redis")
    
    for container in "${containers[@]}"; do
        if docker ps --format "{{.Names}}" | grep -q "^$container$"; then
            local memory_usage
            memory_usage=$(docker stats --no-stream --format "{{.MemPerc}}" "$container" 2>/dev/null | sed 's/%//' || echo "0")
            
            if (( $(echo "$memory_usage > 85" | bc -l 2>/dev/null || echo "0") )); then
                warning "$container: High memory usage ${memory_usage}%"
            fi
        fi
    done
}

# Send alert (placeholder - implement actual alerting mechanism)
send_alert() {
    local service="$1"
    local message="$2"
    
    # Log to system log
    logger -t songnodes-monitor "ALERT: $service - $message"
    
    # TODO: Implement actual alerting (email, Slack, etc.)
    echo "🚨 ALERT: $service - $message" >> "/tmp/songnodes-alerts.log"
}

# Main monitoring loop
main() {
    log "Starting SongNodes production monitoring..."
    log "Monitor interval: ${MONITOR_INTERVAL}s"
    log "Response time threshold: ${MAX_RESPONSE_TIME}ms"
    log "Alert threshold: $ALERT_THRESHOLD consecutive failures"
    
    # Initialize failure counters
    for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
        service_name="${endpoint%%:*}"
        failure_counts["$service_name"]=0
    done
    
    while true; do
        echo ""
        log "=== Health Check Cycle ===" 
        
        # Check all service endpoints
        for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
            service_name="${endpoint%%:*}"
            url="${endpoint#*:}"
            
            if ! check_service "$service_name" "$url"; then
                if [ "${failure_counts[$service_name]}" -ge $ALERT_THRESHOLD ]; then
                    send_alert "$service_name" "Service has failed $ALERT_THRESHOLD consecutive times"
                fi
            fi
        done
        
        # Additional system checks
        check_containers
        check_database_performance
        check_memory_usage
        
        # Summary
        local total_failures=0
        for service in "${!failure_counts[@]}"; do
            total_failures=$((total_failures + failure_counts["$service"]))
        done
        
        if [ $total_failures -eq 0 ]; then
            success "All services healthy - no issues detected"
        else
            warning "Issues detected - total failure count: $total_failures"
        fi
        
        sleep $MONITOR_INTERVAL
    done
}

# Handle Ctrl+C
trap 'log "Monitoring stopped by user"; exit 0' INT

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi