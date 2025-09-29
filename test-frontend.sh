#!/bin/bash
set -e

echo "🧪 Running automated frontend tests..."
echo "=================================="

# Ensure Docker Compose stack is running
echo "📦 Checking if services are running..."
docker compose ps

# Check if frontend is accessible
echo "🌐 Checking frontend accessibility..."
curl -f -s -o /dev/null http://localhost:3006 && echo "✅ Frontend is accessible" || (echo "❌ Frontend not accessible" && exit 1)

# Install Playwright if not already installed
echo "📚 Setting up Playwright..."
cd frontend-tests
npm install
npx playwright install chromium

# Create test results directory
mkdir -p test-results

# Run the tests
echo "🚀 Running Playwright tests..."
npx playwright test --reporter=list

echo "✅ Frontend tests completed!"
echo ""
echo "To view detailed HTML report, run:"
echo "  cd frontend-tests && npm run test:report"