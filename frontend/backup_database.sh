#!/bin/bash
# Automated database backup script for SongNodes
# Creates incremental backups with rotation

set -e

# Configuration
BACKUP_DIR="./backups"
COMPOSE_FILE="docker-compose.yml"
DB_SERVICE="postgres"
DB_USER="musicdb_user"
DB_NAME="musicdb"
RETENTION_DAYS=30
MAX_BACKUPS=50

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Get timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/musicdb_backup_$TIMESTAMP.sql"
TARGET_TRACKS_FILE="$BACKUP_DIR/target_tracks_backup_$TIMESTAMP.sql"

echo "🚀 Starting database backup at $(date)"

# Check if Docker Compose is running
if ! docker compose ps | grep -q "Up"; then
    echo "⚠️ Warning: Some Docker services are not running"
    echo "   Current services status:"
    docker compose ps
fi

# Create full database backup
echo "📦 Creating full database backup..."
docker compose exec -T $DB_SERVICE pg_dump -U $DB_USER --verbose --format=custom --no-owner $DB_NAME > "${BACKUP_FILE%.sql}.dump"

# Create SQL backup for easy restoration
echo "📝 Creating SQL backup..."
docker compose exec -T $DB_SERVICE pg_dump -U $DB_USER $DB_NAME > "$BACKUP_FILE"

# Create target_tracks specific backup
echo "🎯 Creating target_tracks backup..."
docker compose exec -T $DB_SERVICE pg_dump -U $DB_USER -t target_tracks $DB_NAME > "$TARGET_TRACKS_FILE"

# Verify backups were created
if [[ -f "$BACKUP_FILE" && -s "$BACKUP_FILE" ]]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ SQL backup created: $BACKUP_FILE ($BACKUP_SIZE)"
else
    echo "❌ ERROR: SQL backup failed or is empty"
    exit 1
fi

if [[ -f "$TARGET_TRACKS_FILE" && -s "$TARGET_TRACKS_FILE" ]]; then
    TARGET_SIZE=$(du -h "$TARGET_TRACKS_FILE" | cut -f1)
    echo "✅ Target tracks backup created: $TARGET_TRACKS_FILE ($TARGET_SIZE)"
else
    echo "❌ ERROR: Target tracks backup failed or is empty"
    exit 1
fi

# Create backup metadata
cat > "${BACKUP_FILE%.sql}.meta" << EOF
{
  "timestamp": "$TIMESTAMP",
  "backup_type": "full",
  "database": "$DB_NAME",
  "created_at": "$(date -Iseconds)",
  "files": {
    "sql_dump": "$(basename $BACKUP_FILE)",
    "custom_dump": "$(basename ${BACKUP_FILE%.sql}.dump)",
    "target_tracks": "$(basename $TARGET_TRACKS_FILE)"
  },
  "sizes": {
    "sql_dump": "$BACKUP_SIZE",
    "target_tracks": "$TARGET_SIZE"
  }
}
EOF

# Clean up old backups (keep last $MAX_BACKUPS files)
echo "🧹 Cleaning up old backups..."
cd "$BACKUP_DIR"

# Remove files older than RETENTION_DAYS
find . -name "musicdb_backup_*.sql" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find . -name "musicdb_backup_*.dump" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find . -name "target_tracks_backup_*.sql" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find . -name "*.meta" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# Keep only the most recent MAX_BACKUPS files
ls -t musicdb_backup_*.sql 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm
ls -t musicdb_backup_*.dump 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm
ls -t target_tracks_backup_*.sql 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm

cd - > /dev/null

# Summary
echo "📊 Backup Summary:"
echo "   Full backup: $BACKUP_FILE"
echo "   Target tracks: $TARGET_TRACKS_FILE"
echo "   Custom format: ${BACKUP_FILE%.sql}.dump"
echo "   Total backups in directory: $(ls -1 $BACKUP_DIR/musicdb_backup_*.sql 2>/dev/null | wc -l)"

echo "✅ Database backup completed successfully at $(date)"

# Test restoration capability (optional - only if requested)
if [[ "$1" == "--test-restore" ]]; then
    echo "🧪 Testing backup restoration capability..."
    TEMP_DB="musicdb_restore_test_$(date +%s)"

    # Create temporary database for testing
    docker compose exec $DB_SERVICE createdb -U $DB_USER $TEMP_DB 2>/dev/null || true

    # Test restore
    if docker compose exec -T $DB_SERVICE psql -U $DB_USER $TEMP_DB < "$BACKUP_FILE" > /dev/null 2>&1; then
        echo "✅ Backup restoration test PASSED"
    else
        echo "❌ Backup restoration test FAILED"
    fi

    # Cleanup test database
    docker compose exec $DB_SERVICE dropdb -U $DB_USER $TEMP_DB 2>/dev/null || true
fi