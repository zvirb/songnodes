#!/bin/bash

# Production Rollback Script for SongNodes
# Emergency rollback procedures for immediate service restoration

echo "=== SongNodes Production Rollback Procedure ==="
echo "Timestamp: $(date -u)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to stop and remove production containers
stop_production() {
    echo -e "${YELLOW}Stopping production containers...${NC}"
    docker compose -f docker-compose.production-simple.yml down
    echo -e "${GREEN}Production containers stopped${NC}"
}

# Function to start blue environment (backup/previous version)
start_blue_environment() {
    echo -e "${YELLOW}Starting blue environment (previous version)...${NC}"
    docker compose -f docker-compose.blue.yml up -d
    echo -e "${GREEN}Blue environment started${NC}"
}

# Function to validate services after rollback
validate_rollback() {
    echo -e "${YELLOW}Validating rollback services...${NC}"
    sleep 30
    
    # Test blue environment services
    if curl -s http://localhost:8101/health | grep -q "healthy"; then
        echo -e "${GREEN}✓ Scraper Orchestrator (Blue) is healthy${NC}"
    else
        echo -e "${RED}✗ Scraper Orchestrator (Blue) failed${NC}"
    fi
    
    if curl -s http://localhost:8102/health | grep -q "healthy"; then
        echo -e "${GREEN}✓ Data Transformer (Blue) is healthy${NC}"
    else
        echo -e "${RED}✗ Data Transformer (Blue) failed${NC}"
    fi
    
    echo -e "${GREEN}Rollback validation complete${NC}"
}

# Function to backup current state before rollback
backup_current_state() {
    echo -e "${YELLOW}Creating backup of current production state...${NC}"
    
    # Create backup directory
    BACKUP_DIR="./backups/production-rollback-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup container states
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" > "$BACKUP_DIR/container-status.txt"
    
    # Backup logs from critical services
    docker logs songnodes-scraper-orchestrator-production --tail 100 > "$BACKUP_DIR/scraper-orchestrator.log" 2>&1 || true
    docker logs songnodes-graph-api-production --tail 100 > "$BACKUP_DIR/graph-api.log" 2>&1 || true
    docker logs songnodes-rest-api-production --tail 100 > "$BACKUP_DIR/rest-api.log" 2>&1 || true
    docker logs songnodes-websocket-production --tail 100 > "$BACKUP_DIR/websocket-api.log" 2>&1 || true
    
    echo -e "${GREEN}Backup created in: $BACKUP_DIR${NC}"
}

# Main rollback function
execute_rollback() {
    echo -e "${RED}INITIATING EMERGENCY ROLLBACK${NC}"
    echo "This will:"
    echo "1. Stop all production containers"
    echo "2. Start the blue environment (previous version)"
    echo "3. Validate the rollback"
    echo ""
    
    read -p "Continue with rollback? (y/N): " confirm
    case $confirm in
        [Yy]* )
            backup_current_state
            stop_production
            start_blue_environment
            validate_rollback
            echo -e "${GREEN}✅ ROLLBACK COMPLETED${NC}"
            echo "Services have been rolled back to the previous stable version."
            echo "Blue environment is now handling traffic on alternate ports:"
            echo "- Scraper Orchestrator: http://localhost:8101"
            echo "- Data Transformer: http://localhost:8102"
            echo "- Prometheus: http://localhost:9092"
            echo "- Grafana: http://localhost:3008"
            ;;
        * )
            echo -e "${YELLOW}Rollback cancelled${NC}"
            exit 0
            ;;
    esac
}

# Check if user wants quick rollback or full validation
if [ "$1" = "--quick" ]; then
    echo -e "${YELLOW}Quick rollback mode - minimal validation${NC}"
    backup_current_state
    stop_production
    start_blue_environment
    echo -e "${GREEN}✅ QUICK ROLLBACK COMPLETED${NC}"
elif [ "$1" = "--help" ]; then
    echo "Usage: $0 [--quick|--help]"
    echo ""
    echo "Options:"
    echo "  --quick    Perform quick rollback without extensive validation"
    echo "  --help     Show this help message"
    echo ""
    echo "Without options, performs full rollback with validation"
else
    execute_rollback
fi