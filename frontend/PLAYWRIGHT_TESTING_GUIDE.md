# 🎭 SongNodes Playwright Testing Guide

## Overview

This document describes the comprehensive Playwright testing environment specifically designed for the SongNodes DJ frontend application's WebGL-powered graph visualization system using PIXI.js and D3.js.

## 🚀 Quick Start

### Installation

```bash
# Install Playwright and dependencies
npm install

# Install browser binaries
npm run test:install
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:graph          # Core graph visualization tests
npm run test:webgl-stress   # WebGL stress testing
npm run test:pixi           # PIXI.js compatibility tests
npm run test:performance    # Performance benchmarks
npm run test:visual         # Visual regression tests

# Debug mode
npm run test:debug

# Interactive UI mode
npm run test:ui

# View test reports
npm run test:report
```

## 🧪 Test Structure

### Test Categories

#### 1. Core Graph Visualization (`*.graph.spec.ts`)
- **Purpose**: Tests fundamental graph visualization functionality
- **Focus**: Node rendering, edge display, interactions, zoom/pan
- **Configuration**: `graph-visualization` project
- **Timeouts**: Extended for complex WebGL operations (60s)

#### 2. WebGL Stress Tests (`*.webgl-stress.spec.ts`)
- **Purpose**: Tests graph under extreme conditions
- **Focus**: Context stability, memory pressure, performance under load
- **Configuration**: `webgl-stress-test` project
- **Memory**: Up to 8GB allocated for stress testing

#### 3. PIXI.js Compatibility (`*.pixi.spec.ts`)
- **Purpose**: Tests PIXI.js specific features and integration
- **Focus**: WebGL rendering, graphics objects, containers, events
- **Configuration**: `pixi-compatibility` project
- **Features**: Cutting-edge WebGL features enabled

#### 4. Performance Benchmarks (`*.performance.spec.ts`)
- **Purpose**: Comprehensive performance analysis
- **Focus**: Frame rates, render times, memory usage, scalability
- **Configuration**: `performance` project
- **Output**: Detailed performance reports and CSV data

#### 5. Visual Regression (`*.visual.spec.ts`)
- **Purpose**: Visual consistency validation
- **Focus**: Screenshot comparison, UI element positioning
- **Configuration**: `visual-regression` project
- **Animation**: Disabled for consistent screenshots

## 🛠️ Configuration Details

### Browser Contexts

#### WebGL-Optimized Chrome
```javascript
launchOptions: {
  args: [
    '--enable-webgl',
    '--enable-webgl2-compute-context',
    '--enable-accelerated-2d-canvas',
    '--enable-gpu-rasterization',
    '--force-color-profile=srgb',
    '--enable-zero-copy',
    '--disable-software-rasterizer',
    '--max_old_space_size=4096'
  ]
}
```

#### Performance Testing
- Viewport: 2560x1440 for stress testing
- Memory: Up to 8GB allocated
- Timeouts: Extended for complex operations

#### Mobile Testing
- Device: Pixel 5 emulation
- WebGL: Enabled with mobile optimizations
- Viewport: Responsive testing

### Test Utilities

#### `GraphVisualizationHelpers`
- WebGL support verification
- PIXI.js application management
- Graph metrics collection
- Node/edge interaction testing
- Zoom/pan functionality testing
- Performance measurement

#### `PerformanceTestHelpers`
- Frame rate monitoring
- Memory usage tracking
- Benchmark execution
- WebGL profiling
- Stress testing utilities

#### `GraphTestUtils`
- High-level testing interface
- Screenshot utilities
- Animation waiting
- WebGL verification

## 📊 Performance Monitoring

### Metrics Collected

- **Frame Rate**: Average, min, max FPS
- **Render Time**: Frame rendering duration
- **Memory Usage**: JavaScript heap usage
- **Node/Edge Counts**: Graph complexity metrics
- **WebGL Info**: Renderer capabilities and extensions

### Performance Thresholds

| Metric | Excellent | Good | Acceptable | Poor |
|--------|-----------|------|------------|------|
| FPS | ≥60 | 50-59 | 30-49 | <30 |
| Render Time | ≤16ms | 17-20ms | 21-33ms | >33ms |
| Memory Growth | <5% | 5-10% | 10-20% | >20% |

### Custom Reporter

The `GraphMetricsReporter` provides:
- Performance analysis
- Project breakdown
- Recommendation generation
- CSV export for further analysis
- JSON report with detailed metrics

## 🔧 WebGL Testing Features

### Context Loss Recovery
Tests simulate and verify recovery from:
- WebGL context loss
- GPU crashes
- Memory pressure
- Driver issues

### Extension Support Verification
- `OES_element_index_uint`: Large geometry support
- `OES_texture_float`: High-precision textures
- `EXT_texture_filter_anisotropic`: Enhanced filtering
- `WEBGL_lose_context`: Context recovery testing

### Compatibility Matrix

| Browser | WebGL 1.0 | WebGL 2.0 | PIXI.js 8.x | Performance |
|---------|-----------|-----------|-------------|-------------|
| Chrome | ✅ | ✅ | ✅ | Excellent |
| Firefox | ✅ | ✅ | ✅ | Good |
| Safari | ✅ | ⚠️ | ✅ | Good |

## 📁 File Organization

```
tests/
├── e2e/                              # End-to-end test files
│   ├── graph-visualization.graph.spec.ts
│   ├── webgl-stress.spec.ts
│   ├── pixi-compatibility.pixi.spec.ts
│   └── graph-performance.performance.spec.ts
├── utils/                            # Test utilities
│   ├── graph-test-helpers.ts         # Graph-specific helpers
│   ├── performance-test-helpers.ts   # Performance utilities
│   ├── graph-helpers.ts              # High-level test utils
│   └── graph-metrics-reporter.ts     # Custom reporter
├── setup/                            # Global setup/teardown
│   ├── global-setup.ts               # WebGL verification
│   └── global-teardown.ts            # Cleanup
└── fixtures/                         # Test data and fixtures
```

## 🚨 Troubleshooting

### Common Issues

#### WebGL Not Available
```bash
# Check WebGL support
npm run test:debug -- --grep "WebGL"

# Verify browser flags
npx playwright show-trace
```

#### Performance Tests Failing
```bash
# Run isolated performance test
npm run test:performance -- --repeat-each=1

# Check system resources
htop  # Monitor CPU/memory during tests
```

#### PIXI.js Compatibility Issues
```bash
# Test PIXI.js version compatibility
npm run test:pixi -- --reporter=list

# Check browser console for errors
npm run test:debug -- --grep "PIXI"
```

### Debug Mode

```bash
# Run with debug output
DEBUG=pw:api npm test

# Run specific test with debugging
npm run test:debug -- tests/e2e/graph-visualization.graph.spec.ts

# Visual debug mode
npm run test:ui
```

## 📈 Performance Optimization

### Test Execution

- **Parallel Execution**: Limited to 2 workers due to WebGL resource usage
- **Retries**: 2 retries in CI, 1 locally
- **Timeouts**: Extended for WebGL operations
- **Memory Management**: Automatic cleanup between tests

### Best Practices

1. **WebGL Context Management**: Always verify context before operations
2. **Memory Monitoring**: Check for leaks in long-running tests
3. **Performance Baselines**: Establish baselines for different hardware
4. **Visual Validation**: Use screenshots for regression detection
5. **Error Recovery**: Test graceful degradation scenarios

## 🔗 Integration

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run WebGL Tests
  run: |
    npm install
    npm run test:install
    npm run test -- --reporter=junit
  env:
    DISPLAY: ':99'
    CI: true
```

### Development Workflow

1. **Local Development**: Run specific test suites during development
2. **Pre-commit**: Core graph tests for basic functionality
3. **CI Pipeline**: Full test suite including stress tests
4. **Performance Monitoring**: Regular performance benchmarks

## 📋 Test Checklist

Before committing WebGL visualization changes:

- [ ] Core graph tests pass
- [ ] WebGL compatibility verified
- [ ] Performance within acceptable thresholds
- [ ] No memory leaks detected
- [ ] PIXI.js features working correctly
- [ ] Visual regression tests pass
- [ ] Cross-browser compatibility confirmed

## 🎯 Future Enhancements

- [ ] WebGPU support testing
- [ ] Mobile device testing on real hardware
- [ ] Automated performance regression detection
- [ ] Multi-GPU testing scenarios
- [ ] VR/AR compatibility testing (future)

---

**Note**: This testing environment is specifically optimized for WebGL/PIXI.js graph visualization. Standard web testing approaches may not be sufficient for the complex graphics operations performed by this application.