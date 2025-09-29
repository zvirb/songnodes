#!/bin/bash
# Database restoration script for SongNodes
# Restores from backup with safety checks

set -e

# Configuration
BACKUP_DIR="./backups"
DB_SERVICE="postgres"
DB_USER="musicdb_user"
DB_NAME="musicdb"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: $0 [OPTIONS] [BACKUP_FILE]"
    echo ""
    echo "Options:"
    echo "  --list              List available backups"
    echo "  --latest            Restore from latest backup"
    echo "  --target-only       Restore only target_tracks table"
    echo "  --test-restore      Test restore without affecting main database"
    echo "  --force             Skip confirmation prompts"
    echo ""
    echo "Examples:"
    echo "  $0 --list"
    echo "  $0 --latest"
    echo "  $0 --target-only backup_file.sql"
    echo "  $0 backups/musicdb_backup_20250930_010203.sql"
}

list_backups() {
    echo "📋 Available backups:"
    echo ""

    if ! ls -1 "$BACKUP_DIR"/musicdb_backup_*.sql >/dev/null 2>&1; then
        echo "❌ No backups found in $BACKUP_DIR"
        exit 1
    fi

    echo "Full Database Backups:"
    ls -lth "$BACKUP_DIR"/musicdb_backup_*.sql | while read -r line; do
        file=$(echo "$line" | awk '{print $9}')
        size=$(echo "$line" | awk '{print $5}')
        date=$(echo "$line" | awk '{print $6 " " $7 " " $8}')

        # Extract timestamp from filename
        timestamp=$(basename "$file" | sed 's/musicdb_backup_//' | sed 's/.sql//')

        echo "  📦 $timestamp - $size - $date"
        echo "      File: $(basename "$file")"

        # Show metadata if available
        meta_file="${file%.sql}.meta"
        if [[ -f "$meta_file" ]]; then
            created_at=$(grep '"created_at"' "$meta_file" | cut -d'"' -f4)
            echo "      Created: $created_at"
        fi
        echo ""
    done

    if ls -1 "$BACKUP_DIR"/target_tracks_backup_*.sql >/dev/null 2>&1; then
        echo "Target Tracks Only Backups:"
        ls -lth "$BACKUP_DIR"/target_tracks_backup_*.sql | head -5 | while read -r line; do
            file=$(echo "$line" | awk '{print $9}')
            size=$(echo "$line" | awk '{print $5}')
            timestamp=$(basename "$file" | sed 's/target_tracks_backup_//' | sed 's/.sql//')
            echo "  🎯 $timestamp - $size - $(basename "$file")"
        done
    fi
}

confirm_restore() {
    local backup_file="$1"
    local restore_type="$2"

    echo -e "${YELLOW}⚠️ WARNING: This will restore the database from backup${NC}"
    echo -e "${YELLOW}   Backup file: $backup_file${NC}"
    echo -e "${YELLOW}   Restore type: $restore_type${NC}"
    echo -e "${YELLOW}   Current data will be OVERWRITTEN${NC}"
    echo ""

    if [[ "$FORCE" != "true" ]]; then
        read -p "Are you sure you want to proceed? (type 'yes' to continue): " confirmation
        if [[ "$confirmation" != "yes" ]]; then
            echo "❌ Restore cancelled"
            exit 1
        fi
    fi
}

restore_full_database() {
    local backup_file="$1"

    echo "🔄 Starting full database restoration..."

    # Create new backup before restore
    echo "📦 Creating safety backup before restore..."
    ./backup_database.sh

    # Drop and recreate database
    echo "🗑️ Dropping current database..."
    docker compose exec $DB_SERVICE dropdb -U $DB_USER --if-exists $DB_NAME

    echo "🆕 Creating fresh database..."
    docker compose exec $DB_SERVICE createdb -U $DB_USER $DB_NAME

    # Restore from backup
    echo "📥 Restoring from backup..."
    docker compose exec -T $DB_SERVICE psql -U $DB_USER $DB_NAME < "$backup_file"

    echo -e "${GREEN}✅ Full database restoration completed${NC}"
}

restore_target_tracks_only() {
    local backup_file="$1"

    echo "🎯 Starting target_tracks restoration..."

    # Backup current target_tracks
    echo "📦 Backing up current target_tracks..."
    docker compose exec -T $DB_SERVICE pg_dump -U $DB_USER -t target_tracks $DB_NAME > "$BACKUP_DIR/target_tracks_pre_restore_$(date +%Y%m%d_%H%M%S).sql"

    # Clear current target_tracks
    echo "🗑️ Clearing current target_tracks..."
    docker compose exec $DB_SERVICE psql -U $DB_USER $DB_NAME -c "TRUNCATE TABLE target_tracks CASCADE;"

    # Restore target_tracks
    echo "📥 Restoring target_tracks from backup..."
    docker compose exec -T $DB_SERVICE psql -U $DB_USER $DB_NAME < "$backup_file"

    echo -e "${GREEN}✅ Target tracks restoration completed${NC}"
}

test_restore() {
    local backup_file="$1"
    local test_db="musicdb_restore_test_$(date +%s)"

    echo "🧪 Testing restoration with temporary database..."

    # Create temporary database
    docker compose exec $DB_SERVICE createdb -U $DB_USER $test_db

    # Test restore
    if docker compose exec -T $DB_SERVICE psql -U $DB_USER $test_db < "$backup_file" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Restore test PASSED - backup is valid${NC}"

        # Show some statistics
        docker compose exec $DB_SERVICE psql -U $DB_USER $test_db -c "
        SELECT 'target_tracks' as table_name, COUNT(*) as record_count FROM target_tracks
        UNION ALL
        SELECT 'songs', COUNT(*) FROM songs
        UNION ALL
        SELECT 'artists', COUNT(*) FROM artists
        UNION ALL
        SELECT 'song_adjacency', COUNT(*) FROM song_adjacency;
        "
    else
        echo -e "${RED}❌ Restore test FAILED - backup may be corrupted${NC}"
    fi

    # Cleanup test database
    docker compose exec $DB_SERVICE dropdb -U $DB_USER $test_db
}

# Parse arguments
FORCE=false
LIST=false
LATEST=false
TARGET_ONLY=false
TEST_RESTORE=false
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --list)
            LIST=true
            shift
            ;;
        --latest)
            LATEST=true
            shift
            ;;
        --target-only)
            TARGET_ONLY=true
            shift
            ;;
        --test-restore)
            TEST_RESTORE=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help|-h)
            print_usage
            exit 0
            ;;
        -*)
            echo "Unknown option $1"
            print_usage
            exit 1
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Handle list command
if [[ "$LIST" == "true" ]]; then
    list_backups
    exit 0
fi

# Find backup file
if [[ "$LATEST" == "true" ]]; then
    if [[ "$TARGET_ONLY" == "true" ]]; then
        BACKUP_FILE=$(ls -t "$BACKUP_DIR"/target_tracks_backup_*.sql 2>/dev/null | head -1)
    else
        BACKUP_FILE=$(ls -t "$BACKUP_DIR"/musicdb_backup_*.sql 2>/dev/null | head -1)
    fi

    if [[ -z "$BACKUP_FILE" ]]; then
        echo -e "${RED}❌ No backups found${NC}"
        exit 1
    fi

    echo "📋 Using latest backup: $BACKUP_FILE"
fi

# Validate backup file
if [[ -z "$BACKUP_FILE" ]]; then
    echo -e "${RED}❌ No backup file specified${NC}"
    print_usage
    exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo -e "${RED}❌ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Execute restore
if [[ "$TEST_RESTORE" == "true" ]]; then
    test_restore "$BACKUP_FILE"
elif [[ "$TARGET_ONLY" == "true" ]]; then
    confirm_restore "$BACKUP_FILE" "target_tracks only"
    restore_target_tracks_only "$BACKUP_FILE"
else
    confirm_restore "$BACKUP_FILE" "full database"
    restore_full_database "$BACKUP_FILE"
fi

echo -e "${GREEN}🎉 Restoration process completed successfully!${NC}"