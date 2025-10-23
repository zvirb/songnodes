# GraphVisualization Phase 1+2 Integration Example

This document demonstrates how to use the completed Phase 1 (infrastructure) and Phase 2 (rendering) components together.

## Quick Start Example

```typescript
import * as PIXI from 'pixi.js';
import { TextureAtlas } from './rendering/TextureAtlas';
import { LODManager } from './rendering/LODManager';
import { FrustumCuller } from './spatial/FrustumCuller';
import { NodeRenderer } from './rendering/NodeRenderer';
import { EdgeRenderer } from './rendering/EdgeRenderer';
import type { EnhancedGraphNode, EnhancedGraphEdge, Viewport } from './types';

/**
 * Initialize the complete rendering system
 */
async function initializeGraphVisualization(
  canvasElement: HTMLCanvasElement,
  nodes: EnhancedGraphNode[],
  edges: EnhancedGraphEdge[]
) {
  // 1. Create PIXI Application
  const app = new PIXI.Application({
    view: canvasElement,
    width: window.innerWidth,
    height: window.innerHeight,
    antialias: true,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    backgroundColor: 0x1a1a1a,
  });

  // 2. Initialize Phase 1 components
  const textureAtlas = new TextureAtlas();
  textureAtlas.preGenerateTextures(); // 48 textures cached
  console.log(`✅ TextureAtlas: ${textureAtlas.getTextureCount()} textures pre-generated`);

  const viewport: Viewport = {
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    zoom: 1.0,
    bounds: { minX: -5000, maxX: 5000, minY: -5000, maxY: 5000 },
  };

  const lodManager = new LODManager(viewport);
  lodManager.updateCounts(nodes.length, edges.length);
  console.log(`✅ LODManager: Global LOD ${lodManager.getGlobalLOD()}`);

  const frustumCuller = new FrustumCuller(viewport);
  frustumCuller.updateSpatialIndex(nodes);
  console.log(`✅ FrustumCuller: Spatial index built`);

  // 3. Initialize Phase 2 renderers
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
      baseEdgeWidth: 1.5,
      enableWeightedWidth: true,
      enableColorByType: true,
    }
  );

  // 4. Initialize nodes
  nodeRenderer.initialize(nodes);
  console.log(`✅ NodeRenderer: ${nodes.length} nodes initialized`);

  // 5. Create nodes map for edge rendering
  const nodesMap = new Map<string, EnhancedGraphNode>();
  nodes.forEach(node => nodesMap.set(node.id, node));

  // 6. Main render loop
  app.ticker.add(() => {
    // Update viewport from camera (would come from pixi-viewport in Phase 3)
    lodManager.updateViewport(viewport);
    frustumCuller.updateViewport(viewport);

    // Render edges first (behind nodes)
    edgeRenderer.render(edges, nodesMap, viewport);

    // Render nodes on top
    nodeRenderer.render(nodes, viewport);
  });

  // 7. Performance monitoring
  setInterval(() => {
    const nodeStats = nodeRenderer.getStats();
    const edgeStats = edgeRenderer.getStats(edges);

    console.log('[Performance]', {
      fps: app.ticker.FPS.toFixed(1),
      nodes: `${nodeStats.visibleNodes}/${nodeStats.totalNodes}`,
      edges: `${edgeStats.visibleEdges}/${edgeStats.totalEdges}`,
      memory: `${nodeStats.memoryUsageMB.toFixed(1)}MB`,
      drawCalls: edgeStats.drawCalls,
    });
  }, 5000);

  // 8. Interaction example (would be in Phase 3 InteractionManager)
  let hoveredNodeId: string | null = null;

  app.stage.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
    const { x, y } = event.global;
    const node = nodeRenderer.getNodeAtPosition(x, y);

    if (node && node.id !== hoveredNodeId) {
      hoveredNodeId = node.id;
      nodeRenderer.setHoveredNode(node.id);
      console.log('Hovered:', node.track?.artist_name);
    } else if (!node && hoveredNodeId) {
      hoveredNodeId = null;
      nodeRenderer.setHoveredNode(null);
    }
  });

  // 9. Cleanup
  return () => {
    app.ticker.stop();
    nodeRenderer.cleanup();
    edgeRenderer.cleanup();
    textureAtlas.destroy();
    app.destroy(true);
  };
}

/**
 * Example usage in a React component
 */
export function GraphVisualizationExample() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (!canvasRef.current) return;

    // Fetch graph data (would be in useGraphData hook in Phase 3)
    fetchGraphData().then(({ nodes, edges }) => {
      const cleanup = initializeGraphVisualization(
        canvasRef.current!,
        nodes,
        edges
      );

      return cleanup;
    });
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

async function fetchGraphData() {
  // Mock data - would be real API call
  return {
    nodes: [],
    edges: [],
  };
}
```

## Performance Benchmarks

### With 10,000 Nodes + 50,000 Edges

```typescript
// Expected output every 5 seconds:
{
  fps: "60.0",
  nodes: "3500/10000",      // 35% visible (65% culled)
  edges: "12500/50000",     // 25% visible (75% culled)
  memory: "120.5MB",        // Well under 150MB target
  drawCalls: 1              // Single batched call
}
```

### LOD Distribution (Typical Viewport)

```typescript
const nodeStats = nodeRenderer.getStats();
console.log('LOD Distribution:', {
  lod0: nodeStats.lod0Nodes,  // 500 (full detail)
  lod1: nodeStats.lod1Nodes,  // 1200 (medium detail)
  lod2: nodeStats.lod2Nodes,  // 1800 (low detail)
  culled: nodeStats.culledNodes, // 6500 (outside viewport)
});
```

## Advanced Usage

### Custom Node States

```typescript
// Set interaction state
nodeRenderer.setHoveredNode('node-123');
nodeRenderer.setSelectedNodes(new Set(['node-1', 'node-2', 'node-3']));
nodeRenderer.setPlayingNode('node-5');
nodeRenderer.setPathNodes(new Set(['node-10', 'node-11', 'node-12']));

// Nodes automatically re-render with correct textures and colors
```

### Custom Edge Styles

```typescript
// Select specific edges
edgeRenderer.setSelectedEdges(new Set(['node-1->node-2']));
edgeRenderer.setPathEdges(new Set(['node-5->node-6', 'node-6->node-7']));

// Edges will render with appropriate colors:
// - Selected: Orange (#ff6b35)
// - Path: Purple (#9013fe)
// - Harmonic: Green (#7ed321)
// - Energy: Red (#ff1744)
// - Tempo: Blue (#4a90e2)
```

### Dynamic Viewport Updates

```typescript
// Update viewport (e.g., from camera pan/zoom)
viewport.x = -200;
viewport.y = -150;
viewport.zoom = 1.5;

lodManager.updateViewport(viewport);
frustumCuller.updateViewport(viewport);

// Next render will use updated viewport automatically
```

### Memory Management

```typescript
// Monitor memory usage
const nodeStats = nodeRenderer.getStats();
console.log('Memory:', nodeStats.memoryUsageMB, 'MB');

// Clear edge cache if needed
edgeRenderer.clearCache();

// Texture atlas memory
console.log('Texture Memory:', textureAtlas.getMemoryUsage(), 'MB');
```

## Integration Checklist

### Phase 1 Components ✅
- [x] `types.ts` - Type definitions
- [x] `Quadtree.ts` - Spatial indexing
- [x] `FrustumCuller.ts` - Viewport culling
- [x] `LODManager.ts` - Level of detail
- [x] `TextureAtlas.ts` - Texture caching
- [x] `simulation.worker.ts` - Physics simulation

### Phase 2 Components ✅
- [x] `NodeRenderer.ts` - Node rendering
- [x] `EdgeRenderer.ts` - Edge rendering
- [x] `nodeStateHelpers.ts` - Node state utilities
- [x] `edgeColorHelpers.ts` - Edge color utilities

### Phase 3 Components (Next)
- [ ] `useGraphData.ts` - Data fetching hook
- [ ] `useViewport.ts` - Viewport management hook
- [ ] `useNodeSelection.ts` - Selection hook
- [ ] `useGraphSimulation.ts` - Physics worker hook

## Testing Recommendations

### Unit Tests

```typescript
import { NodeRenderer } from './rendering/NodeRenderer';
import { TextureAtlas } from './rendering/TextureAtlas';

describe('NodeRenderer', () => {
  it('should initialize nodes correctly', () => {
    const app = new PIXI.Application();
    const textureAtlas = new TextureAtlas();
    const lodManager = new LODManager(viewport);
    const frustumCuller = new FrustumCuller(viewport);

    const nodeRenderer = new NodeRenderer(
      app,
      textureAtlas,
      lodManager,
      frustumCuller
    );

    nodeRenderer.initialize(mockNodes);

    const stats = nodeRenderer.getStats();
    expect(stats.totalNodes).toBe(mockNodes.length);
  });
});
```

### Performance Tests

```typescript
describe('NodeRenderer Performance', () => {
  it('should render 10,000 nodes at 60 FPS', async () => {
    const nodes = generateMockNodes(10000);
    const startTime = performance.now();

    // Render 60 frames
    for (let i = 0; i < 60; i++) {
      nodeRenderer.render(nodes, viewport);
    }

    const elapsed = performance.now() - startTime;
    const avgFrameTime = elapsed / 60;

    expect(avgFrameTime).toBeLessThan(16.67); // 60 FPS = 16.67ms per frame
  });
});
```

### Memory Leak Tests

```typescript
describe('Memory Cleanup', () => {
  it('should not leak memory after cleanup', () => {
    const initialMemory = performance.memory?.usedJSHeapSize || 0;

    // Create and destroy renderer 10 times
    for (let i = 0; i < 10; i++) {
      const renderer = new NodeRenderer(...);
      renderer.initialize(nodes);
      renderer.cleanup();
    }

    const finalMemory = performance.memory?.usedJSHeapSize || 0;
    const leak = finalMemory - initialMemory;

    expect(leak).toBeLessThan(10 * 1024 * 1024); // < 10MB leak
  });
});
```

## Troubleshooting

### Issue: Low FPS

**Symptoms:** FPS < 30 with moderate node count

**Solutions:**
1. Check LOD distribution - ensure nodes are being culled
2. Verify frustum culler is active
3. Check for excessive label rendering (should only be LOD 0-1)
4. Monitor draw calls (should be 1 per frame)

```typescript
const stats = nodeRenderer.getStats();
console.log('Culled:', stats.culledNodes, '/', stats.totalNodes);
// Should be 60-75% culled
```

### Issue: High Memory Usage

**Symptoms:** Memory > 200MB with 10,000 nodes

**Solutions:**
1. Check texture atlas size
2. Verify cleanup is called on unmount
3. Look for sprite pooling issues

```typescript
console.log('Texture Memory:', textureAtlas.getMemoryUsage(), 'MB');
// Should be ~2-5MB

console.log('Node Memory:', nodeStats.memoryUsageMB, 'MB');
// Should be ~120MB for 10K nodes
```

### Issue: Nodes Not Rendering

**Symptoms:** Blank screen or missing nodes

**Solutions:**
1. Check node positions are defined (x, y not undefined)
2. Verify viewport is initialized correctly
3. Check frustum culler spatial index is built

```typescript
frustumCuller.updateSpatialIndex(nodes);
const visibleNodes = frustumCuller.queryVisibleNodes();
console.log('Visible:', visibleNodes.length);
```

## Next Steps

After completing Phase 3 (Hooks), this integration will be fully automated:

```typescript
// Future API (Phase 5)
<GraphVisualization
  data={graphData}
  onNodeClick={handleNodeClick}
  onSelectionChange={handleSelectionChange}
  selectedNodes={selectedNodes}
  nowPlayingNodeId={nowPlayingId}
/>
```

The hooks will handle:
- Data fetching and normalization (`useGraphData`)
- Viewport state management (`useViewport`)
- Selection handling (`useNodeSelection`)
- Physics simulation (`useGraphSimulation`)

See `PHASE3_PLAN.md` for details on the next implementation phase.
