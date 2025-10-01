#!/bin/bash
# Browser Collector Setup Script

set -e

echo "🎵 Setting up Browser Automation Data Collector..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Must be run from project root directory"
    exit 1
fi

# Create necessary directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p ./data/browser-screenshots
chmod 777 ./data/browser-screenshots
echo -e "${GREEN}✓ Directories created${NC}"

# Check if database schema is applied
echo -e "${YELLOW}Checking database schema...${NC}"
if docker compose ps postgres | grep -q "Up"; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"

    # Apply browser collector schema
    echo "Applying browser collector schema..."
    docker compose exec -T postgres psql -U musicdb_user -d musicdb < sql/init/09-browser-collector-schema.sql
    echo -e "${GREEN}✓ Schema applied${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL not running. Start services first with: docker compose up -d postgres${NC}"
fi

# Check/setup Ollama models
echo -e "${YELLOW}Checking Ollama models...${NC}"
if docker compose ps ollama | grep -q "Up"; then
    echo "Ollama is running. Checking for required models..."

    # Check if llama3.2:3b exists
    if ! docker compose exec ollama ollama list | grep -q "llama3.2:3b"; then
        echo "Pulling llama3.2:3b model (this may take a while)..."
        docker compose exec ollama ollama pull llama3.2:3b
        echo -e "${GREEN}✓ llama3.2:3b downloaded${NC}"
    else
        echo -e "${GREEN}✓ llama3.2:3b already available${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Ollama not running. Start with: docker compose up -d ollama${NC}"
fi

# Build browser collector
echo -e "${YELLOW}Building browser collector service...${NC}"
docker compose build browser-collector
echo -e "${GREEN}✓ Browser collector built${NC}"

# Start browser collector
echo -e "${YELLOW}Starting browser collector service...${NC}"
docker compose up -d browser-collector

# Wait for service to be healthy
echo "Waiting for service to be healthy..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf http://localhost:8030/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Browser collector is healthy!${NC}"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "  Attempt $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${YELLOW}⚠ Service did not become healthy in time. Check logs:${NC}"
    echo "  docker compose logs browser-collector"
    exit 1
fi

# Display status
echo ""
echo "="
echo "🎉 Browser Collector Setup Complete!"
echo "="
echo ""
echo "Service URL: http://localhost:8030"
echo "Health Check: http://localhost:8030/health"
echo "Metrics: http://localhost:8030/metrics"
echo ""
echo "Quick Start:"
echo "  1. Check health:"
echo "     curl http://localhost:8030/health"
echo ""
echo "  2. Run example collection:"
echo "     docker compose exec browser-collector python examples/example_usage.py"
echo ""
echo "  3. View logs:"
echo "     docker compose logs -f browser-collector"
echo ""
echo "  4. View collected data:"
echo "     docker compose exec postgres psql -U musicdb_user -d musicdb -c 'SELECT * FROM collection_sessions ORDER BY started_at DESC LIMIT 5;'"
echo ""
echo "Documentation: services/browser-collector/README.md"
echo ""
