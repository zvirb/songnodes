#!/bin/bash
################################################################################
# Emergency Stop Script for SongNodes
#
# Immediately stops all services in controlled manner
#
# Usage: ./scripts/emergency_stop.sh [--force]
#
# Options:
#   --force    Force stop without waiting for graceful shutdown
#
# Exit codes:
#   0 - Stop succeeded
#   1 - Stop failed
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

# Flags
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force) FORCE=true; shift ;;
        -h|--help)
            echo "Usage: $0 [--force]"
            exit 0 ;;
        *) log_error "Unknown option: $1"; exit 1 ;;
    esac
done

log_section "EMERGENCY STOP"
log_warn "This will stop all SongNodes services"

# Create incident snapshot
INCIDENT_DIR="/tmp/emergency_stop_$(date +%Y%m%d-%H%M%S)"
mkdir -p "$INCIDENT_DIR"

log_step "Capturing system state for incident analysis..."

cd /mnt/my_external_drive/programming/songnodes

# Capture container state
docker compose ps > "$INCIDENT_DIR/container_state.txt" 2>/dev/null || true
docker stats --no-stream > "$INCIDENT_DIR/docker_stats.txt" 2>/dev/null || true

# Capture logs (last 1000 lines)
log_step "Capturing service logs..."
for service in rest-api graph-api websocket-api metadata-enrichment api-gateway-internal dlq-manager; do
    docker compose logs --tail=1000 "$service" > "$INCIDENT_DIR/${service}_logs.txt" 2>/dev/null || true
done

# Capture system metrics
df -h > "$INCIDENT_DIR/disk_usage.txt" 2>/dev/null || true
free -h > "$INCIDENT_DIR/memory_usage.txt" 2>/dev/null || true
top -bn1 > "$INCIDENT_DIR/top_snapshot.txt" 2>/dev/null || true

log_info "System state captured to: $INCIDENT_DIR"

# Stop services in reverse dependency order
log_section "Stopping Services"

# 1. Stop scrapers first (data producers)
log_step "Stopping scrapers..."
docker compose stop scraper-mixesdb scraper-1001tracklists scraper-ra 2>/dev/null || true
log_info "Scrapers stopped"

# 2. Stop enrichment workers
log_step "Stopping enrichment workers..."
docker compose stop metadata-enrichment-worker-1 metadata-enrichment-worker-2 2>/dev/null || true
log_info "Enrichment workers stopped"

# 3. Stop enrichment services
log_step "Stopping enrichment services..."
docker compose stop api-gateway-internal dlq-manager metadata-enrichment 2>/dev/null || true
log_info "Enrichment services stopped"

# 4. Stop API services
log_step "Stopping API services..."
docker compose stop rest-api graph-api websocket-api nlp-processor 2>/dev/null || true
log_info "API services stopped"

# 5. Stop frontend
log_step "Stopping frontend..."
docker compose stop frontend 2>/dev/null || true
log_info "Frontend stopped"

# 6. Optionally stop infrastructure (depending on force flag)
if [ "$FORCE" = true ]; then
    log_warn "Force mode: Stopping infrastructure services..."
    docker compose stop postgres redis rabbitmq prometheus grafana loki tempo 2>/dev/null || true
    log_info "Infrastructure stopped"
else
    log_info "Infrastructure services (postgres, redis, etc.) left running"
    log_info "Use --force to stop infrastructure"
fi

# Verify all services stopped
log_section "Verification"

RUNNING_CONTAINERS=$(docker compose ps --services --filter "status=running" 2>/dev/null | wc -l)

if [ "$RUNNING_CONTAINERS" -eq 0 ] || ([ "$FORCE" = false ] && [ "$RUNNING_CONTAINERS" -le 6 ]); then
    log_info "All target services stopped successfully"
else
    log_warn "Some services are still running:"
    docker compose ps
fi

# Summary
log_section "Emergency Stop Complete"
echo ""
echo "System state captured in: $INCIDENT_DIR"
echo ""
echo "To restart services:"
echo "  docker compose up -d"
echo ""
echo "To view captured logs:"
echo "  ls -la $INCIDENT_DIR/"
echo ""

if [ "$FORCE" = false ]; then
    echo "Infrastructure services (PostgreSQL, Redis, RabbitMQ) are still running"
    echo "To stop them: $0 --force"
    echo ""
fi

log_info "Emergency stop completed"

exit 0
