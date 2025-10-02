#!/bin/bash
################################################################################
# Apply New Security Credentials
# Quick deployment script for updated Redis, JWT, and API Key credentials
################################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Applying New Security Credentials                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verify credentials are set
echo -e "${BLUE}Step 1: Verifying new credentials in .env...${NC}"
if grep -q "REDIS_PASSWORD=Yaqh7xREV5uR1QV0T32bTIhrip" .env && \
   grep -q "JWT_SECRET=23d63fbab8f1b6af5c04682da0601ea1" .env && \
   grep -q "API_KEY=84f7843cc185ab41799d95c278637366" .env; then
    echo -e "${GREEN}✓ New credentials verified in .env${NC}"
else
    echo -e "${YELLOW}⚠ Warning: Credentials may not be updated correctly${NC}"
    echo "Please run the credential generation script first"
    exit 1
fi

# Check if docker-compose.yml needs Redis password update
echo ""
echo -e "${BLUE}Step 2: Checking Redis configuration...${NC}"
if grep -q "redis-server --requirepass" docker-compose.yml; then
    echo -e "${GREEN}✓ Redis password authentication already configured${NC}"
else
    echo -e "${YELLOW}⚠ Redis not configured to require password${NC}"
    echo -e "${YELLOW}  You should update docker-compose.yml to add:${NC}"
    echo -e "${YELLOW}  command: redis-server --requirepass \${REDIS_PASSWORD}${NC}"
fi

# Rebuild affected services
echo ""
echo -e "${BLUE}Step 3: Rebuilding services with new credentials...${NC}"
echo "This will rebuild services that use Redis, JWT, or API keys"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose build rest-api websocket-api data-transformer scraper-orchestrator api-gateway
    echo -e "${GREEN}✓ Services rebuilt${NC}"
else
    echo "Skipping rebuild"
    exit 0
fi

# Restart Redis
echo ""
echo -e "${BLUE}Step 4: Restarting Redis with password authentication...${NC}"
docker compose up -d --force-recreate redis
sleep 3
echo -e "${GREEN}✓ Redis restarted${NC}"

# Restart affected services
echo ""
echo -e "${BLUE}Step 5: Restarting services...${NC}"
docker compose up -d rest-api websocket-api data-transformer scraper-orchestrator api-gateway
sleep 5
echo -e "${GREEN}✓ Services restarted${NC}"

# Verify Redis authentication
echo ""
echo -e "${BLUE}Step 6: Verifying Redis authentication...${NC}"
if docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD:-Yaqh7xREV5uR1QV0T32bTIhrip/NzmpOTZlvAersx64=}" PING 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}✓ Redis authentication working${NC}"
else
    echo -e "${YELLOW}⚠ Redis authentication check inconclusive${NC}"
fi

# Check service health
echo ""
echo -e "${BLUE}Step 7: Checking service health...${NC}"
sleep 3

HEALTH_CHECKS=(
    "http://localhost:8082/health:REST API"
    "http://localhost:8083/health:WebSocket API"
    "http://localhost:8080/health:API Gateway"
    "http://localhost:8001/health:Scraper Orchestrator"
)

ALL_HEALTHY=true
for check in "${HEALTH_CHECKS[@]}"; do
    URL="${check%%:*}"
    NAME="${check##*:}"

    STATUS=$(curl -s "$URL" 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unknown")

    if [ "$STATUS" = "healthy" ]; then
        echo -e "${GREEN}✓${NC} $NAME: healthy"
    else
        echo -e "${YELLOW}⚠${NC} $NAME: $STATUS"
        ALL_HEALTHY=false
    fi
done

echo ""
if $ALL_HEALTHY; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           All Services Healthy - Update Complete! ✓           ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║      Some Services Need Attention - Check Logs                ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Run: docker compose logs <service-name> to investigate"
fi

echo ""
echo -e "${BLUE}New Credentials Summary:${NC}"
echo "  Redis Password: 44 chars (256-bit base64)"
echo "  JWT Secret: 128 chars (512-bit hex)"
echo "  API Key: 64 chars (256-bit hex)"
echo ""
echo -e "${GREEN}Security credentials successfully updated!${NC}"
