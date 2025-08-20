#!/bin/bash
# Production Deployment Validation Script
# Comprehensive validation with evidence collection for blue-green deployment

set -euo pipefail

# Configuration
VALIDATION_LOG="/tmp/musicdb/logs/production-validation.log"
EVIDENCE_DIR="/tmp/musicdb/evidence"
VALIDATION_TIMEOUT=300
HEALTH_CHECK_INTERVAL=5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$VALIDATION_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$VALIDATION_LOG"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$VALIDATION_LOG"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$VALIDATION_LOG"
}

# Initialize validation
init_validation() {
    log "Initializing production deployment validation..."
    
    # Create directories
    mkdir -p "$(dirname "$VALIDATION_LOG")" "$EVIDENCE_DIR"
    
    # Clear previous evidence
    rm -f "$EVIDENCE_DIR"/*
    
    success "Validation environment initialized"
}

# Service health validation
validate_service_health() {
    local service_name=$1
    local service_url=$2
    local expected_response=${3:-"healthy"}
    
    log "Validating $service_name health at $service_url"
    
    # Collect evidence
    local evidence_file="$EVIDENCE_DIR/${service_name}_health.json"
    
    # Test connectivity and response
    local response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" "$service_url" 2>/dev/null || echo "FAILED")
    
    if [[ "$response" == *"HTTPSTATUS:200"* ]] && [[ "$response" == *"$expected_response"* ]]; then
        # Extract response body and timing
        local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]+;TIME:[0-9.]+//')
        local http_code=$(echo "$response" | sed -E 's/.*HTTPSTATUS:([0-9]+);.*/\1/')
        local response_time=$(echo "$response" | sed -E 's/.*TIME:([0-9.]+)/\1/')
        
        # Save evidence
        cat > "$evidence_file" << EOF
{
  "service": "$service_name",
  "url": "$service_url",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "healthy",
  "http_code": $http_code,
  "response_time": $response_time,
  "response_body": $body
}
EOF
        
        success "$service_name health validation passed (${response_time}s)"
        return 0
    else
        # Save failure evidence
        cat > "$evidence_file" << EOF
{
  "service": "$service_name",
  "url": "$service_url",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "unhealthy",
  "error": "$response"
}
EOF
        
        error "$service_name health validation failed"
        return 1
    fi
}

# Database connectivity validation
validate_database_connectivity() {
    log "Validating database connectivity and performance..."
    
    local evidence_file="$EVIDENCE_DIR/database_validation.json"
    local validation_errors=0
    
    # Test PostgreSQL connectivity
    local pg_status=$(docker exec musicdb-postgres-blue pg_isready -U musicdb_user -d musicdb 2>&1 || echo "FAILED")
    
    # Test basic queries
    local query_result=$(docker exec musicdb-postgres-blue psql -U musicdb_user -d musicdb -c "SELECT version(), current_timestamp, current_database();" 2>/dev/null || echo "QUERY_FAILED")
    
    # Test Redis connectivity
    local redis_status=$(docker exec musicdb-redis-blue redis-cli ping 2>/dev/null || echo "FAILED")
    local redis_info=$(docker exec musicdb-redis-blue redis-cli info server 2>/dev/null || echo "INFO_FAILED")
    
    # Performance test
    local start_time=$(date +%s.%N)
    docker exec musicdb-postgres-blue psql -U musicdb_user -d musicdb -c "SELECT count(*) FROM information_schema.tables;" > /dev/null 2>&1
    local end_time=$(date +%s.%N)
    local query_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    # Create evidence
    cat > "$evidence_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "postgresql": {
    "status": "$pg_status",
    "query_test": "$(echo "$query_result" | head -1)",
    "query_performance": "$query_time"
  },
  "redis": {
    "status": "$redis_status",
    "server_info": "$(echo "$redis_info" | grep redis_version || echo "unknown")"
  }
}
EOF
    
    if [[ "$pg_status" == *"accepting connections"* ]] && [[ "$redis_status" == "PONG" ]]; then
        success "Database connectivity validation passed"
        return 0
    else
        error "Database connectivity validation failed"
        return 1
    fi
}

# Network and port validation
validate_networking() {
    log "Validating network configuration and port accessibility..."
    
    local evidence_file="$EVIDENCE_DIR/network_validation.json"
    local network_errors=0
    
    # Test service ports
    local services=(
        "5434:PostgreSQL"
        "6381:Redis" 
        "5674:RabbitMQ"
        "8101:Scraper-Orchestrator"
        "8102:Data-Transformer"
        "9092:Prometheus"
        "3006:Grafana"
    )
    
    local port_results=""
    for service in "${services[@]}"; do
        IFS=':' read -r port name <<< "$service"
        
        if nc -z localhost "$port" 2>/dev/null; then
            port_results+="{\"port\": $port, \"service\": \"$name\", \"status\": \"open\"},"
            success "Port $port ($name) is accessible"
        else
            port_results+="{\"port\": $port, \"service\": \"$name\", \"status\": \"closed\"},"
            warning "Port $port ($name) is not accessible"
            ((network_errors++))
        fi
    done
    
    # Remove trailing comma
    port_results=${port_results%,}
    
    # Test DNS resolution
    local dns_test=$(nslookup localhost 2>/dev/null || echo "DNS_FAILED")
    
    # Create evidence
    cat > "$evidence_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "port_tests": [$port_results],
  "dns_resolution": "$(echo "$dns_test" | head -2 | tail -1 || echo "unknown")",
  "network_errors": $network_errors
}
EOF
    
    if [[ $network_errors -eq 0 ]]; then
        success "Network validation passed"
        return 0
    else
        warning "Network validation completed with $network_errors issues"
        return 1
    fi
}

# Security validation
validate_security() {
    log "Validating security configuration..."
    
    local evidence_file="$EVIDENCE_DIR/security_validation.json"
    local security_issues=0
    
    # SSL Certificate validation
    local ssl_check=""
    if [[ -f "/home/marku/Documents/programming/songnodes/nginx/ssl/musicdb.crt" ]]; then
        ssl_check=$(openssl x509 -in "/home/marku/Documents/programming/songnodes/nginx/ssl/musicdb.crt" -text -noout | grep -E "Not After|Subject:" || echo "SSL_CHECK_FAILED")
    else
        ssl_check="Certificate file not found"
        ((security_issues++))
    fi
    
    # Container security scan
    local running_containers=$(docker ps --format "table {{.Names}}\t{{.Image}}" | grep -E "blue|musicdb")
    
    # Check for non-root users in containers
    local container_users=""
    for container in $(docker ps --filter "name=blue" --format "{{.Names}}"); do
        local user_check=$(docker exec "$container" whoami 2>/dev/null || echo "unknown")
        container_users+="{\"container\": \"$container\", \"user\": \"$user_check\"},"
    done
    container_users=${container_users%,}
    
    # Environment variable security check
    local env_check=""
    if docker exec musicdb-postgres-blue env | grep -q "POSTGRES_PASSWORD" 2>/dev/null; then
        env_check="Environment variables properly configured"
    else
        env_check="Environment variable check failed"
        ((security_issues++))
    fi
    
    # Create evidence
    cat > "$evidence_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "ssl_certificate": "$ssl_check",
  "container_users": [$container_users],
  "environment_variables": "$env_check",
  "running_containers": "$(echo "$running_containers" | wc -l)",
  "security_issues": $security_issues
}
EOF
    
    if [[ $security_issues -eq 0 ]]; then
        success "Security validation passed"
        return 0
    else
        warning "Security validation completed with $security_issues issues"
        return 1
    fi
}

# Performance validation
validate_performance() {
    log "Validating system performance..."
    
    local evidence_file="$EVIDENCE_DIR/performance_validation.json"
    
    # System resource usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    local memory_usage=$(free | grep Mem | awk '{printf "%.1f", ($3/$2) * 100.0}')
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | cut -d'%' -f1)
    
    # Docker resource usage
    local docker_stats=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -E "blue|musicdb")
    
    # Database performance
    local db_connections=$(docker exec musicdb-postgres-blue psql -U musicdb_user -d musicdb -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | grep -E "^[0-9]+$" || echo "0")
    
    # Response time tests
    local start_time=$(date +%s.%N)
    curl -s http://localhost:8101/health > /dev/null 2>&1
    local end_time=$(date +%s.%N)
    local scraper_response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    start_time=$(date +%s.%N)
    curl -s http://localhost:8102/health > /dev/null 2>&1
    end_time=$(date +%s.%N)
    local transformer_response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    # Create evidence
    cat > "$evidence_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "system_resources": {
    "cpu_usage": "$cpu_usage%",
    "memory_usage": "$memory_usage%",
    "disk_usage": "$disk_usage%"
  },
  "database": {
    "active_connections": $db_connections
  },
  "response_times": {
    "scraper_orchestrator": "$scraper_response_time",
    "data_transformer": "$transformer_response_time"
  },
  "docker_stats": "$(echo "$docker_stats" | wc -l) containers monitored"
}
EOF
    
    success "Performance validation completed"
    log "CPU: ${cpu_usage}%, Memory: ${memory_usage}%, Disk: ${disk_usage}%"
    log "Response times - Scraper: ${scraper_response_time}s, Transformer: ${transformer_response_time}s"
    
    return 0
}

# Load testing
validate_load_capacity() {
    log "Validating load capacity (light load test)..."
    
    local evidence_file="$EVIDENCE_DIR/load_test_validation.json"
    
    # Simple concurrent request test
    local concurrent_requests=10
    local total_requests=100
    
    log "Running light load test: $total_requests requests, $concurrent_requests concurrent"
    
    # Test scraper orchestrator
    local start_time=$(date +%s)
    for i in $(seq 1 $concurrent_requests); do
        (
            for j in $(seq 1 $((total_requests / concurrent_requests))); do
                curl -s http://localhost:8101/health > /dev/null 2>&1
            done
        ) &
    done
    wait
    local end_time=$(date +%s)
    local test_duration=$((end_time - start_time))
    
    # Calculate throughput
    local throughput=$(echo "scale=2; $total_requests / $test_duration" | bc -l 2>/dev/null || echo "0")
    
    # Check if services are still healthy after load test
    local post_test_health="healthy"
    if ! curl -sf http://localhost:8101/health > /dev/null 2>&1 || \
       ! curl -sf http://localhost:8102/health > /dev/null 2>&1; then
        post_test_health="degraded"
    fi
    
    # Create evidence
    cat > "$evidence_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "load_test": {
    "total_requests": $total_requests,
    "concurrent_requests": $concurrent_requests,
    "duration_seconds": $test_duration,
    "throughput_rps": "$throughput",
    "post_test_health": "$post_test_health"
  }
}
EOF
    
    if [[ "$post_test_health" == "healthy" ]]; then
        success "Load capacity validation passed (${throughput} req/s)"
        return 0
    else
        error "Load capacity validation failed - services degraded"
        return 1
    fi
}

# Backup validation
validate_backup_system() {
    log "Validating backup system..."
    
    local evidence_file="$EVIDENCE_DIR/backup_validation.json"
    
    # Test backup creation
    local backup_result=$(BACKUP_DIR="/tmp/musicdb/backups" LOG_FILE="/tmp/musicdb/logs/backup-test.log" \
                         DB_CONTAINER="musicdb-postgres-blue" \
                         /home/marku/Documents/programming/songnodes/scripts/deployment/backup-procedures.sh full 2>&1 || echo "BACKUP_FAILED")
    
    # Check if backup files exist
    local backup_files=$(find /tmp/musicdb/backups -name "*.sql.gz" -o -name "*.dump" -type f -mtime -1 | wc -l)
    
    # Create evidence
    cat > "$evidence_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backup_test": {
    "status": "$(echo "$backup_result" | grep -q "SUCCESS" && echo "passed" || echo "failed")",
    "backup_files_created": $backup_files,
    "backup_directory": "/tmp/musicdb/backups"
  }
}
EOF
    
    if [[ $backup_files -gt 0 ]]; then
        success "Backup system validation passed ($backup_files files created)"
        return 0
    else
        error "Backup system validation failed"
        return 1
    fi
}

# Generate validation report
generate_validation_report() {
    log "Generating comprehensive validation report..."
    
    local report_file="$EVIDENCE_DIR/production_validation_report.json"
    local summary_file="$EVIDENCE_DIR/validation_summary.txt"
    
    # Collect all evidence files
    local evidence_files=$(find "$EVIDENCE_DIR" -name "*.json" -not -name "*report*" -type f)
    
    # Create comprehensive report
    cat > "$report_file" << EOF
{
  "validation_report": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "blue",
    "deployment_type": "blue-green",
    "validation_status": "$(if [[ -f "$EVIDENCE_DIR/validation_success" ]]; then echo "PASSED"; else echo "FAILED"; fi)",
    "evidence_files": [
$(for file in $evidence_files; do echo "      \"$(basename "$file")\","; done | sed '$ s/,$//')
    ]
  }
}
EOF
    
    # Create human-readable summary
    cat > "$summary_file" << EOF
Production Deployment Validation Summary
========================================
Generated: $(date)
Environment: Blue (Production)
Deployment Type: Blue-Green

VALIDATION RESULTS:
==================

Service Health:
$(if [[ -f "$EVIDENCE_DIR/scraper-orchestrator_health.json" ]]; then echo "✓ Scraper Orchestrator: HEALTHY"; else echo "✗ Scraper Orchestrator: FAILED"; fi)
$(if [[ -f "$EVIDENCE_DIR/data-transformer_health.json" ]]; then echo "✓ Data Transformer: HEALTHY"; else echo "✗ Data Transformer: FAILED"; fi)

Infrastructure:
$(if grep -q '"status": "healthy"' "$EVIDENCE_DIR/database_validation.json" 2>/dev/null; then echo "✓ Database: HEALTHY"; else echo "✗ Database: FAILED"; fi)
$(if grep -q '"network_errors": 0' "$EVIDENCE_DIR/network_validation.json" 2>/dev/null; then echo "✓ Network: HEALTHY"; else echo "✗ Network: ISSUES DETECTED"; fi)

Security:
$(if grep -q '"security_issues": 0' "$EVIDENCE_DIR/security_validation.json" 2>/dev/null; then echo "✓ Security: PASSED"; else echo "✗ Security: ISSUES DETECTED"; fi)

Performance:
$(if [[ -f "$EVIDENCE_DIR/performance_validation.json" ]]; then echo "✓ Performance: TESTED"; else echo "✗ Performance: NOT TESTED"; fi)
$(if grep -q '"post_test_health": "healthy"' "$EVIDENCE_DIR/load_test_validation.json" 2>/dev/null; then echo "✓ Load Test: PASSED"; else echo "✗ Load Test: FAILED"; fi)

Backup System:
$(if grep -q '"status": "passed"' "$EVIDENCE_DIR/backup_validation.json" 2>/dev/null; then echo "✓ Backup: FUNCTIONAL"; else echo "✗ Backup: FAILED"; fi)

EVIDENCE FILES:
===============
$(ls -la "$EVIDENCE_DIR"/*.json 2>/dev/null | awk '{print $9, $5"B", $6, $7, $8}' || echo "No evidence files generated")

RECOMMENDATIONS:
================
$(if [[ ! -f "$EVIDENCE_DIR/validation_success" ]]; then
cat << 'RECOM'
⚠️  DEPLOYMENT NOT READY FOR PRODUCTION
   - Review failed validation tests
   - Address identified issues
   - Re-run validation before proceeding

🔄 ROLLBACK PROCEDURES:
   - Run: ./scripts/deployment/rollback-procedures.sh full
   - Monitor green environment health
   - Investigate blue environment issues
RECOM
else
cat << 'RECOM'
✅ DEPLOYMENT READY FOR PRODUCTION
   - All critical validations passed
   - Blue environment is operational
   - Monitoring and backup systems functional

🚀 NEXT STEPS:
   - Complete traffic migration to blue environment
   - Monitor production metrics
   - Schedule green environment cleanup
RECOM
fi)

EOF
    
    success "Validation report generated: $report_file"
    success "Summary report generated: $summary_file"
    
    # Display summary
    cat "$summary_file"
}

# Main validation function
main() {
    local validation_type=${1:-"full"}
    
    init_validation
    
    local validation_errors=0
    
    case "$validation_type" in
        "full")
            log "Starting full production validation..."
            
            # Core service validation
            validate_service_health "scraper-orchestrator" "http://localhost:8101/health" "healthy" || ((validation_errors++))
            validate_service_health "data-transformer" "http://localhost:8102/health" "healthy" || ((validation_errors++))
            
            # Infrastructure validation
            validate_database_connectivity || ((validation_errors++))
            validate_networking || ((validation_errors++))
            
            # Security validation
            validate_security || ((validation_errors++))
            
            # Performance validation
            validate_performance || ((validation_errors++))
            validate_load_capacity || ((validation_errors++))
            
            # Backup system validation
            validate_backup_system || ((validation_errors++))
            ;;
        "health")
            validate_service_health "scraper-orchestrator" "http://localhost:8101/health" "healthy" || ((validation_errors++))
            validate_service_health "data-transformer" "http://localhost:8102/health" "healthy" || ((validation_errors++))
            ;;
        "infrastructure")
            validate_database_connectivity || ((validation_errors++))
            validate_networking || ((validation_errors++))
            ;;
        "security")
            validate_security || ((validation_errors++))
            ;;
        "performance")
            validate_performance || ((validation_errors++))
            validate_load_capacity || ((validation_errors++))
            ;;
        *)
            error "Unknown validation type: $validation_type"
            echo "Usage: $0 {full|health|infrastructure|security|performance}"
            exit 1
            ;;
    esac
    
    # Mark validation success/failure
    if [[ $validation_errors -eq 0 ]]; then
        touch "$EVIDENCE_DIR/validation_success"
        success "Validation completed with NO ERRORS"
    else
        touch "$EVIDENCE_DIR/validation_failed"
        error "Validation completed with $validation_errors ERRORS"
    fi
    
    # Always generate report
    generate_validation_report
    
    exit $validation_errors
}

# Execute main function
main "$@"