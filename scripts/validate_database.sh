#!/bin/bash
################################################################################
# Database Validation Script for SongNodes
#
# Validates database integrity after restore or migration
#
# Usage: ./scripts/validate_database.sh
#
# Exit codes:
#   0 - Validation passed
#   1 - Validation failed
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

cd /mnt/my_external_drive/programming/songnodes

VALIDATION_FAILED=false

log_section "Database Validation"

# 1. Check database connectivity
log_step "Checking database connectivity..."
if docker compose exec -T postgres pg_isready -U musicdb_user &> /dev/null; then
    log_info "Database is reachable"
else
    log_error "Cannot connect to database"
    exit 1
fi

# 2. Check critical tables exist
log_step "Checking critical tables..."
TABLES="tracks artists enrichment_audit data_quality_scores metadata_enrichment_config dead_letter_queue"
MISSING_TABLES=""

for table in $TABLES; do
    if docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c "\dt $table" 2>/dev/null | grep -q "$table"; then
        log_info "Table exists: $table"
    else
        log_error "Missing table: $table"
        MISSING_TABLES="$MISSING_TABLES $table"
        VALIDATION_FAILED=true
    fi
done

# 3. Check table counts
log_step "Checking table counts..."

TRACK_COUNT=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c "SELECT COUNT(*) FROM tracks;" | xargs)
log_info "Tracks: $TRACK_COUNT"

if [ "$TRACK_COUNT" -eq 0 ]; then
    log_warn "No tracks in database (may be expected for fresh install)"
fi

ARTIST_COUNT=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c "SELECT COUNT(*) FROM artists;" | xargs 2>/dev/null || echo "0")
log_info "Artists: $ARTIST_COUNT"

# 4. Check for orphaned records
log_step "Checking for orphaned records..."

ORPHANED_ENRICHMENT=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c \
    "SELECT COUNT(*) FROM enrichment_audit WHERE track_id NOT IN (SELECT track_id FROM tracks);" | xargs 2>/dev/null || echo "0")

if [ "$ORPHANED_ENRICHMENT" -gt 0 ]; then
    log_warn "Found $ORPHANED_ENRICHMENT orphaned enrichment_audit records"
else
    log_info "No orphaned enrichment_audit records"
fi

# 5. Check for NULL required fields
log_step "Checking for NULL required fields..."

NULL_ARTISTS=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c \
    "SELECT COUNT(*) FROM tracks WHERE artist_name IS NULL;" | xargs 2>/dev/null || echo "0")

NULL_TRACKS=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c \
    "SELECT COUNT(*) FROM tracks WHERE track_name IS NULL;" | xargs 2>/dev/null || echo "0")

if [ "$NULL_ARTISTS" -gt 0 ]; then
    log_warn "Found $NULL_ARTISTS tracks with NULL artist_name"
    VALIDATION_FAILED=true
fi

if [ "$NULL_TRACKS" -gt 0 ]; then
    log_warn "Found $NULL_TRACKS tracks with NULL track_name"
    VALIDATION_FAILED=true
fi

if [ "$NULL_ARTISTS" -eq 0 ] && [ "$NULL_TRACKS" -eq 0 ]; then
    log_info "No NULL required fields found"
fi

# 6. Check schema migrations
log_step "Checking schema migrations..."

MIGRATION_COUNT=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c \
    "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | xargs || echo "0")

if [ "$MIGRATION_COUNT" -gt 0 ]; then
    log_info "Schema migrations applied: $MIGRATION_COUNT"

    LATEST_MIGRATION=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c \
        "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;" 2>/dev/null | xargs || echo "unknown")
    log_info "Latest migration: $LATEST_MIGRATION"
else
    log_warn "No schema migrations found (may be fresh install)"
fi

# 7. Check enrichment configuration
log_step "Checking enrichment configuration..."

CONFIG_COUNT=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c \
    "SELECT COUNT(*) FROM metadata_enrichment_config;" 2>/dev/null | xargs || echo "0")

if [ "$CONFIG_COUNT" -gt 0 ]; then
    log_info "Enrichment configuration exists ($CONFIG_COUNT rows)"
else
    log_warn "No enrichment configuration found"
fi

# 8. Check DLQ
log_step "Checking Dead Letter Queue..."

DLQ_COUNT=$(docker compose exec -T postgres psql -U musicdb_user -d musicdb -t -c \
    "SELECT COUNT(*) FROM dead_letter_queue;" 2>/dev/null | xargs || echo "0")

log_info "DLQ messages: $DLQ_COUNT"

if [ "$DLQ_COUNT" -gt 1000 ]; then
    log_warn "DLQ has $DLQ_COUNT messages (high - may need replay)"
fi

# 9. Summary
log_section "Validation Summary"

echo ""
echo "Database Statistics:"
echo "  - Tracks: $TRACK_COUNT"
echo "  - Artists: $ARTIST_COUNT"
echo "  - Migrations: $MIGRATION_COUNT"
echo "  - DLQ Messages: $DLQ_COUNT"
echo ""

if [ "$VALIDATION_FAILED" = true ]; then
    log_error "Database validation FAILED"
    echo ""
    echo "Issues found:"
    if [ -n "$MISSING_TABLES" ]; then
        echo "  - Missing tables:$MISSING_TABLES"
    fi
    if [ "$NULL_ARTISTS" -gt 0 ]; then
        echo "  - $NULL_ARTISTS tracks with NULL artist_name"
    fi
    if [ "$NULL_TRACKS" -gt 0 ]; then
        echo "  - $NULL_TRACKS tracks with NULL track_name"
    fi
    echo ""
    exit 1
else
    log_info "Database validation PASSED"
    echo ""
    exit 0
fi
