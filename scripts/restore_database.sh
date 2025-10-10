#!/bin/bash
################################################################################
# Database Restore Script for SongNodes
#
# Restores PostgreSQL database from backup file
#
# Usage: ./scripts/restore_database.sh <backup-file>
#
# Exit codes:
#   0 - Restore succeeded
#   1 - Restore failed
################################################################################

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_section() { echo -e "\n${BLUE}===${NC} $1 ${BLUE}===${NC}"; }
log_step() { echo -e "${BLUE}▶${NC} $1"; }

# Check arguments
if [ $# -eq 0 ]; then
    log_error "Usage: $0 <backup-file>"
    exit 1
fi

BACKUP_FILE="$1"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

log_section "Database Restore"
log_step "Backup file: $BACKUP_FILE"

# Verify backup integrity
log_step "Verifying backup integrity..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
        log_info "Backup file is valid (gzip)"
    else
        log_error "Backup file is corrupted"
        exit 1
    fi
fi

# Confirmation
log_warn "WARNING: This will overwrite the current database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log_info "Restore cancelled"
    exit 0
fi

# Stop services (except PostgreSQL)
log_step "Stopping services..."
cd /mnt/my_external_drive/programming/songnodes
docker compose stop rest-api graph-api websocket-api metadata-enrichment api-gateway-internal dlq-manager scraper-mixesdb scraper-1001tracklists scraper-ra || true

# Wait for connections to close
log_step "Waiting for database connections to close..."
sleep 5

# Restore database
log_step "Restoring database (this may take several minutes)..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U musicdb_user -d musicdb
else
    docker compose exec -T postgres psql -U musicdb_user -d musicdb < "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
    log_info "Database restored successfully"
else
    log_error "Database restore failed"
    exit 1
fi

# Verify database
log_step "Verifying database integrity..."
TRACK_COUNT=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c "SELECT COUNT(*) FROM tracks;" | xargs)
log_info "Track count: $TRACK_COUNT"

if [ "$TRACK_COUNT" -eq 0 ]; then
    log_warn "WARNING: No tracks found in database!"
fi

# Restart services
log_step "Restarting services..."
docker compose up -d

log_section "Restore Complete"
log_info "Database restored from: $BACKUP_FILE"
log_info "Track count: $TRACK_COUNT"
log_warn "IMPORTANT: Run ./scripts/validate_database.sh to verify integrity"

exit 0
