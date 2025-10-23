# GraphVisualization - Complete Usage Guide

A production-ready, high-performance force-directed graph visualization component built with PIXI.js, React, and D3-force.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Advanced Usage](#advanced-usage)
5. [Props API](#props-api)
6. [Imperative Handle API](#imperative-handle-api)
7. [Custom Hooks](#custom-hooks)
8. [Styling](#styling)
9. [Performance Tuning](#performance-tuning)
10. [Accessibility](#accessibility)
11. [Troubleshooting](#troubleshooting)

---

## Quick Start

```tsx
import React from 'react';
import { GraphVisualization } from '@/components/GraphVisualization';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GraphVisualization
        endpoint="/api/graph-data"
        filters={{ maxNodes: 10000 }}
        onNodeClick={(event) => console.log(event.node)}
      />
    </div>
  );
}
```

That's it! The component handles:
- Data fetching with artist validation
- Physics simulation in Web Worker
- Pan/zoom/camera controls
- Node selection and keyboard navigation
- Responsive UI controls
- Performance optimization (LOD, culling)

---

## Installation

### Dependencies

```bash
npm install react pixi.js pixi-viewport d3-force lucide-react class-variance-authority
```

### Required Versions

```json
{
  "react": "^18.3.1",
  "pixi.js": "^7.4.3",
  "pixi-viewport": "^5.0.2",
  "d3-force": "^3.0.0",
  "lucide-react": "^0.263.1",
  "class-variance-authority": "^0.7.0"
}
```

**IMPORTANT:** Use PIXI.js v7.x, NOT v8.x (pixi-viewport is incompatible with v8).

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable", "WebWorker"]
  }
}
```

---

## Basic Usage

### 1. Fetch Data from API

```tsx
import { GraphVisualization } from '@/components/GraphVisualization';

function MyGraph() {
  return (
    <GraphVisualization
      endpoint="/api/graph-data"
      filters={{
        artistName: 'Deadmau5',
        maxNodes: 5000,
      }}
      width={1920}
      height={1080}
    />
  );
}
```

### 2. Provide Data Directly

```tsx
import { GraphVisualization, type GraphData } from '@/components/GraphVisualization';

function MyGraph() {
  const [data, setData] = useState<GraphData | null>(null);

  useEffect(() => {
    fetch('/api/graph-data')
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data) return <div>Loading...</div>;

  return (
    <GraphVisualization
      data={data}
      width={1920}
      height={1080}
    />
  );
}
```

### 3. Handle Interactions

```tsx
import { GraphVisualization, type NodeClickEvent } from '@/components/GraphVisualization';

function MyGraph() {
  const handleNodeClick = (event: NodeClickEvent) => {
    const { node, modifiers } = event;
    console.log('Clicked:', node.track.artist_name, '-', node.track.title);

    if (modifiers.ctrl) {
      console.log('Ctrl+Click: Add to selection');
    } else if (modifiers.shift) {
      console.log('Shift+Click: Range select');
    } else {
      console.log('Click: Single select');
    }
  };

  const handleNodeHover = (node: EnhancedGraphNode | null) => {
    if (node) {
      console.log('Hovering:', node.track.artist_name);
    } else {
      console.log('Hover ended');
    }
  };

  const handleSelectionChange = (selectedIds: Set<string>) => {
    console.log(`Selected ${selectedIds.size} nodes`);
  };

  return (
    <GraphVisualization
      endpoint="/api/graph-data"
      onNodeClick={handleNodeClick}
      onNodeHover={handleNodeHover}
      onSelectionChange={handleSelectionChange}
    />
  );
}
```

---

## Advanced Usage

### 1. Imperative Control

```tsx
import { useRef } from 'react';
import {
  GraphVisualization,
  type GraphVisualizationHandle,
} from '@/components/GraphVisualization';

function MyGraph() {
  const graphRef = useRef<GraphVisualizationHandle>(null);

  const handleFitToScreen = () => {
    graphRef.current?.fitToScreen();
  };

  const handleResetView = () => {
    graphRef.current?.resetView();
  };

  const handleZoomToNode = () => {
    graphRef.current?.zoomToNode('node-123', 500); // 500ms animation
  };

  const handleExportImage = () => {
    const base64 = graphRef.current?.exportImage();
    if (base64) {
      const link = document.createElement('a');
      link.href = base64;
      link.download = 'graph.png';
      link.click();
    }
  };

  const handleGetStats = () => {
    const stats = graphRef.current?.getStats();
    console.log('FPS:', stats?.fps);
    console.log('Visible nodes:', stats?.visibleNodes);
    console.log('Memory:', stats?.memoryUsage, 'MB');
  };

  return (
    <>
      <GraphVisualization ref={graphRef} endpoint="/api/graph-data" />

      <div style={{ position: 'absolute', bottom: 16, left: 16 }}>
        <button onClick={handleFitToScreen}>Fit</button>
        <button onClick={handleResetView}>Reset</button>
        <button onClick={handleZoomToNode}>Zoom to Node</button>
        <button onClick={handleExportImage}>Export PNG</button>
        <button onClick={handleGetStats}>Get Stats</button>
      </div>
    </>
  );
}
```

### 2. Custom Layout

```tsx
import {
  GraphVisualization,
  GraphControls,
  Minimap,
  NodeDetailsPanel,
  useGraphData,
  useViewport,
  useNodeSelection,
  useGraphSimulation,
} from '@/components/GraphVisualization';

function CustomGraphLayout() {
  // Use individual hooks for full control
  const { nodes, edges, isLoading, error, stats } = useGraphData({
    endpoint: '/api/graph-data',
    autoFetch: true,
  });

  const app = usePIXIApp({ width: 1920, height: 1080 });

  const { viewport, controls: viewportControls } = useViewport(app, {
    worldWidth: 4000,
    worldHeight: 4000,
    nodes,
  });

  const { positions, controls: simControls, state: simState } = useGraphSimulation({
    nodes,
    edges,
    adaptive: true,
  });

  const { selectedIds, getSelectedNodes, clearSelection } = useNodeSelection({
    nodes,
    enableKeyboard: true,
  });

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {/* Custom top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60 }}>
        <h1>My Custom Graph</h1>
        <GraphControls
          viewportControls={viewportControls}
          simControls={simControls}
          simState={simState}
          stats={stats}
        />
      </div>

      {/* Main graph */}
      <div style={{ position: 'absolute', top: 60, bottom: 0, left: 0, right: 0 }}>
        <GraphVisualization
          data={{ nodes, edges }}
          showControls={false}
          showMinimap={false}
          showDetailsPanel={false}
        />
      </div>

      {/* Custom sidebar */}
      <div style={{ position: 'absolute', right: 0, top: 60, bottom: 0, width: 300 }}>
        <NodeDetailsPanel
          nodes={getSelectedNodes()}
          onClose={clearSelection}
        />
        <Minimap
          nodes={nodes}
          viewport={viewport}
          currentZoom={viewportControls.getZoom()}
          onViewportChange={(x, y) => viewportControls.panTo(x, y, 300)}
        />
      </div>
    </div>
  );
}
```

### 3. Filtering and Search

```tsx
import { GraphVisualization } from '@/components/GraphVisualization';

function FilterableGraph() {
  const [filters, setFilters] = useState({
    artistName: '',
    genre: '',
    maxNodes: 10000,
  });

  return (
    <>
      <div style={{ padding: 16 }}>
        <input
          type="text"
          placeholder="Search artist..."
          value={filters.artistName}
          onChange={(e) => setFilters({ ...filters, artistName: e.target.value })}
        />
        <input
          type="text"
          placeholder="Genre..."
          value={filters.genre}
          onChange={(e) => setFilters({ ...filters, genre: e.target.value })}
        />
        <input
          type="number"
          placeholder="Max nodes"
          value={filters.maxNodes}
          onChange={(e) => setFilters({ ...filters, maxNodes: parseInt(e.target.value) })}
        />
      </div>

      <GraphVisualization
        endpoint="/api/graph-data"
        filters={filters}
      />
    </>
  );
}
```

---

## Props API

### GraphVisualizationProps

```typescript
interface GraphVisualizationProps {
  /** API endpoint to fetch graph data */
  endpoint?: string;

  /** Optional pre-loaded graph data (alternative to endpoint) */
  data?: GraphData;

  /** Data filters */
  filters?: {
    artistName?: string;
    genre?: string;
    dateRange?: { start: string; end: string };
    minTransitions?: number;
    maxNodes?: number;
  };

  /** Canvas width (default: 1920) */
  width?: number;

  /** Canvas height (default: 1080) */
  height?: number;

  /** Enable debug mode (default: false) */
  debug?: boolean;

  /** Node click handler */
  onNodeClick?: (event: NodeClickEvent) => void;

  /** Node hover handler */
  onNodeHover?: (node: EnhancedGraphNode | null) => void;

  /** Edge click handler */
  onEdgeClick?: (edgeId: string) => void;

  /** Selection change handler */
  onSelectionChange?: (selectedIds: Set<string>) => void;

  /** Viewport change handler */
  onViewportChange?: (event: ViewportChangeEvent) => void;

  /** Custom CSS class */
  className?: string;

  /** Custom inline styles */
  style?: React.CSSProperties;

  /** Show controls UI (default: true) */
  showControls?: boolean;

  /** Show minimap (default: true) */
  showMinimap?: boolean;

  /** Show node details panel (default: true) */
  showDetailsPanel?: boolean;

  /** Auto-start physics simulation (default: true) */
  autoStartSimulation?: boolean;

  /** Initial zoom level (default: 1.0) */
  initialZoom?: number;
}
```

---

## Imperative Handle API

```typescript
interface GraphVisualizationHandle {
  /** Fit all nodes to screen */
  fitToScreen: () => void;

  /** Reset view to origin */
  resetView: () => void;

  /** Zoom to specific node */
  zoomToNode: (nodeId: string, duration?: number) => void;

  /** Export canvas as base64 PNG */
  exportImage: () => string | undefined;

  /** Get current statistics */
  getStats: () => RenderStats;

  /** Pause physics simulation */
  pauseSimulation: () => void;

  /** Resume physics simulation */
  resumeSimulation: () => void;

  /** Restart physics simulation */
  restartSimulation: () => void;

  /** Get viewport controls */
  getViewportControls: () => ViewportControls | null;

  /** Get simulation controls */
  getSimulationControls: () => SimulationControls | null;

  /** Clear selection */
  clearSelection: () => void;

  /** Select node(s) */
  selectNodes: (nodeIds: string[]) => void;
}
```

**Usage:**

```tsx
const graphRef = useRef<GraphVisualizationHandle>(null);

// Later...
graphRef.current?.fitToScreen();
graphRef.current?.zoomToNode('node-123', 500);
const base64 = graphRef.current?.exportImage();
const stats = graphRef.current?.getStats();
```

---

## Custom Hooks

### useGraphData

Fetches and normalizes graph data from API with MANDATORY artist validation.

```typescript
const {
  data,      // Complete GraphData object
  nodes,     // Array of GraphNode
  edges,     // Array of GraphEdge
  isLoading, // Loading state
  error,     // Error object
  refetch,   // Refetch function
  stats,     // Data statistics
} = useGraphData({
  endpoint: '/api/graph-data',
  autoFetch: true,
  filters: {
    artistName: 'Deadmau5',
    maxNodes: 10000,
  },
  retryAttempts: 3,
  retryDelay: 1000,
});
```

### useViewport

Manages pixi-viewport for pan/zoom/camera controls.

```typescript
const {
  viewport,         // Viewport instance
  controls,         // ViewportControls API
  currentZoom,      // Current zoom level
  currentCenter,    // Current center position
  isReady,          // Initialization state
} = useViewport(app, {
  worldWidth: 4000,
  worldHeight: 4000,
  minZoom: 0.1,
  maxZoom: 5,
  nodes,
});

// Use controls
controls.fitToScreen();
controls.resetView();
controls.zoomToNode('node-123', 500);
controls.saveBookmark('Overview');
```

### useNodeSelection

Multi-select with keyboard navigation.

```typescript
const {
  selectedIds,      // Set<string> of selected node IDs
  focusedId,        // Currently focused node ID
  selectNode,       // Select a node (single, toggle, range)
  selectAll,        // Select all nodes
  clearSelection,   // Clear all selections
  isSelected,       // Check if node is selected
  isFocused,        // Check if node is focused
  getSelectedNodes, // Get array of selected nodes
} = useNodeSelection({
  nodes,
  maxSelection: 100,
  enableKeyboard: true,
  onSelectionChange: (selectedIds) => {
    console.log(`Selected ${selectedIds.size} nodes`);
  },
});

// Use selection
selectNode('node-123', 'single');
selectNode('node-456', 'toggle');  // Ctrl+Click
selectNode('node-789', 'range');   // Shift+Click
```

### useGraphSimulation

D3-force physics simulation in Web Worker.

```typescript
const {
  positions,  // Map<string, { x, y, vx, vy }>
  controls,   // SimulationControls API
  state,      // SimulationState
  isReady,    // Worker ready state
  error,      // Worker error
} = useGraphSimulation({
  nodes,
  edges,
  config: {
    charge: -300,
    linkDistance: 100,
    linkStrength: 0.5,
    centerStrength: 0.1,
  },
  autoStart: true,
  adaptive: true,
});

// Use controls
controls.pause();
controls.resume();
controls.restart();
controls.reheat(0.5);
controls.configure({ charge: -500 });
```

---

## Styling

### CSS Custom Properties

```css
/* In your global CSS */
:root {
  /* Colors */
  --color-bg-base: #121212;
  --color-bg-elevated-1: rgba(26, 26, 26, 0.95);
  --color-bg-elevated-2: rgba(55, 65, 81, 0.3);
  --color-bg-elevated-3: #374151;
  --color-border: rgba(255, 255, 255, 0.1);
  --color-text-primary: #F9FAFB;
  --color-text-secondary: #9CA3AF;
  --color-text-tertiary: #6B7280;
  --color-brand-primary: #3B82F6;
  --color-brand-primary-hover: #2563EB;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Shadows */
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
```

### Custom Styling

```tsx
<GraphVisualization
  className="my-custom-graph"
  style={{ border: '2px solid blue' }}
/>
```

```css
/* Custom styles */
.my-custom-graph {
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}
```

---

## Performance Tuning

### 1. Optimize Node Count

```tsx
<GraphVisualization
  filters={{ maxNodes: 5000 }} // Reduce for better performance
/>
```

### 2. Disable Features

```tsx
<GraphVisualization
  showMinimap={false}        // Disable minimap
  showDetailsPanel={false}   // Disable details panel
  autoStartSimulation={false} // Don't auto-start physics
/>
```

### 3. Configure Simulation

```tsx
import { useGraphSimulation } from '@/components/GraphVisualization';

const { controls } = useGraphSimulation({
  nodes,
  edges,
  config: {
    charge: -200,          // Lower = faster
    linkDistance: 50,      // Shorter = faster
    alphaDecay: 0.05,      // Higher = faster convergence
    velocityDecay: 0.6,    // Higher = faster damping
  },
  adaptive: true,          // Auto-pause when settled
  adaptiveThreshold: 0.01, // Lower = earlier pause
});
```

### 4. Monitor Performance

```tsx
const graphRef = useRef<GraphVisualizationHandle>(null);

useEffect(() => {
  const interval = setInterval(() => {
    const stats = graphRef.current?.getStats();
    console.log('FPS:', stats?.fps);
    console.log('Memory:', stats?.memoryUsage, 'MB');

    if (stats?.fps < 30) {
      console.warn('Low FPS detected!');
    }
  }, 1000);

  return () => clearInterval(interval);
}, []);
```

---

## Accessibility

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `+` / `=` | Zoom in |
| `-` / `_` | Zoom out |
| `F` | Fit to screen |
| `R` | Reset view |
| `Space` | Toggle simulation |
| `I` | Toggle statistics |
| `Escape` | Clear selection / Close panel |
| `Ctrl+A` | Select all |
| `Ctrl+Click` | Toggle selection |
| `Shift+Click` | Range select |
| Arrow keys | Navigate spatially |
| `Tab` / `Shift+Tab` | Focus next/previous node |
| `Enter` | Select focused node |

### Screen Reader Support

All interactive elements have ARIA labels:

```html
<div role="application" aria-label="Graph Visualization">
  <canvas role="img" aria-label="Graph with 5000 nodes and 12000 edges" />
  <div role="toolbar" aria-label="Graph controls">...</div>
  <div role="navigation" aria-label="Graph overview minimap">...</div>
  <div role="complementary" aria-label="Selected nodes details">...</div>
</div>
```

### Focus Management

- Tab order: Controls → Minimap → Details Panel → Canvas
- Focus indicators visible for keyboard navigation
- Trapped focus in modals/panels

---

## Troubleshooting

### Issue: Graph not rendering

**Solution:**
1. Check console for errors
2. Verify PIXI.js version (must be v7.x, NOT v8.x)
3. Ensure parent container has explicit width/height
4. Check data format matches GraphData interface

```tsx
// ❌ Wrong
<div>
  <GraphVisualization endpoint="/api/graph-data" />
</div>

// ✅ Correct
<div style={{ width: '100vw', height: '100vh' }}>
  <GraphVisualization endpoint="/api/graph-data" />
</div>
```

### Issue: Low FPS with large graphs

**Solution:**
1. Reduce node count with `filters.maxNodes`
2. Disable minimap/details panel
3. Lower simulation quality
4. Enable adaptive simulation

```tsx
<GraphVisualization
  filters={{ maxNodes: 5000 }}
  showMinimap={false}
  showDetailsPanel={false}
/>
```

### Issue: "Invalid artist attribution" warnings

**Solution:**
This is EXPECTED behavior per CLAUDE.md requirements. Tracks without valid artist names are filtered out.

```tsx
const { stats } = useGraphData({ endpoint: '/api/graph-data' });

console.log('Rejected nodes:', stats.rejectedNodes);
// These nodes had NULL, empty, or "Unknown Artist" attribution
```

### Issue: Memory leak

**Solution:**
Ensure component is properly unmounted. The component handles cleanup automatically, but if using custom hooks, ensure proper cleanup:

```tsx
useEffect(() => {
  // Your code

  return () => {
    // Cleanup
  };
}, []);
```

### Issue: TypeScript errors

**Solution:**
1. Enable strict mode in tsconfig.json
2. Import types from index:

```typescript
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphVisualizationHandle,
} from '@/components/GraphVisualization';
```

---

## API Reference

See full API documentation:
- [Types](./types.ts) - All TypeScript interfaces
- [Hooks](./hooks/index.ts) - Custom hooks API
- [Utils](./utils.ts) - Helper functions

---

## Support

For issues, feature requests, or questions:
1. Check this guide
2. Review PHASE4-5_COMPLETE.md
3. Check types.ts for API reference
4. Open an issue on GitHub

---

**Last Updated:** 2025-10-23
**Version:** 1.0.0
**Status:** Production Ready ✅
