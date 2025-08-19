#!/bin/bash

# SongNodes Dependency Update Script
# Automated dependency updates for the SongNodes project

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
UPDATE_LOG="$PROJECT_ROOT/logs/dependency-update-$(date +%Y%m%d-%H%M%S).log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Start update process
log_info "Starting SongNodes dependency update..."
log_info "Project root: $PROJECT_ROOT"
log_info "Update log: $UPDATE_LOG"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Backup current dependencies
backup_dependencies() {
    log_info "Creating dependency backup..."
    
    backup_dir="$PROJECT_ROOT/backups/dependencies-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup package.json files
    find "$PROJECT_ROOT" -name "package.json" -not -path "*/node_modules/*" -exec cp {} "$backup_dir/" \; 2>/dev/null || true
    
    # Backup requirements.txt files
    find "$PROJECT_ROOT" -name "requirements.txt" -not -path "*/venv/*" -exec cp {} "$backup_dir/" \; 2>/dev/null || true
    
    # Backup lock files
    find "$PROJECT_ROOT" -name "package-lock.json" -not -path "*/node_modules/*" -exec cp {} "$backup_dir/" \; 2>/dev/null || true
    find "$PROJECT_ROOT" -name "uv.lock" -not -path "*/venv/*" -exec cp {} "$backup_dir/" \; 2>/dev/null || true
    
    log_success "Dependencies backed up to: $backup_dir"
    echo "$backup_dir" > "$PROJECT_ROOT/.last_dependency_backup"
}

# Update Node.js dependencies
update_node_dependencies() {
    log_info "Updating Node.js dependencies..."
    
    # Find all package.json files
    find "$PROJECT_ROOT" -name "package.json" -not -path "*/node_modules/*" | while read -r package_file; do
        local dir=$(dirname "$package_file")
        local service_name=$(basename "$dir")
        
        log_info "Updating dependencies for: $service_name"
        
        cd "$dir"
        
        if command_exists npm; then
            # Check for outdated packages
            log_info "Checking outdated packages..."
            npm outdated || true
            
            # Update dependencies
            log_info "Updating npm dependencies..."
            npm update 2>/dev/null || log_warning "Some npm updates failed"
            
            # Audit for vulnerabilities
            log_info "Running security audit..."
            npm audit fix --force 2>/dev/null || log_warning "Some security issues could not be automatically fixed"
            
            log_success "Updated dependencies for $service_name"
        else
            log_warning "npm not found, skipping Node.js updates"
        fi
    done
}

# Update Python dependencies
update_python_dependencies() {
    log_info "Updating Python dependencies..."
    
    # Find all requirements.txt files
    find "$PROJECT_ROOT" -name "requirements.txt" -not -path "*/venv/*" | while read -r requirements_file; do
        local dir=$(dirname "$requirements_file")
        local service_name=$(basename "$dir")
        
        log_info "Updating Python dependencies for: $service_name"
        
        cd "$dir"
        
        # Check if virtual environment exists
        if [ -d "venv" ]; then
            log_info "Activating virtual environment..."
            source venv/bin/activate
        fi
        
        if command_exists pip; then
            # Show outdated packages
            log_info "Checking outdated packages..."
            pip list --outdated 2>/dev/null || true
            
            # Update packages
            log_info "Updating pip packages..."
            pip install --upgrade -r "$requirements_file" 2>/dev/null || log_warning "Some pip updates failed"
            
            # Generate new requirements with versions
            pip freeze > "${requirements_file}.new"
            
            log_success "Updated Python dependencies for $service_name"
        elif command_exists uv; then
            log_info "Using uv for updates..."
            uv sync --upgrade 2>/dev/null || log_warning "uv sync failed"
            log_success "Updated Python dependencies for $service_name with uv"
        else
            log_warning "Neither pip nor uv found, skipping Python updates"
        fi
        
        # Deactivate virtual environment if it was activated
        if [ -n "$VIRTUAL_ENV" ]; then
            deactivate 2>/dev/null || true
        fi
    done
}

# Update Docker base images
update_docker_images() {
    log_info "Updating Docker base images..."
    
    if command_exists docker; then
        # Find all Dockerfiles
        find "$PROJECT_ROOT" -name "Dockerfile" | while read -r dockerfile; do
            local dir=$(dirname "$dockerfile")
            local service_name=$(basename "$dir")
            
            log_info "Checking Docker image for: $service_name"
            
            # Extract base image
            local base_image=$(grep "^FROM" "$dockerfile" | head -1 | awk '{print $2}')
            
            if [ -n "$base_image" ]; then
                log_info "Pulling latest $base_image..."
                docker pull "$base_image" 2>/dev/null || log_warning "Failed to pull $base_image"
            fi
        done
        
        # Clean up old images
        docker image prune -f 2>/dev/null || true
        
        log_success "Docker images updated"
    else
        log_warning "Docker not found, skipping Docker updates"
    fi
}

# Update system packages (if running in container)
update_system_packages() {
    log_info "Checking for system package updates..."
    
    if command_exists apt-get; then
        log_info "Updating apt packages..."
        apt-get update >/dev/null 2>&1 || log_warning "apt-get update failed"
        apt-get list --upgradable 2>/dev/null || true
    elif command_exists yum; then
        log_info "Checking yum updates..."
        yum check-update 2>/dev/null || true
    elif command_exists brew; then
        log_info "Updating Homebrew packages..."
        brew update >/dev/null 2>&1 || log_warning "brew update failed"
        brew outdated || log_info "All Homebrew packages are up to date"
    else
        log_info "No recognized package manager found"
    fi
}

# Run security scans
run_security_scans() {
    log_info "Running security scans..."
    
    # Node.js security audit
    find "$PROJECT_ROOT" -name "package.json" -not -path "*/node_modules/*" | while read -r package_file; do
        local dir=$(dirname "$package_file")
        local service_name=$(basename "$dir")
        
        cd "$dir"
        
        if command_exists npm; then
            log_info "Security audit for $service_name..."
            npm audit --audit-level=moderate 2>/dev/null || log_warning "Security issues found in $service_name"
        fi
    done
    
    # Python security scan
    if command_exists safety; then
        log_info "Running Python safety scan..."
        find "$PROJECT_ROOT" -name "requirements.txt" -not -path "*/venv/*" -exec safety check -r {} \; 2>/dev/null || log_warning "Python security issues found"
    fi
    
    # Docker image vulnerability scan
    if command_exists docker && command_exists trivy; then
        log_info "Scanning Docker images for vulnerabilities..."
        docker images --format "table {{.Repository}}:{{.Tag}}" | grep -v "REPOSITORY" | while read -r image; do
            trivy image "$image" 2>/dev/null || log_warning "Vulnerabilities found in $image"
        done
    fi
}

# Generate update report
generate_update_report() {
    log_info "Generating update report..."
    
    report_file="$PROJECT_ROOT/logs/dependency-update-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# SongNodes Dependency Update Report

**Date**: $(date)
**Project Root**: $PROJECT_ROOT

## Update Summary

### Node.js Dependencies
$(find "$PROJECT_ROOT" -name "package.json" -not -path "*/node_modules/*" | while read -r package_file; do
    local dir=$(dirname "$package_file")
    local service_name=$(basename "$dir")
    echo "- **$service_name**: Updated"
done)

### Python Dependencies
$(find "$PROJECT_ROOT" -name "requirements.txt" -not -path "*/venv/*" | while read -r requirements_file; do
    local dir=$(dirname "$requirements_file")
    local service_name=$(basename "$dir")
    echo "- **$service_name**: Updated"
done)

### Docker Images
$(find "$PROJECT_ROOT" -name "Dockerfile" | while read -r dockerfile; do
    local dir=$(dirname "$dockerfile")
    local service_name=$(basename "$dir")
    local base_image=$(grep "^FROM" "$dockerfile" | head -1 | awk '{print $2}')
    echo "- **$service_name**: $base_image"
done)

### Security Status
- Node.js audit: Run \`npm audit\` in each service directory
- Python safety: $(command_exists safety && echo "Available" || echo "Not installed")
- Docker scan: $(command_exists trivy && echo "Available" || echo "Not installed")

### Backup Location
$(cat "$PROJECT_ROOT/.last_dependency_backup" 2>/dev/null || echo "No backup created")

### Next Steps
1. Test all services after updates
2. Run full test suite
3. Monitor for any issues
4. Update documentation if needed

### Recommended Actions
- Review changelog for major version updates
- Test critical functionality
- Monitor performance metrics
- Schedule next update in 2 weeks

---
Generated by SongNodes automated dependency update script
EOF

    log_success "Update report generated: $report_file"
}

# Test services after update
test_services() {
    log_info "Testing services after update..."
    
    cd "$PROJECT_ROOT"
    
    # Test if package.json scripts exist and run them
    if [ -f "package.json" ] && command_exists npm; then
        if npm run | grep -q "test"; then
            log_info "Running tests..."
            npm test 2>/dev/null || log_warning "Some tests failed"
        fi
        
        if npm run | grep -q "lint"; then
            log_info "Running linting..."
            npm run lint 2>/dev/null || log_warning "Linting issues found"
        fi
    fi
    
    # Test Docker services
    if command_exists docker-compose; then
        log_info "Testing Docker services..."
        docker-compose config >/dev/null 2>&1 && log_success "Docker Compose configuration is valid" || log_warning "Docker Compose configuration has issues"
    fi
}

# Main update function
main() {
    log_info "Starting automated dependency update..."
    
    # Record start time
    start_time=$(date +%s)
    
    # Create backup before updates
    backup_dependencies
    
    # Perform updates
    update_node_dependencies
    update_python_dependencies
    update_docker_images
    update_system_packages
    
    # Run security scans
    run_security_scans
    
    # Test services
    test_services
    
    # Generate report
    generate_update_report
    
    # Calculate duration
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    log_success "Dependency update completed in ${duration} seconds"
    log_info "Check the update report for details: $report_file"
    log_warning "Please test your services thoroughly after these updates"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --node-only)
            log_info "Updating Node.js dependencies only..."
            backup_dependencies
            update_node_dependencies
            exit 0
            ;;
        --python-only)
            log_info "Updating Python dependencies only..."
            backup_dependencies
            update_python_dependencies
            exit 0
            ;;
        --docker-only)
            log_info "Updating Docker images only..."
            update_docker_images
            exit 0
            ;;
        --security-only)
            log_info "Running security scans only..."
            run_security_scans
            exit 0
            ;;
        --dry-run)
            log_info "Dry run mode - no actual updates will be performed"
            log_info "Would update: Node.js, Python, Docker, system packages"
            log_info "Would run: Security scans and tests"
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --node-only      Update only Node.js dependencies"
            echo "  --python-only    Update only Python dependencies"
            echo "  --docker-only    Update only Docker images"
            echo "  --security-only  Run only security scans"
            echo "  --dry-run        Show what would be updated without doing it"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "With no options, performs full dependency update."
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
main 2>&1 | tee "$UPDATE_LOG"

log_success "Update log saved to: $UPDATE_LOG"