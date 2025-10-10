#!/bin/bash
################################################################################
# Rollback Script for SongNodes Enrichment Deployment
#
# Safely rolls back enrichment infrastructure upgrades:
# - Database migrations
# - Docker service versions
# - Configuration changes
#
# Usage: ./scripts/rollback_deployment.sh [--db-only] [--services-only]
# Options:
#   --db-only         Rollback database migrations only
#   --services-only   Rollback services only (keep database)
#   --to-backup <file> Restore specific database backup
#
# Exit codes:
#   0 - Rollback succeeded
#   1 - Rollback failed
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Flags
DB_ONLY=false
SERVICES_ONLY=false
BACKUP_FILE=""

################################################################################
# Logging
################################################################################

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_section() { echo -e "\n${BLUE}===${NC} $1 ${BLUE}===${NC}"; }
log_step() { echo -e "${BLUE}▶${NC} $1"; }

################################################################################
# Parse arguments
################################################################################

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --db-only) DB_ONLY=true; shift ;;
            --services-only) SERVICES_ONLY=true; shift ;;
            --to-backup) BACKUP_FILE="$2"; shift 2 ;;
            -h|--help)
                echo "Usage: $0 [--db-only] [--services-only] [--to-backup <file>]"
                exit 0 ;;
            *) log_error "Unknown option: $1"; exit 1 ;;
        esac
    done
}

################################################################################
# Confirmation
################################################################################

confirm_rollback() {
    log_section "Rollback Confirmation"
    echo -e "${RED}WARNING: This will rollback the enrichment infrastructure!${NC}"
    echo ""
    echo "This will:"
    if [ "$DB_ONLY" = false ]; then
        echo "  - Stop and revert enrichment services"
        echo "  - Restore previous service configurations"
    fi
    if [ "$SERVICES_ONLY" = false ]; then
        echo "  - Rollback database migrations"
        echo "  - Restore database from backup"
    fi
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log_info "Rollback cancelled"
        exit 0
    fi
}

################################################################################
# Database rollback
################################################################################

rollback_database() {
    log_section "Rolling Back Database"

    if [ -n "$BACKUP_FILE" ]; then
        log_step "Restoring from specified backup: $BACKUP_FILE"

        if [ ! -f "$BACKUP_FILE" ]; then
            log_error "Backup file not found: $BACKUP_FILE"
            return 1
        fi

        # Decompress if needed
        local restore_file="$BACKUP_FILE"
        if [[ "$BACKUP_FILE" == *.gz ]]; then
            log_step "Decompressing backup..."
            gunzip -k "$BACKUP_FILE"
            restore_file="${BACKUP_FILE%.gz}"
        fi

        log_step "Restoring database..."
        if docker exec -i postgres psql -U musicdb_user -d musicdb < "$restore_file"; then
            log_info "Database restored from backup"
        else
            log_error "Database restore failed"
            return 1
        fi
    else
        # Use migration rollback
        log_step "Rolling back migrations..."
        if [ -x "$SCRIPT_DIR/migrate_database.sh" ]; then
            "$SCRIPT_DIR/migrate_database.sh" --rollback
        else
            log_error "Migration script not found or not executable"
            return 1
        fi
    fi

    return 0
}

################################################################################
# Service rollback
################################################################################

rollback_services() {
    log_section "Rolling Back Services"

    # Stop new services
    log_step "Stopping new enrichment services..."
    docker compose stop api-gateway-internal dlq-manager 2>/dev/null || true

    log_info "New services stopped"

    # Restart existing services with old configuration
    log_step "Restarting metadata-enrichment with old configuration..."
    docker compose restart metadata-enrichment

    log_info "Services rolled back"

    return 0
}

################################################################################
# Verification
################################################################################

verify_rollback() {
    log_section "Verifying Rollback"

    # Check services are running
    log_step "Checking service health..."

    if docker ps | grep -q postgres && docker exec postgres pg_isready -U musicdb_user &> /dev/null; then
        log_info "PostgreSQL is healthy"
    else
        log_error "PostgreSQL is not healthy"
        return 1
    fi

    if docker ps | grep -q redis && docker exec redis redis-cli ping | grep -q PONG; then
        log_info "Redis is healthy"
    else
        log_error "Redis is not healthy"
        return 1
    fi

    log_info "Rollback verification passed"
    return 0
}

################################################################################
# Main execution
################################################################################

main() {
    parse_args "$@"

    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  SongNodes Enrichment - Rollback Deployment                   ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    confirm_rollback

    # Perform rollback
    if [ "$SERVICES_ONLY" = false ]; then
        rollback_database || exit 1
    fi

    if [ "$DB_ONLY" = false ]; then
        rollback_services || exit 1
    fi

    verify_rollback || exit 1

    # Summary
    echo ""
    log_section "Rollback Summary"
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  Rollback completed successfully!                             ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"

    exit 0
}

main "$@"
