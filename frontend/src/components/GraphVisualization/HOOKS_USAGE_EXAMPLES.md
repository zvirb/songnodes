# Custom Hooks - Usage Examples

This document provides practical examples of using the Phase 3 custom hooks.

---

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Advanced Integration](#advanced-integration)
3. [Real-World Scenarios](#real-world-scenarios)
4. [Common Patterns](#common-patterns)
5. [Troubleshooting](#troubleshooting)

---

## Basic Usage

### 1. useGraphData - Fetching Graph Data

```typescript
import { useGraphData } from './hooks';

function SimpleGraph() {
  const { data, nodes, edges, isLoading, error, refetch, stats } = useGraphData({
    endpoint: '/api/graph-data',
    autoFetch: true,
  });

  if (isLoading) {
    return <div>Loading graph data...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error.message}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Graph Data Loaded</h2>
      <p>Nodes: {stats.filteredNodes} (rejected: {stats.rejectedNodes})</p>
      <p>Edges: {stats.filteredEdges}</p>
    </div>
  );
}
```

### 2. useViewport - Basic Camera Controls

```typescript
import { useViewport } from './hooks';
import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

function GraphWithViewport() {
  const [app, setApp] = useState<PIXI.Application | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize PIXI app
  useEffect(() => {
    if (!canvasRef.current) return;

    const pixiApp = new PIXI.Application({
      view: canvasRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x1a1a1a,
    });

    setApp(pixiApp);

    return () => {
      pixiApp.destroy(true);
    };
  }, []);

  // Setup viewport
  const { viewport, controls, currentZoom } = useViewport(app, {
    worldWidth: 4000,
    worldHeight: 4000,
    minZoom: 0.1,
    maxZoom: 5,
  });

  return (
    <div>
      <canvas ref={canvasRef} />
      <div className="controls">
        <button onClick={controls.fitToScreen}>Fit to Screen</button>
        <button onClick={controls.resetView}>Reset</button>
        <button onClick={() => controls.zoomIn()}>Zoom In</button>
        <button onClick={() => controls.zoomOut()}>Zoom Out</button>
        <span>Zoom: {currentZoom.toFixed(2)}x</span>
      </div>
    </div>
  );
}
```

### 3. useNodeSelection - Simple Selection

```typescript
import { useNodeSelection } from './hooks';

function SelectableGraph({ nodes }) {
  const {
    selectedIds,
    selectNode,
    clearSelection,
    isSelected,
  } = useNodeSelection({
    nodes,
    enableKeyboard: true,
    onSelectionChange: (selectedIds) => {
      console.log(`Selected ${selectedIds.size} nodes`);
    },
  });

  return (
    <div>
      <div className="toolbar">
        <button onClick={clearSelection}>Clear Selection</button>
        <span>Selected: {selectedIds.size}</span>
      </div>
      <div className="nodes">
        {nodes.map(node => (
          <div
            key={node.id}
            className={isSelected(node.id) ? 'node selected' : 'node'}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                selectNode(node.id, 'toggle');
              } else if (e.shiftKey) {
                selectNode(node.id, 'range');
              } else {
                selectNode(node.id, 'single');
              }
            }}
          >
            {node.track.title}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4. useGraphSimulation - Basic Physics

```typescript
import { useGraphSimulation } from './hooks';

function PhysicsGraph({ nodes, edges }) {
  const { positions, controls, state } = useGraphSimulation({
    nodes,
    edges,
    config: {
      charge: -300,
      linkDistance: 100,
    },
    autoStart: true,
    adaptive: true,
  });

  return (
    <div>
      <div className="sim-controls">
        <button onClick={controls.pause} disabled={state.isPaused}>
          Pause
        </button>
        <button onClick={controls.resume} disabled={!state.isPaused}>
          Resume
        </button>
        <button onClick={controls.restart}>Restart</button>
        <span>Alpha: {state.alpha.toFixed(3)}</span>
        <span>Iterations: {state.iterations}</span>
      </div>
      <svg width={800} height={600}>
        {Array.from(positions.entries()).map(([nodeId, pos]) => (
          <circle
            key={nodeId}
            cx={pos.x}
            cy={pos.y}
            r={5}
            fill="blue"
          />
        ))}
      </svg>
    </div>
  );
}
```

---

## Advanced Integration

### Complete GraphVisualization Component

```typescript
import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import {
  useGraphData,
  useViewport,
  useNodeSelection,
  useGraphSimulation,
} from './hooks';
import { NodeRenderer } from './rendering/NodeRenderer';
import { EdgeRenderer } from './rendering/EdgeRenderer';
import { TextureAtlas } from './rendering/TextureAtlas';
import { LODManager } from './rendering/LODManager';
import { FrustumCuller } from './spatial/FrustumCuller';
import { Quadtree } from './spatial/Quadtree';

export function GraphVisualization() {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [app, setApp] = useState<PIXI.Application | null>(null);
  const [renderers, setRenderers] = useState<{
    node: NodeRenderer | null;
    edge: EdgeRenderer | null;
  }>({ node: null, edge: null });

  // 1. Fetch graph data
  const {
    data,
    nodes,
    edges,
    isLoading: dataLoading,
    error: dataError,
    stats,
  } = useGraphData({
    endpoint: '/api/graph-data',
    filters: {
      maxNodes: 10000,
    },
  });

  // 2. Setup viewport
  const {
    viewport,
    controls: viewportControls,
    currentZoom,
    isReady: viewportReady,
  } = useViewport(app, {
    worldWidth: 4000,
    worldHeight: 4000,
    minZoom: 0.1,
    maxZoom: 5,
    nodes,
  });

  // 3. Setup physics simulation
  const {
    positions,
    controls: simControls,
    state: simState,
    isReady: simReady,
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
    adaptiveThreshold: 0.01,
  });

  // 4. Setup selection
  const {
    selectedIds,
    focusedId,
    selectNode,
    clearSelection,
    isSelected,
  } = useNodeSelection({
    nodes,
    maxSelection: 100,
    enableKeyboard: true,
    onSelectionChange: (ids) => {
      console.log(`Selection changed: ${ids.size} nodes`);
    },
  });

  // Initialize PIXI app
  useEffect(() => {
    if (!canvasRef.current) return;

    const pixiApp = new PIXI.Application({
      view: canvasRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: window.devicePixelRatio,
      autoDensity: true,
    });

    setApp(pixiApp);

    return () => {
      pixiApp.destroy(true);
    };
  }, []);

  // Initialize renderers
  useEffect(() => {
    if (!app || !viewport) return;

    const textureAtlas = new TextureAtlas(app.renderer);
    const lodManager = new LODManager({ nodeCountAdjustment: true });
    const quadtree = new Quadtree({ x: 0, y: 0, width: 4000, height: 4000 });
    const frustumCuller = new FrustumCuller(quadtree);

    const nodeRenderer = new NodeRenderer(
      app,
      textureAtlas,
      lodManager,
      frustumCuller,
      {
        baseNodeSize: 16,
        enableGlow: true,
        enableLabels: true,
      }
    );

    const edgeRenderer = new EdgeRenderer(
      app,
      lodManager,
      frustumCuller,
      {
        baseEdgeWidth: 2,
        enableAnimations: true,
      }
    );

    setRenderers({ node: nodeRenderer, edge: edgeRenderer });

    return () => {
      nodeRenderer.cleanup();
      edgeRenderer.cleanup();
      textureAtlas.cleanup();
    };
  }, [app, viewport]);

  // Render loop
  useEffect(() => {
    if (!app || !viewport || !renderers.node || !renderers.edge) return;

    let rafId: number;

    const render = () => {
      // Update node positions from simulation
      for (const [nodeId, pos] of positions.entries()) {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          node.x = pos.x;
          node.y = pos.y;
        }
      }

      // Update selection state
      renderers.node.setSelectedNodes(selectedIds);

      // Get viewport bounds
      const bounds = viewport.getVisibleBounds();
      const viewportState = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        zoom: currentZoom,
        bounds: {
          minX: bounds.x,
          maxX: bounds.x + bounds.width,
          minY: bounds.y,
          maxY: bounds.y + bounds.height,
        },
      };

      // Render
      renderers.edge.render(edges, viewportState);
      renderers.node.render(nodes, viewportState);

      rafId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [app, viewport, renderers, positions, nodes, edges, selectedIds, currentZoom]);

  // Handle node click
  const handleNodeClick = useCallback(
    (event: PointerEvent) => {
      if (!renderers.node) return;

      const node = renderers.node.getNodeAtPosition(event.clientX, event.clientY);

      if (node) {
        if (event.ctrlKey || event.metaKey) {
          selectNode(node.id, 'toggle');
        } else if (event.shiftKey) {
          selectNode(node.id, 'range');
        } else {
          selectNode(node.id, 'single');
        }
      } else {
        clearSelection();
      }
    },
    [renderers.node, selectNode, clearSelection]
  );

  // Attach click handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('pointerdown', handleNodeClick);

    return () => {
      canvas.removeEventListener('pointerdown', handleNodeClick);
    };
  }, [handleNodeClick]);

  // Loading state
  if (dataLoading) {
    return (
      <div className="loading">
        <p>Loading graph data...</p>
      </div>
    );
  }

  // Error state
  if (dataError) {
    return (
      <div className="error">
        <p>Error: {dataError.message}</p>
      </div>
    );
  }

  return (
    <div className="graph-visualization">
      <canvas ref={canvasRef} />

      {/* Controls */}
      <div className="controls">
        {/* Viewport controls */}
        <div className="viewport-controls">
          <button onClick={viewportControls.fitToScreen}>Fit to Screen</button>
          <button onClick={viewportControls.resetView}>Reset View</button>
          <button onClick={() => viewportControls.zoomIn()}>Zoom In</button>
          <button onClick={() => viewportControls.zoomOut()}>Zoom Out</button>
          <span>Zoom: {currentZoom.toFixed(2)}x</span>
        </div>

        {/* Simulation controls */}
        <div className="sim-controls">
          <button onClick={simControls.pause} disabled={simState.isPaused}>
            Pause Physics
          </button>
          <button onClick={simControls.resume} disabled={!simState.isPaused}>
            Resume Physics
          </button>
          <button onClick={simControls.restart}>Restart</button>
          <span>Alpha: {simState.alpha.toFixed(3)}</span>
          <span>Iterations: {simState.iterations}</span>
        </div>

        {/* Selection info */}
        <div className="selection-info">
          <span>Selected: {selectedIds.size}</span>
          <button onClick={clearSelection} disabled={selectedIds.size === 0}>
            Clear Selection
          </button>
        </div>

        {/* Stats */}
        <div className="stats">
          <p>Nodes: {stats.filteredNodes} (rejected: {stats.rejectedNodes})</p>
          <p>Edges: {stats.filteredEdges}</p>
        </div>
      </div>
    </div>
  );
}
```

---

## Real-World Scenarios

### Scenario 1: Filtering by Artist

```typescript
function ArtistGraph() {
  const [artistFilter, setArtistFilter] = useState('');

  const { data, nodes, edges, isLoading, stats } = useGraphData({
    endpoint: '/api/graph-data',
    filters: {
      artistName: artistFilter,
      maxNodes: 1000,
    },
  });

  return (
    <div>
      <input
        type="text"
        placeholder="Filter by artist..."
        value={artistFilter}
        onChange={(e) => setArtistFilter(e.target.value)}
      />
      <p>
        Showing {stats.filteredNodes} nodes
        {stats.rejectedNodes > 0 && ` (${stats.rejectedNodes} rejected)`}
      </p>
      <GraphVisualization data={data} />
    </div>
  );
}
```

### Scenario 2: Node Dragging with Pinning

```typescript
function DraggableGraph({ nodes, edges }) {
  const { positions, controls: simControls } = useGraphSimulation({
    nodes,
    edges,
    autoStart: true,
  });

  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  const handlePointerDown = (nodeId: string) => {
    setDraggedNode(nodeId);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (draggedNode && viewport) {
      const worldPos = viewport.toWorld(event.clientX, event.clientY);
      simControls.pinNode(draggedNode, worldPos.x, worldPos.y);
    }
  };

  const handlePointerUp = () => {
    if (draggedNode) {
      simControls.unpinNode(draggedNode);
      setDraggedNode(null);
    }
  };

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Render graph with positions */}
    </div>
  );
}
```

### Scenario 3: Keyboard Navigation with Focus

```typescript
function KeyboardNavigableGraph({ nodes }) {
  const {
    selectedIds,
    focusedId,
    selectNode,
    focusDirection,
  } = useNodeSelection({
    nodes,
    enableKeyboard: true,
    onFocusChange: (focusedId) => {
      // Zoom to focused node
      if (focusedId) {
        viewportControls.zoomToNode(focusedId, 500);
      }
    },
  });

  return (
    <div>
      <p>Use arrow keys to navigate, Enter to select, Escape to clear</p>
      <Graph
        nodes={nodes}
        selectedIds={selectedIds}
        focusedId={focusedId}
      />
    </div>
  );
}
```

### Scenario 4: Dynamic Configuration

```typescript
function ConfigurableGraph({ nodes, edges }) {
  const [charge, setCharge] = useState(-300);
  const [linkDistance, setLinkDistance] = useState(100);

  const { controls: simControls, state } = useGraphSimulation({
    nodes,
    edges,
    config: {
      charge,
      linkDistance,
    },
  });

  // Update config when sliders change
  useEffect(() => {
    simControls.configure({ charge, linkDistance });
  }, [charge, linkDistance, simControls]);

  return (
    <div>
      <div className="config-controls">
        <label>
          Charge: {charge}
          <input
            type="range"
            min={-1000}
            max={-100}
            value={charge}
            onChange={(e) => setCharge(Number(e.target.value))}
          />
        </label>
        <label>
          Link Distance: {linkDistance}
          <input
            type="range"
            min={50}
            max={300}
            value={linkDistance}
            onChange={(e) => setLinkDistance(Number(e.target.value))}
          />
        </label>
        <button onClick={() => simControls.reheat(0.5)}>
          Apply & Reheat
        </button>
      </div>
      <Graph nodes={nodes} edges={edges} />
    </div>
  );
}
```

---

## Common Patterns

### Pattern 1: Loading State with Skeleton

```typescript
function GraphWithSkeleton() {
  const { data, isLoading, error } = useGraphData({
    endpoint: '/api/graph-data',
  });

  if (isLoading) {
    return <GraphSkeleton />;
  }

  if (error) {
    return <ErrorBoundary error={error} />;
  }

  return <GraphVisualization data={data} />;
}
```

### Pattern 2: Retry on Error

```typescript
function GraphWithRetry() {
  const { data, error, refetch } = useGraphData({
    endpoint: '/api/graph-data',
    retryAttempts: 3,
    retryDelay: 1000,
  });

  if (error) {
    return (
      <div>
        <p>Failed to load graph data</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  return <GraphVisualization data={data} />;
}
```

### Pattern 3: Bookmarked Views

```typescript
function GraphWithBookmarks() {
  const { controls: viewportControls } = useViewport(app, {
    worldWidth: 4000,
    worldHeight: 4000,
  });

  const [bookmarks, setBookmarks] = useState<CameraBookmark[]>([]);

  const saveView = () => {
    const name = prompt('Bookmark name:');
    if (name) {
      viewportControls.saveBookmark(name);
      setBookmarks(viewportControls.getBookmarks());
    }
  };

  const loadView = (name: string) => {
    viewportControls.loadBookmark(name);
  };

  return (
    <div>
      <button onClick={saveView}>Save Bookmark</button>
      <ul>
        {bookmarks.map(bookmark => (
          <li key={bookmark.id} onClick={() => loadView(bookmark.name)}>
            {bookmark.name}
          </li>
        ))}
      </ul>
      <Graph />
    </div>
  );
}
```

---

## Troubleshooting

### Issue: Worker fails to initialize

```typescript
const { error, isReady } = useGraphSimulation({ nodes, edges });

if (error) {
  console.error('Worker error:', error);
  // Fallback to non-worker simulation
}

if (!isReady) {
  return <div>Initializing physics...</div>;
}
```

### Issue: Viewport not responding

```typescript
const { viewport, isReady } = useViewport(app, options);

useEffect(() => {
  if (isReady && viewport) {
    console.log('Viewport ready:', viewport);
  }
}, [isReady, viewport]);
```

### Issue: Selection not updating

```typescript
const { selectedIds, selectNode } = useNodeSelection({
  nodes,
  onSelectionChange: (ids) => {
    console.log('Selection changed:', Array.from(ids));
  },
});

// Ensure you're calling selectNode with correct mode
const handleClick = (nodeId: string, event: MouseEvent) => {
  const mode = event.ctrlKey ? 'toggle' : 'single';
  selectNode(nodeId, mode);
};
```

### Issue: Data not loading

```typescript
const { data, error, isLoading, refetch, stats } = useGraphData({
  endpoint: '/api/graph-data',
  autoFetch: true,
});

useEffect(() => {
  console.log('Loading:', isLoading);
  console.log('Error:', error);
  console.log('Stats:', stats);
}, [isLoading, error, stats]);
```

---

## Summary

These examples demonstrate:

1. **Basic usage** of each hook individually
2. **Advanced integration** of all hooks together
3. **Real-world scenarios** for common use cases
4. **Common patterns** for error handling, loading states, etc.
5. **Troubleshooting** tips for common issues

All hooks are designed to work together seamlessly while maintaining independent, testable functionality.
