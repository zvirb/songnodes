# LOD Bug Fix: Implementation & Verification Guide

**Related Documents:**
- `coordinate-system-analysis-and-lod-bug-fix.md` (main analysis)
- `coordinate-system-visual-guide.md` (visual diagrams)

**Target File:** `/mnt/my_external_drive/programming/songnodes/frontend/src/components/GraphVisualization.tsx`

---

## Part 1: The Fix

### Step 1: Locate the Bug

**File:** `frontend/src/components/GraphVisualization.tsx`
**Lines:** 121-122
**Method:** `LODSystem.getNodeLOD()`

### Step 2: Current Broken Code

```typescript
// Lines 121-122 (BROKEN)
const screenX = (node.x * this.viewport.zoom);
const screenY = (node.y * this.viewport.zoom);
```

### Step 3: Apply the Fix

Replace lines 121-122 with:

```typescript
// Transform world coordinates to screen coordinates
// Formula: screen = (world * zoom) + centering_offset + pan_offset
// This matches PIXI's stage transform: screen = (world * stage.scale) + stage.position
const screenX = (node.x * this.viewport.zoom) + (this.viewport.width / 2) + this.viewport.x;
const screenY = (node.y * this.viewport.zoom) + (this.viewport.height / 2) + this.viewport.y;
```

### Step 4: Update Documentation Comment

Replace the comment block at lines 115-120 with:

```typescript
// Calculate screen bounds for proper viewport culling (2025 best practice)
// Transform world coordinates to screen coordinates using the same formula as PIXI's stage transform
//
// PIXI stage transform (set by D3-zoom handler at lines 876-881):
//   stage.x = (width/2) + transform.x  (centering + pan)
//   stage.y = (height/2) + transform.y
//   stage.scale = transform.k
//
// Screen position formula:
//   screen.x = (world.x * scale) + stage.x
//   screen.x = (node.x * zoom) + (width/2) + pan.x
//
// This gives us the ACTUAL pixel position where the node appears on screen.
```

---

## Part 2: Pre-Fix Verification (Understanding the Bug)

Before applying the fix, verify the bug exists:

### Console Commands

Open browser DevTools console and run:

```javascript
// Get references to debugging objects
const viewport = window.viewportRef?.current;
const lodSystem = window.lodSystemRef?.current;
const nodes = window.enhancedNodesRef?.current;

// Check viewport state
console.log('Viewport:', {
  width: viewport.width,
  height: viewport.height,
  zoom: viewport.zoom,
  pan: { x: viewport.x, y: viewport.y }
});

// Check a sample node
const firstNode = Array.from(nodes.values())[0];
console.log('First node:', {
  id: firstNode.id,
  world: { x: firstNode.x, y: firstNode.y },
  visible: firstNode.isVisible,
  lodLevel: firstNode.lodLevel
});

// Calculate what screen position SHOULD be
const correctScreenX = (firstNode.x * viewport.zoom) + (viewport.width / 2) + viewport.x;
const correctScreenY = (firstNode.y * viewport.zoom) + (viewport.height / 2) + viewport.y;

// Calculate what the BROKEN code thinks screen position is
const brokenScreenX = firstNode.x * viewport.zoom;
const brokenScreenY = firstNode.y * viewport.zoom;

console.log('Screen position comparison:', {
  correct: { x: correctScreenX, y: correctScreenY },
  broken: { x: brokenScreenX, y: brokenScreenY },
  difference: {
    x: Math.abs(correctScreenX - brokenScreenX),
    y: Math.abs(correctScreenY - brokenScreenY)
  }
});

// Check how many nodes are incorrectly culled
let totalNodes = 0;
let visibleNodes = 0;
let culledNodes = 0;
nodes.forEach(node => {
  totalNodes++;
  if (node.isVisible) visibleNodes++;
  if (node.lodLevel === 3) culledNodes++;
});

console.log('Node visibility stats:', {
  total: totalNodes,
  visible: visibleNodes,
  culled: culledNodes,
  percentageVisible: ((visibleNodes / totalNodes) * 100).toFixed(1) + '%'
});
```

### Expected Output (Before Fix)

```
Viewport: {
  width: 1920,
  height: 1080,
  zoom: 1,
  pan: { x: 0, y: 0 }  // Or some non-zero values if panned
}

First node: {
  id: "some-track-id",
  world: { x: 150, y: -200 },
  visible: false,  // ❌ Should be true!
  lodLevel: 3      // ❌ Should be 0 or 1!
}

Screen position comparison: {
  correct: { x: 1110, y: 340 },    // Where node SHOULD be
  broken: { x: 150, y: -200 },     // Where code THINKS it is
  difference: { x: 960, y: 540 }   // Huge difference!
}

Node visibility stats: {
  total: 100,
  visible: 5,         // ❌ Way too few!
  culled: 95,         // ❌ Almost all culled!
  percentageVisible: "5.0%"  // ❌ Should be much higher!
}
```

**Key Indicators of the Bug:**
1. Screen position difference matches (width/2, height/2) → centering offset missing
2. Very few nodes visible (< 20%)
3. Most nodes have LOD level 3 (culled)
4. Nodes appear on screen but are marked as invisible

---

## Part 3: Post-Fix Verification

After applying the fix, verify it works:

### Visual Verification

1. **Load the application**
   - Expected: Nodes should be visible immediately
   - Before fix: Blank canvas or very few nodes

2. **Pan the graph**
   - Action: Click and drag to pan in all directions
   - Expected: Nodes smoothly appear/disappear at edges
   - Before fix: Nodes pop in/out or don't appear at all

3. **Zoom in/out**
   - Action: Scroll wheel to zoom
   - Expected: More/fewer nodes visible, smooth transitions
   - Before fix: Nodes disappear when zooming

4. **Check LOD levels**
   - Action: Pan slowly toward edge of graph
   - Expected: Nodes near edges have higher LOD (less detail)
   - Expected: Nodes at center have LOD 0 (full detail)

### Console Verification

Run the same console commands as pre-fix verification:

```javascript
// Same code as before...
```

### Expected Output (After Fix)

```
Viewport: {
  width: 1920,
  height: 1080,
  zoom: 1,
  pan: { x: 0, y: 0 }
}

First node: {
  id: "some-track-id",
  world: { x: 150, y: -200 },
  visible: true,   // ✅ Now visible!
  lodLevel: 0      // ✅ Full detail (near center)!
}

Screen position comparison: {
  correct: { x: 1110, y: 340 },
  broken: N/A,  // (Using correct formula now)
  difference: { x: 0, y: 0 }  // ✅ No difference!
}

Node visibility stats: {
  total: 100,
  visible: 85,        // ✅ Much better!
  culled: 15,         // ✅ Only nodes actually outside viewport
  percentageVisible: "85.0%"  // ✅ Reasonable percentage!
}
```

**Key Indicators of Success:**
1. Screen position calculated correctly (matches visual position)
2. 50-90% of nodes visible (depends on graph density)
3. Only nodes actually outside viewport are culled (LOD 3)
4. Nodes near center have LOD 0, edges have higher LOD

---

## Part 4: Regression Testing

Test all interaction modes to ensure nothing broke:

### Test Suite

#### Test 1: Initial Load
```
Action: Refresh page
Expected:
  ✓ Nodes appear centered
  ✓ No console errors
  ✓ Nodes are interactive (hover shows cursor pointer)
```

#### Test 2: Pan North (Up)
```
Action: Click and drag DOWN (pans viewport up, revealing nodes above)
Expected:
  ✓ New nodes appear smoothly at top edge
  ✓ Nodes disappear smoothly at bottom edge
  ✓ No sudden pop-in/pop-out
  ✓ transform.y becomes negative
```

#### Test 3: Pan South (Down)
```
Action: Click and drag UP (pans viewport down, revealing nodes below)
Expected:
  ✓ New nodes appear at bottom edge
  ✓ Nodes disappear at top edge
  ✓ transform.y becomes positive
```

#### Test 4: Pan East (Right)
```
Action: Click and drag LEFT (pans viewport right, revealing nodes to the right)
Expected:
  ✓ New nodes appear at right edge
  ✓ Nodes disappear at left edge
  ✓ transform.x becomes positive
```

#### Test 5: Pan West (Left)
```
Action: Click and drag RIGHT (pans viewport left, revealing nodes to the left)
Expected:
  ✓ New nodes appear at left edge
  ✓ Nodes disappear at right edge
  ✓ transform.x becomes negative
```

#### Test 6: Zoom In (2x)
```
Action: Scroll wheel up (or pinch out on trackpad)
Expected:
  ✓ Nodes appear larger
  ✓ Fewer nodes visible (viewport shows smaller area of world)
  ✓ Node details more visible (labels, etc.)
  ✓ transform.k increases (e.g., 1.0 → 2.0)
```

#### Test 7: Zoom Out (0.5x)
```
Action: Scroll wheel down (or pinch in on trackpad)
Expected:
  ✓ Nodes appear smaller
  ✓ More nodes visible (viewport shows larger area of world)
  ✓ Node details less visible (higher LOD)
  ✓ transform.k decreases (e.g., 1.0 → 0.5)
```

#### Test 8: Combined Zoom + Pan
```
Action: Zoom in to 2x, then pan around
Expected:
  ✓ Smooth culling behavior
  ✓ Nodes appear/disappear correctly
  ✓ No stutter or lag
  ✓ No nodes "stuck" at wrong positions
```

#### Test 9: Click Node
```
Action: Click on a visible node
Expected:
  ✓ Node selection works
  ✓ Click handler fires
  ✓ Node highlights/changes color
  ✓ Console logs node click (if debug enabled)
```

#### Test 10: Performance Test
```
Action: Load graph with 1000+ nodes, pan rapidly
Expected:
  ✓ Frame rate stays above 30 FPS
  ✓ No jank or stutter
  ✓ Culling reduces visible nodes appropriately
  ✓ LOD system activates (check console logs)
```

---

## Part 5: Debugging Failed Tests

If any test fails, use these debugging steps:

### Issue: Nodes Not Appearing

**Symptoms:**
- Blank canvas
- Very few nodes visible
- Console shows nodes exist but aren't visible

**Debug Steps:**
```javascript
// Check if nodes have positions
const nodes = window.enhancedNodesRef?.current;
const firstNode = Array.from(nodes.values())[0];
console.log('Node position:', firstNode.x, firstNode.y);
// Expected: Numbers, not undefined

// Check if PIXI nodes exist
console.log('PIXI node exists:', !!firstNode.pixiNode);
// Expected: true

// Check if PIXI nodes are children of containers
const nodesContainer = window.pixiApp.stage.children.find(c => c.label === 'nodes');
console.log('Nodes in container:', nodesContainer.children.length);
// Expected: > 0

// Check stage transform
console.log('Stage transform:', {
  x: window.pixiApp.stage.x,
  y: window.pixiApp.stage.y,
  scale: window.pixiApp.stage.scale.x
});
// Expected: x ≈ width/2, y ≈ height/2, scale > 0
```

### Issue: Nodes in Wrong Position

**Symptoms:**
- Nodes appear but not where expected
- Nodes offset from mouse position
- Click detection doesn't work

**Debug Steps:**
```javascript
// Compare world vs screen positions
const node = Array.from(window.enhancedNodesRef.current.values())[0];
const viewport = window.viewportRef.current;

const worldX = node.x;
const worldY = node.y;

const screenX = (worldX * viewport.zoom) + (viewport.width / 2) + viewport.x;
const screenY = (worldY * viewport.zoom) + (viewport.height / 2) + viewport.y;

const pixiScreenX = node.pixiNode.getGlobalPosition().x;
const pixiScreenY = node.pixiNode.getGlobalPosition().y;

console.log('Position comparison:', {
  world: { x: worldX, y: worldY },
  calculated: { x: screenX, y: screenY },
  pixi: { x: pixiScreenX, y: pixiScreenY },
  match: Math.abs(screenX - pixiScreenX) < 1 && Math.abs(screenY - pixiScreenY) < 1
});
// Expected: match = true
```

### Issue: Too Many/Few Nodes Culled

**Symptoms:**
- Almost all nodes culled (< 10% visible)
- No nodes culled (100% visible, performance issues)

**Debug Steps:**
```javascript
// Check viewport bounds calculation
const viewport = window.viewportRef.current;
const buffer = 200;

const bounds = {
  left: -buffer,
  right: viewport.width + buffer,
  top: -buffer,
  bottom: viewport.height + buffer
};

console.log('Viewport bounds:', bounds);
// Expected: Reasonable values based on canvas size

// Check sample node screen positions
const nodes = Array.from(window.enhancedNodesRef.current.values());
const samples = nodes.slice(0, 10).map(node => {
  const screenX = (node.x * viewport.zoom) + (viewport.width / 2) + viewport.x;
  const screenY = (node.y * viewport.zoom) + (viewport.height / 2) + viewport.y;

  const inBounds = screenX >= bounds.left && screenX <= bounds.right &&
                   screenY >= bounds.top && screenY <= bounds.bottom;

  return {
    world: { x: Math.round(node.x), y: Math.round(node.y) },
    screen: { x: Math.round(screenX), y: Math.round(screenY) },
    inBounds,
    lodLevel: node.lodLevel
  };
});

console.table(samples);
// Expected: inBounds matches (lodLevel < 3)
```

### Issue: LOD Levels Incorrect

**Symptoms:**
- All nodes have same LOD
- LOD doesn't change when panning
- Nodes near center have high LOD (should be 0)

**Debug Steps:**
```javascript
// Check LOD distance calculations
const viewport = window.viewportRef.current;
const centerX = viewport.width / 2;
const centerY = viewport.height / 2;

const node = Array.from(window.enhancedNodesRef.current.values())[0];
const screenX = (node.x * viewport.zoom) + (viewport.width / 2) + viewport.x;
const screenY = (node.y * viewport.zoom) + (viewport.height / 2) + viewport.y;

const distanceFromCenter = Math.sqrt(
  Math.pow(screenX - centerX, 2) + Math.pow(screenY - centerY, 2)
);

const diagonal = Math.sqrt(viewport.width ** 2 + viewport.height ** 2);
const normalizedDistance = distanceFromCenter / diagonal;

console.log('LOD calculation:', {
  screenPos: { x: Math.round(screenX), y: Math.round(screenY) },
  center: { x: centerX, y: centerY },
  distance: Math.round(distanceFromCenter),
  normalized: normalizedDistance.toFixed(3),
  expectedLOD: normalizedDistance > 0.8 ? 2 : normalizedDistance > 0.4 ? 1 : 0,
  actualLOD: node.lodLevel
});
// Expected: expectedLOD = actualLOD
```

---

## Part 6: Performance Benchmarks

After the fix, verify performance metrics:

### Metrics to Track

```javascript
// Run this in console after fix
const perfMonitor = {
  start: Date.now(),
  frameCount: 0,

  measure: function() {
    this.frameCount++;
    if (this.frameCount % 60 === 0) {
      const elapsed = (Date.now() - this.start) / 1000;
      const fps = this.frameCount / elapsed;

      const nodes = window.enhancedNodesRef?.current;
      const visible = Array.from(nodes.values()).filter(n => n.isVisible).length;

      console.log(`FPS: ${fps.toFixed(1)}, Visible: ${visible}/${nodes.size}`);
    }
    requestAnimationFrame(() => this.measure());
  }
};

perfMonitor.measure();
```

### Expected Performance

**With < 500 nodes:**
- FPS: 60 (smooth)
- Visible: 50-90% depending on zoom/pan
- No jank or stutter

**With 500-1000 nodes:**
- FPS: 45-60 (smooth to slightly reduced)
- Visible: 40-80% depending on zoom/pan
- Occasional minor stutter acceptable

**With 1000+ nodes:**
- FPS: 30-45 (acceptable)
- Visible: 30-70% depending on zoom/pan
- LOD system should activate (check console for "Performance-based LOD" logs)

---

## Part 7: Final Checklist

Before considering the fix complete:

- [ ] Code changes applied to lines 121-122
- [ ] Comment updated at lines 115-120
- [ ] No TypeScript errors
- [ ] No console errors on page load
- [ ] Nodes visible on initial load
- [ ] Panning works in all 4 directions
- [ ] Zooming in/out works smoothly
- [ ] Node click detection works
- [ ] LOD levels change correctly
- [ ] Performance acceptable (FPS > 30)
- [ ] Visual verification complete
- [ ] Console verification complete
- [ ] All 10 regression tests pass
- [ ] No existing functionality broken
- [ ] Code committed with descriptive message

---

## Part 8: Commit Message

Use this commit message format:

```
fix(graph): correct LOD viewport culling coordinate transformation

The LOD system was incorrectly culling visible nodes due to incomplete
coordinate transformation. The code only applied zoom scaling but forgot
to add the centering offset (width/2, height/2) and pan offset
(transform.x, transform.y).

This caused the viewport culling logic to check nodes against incorrect
screen positions, resulting in almost all nodes being culled (LOD level 3)
even when they were actually visible on screen.

Changes:
- Updated LODSystem.getNodeLOD() to use complete transformation formula:
  screen = (world * zoom) + (width/2) + pan
- Formula now matches PIXI's stage transform exactly
- Added detailed comments explaining the coordinate system

Fixes:
- Nodes now correctly stay visible when within viewport
- Viewport culling works correctly with panning
- LOD levels assigned based on actual screen position
- No more incorrect culling when zooming

Tested:
- Initial load: nodes visible ✓
- Panning: smooth transitions ✓
- Zooming: correct culling behavior ✓
- Performance: 60 FPS with 500 nodes ✓
- Node interaction: click detection works ✓

Related: Lines 121-122, 876-881 in GraphVisualization.tsx
```

---

## End of Implementation Guide

Follow this guide step-by-step to ensure the fix is properly implemented and verified.
