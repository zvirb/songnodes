#!/bin/bash
################################################################################
# Comprehensive Service Health Check Script for SongNodes Deployment
#
# Extended health checks for all services with detailed diagnostics
#
# Usage: ./scripts/comprehensive_health_check.sh [--service <name>] [--timeout <seconds>] [--wait]
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

# Configuration
DEFAULT_TIMEOUT=30
TIMEOUT=$DEFAULT_TIMEOUT
SPECIFIC_SERVICE=""
WAIT_MODE=false
HEALTH_CHECK_FAILED=0

################################################################################
# Logging functions
################################################################################

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; HEALTH_CHECK_FAILED=1; }
log_section() { echo -e "\n${BLUE}===${NC} $1 ${BLUE}===${NC}"; }
log_checking() { echo -ne "${BLUE}[⏳]${NC} Checking $1..."; }
log_result_ok() { echo -e "\r${GREEN}[✓]${NC} $1 - Healthy          "; }
log_result_fail() { echo -e "\r${RED}[✗]${NC} $1 - Unhealthy      "; HEALTH_CHECK_FAILED=1; }
log_result_warn() { echo -e "\r${YELLOW}[⚠]${NC} $1 - Warning       "; }

################################################################################
# Parse arguments
################################################################################

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --service) SPECIFIC_SERVICE="$2"; shift 2 ;;
            --timeout) TIMEOUT="$2"; shift 2 ;;
            --wait) WAIT_MODE=true; shift ;;
            -h|--help)
                echo "Usage: $0 [--service <name>] [--timeout <seconds>] [--wait]"
                exit 0 ;;
            *) log_error "Unknown option: $1"; exit 1 ;;
        esac
    done
}

################################################################################
# Helper functions
################################################################################

wait_for_condition() {
    local description="$1"
    local command="$2"
    local timeout="${3:-$TIMEOUT}"
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if eval "$command" &> /dev/null; then return 0; fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    return 1
}

check_container_running() {
    docker ps --format '{{.Names}}' | grep -q "^${1}$"
}

check_http_endpoint() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$1" 2>/dev/null || echo "000")
    [ "$response" = "${2:-200}" ]
}

check_http_json_field() {
    local actual_value=$(curl -s "$1" 2>/dev/null | jq -r ".$2" 2>/dev/null || echo "")
    [ "$actual_value" = "$3" ]
}

################################################################################
# Infrastructure health checks
################################################################################

check_postgres() {
    [ -n "$SPECIFIC_SERVICE" ] && [ "$SPECIFIC_SERVICE" != "postgres" ] && return 0
    log_checking "PostgreSQL"

    if ! check_container_running "postgres"; then
        log_result_fail "PostgreSQL (container not running)"
        return 1
    fi

    if $WAIT_MODE; then
        if wait_for_condition "PostgreSQL" "docker exec postgres pg_isready -U musicdb_user" "$TIMEOUT"; then
            log_result_ok "PostgreSQL"
        else
            log_result_fail "PostgreSQL (timeout)"
            return 1
        fi
    else
        if docker exec postgres pg_isready -U musicdb_user &> /dev/null; then
            log_result_ok "PostgreSQL"
        else
            log_result_fail "PostgreSQL (not ready)"
            return 1
        fi
    fi
}

check_redis() {
    [ -n "$SPECIFIC_SERVICE" ] && [ "$SPECIFIC_SERVICE" != "redis" ] && return 0
    log_checking "Redis"

    if ! check_container_running "redis"; then
        log_result_fail "Redis (container not running)"
        return 1
    fi

    if docker exec redis redis-cli ping | grep -q PONG; then
        log_result_ok "Redis"
    else
        log_result_fail "Redis (not responding)"
        return 1
    fi
}

check_rabbitmq() {
    [ -n "$SPECIFIC_SERVICE" ] && [ "$SPECIFIC_SERVICE" != "rabbitmq" ] && return 0
    log_checking "RabbitMQ"

    if ! check_container_running "rabbitmq"; then
        log_result_fail "RabbitMQ (container not running)"
        return 1
    fi

    if docker exec rabbitmq rabbitmqctl status &> /dev/null; then
        log_result_ok "RabbitMQ"
    else
        log_result_fail "RabbitMQ (not ready)"
        return 1
    fi
}

################################################################################
# Enrichment service health checks
################################################################################

check_metadata_enrichment() {
    [ -n "$SPECIFIC_SERVICE" ] && [ "$SPECIFIC_SERVICE" != "metadata-enrichment" ] && return 0
    log_checking "Metadata Enrichment"

    if ! check_container_running "metadata-enrichment"; then
        log_result_fail "Metadata Enrichment (container not running)"
        return 1
    fi

    if $WAIT_MODE; then
        if wait_for_condition "Metadata Enrichment" "check_http_json_field 'http://localhost:8020/health' 'status' 'healthy'" "$TIMEOUT"; then
            log_result_ok "Metadata Enrichment"
        else
            log_result_fail "Metadata Enrichment (timeout)"
            return 1
        fi
    else
        if check_http_json_field "http://localhost:8020/health" "status" "healthy"; then
            log_result_ok "Metadata Enrichment"
        else
            log_result_fail "Metadata Enrichment (unhealthy)"
            return 1
        fi
    fi
}

check_api_gateway() {
    [ -n "$SPECIFIC_SERVICE" ] && [ "$SPECIFIC_SERVICE" != "api-gateway-internal" ] && return 0
    log_checking "API Gateway"

    if ! check_container_running "api-gateway-internal"; then
        log_result_fail "API Gateway (container not running)"
        return 1
    fi

    if check_http_json_field "http://localhost:8022/health" "status" "healthy"; then
        log_result_ok "API Gateway"
    else
        log_result_fail "API Gateway (unhealthy)"
        return 1
    fi
}

check_dlq_manager() {
    [ -n "$SPECIFIC_SERVICE" ] && [ "$SPECIFIC_SERVICE" != "dlq-manager" ] && return 0
    log_checking "DLQ Manager"

    if ! check_container_running "dlq-manager"; then
        log_result_fail "DLQ Manager (container not running)"
        return 1
    fi

    if check_http_json_field "http://localhost:8021/health" "status" "healthy"; then
        log_result_ok "DLQ Manager"
    else
        log_result_fail "DLQ Manager (unhealthy)"
        return 1
    fi
}

################################################################################
# Main execution
################################################################################

main() {
    parse_args "$@"

    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  SongNodes - Comprehensive Service Health Check              ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    log_section "Infrastructure Services"
    check_postgres
    check_redis
    check_rabbitmq

    log_section "Enrichment Services"
    check_metadata_enrichment
    check_api_gateway
    check_dlq_manager

    echo ""
    if [ $HEALTH_CHECK_FAILED -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║${NC}  All services are healthy!                                    ${GREEN}║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    else
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║${NC}  Some services are unhealthy                                  ${RED}║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 1
    fi
}

main "$@"
