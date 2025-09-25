# SongNodes System Diagnostic Tool

A comprehensive diagnostic script to identify exactly where the SongNodes graph visualization system is failing.

## Quick Start

```bash
# Navigate to frontend directory
cd frontend

# Run the diagnostic
npm run diagnose
```

## What It Tests

### 1. **API Connectivity** 🌐
- API Gateway health (`localhost:8080/health`)
- Graph API health (proxied through API Gateway)
- Graph nodes endpoint (`/api/graph/nodes`)
- Graph edges endpoint (`/api/graph/edges`)

### 2. **Frontend Loading** 🌍
- Frontend loads at `localhost:3006`
- HTTP response status
- Initial page rendering

### 3. **React Application** ⚛️
- React root element mounting
- App component rendering
- Header and UI components

### 4. **API Data Loading** 📊
- Loading states detection
- Error message checking
- Data count indicators in UI

### 5. **Graph Component** 📈
- Graph container rendering
- Canvas element creation
- Data availability messages

### 6. **PIXI.js Initialization** 🎮
- PIXI library availability
- Canvas properties analysis
- WebGL context on canvas

### 7. **WebGL Support** 🎯
- WebGL context creation
- Graphics card information
- Extension support

### 8. **Performance Metrics** ⚡
- Browser performance timing
- Memory usage
- Performance monitor visibility

## Output

### Console Output
- Real-time test results with color coding
- ✅ PASS: Test succeeded
- ❌ FAIL: Critical failure
- ⚠️ WARN: Non-critical issue
- 📸 Screenshot notifications

### Screenshots
- Saved to `diagnostic-screenshots/` folder
- Shows app state at each major step
- Useful for visual debugging

### JSON Report
- Detailed results in `diagnostic-report.json`
- Complete test results with timestamps
- Error stack traces and details

## Exit Codes

- `0`: All tests passed
- `1`: Critical failures detected
- `2`: Non-critical failures detected
- `3`: Fatal diagnostic error

## Critical vs Non-Critical Failures

**Critical Failures** (Exit code 1):
- Frontend not loading
- React app not mounting
- API Gateway unreachable
- Graph API unreachable

**Non-Critical Failures** (Exit code 2):
- PIXI/WebGL issues
- Performance problems
- Missing data
- UI component issues

## Prerequisites

- Node.js 18+ (for built-in fetch support)
- Docker containers running:
  - Frontend at `localhost:3006`
  - API Gateway at `localhost:8080` (now proxies all API calls)

## Common Issues

### "Frontend not loading"
- Check if `npm run dev` is running
- Verify port 3006 is not blocked
- Check Docker containers are running

### "API Gateway unreachable"
- Run `docker-compose up -d` in project root
- Check port 8080 is not blocked
- Verify services are healthy

### "WebGL context not available"
- Update graphics drivers
- Enable hardware acceleration in browser
- Check browser WebGL support

### "No graph data available"
- Check database has scraped data
- Verify graph API endpoints return data
- Check API response format matches expected schema

## Debugging Tips

1. **Check Screenshots**: Visual state at each test step
2. **Review JSON Report**: Detailed test results and timing
3. **Monitor Console**: Real-time browser console messages
4. **API First**: Start with API connectivity tests
5. **Browser DevTools**: Diagnostic opens browser with DevTools

## Example Run

```bash
$ npm run diagnose

🔧 Starting SongNodes System Diagnostic...

📡 Testing API Connectivity...
[PASS] API_GATEWAY_HEALTH: API Gateway is responding
[PASS] GRAPH_API_HEALTH: Graph API is responding
[PASS] GRAPH_NODES_ENDPOINT: Graph nodes endpoint working, found 150 nodes
[PASS] GRAPH_EDGES_ENDPOINT: Graph edges endpoint working, found 89 edges

🌐 Initializing Browser...
[PASS] BROWSER_INIT: Browser initialized successfully

🌍 Testing Frontend Loading...
[PASS] FRONTEND_LOAD: Frontend loaded successfully
📸 Screenshot saved: 01-frontend-load.png

⚛️ Testing React Application Mounting...
[PASS] REACT_ROOT: React root element found
[PASS] REACT_APP_MOUNT: React App component mounted successfully
[PASS] REACT_HEADER: App header rendered

... (continues with all tests)

✅ ALL TESTS PASSED - System appears functional
```

This diagnostic tool will quickly identify exactly where your SongNodes system is failing so you can focus your debugging efforts on the right area.