#!/bin/bash
# Production Validation Framework for Song Nodes
# Comprehensive end-to-end testing and validation

set -euo pipefail

# Configuration
ENVIRONMENT=${1:-production}
BASE_URL=${2:-https://songnodes.com}
VALIDATION_LOG="/opt/songnodes/logs/validation.log"
REPORT_DIR="/opt/songnodes/reports/validation"
TIMEOUT=30
RETRIES=3
PARALLEL_WORKERS=5

# Test endpoints
APP_ENDPOINTS=(
    "$BASE_URL/health:Health Check"
    "$BASE_URL/api/health:API Health"
    "$BASE_URL/api/v1/nodes?limit=10:Node Listing"
    "$BASE_URL/api/v1/search?q=test:Search API"
)

WEBSOCKET_ENDPOINTS=(
    "wss://ws.songnodes.com/connect:WebSocket Connection"
)

GRAPH_ENDPOINTS=(
    "$BASE_URL/api/v1/graph/visualization?nodes=100:Graph Visualization"
    "$BASE_URL/api/v1/graph/paths?from=1&to=2:Pathfinding"
    "$BASE_URL/api/v1/graph/clusters:Cluster Analysis"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

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

info() {
    echo -e "${PURPLE}[INFO]${NC} $1" | tee -a "$VALIDATION_LOG"
}

# Initialize validation framework
init_validation() {
    log "Initializing production validation framework"
    
    # Create required directories
    mkdir -p "$(dirname "$VALIDATION_LOG")" "$REPORT_DIR"
    
    # Clean previous reports
    rm -f "$REPORT_DIR"/*.json
    
    # Initialize validation report
    cat > "$REPORT_DIR/validation_summary.json" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "environment": "$ENVIRONMENT",
  "base_url": "$BASE_URL",
  "test_results": {},
  "performance_metrics": {},
  "status": "in_progress"
}
EOF
    
    success "Validation framework initialized"
}

# HTTP endpoint validation with performance metrics
validate_http_endpoint() {
    local endpoint_info="$1"
    IFS=':' read -r url description <<< "$endpoint_info"
    
    local test_name=$(echo "$description" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
    local start_time=$(date +%s%N)
    local response_file="$REPORT_DIR/${test_name}_response.json"
    
    log "Validating: $description ($url)"
    
    # Test with detailed metrics
    local http_result=$(curl -w '{
      "http_code": %{http_code},
      "time_total": %{time_total},
      "time_namelookup": %{time_namelookup},
      "time_connect": %{time_connect},
      "time_starttransfer": %{time_starttransfer},
      "time_redirect": %{time_redirect},
      "size_download": %{size_download},
      "speed_download": %{speed_download}
    }' \
        -s \
        --max-time $TIMEOUT \
        --retry $RETRIES \
        --retry-delay 1 \
        -H "Accept: application/json" \
        -H "User-Agent: SongNodes-ValidationSuite/1.0" \
        "$url" 2>/dev/null || echo '{"http_code": 0, "error": "connection_failed"}')
    
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    # Parse results
    local http_code=$(echo "$http_result" | jq -r '.http_code // 0')
    local response_time=$(echo "$http_result" | jq -r '.time_total // 0')
    local error_msg=$(echo "$http_result" | jq -r '.error // "none"')
    
    # Determine test status
    local status="failed"
    local details=""
    
    if [[ $http_code -eq 200 ]]; then
        status="passed"
        success "✓ $description - HTTP $http_code (${response_time}s)"
    elif [[ $http_code -ge 400 ]] && [[ $http_code -lt 500 ]]; then
        warning "⚠ $description - HTTP $http_code (client error)"
        status="warning"
        details="Client error - check request format"
    elif [[ $http_code -ge 500 ]]; then
        error "✗ $description - HTTP $http_code (server error)"
        details="Server error - check service health"
    else
        error "✗ $description - Connection failed ($error_msg)"
        details="Connection failure - $error_msg"
    fi
    
    # Save detailed results
    cat > "$response_file" << EOF
{
  "test_name": "$test_name",
  "description": "$description",
  "url": "$url",
  "status": "$status",
  "http_code": $http_code,
  "response_time": $response_time,
  "duration_ms": $duration,
  "details": "$details",
  "timestamp": "$(date -Iseconds)",
  "metrics": $http_result
}
EOF
    
    echo "$status"
}

# WebSocket endpoint validation
validate_websocket_endpoint() {
    local endpoint_info="$1"
    IFS=':' read -r url description <<< "$endpoint_info"
    
    local test_name=$(echo "$description" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
    local response_file="$REPORT_DIR/${test_name}_response.json"
    
    log "Validating WebSocket: $description ($url)"
    
    # Use Node.js for WebSocket testing
    local ws_test_result=$(node -e "
        const WebSocket = require('ws');
        const start = Date.now();
        
        const ws = new WebSocket('$url');
        let status = 'failed';
        let error = '';
        
        ws.on('open', () => {
            const duration = Date.now() - start;
            status = 'passed';
            console.log(JSON.stringify({
                status,
                duration,
                connected: true
            }));
            ws.close();
        });
        
        ws.on('error', (err) => {
            const duration = Date.now() - start;
            error = err.message;
            console.log(JSON.stringify({
                status: 'failed',
                duration,
                connected: false,
                error
            }));
        });
        
        setTimeout(() => {
            if (ws.readyState === WebSocket.CONNECTING) {
                console.log(JSON.stringify({
                    status: 'failed',
                    duration: Date.now() - start,
                    connected: false,
                    error: 'timeout'
                }));
                ws.terminate();
            }
        }, ${TIMEOUT}000);
    " 2>/dev/null || echo '{"status": "failed", "error": "test_execution_failed"}')
    
    local status=$(echo "$ws_test_result" | jq -r '.status')
    local duration=$(echo "$ws_test_result" | jq -r '.duration // 0')
    local ws_error=$(echo "$ws_test_result" | jq -r '.error // "none"')
    
    if [[ "$status" == "passed" ]]; then
        success "✓ $description - Connected (${duration}ms)"
    else
        error "✗ $description - Failed ($ws_error)"
    fi
    
    # Save results
    cat > "$response_file" << EOF
{
  "test_name": "$test_name",
  "description": "$description",
  "url": "$url",
  "status": "$status",
  "duration_ms": $duration,
  "error": "$ws_error",
  "timestamp": "$(date -Iseconds)",
  "protocol": "websocket"
}
EOF
    
    echo "$status"
}

# Database connectivity validation
validate_database_connectivity() {
    log "Validating database connectivity and performance"
    
    local db_test_result=$(curl -s "$BASE_URL/api/health/database" 2>/dev/null || echo '{"status": "failed"}')
    local db_status=$(echo "$db_test_result" | jq -r '.status // "failed"')
    local response_time=$(echo "$db_test_result" | jq -r '.responseTime // 0')
    local connection_count=$(echo "$db_test_result" | jq -r '.details.connections // 0')
    
    if [[ "$db_status" == "healthy" ]]; then
        success "✓ Database - Healthy (${response_time}ms, $connection_count connections)"
        echo "passed"
    else
        error "✗ Database - Unhealthy"
        echo "failed"
    fi
    
    # Save results
    cat > "$REPORT_DIR/database_validation.json" << EOF
{
  "test_name": "database_connectivity",
  "description": "Database Connectivity",
  "status": "$([[ "$db_status" == "healthy" ]] && echo "passed" || echo "failed")",
  "response_time_ms": $response_time,
  "connection_count": $connection_count,
  "timestamp": "$(date -Iseconds)",
  "details": $db_test_result
}
EOF
}

# Performance benchmark validation
validate_performance_benchmarks() {
    log "Running performance benchmark validation"
    
    local benchmark_results=()
    
    # API Performance Test
    info "Testing API performance with concurrent requests"
    local api_perf=$(curl -w '%{time_total}' -s -o /dev/null "$BASE_URL/api/v1/nodes?limit=100" 2>/dev/null || echo "999")
    
    # Concurrent load test
    local concurrent_results=$(seq 1 10 | xargs -n1 -P10 -I {} curl -w '%{time_total}\n' -s -o /dev/null "$BASE_URL/api/health" 2>/dev/null | 
        awk '{ sum += $1; count++ } END { print sum/count }')
    
    # Graph API Performance
    local graph_perf=$(curl -w '%{time_total}' -s -o /dev/null "$BASE_URL/api/v1/graph/visualization?nodes=50" 2>/dev/null || echo "999")
    
    # Evaluate performance thresholds
    local api_status="passed"
    local concurrent_status="passed"
    local graph_status="passed"
    
    if (( $(echo "$api_perf > 0.5" | bc -l) )); then
        api_status="warning"
        warning "⚠ API performance slower than expected: ${api_perf}s"
    else
        success "✓ API performance within threshold: ${api_perf}s"
    fi
    
    if (( $(echo "$concurrent_results > 1.0" | bc -l) )); then
        concurrent_status="warning"
        warning "⚠ Concurrent request performance degraded: ${concurrent_results}s"
    else
        success "✓ Concurrent performance acceptable: ${concurrent_results}s"
    fi
    
    if (( $(echo "$graph_perf > 2.0" | bc -l) )); then
        graph_status="failed"
        error "✗ Graph API performance unacceptable: ${graph_perf}s"
    else
        success "✓ Graph API performance acceptable: ${graph_perf}s"
    fi
    
    # Save performance results
    cat > "$REPORT_DIR/performance_validation.json" << EOF
{
  "test_name": "performance_benchmarks",
  "description": "Performance Benchmark Validation",
  "status": "$([[ "$api_status" == "passed" && "$concurrent_status" == "passed" && "$graph_status" == "passed" ]] && echo "passed" || echo "warning")",
  "api_performance": {
    "response_time": $api_perf,
    "status": "$api_status",
    "threshold": 0.5
  },
  "concurrent_performance": {
    "avg_response_time": $concurrent_results,
    "status": "$concurrent_status",
    "threshold": 1.0
  },
  "graph_performance": {
    "response_time": $graph_perf,
    "status": "$graph_status",
    "threshold": 2.0
  },
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    # Return overall performance status
    if [[ "$api_status" == "passed" && "$concurrent_status" == "passed" && "$graph_status" == "passed" ]]; then
        echo "passed"
    elif [[ "$graph_status" == "failed" ]]; then
        echo "failed"
    else
        echo "warning"
    fi
}

# Security validation
validate_security() {
    log "Running security validation checks"
    
    local security_results=()
    
    # SSL/TLS validation
    info "Validating SSL/TLS configuration"
    local ssl_info=$(echo | openssl s_client -connect "$(echo $BASE_URL | sed 's|https://||'):443" -servername "$(echo $BASE_URL | sed 's|https://||')" 2>/dev/null | 
        openssl x509 -noout -dates 2>/dev/null || echo "SSL validation failed")
    
    local ssl_status="passed"
    if [[ "$ssl_info" == *"SSL validation failed"* ]]; then
        ssl_status="failed"
        error "✗ SSL/TLS validation failed"
    else
        success "✓ SSL/TLS certificate valid"
    fi
    
    # Security headers validation
    info "Validating security headers"
    local headers=$(curl -I -s "$BASE_URL" 2>/dev/null || echo "")
    
    local security_headers=(
        "Strict-Transport-Security"
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
        "Content-Security-Policy"
    )
    
    local missing_headers=()
    for header in "${security_headers[@]}"; do
        if ! echo "$headers" | grep -qi "$header"; then
            missing_headers+=("$header")
        fi
    done
    
    local headers_status="passed"
    if [[ ${#missing_headers[@]} -gt 0 ]]; then
        headers_status="warning"
        warning "⚠ Missing security headers: ${missing_headers[*]}"
    else
        success "✓ All security headers present"
    fi
    
    # Save security results
    cat > "$REPORT_DIR/security_validation.json" << EOF
{
  "test_name": "security_validation",
  "description": "Security Configuration Validation",
  "status": "$([[ "$ssl_status" == "passed" && "$headers_status" == "passed" ]] && echo "passed" || echo "warning")",
  "ssl_tls": {
    "status": "$ssl_status",
    "details": "$ssl_info"
  },
  "security_headers": {
    "status": "$headers_status",
    "missing_headers": [$(printf '"%s",' "${missing_headers[@]}" | sed 's/,$//')]    
  },
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    echo "$([[ "$ssl_status" == "passed" && "$headers_status" == "passed" ]] && echo "passed" || echo "warning")"
}

# Generate comprehensive validation report
generate_validation_report() {
    log "Generating comprehensive validation report"
    
    local total_tests=0
    local passed_tests=0
    local warning_tests=0
    local failed_tests=0
    
    # Aggregate all test results
    local all_results="[]"
    for result_file in "$REPORT_DIR"/*_response.json "$REPORT_DIR"/*_validation.json; do
        if [[ -f "$result_file" ]]; then
            local result=$(cat "$result_file")
            all_results=$(echo "$all_results" | jq ". + [$result]")
            
            local status=$(echo "$result" | jq -r '.status')
            ((total_tests++))
            
            case "$status" in
                "passed") ((passed_tests++)) ;;
                "warning") ((warning_tests++)) ;;
                "failed") ((failed_tests++)) ;;
            esac
        fi
    done
    
    # Calculate overall status
    local overall_status="passed"
    if [[ $failed_tests -gt 0 ]]; then
        overall_status="failed"
    elif [[ $warning_tests -gt 0 ]]; then
        overall_status="warning"
    fi
    
    # Generate final report
    cat > "$REPORT_DIR/final_validation_report.json" << EOF
{
  "validation_summary": {
    "timestamp": "$(date -Iseconds)",
    "environment": "$ENVIRONMENT",
    "base_url": "$BASE_URL",
    "overall_status": "$overall_status",
    "total_tests": $total_tests,
    "passed_tests": $passed_tests,
    "warning_tests": $warning_tests,
    "failed_tests": $failed_tests,
    "success_rate": $(echo "scale=2; $passed_tests / $total_tests * 100" | bc)%
  },
  "test_results": $all_results,
  "recommendations": [
    $([[ $failed_tests -gt 0 ]] && echo '"Investigate and fix failed tests before proceeding with deployment"' || echo '')
    $([[ $warning_tests -gt 0 ]] && echo '"Review warning conditions and consider optimization"' || echo '')
    $([[ $overall_status == "passed" ]] && echo '"All validations passed - deployment can proceed"' || echo '')
  ]
}
EOF
    
    # Display summary
    echo
    echo "==========================================="
    echo "     PRODUCTION VALIDATION SUMMARY"
    echo "==========================================="
    echo "Environment: $ENVIRONMENT"
    echo "Base URL: $BASE_URL"
    echo "Timestamp: $(date)"
    echo
    echo "Test Results:"
    echo "  Total Tests: $total_tests"
    echo "  Passed: $passed_tests"
    echo "  Warnings: $warning_tests"
    echo "  Failed: $failed_tests"
    echo "  Success Rate: $(echo "scale=1; $passed_tests / $total_tests * 100" | bc)%"
    echo
    echo "Overall Status: $overall_status"
    echo
    
    if [[ "$overall_status" == "passed" ]]; then
        success "✓ All validations passed - Production deployment approved"
        return 0
    elif [[ "$overall_status" == "warning" ]]; then
        warning "⚠ Validation completed with warnings - Review recommended"
        return 1
    else
        error "✗ Validation failed - Deployment should not proceed"
        return 2
    fi
}

# Main validation execution
main() {
    local start_time=$(date +%s)
    
    log "Starting production validation suite for $ENVIRONMENT"
    
    # Initialize validation framework
    init_validation
    
    # Track overall results
    local validation_results=()
    
    # Validate HTTP endpoints
    info "=== HTTP Endpoint Validation ==="
    for endpoint in "${APP_ENDPOINTS[@]}"; do
        result=$(validate_http_endpoint "$endpoint")
        validation_results+=("$result")
    done
    
    # Validate Graph API endpoints
    info "=== Graph API Validation ==="
    for endpoint in "${GRAPH_ENDPOINTS[@]}"; do
        result=$(validate_http_endpoint "$endpoint")
        validation_results+=("$result")
    done
    
    # Validate WebSocket endpoints
    info "=== WebSocket Validation ==="
    for endpoint in "${WEBSOCKET_ENDPOINTS[@]}"; do
        result=$(validate_websocket_endpoint "$endpoint")
        validation_results+=("$result")
    done
    
    # Validate database connectivity
    info "=== Database Validation ==="
    result=$(validate_database_connectivity)
    validation_results+=("$result")
    
    # Validate performance benchmarks
    info "=== Performance Validation ==="
    result=$(validate_performance_benchmarks)
    validation_results+=("$result")
    
    # Validate security configuration
    info "=== Security Validation ==="
    result=$(validate_security)
    validation_results+=("$result")
    
    # Generate final report
    local exit_code=0
    if ! generate_validation_report; then
        exit_code=$?
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "Production validation completed in ${duration}s"
    log "Report available at: $REPORT_DIR/final_validation_report.json"
    
    exit $exit_code
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi