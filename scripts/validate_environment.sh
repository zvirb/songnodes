#!/bin/bash
################################################################################
# Environment Validation Script for SongNodes Enrichment Deployment
#
# Validates environment before deployment:
# - Docker and docker-compose versions
# - Required environment variables
# - Database connectivity
# - Redis and RabbitMQ health
# - Available disk space
# - Service prerequisites
#
# Usage: ./scripts/validate_environment.sh
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
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

# Validation state
VALIDATION_FAILED=0

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
    VALIDATION_FAILED=1
}

log_section() {
    echo -e "\n${BLUE}===${NC} $1 ${BLUE}===${NC}"
}

################################################################################
# Version checks
################################################################################

check_docker_version() {
    log_section "Checking Docker Version"

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        return 1
    fi

    DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+' | head -1)
    REQUIRED_DOCKER_VERSION="20.10"

    if [ "$(printf '%s\n' "$REQUIRED_DOCKER_VERSION" "$DOCKER_VERSION" | sort -V | head -n1)" != "$REQUIRED_DOCKER_VERSION" ]; then
        log_error "Docker version $DOCKER_VERSION is too old. Required: >= $REQUIRED_DOCKER_VERSION"
        return 1
    fi

    log_info "Docker version: $DOCKER_VERSION (OK)"
    return 0
}

check_docker_compose_version() {
    log_section "Checking Docker Compose Version"

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        return 1
    fi

    # Try docker compose (newer) first, then docker-compose (legacy)
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version --short)
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_VERSION=$(docker-compose --version | grep -oP '\d+\.\d+' | head -1)
        COMPOSE_CMD="docker-compose"
    fi

    REQUIRED_COMPOSE_VERSION="1.29"

    if [ "$(printf '%s\n' "$REQUIRED_COMPOSE_VERSION" "$COMPOSE_VERSION" | sort -V | head -n1)" != "$REQUIRED_COMPOSE_VERSION" ]; then
        log_error "Docker Compose version $COMPOSE_VERSION is too old. Required: >= $REQUIRED_COMPOSE_VERSION"
        return 1
    fi

    log_info "Docker Compose version: $COMPOSE_VERSION (OK)"
    echo "$COMPOSE_CMD" > /tmp/compose_cmd.txt
    return 0
}

################################################################################
# Environment variable checks
################################################################################

check_env_file() {
    log_section "Checking .env File"

    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        log_error ".env file not found at $PROJECT_ROOT/.env"
        log_warn "Copy .env.example to .env and configure it"
        return 1
    fi

    log_info ".env file exists"
    return 0
}

check_required_vars() {
    log_section "Checking Required Environment Variables"

    # Source .env file
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi

    REQUIRED_VARS=(
        "POSTGRES_PASSWORD"
        "RABBITMQ_USER"
        "RABBITMQ_PASS"
        "JWT_SECRET"
        "API_KEY_ENCRYPTION_SECRET"
    )

    MISSING_VARS=()

    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var:-}" ]; then
            MISSING_VARS+=("$var")
        fi
    done

    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
        return 1
    fi

    log_info "All required environment variables are set"
    return 0
}

check_api_keys() {
    log_section "Checking API Keys (Optional)"

    # Source .env file
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi

    OPTIONAL_VARS=(
        "SPOTIFY_CLIENT_ID"
        "SPOTIFY_CLIENT_SECRET"
        "MUSICBRAINZ_USER_AGENT"
        "DISCOGS_TOKEN"
        "LASTFM_API_KEY"
    )

    MISSING_COUNT=0

    for var in "${OPTIONAL_VARS[@]}"; do
        if [ -z "${!var:-}" ]; then
            ((MISSING_COUNT++))
        fi
    done

    if [ $MISSING_COUNT -eq ${#OPTIONAL_VARS[@]} ]; then
        log_warn "No external API keys configured"
        log_warn "Enrichment will have limited functionality"
        log_warn "Configure API keys via frontend Settings panel or .env file"
    elif [ $MISSING_COUNT -gt 0 ]; then
        log_warn "Some API keys are missing ($MISSING_COUNT/${#OPTIONAL_VARS[@]})"
        log_warn "This is OK - configure them via frontend Settings panel"
    else
        log_info "All optional API keys are configured"
    fi

    return 0
}

################################################################################
# Resource checks
################################################################################

check_disk_space() {
    log_section "Checking Disk Space"

    REQUIRED_GB=10
    AVAILABLE_GB=$(df "$PROJECT_ROOT" | awk 'NR==2 {printf "%.0f", $4/1024/1024}')

    if [ "$AVAILABLE_GB" -lt "$REQUIRED_GB" ]; then
        log_error "Insufficient disk space: ${AVAILABLE_GB}GB available, ${REQUIRED_GB}GB required"
        return 1
    fi

    log_info "Disk space: ${AVAILABLE_GB}GB available (>= ${REQUIRED_GB}GB required)"
    return 0
}

check_memory() {
    log_section "Checking Available Memory"

    REQUIRED_GB=8
    AVAILABLE_GB=$(free -g | awk 'NR==2 {print $7}')

    if [ "$AVAILABLE_GB" -lt "$REQUIRED_GB" ]; then
        log_warn "Low memory: ${AVAILABLE_GB}GB available, ${REQUIRED_GB}GB recommended"
        log_warn "Deployment may experience issues with heavy load"
    else
        log_info "Memory: ${AVAILABLE_GB}GB available (>= ${REQUIRED_GB}GB recommended)"
    fi

    return 0
}

check_cpu_cores() {
    log_section "Checking CPU Cores"

    REQUIRED_CORES=4
    AVAILABLE_CORES=$(nproc)

    if [ "$AVAILABLE_CORES" -lt "$REQUIRED_CORES" ]; then
        log_warn "Limited CPU: ${AVAILABLE_CORES} cores, ${REQUIRED_CORES} cores recommended"
        log_warn "Performance may be impacted"
    else
        log_info "CPU: ${AVAILABLE_CORES} cores (>= ${REQUIRED_CORES} cores recommended)"
    fi

    return 0
}

################################################################################
# Service connectivity checks
################################################################################

check_postgres_connectivity() {
    log_section "Checking PostgreSQL Connectivity"

    # Source .env for credentials
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi

    # Check if postgres container is running
    if ! docker ps | grep -q "postgres"; then
        log_warn "PostgreSQL container is not running"
        log_warn "Start services with: docker compose up -d postgres"
        return 0  # Not a critical failure for pre-deployment
    fi

    # Try to connect
    if docker exec postgres pg_isready -U musicdb_user &> /dev/null; then
        log_info "PostgreSQL is running and accepting connections"

        # Check database exists
        if docker exec postgres psql -U musicdb_user -lqt | cut -d \| -f 1 | grep -qw musicdb; then
            log_info "Database 'musicdb' exists"
        else
            log_warn "Database 'musicdb' does not exist yet (will be created during migration)"
        fi
    else
        log_warn "PostgreSQL is running but not ready yet"
    fi

    return 0
}

check_redis_connectivity() {
    log_section "Checking Redis Connectivity"

    # Check if redis container is running
    if ! docker ps | grep -q "redis"; then
        log_warn "Redis container is not running"
        log_warn "Start services with: docker compose up -d redis"
        return 0
    fi

    # Try to ping
    if docker exec redis redis-cli ping &> /dev/null; then
        log_info "Redis is running and accepting connections"
    else
        log_warn "Redis is running but not responding to ping"
    fi

    return 0
}

check_rabbitmq_connectivity() {
    log_section "Checking RabbitMQ Connectivity"

    # Check if rabbitmq container is running
    if ! docker ps | grep -q "rabbitmq"; then
        log_warn "RabbitMQ container is not running"
        log_warn "Start services with: docker compose up -d rabbitmq"
        return 0
    fi

    # Try to check status
    if docker exec rabbitmq rabbitmqctl status &> /dev/null; then
        log_info "RabbitMQ is running and healthy"
    else
        log_warn "RabbitMQ is running but status check failed"
    fi

    return 0
}

################################################################################
# Docker setup checks
################################################################################

check_docker_network() {
    log_section "Checking Docker Network"

    NETWORK_NAME="songnodes_default"

    if docker network ls | grep -q "$NETWORK_NAME"; then
        log_info "Docker network '$NETWORK_NAME' exists"
    else
        log_warn "Docker network '$NETWORK_NAME' does not exist yet"
        log_warn "Will be created automatically during deployment"
    fi

    return 0
}

check_docker_volumes() {
    log_section "Checking Docker Volumes"

    VOLUMES=(
        "musicdb_postgres_data"
        "musicdb_redis_data"
        "musicdb_rabbitmq_data"
    )

    for volume in "${VOLUMES[@]}"; do
        if docker volume ls | grep -q "$volume"; then
            log_info "Volume '$volume' exists"
        else
            log_warn "Volume '$volume' does not exist yet (will be created)"
        fi
    done

    return 0
}

################################################################################
# Migration file checks
################################################################################

check_migration_files() {
    log_section "Checking Migration Files"

    MIGRATION_DIR="$PROJECT_ROOT/sql/migrations"
    MEDALLION_DIR="$MIGRATION_DIR/medallion"

    if [ ! -d "$MIGRATION_DIR" ]; then
        log_error "Migration directory not found: $MIGRATION_DIR"
        return 1
    fi

    log_info "Migration directory exists: $MIGRATION_DIR"

    if [ ! -d "$MEDALLION_DIR" ]; then
        log_error "Medallion migration directory not found: $MEDALLION_DIR"
        return 1
    fi

    log_info "Medallion migration directory exists: $MEDALLION_DIR"

    # Check for required medallion migrations
    REQUIRED_MIGRATIONS=(
        "001_bronze_layer_up.sql"
        "002_silver_layer_up.sql"
        "003_gold_layer_up.sql"
        "004_waterfall_configuration_up.sql"
        "005_pipeline_replay_support_up.sql"
    )

    for migration in "${REQUIRED_MIGRATIONS[@]}"; do
        if [ -f "$MEDALLION_DIR/$migration" ]; then
            log_info "Migration file exists: $migration"
        else
            log_error "Migration file missing: $migration"
        fi
    done

    return 0
}

################################################################################
# Docker Compose file checks
################################################################################

check_docker_compose_files() {
    log_section "Checking Docker Compose Files"

    if [ ! -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        log_error "docker-compose.yml not found"
        return 1
    fi

    log_info "docker-compose.yml exists"

    # Check for new services
    NEW_SERVICES=(
        "api-gateway-internal"
        "dlq-manager"
        "metadata-enrichment"
    )

    for service in "${NEW_SERVICES[@]}"; do
        if grep -q "$service:" "$PROJECT_ROOT/docker-compose.yml"; then
            log_info "Service '$service' defined in docker-compose.yml"
        else
            log_warn "Service '$service' not found in docker-compose.yml"
            log_warn "Make sure you've merged the latest changes"
        fi
    done

    return 0
}

################################################################################
# Main execution
################################################################################

main() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  SongNodes Enrichment Deployment - Environment Validation    ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Version checks
    check_docker_version
    check_docker_compose_version

    # Environment checks
    check_env_file
    check_required_vars
    check_api_keys

    # Resource checks
    check_disk_space
    check_memory
    check_cpu_cores

    # Service connectivity (if services are running)
    check_postgres_connectivity
    check_redis_connectivity
    check_rabbitmq_connectivity

    # Docker setup
    check_docker_network
    check_docker_volumes

    # File checks
    check_migration_files
    check_docker_compose_files

    # Summary
    echo ""
    log_section "Validation Summary"

    if [ $VALIDATION_FAILED -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║${NC}  All validation checks passed! Environment is ready.          ${GREEN}║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    else
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║${NC}  Some validation checks failed. Fix errors before deploying.  ${RED}║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 1
    fi
}

main "$@"
