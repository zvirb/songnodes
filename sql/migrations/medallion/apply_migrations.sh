#!/bin/bash
# ============================================================================
# Medallion Architecture Migration Script
# Applies all medallion layer migrations in the correct order
# ============================================================================

set -e  # Exit on error

# Database connection parameters (from .env or override)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-musicdb_user}"
DB_NAME="${DB_NAME:-musicdb}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Migration directory
MIGRATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Medallion Architecture Migrations${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "Database: ${GREEN}${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}${NC}"
echo -e "Migration Directory: ${GREEN}${MIGRATION_DIR}${NC}"
echo ""

# Function to apply a migration
apply_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file" .sql)

    echo -e "${YELLOW}Applying migration: ${migration_name}${NC}"

    if PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${migration_file}" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Successfully applied: ${migration_name}${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to apply: ${migration_name}${NC}"
        echo -e "${RED}Run with -v flag for detailed error output${NC}"
        return 1
    fi
}

# Function to rollback migrations
rollback_migrations() {
    echo -e "${YELLOW}Rolling back all medallion migrations...${NC}"

    local rollback_files=(
        "005_pipeline_replay_support_down.sql"
        "004_waterfall_configuration_down.sql"
        "003_gold_layer_down.sql"
        "002_silver_layer_down.sql"
        "001_bronze_layer_down.sql"
    )

    for migration_file in "${rollback_files[@]}"; do
        local full_path="${MIGRATION_DIR}/${migration_file}"
        if [ -f "$full_path" ]; then
            apply_migration "$full_path"
        fi
    done

    echo -e "${GREEN}Rollback complete${NC}"
}

# Parse command line arguments
VERBOSE=false
ROLLBACK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Show detailed SQL output"
            echo "  -r, --rollback   Rollback all migrations instead of applying"
            echo "  -h, --help       Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  DB_HOST          Database host (default: localhost)"
            echo "  DB_PORT          Database port (default: 5433)"
            echo "  DB_USER          Database user (default: musicdb_user)"
            echo "  DB_NAME          Database name (default: musicdb)"
            echo "  POSTGRES_PASSWORD Database password (required)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Check if password is set
if [ -z "${POSTGRES_PASSWORD}" ]; then
    echo -e "${RED}Error: POSTGRES_PASSWORD environment variable not set${NC}"
    echo "Please set it before running this script:"
    echo "  export POSTGRES_PASSWORD='your_password'"
    echo "Or source your .env file:"
    echo "  source .env"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql command not found${NC}"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Test database connection
echo -e "${BLUE}Testing database connection...${NC}"
if PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
    echo ""
else
    echo -e "${RED}✗ Failed to connect to database${NC}"
    echo "Please check your connection parameters and credentials"
    exit 1
fi

# Rollback or apply migrations
if [ "$ROLLBACK" = true ]; then
    rollback_migrations
    exit 0
fi

# Apply migrations in order
echo -e "${BLUE}Applying migrations in sequence...${NC}"
echo ""

migrations=(
    "001_bronze_layer_up.sql"
    "002_silver_layer_up.sql"
    "003_gold_layer_up.sql"
    "004_waterfall_configuration_up.sql"
    "005_pipeline_replay_support_up.sql"
)

for migration_file in "${migrations[@]}"; do
    full_path="${MIGRATION_DIR}/${migration_file}"

    if [ ! -f "$full_path" ]; then
        echo -e "${RED}Error: Migration file not found: ${migration_file}${NC}"
        exit 1
    fi

    if [ "$VERBOSE" = true ]; then
        PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "$full_path"
    else
        apply_migration "$full_path" || exit 1
    fi
done

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✓ All migrations applied successfully!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify tables were created: psql -c '\\dt bronze_* silver_* gold_*'"
echo "2. Check waterfall configuration: psql -c 'SELECT * FROM enrichment_waterfall_summary;'"
echo "3. Review the README.md for data flow examples and usage"
echo ""
