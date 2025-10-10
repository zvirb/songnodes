#!/bin/bash
################################################################################
# Main Deployment Script for SongNodes Enrichment Infrastructure Upgrades
#
# Orchestrates complete deployment of:
# - Medallion Architecture (Bronze/Silver/Gold)
# - API Integration Gateway
# - Dead-Letter Queue Manager
# - Configuration-driven waterfall enrichment
# - Circuit breakers and resilience patterns
# - Enhanced observability
#
# Usage: ./scripts/deploy_enrichment_upgrades.sh [OPTIONS]
# Options:
#   --dry-run         Show what would be done without executing
#   --skip-tests      Skip smoke tests (not recommended)
#   --skip-backup     Skip database backup (not recommended)
#   --rollback        Rollback on any failure (default: true)
#   --no-rollback     Don't rollback on failure
#
# Exit codes:
#   0 - Deployment succeeded
#   1 - Deployment failed
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
DRY_RUN=false
SKIP_TESTS=false
SKIP_BACKUP=false
AUTO_ROLLBACK=true
DEPLOYMENT_START_TIME=$(date +%s)

################################################################################
# Logging
################################################################################

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_section() { echo -e "\n${MAGENTA}━━━${NC} $1 ${MAGENTA}━━━${NC}"; }
log_step() { echo -e "${BLUE}▶${NC} $1"; }

################################################################################
# Parse arguments
################################################################################

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run) DRY_RUN=true; shift ;;
            --skip-tests) SKIP_TESTS=true; shift ;;
            --skip-backup) SKIP_BACKUP=true; shift ;;
            --rollback) AUTO_ROLLBACK=true; shift ;;
            --no-rollback) AUTO_ROLLBACK=false; shift ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --dry-run         Show what would be done"
                echo "  --skip-tests      Skip smoke tests"
                echo "  --skip-backup     Skip database backup"
                echo "  --rollback        Rollback on failure (default)"
                echo "  --no-rollback     Don't rollback on failure"
                exit 0 ;;
            *) log_error "Unknown option: $1"; exit 1 ;;
        esac
    done
}

################################################################################
# Error handling
################################################################################

handle_deployment_failure() {
    local exit_code=$1
    local step="$2"

    log_error "Deployment failed at step: $step"
    log_error "Exit code: $exit_code"

    if [ "$AUTO_ROLLBACK" = true ] && [ "$DRY_RUN" = false ]; then
        log_warn "Initiating automatic rollback..."
        "$SCRIPT_DIR/rollback_deployment.sh" || {
            log_error "Rollback failed! Manual intervention required"
            exit 2
        }
        log_info "Rollback completed"
    else
        log_warn "Auto-rollback disabled - manual rollback may be required"
    fi

    exit $exit_code
}

################################################################################
# Pre-deployment checks
################################################################################

run_pre_deployment_checks() {
    log_section "Pre-Deployment Checks"

    log_step "Running environment validation..."
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would validate environment"
    else
        if ! "$SCRIPT_DIR/validate_environment.sh"; then
            log_error "Environment validation failed"
            return 1
        fi
    fi

    log_info "Pre-deployment checks passed"
    return 0
}

################################################################################
# Database migration
################################################################################

deploy_database_migrations() {
    log_section "Database Migrations"

    # Create backup if not skipped
    if [ "$SKIP_BACKUP" = false ]; then
        log_step "Creating database backup..."
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY RUN] Would create database backup"
        else
            # Backup is handled by migrate_database.sh
            log_info "Backup will be created by migration script"
        fi
    else
        log_warn "Skipping database backup (--skip-backup specified)"
    fi

    # Apply migrations
    log_step "Applying Medallion architecture migrations..."
    if [ "$DRY_RUN" = true ]; then
        if ! "$SCRIPT_DIR/migrate_database.sh" --dry-run; then
            return 1
        fi
    else
        if ! "$SCRIPT_DIR/migrate_database.sh"; then
            return 1
        fi
    fi

    log_info "Database migrations completed"
    return 0
}

################################################################################
# Service deployment
################################################################################

build_new_services() {
    log_section "Building Service Images"

    local services=("api-gateway-internal" "dlq-manager" "metadata-enrichment")

    for service in "${services[@]}"; do
        log_step "Building $service..."
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY RUN] Would build $service"
        else
            if docker compose build "$service" 2>&1 | grep -q "ERROR"; then
                log_error "Failed to build $service"
                return 1
            fi
            log_info "Built $service"
        fi
    done

    log_info "All service images built"
    return 0
}

deploy_new_services() {
    log_section "Deploying New Services"

    log_step "Starting API Gateway (Internal)..."
    if [ "$DRY_RUN" = false ]; then
        docker compose up -d api-gateway-internal || return 1
        sleep 5
    fi

    log_step "Starting DLQ Manager..."
    if [ "$DRY_RUN" = false ]; then
        docker compose up -d dlq-manager || return 1
        sleep 5
    fi

    log_info "New services deployed"
    return 0
}

update_existing_services() {
    log_section "Updating Existing Services"

    log_step "Restarting metadata-enrichment with new configuration..."
    if [ "$DRY_RUN" = false ]; then
        docker compose up -d --force-recreate metadata-enrichment || return 1
        sleep 5
    fi

    log_info "Existing services updated"
    return 0
}

################################################################################
# Health checks
################################################################################

verify_service_health() {
    log_section "Service Health Verification"

    log_step "Waiting for services to be healthy..."
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would verify service health"
        return 0
    fi

    if ! "$SCRIPT_DIR/comprehensive_health_check.sh" --wait --timeout 60; then
        log_error "Service health check failed"
        return 1
    fi

    log_info "All services are healthy"
    return 0
}

################################################################################
# Smoke tests
################################################################################

run_smoke_tests() {
    log_section "Smoke Tests"

    if [ "$SKIP_TESTS" = true ]; then
        log_warn "Skipping smoke tests (--skip-tests specified)"
        return 0
    fi

    log_step "Running smoke test suite..."
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run smoke tests"
        return 0
    fi

    if ! "$SCRIPT_DIR/smoke_tests.sh"; then
        log_error "Smoke tests failed"
        return 1
    fi

    log_info "All smoke tests passed"
    return 0
}

################################################################################
# Post-deployment
################################################################################

enable_monitoring() {
    log_section "Monitoring Setup"

    log_step "Verifying Prometheus targets..."
    if [ "$DRY_RUN" = false ]; then
        if docker ps | grep -q prometheus; then
            log_info "Prometheus is running"
        else
            log_warn "Prometheus is not running (optional)"
        fi
    fi

    log_step "Verifying Grafana dashboards..."
    if [ "$DRY_RUN" = false ]; then
        if docker ps | grep -q grafana; then
            log_info "Grafana is running"
        else
            log_warn "Grafana is not running (optional)"
        fi
    fi

    return 0
}

print_deployment_summary() {
    log_section "Deployment Summary"

    local deployment_end_time=$(date +%s)
    local deployment_duration=$((deployment_end_time - DEPLOYMENT_START_TIME))
    local minutes=$((deployment_duration / 60))
    local seconds=$((deployment_duration % 60))

    echo ""
    echo "┌────────────────────────────────────────────────────────────┐"
    echo "│                   Deployment Completed                     │"
    echo "├────────────────────────────────────────────────────────────┤"
    echo "│ Duration: ${minutes}m ${seconds}s                                          │"
    echo "│                                                            │"
    echo "│ Deployed Components:                                       │"
    echo "│   ✓ Medallion Architecture (Bronze/Silver/Gold)           │"
    echo "│   ✓ API Integration Gateway                               │"
    echo "│   ✓ Dead-Letter Queue Manager                             │"
    echo "│   ✓ Configuration-driven Enrichment                       │"
    echo "│   ✓ Circuit Breakers & Resilience                         │"
    echo "│                                                            │"
    echo "│ Service Endpoints:                                         │"
    echo "│   - API Gateway:     http://localhost:8022                │"
    echo "│   - DLQ Manager:     http://localhost:8021                │"
    echo "│   - Enrichment:      http://localhost:8020                │"
    echo "│   - Prometheus:      http://localhost:9091                │"
    echo "│   - Grafana:         http://localhost:3001                │"
    echo "│                                                            │"
    echo "│ Next Steps:                                                │"
    echo "│   1. Monitor service logs: docker compose logs -f         │"
    echo "│   2. Check metrics: http://localhost:9091                 │"
    echo "│   3. View dashboards: http://localhost:3001               │"
    echo "│   4. Run full tests: npm run test:e2e                     │"
    echo "└────────────────────────────────────────────────────────────┘"
    echo ""
}

################################################################################
# Main execution
################################################################################

main() {
    parse_args "$@"

    echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║${NC}  SongNodes Enrichment Infrastructure - Deployment Automation ${MAGENTA}║${NC}"
    echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        log_warn "Running in DRY RUN mode - no changes will be applied"
        echo ""
    fi

    # Pre-deployment
    run_pre_deployment_checks || handle_deployment_failure $? "Pre-deployment checks"

    # Database migrations
    deploy_database_migrations || handle_deployment_failure $? "Database migrations"

    # Service deployment
    build_new_services || handle_deployment_failure $? "Building services"
    deploy_new_services || handle_deployment_failure $? "Deploying new services"
    update_existing_services || handle_deployment_failure $? "Updating existing services"

    # Verification
    verify_service_health || handle_deployment_failure $? "Service health verification"
    run_smoke_tests || handle_deployment_failure $? "Smoke tests"

    # Post-deployment
    enable_monitoring

    # Summary
    print_deployment_summary

    # Success
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  Deployment completed successfully!                           ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo ""
        log_info "This was a DRY RUN - no changes were applied"
        log_info "Run without --dry-run to deploy for real"
    fi

    exit 0
}

# Set up trap for unexpected errors
trap 'handle_deployment_failure $? "Unexpected error"' ERR

main "$@"
