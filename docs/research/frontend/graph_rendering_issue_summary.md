# Graph Rendering Issue - Executive Summary

**Issue:** API returns `{nodes: 14, edges: 8}` but frontend shows 0 nodes/edges
**Analysis Date:** 2025-11-12
**Files Analyzed:** 5 core files across API, hooks, store, and components

---

## Key Findings

### ✅ Data Flow IS Working Correctly

The complete chain from database → API → fetch → store is **functioning as designed**:

```
PostgreSQL → FastAPI (/api/graph/data) → useDataLoader → Zustand Store → Component
    ✅           ✅                          ✅              ✅             ⚠️
```

### ❌ Issue Is In Rendering Pipeline

The problem occurs AFTER data reaches the component. The breakdown is in:

```
Component Subscription → PIXI Initialization → Node Creation → Canvas Rendering
         ✅                      ⚠️                  ⚠️               ❌
```

---

## Root Cause (Most Likely)

### **PIXI Initialization Race Condition** (60% confidence)

**Location:** `/home/marku/Documents/programming/songnodes/frontend/src/components/GraphVisualization.tsx:3316-3331`

**The Problem:**
```typescript
useEffect(() => {
  if (isInitialized && graphData.nodes.length > 0) {
    updateGraphData();  // ✅ This should run
  } else if (!isInitialized) {
    console.log('Waiting for initialization (isInitialized=false)');  // 🔴 Stuck here?
  }
}, [isInitialized, currentDataHash, updateGraphData]);
```

**Evidence:**
- `isInitialized` state at line 581 starts as `false`
- Must be set to `true` by PIXI setup completion
- If PIXI setup fails silently, flag never flips → nodes never render
- Data exists in store but rendering pipeline never starts

**Related Code:**
- Line 581: `const [isInitialized, setIsInitialized] = useState(false);`
- Line 949: Comment indicates PIXI initialization completion
- Line 3309: useEffect depends on `isInitialized` for simulation setup

---

## Secondary Suspects

### 2. **LOD System Over-Culling** (25% confidence)

**Location:** Lines 25-38, hash-based position initialization in useDataLoader.ts:123-128

**The Problem:**
- Nodes positioned at hash-based coordinates (e.g., `x: 453, y: -287`)
- LOD system checks if nodes are in viewport bounds
- If ALL nodes fall outside `VIEWPORT_BUFFER: 400`, they're culled
- Result: Created but invisible

**Test:**
```javascript
// Browser console
const state = window.__ZUSTAND_STORE__.getState();
const positions = state.graphData.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
console.log('Min X:', Math.min(...positions.map(p => p.x)));
console.log('Max X:', Math.max(...positions.map(p => p.x)));
// If range is [-800, 800] but viewport is [0, 1920], nodes are off-screen
```

### 3. **Selector Subscription Not Triggering** (10% confidence)

**Location:** GraphVisualization.tsx:534-542 (recent fix)

**The Problem:**
- Selectors are syntactically correct
- But React may not detect state change if reference equality check fails
- `graphData` object reference should change on `setGraphData()`
- If reference doesn't change, no re-render triggered

**Test:**
```typescript
// Add to component
const prevGraphData = useRef(graphData);
useEffect(() => {
  console.log('GraphData reference changed?', prevGraphData.current !== graphData);
  prevGraphData.current = graphData;
}, [graphData]);
```

---

## Console Output Explained

### "nodeCount: 0, edgeCount: 0" ≠ "No Data"

**Important Discovery:**
- `nodeCount` and `edgeCount` come from `performanceMetrics` state
- NOT the same as `graphData.nodes.length`
- Performance metrics are updated SEPARATELY (useStore.ts:351-356)
- Console log at line 3317 reads from `graphData`, not `performanceMetrics`

**The Metrics Pipeline:**
```typescript
setGraphData(data) → Updates graphData AND performanceMetrics
                   ↓
         graphData.nodes.length = 14  (DATA IS HERE)
                   ↓
         performanceMetrics.nodeCount = 14  (SHOULD MATCH)
```

If user sees `nodeCount: 0`, check if they're reading:
- ❌ `performanceMetrics.nodeCount` (may not be updated yet)
- ✅ `graphData.nodes.length` (primary source of truth)

---

## Code Locations Reference

### API Response
- **File:** `services/graph-visualization-api/main.py`
- **Lines:** 1034-1220 (get_graph_data function)
- **Returns:** `{ nodes: [...], edges: [...], metadata: {...} }`

### Data Fetch
- **File:** `frontend/src/hooks/useDataLoader.ts`
- **Lines:** 96-254 (loadData function)
- **Filters:** Artist validation (9-26), Edge validation (158-167), Connectivity (169-179)

### Store Update
- **File:** `frontend/src/store/useStore.ts`
- **Lines:** 344-360 (graph.setGraphData action)
- **Updates:** `graphData` + `originalGraphData` + `performanceMetrics`

### Component Subscription
- **File:** `frontend/src/components/GraphVisualization.tsx`
- **Lines:** 534-542 (Zustand selectors - FIXED)
- **Dependencies:** graphData, viewState, pathfindingState, etc.

### Rendering Gate
- **File:** `frontend/src/components/GraphVisualization.tsx`
- **Lines:** 3316-3331 (useEffect with isInitialized check)
- **Blocker:** `isInitialized` must be `true` AND `graphData.nodes.length > 0`

### LOD System
- **File:** `frontend/src/components/GraphVisualization.tsx`
- **Lines:** 25-38 (PERFORMANCE_THRESHOLDS)
- **Culling:** VIEWPORT_BUFFER = 400 pixels

---

## Debugging Commands

### 1. Check Store State
```javascript
// Browser console
const state = window.__ZUSTAND_STORE__?.getState?.() || useStore.getState();
console.table({
  'graphData.nodes.length': state.graphData.nodes.length,
  'graphData.edges.length': state.graphData.edges.length,
  'performanceMetrics.nodeCount': state.performanceMetrics.nodeCount,
  'performanceMetrics.edgeCount': state.performanceMetrics.edgeCount,
  'isLoading': state.isLoading,
  'error': state.error
});
```

### 2. Check PIXI Initialization
```javascript
// Browser console (if you expose pixiAppRef)
const canvas = document.querySelector('canvas');
console.log({
  'Canvas exists': !!canvas,
  'Canvas size': canvas ? `${canvas.width}x${canvas.height}` : 'N/A',
  'PIXI version': window.PIXI?.VERSION
});
```

### 3. Check Node Positions
```javascript
// Browser console
const state = useStore.getState();
const nodes = state.graphData.nodes;
const positions = nodes.map(n => ({ x: n.x, y: n.y }));
console.log({
  'Total nodes': nodes.length,
  'Nodes with positions': positions.filter(p => p.x !== undefined).length,
  'Position range X': [Math.min(...positions.map(p => p.x || 0)), Math.max(...positions.map(p => p.x || 0))],
  'Position range Y': [Math.min(...positions.map(p => p.y || 0)), Math.max(...positions.map(p => p.y || 0))]
});
```

---

## Recommended Fixes (Priority Order)

### 1. Add PIXI Initialization Logging 🔴 HIGH PRIORITY
```typescript
// GraphVisualization.tsx - Add after line 581
useEffect(() => {
  console.log('🎨 PIXI Status Check:', {
    isInitialized,
    hasPixiApp: !!pixiAppRef.current,
    hasContainer: !!containerRef.current,
    graphDataNodes: graphData.nodes.length,
    canRender: isInitialized && graphData.nodes.length > 0
  });

  if (!isInitialized && pixiAppRef.current && containerRef.current) {
    console.log('✅ All PIXI requirements met, but isInitialized is false - this is the bug!');
  }
}, [isInitialized, graphData.nodes.length]);
```

### 2. Force Initial Zoom-to-Fit ⚠️ MEDIUM PRIORITY
```typescript
// GraphVisualization.tsx - Add to ensure all nodes are visible
useEffect(() => {
  if (isInitialized && graphData.nodes.length > 0 && zoomBehaviorRef.current && containerRef.current) {
    // Calculate bounds
    const bounds = {
      minX: Math.min(...graphData.nodes.map(n => n.x || 0)),
      maxX: Math.max(...graphData.nodes.map(n => n.x || 0)),
      minY: Math.min(...graphData.nodes.map(n => n.y || 0)),
      maxY: Math.max(...graphData.nodes.map(n => n.y || 0))
    };

    // Calculate zoom to fit
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const padding = 100;
    const zoomX = (width - padding * 2) / (bounds.maxX - bounds.minX);
    const zoomY = (height - padding * 2) / (bounds.maxY - bounds.minY);
    const zoom = Math.min(zoomX, zoomY, 1); // Don't zoom in past 1:1

    console.log('📐 Fitting graph to screen:', { bounds, zoom });

    // Apply zoom
    select(containerRef.current)
      .transition()
      .duration(750)
      .call(
        zoomBehaviorRef.current.transform,
        zoomIdentity
          .translate(width / 2, height / 2)
          .scale(zoom)
          .translate(-(bounds.minX + bounds.maxX) / 2, -(bounds.minY + bounds.maxY) / 2)
      );
  }
}, [isInitialized, graphData.nodes.length]);
```

### 3. Add Store Subscription Verification ⚠️ MEDIUM PRIORITY
```typescript
// GraphVisualization.tsx - Add after line 542
useEffect(() => {
  console.log('📡 GraphData subscription update:', {
    timestamp: Date.now(),
    nodes: graphData.nodes.length,
    edges: graphData.edges.length,
    sample: graphData.nodes[0]
  });
}, [graphData]);
```

### 4. Disable LOD for Testing 🟡 LOW PRIORITY (DEBUG ONLY)
```typescript
// GraphVisualization.tsx - Temporarily disable LOD culling
const DEBUG_DISABLE_LOD = true;

// In render loop, modify visibility check:
if (DEBUG_DISABLE_LOD || lodLevel > 0) {
  container.visible = true;
  // ... render node
}
```

---

## Success Criteria

After implementing fixes, verify:

1. ✅ Console shows "PIXI initialization complete, isInitialized set to true"
2. ✅ Console shows "graphData subscription update" with non-zero counts
3. ✅ Canvas element exists in DOM with reasonable size
4. ✅ At least one node sprite/graphics is visible on canvas
5. ✅ Browser DevTools → Network → `/api/graph/data` returns 200 with data
6. ✅ Browser DevTools → Redux/Zustand → `graphData.nodes.length > 0`

---

## Additional Resources

- **Full Analysis:** `docs/research/frontend/graph_visualization_data_flow_analysis_20251112.md`
- **Type Definitions:** `frontend/src/types/index.ts:48-101`
- **Force Simulation:** D3 force-simulation v3+ documentation
- **PIXI.js v8.5.2:** Breaking changes from v7 in application initialization
- **Zustand DevTools:** Install React DevTools + Zustand middleware

---

## Contact Points for Further Investigation

If the above fixes don't resolve the issue, investigate:

1. **PIXI v8.5.2 Breaking Changes** - Application initialization API changed
2. **WebGL Context Loss** - Check browser console for WebGL errors
3. **React Strict Mode** - Double-mounting may cause initialization issues
4. **Browser Compatibility** - Test in different browsers (Chrome, Firefox, Safari)
5. **Memory Constraints** - Large texture atlases may fail on low-RAM devices
