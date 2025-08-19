#!/bin/bash
# Emergency Rollback Script for SongNodes Production
# Switches from green (current) to blue (previous stable) environment

set -euo pipefail

# Configuration
PROJECT_ROOT="/home/marku/Documents/programming/songnodes"
ROLLBACK_LOG="$PROJECT_ROOT/deployment/logs/rollback.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

# Create log directory
mkdir -p "$(dirname "$ROLLBACK_LOG")"

log "Starting emergency rollback to blue environment"

# Step 1: Stop green environment (current production)
log "Stopping green environment services..."
docker stop songnodes-frontend-production || warning "Frontend already stopped"
docker compose -f docker-compose.yml -f docker-compose.green.yml down --timeout 10 || warning "Some services may already be down"

# Step 2: Start blue environment (previous stable)
log "Starting blue environment services..."
cd "$PROJECT_ROOT"
docker compose -f docker-compose.yml -f docker-compose.blue.yml up -d

# Step 3: Wait for services to stabilize
log "Waiting for blue environment to stabilize..."
sleep 30

# Step 4: Health check validation
log "Validating blue environment health..."
FAILED_SERVICES=()

# Check frontend (assuming blue runs on port 3000)
if ! curl -sf --max-time 10 "http://localhost:3000" > /dev/null 2>&1; then
    FAILED_SERVICES+=("frontend-blue")
fi

# Check API services
if ! curl -sf --max-time 10 "http://localhost:8084/health" > /dev/null 2>&1; then
    FAILED_SERVICES+=("api-blue")
fi

# Report rollback status
if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
    success "Rollback completed successfully - all blue environment services healthy"
    log "Blue environment is now active on:"
    log "  - Frontend: http://localhost:3000"
    log "  - API: http://localhost:8084"
else
    error "Rollback validation failed - unhealthy services: ${FAILED_SERVICES[*]}"
    log "Manual intervention required"
    exit 1
fi

# Step 5: Clean up green environment containers
log "Cleaning up green environment containers..."
docker container prune -f
docker network prune -f

success "Emergency rollback to blue environment completed"
log "Monitor the application and investigate green environment issues"

# Final status
echo ""
echo "=== ROLLBACK SUMMARY ==="
echo "Previous Environment: Green (production)"
echo "Current Environment: Blue (stable)"
echo "Application URL: http://localhost:3000"
echo "API URL: http://localhost:8084"
echo "Status: $([ ${#FAILED_SERVICES[@]} -eq 0 ] && echo "SUCCESS" || echo "FAILED")"