#!/bin/bash

# SongNodes Project Health Check Script
# Comprehensive health monitoring for the SongNodes project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Health status tracking
HEALTH_SCORE=0
MAX_SCORE=100
ISSUES_FOUND=()

# Logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    HEALTH_SCORE=$((HEALTH_SCORE + 10))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    ISSUES_FOUND+=("WARNING: $1")
    HEALTH_SCORE=$((HEALTH_SCORE + 5))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ISSUES_FOUND+=("ERROR: $1")
}

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HEALTH_LOG="$PROJECT_ROOT/logs/health-check-$(date +%Y%m%d-%H%M%S).log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Start health check
log_info "Starting SongNodes project health check..."
log_info "Project root: $PROJECT_ROOT"
log_info "Health log: $HEALTH_LOG"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is open
port_open() {
    local host=${1:-localhost}
    local port=$2
    timeout 5 bash -c "</dev/tcp/$host/$port" 2>/dev/null
}

# Check project structure
check_project_structure() {
    log_info "Checking project structure..."
    
    # Required directories
    required_dirs=("services" "docs" "sql" "mcp_servers")
    for dir in "${required_dirs[@]}"; do
        if [ -d "$PROJECT_ROOT/$dir" ]; then
            log_success "Directory exists: $dir"
        else
            log_error "Missing required directory: $dir"
        fi
    done
    
    # Required files
    required_files=("README.md" "docker-compose.yml" "SETUP.md" "CONTRIBUTING.md")
    for file in "${required_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            log_success "File exists: $file"
        else
            log_error "Missing required file: $file"
        fi
    done
    
    # Check root directory file count
    file_count=$(find "$PROJECT_ROOT" -maxdepth 1 -type f | wc -l)
    if [ "$file_count" -le 15 ]; then
        log_success "Root directory file count: $file_count (within limit)"
    else
        log_warning "Root directory file count: $file_count (exceeds recommended limit of 15)"
    fi
}

# Check dependencies
check_dependencies() {
    log_info "Checking system dependencies..."
    
    # Required commands
    required_commands=("docker" "docker-compose" "node" "npm" "python3" "git")
    for cmd in "${required_commands[@]}"; do
        if command_exists "$cmd"; then
            version=$($cmd --version 2>/dev/null | head -1 || echo "unknown")
            log_success "$cmd available: $version"
        else
            log_error "Missing required command: $cmd"
        fi
    done
    
    # Optional but recommended commands
    optional_commands=("uv" "safety" "trivy")
    for cmd in "${optional_commands[@]}"; do
        if command_exists "$cmd"; then
            log_success "Optional tool available: $cmd"
        else
            log_info "Optional tool not installed: $cmd"
        fi
    done
}

# Check Docker services
check_docker_services() {
    log_info "Checking Docker services..."
    
    if ! command_exists docker; then
        log_error "Docker not available"
        return
    fi
    
    # Check if Docker daemon is running
    if docker info >/dev/null 2>&1; then
        log_success "Docker daemon is running"
    else
        log_error "Docker daemon is not running"
        return
    fi
    
    # Check docker-compose configuration
    cd "$PROJECT_ROOT"
    if docker-compose config >/dev/null 2>&1; then
        log_success "Docker Compose configuration is valid"
    else
        log_error "Docker Compose configuration has errors"
    fi
    
    # Check running containers
    running_containers=$(docker-compose ps --services --filter status=running 2>/dev/null | wc -l)
    total_services=$(docker-compose config --services 2>/dev/null | wc -l)
    
    if [ "$running_containers" -eq "$total_services" ]; then
        log_success "All Docker services are running ($running_containers/$total_services)"
    elif [ "$running_containers" -gt 0 ]; then
        log_warning "Some Docker services are running ($running_containers/$total_services)"
    else
        log_info "No Docker services are currently running"
    fi
}

# Check MCP servers
check_mcp_servers() {
    log_info "Checking MCP servers..."
    
    # Check if MCP server port is open
    if port_open localhost 8000; then
        log_success "MCP server is responding on port 8000"
        
        # Test MCP health endpoint
        if command_exists curl; then
            if curl -s http://localhost:8000/health >/dev/null 2>&1; then
                log_success "MCP health endpoint is accessible"
            else
                log_warning "MCP health endpoint is not responding correctly"
            fi
        fi
    else
        log_warning "MCP server is not responding on port 8000"
    fi
    
    # Check MCP server files
    mcp_files=("mcp_servers/start_integrated_mcp.sh" "mcp_servers/stop_integrated_mcp.sh" "mcp_servers/test_integrated_mcp.py")
    for file in "${mcp_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            if [ -x "$PROJECT_ROOT/$file" ]; then
                log_success "MCP script exists and is executable: $file"
            else
                log_warning "MCP script exists but is not executable: $file"
            fi
        else
            log_error "Missing MCP script: $file"
        fi
    done
}

# Check API gateway
check_api_gateway() {
    log_info "Checking API Gateway..."
    
    # Check if API gateway port is open
    if port_open localhost 8080; then
        log_success "API Gateway is responding on port 8080"
        
        # Test health endpoint
        if command_exists curl; then
            response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null || echo "000")
            if [ "$response" = "200" ]; then
                log_success "API Gateway health endpoint returns 200"
            else
                log_warning "API Gateway health endpoint returns $response"
            fi
        fi
    else
        log_warning "API Gateway is not responding on port 8080"
    fi
    
    # Check API gateway files
    gateway_files=("services/api-gateway/server.js" "services/api-gateway/package.json")
    for file in "${gateway_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            log_success "API Gateway file exists: $file"
        else
            log_error "Missing API Gateway file: $file"
        fi
    done
}

# Check database connectivity
check_database() {
    log_info "Checking database connectivity..."
    
    # Check if PostgreSQL port is open (assuming default port 5432)
    if port_open localhost 5432; then
        log_success "Database is responding on port 5432"
    else
        log_warning "Database is not responding on port 5432"
    fi
    
    # Check database initialization scripts
    if [ -d "$PROJECT_ROOT/sql/init" ]; then
        sql_files=$(find "$PROJECT_ROOT/sql/init" -name "*.sql" | wc -l)
        if [ "$sql_files" -gt 0 ]; then
            log_success "Database initialization scripts found: $sql_files files"
        else
            log_warning "No SQL initialization scripts found"
        fi
    else
        log_warning "SQL initialization directory not found"
    fi
}

# Check logs for errors
check_logs() {
    log_info "Checking for recent errors in logs..."
    
    # Check for log directories
    log_dirs=("logs" "mcp_servers/logs")
    for log_dir in "${log_dirs[@]}"; do
        if [ -d "$PROJECT_ROOT/$log_dir" ]; then
            # Check for recent error logs
            recent_errors=$(find "$PROJECT_ROOT/$log_dir" -name "*.log" -mtime -1 -exec grep -l "ERROR\|FATAL\|CRITICAL" {} \; 2>/dev/null | wc -l)
            if [ "$recent_errors" -eq 0 ]; then
                log_success "No recent errors found in $log_dir"
            else
                log_warning "Found $recent_errors log files with recent errors in $log_dir"
            fi
        else
            log_info "Log directory does not exist: $log_dir"
        fi
    done
}

# Check disk usage
check_disk_usage() {
    log_info "Checking disk usage..."
    
    # Check project directory size
    project_size=$(du -sh "$PROJECT_ROOT" 2>/dev/null | cut -f1)
    log_info "Project directory size: $project_size"
    
    # Check disk usage of project directory filesystem
    disk_usage=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 80 ]; then
        log_success "Disk usage is acceptable: ${disk_usage}%"
    elif [ "$disk_usage" -lt 90 ]; then
        log_warning "Disk usage is high: ${disk_usage}%"
    else
        log_error "Disk usage is critical: ${disk_usage}%"
    fi
    
    # Check for large files that might need cleanup
    large_files=$(find "$PROJECT_ROOT" -type f -size +100M 2>/dev/null | wc -l)
    if [ "$large_files" -eq 0 ]; then
        log_success "No large files (>100MB) found"
    else
        log_warning "Found $large_files large files (>100MB)"
    fi
}

# Check security
check_security() {
    log_info "Checking security configuration..."
    
    # Check for .env files
    if [ -f "$PROJECT_ROOT/.env" ]; then
        log_success ".env file exists"
        
        # Check if .env is in .gitignore
        if [ -f "$PROJECT_ROOT/.gitignore" ] && grep -q ".env" "$PROJECT_ROOT/.gitignore"; then
            log_success ".env file is in .gitignore"
        else
            log_error ".env file is not in .gitignore - security risk!"
        fi
    else
        log_warning ".env file not found"
    fi
    
    # Check for exposed secrets
    if command_exists grep; then
        secret_patterns=("password.*=" "secret.*=" "key.*=" "token.*=")
        for pattern in "${secret_patterns[@]}"; do
            secrets=$(find "$PROJECT_ROOT" -name "*.js" -o -name "*.py" -o -name "*.yaml" -o -name "*.yml" | xargs grep -i "$pattern" 2>/dev/null | grep -v ".env" | wc -l)
            if [ "$secrets" -eq 0 ]; then
                log_success "No exposed secrets found for pattern: $pattern"
            else
                log_warning "Potential exposed secrets found for pattern: $pattern ($secrets matches)"
            fi
        done
    fi
}

# Generate health report
generate_health_report() {
    log_info "Generating health report..."
    
    # Calculate health percentage
    health_percentage=$((HEALTH_SCORE * 100 / MAX_SCORE))
    
    # Determine overall health status
    if [ "$health_percentage" -ge 90 ]; then
        health_status="EXCELLENT"
        status_color="${GREEN}"
    elif [ "$health_percentage" -ge 70 ]; then
        health_status="GOOD"
        status_color="${GREEN}"
    elif [ "$health_percentage" -ge 50 ]; then
        health_status="FAIR"
        status_color="${YELLOW}"
    else
        health_status="POOR"
        status_color="${RED}"
    fi
    
    report_file="$PROJECT_ROOT/logs/health-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# SongNodes Project Health Report

**Date**: $(date)
**Project Root**: $PROJECT_ROOT
**Health Score**: $HEALTH_SCORE/$MAX_SCORE ($health_percentage%)
**Overall Status**: $health_status

## Health Summary

### System Status
- Docker Services: $(docker-compose ps --services --filter status=running 2>/dev/null | wc -l) running
- MCP Server: $(port_open localhost 8000 && echo "✅ Online" || echo "❌ Offline")
- API Gateway: $(port_open localhost 8080 && echo "✅ Online" || echo "❌ Offline")
- Database: $(port_open localhost 5432 && echo "✅ Online" || echo "❌ Offline")

### Project Metrics
- Root directory files: $(find "$PROJECT_ROOT" -maxdepth 1 -type f | wc -l)
- Project size: $(du -sh "$PROJECT_ROOT" 2>/dev/null | cut -f1)
- Disk usage: $(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $5}')
- Large files (>100MB): $(find "$PROJECT_ROOT" -type f -size +100M 2>/dev/null | wc -l)

### Issues Found
$(if [ ${#ISSUES_FOUND[@]} -eq 0 ]; then
    echo "No issues found ✅"
else
    for issue in "${ISSUES_FOUND[@]}"; do
        echo "- $issue"
    done
fi)

### Recommendations
$(if [ "$health_percentage" -ge 90 ]; then
    echo "- Project is in excellent health"
    echo "- Continue regular maintenance"
elif [ "$health_percentage" -ge 70 ]; then
    echo "- Project is in good health"
    echo "- Address minor warnings when convenient"
elif [ "$health_percentage" -ge 50 ]; then
    echo "- Project needs attention"
    echo "- Address warnings and errors promptly"
else
    echo "- Project requires immediate attention"
    echo "- Fix critical errors before proceeding"
fi)

### Next Health Check
Schedule next health check in 7 days: $(date -d "+7 days")

---
Generated by SongNodes automated health check script
EOF

    log_info "Health report generated: $report_file"
    
    # Display summary
    echo ""
    echo "================================="
    echo -e "${status_color}HEALTH CHECK SUMMARY${NC}"
    echo "================================="
    echo -e "Overall Status: ${status_color}$health_status${NC}"
    echo "Health Score: $HEALTH_SCORE/$MAX_SCORE ($health_percentage%)"
    echo "Issues Found: ${#ISSUES_FOUND[@]}"
    echo "Report: $report_file"
    echo "================================="
}

# Main health check function
main() {
    log_info "Starting comprehensive health check..."
    
    # Record start time
    start_time=$(date +%s)
    
    # Run all health checks
    check_project_structure
    check_dependencies
    check_docker_services
    check_mcp_servers
    check_api_gateway
    check_database
    check_logs
    check_disk_usage
    check_security
    
    # Generate report
    generate_health_report
    
    # Calculate duration
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    log_success "Health check completed in ${duration} seconds"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --services-only)
            log_info "Checking services only..."
            check_docker_services
            check_mcp_servers
            check_api_gateway
            check_database
            exit 0
            ;;
        --security-only)
            log_info "Running security checks only..."
            check_security
            exit 0
            ;;
        --quick)
            log_info "Running quick health check..."
            check_project_structure
            check_docker_services
            check_api_gateway
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --services-only  Check only running services"
            echo "  --security-only  Run only security checks"
            echo "  --quick         Run quick health check"
            echo "  --help, -h      Show this help message"
            echo ""
            echo "With no options, performs comprehensive health check."
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            log_info "Use --help for usage information"
            exit 1
            ;;
    esac
    shift
done

# Run main function
main 2>&1 | tee "$HEALTH_LOG"

log_success "Health check log saved to: $HEALTH_LOG"