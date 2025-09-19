#!/bin/bash

echo "🧪 Testing SongNodes Visualization System"
echo "========================================="

# Test 1: Check if frontend is accessible
echo -n "1. Frontend accessibility: "
if curl -s http://localhost:3008 > /dev/null 2>&1; then
    echo "✅ PASS"
else
    echo "❌ FAIL - Frontend not accessible"
    exit 1
fi

# Test 2: Check if visualization API is working
echo -n "2. Visualization API: "
nodes_count=$(curl -s -X POST http://localhost:8090/api/v1/visualization/graph \
    -H "Content-Type: application/json" \
    -d '{"max_nodes": 10}' | jq -r '.nodes | length' 2>/dev/null)

if [[ "$nodes_count" =~ ^[0-9]+$ ]] && [ "$nodes_count" -gt 0 ]; then
    echo "✅ PASS (returned $nodes_count nodes)"
else
    echo "❌ FAIL - API not returning valid data"
    exit 1
fi

# Test 3: Check if frontend proxy is working
echo -n "3. Frontend proxy: "
proxy_nodes=$(curl -s -X POST http://localhost:3008/api/v1/visualization/graph \
    -H "Content-Type: application/json" \
    -d '{"max_nodes": 5}' | jq -r '.nodes | length' 2>/dev/null)

if [[ "$proxy_nodes" =~ ^[0-9]+$ ]] && [ "$proxy_nodes" -gt 0 ]; then
    echo "✅ PASS (returned $proxy_nodes nodes)"
else
    echo "❌ FAIL - Proxy not working"
    exit 1
fi

# Test 4: Check Docker services
echo -n "4. Docker services: "
services_up=$(docker compose ps --format json | jq -r 'select(.State == "running") | .Name' | wc -l)
if [ "$services_up" -ge 3 ]; then
    echo "✅ PASS ($services_up services running)"
else
    echo "❌ FAIL - Not enough services running"
    exit 1
fi

echo ""
echo "🎉 All tests passed! The visualization system should be working."
echo "📱 Access the application at: http://localhost:3008"
echo ""
echo "💡 Fixes implemented:"
echo "   - ✅ Fixed useResizeObserver dimension calculation"
echo "   - ✅ Added fallback dimensions for canvas rendering"
echo "   - ✅ Improved conditional rendering logic"
echo "   - ✅ Environment variable based configuration"
echo "   - ✅ Enhanced debugging and error detection"