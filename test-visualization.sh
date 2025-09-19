#!/bin/bash

# Test script for visualization and scrapers
# This runs a minimal setup to test the core functionality

echo "🎵 SongNodes Test Environment"
echo "============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Start frontend development server
echo -e "${YELLOW}Starting frontend development server...${NC}"
cd frontend
npm install --silent
npm run dev &
FRONTEND_PID=$!
cd ..
echo -e "${GREEN}✅ Frontend started on http://localhost:3000${NC}"

# Step 2: Start graph visualization API
echo -e "${YELLOW}Starting graph visualization API...${NC}"
cd services/graph-visualization-api
python -m venv venv 2>/dev/null
source venv/bin/activate
pip install -q fastapi uvicorn sqlalchemy redis psycopg2-binary prometheus-client
python run_api_test.py &
API_PID=$!
deactivate
cd ../..
echo -e "${GREEN}✅ Graph API started on http://localhost:8084${NC}"

# Step 3: Run scraper tests
echo -e "${YELLOW}Testing scrapers...${NC}"
cd scrapers

# Test 1001tracklists
echo "Testing 1001tracklists scraper..."
python basic_test.py 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 1001tracklists scraper working${NC}"
else
    echo -e "${RED}❌ 1001tracklists scraper failed${NC}"
fi

# Test MixesDB
echo "Testing MixesDB scraper..."
python test_mixesdb_scraper.py 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ MixesDB scraper working${NC}"
else
    echo -e "${RED}❌ MixesDB scraper failed${NC}"
fi

# Test Setlist.fm
echo "Testing Setlist.fm scraper..."
python test_setlistfm_scraper.py 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Setlist.fm scraper working${NC}"
else
    echo -e "${RED}❌ Setlist.fm scraper failed${NC}"
fi

cd ..

# Step 4: Open browser
echo ""
echo -e "${GREEN}🎉 Test environment ready!${NC}"
echo ""
echo "Access points:"
echo "  - Frontend: http://localhost:3000"
echo "  - Graph API: http://localhost:8084"
echo "  - API Docs: http://localhost:8084/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "kill $FRONTEND_PID $API_PID 2>/dev/null; exit" INT
wait
