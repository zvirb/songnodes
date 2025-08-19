# Comprehensive Testing Guide for SongNodes

## Overview

This guide covers the complete testing strategy for the SongNodes graph visualization system, including unit testing, integration testing, end-to-end testing, accessibility testing, performance testing, and quality assurance.

## Table of Contents

1. [Testing Architecture](#testing-architecture)
2. [Frontend Testing](#frontend-testing)
3. [Backend Testing](#backend-testing)
4. [End-to-End Testing](#end-to-end-testing)
5. [Accessibility Testing](#accessibility-testing)
6. [Performance Testing](#performance-testing)
7. [Visual Regression Testing](#visual-regression-testing)
8. [CI/CD Integration](#cicd-integration)
9. [Quality Metrics](#quality-metrics)
10. [Best Practices](#best-practices)

## Testing Architecture

### Test Pyramid Structure

```
    E2E Tests (Few)
      /\
     /  \
    /    \
   /      \
  Integration Tests (Some)
     /\
    /  \
   /    \
  Unit Tests (Many)
```

### Coverage Targets

- **Unit Tests**: >90% coverage for critical components
- **Integration Tests**: >85% API endpoint coverage
- **E2E Tests**: >80% user workflow coverage
- **Accessibility**: 100% WCAG 2.1 AA compliance
- **Performance**: <5% regression tolerance

## Frontend Testing

### Unit Testing with Vitest

**Location**: `frontend/src/**/*.test.tsx`

**Configuration**: `vitest.config.ts`, `vitest.coverage.config.ts`

#### Component Testing Example

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphCanvas } from './GraphCanvas';
import { createMockGraphData } from '../../test/setup';

describe('GraphCanvas Component', () => {
  let mockData: ReturnType<typeof createMockGraphData>;

  beforeEach(() => {
    mockData = createMockGraphData(10, 8);
  });

  it('renders graph with correct node count', () => {
    render(<GraphCanvas nodes={mockData.nodes} edges={mockData.edges} />);
    
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText('10 nodes')).toBeInTheDocument();
  });

  it('handles node selection', async () => {
    const onNodeSelect = vi.fn();
    render(
      <GraphCanvas 
        nodes={mockData.nodes} 
        edges={mockData.edges}
        onNodeSelect={onNodeSelect}
      />
    );

    const canvas = screen.getByRole('img');
    fireEvent.click(canvas);

    expect(onNodeSelect).toHaveBeenCalled();
  });
});
```

#### Running Frontend Tests

```bash
# Run all unit tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test GraphCanvas.test.tsx

# Run accessibility tests
npm run test:accessibility

# Run performance tests
npm run test:performance
```

### Test Utilities

**Location**: `frontend/src/test/`

- `setup.ts` - Global test configuration and mocks
- `accessibility-setup.ts` - Accessibility testing utilities
- `performance-setup.ts` - Performance testing utilities

## Backend Testing

### API Integration Testing

**Location**: `tests/integration/`

**Framework**: pytest + httpx

#### API Test Example

```python
import pytest
import httpx
from tests.integration.test_graph_api_comprehensive import GraphAPITestClient

@pytest.mark.asyncio
async def test_node_creation():
    async with GraphAPITestClient() as client:
        node_data = {
            "id": "test-node-1",
            "name": "Test Track",
            "type": "track",
            "x": 100.0,
            "y": 100.0
        }
        
        response = await client.post("/api/v1/nodes", json=node_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == node_data["id"]
```

#### Running Backend Tests

```bash
# Install dependencies
pip install -r tests/requirements.txt

# Run all integration tests
pytest tests/integration/ -v

# Run with coverage
pytest tests/integration/ --cov=services --cov-report=html

# Run performance tests
pytest tests/performance/ -v

# Run specific test class
pytest tests/integration/test_graph_api_comprehensive.py::TestNodeOperations -v
```

## End-to-End Testing

### Playwright Configuration

**Location**: `frontend/tests/e2e/`

**Configuration**: `playwright.config.ts`

#### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test.describe('Graph Visualization E2E', () => {
  test('loads and displays graph', async ({ page }) => {
    await page.goto('/graph');
    
    // Wait for graph to load
    await expect(page.locator('canvas')).toBeVisible();
    
    // Verify data is loaded
    await expect(page.locator('[data-testid="node-count"]'))
      .toContainText(/\d+ nodes/);
  });

  test('supports node interaction', async ({ page }) => {
    await page.goto('/graph');
    
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 400, y: 300 } });
    
    // Verify node details appear
    await expect(page.locator('[data-testid="node-details"]'))
      .toBeVisible();
  });
});
```

#### Running E2E Tests

```bash
# Install Playwright browsers
npx playwright install

# Run all E2E tests
npm run e2e

# Run in headed mode for debugging
npm run e2e:headed

# Run specific browser
npx playwright test --project=chromium

# Debug tests
npm run e2e:debug
```

### Cross-Browser Testing

Tests run automatically on:
- Chromium (Chrome/Edge)
- Firefox
- WebKit (Safari)
- Mobile Chrome
- Mobile Safari

## Accessibility Testing

### WCAG 2.1 AA Compliance

**Location**: `frontend/src/**/*.a11y.test.tsx`

**Tools**: jest-axe, @axe-core/playwright

#### Accessibility Test Example

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { GraphCanvas } from './GraphCanvas';

expect.extend(toHaveNoViolations);

test('meets WCAG 2.1 AA standards', async () => {
  const { container } = render(<GraphCanvas />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

#### Accessibility Features Tested

- **Keyboard Navigation**: Tab order, arrow keys, Enter/Space
- **Screen Reader Support**: ARIA labels, live regions, announcements
- **Focus Management**: Visible focus indicators, focus traps
- **Color Contrast**: WCAG AA contrast ratios
- **Semantic HTML**: Proper heading structure, landmarks
- **Alternative Text**: Meaningful descriptions for visualizations

### Running Accessibility Tests

```bash
# Run accessibility test suite
npm run test:accessibility

# Run with detailed output
npm run test:accessibility -- --reporter=verbose

# Check specific component
npm run test GraphCanvas.a11y.test.tsx
```

## Performance Testing

### Performance Regression Framework

**Location**: `frontend/src/utils/performanceRegressionTesting.ts`

#### Performance Test Example

```typescript
import { performanceRegressionTester } from '../utils/performanceRegressionTesting';

test('graph rendering performance', async () => {
  // Record baseline (first run)
  await performanceRegressionTester.recordBaseline(
    'graph-render-1000-nodes',
    1000,
    800
  );

  // Test for regressions (subsequent runs)
  const result = await performanceRegressionTester.testRegression(
    'graph-render-1000-nodes',
    1000,
    800
  );

  expect(result.passed).toBe(true);
  expect(result.regressions).toHaveLength(0);
});
```

#### Performance Metrics

- **Render Time**: Initial graph render duration
- **Frame Rate**: Animation smoothness (target: >30 FPS)
- **Memory Usage**: Heap size monitoring
- **Interaction Time**: Response to user input
- **Core Web Vitals**: FCP, LCP, CLS, TBT

### Running Performance Tests

```bash
# Run performance test suite
npm run test:performance

# Run Lighthouse audits
npm run lighthouse

# Run Lighthouse CI
npm run lighthouse:ci

# Generate performance report
npm run test:performance -- --reporter=json --outputFile=results.json
```

## Visual Regression Testing

### Playwright Visual Testing

**Configuration**: `playwright.visual.config.ts`

#### Visual Test Example

```typescript
import { test, expect } from '@playwright/test';

test('graph visualization appearance', async ({ page }) => {
  await page.goto('/graph');
  await page.waitForLoadState('networkidle');
  
  // Take screenshot and compare with baseline
  await expect(page).toHaveScreenshot('graph-view.png');
});
```

### Managing Visual Baselines

```bash
# Update visual baselines
npx playwright test --update-snapshots

# Run visual regression tests
npx playwright test --config=playwright.visual.config.ts

# Review visual diffs
npx playwright show-report
```

## CI/CD Integration

### GitHub Actions Workflow

**Location**: `.github/workflows/quality-assurance.yml`

#### Pipeline Stages

1. **Frontend Tests**
   - Unit tests with coverage
   - Accessibility tests
   - Performance tests

2. **Backend Tests**
   - API integration tests
   - Database tests
   - Performance tests

3. **E2E Tests**
   - Cross-browser testing
   - Mobile responsiveness
   - User workflow validation

4. **Quality Gates**
   - Coverage thresholds
   - Performance regression checks
   - Security scans
   - Code quality analysis

#### Quality Gates Configuration

```yaml
# Coverage thresholds
FRONTEND_COVERAGE_THRESHOLD: 90%
BACKEND_COVERAGE_THRESHOLD: 85%

# Performance thresholds
MAX_PERFORMANCE_REGRESSION: 20%
MIN_LIGHTHOUSE_SCORE: 90

# Security requirements
MAX_VULNERABILITY_SEVERITY: medium
```

## Quality Metrics

### Coverage Reporting

**Frontend Coverage**: Vitest + V8
**Backend Coverage**: pytest-cov
**E2E Coverage**: Manual workflow coverage tracking

#### Coverage Targets by Component

| Component | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| GraphCanvas | 95% | 95% | 95% | 95% |
| Utils | 85% | 85% | 85% | 85% |
| Store | 90% | 90% | 90% | 90% |
| Hooks | 88% | 88% | 88% | 88% |

### Quality Dashboard

**Tools**: SonarCloud, Codecov, Lighthouse CI

**Metrics Tracked**:
- Code coverage trends
- Performance regression history
- Accessibility compliance score
- Security vulnerability count
- Code quality ratings

## Best Practices

### Test Writing Guidelines

#### 1. Test Structure (AAA Pattern)

```typescript
test('should do something when condition', () => {
  // Arrange
  const mockData = createMockData();
  
  // Act
  const result = performAction(mockData);
  
  // Assert
  expect(result).toBe(expectedValue);
});
```

#### 2. Descriptive Test Names

```typescript
// ❌ Bad
test('graph test', () => {});

// ✅ Good
test('renders graph with 100 nodes and maintains 30+ FPS', () => {});
```

#### 3. Test Independence

```typescript
// Each test should be independent
beforeEach(() => {
  // Reset state
  vi.clearAllMocks();
  cleanup();
});
```

#### 4. Mock External Dependencies

```typescript
// Mock API calls
vi.mock('../services/graphService', () => ({
  fetchNodes: vi.fn().mockResolvedValue(mockNodes),
  fetchEdges: vi.fn().mockResolvedValue(mockEdges),
}));
```

### Performance Testing Guidelines

#### 1. Establish Baselines

```typescript
// Record performance baseline for new features
await performanceRegressionTester.recordBaseline(
  'new-feature-performance',
  testDataSize.nodes,
  testDataSize.edges
);
```

#### 2. Test Under Load

```typescript
// Test with realistic data volumes
const largeDataset = createMockGraphData(5000, 4000);
const metrics = await measurePerformance(() => {
  renderGraph(largeDataset);
});

expect(metrics.renderTime).toBeLessThan(100); // ms
```

#### 3. Monitor Memory Usage

```typescript
const memoryBefore = measureMemoryUsage();
performMemoryIntensiveOperation();
const memoryAfter = measureMemoryUsage();

expect(memoryAfter.delta).toBeLessThan(10 * 1024 * 1024); // 10MB
```

### Accessibility Testing Guidelines

#### 1. Test with Real Users

- Include users with disabilities in testing
- Test with actual screen readers
- Validate keyboard-only navigation

#### 2. Automated + Manual Testing

```typescript
// Automated accessibility check
const results = await axe(container);
expect(results).toHaveNoViolations();

// Manual verification of screen reader announcements
expect(screen.getByLabelText(/graph updated/)).toBeInTheDocument();
```

#### 3. Test Edge Cases

- High contrast mode
- Reduced motion preferences
- Large font sizes
- Voice control navigation

### Debugging Test Failures

#### 1. Enable Debug Mode

```bash
# Frontend debug
npm run test -- --reporter=verbose --no-coverage

# E2E debug
npm run e2e:debug

# Backend debug
pytest tests/ -vv -s --pdb
```

#### 2. Use Test Utilities

```typescript
// Debug component state
screen.debug(); // Print DOM tree

// Debug test data
console.log(JSON.stringify(mockData, null, 2));

// Pause test execution
await page.pause(); // Playwright
```

#### 3. Check Test Artifacts

- Screenshots (E2E failures)
- Coverage reports
- Performance profiles
- Accessibility audit results

### Continuous Improvement

#### 1. Regular Review

- Weekly test result analysis
- Monthly performance trend review
- Quarterly accessibility audit
- Annual testing strategy review

#### 2. Metrics Monitoring

- Track test execution time
- Monitor flaky test patterns
- Analyze coverage trends
- Review performance baselines

#### 3. Team Training

- Regular testing workshops
- Accessibility awareness sessions
- Performance optimization training
- Tool updates and new practices

## Troubleshooting

### Common Issues

#### 1. Flaky Tests

```typescript
// Add proper waits
await waitFor(() => {
  expect(element).toBeVisible();
});

// Use deterministic data
const mockData = createDeterministicMockData();
```

#### 2. Performance Test Inconsistency

```typescript
// Warm up before measurement
await warmupOperation();
const metrics = await measurePerformance(operation);
```

#### 3. Accessibility False Positives

```typescript
// Use specific axe rules
const results = await axe(container, {
  rules: {
    'color-contrast': { enabled: false }, // If custom theme
  },
});
```

### Getting Help

- **Documentation**: This guide and tool-specific docs
- **Team Resources**: Internal testing guidelines
- **Community**: Stack Overflow, GitHub issues
- **Professional**: Accessibility consultants, performance experts

## Conclusion

This comprehensive testing framework ensures the SongNodes application meets the highest standards for functionality, performance, accessibility, and user experience. By following these guidelines and maintaining the test suite, we can deliver a robust, inclusive, and performant graph visualization platform.

Regular review and updates of this testing strategy ensure it remains effective as the application evolves and new requirements emerge.