#!/bin/bash
# ========================================================
# SongNodes Migration Script Wrapper
# Provides convenient shortcuts for common migration tasks
# ========================================================

set -e

# Default configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-musicdb}"
DB_USER="${DB_USER:-musicdb_app}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_RUNNER="$SCRIPT_DIR/run_migrations.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_usage() {
    cat << EOF
SongNodes Database Migration Tool

Usage: $0 <command> [options]

Commands:
    up [version]     Apply migrations (optionally to specific version)
    down <version>   Rollback to specific version
    status           Show migration status
    validate         Validate migrations and check consistency
    test             Run performance tests
    reset            Reset all visualization metadata (DESTRUCTIVE)

Options:
    --host HOST      Database host (default: $DB_HOST)
    --port PORT      Database port (default: $DB_PORT)
    --database DB    Database name (default: $DB_NAME)
    --user USER      Database user (default: $DB_USER)
    --password PASS  Database password (or set DB_PASSWORD env var)
    --help           Show this help message

Examples:
    $0 up                                    # Apply all pending migrations
    $0 up --version 002_spatial_optimization # Apply migrations up to version
    $0 down --version 001_visualization_metadata # Rollback to version
    $0 status                               # Show current status
    $0 validate                             # Validate schema
    $0 test                                 # Run performance tests

Environment Variables:
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

EOF
}

# Parse command line arguments
COMMAND=""
VERSION=""
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        up|down|status|validate|test|reset)
            COMMAND="$1"
            shift
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --help|-h)
            print_usage
            exit 0
            ;;
        --host|--port|--database|--user|--password)
            EXTRA_ARGS+=("$1" "$2")
            shift 2
            ;;
        *)
            if [[ -z "$COMMAND" ]]; then
                COMMAND="$1"
            elif [[ -z "$VERSION" && ("$COMMAND" == "up" || "$COMMAND" == "down") ]]; then
                VERSION="$1"
            else
                EXTRA_ARGS+=("$1")
            fi
            shift
            ;;
    esac
done

# Validate command
if [[ -z "$COMMAND" ]]; then
    log_error "No command specified"
    print_usage
    exit 1
fi

# Check if Python migration runner exists
if [[ ! -f "$MIGRATION_RUNNER" ]]; then
    log_error "Migration runner not found: $MIGRATION_RUNNER"
    exit 1
fi

# Check Python dependencies
if ! python3 -c "import psycopg2" 2>/dev/null; then
    log_error "psycopg2 not installed. Install with: pip install psycopg2-binary"
    exit 1
fi

# Build base command
BASE_CMD=("python3" "$MIGRATION_RUNNER")
BASE_CMD+=("--host" "$DB_HOST")
BASE_CMD+=("--port" "$DB_PORT")
BASE_CMD+=("--database" "$DB_NAME")
BASE_CMD+=("--user" "$DB_USER")
BASE_CMD+=("${EXTRA_ARGS[@]}")

# Execute command
case "$COMMAND" in
    up)
        log_info "Applying migrations..."
        if [[ -n "$VERSION" ]]; then
            log_info "Target version: $VERSION"
            "${BASE_CMD[@]}" up --version "$VERSION"
        else
            log_info "Applying all pending migrations"
            "${BASE_CMD[@]}" up
        fi
        log_success "Migration completed"
        ;;
        
    down)
        if [[ -z "$VERSION" ]]; then
            log_error "Version required for rollback"
            echo "Usage: $0 down <version>"
            exit 1
        fi
        log_warning "Rolling back to version: $VERSION"
        read -p "Are you sure? This will remove data! (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            "${BASE_CMD[@]}" down --version "$VERSION"
            log_success "Rollback completed"
        else
            log_info "Rollback cancelled"
        fi
        ;;
        
    status)
        log_info "Checking migration status..."
        "${BASE_CMD[@]}" status
        ;;
        
    validate)
        log_info "Validating migrations..."
        "${BASE_CMD[@]}" validate
        log_success "Validation completed"
        ;;
        
    test)
        log_info "Running performance tests..."
        
        # Check if test functions are available
        TEST_QUERY="SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'test_spatial_query_performance')"
        
        if python3 -c "
import psycopg2
import os
try:
    conn = psycopg2.connect(
        host='$DB_HOST',
        port='$DB_PORT', 
        database='$DB_NAME',
        user='$DB_USER',
        password=os.getenv('DB_PASSWORD', '')
    )
    cur = conn.cursor()
    cur.execute(\"$TEST_QUERY\")
    exists = cur.fetchone()[0]
    if not exists:
        print('MISSING_FUNCTIONS')
    conn.close()
except Exception as e:
    print(f'ERROR: {e}')
" | grep -q "MISSING_FUNCTIONS"; then
            log_error "Performance test functions not available. Run migrations first."
            exit 1
        fi
        
        # Run basic performance test
        python3 -c "
import psycopg2
import os
import time

try:
    conn = psycopg2.connect(
        host='$DB_HOST',
        port='$DB_PORT',
        database='$DB_NAME', 
        user='$DB_USER',
        password=os.getenv('DB_PASSWORD', '')
    )
    
    cur = conn.cursor()
    
    # Test spatial query performance
    start_time = time.time()
    cur.execute('SELECT * FROM test_spatial_query_performance(20)')
    results = cur.fetchall()
    end_time = time.time()
    
    print(f'Performance Test Results:')
    for row in results:
        print(f'  {row[0]}: avg={row[1]:.2f}ms, max={row[2]}ms, success_rate={row[4]:.2%}')
    
    print(f'Total test time: {(end_time - start_time) * 1000:.0f}ms')
    
    conn.close()
    
except Exception as e:
    print(f'Test failed: {e}')
    exit(1)
"
        log_success "Performance tests completed"
        ;;
        
    reset)
        log_warning "This will remove ALL visualization metadata!"
        log_warning "This includes:"
        echo "  - All node positions and layouts"
        echo "  - All user preferences"
        echo "  - All spatial indexes"
        echo "  - All performance data"
        echo
        read -p "Are you ABSOLUTELY sure? Type 'DELETE ALL DATA' to confirm: " confirmation
        
        if [[ "$confirmation" == "DELETE ALL DATA" ]]; then
            log_info "Resetting visualization metadata..."
            
            # Rollback all visualization migrations
            "${BASE_CMD[@]}" down --version 000_schema_migrations
            
            log_success "Reset completed"
        else
            log_info "Reset cancelled"
        fi
        ;;
        
    *)
        log_error "Unknown command: $COMMAND"
        print_usage
        exit 1
        ;;
esac