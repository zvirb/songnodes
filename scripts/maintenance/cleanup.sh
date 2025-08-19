#!/bin/bash

# SongNodes Project Cleanup Script
# Automated maintenance and cleanup for the SongNodes project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
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

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLEANUP_LOG="$PROJECT_ROOT/logs/cleanup-$(date +%Y%m%d-%H%M%S).log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Start cleanup process
log_info "Starting SongNodes project cleanup..."
log_info "Project root: $PROJECT_ROOT"
log_info "Cleanup log: $CLEANUP_LOG"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Cleanup Docker resources
cleanup_docker() {
    log_info "Cleaning up Docker resources..."
    
    if command_exists docker; then
        # Stop all project containers
        docker-compose down 2>/dev/null || true
        
        # Remove dangling images
        docker image prune -f 2>/dev/null || true
        
        # Remove unused volumes (with caution)
        docker volume prune -f 2>/dev/null || true
        
        # Remove unused networks
        docker network prune -f 2>/dev/null || true
        
        log_success "Docker cleanup completed"
    else
        log_warning "Docker not found, skipping Docker cleanup"
    fi
}

# Cleanup Node.js dependencies
cleanup_node() {
    log_info "Cleaning up Node.js dependencies..."
    
    # Find and clean node_modules directories
    find "$PROJECT_ROOT" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Find and clean package-lock.json files
    find "$PROJECT_ROOT" -name "package-lock.json" -type f -delete 2>/dev/null || true
    
    # Clean npm cache
    if command_exists npm; then
        npm cache clean --force 2>/dev/null || true
    fi
    
    log_success "Node.js cleanup completed"
}

# Cleanup Python artifacts
cleanup_python() {
    log_info "Cleaning up Python artifacts..."
    
    # Remove __pycache__ directories
    find "$PROJECT_ROOT" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Remove .pyc files
    find "$PROJECT_ROOT" -name "*.pyc" -type f -delete 2>/dev/null || true
    
    # Remove .pyo files
    find "$PROJECT_ROOT" -name "*.pyo" -type f -delete 2>/dev/null || true
    
    # Remove .egg-info directories
    find "$PROJECT_ROOT" -name "*.egg-info" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Remove build directories
    find "$PROJECT_ROOT" -name "build" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Remove dist directories
    find "$PROJECT_ROOT" -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
    
    log_success "Python cleanup completed"
}

# Cleanup log files
cleanup_logs() {
    log_info "Cleaning up old log files..."
    
    # Keep logs from last 30 days only
    find "$PROJECT_ROOT" -name "*.log" -type f -mtime +30 -delete 2>/dev/null || true
    
    # Clean MCP server logs older than 7 days
    if [ -d "$PROJECT_ROOT/mcp_servers/logs" ]; then
        find "$PROJECT_ROOT/mcp_servers/logs" -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
    fi
    
    log_success "Log cleanup completed"
}

# Cleanup temporary files
cleanup_temp() {
    log_info "Cleaning up temporary files..."
    
    # Remove temporary files
    find "$PROJECT_ROOT" -name "*.tmp" -type f -delete 2>/dev/null || true
    find "$PROJECT_ROOT" -name "*.temp" -type f -delete 2>/dev/null || true
    find "$PROJECT_ROOT" -name ".DS_Store" -type f -delete 2>/dev/null || true
    find "$PROJECT_ROOT" -name "Thumbs.db" -type f -delete 2>/dev/null || true
    
    # Remove editor backup files
    find "$PROJECT_ROOT" -name "*~" -type f -delete 2>/dev/null || true
    find "$PROJECT_ROOT" -name "*.swp" -type f -delete 2>/dev/null || true
    find "$PROJECT_ROOT" -name "*.swo" -type f -delete 2>/dev/null || true
    
    log_success "Temporary files cleanup completed"
}

# Check for large files
check_large_files() {
    log_info "Checking for large files (>100MB)..."
    
    large_files=$(find "$PROJECT_ROOT" -type f -size +100M 2>/dev/null || true)
    
    if [ -n "$large_files" ]; then
        log_warning "Large files found:"
        echo "$large_files" | while read -r file; do
            size=$(du -h "$file" | cut -f1)
            log_warning "  $file ($size)"
        done
    else
        log_success "No large files found"
    fi
}

# Check file count in root directory
check_root_files() {
    log_info "Checking root directory file count..."
    
    file_count=$(find "$PROJECT_ROOT" -maxdepth 1 -type f | wc -l)
    
    if [ "$file_count" -le 15 ]; then
        log_success "Root directory has $file_count files (within limit of 15)"
    else
        log_warning "Root directory has $file_count files (exceeds limit of 15)"
        log_info "Root directory files:"
        find "$PROJECT_ROOT" -maxdepth 1 -type f -exec basename {} \; | sort
    fi
}

# Dependency audit
audit_dependencies() {
    log_info "Auditing dependencies for security vulnerabilities..."
    
    # Node.js audit
    if [ -f "$PROJECT_ROOT/package.json" ] && command_exists npm; then
        log_info "Running npm audit..."
        cd "$PROJECT_ROOT"
        npm audit --audit-level=moderate 2>/dev/null || log_warning "npm audit found issues"
    fi
    
    # Python audit (if safety is installed)
    if command_exists safety; then
        log_info "Running Python safety check..."
        find "$PROJECT_ROOT" -name "requirements.txt" -exec safety check -r {} \; 2>/dev/null || log_warning "Python safety check found issues"
    fi
}

# Generate cleanup report
generate_report() {
    log_info "Generating cleanup report..."
    
    report_file="$PROJECT_ROOT/logs/cleanup-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# SongNodes Cleanup Report

**Date**: $(date)
**Project Root**: $PROJECT_ROOT

## Cleanup Summary

### Actions Performed
- Docker resources cleanup
- Node.js dependencies cleanup
- Python artifacts cleanup
- Log files cleanup (kept last 30 days)
- Temporary files cleanup

### Project Status
- Root directory file count: $(find "$PROJECT_ROOT" -maxdepth 1 -type f | wc -l)
- Total project size: $(du -sh "$PROJECT_ROOT" | cut -f1)
- Docker images: $(docker images | wc -l 2>/dev/null || echo "Docker not available")

### Large Files (>100MB)
$(find "$PROJECT_ROOT" -type f -size +100M -exec ls -lh {} \; 2>/dev/null | awk '{print $5" "$9}' || echo "None found")

### Next Maintenance
- Schedule next cleanup in 7 days
- Monitor disk usage
- Review dependency updates

---
Generated by SongNodes automated maintenance script
EOF

    log_success "Cleanup report generated: $report_file"
}

# Main cleanup function
main() {
    log_info "Starting automated maintenance..."
    
    # Record start time
    start_time=$(date +%s)
    
    # Perform cleanup tasks
    cleanup_docker
    cleanup_node
    cleanup_python
    cleanup_logs
    cleanup_temp
    
    # Perform checks
    check_large_files
    check_root_files
    audit_dependencies
    
    # Generate report
    generate_report
    
    # Calculate duration
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    log_success "Maintenance completed in ${duration} seconds"
    log_info "Check the cleanup report for details: $report_file"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --docker-only)
            log_info "Running Docker cleanup only..."
            cleanup_docker
            exit 0
            ;;
        --node-only)
            log_info "Running Node.js cleanup only..."
            cleanup_node
            exit 0
            ;;
        --python-only)
            log_info "Running Python cleanup only..."
            cleanup_python
            exit 0
            ;;
        --dry-run)
            log_info "Dry run mode - no actual cleanup will be performed"
            log_info "Would clean: Docker, Node.js, Python, logs, temp files"
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --docker-only    Clean only Docker resources"
            echo "  --node-only      Clean only Node.js artifacts"
            echo "  --python-only    Clean only Python artifacts"
            echo "  --dry-run        Show what would be cleaned without doing it"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "With no options, performs full cleanup."
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
main 2>&1 | tee "$CLEANUP_LOG"

log_success "Cleanup log saved to: $CLEANUP_LOG"