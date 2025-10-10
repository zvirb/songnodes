#!/bin/bash
################################################################################
# Smoke Test Suite for SongNodes Enrichment Deployment
#
# End-to-end smoke tests validating:
# - API Gateway functionality
# - Metadata enrichment pipeline
# - DLQ Manager operations
# - Medallion architecture tables
# - Circuit breaker states
#
# Usage: ./scripts/smoke_tests.sh [--verbose]
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERBOSE=false
TEST_FAILED=0

################################################################################
# Logging
################################################################################

log_test() { echo -e "${BLUE}[TEST]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; TEST_FAILED=1; }
log_skip() { echo -e "${YELLOW}[SKIP]${NC} $1"; }

################################################################################
# Parse arguments
################################################################################

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose) VERBOSE=true; shift ;;
            -h|--help) echo "Usage: $0 [--verbose]"; exit 0 ;;
            *) log_fail "Unknown option: $1"; exit 1 ;;
        esac
    done
}

################################################################################
# Test: API Gateway Health
################################################################################

test_api_gateway_health() {
    log_test "API Gateway: Health endpoint"

    local response=$(curl -s http://localhost:8022/health 2>/dev/null || echo "{}")
    local status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "")

    if [ "$status" = "healthy" ]; then
        log_pass "API Gateway is healthy"
        return 0
    else
        log_fail "API Gateway health check failed: $status"
        return 1
    fi
}

test_api_gateway_spotify_search() {
    log_test "API Gateway: Spotify search endpoint"

    local response=$(curl -s -X POST http://localhost:8022/api/spotify/search \
        -H "Content-Type: application/json" \
        -d '{"artist_name":"Deadmau5","track_title":"Strobe"}' \
        2>/dev/null || echo "{}")

    local status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "")

    if [ "$status" = "success" ] || [ "$status" = "partial" ]; then
        log_pass "Spotify search endpoint working"
        [ "$VERBOSE" = true ] && echo "  Response: $response"
        return 0
    else
        log_fail "Spotify search failed: $response"
        return 1
    fi
}

test_api_gateway_circuit_breakers() {
    log_test "API Gateway: Circuit breaker states"

    local response=$(curl -s http://localhost:8022/health 2>/dev/null || echo "{}")
    local open_breakers=$(echo "$response" | jq -r '.api_clients | to_entries[] | select(.value.circuit_breaker.state == "open") | .key' 2>/dev/null || echo "")

    if [ -z "$open_breakers" ]; then
        log_pass "All circuit breakers are closed"
        return 0
    else
        log_skip "Circuit breakers open: $open_breakers"
        return 0  # Not a critical failure
    fi
}

################################################################################
# Test: Metadata Enrichment
################################################################################

test_metadata_enrichment_health() {
    log_test "Metadata Enrichment: Health endpoint"

    local response=$(curl -s http://localhost:8020/health 2>/dev/null || echo "{}")
    local status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "")

    if [ "$status" = "healthy" ]; then
        log_pass "Metadata Enrichment is healthy"
        return 0
    else
        log_fail "Metadata Enrichment health check failed"
        return 1
    fi
}

test_metadata_enrichment_config() {
    log_test "Metadata Enrichment: Configuration loaded"

    local response=$(curl -s http://localhost:8020/admin/config 2>/dev/null || echo "{}")
    local sources=$(echo "$response" | jq -r '.waterfall_sources | length' 2>/dev/null || echo "0")

    if [ "$sources" -gt 0 ]; then
        log_pass "Waterfall configuration loaded ($sources sources)"
        [ "$VERBOSE" = true ] && echo "  Sources: $(echo "$response" | jq -r '.waterfall_sources | keys | join(", ")')"
        return 0
    else
        log_fail "Waterfall configuration not loaded"
        return 1
    fi
}

test_metadata_enrichment_enrich() {
    log_test "Metadata Enrichment: Enrich endpoint"

    local response=$(curl -s -X POST http://localhost:8020/enrich \
        -H "Content-Type: application/json" \
        -d '{"track_id":"test-track-123","artist_name":"Deadmau5","track_title":"Strobe"}' \
        2>/dev/null || echo "{}")

    local status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "")

    if [ "$status" = "completed" ] || [ "$status" = "partial" ] || [ "$status" = "cached" ]; then
        log_pass "Enrich endpoint working (status: $status)"
        return 0
    else
        log_fail "Enrich endpoint failed: $response"
        return 1
    fi
}

################################################################################
# Test: DLQ Manager
################################################################################

test_dlq_manager_health() {
    log_test "DLQ Manager: Health endpoint"

    local response=$(curl -s http://localhost:8021/health 2>/dev/null || echo "{}")
    local status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "")

    if [ "$status" = "healthy" ]; then
        log_pass "DLQ Manager is healthy"
        return 0
    else
        log_fail "DLQ Manager health check failed"
        return 1
    fi
}

test_dlq_manager_stats() {
    log_test "DLQ Manager: Statistics endpoint"

    local response=$(curl -s http://localhost:8021/dlq/stats 2>/dev/null || echo "{}")
    local total=$(echo "$response" | jq -r '.total_pending' 2>/dev/null || echo "")

    if [ -n "$total" ]; then
        log_pass "DLQ statistics available (pending: $total)"
        return 0
    else
        log_fail "DLQ statistics not available"
        return 1
    fi
}

################################################################################
# Test: Database Medallion Architecture
################################################################################

test_medallion_tables() {
    log_test "Database: Medallion architecture tables"

    # Check Bronze tables
    local bronze_tables=$(docker exec postgres psql -U musicdb_user -d musicdb -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('raw_track_enrichment_requests', 'raw_api_responses', 'raw_circuit_breaker_events');" \
        2>/dev/null | tr -d ' ')

    if [ "$bronze_tables" = "3" ]; then
        log_pass "Bronze layer tables exist (3/3)"
    else
        log_fail "Bronze layer tables missing (found: $bronze_tables/3)"
        return 1
    fi

    # Check Silver tables
    local silver_tables=$(docker exec postgres psql -U musicdb_user -d musicdb -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('enrichment_requests', 'api_responses', 'circuit_breaker_state');" \
        2>/dev/null | tr -d ' ')

    if [ "$silver_tables" = "3" ]; then
        log_pass "Silver layer tables exist (3/3)"
    else
        log_fail "Silver layer tables missing (found: $silver_tables/3)"
        return 1
    fi

    # Check Gold tables
    local gold_tables=$(docker exec postgres psql -U musicdb_user -d musicdb -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('enriched_tracks', 'api_performance_metrics', 'enrichment_quality_scores');" \
        2>/dev/null | tr -d ' ')

    if [ "$gold_tables" = "3" ]; then
        log_pass "Gold layer tables exist (3/3)"
    else
        log_fail "Gold layer tables missing (found: $gold_tables/3)"
        return 1
    fi

    return 0
}

test_waterfall_configuration() {
    log_test "Database: Waterfall configuration seeded"

    local config_count=$(docker exec postgres psql -U musicdb_user -d musicdb -t -c \
        "SELECT COUNT(*) FROM waterfall_api_configuration WHERE enabled = true;" \
        2>/dev/null | tr -d ' ')

    if [ "$config_count" -gt 0 ]; then
        log_pass "Waterfall configuration seeded ($config_count sources)"
        return 0
    else
        log_fail "Waterfall configuration not seeded"
        return 1
    fi
}

################################################################################
# Main execution
################################################################################

main() {
    parse_args "$@"

    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  SongNodes Enrichment - Smoke Test Suite                     ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # API Gateway Tests
    echo -e "${BLUE}▶ API Gateway Tests${NC}"
    test_api_gateway_health
    test_api_gateway_spotify_search
    test_api_gateway_circuit_breakers
    echo ""

    # Metadata Enrichment Tests
    echo -e "${BLUE}▶ Metadata Enrichment Tests${NC}"
    test_metadata_enrichment_health
    test_metadata_enrichment_config
    test_metadata_enrichment_enrich
    echo ""

    # DLQ Manager Tests
    echo -e "${BLUE}▶ DLQ Manager Tests${NC}"
    test_dlq_manager_health
    test_dlq_manager_stats
    echo ""

    # Database Tests
    echo -e "${BLUE}▶ Database Tests${NC}"
    test_medallion_tables
    test_waterfall_configuration
    echo ""

    # Summary
    if [ $TEST_FAILED -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║${NC}  All smoke tests passed!                                      ${GREEN}║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    else
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║${NC}  Some smoke tests failed - review above                       ${RED}║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 1
    fi
}

main "$@"
