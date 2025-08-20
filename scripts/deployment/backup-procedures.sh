#!/bin/bash
# Production Database Backup and Recovery Procedures
# Supports automated backups, point-in-time recovery, and disaster recovery

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/musicdb/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
LOG_FILE="${LOG_FILE:-/opt/musicdb/logs/backup.log}"
DB_CONTAINER="${DB_CONTAINER:-musicdb-postgres-blue}"
DB_USER="${DB_USER:-musicdb_user}"
DB_NAME="${DB_NAME:-musicdb}"
NOTIFICATION_WEBHOOK="${NOTIFICATION_WEBHOOK:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Send notification if webhook is configured
send_notification() {
    local status=$1
    local message=$2
    
    if [[ -n "$NOTIFICATION_WEBHOOK" ]]; then
        curl -X POST "$NOTIFICATION_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"MusicDB Backup $status\",
                \"blocks\": [{
                    \"type\": \"section\",
                    \"text\": {
                        \"type\": \"mrkdwn\",
                        \"text\": \"*MusicDB Production Backup*\\n$message\"
                    }
                }]
            }" 2>/dev/null || true
    fi
}

# Database connectivity check
check_database() {
    log "Checking database connectivity..."
    
    if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        success "Database connectivity verified"
        return 0
    else
        error "Database connectivity failed"
        return 1
    fi
}

# Full database backup
create_full_backup() {
    local backup_type=${1:-"manual"}
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/full_backup_${timestamp}.sql"
    
    log "Creating full database backup: $backup_file"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Create backup with compression
    docker exec "$DB_CONTAINER" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=custom \
        --compress=9 \
        > "${backup_file}.dump" 2>/dev/null
    
    # Also create plain SQL backup for easier inspection
    docker exec "$DB_CONTAINER" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --clean \
        --if-exists \
        --create \
        > "$backup_file" 2>/dev/null
    
    # Compress SQL backup
    gzip "$backup_file"
    
    # Verify backup integrity
    if [[ -f "${backup_file}.gz" ]] && [[ -f "${backup_file}.dump" ]]; then
        local sql_size=$(stat -c%s "${backup_file}.gz")
        local dump_size=$(stat -c%s "${backup_file}.dump")
        
        if [[ $sql_size -gt 1000 ]] && [[ $dump_size -gt 1000 ]]; then
            success "Full backup created successfully"
            success "SQL backup: ${backup_file}.gz ($(($sql_size / 1024))KB)"
            success "Custom backup: ${backup_file}.dump ($(($dump_size / 1024))KB)"
            
            # Calculate and store checksum
            local checksum=$(sha256sum "${backup_file}.gz" | cut -d' ' -f1)
            echo "$checksum" > "${backup_file}.gz.sha256"
            
            echo "${backup_file}.gz"
            return 0
        else
            error "Backup files are too small, backup may have failed"
            return 1
        fi
    else
        error "Backup creation failed"
        return 1
    fi
}

# Incremental backup using WAL
create_incremental_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$BACKUP_DIR/incremental_${timestamp}"
    
    log "Creating incremental backup: $backup_dir"
    
    mkdir -p "$backup_dir"
    
    # Use pg_basebackup for incremental backup
    docker exec "$DB_CONTAINER" pg_basebackup \
        -U "$DB_USER" \
        -D "/tmp/incremental_backup" \
        -F tar \
        -z \
        -P \
        -v \
        -W 2>/dev/null
    
    # Copy backup from container
    docker cp "$DB_CONTAINER:/tmp/incremental_backup" "$backup_dir/"
    
    if [[ -d "$backup_dir/incremental_backup" ]]; then
        success "Incremental backup created: $backup_dir"
        echo "$backup_dir"
        return 0
    else
        error "Incremental backup failed"
        return 1
    fi
}

# Database schema backup
backup_schema_only() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local schema_file="$BACKUP_DIR/schema_backup_${timestamp}.sql"
    
    log "Creating schema-only backup: $schema_file"
    
    docker exec "$DB_CONTAINER" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --schema-only \
        --verbose \
        > "$schema_file" 2>/dev/null
    
    gzip "$schema_file"
    
    if [[ -f "${schema_file}.gz" ]]; then
        success "Schema backup created: ${schema_file}.gz"
        echo "${schema_file}.gz"
        return 0
    else
        error "Schema backup failed"
        return 1
    fi
}

# Restore from backup
restore_database() {
    local backup_file=$1
    local restore_type=${2:-"full"}
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    log "Restoring database from: $backup_file"
    warning "This will overwrite the current database!"
    
    # Verify backup integrity
    if [[ "$backup_file" == *.gz ]]; then
        if ! gunzip -t "$backup_file" 2>/dev/null; then
            error "Backup file is corrupted"
            return 1
        fi
    fi
    
    # Stop application services during restore
    log "Stopping application services..."
    docker stop scraper-orchestrator-blue data-transformer-blue 2>/dev/null || true
    
    # Restore database
    case "$restore_type" in
        "full")
            if [[ "$backup_file" == *.dump ]]; then
                docker exec -i "$DB_CONTAINER" pg_restore \
                    -U "$DB_USER" \
                    -d "$DB_NAME" \
                    --clean \
                    --if-exists \
                    --verbose < "$backup_file"
            else
                zcat "$backup_file" | docker exec -i "$DB_CONTAINER" psql \
                    -U "$DB_USER" \
                    -d postgres
            fi
            ;;
        "schema")
            zcat "$backup_file" | docker exec -i "$DB_CONTAINER" psql \
                -U "$DB_USER" \
                -d "$DB_NAME"
            ;;
    esac
    
    # Restart application services
    log "Restarting application services..."
    docker start scraper-orchestrator-blue data-transformer-blue 2>/dev/null || true
    
    success "Database restore completed"
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $BACKUP_RETENTION_DAYS days"
    
    local deleted_count=0
    while IFS= read -r -d '' file; do
        rm "$file"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "*.sql.gz" -o -name "*.dump" -type f -mtime +$BACKUP_RETENTION_DAYS -print0)
    
    if [[ $deleted_count -gt 0 ]]; then
        success "Cleaned up $deleted_count old backup files"
    else
        log "No old backup files to clean up"
    fi
}

# Backup verification
verify_backup() {
    local backup_file=$1
    
    log "Verifying backup: $backup_file"
    
    # Check file exists and has content
    if [[ ! -f "$backup_file" ]] || [[ ! -s "$backup_file" ]]; then
        error "Backup file is missing or empty"
        return 1
    fi
    
    # Verify checksum if available
    if [[ -f "${backup_file}.sha256" ]]; then
        local stored_checksum=$(cat "${backup_file}.sha256")
        local actual_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
        
        if [[ "$stored_checksum" == "$actual_checksum" ]]; then
            success "Backup checksum verification passed"
        else
            error "Backup checksum verification failed"
            return 1
        fi
    fi
    
    # Test restore to temporary database (if requested)
    if [[ "${VERIFY_RESTORE:-false}" == "true" ]]; then
        log "Testing restore to temporary database..."
        # This would require additional setup for test database
        warning "Restore verification skipped (test database not configured)"
    fi
    
    success "Backup verification completed"
}

# Generate backup report
generate_backup_report() {
    local report_file="$BACKUP_DIR/backup_report_$(date +%Y%m%d).txt"
    
    cat > "$report_file" << EOF
MusicDB Production Backup Report
Generated: $(date)
================================

Backup Directory: $BACKUP_DIR
Retention Policy: $BACKUP_RETENTION_DAYS days

Recent Backups:
$(find "$BACKUP_DIR" -name "*.sql.gz" -o -name "*.dump" -type f -mtime -7 -exec ls -lh {} \; | head -20)

Disk Usage:
$(du -sh "$BACKUP_DIR")

Database Status:
$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_database(), current_user, version();" 2>/dev/null || echo "Database connection failed")

Storage Analysis:
$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;" 2>/dev/null || echo "Unable to get table sizes")

EOF
    
    success "Backup report generated: $report_file"
    echo "$report_file"
}

# Main function
main() {
    local action=${1:-"full"}
    local backup_file=${2:-""}
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")" "$BACKUP_DIR"
    
    case "$action" in
        "full")
            log "Starting full backup procedure"
            if check_database; then
                if backup_file=$(create_full_backup "scheduled"); then
                    verify_backup "$backup_file"
                    cleanup_old_backups
                    generate_backup_report
                    send_notification "SUCCESS" "Full backup completed successfully"
                    success "Full backup procedure completed"
                else
                    send_notification "FAILED" "Full backup failed"
                    error "Full backup procedure failed"
                    exit 1
                fi
            else
                send_notification "FAILED" "Database connectivity check failed"
                error "Cannot perform backup - database not accessible"
                exit 1
            fi
            ;;
        "incremental")
            log "Starting incremental backup procedure"
            if check_database; then
                create_incremental_backup
            fi
            ;;
        "schema")
            log "Starting schema backup procedure"
            if check_database; then
                backup_schema_only
            fi
            ;;
        "restore")
            if [[ -z "$backup_file" ]]; then
                error "Backup file required for restore operation"
                echo "Usage: $0 restore <backup_file> [full|schema]"
                exit 1
            fi
            restore_database "$backup_file" "${3:-full}"
            ;;
        "verify")
            if [[ -z "$backup_file" ]]; then
                error "Backup file required for verify operation"
                exit 1
            fi
            verify_backup "$backup_file"
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        "report")
            generate_backup_report
            ;;
        *)
            echo "Usage: $0 {full|incremental|schema|restore|verify|cleanup|report}"
            echo "Examples:"
            echo "  $0 full                              # Create full backup"
            echo "  $0 restore /path/to/backup.sql.gz   # Restore from backup"
            echo "  $0 verify /path/to/backup.sql.gz    # Verify backup integrity"
            echo "  $0 cleanup                          # Remove old backups"
            echo "  $0 report                           # Generate backup report"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"