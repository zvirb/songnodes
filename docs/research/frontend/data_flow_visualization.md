# Graph Visualization Data Flow - Visual Diagrams

## Complete Data Pipeline (API → Canvas)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 1: DATA SOURCE (API)                            │
└─────────────────────────────────────────────────────────────────────────────┘

   PostgreSQL Database
         │
         │ SQL Query (JOIN tracks + artists + song_adjacency)
         │ Filter: Valid artists only (NOT NULL, NOT 'Unknown')
         ↓
   FastAPI Handler
   /api/graph/data
         │
         │ Returns JSON:
         │ {
         │   nodes: [{ id, track_id, artist, title, position, metadata }],
         │   edges: [{ id, source, target, weight, type }],
         │   metadata: { total_nodes, total_edges, generated_at }
         │ }
         ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 2: FRONTEND FETCH (useDataLoader)                  │
└─────────────────────────────────────────────────────────────────────────────┘

   fetch('/api/graph/data')
         │
         │ ✅ Status: 200 OK
         │ ✅ Content-Type: application/json
         ↓
   Parse JSON
         │
         ├─→ FILTER 1: Artist Validation
         │   hasValidArtist(node)
         │   Rejects: null, '', 'Unknown', 'Various Artists', etc.
         │
         ├─→ TRANSFORM: Position Initialization
         │   Hash-based stable random positions
         │   Range: [-800, 800] x [-600, 600]
         │   Prevents LOD flickering (deterministic)
         │
         ├─→ FILTER 2: Edge Validation
         │   Both source and target must exist in node set
         │
         └─→ FILTER 3: Connectivity
             Remove isolated nodes (no edges)
         │
         ↓
   Filtered Data
   { nodes: GraphNode[], edges: GraphEdge[] }
         │
         ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                      STAGE 3: STATE MANAGEMENT (Zustand)                     │
└─────────────────────────────────────────────────────────────────────────────┘

   setGraphData({ nodes, edges })
         │
         ├─→ state.graphData ← New data
         │
         ├─→ state.originalGraphData ← Backup (for filters)
         │
         └─→ state.performanceMetrics ← Update counts
             { nodeCount, edgeCount, lastUpdate }
         │
         │ Store persists to localStorage (position data)
         ↓
   Store Updated
         │
         │ Notify subscribers
         ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                  STAGE 4: COMPONENT SUBSCRIPTION (React)                     │
└─────────────────────────────────────────────────────────────────────────────┘

   GraphVisualization Component
         │
         │ Zustand Selectors (line 534-542):
         │ - const graphData = useStore(state => state.graphData)
         │ - const viewState = useStore(state => state.viewState)
         │ - const performanceMetrics = useStore(state => state.performanceMetrics)
         ↓
   ✅ Component Re-renders
         │
         │ useEffect triggered by graphData change
         ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                   STAGE 5: RENDERING GATE (isInitialized)                   │
└─────────────────────────────────────────────────────────────────────────────┘

   Check: isInitialized && graphData.nodes.length > 0
         │
         ├─→ FALSE: Log "Waiting for initialization"
         │          Don't render
         │          🔴 POTENTIAL BOTTLENECK
         │
         └─→ TRUE: Proceed to rendering
                   ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                     STAGE 6: PIXI INITIALIZATION                             │
└─────────────────────────────────────────────────────────────────────────────┘

   PIXI.Application Setup
         │
         ├─→ Create Canvas
         │   Append to containerRef.current
         │
         ├─→ Setup Renderer
         │   WebGL or Canvas2D fallback
         │
         ├─→ Create Stage (root container)
         │
         └─→ Initialize Systems
             - LOD System
             - Spatial Index
             - Texture Atlas
         │
         │ On Success:
         ↓
   setIsInitialized(true) ← 🔴 CRITICAL FLAG
         │
         ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                      STAGE 7: D3 FORCE SIMULATION                            │
└─────────────────────────────────────────────────────────────────────────────┘

   forceSimulation<EnhancedGraphNode, EnhancedGraphEdge>()
         │
         ├─→ forceLink(edges) - Link force
         │   Distance: Based on edge weight
         │   Strength: Auto-calculated
         │
         ├─→ forceManyBody() - Repulsion
         │   Strength: -300 (push apart)
         │
         ├─→ forceCenter() - Gravity to center
         │
         ├─→ forceCollide() - Collision detection
         │   Radius: Node size + padding
         │
         └─→ forceX() + forceY() - Boundary forces
         │
         │ On each tick:
         ↓
   Update node.x, node.y positions
         │
         │ Update PIXI sprite/graphics positions
         ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 8: NODE CREATION (PIXI)                         │
└─────────────────────────────────────────────────────────────────────────────┘

   For each node in graphData.nodes:
         │
         ├─→ Create PIXI.Container
         │   Holds circle + label
         │
         ├─→ Create Circle (Sprite or Graphics)
         │   Sprite Mode: Use texture atlas (faster)
         │   Graphics Mode: Draw circle (flexible)
         │
         ├─→ Create PIXI.Text Label
         │   Text: "{artist} - {title}"
         │   Style: { fontSize, fill, fontFamily }
         │
         ├─→ Setup Event Handlers
         │   - pointerdown (drag start)
         │   - pointerup (click detection)
         │   - pointerenter (hover)
         │   - pointerleave (unhover)
         │   - rightclick (context menu)
         │
         └─→ Add to Stage
             app.stage.addChild(container)
         │
         ↓
   Enhanced Node Created
   { ...node, pixiNode, pixiCircle, pixiLabel, lodLevel }
         │
         ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 9: EDGE CREATION (PIXI)                         │
└─────────────────────────────────────────────────────────────────────────────┘

   For each edge in graphData.edges:
         │
         ├─→ Create PIXI.Graphics
         │
         ├─→ Draw Line
         │   From: sourceNode.position
         │   To: targetNode.position
         │   Stroke: Color based on edge type
         │   Width: Based on edge weight
         │
         └─→ Add to Stage (below nodes)
             app.stage.addChildAt(edgeGraphics, 0)
         │
         ↓
   Enhanced Edge Created
   { ...edge, pixiGraphics }
         │
         ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                       STAGE 10: LOD SYSTEM (Visibility)                      │
└─────────────────────────────────────────────────────────────────────────────┘

   On each frame (60 FPS):
         │
         ├─→ Get Current Viewport Bounds
         │   Transform: D3 zoom transform
         │   Bounds: { x, y, width, height }
         │
         ├─→ For each node:
         │   │
         │   ├─→ Calculate Screen Position
         │   │   screenX = (node.x * zoom.k) + zoom.x
         │   │   screenY = (node.y * zoom.k) + zoom.y
         │   │
         │   ├─→ Check if in Viewport + Buffer
         │   │   inBounds = screenX in [0, width] && screenY in [0, height]
         │   │   withBuffer = inBounds || distance < VIEWPORT_BUFFER
         │   │
         │   └─→ Assign LOD Level
         │       If not withBuffer: lodLevel = 0 (invisible)
         │       If distance < 400: lodLevel = 3 (full detail)
         │       If distance < 800: lodLevel = 2 (medium detail)
         │       Else: lodLevel = 1 (low detail)
         │
         ├─→ Update Visibility
         │   container.visible = (lodLevel > 0)
         │   label.visible = (lodLevel >= 2)
         │
         └─→ Update Spatial Index
             For faster neighbor queries
         │
         ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                      STAGE 11: RENDER TO CANVAS                              │
└─────────────────────────────────────────────────────────────────────────────┘

   PIXI Render Loop (requestAnimationFrame):
         │
         ├─→ Update Simulation (D3 tick)
         │   Moves nodes based on forces
         │
         ├─→ Update PIXI Positions
         │   container.position.set(node.x, node.y)
         │
         ├─→ Update Edge Lines
         │   Redraw from source to target
         │
         ├─→ Apply LOD Visibility
         │   Only render visible nodes/edges
         │
         └─→ Render to Canvas
             app.renderer.render(app.stage)
         │
         ↓
   🎨 VISIBLE ON SCREEN
```

---

## Potential Failure Points (Marked with 🔴)

### Point 1: API Response
**Location:** Stage 1 → Stage 2
**Symptoms:** Network error, 404, 500, CORS
**Check:** Browser DevTools → Network tab

### Point 2: Data Filtering
**Location:** Stage 2 (useDataLoader filters)
**Symptoms:** All nodes filtered out (artist validation too strict)
**Check:** Console log after each filter step

### Point 3: Store Update
**Location:** Stage 2 → Stage 3
**Symptoms:** setGraphData not called, store not updating
**Check:** Zustand DevTools, localStorage inspection

### Point 4: Selector Subscription
**Location:** Stage 3 → Stage 4
**Symptoms:** Component doesn't re-render on store update
**Check:** React DevTools, add useEffect log

### Point 5: isInitialized Gate 🔴 HIGH PROBABILITY
**Location:** Stage 5
**Symptoms:** Flag stuck at false, rendering never starts
**Check:** Add console.log before/after setIsInitialized

### Point 6: PIXI Initialization
**Location:** Stage 6
**Symptoms:** Canvas not created, WebGL context loss
**Check:** Canvas element exists in DOM, no console errors

### Point 7: Node Creation
**Location:** Stage 8
**Symptoms:** Nodes created but not added to stage
**Check:** app.stage.children.length

### Point 8: LOD Culling 🔴 MEDIUM PROBABILITY
**Location:** Stage 10
**Symptoms:** All nodes marked lodLevel=0 (invisible)
**Check:** Log lodLevel distribution, viewport bounds

### Point 9: Position Range
**Location:** Stage 2 (hash-based positions)
**Symptoms:** Nodes positioned outside visible area
**Check:** Min/max X/Y values, compare to viewport size

---

## Debugging Workflow

```
START: User reports no nodes visible
  │
  ├─→ Step 1: Check API Response
  │   Command: Network tab → /api/graph/data → Preview
  │   Expected: { nodes: [...], edges: [...] }
  │
  ├─→ Step 2: Check Store State
  │   Command: Console → useStore.getState().graphData
  │   Expected: { nodes: [14 items], edges: [8 items] }
  │
  ├─→ Step 3: Check Component Subscription
  │   Command: Add useEffect log on graphData
  │   Expected: Log fires with node count
  │
  ├─→ Step 4: Check isInitialized Flag
  │   Command: Console → document.querySelector('canvas')
  │   Expected: Canvas exists, isInitialized should be true
  │
  ├─→ Step 5: Check Node Creation
  │   Command: Add log in node creation loop
  │   Expected: 14 nodes created with PIXI containers
  │
  ├─→ Step 6: Check LOD Visibility
  │   Command: Log lodLevel for each node
  │   Expected: At least some nodes have lodLevel > 0
  │
  └─→ Step 7: Check Positions
      Command: Log node.x, node.y for first 5 nodes
      Expected: Values in reasonable range [-800, 800]
```

---

## Success Flow (Expected)

```
✅ API returns data (14 nodes, 8 edges)
✅ useDataLoader filters to 14 valid nodes (all have artists)
✅ setGraphData updates store
✅ Component re-renders with new graphData
✅ isInitialized = true (PIXI ready)
✅ updateGraphData() is called
✅ 14 Enhanced nodes created with PIXI containers
✅ 8 Edges created with PIXI graphics
✅ D3 simulation runs, positions stabilize
✅ LOD system marks nodes visible (lodLevel > 0)
✅ Canvas shows 14 circles with labels
✅ User can interact (drag, click, hover)
```

---

## Failure Flow (Current Issue)

```
✅ API returns data (14 nodes, 8 edges)
✅ useDataLoader filters to 14 valid nodes
✅ setGraphData updates store
✅ Component re-renders with new graphData
🔴 isInitialized = false (PIXI NOT ready)
❌ updateGraphData() is NOT called
❌ Nodes are NOT created
❌ Canvas is empty or doesn't exist
❌ User sees nothing
```

**OR:**

```
✅ API returns data (14 nodes, 8 edges)
✅ useDataLoader filters to 14 valid nodes
✅ setGraphData updates store
✅ Component re-renders with new graphData
✅ isInitialized = true (PIXI ready)
✅ updateGraphData() is called
✅ 14 Enhanced nodes created with PIXI containers
✅ 8 Edges created with PIXI graphics
✅ D3 simulation runs, positions stabilize
🔴 LOD system marks ALL nodes invisible (lodLevel = 0)
❌ Canvas is blank (nodes exist but culled)
❌ User sees nothing
```

---

## Quick Diagnostic Commands

### 1. Full Pipeline Check
```javascript
// Paste in browser console
const state = useStore.getState();
const canvas = document.querySelector('canvas');
const diagnostics = {
  '1. API Data Loaded': state.graphData.nodes.length > 0,
  '2. Store Has Data': state.graphData.nodes.length,
  '3. Canvas Exists': !!canvas,
  '4. Canvas Size': canvas ? `${canvas.width}x${canvas.height}` : 'N/A',
  '5. Error State': state.error,
  '6. Loading State': state.isLoading
};
console.table(diagnostics);

// If step 1-2 pass but 3 fails → PIXI initialization issue
// If step 1-3 pass → LOD culling or position issue
```

### 2. Position Distribution Check
```javascript
const state = useStore.getState();
const nodes = state.graphData.nodes;
const xs = nodes.map(n => n.x).filter(x => x !== undefined);
const ys = nodes.map(n => n.y).filter(y => y !== undefined);
console.table({
  'Total Nodes': nodes.length,
  'Nodes with X': xs.length,
  'X Range': `[${Math.min(...xs)}, ${Math.max(...xs)}]`,
  'Y Range': `[${Math.min(...ys)}, ${Math.max(...ys)}]`,
  'Viewport Width': window.innerWidth,
  'Viewport Height': window.innerHeight
});

// If ranges exceed [-2000, 2000], positions may be off-screen
```

### 3. PIXI Container Check
```javascript
// If you expose pixiAppRef globally for debugging
const app = window.__PIXI_APP__;
if (app) {
  console.table({
    'Stage Children': app.stage.children.length,
    'Expected': state.graphData.nodes.length,
    'Match': app.stage.children.length === state.graphData.nodes.length
  });
} else {
  console.error('❌ PIXI app not found - initialization failed');
}
```
