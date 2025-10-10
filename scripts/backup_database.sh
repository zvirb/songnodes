#!/bin/bash
################################################################################
# Database Backup Script for SongNodes
#
# Creates compressed backup of PostgreSQL database
#
# Usage: ./scripts/backup_database.sh [backup-name]
#
# Exit codes:
#   0 - Backup succeeded
#   1 - Backup failed
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

# Configuration
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Custom backup name or default
if [ $# -gt 0 ]; then
    BACKUP_NAME="$1"
else
    BACKUP_NAME="musicdb_backup_$TIMESTAMP"
fi

BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql.gz"

log_section "Database Backup"
log_step "Creating backup: $BACKUP_FILE"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Perform backup
log_step "Dumping database..."
cd /mnt/my_external_drive/programming/songnodes

if docker compose exec -T postgres pg_dump -U musicdb_user musicdb | gzip > "$BACKUP_FILE"; then
    log_info "Backup created successfully"
else
    log_error "Backup failed"
    exit 1
fi

# Verify backup integrity
log_step "Verifying backup integrity..."
if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    log_info "Backup integrity verified"
else
    log_error "Backup verification failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Calculate backup size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_info "Backup size: $SIZE"

# Log to backup log
echo "$(date): Backup successful - $BACKUP_FILE ($SIZE)" >> "$BACKUP_DIR/backup.log"

# Clean up old backups (keep last 30 days)
log_step "Cleaning up old backups..."
find "$BACKUP_DIR" -name "musicdb_backup_*.sql.gz" -mtime +30 -delete

# Keep at least last 48 backups regardless of age
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/musicdb_backup_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 48 ]; then
    ls -t "$BACKUP_DIR"/musicdb_backup_*.sql.gz | tail -n +49 | xargs -r rm
    log_info "Cleaned up old backups (kept last 48)"
fi

# Summary
log_section "Backup Complete"
log_info "Backup file: $BACKUP_FILE"
log_info "Backup size: $SIZE"
log_info "Total backups: $(ls -1 "$BACKUP_DIR"/musicdb_backup_*.sql.gz 2>/dev/null | wc -l)"

echo ""
echo "To restore this backup:"
echo "  ./scripts/restore_database.sh $BACKUP_FILE"
echo ""

exit 0
