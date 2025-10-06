# PIXI.js + D3 Coordinate System Architecture & LOD Bug Analysis

**Research Date:** 2025-10-04
**File Analyzed:** `/mnt/my_external_drive/programming/songnodes/frontend/src/components/GraphVisualization.tsx`
**Bug Location:** Lines 112-166 (LODSystem.getNodeLOD method)
**Critical Issue:** Incorrect coordinate transformation causing all nodes to be culled

---

## Executive Summary

The LOD (Level of Detail) system is incorrectly culling all nodes due to a **fundamental misunderstanding of the PIXI.js coordinate transformation chain**. The bug is in lines 121-122, where the code attempts to transform world coordinates to screen coordinates but **fails to account for the stage's pan offset** (transform.x and transform.y from D3-zoom).

**Impact:** All nodes are being culled (LOD level 3) because their calculated screen positions are wildly incorrect, placing them far outside the visible viewport bounds.

---

## 1. PIXI.js Coordinate System Architecture

### 1.1 The Three Coordinate Spaces

```
┌─────────────────────────────────────────────────────────────┐
│                    COORDINATE SPACES                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. WORLD COORDINATES (where nodes live)                    │
│     - Origin: (0, 0) = center of force simulation           │
│     - Range: Unbounded, typically ±1000 pixels               │
│     - Example: node.x = 150, node.y = -200                   │
│     - Used by: D3-force simulation, node data storage        │
│                                                              │
│  2. STAGE COORDINATES (PIXI stage's local space)             │
│     - Origin: (0, 0) = center of stage (NOT canvas)          │
│     - Transform: stage.position.set(width/2, height/2)       │
│     - Transform: stage.scale.set(k, k)                       │
│     - Node positions are set directly in world coords:       │
│       node.pixiNode.position.set(node.x, node.y)             │
│     - The stage transform handles ALL scaling and panning    │
│                                                              │
│  3. SCREEN COORDINATES (canvas pixels)                       │
│     - Origin: (0, 0) = top-left corner of canvas             │
│     - Range: [0, width] x [0, height]                        │
│     - This is what the user sees                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 The Transformation Chain

```
WORLD → STAGE → SCREEN

Step 1: World to Stage (PIXI handles this automatically)
  - Node position set at: pixiNode.position.set(node.x, node.y)
  - These are world coordinates, but PIXI treats them as local stage coordinates

Step 2: Stage to Screen (PIXI's stage transform)
  screen.x = (node.x * stage.scale.x) + stage.x
  screen.y = (node.y * stage.scale.y) + stage.y

Where:
  - stage.scale.x = stage.scale.y = transform.k (zoom level)
  - stage.x = (width/2) + transform.x (center offset + pan offset)
  - stage.y = (height/2) + transform.y (center offset + pan offset)
```

### 1.3 Visual Diagram

```
Canvas Screen Space (what user sees):
┌─────────────────────────────────────────┐ (0, 0)
│                                         │
│     Visible viewport                    │
│     ┌───────────────────┐               │
│     │                   │               │
│     │   World (0,0) at  │               │
│     │   screen (cx,cy)  │               │
│     │        ●          │               │
│     │                   │               │
│     └───────────────────┘               │
│                                         │
│                                         │
└─────────────────────────────────────────┘ (width, height)
         ↑
         └─ Stage.x and Stage.y control where world (0,0) appears


World Coordinate Space (where D3-force positions nodes):
                    ↑ y (negative)
                    │
                    │  node @ (-100, -150)
                    │     ●
                    │
    ────────────────●────────────────→ x (positive)
   (negative)    (0, 0)
                    │
                    │        ● node @ (200, 100)
                    │
                    ↓ y (positive)
```

---

## 2. D3-Zoom Integration

### 2.1 Zoom Transform Components

D3-zoom maintains a `ZoomTransform` with three values:
- **transform.k** (scale/zoom): 1.0 = 100%, 2.0 = 200%, 0.5 = 50%
- **transform.x** (horizontal pan): Pixel offset, can be positive or negative
- **transform.y** (vertical pan): Pixel offset, can be positive or negative

### 2.2 How Zoom Handler Updates PIXI Stage (Lines 854-894)

```typescript
.on('zoom', (event: any) => {
  const transform: ZoomTransform = event.transform;

  // Store in viewport
  viewportRef.current.x = transform.x;      // Pan offset X
  viewportRef.current.y = transform.y;      // Pan offset Y
  viewportRef.current.zoom = transform.k;   // Zoom scale

  // Apply to PIXI stage
  const centerX = viewportRef.current.width / 2;
  const centerY = viewportRef.current.height / 2;

  // CRITICAL: Stage position = center + pan offset
  pixiAppRef.current.stage.x = centerX + transform.x;
  pixiAppRef.current.stage.y = centerY + transform.y;
  pixiAppRef.current.stage.scale.set(transform.k, transform.k);
});
```

**Key Insight:** The stage's position combines TWO offsets:
1. **Centering offset**: `width/2, height/2` (makes world origin appear at canvas center)
2. **Pan offset**: `transform.x, transform.y` (moves world when user pans)

### 2.3 Initial Centering (Line 632)

```typescript
// Center the stage so world coordinate (0,0) appears at canvas center
app.stage.position.set(rect.width / 2, rect.height / 2);
```

This initial centering is **replaced** by the zoom handler, which recalculates stage position on every zoom/pan event.

---

## 3. THE BUG: Incorrect LOD Coordinate Transformation

### 3.1 Current Broken Code (Lines 121-122)

```typescript
// ❌ WRONG: Missing pan offset!
const screenX = (node.x * this.viewport.zoom);
const screenY = (node.y * this.viewport.zoom);
```

**What this calculates:**
- Takes world coordinate `node.x` (e.g., 150)
- Multiplies by zoom `this.viewport.zoom` (e.g., 1.0)
- Result: `screenX = 150`

**Why this is wrong:**
1. **Missing centering offset**: Doesn't add `width/2` to shift origin to canvas center
2. **Missing pan offset**: Doesn't add `viewport.x` (transform.x) for panning
3. **Result**: All nodes appear at wrong screen positions, almost always outside viewport bounds

### 3.2 Example Calculation

**Scenario:**
- Canvas size: 1920x1080 (center at 960, 540)
- Node world position: (150, -200)
- Zoom: 1.0 (no scaling)
- Pan: (0, 0) (no panning, world centered)

**Current (broken) calculation:**
```
screenX = 150 * 1.0 = 150
screenY = -200 * 1.0 = -200
```

**Viewport bounds check:**
```
leftBound = -200
rightBound = 1920 + 200 = 2120
topBound = -200
bottomBound = 1080 + 200 = 1280

Is screenX (150) < leftBound (-200)? NO
Is screenX (150) > rightBound (2120)? NO
Is screenY (-200) < topBound (-200)? NO (equal)
Is screenY (-200) > bottomBound (1280)? NO
```

**Verdict:** Just barely NOT culled (on the edge), but position is WRONG!

The node should appear at screen position `(960 + 150, 540 - 200) = (1110, 340)`, but the code is checking if `(150, -200)` is in bounds.

**With slight pan (transform.x = -100):**
```
Actual screen position: (960 - 100 + 150, 540 - 200) = (1010, 340)
But code checks: (150, -200) vs bounds
Node appears on screen but gets CULLED!
```

### 3.3 Correct Transformation Formula

The correct formula must replicate PIXI's stage transformation:

```typescript
// ✅ CORRECT: Full transformation chain
const screenX = (node.x * this.viewport.zoom) + (this.viewport.width / 2) + this.viewport.x;
const screenY = (node.y * this.viewport.zoom) + (this.viewport.height / 2) + this.viewport.y;
```

**Breaking it down:**
1. `node.x * this.viewport.zoom` → Scale world coordinate by zoom
2. `+ (this.viewport.width / 2)` → Add centering offset (shift origin to canvas center)
3. `+ this.viewport.x` → Add pan offset (from D3-zoom transform)

**This matches PIXI's stage transform:**
```
stage.x = (width/2) + transform.x
stage.scale.x = transform.k

screen.x = (node.x * stage.scale.x) + stage.x
         = (node.x * transform.k) + (width/2 + transform.x)
         = (node.x * zoom) + width/2 + pan.x  ✓
```

---

## 4. Complete Bug Fix

### 4.1 Code Changes Required

**File:** `/mnt/my_external_drive/programming/songnodes/frontend/src/components/GraphVisualization.tsx`

**Lines to change:** 121-122

**Before:**
```typescript
const screenX = (node.x * this.viewport.zoom);
const screenY = (node.y * this.viewport.zoom);
```

**After:**
```typescript
// Transform world coordinates to screen coordinates
// Formula: screen = (world * zoom) + centering_offset + pan_offset
// This matches PIXI's stage transform: screen = (world * stage.scale) + stage.position
const screenX = (node.x * this.viewport.zoom) + (this.viewport.width / 2) + this.viewport.x;
const screenY = (node.y * this.viewport.zoom) + (this.viewport.height / 2) + this.viewport.y;
```

### 4.2 Updated Comment Documentation

Update the comment at lines 115-120 to reflect the correct understanding:

**Before:**
```typescript
// Calculate screen bounds for proper viewport culling (2025 best practice)
// Transform world coordinates to screen coordinates
// Stage is centered at (width/2, height/2) and positioned at (width/2 + viewport.x, height/2 + viewport.y)
// Node position in screen space = (node.x * zoom) + stage.x
// But for LOD culling, we only care about the *relative* position to viewport bounds
// The PIXI stage transform already handles centering + pan, so we just need world→screen transform
```

**After:**
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

## 5. Verification Test Cases

### 5.1 Test Case 1: Centered, No Zoom, No Pan

**Setup:**
- Canvas: 1920x1080
- Node: world position (0, 0)
- Zoom: 1.0
- Pan: (0, 0)

**Expected screen position:** (960, 540) - center of canvas

**Calculation:**
```typescript
screenX = (0 * 1.0) + (1920/2) + 0 = 960 ✓
screenY = (0 * 1.0) + (1080/2) + 0 = 540 ✓
```

**Bounds check:**
```
leftBound = -200, rightBound = 2120
topBound = -200, bottomBound = 1280

960 in [-200, 2120]? YES ✓
540 in [-200, 1280]? YES ✓
LOD = 0 (full detail, near center) ✓
```

### 5.2 Test Case 2: Offset Node, No Zoom, No Pan

**Setup:**
- Canvas: 1920x1080
- Node: world position (300, -200)
- Zoom: 1.0
- Pan: (0, 0)

**Expected screen position:** (1260, 340)

**Calculation:**
```typescript
screenX = (300 * 1.0) + (1920/2) + 0 = 1260 ✓
screenY = (-200 * 1.0) + (1080/2) + 0 = 340 ✓
```

**Bounds check:**
```
1260 in [-200, 2120]? YES ✓
340 in [-200, 1280]? YES ✓
LOD < 3 (visible) ✓
```

### 5.3 Test Case 3: Panned View

**Setup:**
- Canvas: 1920x1080
- Node: world position (0, 0)
- Zoom: 1.0
- Pan: (-200, 100) - user dragged left and down

**Expected screen position:** (760, 640)

**Calculation:**
```typescript
screenX = (0 * 1.0) + (1920/2) + (-200) = 760 ✓
screenY = (0 * 1.0) + (1080/2) + 100 = 640 ✓
```

**Bounds check:**
```
760 in [-200, 2120]? YES ✓
640 in [-200, 1280]? YES ✓
LOD = 0 (still near center) ✓
```

### 5.4 Test Case 4: Zoomed In

**Setup:**
- Canvas: 1920x1080
- Node: world position (400, -300)
- Zoom: 2.0 (200%)
- Pan: (0, 0)

**Expected screen position:** (1760, -60)

**Calculation:**
```typescript
screenX = (400 * 2.0) + (1920/2) + 0 = 1760 ✓
screenY = (-300 * 2.0) + (1080/2) + 0 = -60 ✓
```

**Bounds check:**
```
1760 in [-200, 2120]? YES ✓
-60 in [-200, 1280]? YES ✓
LOD < 3 (visible) ✓
```

### 5.5 Test Case 5: Outside Viewport (Should Cull)

**Setup:**
- Canvas: 1920x1080
- Node: world position (-2000, 0)
- Zoom: 1.0
- Pan: (0, 0)

**Expected screen position:** (-1040, 540) - far left, outside canvas

**Calculation:**
```typescript
screenX = (-2000 * 1.0) + (1920/2) + 0 = -1040 ✓
screenY = (0 * 1.0) + (1080/2) + 0 = 540 ✓
```

**Bounds check:**
```
-1040 < leftBound (-200)? YES - OUTSIDE! ✓
LOD = 3 (culled) ✓
```

---

## 6. Root Cause Analysis

### 6.1 Why This Bug Happened

1. **Misunderstanding of PIXI's coordinate system**: The developer thought PIXI nodes were positioned in screen coordinates, when they're actually in world coordinates with a stage transform applied.

2. **Incomplete transformation formula**: Only applied the scaling component (`* zoom`) but forgot the translation components (centering + panning).

3. **Comment confusion**: Line 118 says "Node position in screen space = (node.x * zoom) + stage.x" which is CORRECT, but the implementation forgot the `+ stage.x` part!

4. **Two-phase offset oversight**: Failed to recognize that `stage.x` is composed of TWO components: the static centering offset (`width/2`) and the dynamic pan offset (`transform.x`).

### 6.2 Why All Nodes Were Culled

With the broken formula:
- Most nodes have world positions in range [-500, 500]
- Broken formula gives screen positions in range [-500, 500]
- Viewport bounds with buffer are [-200, width+200]
- For a 1920px wide canvas, that's [-200, 2120]

**Initial state (no pan):**
- Nodes at small world coords (e.g., x=150) → screenX=150 → APPEARS inside bounds → NOT culled
- But as soon as user pans, transform.x becomes non-zero
- Now the ACTUAL screen position changes (e.g., screenX = 960 + 150 - 100 = 1010)
- But the broken formula still says screenX = 150
- Viewport culling thinks node is at x=150 (inside bounds) when it's actually at x=1010
- With enough panning, almost all nodes get incorrectly culled

**Why total culling:**
- If user pans significantly, the broken formula's screen positions diverge wildly from actual positions
- Nodes that are actually visible on screen appear to be outside the viewport bounds
- All nodes get LOD level 3 (culled)

---

## 7. Additional Findings

### 7.1 Viewport Bounds Are Correct

The viewport bounds calculation (lines 124-129) is CORRECT:

```typescript
const buffer = 200;
const leftBound = -buffer;
const rightBound = this.viewport.width + buffer;
const topBound = -buffer;
const bottomBound = this.viewport.height + buffer;
```

This creates a buffer zone 200px beyond the canvas edges, which is appropriate for smooth culling transitions.

### 7.2 LOD Distance Calculations Are Correct

The distance-based LOD level calculations (lines 137-167) are CORRECT. They properly use screen-space distances to determine detail levels based on distance from viewport center.

### 7.3 Viewport Reference Is Updated Correctly

The viewport is properly updated in the zoom handler (lines 859-861):

```typescript
viewportRef.current.x = transform.x;
viewportRef.current.y = transform.y;
viewportRef.current.zoom = transform.k;
```

And the LOD system is notified (lines 870-872):

```typescript
if (lodSystemRef.current) {
  lodSystemRef.current.updateViewport(viewportRef.current);
}
```

### 7.4 No Other Coordinate System Bugs Found

The rest of the coordinate system architecture is sound:
- PIXI stage initialization correctly centers at (width/2, height/2) - line 632
- Zoom handler correctly updates stage position/scale - lines 876-881
- Node positions are correctly set in world coordinates - line 1464
- D3-force simulation uses world coordinates - correct by design

---

## 8. Implementation Checklist

- [ ] Update lines 121-122 with correct transformation formula
- [ ] Update comments at lines 115-120 to document the correct coordinate system
- [ ] Test with centered viewport (no zoom, no pan)
- [ ] Test with panning in all four directions
- [ ] Test with zoom in (2x, 3x)
- [ ] Test with zoom out (0.5x, 0.25x)
- [ ] Test with combined zoom + pan
- [ ] Verify nodes near viewport edges transition smoothly (buffer zone working)
- [ ] Verify LOD levels change correctly based on distance from center
- [ ] Check performance with 1000+ nodes (all visible)
- [ ] Verify no nodes are incorrectly culled when they should be visible

---

## 9. Code Snippet: Complete Fixed Method

```typescript
getNodeLOD(node: EnhancedGraphNode): number {
  if (typeof node.x !== 'number' || typeof node.y !== 'number') return 3; // Hide if no position

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
  const screenX = (node.x * this.viewport.zoom) + (this.viewport.width / 2) + this.viewport.x;
  const screenY = (node.y * this.viewport.zoom) + (this.viewport.height / 2) + this.viewport.y;

  // Define screen bounds with buffer for smooth transitions
  const buffer = 200; // pixels buffer for smooth appearing/disappearing
  const leftBound = -buffer;
  const rightBound = this.viewport.width + buffer;
  const topBound = -buffer;
  const bottomBound = this.viewport.height + buffer;

  // Check if node is completely outside screen bounds (true viewport culling)
  if (screenX < leftBound || screenX > rightBound ||
      screenY < topBound || screenY > bottomBound) {
    return 3; // Cull completely - outside viewport
  }

  // Calculate distance from viewport center for LOD decisions
  const centerX = this.viewport.width / 2;
  const centerY = this.viewport.height / 2;
  const distanceFromCenter = Math.sqrt(
    Math.pow(screenX - centerX, 2) + Math.pow(screenY - centerY, 2)
  );

  // Performance-based LOD adjustment using screen-space distances
  let baseDistance1 = PERFORMANCE_THRESHOLDS.LOD_DISTANCE_1;
  let baseDistance2 = PERFORMANCE_THRESHOLDS.LOD_DISTANCE_2;

  // Scale LOD distances based on performance requirements
  if (this.nodeCount > PERFORMANCE_THRESHOLDS.NODE_COUNT_HIGH) {
    baseDistance1 *= 0.6;
    baseDistance2 *= 0.6;
  } else if (this.nodeCount > PERFORMANCE_THRESHOLDS.NODE_COUNT_MEDIUM) {
    baseDistance1 *= 0.8;
    baseDistance2 *= 0.8;
  }

  // Use screen-space distances for consistent LOD behavior
  const screenDiagonal = Math.sqrt(this.viewport.width * this.viewport.width + this.viewport.height * this.viewport.height);
  const normalizedDistance = distanceFromCenter / screenDiagonal;

  if (normalizedDistance > 0.8) {
    return 2; // Minimal detail - far from center
  } else if (normalizedDistance > 0.4) {
    return 1; // Reduced detail - medium distance
  } else {
    return 0; // Full detail - near center
  }
}
```

---

## 10. Conclusion

The LOD culling bug is caused by an **incomplete coordinate transformation** that only applies the zoom scaling but forgets both the centering offset and the pan offset. The fix is a simple two-line change that adds these missing components to match PIXI's stage transformation formula.

**The fix will:**
- ✅ Correctly calculate which nodes are visible in the viewport
- ✅ Prevent incorrect culling of visible nodes
- ✅ Enable proper LOD level assignment based on actual screen position
- ✅ Maintain smooth culling transitions with the buffer zone
- ✅ Work correctly with all combinations of zoom and pan

**Files to modify:**
- `/mnt/my_external_drive/programming/songnodes/frontend/src/components/GraphVisualization.tsx` (lines 121-122)

**Testing priority:** HIGH - this is a critical rendering bug that breaks the entire graph visualization.
