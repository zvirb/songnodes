#!/bin/bash

# Run UX Compliance Tests with Playwright
echo "🎯 Starting DJ Interface UX Compliance Testing"
echo "============================================="

# Create screenshots directory
mkdir -p screenshots

# Ensure frontend is running
echo "📦 Installing dependencies..."
cd frontend
npm install

# Install Playwright if needed
npx playwright install chromium

echo "🚀 Starting development server..."
npm run dev &
DEV_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to be ready..."
sleep 5

# Run the tests
echo "🧪 Running UX compliance tests..."
cd ..
npx playwright test tests/dj-ux-compliance.spec.ts --headed --reporter=list

# Kill the dev server
kill $DEV_PID

echo ""
echo "📸 Screenshots saved to ./screenshots/"
echo "Review them to verify UX compliance with:"
echo "  - The DJ's Co-Pilot principles"
echo "  - UI/UX Guide standards"
echo ""
echo "Key screenshots to review:"
echo "  - ux-test-proximity.png: Gestalt grouping"
echo "  - ux-test-hierarchy.png: Visual hierarchy"
echo "  - ux-test-harmonic-colors.png: Color-coded compatibility"
echo "  - ux-test-energy-meters.png: Visual energy representation"
echo "  - ux-test-hicks-law.png: Limited choices"
echo "  - ux-test-contrast.png: Dark environment optimization"