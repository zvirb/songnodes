# PIXI.js + D3-Zoom Coordinate System: Visual Guide

**Companion Document to:** coordinate-system-analysis-and-lod-bug-fix.md

This document provides detailed visual diagrams to understand the coordinate transformation chain.

---

## Diagram 1: The Three Coordinate Spaces

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      WORLD COORDINATES                                   │
│                    (D3-Force Simulation Space)                           │
│                                                                          │
│                          y (up = negative)                               │
│                                  ↑                                       │
│                                  │                                       │
│                        Node A    │                                       │
│                       (-200,-150)●                                       │
│                                  │                                       │
│                                  │                                       │
│         x (left)  ───────────────●─────────────────  x (right)          │
│        (negative)             (0,0)              (positive)              │
│                              Origin                                      │
│                                  │                                       │
│                                  │                                       │
│                                  │      ● Node B                         │
│                                  │    (300, 200)                         │
│                                  │                                       │
│                                  ↓                                       │
│                          y (down = positive)                             │
│                                                                          │
│  Properties:                                                             │
│  - Unbounded coordinate space                                            │
│  - Origin at (0,0) = center of force simulation                          │
│  - Typical range: -1000 to +1000 in each direction                       │
│  - Where: node.x, node.y, node.fx, node.fy                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

                                    ↓
                    PIXI Stage Transform Applied
                    (scale, translate, rotate)
                                    ↓

┌─────────────────────────────────────────────────────────────────────────┐
│                      SCREEN COORDINATES                                  │
│                       (Canvas Pixel Space)                               │
│                                                                          │
│   (0,0)                                                                  │
│     ┌───────────────────────────────────────────────────────┐           │
│     │                                                        │           │
│     │                  VISIBLE CANVAS                        │           │
│     │                                                        │           │
│     │              Node A transformed to:                    │           │
│     │              screen pos depends on                     │           │
│     │              zoom and pan!                             │           │
│     │                                                        │           │
│     │         ┌─────────────────────┐                        │           │
│     │         │                     │                        │           │
│     │         │  Viewport (what     │                        │           │
│     │         │  user sees)         │                        │           │
│     │         │         ●           │                        │           │
│     │         │      (cx, cy)       │                        │           │
│     │         │   World (0,0)       │                        │           │
│     │         │   appears here      │                        │           │
│     │         │                     │                        │           │
│     │         └─────────────────────┘                        │           │
│     │                                                        │           │
│     │                                              Node B    │           │
│     │                                        transformed ●   │           │
│     │                                                        │           │
│     └───────────────────────────────────────────────────────┘           │
│                                                          (width, height) │
│                                                                          │
│  Properties:                                                             │
│  - Bounded by canvas dimensions: [0, width] x [0, height]                │
│  - Origin at top-left corner                                             │
│  - Where: actual rendered pixels on screen                               │
│  - What: user sees and interacts with                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 2: Stage Transform Breakdown

```
PIXI Stage Properties:
┌─────────────────────────────────────────────────────────────────┐
│  stage.position: (stage.x, stage.y)                             │
│  stage.scale: (scale.x, scale.y)                                │
│  stage.rotation: angle (usually 0)                              │
└─────────────────────────────────────────────────────────────────┘

Stage Transform Formula:
┌─────────────────────────────────────────────────────────────────┐
│  screen.x = (local.x * stage.scale.x) + stage.x                 │
│  screen.y = (local.y * stage.scale.y) + stage.y                 │
└─────────────────────────────────────────────────────────────────┘

Where stage position comes from (D3-zoom handler, line 879-880):
┌─────────────────────────────────────────────────────────────────┐
│  stage.x = (viewport.width / 2) + transform.x                   │
│            └─────┬──────┘        └─────┬──────┘                 │
│          centering offset        pan offset                     │
│                                  (from D3-zoom)                  │
│                                                                 │
│  stage.y = (viewport.height / 2) + transform.y                  │
│            └──────┬───────┘        └─────┬──────┘               │
│          centering offset         pan offset                    │
│                                   (from D3-zoom)                 │
└─────────────────────────────────────────────────────────────────┘

Where stage scale comes from (D3-zoom handler, line 881):
┌─────────────────────────────────────────────────────────────────┐
│  stage.scale.set(transform.k, transform.k)                      │
│                  └────┬─────┘                                   │
│                  zoom level                                     │
│                  (from D3-zoom)                                 │
│                                                                 │
│  Examples:                                                      │
│    transform.k = 1.0  → 100% zoom (no scaling)                  │
│    transform.k = 2.0  → 200% zoom (2x larger)                   │
│    transform.k = 0.5  → 50% zoom (2x smaller)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Diagram 3: Transformation Examples

### Example 1: Initial State (No Pan, No Zoom)

```
Given:
  - Canvas: 1920 x 1080 pixels
  - Node world position: (0, 0)
  - Zoom: 1.0 (transform.k)
  - Pan: (0, 0) (transform.x, transform.y)

Step 1: Calculate stage transform
  stage.x = (1920/2) + 0 = 960
  stage.y = (1080/2) + 0 = 540
  stage.scale = 1.0

Step 2: Transform node to screen
  screen.x = (0 * 1.0) + 960 = 960
  screen.y = (0 * 1.0) + 540 = 540

Canvas visualization:
┌─────────────────────────────────────┐ (0, 0)
│                                     │
│                                     │
│                                     │
│                                     │
│                  ● (960, 540)       │
│           World origin (0,0)        │
│           at screen center          │
│                                     │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘ (1920, 1080)
```

### Example 2: Offset Node

```
Given:
  - Canvas: 1920 x 1080 pixels
  - Node world position: (300, -200)
  - Zoom: 1.0
  - Pan: (0, 0)

Step 1: Calculate stage transform
  stage.x = (1920/2) + 0 = 960
  stage.y = (1080/2) + 0 = 540
  stage.scale = 1.0

Step 2: Transform node to screen
  screen.x = (300 * 1.0) + 960 = 1260
  screen.y = (-200 * 1.0) + 540 = 340

Canvas visualization:
┌─────────────────────────────────────┐ (0, 0)
│                                     │
│                                     │
│                      ● (1260, 340)  │
│                   Node (300, -200)  │
│                                     │
│                  ● (960, 540)       │
│              Origin (0, 0)          │
│                                     │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘ (1920, 1080)

Explanation:
  - World x=300 → 300px right of origin
  - Origin is at screen x=960
  - So screen x = 960 + 300 = 1260 ✓

  - World y=-200 → 200px UP from origin (negative y = up!)
  - Origin is at screen y=540
  - So screen y = 540 - 200 = 340 ✓
```

### Example 3: User Pans Right and Down

```
Given:
  - Canvas: 1920 x 1080 pixels
  - Node world position: (0, 0)
  - Zoom: 1.0
  - Pan: (200, 150) ← User dragged RIGHT and DOWN

Step 1: Calculate stage transform
  stage.x = (1920/2) + 200 = 1160
  stage.y = (1080/2) + 150 = 690
  stage.scale = 1.0

Step 2: Transform node to screen
  screen.x = (0 * 1.0) + 1160 = 1160
  screen.y = (0 * 1.0) + 690 = 690

Canvas visualization (world origin moved):
┌─────────────────────────────────────┐ (0, 0)
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                       ● (1160, 690) │
│                    Origin (0, 0)    │
│                  moved by pan       │
│                                     │
│                                     │
└─────────────────────────────────────┘ (1920, 1080)

Explanation:
  - Positive pan.x = 200 → Origin shifts RIGHT 200px
  - Positive pan.y = 150 → Origin shifts DOWN 150px
  - New origin screen position: (960+200, 540+150) = (1160, 690) ✓
```

### Example 4: Zoomed In 2x

```
Given:
  - Canvas: 1920 x 1080 pixels
  - Node world position: (100, -50)
  - Zoom: 2.0 ← Everything 2x larger
  - Pan: (0, 0)

Step 1: Calculate stage transform
  stage.x = (1920/2) + 0 = 960
  stage.y = (1080/2) + 0 = 540
  stage.scale = 2.0

Step 2: Transform node to screen
  screen.x = (100 * 2.0) + 960 = 1160
  screen.y = (-50 * 2.0) + 540 = 440

Canvas visualization:
┌─────────────────────────────────────┐ (0, 0)
│                                     │
│                                     │
│                                     │
│                   ● (1160, 440)     │
│                Node (100, -50)      │
│                2x scaled            │
│                  ● (960, 540)       │
│              Origin (0, 0)          │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘ (1920, 1080)

Explanation:
  - World x=100, but SCALED 2x → 200px screen distance from origin
  - Origin at screen x=960 → screen x = 960 + 200 = 1160 ✓

  - World y=-50, but SCALED 2x → -100px screen distance from origin
  - Origin at screen y=540 → screen y = 540 - 100 = 440 ✓

  - At 2x zoom, world distances appear 2x larger on screen!
```

### Example 5: Complex Case (Zoom + Pan)

```
Given:
  - Canvas: 1920 x 1080 pixels
  - Node world position: (200, 100)
  - Zoom: 1.5
  - Pan: (-100, 50)

Step 1: Calculate stage transform
  stage.x = (1920/2) + (-100) = 860
  stage.y = (1080/2) + 50 = 590
  stage.scale = 1.5

Step 2: Transform node to screen
  screen.x = (200 * 1.5) + 860 = 1160
  screen.y = (100 * 1.5) + 590 = 740

Canvas visualization:
┌─────────────────────────────────────┐ (0, 0)
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│             ● (860, 590)            │
│          Origin (0, 0)              │
│          (shifted by pan)           │
│                                     │
│                      ● (1160, 740)  │
│                   Node (200, 100)   │
└─────────────────────────────────────┘ (1920, 1080)

Explanation:
  - Step 1: Apply zoom to world coords
      200 * 1.5 = 300 (screen distance from origin)
      100 * 1.5 = 150 (screen distance from origin)

  - Step 2: Add panned origin position
      origin.x = 960 - 100 = 860
      origin.y = 540 + 50 = 590

  - Step 3: Final screen position
      screen.x = 300 + 860 = 1160 ✓
      screen.y = 150 + 590 = 740 ✓
```

---

## Diagram 4: The Bug Visualization

### BROKEN Formula (Current Code)

```
❌ screenX = node.x * zoom
❌ screenY = node.y * zoom

What this calculates:
┌─────────────────────────────────────────────────────────────┐
│  Takes world coordinate and scales it                       │
│  FORGETS to add stage position offset!                      │
│  Result: "screen" position is actually WORLD position       │
│          multiplied by zoom, NOT true screen position       │
└─────────────────────────────────────────────────────────────┘

Example with pan:
  Canvas: 1920x1080
  Node: (200, 100)
  Zoom: 1.0
  Pan: (-300, 0) ← User panned LEFT

  Broken calculation:
    screenX = 200 * 1.0 = 200
    screenY = 100 * 1.0 = 100

  Actual screen position (where node REALLY appears):
    stage.x = 960 + (-300) = 660
    stage.y = 540 + 0 = 540

    realScreenX = (200 * 1.0) + 660 = 860
    realScreenY = (100 * 1.0) + 540 = 640

  Viewport bounds check (with 200px buffer):
    leftBound = -200
    rightBound = 1920 + 200 = 2120

    Is screenX (200) < leftBound (-200)? NO
    Is screenX (200) > rightBound (2120)? NO
    → Node appears to be IN BOUNDS

  But reality:
    Node is actually at screen position (860, 640)
    Node IS visible on screen
    But the broken code thinks it's at (200, 100)

  Result:
    ✓ This node survives (by luck - small coordinates)
    ✗ But nodes with larger world coords get incorrectly culled!

Critical case - node gets WRONGLY CULLED:
  Node: (-500, 0)  ← Left side of world

  Broken calculation:
    screenX = -500 * 1.0 = -500

  Is screenX (-500) < leftBound (-200)? YES!
  → NODE CULLED!

  But actual screen position:
    realScreenX = (-500 * 1.0) + 660 = 160
    → Node is VISIBLE at x=160!
    → Should NOT be culled!
    → BUG! 🐛
```

### FIXED Formula

```
✅ screenX = (node.x * zoom) + (width/2) + pan.x
✅ screenY = (node.y * zoom) + (height/2) + pan.y

What this calculates:
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Scale world coordinate by zoom                     │
│  Step 2: Add centering offset (width/2, height/2)           │
│  Step 3: Add pan offset (transform.x, transform.y)          │
│  Result: TRUE screen position, exactly what PIXI renders    │
└─────────────────────────────────────────────────────────────┘

Same example with pan:
  Canvas: 1920x1080
  Node: (200, 100)
  Zoom: 1.0
  Pan: (-300, 0)

  Fixed calculation:
    screenX = (200 * 1.0) + (1920/2) + (-300)
    screenX = 200 + 960 - 300
    screenX = 860 ✓

    screenY = (100 * 1.0) + (1080/2) + 0
    screenY = 100 + 540
    screenY = 640 ✓

  Viewport bounds check:
    Is screenX (860) in [-200, 2120]? YES ✓
    Is screenY (640) in [-200, 1280]? YES ✓
    → Node is correctly VISIBLE

Critical case - node CORRECTLY STAYS VISIBLE:
  Node: (-500, 0)

  Fixed calculation:
    screenX = (-500 * 1.0) + 960 + (-300) = 160

  Is screenX (160) < leftBound (-200)? NO
  Is screenX (160) > rightBound (2120)? NO
  → NODE VISIBLE ✓

  This matches reality:
    Node appears at screen x=160
    Node IS visible
    Correctly NOT culled ✓
```

---

## Diagram 5: Viewport Culling Logic

```
Screen space with buffer zone:
┌─────────────────────────────────────────────────────────────┐
│ Buffer (-200px)                                             │
│   ┌─────────────────────────────────────────────────┐       │
│   │                                                 │       │
│   │          ACTUAL CANVAS (0 to width)             │       │
│   │                                                 │       │
│   │                                                 │       │
│   │              Visible area                       │       │
│   │                                                 │       │
│   │                                                 │       │
│   │                                                 │       │
│   └─────────────────────────────────────────────────┘       │
│                                      Buffer (+200px)        │
└─────────────────────────────────────────────────────────────┘
    ↑                                                  ↑
leftBound = -200                           rightBound = width+200

Node visibility rules:
┌─────────────────────────────────────────────────────────────┐
│  if (screenX < -200) → CULL (left of buffer)                │
│  if (screenX > width+200) → CULL (right of buffer)          │
│  if (screenY < -200) → CULL (above buffer)                  │
│  if (screenY > height+200) → CULL (below buffer)            │
│  else → VISIBLE (within buffered viewport)                  │
└─────────────────────────────────────────────────────────────┘

Buffer zone purpose:
┌─────────────────────────────────────────────────────────────┐
│  1. Smooth transitions: Nodes don't pop in/out at edge      │
│  2. Pre-loading: Nodes just outside viewport are ready      │
│  3. Fast panning: User can pan without lag/pop-in           │
│  4. Edge safety: Accounts for node size (large nodes)       │
└─────────────────────────────────────────────────────────────┘

Example with 1920x1080 canvas:
  leftBound = -200
  rightBound = 1920 + 200 = 2120
  topBound = -200
  bottomBound = 1080 + 200 = 1280

  Total culling area: 2320px wide x 1480px tall
  Visible area: 1920px wide x 1080px tall
  Buffer adds: 200px on each side
```

---

## Diagram 6: LOD (Level of Detail) System

```
LOD Level Determination (AFTER culling check):

Step 1: Calculate distance from viewport center
┌─────────────────────────────────────────────────────────────┐
│  centerX = viewport.width / 2  (e.g., 960 for 1920px)       │
│  centerY = viewport.height / 2 (e.g., 540 for 1080px)       │
│                                                             │
│  distance = sqrt((screenX - centerX)² + (screenY - centerY)²) │
└─────────────────────────────────────────────────────────────┘

Step 2: Normalize distance by screen diagonal
┌─────────────────────────────────────────────────────────────┐
│  diagonal = sqrt(width² + height²)                          │
│  normalizedDist = distance / diagonal                       │
│                                                             │
│  Range: 0.0 (at center) to 1.414 (at corner)                │
└─────────────────────────────────────────────────────────────┘

Step 3: Assign LOD level
┌─────────────────────────────────────────────────────────────┐
│  if normalizedDist > 0.8 → LOD 2 (minimal detail)           │
│  if normalizedDist > 0.4 → LOD 1 (reduced detail)           │
│  else → LOD 0 (full detail)                                 │
└─────────────────────────────────────────────────────────────┘

Visual representation:
                Canvas (1920x1080)
┌───────────────────────────────────────────────────┐
│                                                   │
│  LOD 2 (minimal)                                  │
│   ┌───────────────────────────────────────┐       │
│   │ LOD 1 (reduced)                       │       │
│   │  ┌─────────────────────────────┐      │       │
│   │  │                             │      │       │
│   │  │  LOD 0 (full detail)        │      │       │
│   │  │         ● Center            │      │       │
│   │  │       (960, 540)            │      │       │
│   │  │                             │      │       │
│   │  └─────────────────────────────┘      │       │
│   │            40% of diagonal            │       │
│   └───────────────────────────────────────┘       │
│                  80% of diagonal                  │
└───────────────────────────────────────────────────┘

For 1920x1080:
  diagonal = sqrt(1920² + 1080²) = 2203px

  LOD 0 radius: 0.4 * 2203 = 881px
  LOD 1 radius: 0.8 * 2203 = 1762px
  Beyond LOD 1: LOD 2

LOD Level Effects (example):
┌──────────┬─────────────┬────────────┬──────────────┐
│ LOD      │ Node Size   │ Label      │ Edge Width   │
├──────────┼─────────────┼────────────┼──────────────┤
│ 0 (full) │ Full radius │ Visible    │ Full width   │
│ 1 (med)  │ Full radius │ Hidden     │ Thinner      │
│ 2 (min)  │ Smaller     │ Hidden     │ Thinnest     │
│ 3 (cull) │ Not drawn   │ Not drawn  │ Not drawn    │
└──────────┴─────────────┴────────────┴──────────────┘
```

---

## Quick Reference: Formula Cheat Sheet

```
┌─────────────────────────────────────────────────────────────┐
│                   WORLD → SCREEN                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  screenX = (worldX * zoom) + (width/2) + panX               │
│  screenY = (worldY * zoom) + (height/2) + panY              │
│                                                             │
│  Where:                                                     │
│    worldX, worldY = node.x, node.y                          │
│    zoom = transform.k (from D3-zoom)                        │
│    panX = transform.x (from D3-zoom)                        │
│    panY = transform.y (from D3-zoom)                        │
│    width, height = canvas dimensions                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   SCREEN → WORLD                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  worldX = (screenX - (width/2) - panX) / zoom               │
│  worldY = (screenY - (height/2) - panY) / zoom              │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   PIXI STAGE PROPERTIES                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  stage.x = (width/2) + transform.x                          │
│  stage.y = (height/2) + transform.y                         │
│  stage.scale.x = transform.k                                │
│  stage.scale.y = transform.k                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   VIEWPORT CULLING                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  buffer = 200 pixels                                        │
│  leftBound = -buffer                                        │
│  rightBound = width + buffer                                │
│  topBound = -buffer                                         │
│  bottomBound = height + buffer                              │
│                                                             │
│  cull if (screenX < leftBound || screenX > rightBound ||    │
│           screenY < topBound || screenY > bottomBound)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Scenarios

Use these scenarios to verify the fix works correctly:

```
Test 1: Initial load (no interaction)
  Expected: All nodes visible, centered

Test 2: Pan right (+X)
  Action: Drag canvas left (pan.x becomes positive)
  Expected: World moves right, nodes on left become visible

Test 3: Pan left (-X)
  Action: Drag canvas right (pan.x becomes negative)
  Expected: World moves left, nodes on right become visible

Test 4: Pan down (+Y)
  Action: Drag canvas up (pan.y becomes positive)
  Expected: World moves down, nodes above become visible

Test 5: Pan up (-Y)
  Action: Drag canvas down (pan.y becomes negative)
  Expected: World moves up, nodes below become visible

Test 6: Zoom in (2x)
  Action: Scroll wheel zoom in (transform.k = 2.0)
  Expected: Nodes appear 2x larger, fewer visible (viewport shows smaller area of world)

Test 7: Zoom out (0.5x)
  Action: Scroll wheel zoom out (transform.k = 0.5)
  Expected: Nodes appear 2x smaller, more visible (viewport shows larger area of world)

Test 8: Zoom + Pan combined
  Action: Zoom in, then pan around
  Expected: Smooth culling, no pop-in/pop-out artifacts

Test 9: Node at edge of buffer
  Action: Pan until a node is at screenX = width + 150 (within buffer)
  Expected: Node still visible, not culled

Test 10: Node just outside buffer
  Action: Pan until a node is at screenX = width + 250 (outside buffer)
  Expected: Node culled (invisible)
```

---

## End of Visual Guide

This visual guide should be used alongside the main analysis document to understand the complete coordinate system architecture and the LOD bug fix.
