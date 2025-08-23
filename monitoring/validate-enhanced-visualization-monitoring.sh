#!/bin/bash

# Enhanced Visualization Service Monitoring Validation Script
# Validates that all monitoring components are properly configured and operational

set -e

# Configuration
PROMETHEUS_URL=${PROMETHEUS_URL:-"http://localhost:9091"}
GRAFANA_URL=${GRAFANA_URL:-"http://localhost:3001"}
SERVICE_URL=${SERVICE_URL:-"http://localhost:8085"}
ELASTICSEARCH_URL=${ELASTICSEARCH_URL:-"http://localhost:9200"}
KIBANA_URL=${KIBANA_URL:-"http://localhost:5601"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED_TESTS++))
}

print_failure() {
    echo -e "${RED}✗ $1${NC}"
    echo -e "${RED}  $2${NC}"
    ((FAILED_TESTS++))
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Function to increment total tests
test_start() {
    ((TOTAL_TESTS++))
}

# Function to test HTTP endpoint
test_http_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"
    
    test_start
    local response=$(curl -s -w "%{http_code}" "$url" || echo "000")
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "$expected_code" ]]; then
        print_success "$name is accessible (HTTP $http_code)"
        return 0
    else
        print_failure "$name is not accessible" "Expected HTTP $expected_code, got $http_code"
        return 1
    fi
}

# Function to test Prometheus metrics
test_prometheus_metrics() {
    print_header "Testing Prometheus Metrics Collection"
    
    # Test if Prometheus is scraping the service
    test_start
    local query="up{job=\"enhanced-visualization-service\"}"
    local response=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${query}" | jq -r '.data.result[0].value[1]' 2>/dev/null || echo "null")
    
    if [[ "$response" == "1" ]]; then
        print_success "Enhanced Visualization Service is being scraped by Prometheus"
    else
        print_failure "Enhanced Visualization Service is not being scraped by Prometheus" "Service may be down or not configured properly"
    fi
    
    # Test specific metrics
    local metrics=(
        "websocket_connections_active"
        "http_requests_total"
        "graph_render_duration_seconds"
        "memory_usage_bytes"
        "database_connections_active"
        "redis_connections_active"
    )
    
    for metric in "${metrics[@]}"; do
        test_start
        local query="${metric}{job=\"enhanced-visualization-service\"}"
        local response=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${query}" | jq -r '.data.result | length' 2>/dev/null || echo "0")
        
        if [[ "$response" -gt 0 ]]; then
            print_success "Metric $metric is available"
        else
            print_failure "Metric $metric is not available" "Check if the service is exposing this metric"
        fi
    done
}

# Function to test Grafana dashboard
test_grafana_dashboard() {
    print_header "Testing Grafana Dashboard"
    
    # Test Grafana accessibility
    test_http_endpoint "Grafana" "$GRAFANA_URL/api/health"
    
    # Test if dashboard exists (requires API key or authentication)
    test_start
    local dashboard_response=$(curl -s "${GRAFANA_URL}/api/search?query=enhanced-visualization" || echo "error")
    
    if [[ "$dashboard_response" != "error" ]] && [[ "$dashboard_response" != "[]" ]]; then
        print_success "Enhanced Visualization Service dashboard is available in Grafana"
    else
        print_warning "Could not verify dashboard availability (may require authentication)"
    fi
}

# Function to test service endpoints
test_service_endpoints() {
    print_header "Testing Enhanced Visualization Service Endpoints"
    
    # Test health endpoint
    test_http_endpoint "Service Health Endpoint" "$SERVICE_URL/health"
    
    # Test metrics endpoint
    test_http_endpoint "Service Metrics Endpoint" "$SERVICE_URL/metrics"
    
    # Test if health endpoint returns proper structure
    test_start
    local health_response=$(curl -s "$SERVICE_URL/health" 2>/dev/null || echo "error")
    
    if echo "$health_response" | jq -e '.status' >/dev/null 2>&1; then
        local status=$(echo "$health_response" | jq -r '.status')
        if [[ "$status" == "healthy" ]]; then
            print_success "Service health status is healthy"
        else
            print_failure "Service health status is not healthy" "Status: $status"
        fi
    else
        print_failure "Health endpoint does not return valid JSON" "Response: $health_response"
    fi
    
    # Test if metrics endpoint returns Prometheus format
    test_start
    local metrics_response=$(curl -s "$SERVICE_URL/metrics" 2>/dev/null || echo "error")
    
    if echo "$metrics_response" | grep -q "# HELP"; then
        print_success "Metrics endpoint returns Prometheus format"
    else
        print_failure "Metrics endpoint does not return Prometheus format" "Check metrics service configuration"
    fi
}

# Function to test alert rules
test_alert_rules() {
    print_header "Testing Alert Rules"
    
    # Test if alert rules are loaded
    test_start
    local rules_response=$(curl -s "${PROMETHEUS_URL}/api/v1/rules" | jq -r '.data.groups | length' 2>/dev/null || echo "0")
    
    if [[ "$rules_response" -gt 0 ]]; then
        print_success "Alert rules are loaded in Prometheus"
    else
        print_failure "No alert rules found in Prometheus" "Check alert rule configuration"
    fi
    
    # Test for specific enhanced-visualization-service alerts
    test_start
    local enhanced_viz_alerts=$(curl -s "${PROMETHEUS_URL}/api/v1/rules" | jq -r '.data.groups[] | select(.name | contains("enhanced_visualization")) | .rules | length' 2>/dev/null || echo "0")
    
    if [[ "$enhanced_viz_alerts" -gt 0 ]]; then
        print_success "Enhanced Visualization Service alert rules are configured"
    else
        print_failure "Enhanced Visualization Service alert rules not found" "Check enhanced-visualization-alerts.yml"
    fi
}

# Function to test Elasticsearch integration
test_elasticsearch_integration() {
    print_header "Testing Elasticsearch Log Aggregation"
    
    # Test Elasticsearch accessibility
    test_http_endpoint "Elasticsearch" "$ELASTICSEARCH_URL/_cluster/health"
    
    # Test if ILM policy exists
    test_start
    if curl -s -f "${ELASTICSEARCH_URL}/_ilm/policy/enhanced-visualization-service-policy" >/dev/null 2>&1; then
        print_success "ILM policy is configured"
    else
        print_failure "ILM policy not found" "Run setup-elasticsearch.sh"
    fi
    
    # Test if ingest pipeline exists
    test_start
    if curl -s -f "${ELASTICSEARCH_URL}/_ingest/pipeline/enhanced-visualization-service-pipeline" >/dev/null 2>&1; then
        print_success "Ingest pipeline is configured"
    else
        print_failure "Ingest pipeline not found" "Run setup-elasticsearch.sh"
    fi
    
    # Test if index template exists
    test_start
    if curl -s -f "${ELASTICSEARCH_URL}/_index_template/enhanced-visualization-service" >/dev/null 2>&1; then
        print_success "Index template is configured"
    else
        print_failure "Index template not found" "Run setup-elasticsearch.sh"
    fi
    
    # Test if indices exist
    test_start
    local indices_response=$(curl -s "${ELASTICSEARCH_URL}/_cat/indices/enhanced-visualization-service-*" || echo "")
    
    if [[ -n "$indices_response" ]]; then
        print_success "Enhanced Visualization Service indices exist"
    else
        print_warning "No Enhanced Visualization Service indices found yet (this is normal for new deployments)"
    fi
}

# Function to test Kibana integration
test_kibana_integration() {
    print_header "Testing Kibana Integration"
    
    # Test Kibana accessibility
    test_http_endpoint "Kibana" "$KIBANA_URL/api/status"
}

# Function to test log shipping
test_log_shipping() {
    print_header "Testing Log Shipping"
    
    # Generate a test log entry
    test_start
    print_info "Generating test log entry..."
    
    local test_response=$(curl -s -X POST "$SERVICE_URL/health" 2>/dev/null || echo "error")
    
    if [[ "$test_response" != "error" ]]; then
        print_success "Generated test HTTP request for log testing"
        print_info "Wait 30 seconds for logs to be processed and check Kibana for new entries"
    else
        print_warning "Could not generate test log entry"
    fi
}

# Function to test WebSocket metrics
test_websocket_metrics() {
    print_header "Testing WebSocket Metrics"
    
    # Test WebSocket connection metrics
    test_start
    local ws_metrics_query="websocket_connections_active{job=\"enhanced-visualization-service\"}"
    local ws_response=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${ws_metrics_query}" | jq -r '.data.result[0].value[1]' 2>/dev/null || echo "null")
    
    if [[ "$ws_response" != "null" ]]; then
        print_success "WebSocket connection metrics are available (Current connections: $ws_response)"
    else
        print_failure "WebSocket connection metrics not available" "Check WebSocket service implementation"
    fi
}

# Function to show performance metrics
show_performance_metrics() {
    print_header "Current Performance Metrics"
    
    # Show some key metrics
    local metrics_queries=(
        "websocket_connections_active{job=\"enhanced-visualization-service\"}"
        "rate(http_requests_total{job=\"enhanced-visualization-service\"}[5m])"
        "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"enhanced-visualization-service\"}[5m]))"
        "rate(graph_render_duration_seconds_sum{job=\"enhanced-visualization-service\"}[5m]) / rate(graph_render_duration_seconds_count{job=\"enhanced-visualization-service\"}[5m])"
    )
    
    local metric_names=(
        "Active WebSocket Connections"
        "HTTP Request Rate (req/sec)"
        "95th Percentile Response Time (seconds)"
        "Average Graph Render Time (seconds)"
    )
    
    for i in "${!metrics_queries[@]}"; do
        local query="${metrics_queries[$i]}"
        local name="${metric_names[$i]}"
        local value=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${query}" | jq -r '.data.result[0].value[1]' 2>/dev/null || echo "N/A")
        
        if [[ "$value" != "N/A" && "$value" != "null" ]]; then
            printf "  %-35s: %s\n" "$name" "$value"
        else
            printf "  %-35s: %s\n" "$name" "No data"
        fi
    done
}

# Function to print summary
print_summary() {
    print_header "Validation Summary"
    
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "Success Rate: ${success_rate}%"
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        print_success "All monitoring components are working correctly!"
    else
        print_failure "Some monitoring components need attention" "Check the failed tests above"
    fi
}

# Function to show next steps
show_next_steps() {
    print_header "Next Steps"
    
    echo "1. Access Grafana dashboard:"
    echo "   ${GRAFANA_URL}/d/enhanced-viz-dashboard"
    echo ""
    echo "2. Access Kibana for log analysis:"
    echo "   ${KIBANA_URL}"
    echo ""
    echo "3. View Prometheus metrics:"
    echo "   ${PROMETHEUS_URL}/graph"
    echo ""
    echo "4. Monitor service health:"
    echo "   ${SERVICE_URL}/health"
    echo ""
    echo "5. Check service metrics:"
    echo "   ${SERVICE_URL}/metrics"
    echo ""
    
    if [[ $FAILED_TESTS -gt 0 ]]; then
        echo "6. Fix failed components:"
        echo "   - Review service logs"
        echo "   - Check configuration files"
        echo "   - Restart services if needed"
        echo "   - Run setup scripts for Elasticsearch if needed"
    fi
}

# Main execution
main() {
    print_header "Enhanced Visualization Service Monitoring Validation"
    print_info "This script validates the monitoring setup for the Enhanced Visualization Service"
    print_info "Testing against:"
    print_info "  Service: $SERVICE_URL"
    print_info "  Prometheus: $PROMETHEUS_URL"
    print_info "  Grafana: $GRAFANA_URL"
    print_info "  Elasticsearch: $ELASTICSEARCH_URL"
    print_info "  Kibana: $KIBANA_URL"
    
    # Run all tests
    test_service_endpoints
    test_prometheus_metrics
    test_websocket_metrics
    test_grafana_dashboard
    test_alert_rules
    test_elasticsearch_integration
    test_kibana_integration
    test_log_shipping
    
    # Show results
    show_performance_metrics
    print_summary
    show_next_steps
    
    # Exit with appropriate code
    if [[ $FAILED_TESTS -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    local deps=("curl" "jq")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        print_failure "Missing dependencies" "Please install: ${missing_deps[*]}"
        exit 1
    fi
}

# Run dependency check and main function
check_dependencies
main "$@"