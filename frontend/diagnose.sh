#!/bin/bash

# SongNodes Diagnostic Runner
# Simple wrapper script for the diagnostic tool

echo "🔧 SongNodes System Diagnostic"
echo "=============================="
echo ""
echo "This will test all system components to identify failures."
echo "The browser will open automatically for visual testing."
echo ""

# Check if in the right directory
if [ ! -f "diagnostic-script.js" ]; then
    echo "❌ Error: diagnostic-script.js not found in current directory"
    echo "Please run this from the frontend/ directory:"
    echo "  cd frontend"
    echo "  ./diagnose.sh"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found"
    echo "Please install Node.js 18+ to run the diagnostic"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'.' -f1 | cut -d'v' -f2)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Warning: Node.js 18+ recommended (current: $(node --version))"
    echo "The diagnostic may not work properly with older versions"
fi

# Check if Playwright is installed
if [ ! -d "node_modules/@playwright" ]; then
    echo "❌ Error: Playwright not found"
    echo "Please install dependencies first:"
    echo "  npm install"
    echo "  npm run test:install"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Clean up previous run
if [ -d "diagnostic-screenshots" ]; then
    echo "🧹 Cleaning up previous screenshots..."
    rm -rf diagnostic-screenshots
fi

if [ -f "diagnostic-report.json" ]; then
    echo "🧹 Cleaning up previous report..."
    rm -f diagnostic-report.json
fi

echo ""
echo "🚀 Starting diagnostic..."
echo "   - Browser will open automatically"
echo "   - Screenshots will be saved"
echo "   - Detailed report will be generated"
echo ""

# Run the diagnostic
node diagnostic-script.js

# Check exit code and provide guidance
EXIT_CODE=$?

echo ""
echo "📋 Diagnostic Complete!"
echo ""

case $EXIT_CODE in
    0)
        echo "✅ Result: ALL TESTS PASSED"
        echo "   System appears to be working correctly."
        ;;
    1)
        echo "❌ Result: CRITICAL FAILURES DETECTED"
        echo "   System is not functional. Check the report for details."
        echo "   Common fixes:"
        echo "   - Ensure Docker containers are running: docker-compose up -d"
        echo "   - Check if frontend dev server is running: npm run dev"
        ;;
    2)
        echo "⚠️  Result: NON-CRITICAL ISSUES FOUND"
        echo "   System may have performance or compatibility issues."
        echo "   Check the report for optimization recommendations."
        ;;
    3)
        echo "💥 Result: DIAGNOSTIC ERROR"
        echo "   The diagnostic tool itself encountered an error."
        echo "   Please check the console output above for details."
        ;;
esac

echo ""
echo "📄 Files generated:"
if [ -f "diagnostic-report.json" ]; then
    echo "   - diagnostic-report.json (detailed results)"
fi
if [ -d "diagnostic-screenshots" ]; then
    SCREENSHOT_COUNT=$(find diagnostic-screenshots -name "*.png" | wc -l)
    echo "   - diagnostic-screenshots/ ($SCREENSHOT_COUNT screenshots)"
fi

echo ""
echo "For more information, see DIAGNOSTIC_README.md"