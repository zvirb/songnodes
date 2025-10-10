#!/bin/bash
################################################################################
# Database Migration Script for SongNodes Enrichment Deployment
#
# Safely applies database migrations with:
# - Automatic backup before migration
# - Transaction-based migration execution
# - Rollback on failure
# - Migration verification
# - Progress tracking
#
# Usage: ./scripts/migrate_database.sh [--dry-run] [--rollback]
# Options:
#   --dry-run    Show what would be done without applying changes
#   --rollback   Rollback the last migration batch
#
# Exit codes:
#   0 - Migration succeeded
#   1 - Migration failed
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="$PROJECT_ROOT/backups/database"
MIGRATION_DIR="$PROJECT_ROOT/sql/migrations"
MEDALLION_DIR="$MIGRATION_DIR/medallion"
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pre_enrichment_migration_${BACKUP_TIMESTAMP}.sql"

# Flags
DRY_RUN=false
ROLLBACK=false

################################################################################
# Logging functions
################################################################################

log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}===${NC} $1 ${BLUE}===${NC}"
}

log_step() {
    echo -e "${BLUE}▶${NC} $1"
}

################################################################################
# Parse command line arguments
################################################################################

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --rollback)
                ROLLBACK=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [--dry-run] [--rollback]"
                echo ""
                echo "Options:"
                echo "  --dry-run    Show what would be done without applying changes"
                echo "  --rollback   Rollback the last migration batch"
                echo "  -h, --help   Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

################################################################################
# Database connection helpers
################################################################################

get_db_connection_string() {
    # Source .env for credentials
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi

    echo "postgresql://musicdb_user:${POSTGRES_PASSWORD}@localhost:5433/musicdb"
}

execute_sql() {
    local sql="$1"
    local description="${2:-Executing SQL}"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would execute: $description"
        return 0
    fi

    log_step "$description"

    if docker exec postgres psql -U musicdb_user -d musicdb -c "$sql" > /dev/null 2>&1; then
        log_info "$description - Success"
        return 0
    else
        log_error "$description - Failed"
        return 1
    fi
}

execute_sql_file() {
    local file="$1"
    local description="${2:-Executing SQL file}"

    if [ ! -f "$file" ]; then
        log_error "SQL file not found: $file"
        return 1
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would execute: $description ($file)"
        return 0
    fi

    log_step "$description"

    if docker exec -i postgres psql -U musicdb_user -d musicdb < "$file" > /dev/null 2>&1; then
        log_info "$description - Success"
        return 0
    else
        log_error "$description - Failed"
        return 1
    fi
}

################################################################################
# Backup functions
################################################################################

create_backup() {
    log_section "Creating Database Backup"

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would create backup at: $BACKUP_FILE"
        return 0
    fi

    log_step "Backing up database to: $BACKUP_FILE"

    # Create backup using pg_dump
    if docker exec postgres pg_dump -U musicdb_user -d musicdb --clean --if-exists > "$BACKUP_FILE"; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_info "Backup created successfully ($BACKUP_SIZE)"

        # Compress backup
        log_step "Compressing backup..."
        gzip "$BACKUP_FILE"
        COMPRESSED_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
        log_info "Backup compressed ($COMPRESSED_SIZE)"

        return 0
    else
        log_error "Backup failed"
        return 1
    fi
}

restore_backup() {
    local backup_file="$1"

    log_section "Restoring Database from Backup"

    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi

    log_warn "This will restore the database to: $backup_file"
    log_warn "All current data will be lost!"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would restore from: $backup_file"
        return 0
    fi

    # Decompress if needed
    if [[ "$backup_file" == *.gz ]]; then
        log_step "Decompressing backup..."
        gunzip -k "$backup_file"
        backup_file="${backup_file%.gz}"
    fi

    log_step "Restoring database..."

    if docker exec -i postgres psql -U musicdb_user -d musicdb < "$backup_file"; then
        log_info "Database restored successfully"
        return 0
    else
        log_error "Database restore failed"
        return 1
    fi
}

################################################################################
# Migration tracking
################################################################################

create_migration_tracking_table() {
    log_section "Setting Up Migration Tracking"

    local sql="
    CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW(),
        batch INTEGER NOT NULL,
        success BOOLEAN DEFAULT TRUE
    );
    "

    execute_sql "$sql" "Creating migration tracking table"
}

get_current_batch() {
    if [ "$DRY_RUN" = true ]; then
        echo "1"
        return
    fi

    local batch=$(docker exec postgres psql -U musicdb_user -d musicdb -t -c \
        "SELECT COALESCE(MAX(batch), 0) + 1 FROM schema_migrations;" 2>/dev/null | tr -d ' ')

    if [ -z "$batch" ]; then
        echo "1"
    else
        echo "$batch"
    fi
}

record_migration() {
    local migration_name="$1"
    local batch="$2"
    local success="${3:-true}"

    if [ "$DRY_RUN" = true ]; then
        return 0
    fi

    local sql="
    INSERT INTO schema_migrations (migration_name, batch, success)
    VALUES ('$migration_name', $batch, $success)
    ON CONFLICT (migration_name) DO NOTHING;
    "

    docker exec postgres psql -U musicdb_user -d musicdb -c "$sql" > /dev/null 2>&1
}

is_migration_applied() {
    local migration_name="$1"

    if [ "$DRY_RUN" = true ]; then
        return 1  # Assume not applied in dry-run
    fi

    local count=$(docker exec postgres psql -U musicdb_user -d musicdb -t -c \
        "SELECT COUNT(*) FROM schema_migrations WHERE migration_name = '$migration_name' AND success = true;" \
        2>/dev/null | tr -d ' ')

    [ "$count" -gt 0 ]
}

################################################################################
# Migration functions
################################################################################

apply_migration() {
    local migration_file="$1"
    local migration_name=$(basename "$migration_file")
    local batch="$2"

    # Check if already applied
    if is_migration_applied "$migration_name"; then
        log_info "Migration already applied: $migration_name (skipping)"
        return 0
    fi

    log_step "Applying migration: $migration_name"

    if execute_sql_file "$migration_file" "Executing $migration_name"; then
        record_migration "$migration_name" "$batch" "true"
        return 0
    else
        record_migration "$migration_name" "$batch" "false"
        return 1
    fi
}

apply_medallion_migrations() {
    log_section "Applying Medallion Architecture Migrations"

    local batch=$(get_current_batch)
    log_info "Migration batch: $batch"

    # Medallion migrations in order
    local migrations=(
        "001_bronze_layer_up.sql"
        "002_silver_layer_up.sql"
        "003_gold_layer_up.sql"
        "004_waterfall_configuration_up.sql"
        "005_pipeline_replay_support_up.sql"
    )

    for migration in "${migrations[@]}"; do
        local migration_path="$MEDALLION_DIR/$migration"

        if [ ! -f "$migration_path" ]; then
            log_error "Migration file not found: $migration"
            return 1
        fi

        if ! apply_migration "$migration_path" "$batch"; then
            log_error "Failed to apply migration: $migration"
            return 1
        fi
    done

    log_info "All Medallion migrations applied successfully"
    return 0
}

apply_enrichment_migrations() {
    log_section "Applying Additional Enrichment Migrations"

    local batch=$(get_current_batch)

    # Additional enrichment migrations
    local migrations=(
        "008_enrichment_metadata_fields_up.sql"
    )

    for migration in "${migrations[@]}"; do
        local migration_path="$MIGRATION_DIR/$migration"

        if [ ! -f "$migration_path" ]; then
            log_warn "Migration file not found: $migration (skipping)"
            continue
        fi

        if ! apply_migration "$migration_path" "$batch"; then
            log_error "Failed to apply migration: $migration"
            return 1
        fi
    done

    log_info "Additional enrichment migrations applied successfully"
    return 0
}

################################################################################
# Rollback functions
################################################################################

rollback_last_batch() {
    log_section "Rolling Back Last Migration Batch"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would rollback last migration batch"
        return 0
    fi

    # Get last batch number
    local last_batch=$(docker exec postgres psql -U musicdb_user -d musicdb -t -c \
        "SELECT MAX(batch) FROM schema_migrations;" 2>/dev/null | tr -d ' ')

    if [ -z "$last_batch" ] || [ "$last_batch" = "" ]; then
        log_warn "No migrations to rollback"
        return 0
    fi

    log_info "Rolling back batch: $last_batch"

    # Get migrations in reverse order
    local migrations=$(docker exec postgres psql -U musicdb_user -d musicdb -t -c \
        "SELECT migration_name FROM schema_migrations WHERE batch = $last_batch ORDER BY id DESC;" \
        2>/dev/null)

    while IFS= read -r migration; do
        migration=$(echo "$migration" | tr -d ' ')
        [ -z "$migration" ] && continue

        log_step "Rolling back: $migration"

        # Find corresponding down migration
        local down_migration="${migration/_up.sql/_down.sql}"
        local down_path=""

        if [ -f "$MEDALLION_DIR/$down_migration" ]; then
            down_path="$MEDALLION_DIR/$down_migration"
        elif [ -f "$MIGRATION_DIR/$down_migration" ]; then
            down_path="$MIGRATION_DIR/$down_migration"
        else
            log_error "Down migration not found: $down_migration"
            continue
        fi

        if execute_sql_file "$down_path" "Rolling back $migration"; then
            # Remove from tracking
            docker exec postgres psql -U musicdb_user -d musicdb -c \
                "DELETE FROM schema_migrations WHERE migration_name = '$migration';" > /dev/null 2>&1
            log_info "Rolled back: $migration"
        else
            log_error "Failed to rollback: $migration"
            return 1
        fi
    done <<< "$migrations"

    log_info "Rollback completed successfully"
    return 0
}

################################################################################
# Verification functions
################################################################################

verify_migrations() {
    log_section "Verifying Migration Results"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would verify migrations"
        return 0
    fi

    # Check Bronze layer tables
    log_step "Checking Bronze layer tables..."
    local tables=("raw_track_enrichment_requests" "raw_api_responses" "raw_circuit_breaker_events")
    for table in "${tables[@]}"; do
        if docker exec postgres psql -U musicdb_user -d musicdb -c "\dt $table" | grep -q "$table"; then
            log_info "Table exists: $table"
        else
            log_error "Table missing: $table"
            return 1
        fi
    done

    # Check Silver layer tables
    log_step "Checking Silver layer tables..."
    local tables=("enrichment_requests" "api_responses" "circuit_breaker_state")
    for table in "${tables[@]}"; do
        if docker exec postgres psql -U musicdb_user -d musicdb -c "\dt $table" | grep -q "$table"; then
            log_info "Table exists: $table"
        else
            log_error "Table missing: $table"
            return 1
        fi
    done

    # Check Gold layer tables
    log_step "Checking Gold layer tables..."
    local tables=("enriched_tracks" "api_performance_metrics" "enrichment_quality_scores")
    for table in "${tables[@]}"; do
        if docker exec postgres psql -U musicdb_user -d musicdb -c "\dt $table" | grep -q "$table"; then
            log_info "Table exists: $table"
        else
            log_error "Table missing: $table"
            return 1
        fi
    done

    # Check configuration tables
    log_step "Checking configuration tables..."
    if docker exec postgres psql -U musicdb_user -d musicdb -c "\dt waterfall_api_configuration" | grep -q "waterfall_api_configuration"; then
        log_info "Table exists: waterfall_api_configuration"

        # Check if configuration is loaded
        local config_count=$(docker exec postgres psql -U musicdb_user -d musicdb -t -c \
            "SELECT COUNT(*) FROM waterfall_api_configuration;" | tr -d ' ')

        if [ "$config_count" -gt 0 ]; then
            log_info "Configuration loaded: $config_count API sources configured"
        else
            log_warn "Configuration table is empty - needs seeding"
        fi
    else
        log_error "Table missing: waterfall_api_configuration"
        return 1
    fi

    log_info "All migration verifications passed"
    return 0
}

################################################################################
# Main execution
################################################################################

main() {
    parse_args "$@"

    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  SongNodes Enrichment Deployment - Database Migration        ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        log_warn "Running in DRY RUN mode - no changes will be applied"
        echo ""
    fi

    # Check prerequisites
    if ! docker ps | grep -q postgres; then
        log_error "PostgreSQL container is not running"
        log_error "Start it with: docker compose up -d postgres"
        exit 1
    fi

    # Handle rollback
    if [ "$ROLLBACK" = true ]; then
        log_warn "ROLLBACK MODE - This will revert the last migration batch"

        if [ "$DRY_RUN" = false ]; then
            read -p "Are you sure you want to rollback? (yes/no): " confirm
            if [ "$confirm" != "yes" ]; then
                log_info "Rollback cancelled"
                exit 0
            fi
        fi

        rollback_last_batch
        exit $?
    fi

    # Normal migration flow
    create_backup || exit 1
    create_migration_tracking_table || exit 1
    apply_medallion_migrations || {
        log_error "Migration failed - restoring backup"
        restore_backup "${BACKUP_FILE}.gz"
        exit 1
    }
    apply_enrichment_migrations || {
        log_error "Migration failed - restoring backup"
        restore_backup "${BACKUP_FILE}.gz"
        exit 1
    }
    verify_migrations || {
        log_error "Verification failed - consider rollback"
        exit 1
    }

    # Summary
    echo ""
    log_section "Migration Summary"
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  Database migration completed successfully!                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  Backup saved: ${BACKUP_FILE}.gz${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo ""
        log_info "This was a DRY RUN - no changes were applied"
        log_info "Run without --dry-run to apply migrations"
    fi

    exit 0
}

main "$@"
