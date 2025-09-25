# SongNodes Graph Visualization Test Suite

A comprehensive Playwright test suite specifically designed for testing the SongNodes DJ application's WebGL-powered graph visualization with PIXI.js rendering engine.

## 🎯 Test Coverage

### Core Functionality Tests
- **Graph Visualization** (`graph-visualization.graph.spec.ts`): Core rendering, PIXI.js initialization, WebGL context management
- **PIXI.js WebGL Performance** (`pixi-webgl-performance.performance.spec.ts`): Performance optimization, memory management, stress testing
- **Node Interactions** (`node-interactions.graph.spec.ts`): User interactions, hover/click behaviors, tool switching
- **Search and Highlighting** (`search-highlighting.graph.spec.ts`): Track search, node highlighting, filter functionality
- **Zoom and Pan Controls** (`zoom-pan-controls.graph.spec.ts`): Navigation controls, viewport management, smooth interactions
- **Visual Regression** (`visual-regression.visual.spec.ts`): Screenshot comparison, UI consistency, responsive design

## 🚀 Quick Start

### Prerequisites
```bash
# Ensure the SongNodes application is running on localhost:3006
npm run dev

# Install Playwright browsers (if not already done)
npm run test:install
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:graph          # Graph visualization tests
npm run test:webgl-stress   # WebGL stress tests
npm run test:pixi          # PIXI.js compatibility tests
npm run test:performance   # Performance tests
npm run test:visual        # Visual regression tests

# Run tests with UI (interactive mode)
npm run test:ui

# Debug mode (step through tests)
npm run test:debug

# View test reports
npm run test:report
```

## 🎵 Test Features

### Graph Visualization Testing
- **240+ Nodes**: Verifies rendering of music track nodes
- **1,549+ Edges**: Tests track adjacency relationship display
- **WebGL Performance**: Monitors frame rates and render times
- **LOD System**: Tests Level of Detail performance optimization
- **Memory Management**: Validates efficient resource usage

### Interaction Testing
- **Multi-tool Support**: Tests select, path, setlist, and filter tools
- **Node Selection**: Single and multi-select functionality
- **Hover Effects**: Visual feedback and highlighting
- **Keyboard Shortcuts**: Hotkey functionality verification

### Navigation Testing
- **Zoom Controls**: Mouse wheel and touch zoom gestures
- **Pan Operations**: Smooth dragging and momentum
- **View Reset**: Return to default position and zoom
- **Boundary Testing**: Edge case navigation limits

### Search and Discovery
- **Track Search**: Find specific tracks like "Bangarang", "Adagio for Strings"
- **Fuzzy Matching**: Partial and approximate search functionality
- **Real-time Highlighting**: Dynamic node highlighting during search
- **Search Performance**: Maintains responsiveness with large datasets

### Performance Benchmarks
- **Minimum Requirements**:
  - Frame Rate: ≥ 30 FPS (normal), ≥ 20 FPS (stressed)
  - Render Time: ≤ 50ms per frame
  - Memory Usage: ≤ 100MB growth during extended operations
- **Stress Testing**: Rapid operations, memory pressure, context switching

### Visual Regression
- **Screenshot Comparison**: Pixel-perfect UI consistency
- **Responsive Design**: Multiple viewport sizes
- **Cross-Browser Testing**: Chrome, Firefox, Safari compatibility
- **Theme Consistency**: Color schemes and UI elements

## 🔧 Configuration

### Playwright Configuration (`playwright.config.ts`)
- **Extended Timeouts**: 60s for complex WebGL operations
- **WebGL Optimization**: Hardware acceleration flags
- **Multiple Projects**: Specialized test environments
- **Screenshot Settings**: Visual regression thresholds

### Test Projects
- `chromium-desktop`: Standard desktop testing
- `graph-visualization`: Extended timeouts for graph operations
- `webgl-stress-test`: High-performance stress testing
- `pixi-compatibility`: PIXI.js specific optimizations
- `performance`: Performance benchmarking
- `visual-regression`: Visual consistency testing

## 📊 Test Utilities

### GraphTestUtils Class (`tests/utils/graph-helpers.ts`)
Comprehensive helper functions for graph testing:

```typescript
// WebGL verification
await graphUtils.verifyWebGLFunctionality();

// Performance monitoring
const metrics = await graphUtils.getPerformanceMetrics();

// Navigation controls
await graphUtils.zoomIn(3);
await graphUtils.pan(100, 100);
await graphUtils.resetView();

// Screenshot capture
await graphUtils.takeCanvasScreenshot('test-state');

// Animation waiting
await graphUtils.waitForAnimation();
```

## 🎨 Visual Testing

### Screenshot Organization
```
tests/screenshots/
├── graph/                 # Graph-specific screenshots
├── interactions/          # User interaction screenshots
├── performance/           # Performance test screenshots
└── visual-regression/     # Regression test baselines
```

### Updating Visual Baselines
```bash
# Update all screenshots
npx playwright test --update-snapshots

# Update specific test screenshots
npx playwright test visual-regression --update-snapshots
```

## 🔍 Debugging

### Debug Mode
```bash
# Run tests with browser visible
npm run test:debug

# Run specific test file in debug mode
npx playwright test graph-visualization.graph.spec.ts --debug
```

### Test Reports
```bash
# Generate and view HTML report
npm run test:report

# View JSON results
cat tests/reports/results.json
```

### Common Issues

#### WebGL Context Issues
- Verify GPU acceleration is enabled
- Check browser flags in `playwright.config.ts`
- Review WebGL info in `test-results/webgl-info.json`

#### Performance Test Failures
- Monitor system resource usage
- Check if other applications are consuming GPU
- Verify minimum hardware requirements

#### Visual Regression Failures
- Review screenshot differences in HTML report
- Update baselines if changes are intentional
- Check for timing issues in animation completion

## 📈 Performance Monitoring

### Metrics Tracked
- **Frame Rate**: Real-time FPS monitoring
- **Render Time**: Per-frame rendering duration
- **Memory Usage**: JavaScript heap monitoring
- **Node/Edge Counts**: Visible vs. total objects
- **WebGL Context**: GPU utilization and capabilities

### Performance Thresholds
```typescript
// Minimum acceptable performance
frameRate: ≥ 30 FPS      // Normal operation
frameRate: ≥ 20 FPS      // Under stress
renderTime: ≤ 50ms       // Per frame
memoryGrowth: ≤ 100MB    // During extended operation
```

## 🎪 Advanced Features

### Multi-Browser Testing
Tests run across Chromium, Firefox, and WebKit to ensure consistent behavior across different rendering engines.

### Touch and Mobile Testing
Simulated touch gestures for pinch-to-zoom and touch panning on mobile devices.

### Context Loss Recovery
Tests WebGL context loss scenarios and recovery mechanisms.

### Memory Pressure Testing
Validates application behavior under memory constraints and garbage collection scenarios.

## 🔗 Integration

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run SongNodes Graph Tests
  run: |
    npm ci
    npm run test:install
    npm run dev &
    npm run test:graph
```

### Docker Testing
```dockerfile
# Playwright with WebGL support
FROM mcr.microsoft.com/playwright:focal
RUN apt-get update && apt-get install -y \
    xvfb \
    libgl1-mesa-glx \
    libgl1-mesa-dri
```

## 📝 Contributing

### Adding New Tests
1. Create test files following the naming convention: `*.graph.spec.ts`, `*.performance.spec.ts`, `*.visual.spec.ts`
2. Use the `GraphTestUtils` helper class for graph-specific operations
3. Include appropriate screenshot captures for visual verification
4. Add performance assertions where relevant

### Test Categories
- `.graph.spec.ts`: Core graph functionality
- `.performance.spec.ts`: Performance and stress testing
- `.visual.spec.ts`: Visual regression and UI consistency

### Best Practices
- Always wait for graph initialization before testing
- Use consistent viewport sizes for visual tests
- Disable animations for screenshot consistency
- Include performance verification in interaction tests
- Capture debugging screenshots for complex operations

---

## 📚 Test Suite Summary

This comprehensive test suite ensures the SongNodes DJ application's graph visualization maintains:
- **Performance**: Smooth 60 FPS rendering with 240+ nodes and 1,549+ edges
- **Reliability**: Consistent behavior across browsers and devices
- **Usability**: Intuitive interactions and responsive controls
- **Quality**: Visual consistency and regression prevention

The tests provide confidence in deploying a robust music visualization platform that can handle real-world DJ performance requirements.