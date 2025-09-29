#!/bin/bash

# SongNodes Volume Backup System - 2025 Best Practices
# Implements named volume backup with compression and rotation

set -euo pipefail

# Configuration
BACKUP_DIR="./backups/volumes"
RETENTION_DAYS=30
MAX_BACKUPS=50
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Function to backup a volume using a temporary container
backup_volume() {
    local volume_name="$1"
    local backup_filename="${BACKUP_DIR}/${volume_name}_backup_${TIMESTAMP}.tar.gz"

    log "Backing up volume: $volume_name"

    if docker volume inspect "$volume_name" >/dev/null 2>&1; then
        docker run --rm \
            -v "${volume_name}:/source:ro" \
            -v "$(pwd)/${BACKUP_DIR}:/backup" \
            alpine:latest \
            tar czf "/backup/$(basename "$backup_filename")" -C /source .

        if [ -f "$backup_filename" ]; then
            local size=$(du -h "$backup_filename" | cut -f1)
            log "✅ Backup completed: $backup_filename (${size})"

            # Create metadata file
            cat > "${backup_filename}.meta" << EOF
{
  "volume_name": "$volume_name",
  "backup_timestamp": "$(date -Iseconds)",
  "backup_size": "$size",
  "docker_version": "$(docker --version)",
  "hostname": "$(hostname)"
}
EOF
        else
            error "❌ Backup failed for volume: $volume_name"
            return 1
        fi
    else
        warn "⚠️  Volume $volume_name does not exist, skipping"
    fi
}

# Function to restore a volume from backup
restore_volume() {
    local volume_name="$1"
    local backup_file="$2"

    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        return 1
    fi

    warn "This will COMPLETELY REPLACE the contents of volume: $volume_name"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Restore cancelled"
        return 0
    fi

    # Create volume if it doesn't exist
    if ! docker volume inspect "$volume_name" >/dev/null 2>&1; then
        log "Creating volume: $volume_name"
        docker volume create "$volume_name"
    fi

    log "Restoring volume: $volume_name from $backup_file"
    docker run --rm \
        -v "${volume_name}:/target" \
        -v "$(pwd):/backup" \
        alpine:latest \
        sh -c "cd /target && tar xzf /backup/$backup_file"

    log "✅ Restore completed for volume: $volume_name"
}

# Function to clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."

    find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.meta" -type f -mtime +$RETENTION_DAYS -delete

    # Also limit total number of backups per volume
    for volume_pattern in postgres_data redis_data rabbitmq_data; do
        local backup_count=$(find "$BACKUP_DIR" -name "${volume_pattern}_backup_*.tar.gz" | wc -l)
        if [ "$backup_count" -gt "$MAX_BACKUPS" ]; then
            warn "Volume $volume_pattern has $backup_count backups, cleaning oldest"
            find "$BACKUP_DIR" -name "${volume_pattern}_backup_*.tar.gz" | sort | head -n $(($backup_count - $MAX_BACKUPS)) | xargs rm -f
        fi
    done
}

# Function to list available backups
list_backups() {
    log "Available backups:"
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A "$BACKUP_DIR")" ]; then
        for backup in "$BACKUP_DIR"/*.tar.gz; do
            if [ -f "$backup" ]; then
                local size=$(du -h "$backup" | cut -f1)
                local date=$(stat -c %y "$backup" | cut -d' ' -f1,2 | cut -d'.' -f1)
                echo "  $(basename "$backup") - $size - $date"
            fi
        done
    else
        warn "No backups found in $BACKUP_DIR"
    fi
}

# Function to get volume statistics
volume_stats() {
    log "Volume Statistics:"
    echo "==================="

    for volume in songnodes_postgres_data songnodes_redis_data songnodes_rabbitmq_data songnodes_grafana_data; do
        if docker volume inspect "$volume" >/dev/null 2>&1; then
            local size=$(docker run --rm -v "${volume}:/data:ro" alpine:latest du -sh /data | cut -f1)
            echo "$volume: $size"
        fi
    done
}

# Main script logic
case "${1:-}" in
    "backup")
        log "🗂️  Starting volume backup process..."

        # Backup critical data volumes
        backup_volume "songnodes_postgres_data" || warn "PostgreSQL backup failed"
        backup_volume "songnodes_redis_data" || warn "Redis backup failed"
        backup_volume "songnodes_rabbitmq_data" || warn "RabbitMQ backup failed"
        backup_volume "songnodes_grafana_data" || warn "Grafana backup failed"

        cleanup_old_backups
        log "✅ Backup process completed"
        ;;
    "restore")
        if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
            error "Usage: $0 restore <volume_name> <backup_file>"
            exit 1
        fi
        restore_volume "$2" "$3"
        ;;
    "list")
        list_backups
        ;;
    "stats")
        volume_stats
        ;;
    "test")
        log "🧪 Testing backup and restore functionality..."

        # Create test volume
        TEST_VOLUME="test_backup_volume"
        docker volume create "$TEST_VOLUME"

        # Add test data
        docker run --rm -v "${TEST_VOLUME}:/test" alpine:latest sh -c "echo 'test data' > /test/test.txt"

        # Backup test volume
        backup_volume "$TEST_VOLUME"

        # Remove volume
        docker volume rm "$TEST_VOLUME"

        # Find the latest test backup
        LATEST_BACKUP=$(find "$BACKUP_DIR" -name "${TEST_VOLUME}_backup_*.tar.gz" | sort -r | head -n 1)

        if [ -n "$LATEST_BACKUP" ]; then
            # Restore test volume
            restore_volume "$TEST_VOLUME" "$LATEST_BACKUP" <<< "y"

            # Verify data
            TEST_DATA=$(docker run --rm -v "${TEST_VOLUME}:/test:ro" alpine:latest cat /test/test.txt)
            if [ "$TEST_DATA" = "test data" ]; then
                log "✅ Backup and restore test PASSED"
            else
                error "❌ Backup and restore test FAILED"
            fi

            # Cleanup
            docker volume rm "$TEST_VOLUME"
            rm -f "$LATEST_BACKUP" "${LATEST_BACKUP}.meta"
        else
            error "❌ Test backup file not found"
        fi
        ;;
    *)
        echo "SongNodes Volume Backup System - 2025 Best Practices"
        echo ""
        echo "Usage: $0 <command> [arguments]"
        echo ""
        echo "Commands:"
        echo "  backup              - Backup all critical volumes"
        echo "  restore <vol> <file> - Restore volume from backup file"
        echo "  list                - List available backups"
        echo "  stats               - Show volume size statistics"
        echo "  test                - Test backup and restore functionality"
        echo ""
        echo "Examples:"
        echo "  $0 backup"
        echo "  $0 restore songnodes_postgres_data postgres_data_backup_20251001_120000.tar.gz"
        echo "  $0 list"
        echo ""
        ;;
esac