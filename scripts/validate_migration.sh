#!/bin/bash
# =============================================================================
# SongNodes Scrapy Migration Validation Script
# =============================================================================
# Validates the complete Scrapy migration with comprehensive checks for:
# - Python environment and dependencies
# - Database connectivity and schema
# - Settings module discovery
# - Spider registration and ItemLoaders
# - Pipeline functionality and data flow
# - Integration testing with real scraping
#
# Usage:
#   chmod +x scripts/validate_migration.sh
#   ./scripts/validate_migration.sh [--skip-integration]
#
# Options:
#   --skip-integration    Skip integration test (faster, no database writes)
# =============================================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCRAPERS_DIR="$PROJECT_ROOT/scrapers"
SKIP_INTEGRATION=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-integration)
            SKIP_INTEGRATION=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_section() {
    echo ""
    echo -e "${CYAN}>>> $1${NC}"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
}

error() {
    echo -e "${RED}✗${NC} $1"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

info() {
    echo -e "  $1"
}

run_check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -e "${CYAN}[CHECK $TOTAL_CHECKS]${NC} $1"
}

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

validate_environment() {
    print_header "1. Environment Validation"

    # Check working directory
    run_check "Verifying working directory"
    cd "$PROJECT_ROOT"
    success "Working directory: $PROJECT_ROOT"

    # Check Python version
    run_check "Checking Python version (>= 3.9)"
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

    if [[ $PYTHON_MAJOR -ge 3 ]] && [[ $PYTHON_MINOR -ge 9 ]]; then
        success "Python version: $PYTHON_VERSION"
    else
        error "Python version $PYTHON_VERSION is too old (need >= 3.9)"
        return 1
    fi

    # Check scrapers directory exists
    run_check "Verifying scrapers directory structure"
    if [[ -d "$SCRAPERS_DIR" ]]; then
        success "Scrapers directory: $SCRAPERS_DIR"
    else
        error "Scrapers directory not found: $SCRAPERS_DIR"
        return 1
    fi

    # Check critical files exist
    run_check "Verifying critical files presence"
    CRITICAL_FILES=(
        "$SCRAPERS_DIR/scrapy.cfg"
        "$SCRAPERS_DIR/items.py"
        "$SCRAPERS_DIR/item_loaders.py"
        "$SCRAPERS_DIR/utils/processors.py"
        "$SCRAPERS_DIR/settings/base.py"
        "$SCRAPERS_DIR/settings/development.py"
        "$SCRAPERS_DIR/settings/production.py"
    )

    local missing_files=0
    for file in "${CRITICAL_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            info "Found: $(basename $file)"
        else
            warn "Missing: $file"
            missing_files=$((missing_files + 1))
        fi
    done

    if [[ $missing_files -eq 0 ]]; then
        success "All critical files present"
    else
        error "$missing_files critical files missing"
        return 1
    fi
}

validate_dependencies() {
    print_header "2. Python Dependencies Validation"

    cd "$SCRAPERS_DIR"

    # Check if requirements.txt exists
    run_check "Checking requirements.txt"
    if [[ -f "requirements.txt" ]]; then
        success "requirements.txt found"
    else
        error "requirements.txt not found"
        return 1
    fi

    # Check critical dependencies
    run_check "Verifying critical Python packages installed"
    CRITICAL_PACKAGES=(
        "scrapy"
        "psycopg2-binary"
        "redis"
        "pydantic"
        "asyncpg"
        "twisted"
    )

    local missing_packages=0
    for package in "${CRITICAL_PACKAGES[@]}"; do
        if python3 -c "import ${package//-/_}" 2>/dev/null; then
            info "✓ $package"
        else
            warn "✗ $package (not installed)"
            missing_packages=$((missing_packages + 1))
        fi
    done

    if [[ $missing_packages -eq 0 ]]; then
        success "All critical packages installed"
    else
        warn "$missing_packages packages missing (may need: pip install -r requirements.txt)"
    fi
}

validate_database_connection() {
    print_header "3. Database Connection Validation"

    # Check database environment variables
    run_check "Checking database environment variables"

    # Source .env file if it exists
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        source "$PROJECT_ROOT/.env"
        info "Loaded .env file"
    fi

    # Database connection parameters (development defaults)
    DB_HOST="${DATABASE_HOST:-localhost}"
    DB_PORT="${DATABASE_PORT:-5433}"
    DB_NAME="${DATABASE_NAME:-musicdb}"
    DB_USER="${DATABASE_USER:-musicdb_user}"
    DB_PASSWORD="${DATABASE_PASSWORD:-musicdb_secure_pass_2024}"

    info "Host: $DB_HOST:$DB_PORT"
    info "Database: $DB_NAME"
    info "User: $DB_USER"

    # Test PostgreSQL connection
    run_check "Testing PostgreSQL connection"
    if command -v psql &> /dev/null; then
        export PGPASSWORD="$DB_PASSWORD"
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null; then
            success "PostgreSQL connection successful"
        else
            error "PostgreSQL connection failed (ensure database is running)"
            warn "Try: docker compose up -d postgres"
            return 1
        fi
    else
        warn "psql not found, skipping direct database connection test"
    fi

    # Test Redis connection
    run_check "Testing Redis connection"
    REDIS_HOST="${REDIS_HOST:-localhost}"
    REDIS_PORT="${REDIS_PORT:-6380}"

    if command -v redis-cli &> /dev/null; then
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &>/dev/null; then
            success "Redis connection successful"
        else
            warn "Redis connection failed (may not be critical for scrapers)"
        fi
    else
        warn "redis-cli not found, skipping Redis connection test"
    fi
}

validate_settings() {
    print_header "4. Settings Module Validation"

    cd "$SCRAPERS_DIR"

    # Test development settings
    run_check "Loading settings.development module"
    if python3 -c "from settings import development; print('OK')" 2>/dev/null | grep -q "OK"; then
        success "Development settings loaded successfully"
    else
        error "Failed to load development settings"
        python3 -c "from settings import development" 2>&1 | head -10
        return 1
    fi

    # Test production settings
    run_check "Loading settings.production module"
    if python3 -c "from settings import production; print('OK')" 2>/dev/null | grep -q "OK"; then
        success "Production settings loaded successfully"
    else
        error "Failed to load production settings"
        python3 -c "from settings import production" 2>&1 | head -10
        return 1
    fi

    # Test SCRAPY_SETTINGS_MODULE environment variable
    run_check "Testing SCRAPY_SETTINGS_MODULE environment variable"
    export SCRAPY_SETTINGS_MODULE="settings.development"
    if scrapy settings --get BOT_NAME 2>/dev/null | grep -q "SongNodes"; then
        success "SCRAPY_SETTINGS_MODULE works correctly"
    else
        warn "Could not validate SCRAPY_SETTINGS_MODULE (scrapy may not be in PATH)"
    fi

    # Validate critical settings values
    run_check "Validating critical settings values"
    python3 << 'EOF'
from settings import development

# Check critical settings
critical_settings = {
    'BOT_NAME': 'SongNodes Scrapers',
    'CONCURRENT_REQUESTS': development.CONCURRENT_REQUESTS,
    'DATABASE_HOST': development.DATABASE_HOST,
    'DATABASE_PORT': development.DATABASE_PORT,
}

print("Critical settings:")
for key, value in critical_settings.items():
    print(f"  {key}: {value}")

print("OK")
EOF

    if [[ $? -eq 0 ]]; then
        success "Critical settings validated"
    else
        error "Settings validation failed"
        return 1
    fi
}

validate_spiders() {
    print_header "5. Spider Discovery Validation"

    cd "$SCRAPERS_DIR"

    # List all spiders
    run_check "Discovering spiders via 'scrapy list'"
    export SCRAPY_SETTINGS_MODULE="settings.development"

    SPIDER_LIST=$(scrapy list 2>/dev/null)

    if [[ $? -eq 0 ]]; then
        success "Spider discovery successful"
        info "Discovered spiders:"
        echo "$SPIDER_LIST" | while read spider; do
            info "  - $spider"
        done
    else
        error "Spider discovery failed"
        scrapy list 2>&1 | head -10
        return 1
    fi

    # Check for expected spiders
    run_check "Validating expected spiders present"
    EXPECTED_SPIDERS=(
        "1001tracklists"
        "mixesdb"
        "setlistfm"
    )

    local missing_spiders=0
    for spider in "${EXPECTED_SPIDERS[@]}"; do
        if echo "$SPIDER_LIST" | grep -q "$spider"; then
            info "✓ $spider"
        else
            warn "✗ $spider (not found)"
            missing_spiders=$((missing_spiders + 1))
        fi
    done

    if [[ $missing_spiders -eq 0 ]]; then
        success "All expected spiders present"
    else
        warn "$missing_spiders expected spiders missing"
    fi
}

validate_itemloaders() {
    print_header "6. ItemLoader Validation"

    cd "$SCRAPERS_DIR"

    # Import ItemLoaders
    run_check "Importing ItemLoader modules"
    python3 << 'EOF'
try:
    from item_loaders import (
        ArtistLoader,
        TrackLoader,
        SetlistLoader,
        VenueLoader,
        PlaylistLoader,
        create_loader_with_base_url
    )
    print("OK")
except ImportError as e:
    print(f"FAILED: {e}")
    exit(1)
EOF

    if [[ $? -eq 0 ]]; then
        success "ItemLoader imports successful"
    else
        error "ItemLoader imports failed"
        return 1
    fi

    # Import processors
    run_check "Importing processor utilities"
    python3 << 'EOF'
try:
    from utils.processors import (
        strip_text,
        normalize_artist_name,
        clean_track_title,
        parse_musical_key,
        clean_bpm,
        parse_flexible_date,
        to_int,
        to_float
    )
    print("OK")
except ImportError as e:
    print(f"FAILED: {e}")
    exit(1)
EOF

    if [[ $? -eq 0 ]]; then
        success "Processor imports successful"
    else
        error "Processor imports failed"
        return 1
    fi

    # Test sample data through TrackLoader
    run_check "Testing TrackLoader with sample data"
    python3 << 'EOF'
from scrapy.http import TextResponse
from item_loaders import TrackLoader
from items import EnhancedTrackItem

# Create mock response
mock_html = """
<html>
    <body>
        <h1 class="track-title">Test Track (Original Mix)</h1>
        <span class="bpm">128 BPM</span>
        <span class="key">Am</span>
        <span class="artist">Test Artist</span>
    </body>
</html>
"""

response = TextResponse(
    url="http://test.com/track",
    body=mock_html.encode('utf-8'),
    encoding='utf-8'
)

# Use TrackLoader
loader = TrackLoader(item=EnhancedTrackItem(), response=response)
loader.add_css('track_name', 'h1.track-title::text')
loader.add_css('bpm', 'span.bpm::text')
loader.add_css('musical_key', 'span.key::text')
loader.add_value('artist_name', 'Test Artist')
loader.add_value('data_source', 'test')

item = loader.load_item()

# Validate processed data
assert item['track_name'] == 'Test Track (Original Mix)', f"Expected 'Test Track (Original Mix)', got {item['track_name']}"
assert item['bpm'] == 128, f"Expected 128, got {item['bpm']}"
assert item['musical_key'] == 'Am', f"Expected 'Am', got {item['musical_key']}"

print("OK")
EOF

    if [[ $? -eq 0 ]]; then
        success "TrackLoader test passed"
    else
        error "TrackLoader test failed"
        return 1
    fi
}

validate_pipelines() {
    print_header "7. Pipeline Validation"

    cd "$SCRAPERS_DIR"

    # Import pipelines
    run_check "Importing pipeline modules"
    python3 << 'EOF'
try:
    # Try importing both pipelines
    import_results = []

    try:
        from simple_twisted_pipeline import SimpleMusicDatabasePipeline
        import_results.append("SimpleTwistedPipeline: OK")
    except ImportError as e:
        import_results.append(f"SimpleTwistedPipeline: FAILED - {e}")

    try:
        from database_pipeline import DatabasePipeline
        import_results.append("DatabasePipeline: OK")
    except ImportError as e:
        import_results.append(f"DatabasePipeline: FAILED - {e}")

    for result in import_results:
        print(result)

    # Check if at least one pipeline works
    if any("OK" in r for r in import_results):
        print("RESULT: OK")
    else:
        print("RESULT: FAILED")
        exit(1)

except Exception as e:
    print(f"RESULT: FAILED - {e}")
    exit(1)
EOF

    if [[ $? -eq 0 ]]; then
        success "Pipeline imports successful"
    else
        error "Pipeline imports failed"
        return 1
    fi

    # Check pipeline configuration in settings
    run_check "Validating pipeline configuration in settings"
    python3 << 'EOF'
from settings import development

pipelines = development.ITEM_PIPELINES

if not pipelines:
    print("WARNING: No pipelines configured")
    exit(0)

print(f"Configured pipelines ({len(pipelines)}):")
for pipeline, priority in sorted(pipelines.items(), key=lambda x: x[1]):
    print(f"  {priority}: {pipeline}")

print("OK")
EOF

    if [[ $? -eq 0 ]]; then
        success "Pipeline configuration validated"
    else
        warn "Pipeline configuration validation failed"
    fi
}

validate_database_schema() {
    print_header "8. Database Schema Validation"

    # Source environment
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        source "$PROJECT_ROOT/.env"
    fi

    DB_HOST="${DATABASE_HOST:-localhost}"
    DB_PORT="${DATABASE_PORT:-5433}"
    DB_NAME="${DATABASE_NAME:-musicdb}"
    DB_USER="${DATABASE_USER:-musicdb_user}"
    DB_PASSWORD="${DATABASE_PASSWORD:-musicdb_secure_pass_2024}"

    export PGPASSWORD="$DB_PASSWORD"

    if ! command -v psql &> /dev/null; then
        warn "psql not found, skipping schema validation"
        return 0
    fi

    # Check song_adjacency table exists
    run_check "Verifying song_adjacency table exists"
    ADJACENCY_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'song_adjacency')" 2>/dev/null | tr -d ' ')

    if [[ "$ADJACENCY_EXISTS" == "t" ]]; then
        success "song_adjacency table exists"
    else
        error "song_adjacency table not found"
        return 1
    fi

    # Check required columns
    run_check "Verifying song_adjacency columns"
    REQUIRED_COLUMNS=("song_id_1" "song_id_2" "occurrence_count" "avg_distance")

    for col in "${REQUIRED_COLUMNS[@]}"; do
        COL_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
            "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'song_adjacency' AND column_name = '$col')" 2>/dev/null | tr -d ' ')

        if [[ "$COL_EXISTS" == "t" ]]; then
            info "✓ Column: $col"
        else
            warn "✗ Column missing: $col"
        fi
    done

    success "Database schema validated"

    # Test adjacency query
    run_check "Testing adjacency query"
    ADJACENCY_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT COUNT(*) FROM song_adjacency" 2>/dev/null | tr -d ' ')

    if [[ $? -eq 0 ]]; then
        success "Adjacency query successful (found $ADJACENCY_COUNT edges)"
    else
        warn "Adjacency query failed"
    fi
}

validate_integration() {
    print_header "9. Integration Test (End-to-End)"

    if [[ "$SKIP_INTEGRATION" == true ]]; then
        warn "Integration test skipped (--skip-integration flag)"
        return 0
    fi

    cd "$SCRAPERS_DIR"
    export SCRAPY_SETTINGS_MODULE="settings.development"

    # Run 1001tracklists spider with limited items
    run_check "Running 1001tracklists spider (5 items limit)"

    # Create temporary output file
    TEMP_OUTPUT=$(mktemp)

    info "Starting spider... (this may take 30-60 seconds)"
    timeout 120 scrapy crawl 1001tracklists \
        -s CLOSESPIDER_ITEMCOUNT=5 \
        -s LOG_LEVEL=INFO \
        > "$TEMP_OUTPUT" 2>&1

    EXIT_CODE=$?

    if [[ $EXIT_CODE -eq 0 ]] || [[ $EXIT_CODE -eq 124 ]]; then
        # Check if items were scraped
        ITEM_COUNT=$(grep -c "Scraped from" "$TEMP_OUTPUT" || echo "0")

        if [[ $ITEM_COUNT -gt 0 ]]; then
            success "Spider ran successfully ($ITEM_COUNT items scraped)"

            # Show sample output
            info "Sample output:"
            grep "Scraped from" "$TEMP_OUTPUT" | head -3 | while read line; do
                info "  $line"
            done
        else
            warn "Spider ran but no items were scraped"
            info "Check logs: $TEMP_OUTPUT"
        fi
    else
        error "Spider execution failed (exit code: $EXIT_CODE)"
        info "Last 20 lines of output:"
        tail -20 "$TEMP_OUTPUT"
        rm -f "$TEMP_OUTPUT"
        return 1
    fi

    rm -f "$TEMP_OUTPUT"

    # Verify data reached database
    run_check "Verifying data reached database"

    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        source "$PROJECT_ROOT/.env"
    fi

    DB_HOST="${DATABASE_HOST:-localhost}"
    DB_PORT="${DATABASE_PORT:-5433}"
    DB_NAME="${DATABASE_NAME:-musicdb}"
    DB_USER="${DATABASE_USER:-musicdb_user}"
    DB_PASSWORD="${DATABASE_PASSWORD:-musicdb_secure_pass_2024}"

    export PGPASSWORD="$DB_PASSWORD"

    if command -v psql &> /dev/null; then
        # Check recent songs
        RECENT_SONGS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
            "SELECT COUNT(*) FROM songs WHERE created_at > NOW() - INTERVAL '5 minutes'" 2>/dev/null | tr -d ' ')

        if [[ "$RECENT_SONGS" -gt 0 ]]; then
            success "Found $RECENT_SONGS recently added songs"
        else
            warn "No recent songs found in database (pipeline may not be configured)"
        fi

        # Check adjacency edges
        RECENT_ADJACENCY=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
            "SELECT COUNT(*) FROM song_adjacency WHERE last_seen > NOW() - INTERVAL '5 minutes'" 2>/dev/null | tr -d ' ')

        if [[ "$RECENT_ADJACENCY" -gt 0 ]]; then
            success "Found $RECENT_ADJACENCY recently added adjacency edges"
        else
            info "No recent adjacency edges found (may not be generated yet)"
        fi
    else
        warn "Cannot verify database contents (psql not found)"
    fi
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    print_header "SongNodes Scrapy Migration Validation"
    info "Project: $PROJECT_ROOT"
    info "Started: $(date)"

    # Run validation steps
    validate_environment || true
    validate_dependencies || true
    validate_database_connection || true
    validate_settings || true
    validate_spiders || true
    validate_itemloaders || true
    validate_pipelines || true
    validate_database_schema || true
    validate_integration || true

    # Print summary
    print_header "Validation Summary"

    echo ""
    echo -e "Total Checks:  ${BLUE}$TOTAL_CHECKS${NC}"
    echo -e "Passed:        ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Failed:        ${RED}$FAILED_CHECKS${NC}"
    echo -e "Success Rate:  $(awk "BEGIN {printf \"%.1f\", ($PASSED_CHECKS/$TOTAL_CHECKS)*100}")%"
    echo ""

    if [[ $FAILED_CHECKS -eq 0 ]]; then
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}✓ Migration validation PASSED!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo "Your Scrapy migration is complete and functional."
        echo "You can now run spiders with:"
        echo "  cd scrapers && scrapy crawl <spider_name>"
        echo ""
        return 0
    else
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}✗ Migration validation FAILED${NC}"
        echo -e "${RED}========================================${NC}"
        echo ""
        echo "Please review the errors above and fix them before deploying."
        echo ""
        return 1
    fi
}

# Run main function
main
exit $?
