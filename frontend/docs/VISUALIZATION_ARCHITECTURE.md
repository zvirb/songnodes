# SongNodes Visualization Architecture

**Complete Technical Documentation for the PIXI.js + D3-force + D3-zoom Graph Visualization System**

Version: 2025.1
Last Updated: 2025-10-04
Author: System Architecture Analysis

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Layer Architecture](#component-layer-architecture)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Coordinate System Architecture](#coordinate-system-architecture)
5. [Rendering Pipeline](#rendering-pipeline)
6. [Memory Management](#memory-management)
7. [Performance Optimization](#performance-optimization)
8. [Event Flow](#event-flow)
9. [Debugging Guide](#debugging-guide)

---

## 1. System Overview

### 1.1 Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    React 18.3.1 (UI Layer)                  │
├─────────────────────────────────────────────────────────────┤
│  Component Layer                                            │
│  ├─ App.tsx (root, lazy loading, routing)                  │
│  ├─ DJInterface.tsx (main UI container)                    │
│  └─ GraphVisualization.tsx (canvas integration)            │
├─────────────────────────────────────────────────────────────┤
│  State Management: Zustand 4.5.5                           │
│  ├─ useStore() - centralized state                         │
│  ├─ graph slice - nodes, edges, selections                 │
│  ├─ view slice - zoom, pan, viewport                       │
│  └─ pathfinding slice - waypoints, paths                   │
├─────────────────────────────────────────────────────────────┤
│  Rendering Engine: PIXI.js v8.5.2 (WebGL)                 │
│  ├─ Application (canvas management)                        │
│  ├─ Stage (scene graph root)                               │
│  ├─ Containers (layers: edges, nodes, labels)              │
│  ├─ Graphics (circles, lines)                              │
│  └─ Text (labels)                                           │
├─────────────────────────────────────────────────────────────┤
│  Physics Simulation: D3-force                              │
│  ├─ forceLink - edge constraints                           │
│  ├─ forceManyBody - node repulsion                         │
│  ├─ forceCenter - centering force                          │
│  └─ forceCollide - collision detection                     │
├─────────────────────────────────────────────────────────────┤
│  Interaction: D3-zoom + D3-selection                       │
│  ├─ zoom behavior - pan, zoom controls                     │
│  ├─ transform management - coordinate conversion           │
│  └─ event delegation - click, drag, wheel                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Principles

1. **Separation of Concerns**: PIXI.js handles rendering, D3-force handles physics, D3-zoom handles interaction
2. **Single Source of Truth**: Zustand store for all state, D3 transform for all coordinate conversions
3. **Performance First**: LOD system, spatial indexing, viewport culling, WebGL acceleration
4. **Zero Memory Leaks**: Explicit cleanup, ref-based tracking, ticker management

---

## 2. Component Layer Architecture

### 2.1 React Component Hierarchy

```
App.tsx (root)
│
├─ OAuthCallback.tsx (route: /callback/spotify)
│
└─ DJInterface.tsx (main interface)
    │
    ├─ Header Bar
    │   ├─ Mode Toggle (Performer/Librarian)
    │   ├─ Statistics Display
    │   └─ Control Buttons (Animation, Settings)
    │
    ├─ Main Content Area
    │   │
    │   ├─ PERFORMER MODE
    │   │   ├─ NowPlayingDeck (top)
    │   │   └─ Split Layout (bottom)
    │   │       ├─ GraphVisualization (left, 1fr)
    │   │       └─ IntelligentBrowser (right, 480px)
    │   │
    │   └─ LIBRARIAN MODE
    │       ├─ Library Browser (left, 250px)
    │       ├─ GraphVisualization (center, 1fr)
    │       └─ Right Panel Tabs (right, 350px)
    │           ├─ Track Analysis
    │           ├─ Key & Mood Panel
    │           ├─ Pathfinder
    │           ├─ Tidal Integration
    │           ├─ Spotify Integration
    │           └─ Target Tracks
    │
    └─ Modal Overlays
        ├─ TrackDetailsModal
        ├─ TrackContextMenu
        ├─ SettingsPanel
        ├─ GraphFilterPanel
        └─ PipelineMonitoringDashboard
```

### 2.2 GraphVisualization Component Structure

```
GraphVisualization.tsx
│
├─ useStore() hooks → Zustand state management
│   ├─ graphData (nodes[], edges[])
│   ├─ viewState (zoom, pan, selectedNodes, hoveredNode)
│   ├─ pathfindingState (waypoints, currentPath)
│   └─ performance (metrics, FPS)
│
├─ React refs (persistent across renders)
│   ├─ containerRef → HTMLDivElement (mount point)
│   ├─ pixiAppRef → PIXI.Application instance
│   ├─ simulationRef → D3 force simulation
│   ├─ zoomBehaviorRef → D3 zoom behavior
│   ├─ currentTransformRef → D3 ZoomTransform
│   ├─ enhancedNodesRef → Map<id, EnhancedGraphNode>
│   ├─ enhancedEdgesRef → Map<id, EnhancedGraphEdge>
│   ├─ lodSystemRef → LODSystem instance
│   ├─ spatialIndexRef → SpatialIndex instance
│   └─ performanceMonitorRef → PerformanceMonitor
│
├─ PIXI Container refs
│   ├─ edgesContainerRef → PIXI.Container (layer 1)
│   ├─ nodesContainerRef → PIXI.Container (layer 2)
│   ├─ labelsContainerRef → PIXI.Container (layer 3)
│   └─ interactionContainerRef → PIXI.Container (layer 4)
│
└─ Animation state
    ├─ isSimulationPaused (React state)
    ├─ isSimulationPausedRef (ref for closures)
    ├─ animationStateRef (isActive, startTime, duration, trigger)
    └─ frameRef (current frame counter)
```

### 2.3 PIXI.js Stage Hierarchy

```
PIXI.Application
└─ stage (PIXI.Container)
    │
    ├─ position: (width/2, height/2) [CENTERED]
    ├─ scale: controlled by D3 zoom (ZoomTransform.k)
    └─ children:
        │
        ├─ [0] background (PIXI.Graphics)
        │       ├─ rect(-width/2, -height/2, width, height)
        │       └─ fill(0x1a1a1a)
        │
        ├─ [1] edgesContainer (PIXI.Container)
        │       └─ children: PIXI.Graphics[] (one per edge)
        │
        ├─ [2] nodesContainer (PIXI.Container)
        │       └─ children: PIXI.Container[] (one per node)
        │           ├─ hitArea: PIXI.Circle (extended for zoom)
        │           ├─ eventMode: 'static'
        │           └─ children:
        │               ├─ [0] circle (PIXI.Graphics)
        │               ├─ [1] artistLabel (PIXI.Text)
        │               └─ [2] titleLabel (PIXI.Text)
        │
        ├─ [3] labelsContainer (PIXI.Container)
        │       └─ (reserved for future use)
        │
        └─ [4] interactionContainer (PIXI.Container)
                └─ (reserved for UI overlays)
```

---

## 3. Data Flow Architecture

### 3.1 Complete Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: API DATA LOADING                                               │
└─────────────────────────────────────────────────────────────────────────┘

useDataLoader.ts (React hook)
│
├─ fetch('/api/graph/nodes?limit=500')
│   └─ Returns: { nodes: [...] }
│
├─ fetch('/api/graph/edges?limit=5000')
│   └─ Returns: { edges: [...] }
│
└─ Transform raw API data → GraphNode[] & GraphEdge[]
    │
    ├─ nodeToTrack() helper
    │   └─ Creates Track object with safe defaults
    │
    └─ Filter edges (only include if both nodes exist)

                            ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: ZUSTAND STATE UPDATE                                           │
└─────────────────────────────────────────────────────────────────────────┘

useStore().graph.setGraphData({ nodes, edges })
│
└─ Updates graphData slice
    ├─ graphData.nodes: GraphNode[]
    └─ graphData.edges: GraphEdge[]

                            ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: REACT RE-RENDER (GraphVisualization.tsx)                      │
└─────────────────────────────────────────────────────────────────────────┘

useEffect(() => { ... }, [graphData.nodes, graphData.edges])
│
└─ Detects graphData change → triggers updateGraphData()

                            ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: ENHANCED NODE/EDGE CREATION                                    │
└─────────────────────────────────────────────────────────────────────────┘

updateGraphData()
│
├─ Create EnhancedGraphNode[] from GraphNode[]
│   │
│   └─ createEnhancedNode(node)
│       ├─ Adds D3 simulation properties: x, y, vx, vy, fx, fy
│       ├─ Adds PIXI references: pixiNode, pixiCircle, pixiLabel
│       ├─ Adds LOD properties: lodLevel, lastUpdateFrame, isVisible
│       └─ Adds zoom-aware hitBoxRadius
│
├─ Create EnhancedGraphEdge[] from GraphEdge[]
│   │
│   └─ createEnhancedEdge(edge, nodesMap)
│       ├─ Resolves source/target string IDs → EnhancedGraphNode refs
│       ├─ Adds PIXI references: pixiEdge
│       ├─ Adds LOD properties: lodLevel, lastUpdateFrame, isVisible
│       └─ Skips edge if source or target node missing
│
└─ Store in refs
    ├─ enhancedNodesRef.current = Map<id, EnhancedGraphNode>
    └─ enhancedEdgesRef.current = Map<id, EnhancedGraphEdge>

                            ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: PIXI SPRITE CREATION                                           │
└─────────────────────────────────────────────────────────────────────────┘

For each EnhancedGraphNode:
│
└─ createPixiNode(node)
    │
    ├─ Create PIXI.Container (parent)
    │   ├─ eventMode: 'static'
    │   ├─ cursor: 'pointer'
    │   └─ hitArea: PIXI.Circle(0, 0, hitBoxRadius)
    │
    ├─ Create PIXI.Graphics (circle)
    │   ├─ circle(0, 0, radius)
    │   ├─ fill(color)
    │   └─ eventMode: 'none' (let parent handle events)
    │
    ├─ Create PIXI.Text (artistLabel)
    │   ├─ anchor: (0.5, 1) [bottom-center]
    │   ├─ visible: false (shows on hover/LOD)
    │   └─ eventMode: 'none'
    │
    ├─ Create PIXI.Text (titleLabel)
    │   ├─ anchor: (0.5, 0) [top-center]
    │   ├─ visible: false (shows on hover/LOD)
    │   └─ eventMode: 'none'
    │
    ├─ Attach event handlers to container
    │   ├─ pointerdown → track drag start
    │   ├─ pointerup → processNodeClick (if not drag)
    │   ├─ pointermove → detect drag distance
    │   ├─ pointerenter → setHoveredNode, visual feedback
    │   ├─ pointerleave → clear hover, reset visuals
    │   └─ rightdown → trigger context menu
    │
    ├─ Store references in node
    │   ├─ node.pixiNode = container
    │   ├─ node.pixiCircle = circle
    │   ├─ node.pixiLabel = titleLabel
    │   └─ node.pixiArtistLabel = artistLabel
    │
    └─ Add to nodesContainer
        └─ nodesContainerRef.current.addChild(container)

For each EnhancedGraphEdge:
│
└─ createPixiEdge(edge)
    │
    ├─ Create PIXI.Graphics (line)
    │   ├─ moveTo(sourceX, sourceY)
    │   ├─ lineTo(targetX, targetY)
    │   ├─ setStrokeStyle({ width, color, alpha })
    │   └─ stroke()
    │
    ├─ Store reference in edge
    │   └─ edge.pixiEdge = graphics
    │
    └─ Add to edgesContainer
        └─ edgesContainerRef.current.addChild(graphics)

                            ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 6: D3 FORCE SIMULATION INITIALIZATION                             │
└─────────────────────────────────────────────────────────────────────────┘

initializeSimulation()
│
├─ Create forceSimulation<EnhancedGraphNode, EnhancedGraphEdge>()
│
├─ Configure forces
│   ├─ forceLink
│   │   ├─ id: d => d.id
│   │   ├─ distance: 150
│   │   └─ strength: 0.3
│   │
│   ├─ forceManyBody (repulsion)
│   │   ├─ strength: -800
│   │   ├─ distanceMax: 800
│   │   └─ distanceMin: 30
│   │
│   ├─ forceCenter (centering)
│   │   ├─ center: (0, 0) [world coordinates]
│   │   └─ strength: 0.05
│   │
│   └─ forceCollide (collision)
│       ├─ radius: d => d.radius + 20
│       ├─ strength: 0.8
│       └─ iterations: 3
│
├─ Set simulation parameters
│   ├─ velocityDecay: 0.4 (friction)
│   ├─ alphaDecay: 0.0228 (cooling rate)
│   └─ alphaMin: 0.001 (stopping threshold)
│
├─ Register event handlers
│   ├─ on('tick') → handleSimulationTick()
│   └─ on('end') → handleSimulationEnd()
│
└─ Load data into simulation
    ├─ simulation.nodes(enhancedNodesArray)
    └─ simulation.force('link').links(enhancedEdgesArray)

                            ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 7: LAYOUT PRE-COMPUTATION (OPTIONAL)                              │
└─────────────────────────────────────────────────────────────────────────┘

preComputeLayout(nodes, maxTicks = 300)
│
├─ Create temporary simulation with identical parameters
├─ simulation.stop() → prevent automatic ticking
├─ Manual tick loop:
│   └─ while (alpha > alphaMin && ticks < maxTicks)
│       └─ simulation.tick()
│
└─ Return computed positions: { id, x, y }[]

                            ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 8: D3 ZOOM INITIALIZATION                                         │
└─────────────────────────────────────────────────────────────────────────┘

initializeZoom()
│
├─ Create zoom<HTMLDivElement, unknown>()
│   ├─ scaleExtent: [0.1, 5.0]
│   ├─ filter: allow wheel & drag (block right-click)
│   └─ wheelDelta: normalize for consistent zoom speed
│
├─ Register zoom handler
│   └─ on('zoom', (event) => {
│       ├─ Extract ZoomTransform: { x, y, k }
│       ├─ Update currentTransformRef
│       ├─ Update viewportRef
│       ├─ Update Zustand store
│       ├─ Update LOD system
│       ├─ Apply transform to PIXI stage
│       │   ├─ stage.x = centerX + transform.x
│       │   ├─ stage.y = centerY + transform.y
│       │   └─ stage.scale.set(transform.k)
│       └─ Update node hitBoxRadius for all nodes
│   })
│
├─ Attach to containerRef
│   └─ select(containerRef.current).call(zoomHandler)
│
└─ Set initial transform (from saved state)
    └─ zoomIdentity.translate(pan.x, pan.y).scale(zoom)

                            ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 9: ANIMATION LOOP (PIXI TICKER)                                   │
└─────────────────────────────────────────────────────────────────────────┘

app.ticker.add(renderFrame)
│
└─ Every frame (60 FPS target):
    │
    ├─ Check if simulation paused
    │   └─ If paused: still render (show frozen positions)
    │
    ├─ Update performance metrics
    │   └─ performanceMonitorRef.current.update()
    │
    ├─ For each EnhancedGraphNode:
    │   ├─ Calculate LOD level
    │   │   └─ lodSystemRef.current.getNodeLOD(node)
    │   │       ├─ Transform world → screen coordinates
    │   │       ├─ Check viewport culling (LOD 3 if outside)
    │   │       ├─ Calculate distance from viewport center
    │   │       └─ Return LOD: 0 (full), 1 (reduced), 2 (minimal), 3 (culled)
    │   │
    │   ├─ Update visibility
    │   │   └─ node.pixiNode.visible = (lodLevel < 3)
    │   │
    │   ├─ Update position
    │   │   ├─ node.pixiNode.x = node.x
    │   │   └─ node.pixiNode.y = node.y
    │   │
    │   ├─ Update visual properties by LOD
    │   │   ├─ LOD 0: full detail (circle + labels visible)
    │   │   ├─ LOD 1: reduced (circle only, no labels)
    │   │   ├─ LOD 2: minimal (small circle, no labels)
    │   │   └─ LOD 3: culled (pixiNode.visible = false)
    │   │
    │   └─ Update color based on selection state
    │       └─ getNodeColor(node)
    │
    └─ For each EnhancedGraphEdge:
        ├─ Calculate LOD level
        │   └─ lodSystemRef.current.getEdgeLOD(edge)
        │
        ├─ Update visibility
        │   └─ edge.pixiEdge.visible = (lodLevel < 3)
        │
        ├─ Update geometry
        │   ├─ sourceX = edge.source.x
        │   ├─ sourceY = edge.source.y
        │   ├─ targetX = edge.target.x
        │   ├─ targetY = edge.target.y
        │   ├─ clear()
        │   ├─ moveTo(sourceX, sourceY)
        │   ├─ lineTo(targetX, targetY)
        │   └─ stroke()
        │
        └─ Update color based on path/selection
            └─ getEdgeColor(edge)
```

### 3.2 EnhancedNode & EnhancedEdge Data Structures

```typescript
// EnhancedGraphNode: Combines GraphNode + D3 SimulationNodeDatum + PIXI refs
interface EnhancedGraphNode extends GraphNode, SimulationNodeDatum {
  // From GraphNode (API data)
  id: string;
  label: string;
  track?: Track;
  type?: 'track' | 'artist' | 'album';

  // From SimulationNodeDatum (D3-force)
  x?: number;          // World X coordinate
  y?: number;          // World Y coordinate
  vx?: number;         // X velocity
  vy?: number;         // Y velocity
  fx?: number | null;  // Fixed X (for pinning)
  fy?: number | null;  // Fixed Y (for pinning)

  // PIXI.js rendering references
  pixiNode?: PIXI.Container;     // Parent container
  pixiCircle?: PIXI.Graphics;    // Circle shape
  pixiLabel?: PIXI.Text;         // Title text
  pixiArtistLabel?: PIXI.Text;   // Artist text (custom)

  // LOD (Level of Detail) system
  lodLevel: number;          // 0=full, 1=reduced, 2=minimal, 3=culled
  lastUpdateFrame: number;   // Last frame this node was updated
  isVisible: boolean;        // Viewport culling result

  // Rendering properties
  screenRadius: number;      // Visual circle radius
  hitBoxRadius: number;      // Extended hit area (zoom-aware)
}

// EnhancedGraphEdge: Combines GraphEdge + D3 SimulationLinkDatum + PIXI refs
interface EnhancedGraphEdge extends Omit<GraphEdge, 'source' | 'target'>,
                                    SimulationLinkDatum<EnhancedGraphNode> {
  // From GraphEdge (API data)
  id: string;
  weight: number;
  type: 'adjacency' | 'similarity' | 'collaboration' | 'genre' | 'key_compatibility';

  // From SimulationLinkDatum (D3-force)
  source: EnhancedGraphNode;  // Source node reference (not string!)
  target: EnhancedGraphNode;  // Target node reference (not string!)

  // PIXI.js rendering reference
  pixiEdge?: PIXI.Graphics;   // Line graphic

  // Additional node references for convenience
  sourceNode?: EnhancedGraphNode;
  targetNode?: EnhancedGraphNode;

  // LOD (Level of Detail) system
  lodLevel: number;          // 0=full, 1=reduced, 2=minimal, 3=culled
  lastUpdateFrame: number;   // Last frame this edge was updated
  isVisible: boolean;        // Viewport culling result

  // Rendering properties
  screenWidth: number;       // Line width in pixels
}
```

---

## 4. Coordinate System Architecture

### 4.1 Three Coordinate Spaces

The system uses **three distinct coordinate spaces**. Understanding these is critical for debugging positioning issues.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ COORDINATE SPACE 1: WORLD SPACE (D3 Simulation)                        │
└─────────────────────────────────────────────────────────────────────────┘

Origin: (0, 0) at the conceptual "center" of the graph
Units: Abstract world units (not pixels)
Range: Typically -1000 to +1000 in each axis (depends on forces)

Properties:
  - node.x, node.y are in world space
  - D3 forces operate in world space
  - forceCenter(0, 0) centers nodes around world origin

Example:
  Node A: { x: 100, y: -50 }  → 100 units right, 50 units up from world origin
  Node B: { x: -200, y: 150 } → 200 units left, 150 units down from world origin

┌─────────────────────────────────────────────────────────────────────────┐
│ COORDINATE SPACE 2: STAGE SPACE (PIXI.js Local Coordinates)            │
└─────────────────────────────────────────────────────────────────────────┘

Origin: (0, 0) at the PIXI stage's local origin
Units: Pixels (before scale)
Range: Same as world space (stage is aligned with world space)

Stage Transform:
  stage.position.x = canvasWidth / 2  + pan.x
  stage.position.y = canvasHeight / 2 + pan.y
  stage.scale.x = zoom
  stage.scale.y = zoom

Properties:
  - Stage local coordinates = world coordinates (they're the same!)
  - Node containers are positioned at (node.x, node.y) in stage space
  - pixiNode.x = node.x (direct mapping)
  - pixiNode.y = node.y (direct mapping)

Example (canvas 800x600, zoom=1.0, pan=(0,0)):
  stage.position = (400, 300)  ← Centers stage at canvas center
  Node A at world (100, -50):
    ├─ pixiNode.position = (100, -50) in stage local coordinates
    └─ Renders at canvas (400 + 100, 300 + (-50)) = (500, 250)

┌─────────────────────────────────────────────────────────────────────────┐
│ COORDINATE SPACE 3: CANVAS SPACE (Screen Pixels)                       │
└─────────────────────────────────────────────────────────────────────────┘

Origin: (0, 0) at top-left corner of canvas element
Units: Screen pixels
Range: 0 to canvasWidth, 0 to canvasHeight

Transform: World → Canvas
  canvasX = (worldX * zoom) + (canvasWidth/2) + pan.x
  canvasY = (worldY * zoom) + (canvasHeight/2) + pan.y

Inverse Transform: Canvas → World
  worldX = (canvasX - (canvasWidth/2) - pan.x) / zoom
  worldY = (canvasY - (canvasHeight/2) - pan.y) / zoom

Example (canvas 800x600, zoom=2.0, pan=(50, -30)):
  Node at world (100, -50):
    canvasX = (100 * 2.0) + (800/2) + 50 = 200 + 400 + 50 = 650
    canvasY = (-50 * 2.0) + (600/2) + (-30) = -100 + 300 - 30 = 170
    ├─ Screen position: (650px, 170px) from top-left
    └─ Visual size: node.radius * 2.0 = larger when zoomed in
```

### 4.2 Coordinate System Diagram

```
CANVAS SPACE (Screen Pixels)
┌─────────────────────────────────────────────────────────────────┐
│ (0,0) ← Top-left corner                                         │
│                                                                  │
│             VIEWPORT (visible area)                             │
│      ┌──────────────────────────────────────────┐              │
│      │                                           │              │
│      │        STAGE SPACE (transformed)          │              │
│      │   Origin: stage.position = (cx, cy)      │              │
│      │   Scale: stage.scale = (zoom, zoom)      │              │
│      │                                           │              │
│      │   WORLD SPACE (D3 simulation)            │              │
│      │   ┌───────────────────────────┐          │              │
│      │   │                            │          │              │
│      │   │   Origin: (0,0) ← center  │          │              │
│      │   │                            │          │              │
│      │   │   ● Node A (100, -50)     │          │              │
│      │   │                            │          │              │
│      │   │           ○ (0,0)          │          │              │
│      │   │                            │          │              │
│      │   │                 ● Node B   │          │              │
│      │   │              (-200, 150)   │          │              │
│      │   │                            │          │              │
│      │   └───────────────────────────┘          │              │
│      │                                           │              │
│      └──────────────────────────────────────────┘              │
│                                                                  │
│                                                 (width, height) │
└─────────────────────────────────────────────────────────────────┘

COORDINATE TRANSFORMS:

1. D3 Simulation → PIXI Stage (DIRECT MAPPING):
   pixiNode.x = node.x  (no transform needed!)
   pixiNode.y = node.y

2. PIXI Stage → Canvas (via stage transform):
   canvasX = (pixiNode.x * stage.scale.x) + stage.position.x
   canvasY = (pixiNode.y * stage.scale.y) + stage.position.y

   Where:
     stage.position.x = (canvasWidth / 2) + pan.x
     stage.position.y = (canvasHeight / 2) + pan.y
     stage.scale.x = zoom
     stage.scale.y = zoom

3. Combined Transform (World → Canvas):
   canvasX = (node.x * zoom) + (canvasWidth / 2) + pan.x
   canvasY = (node.y * zoom) + (canvasHeight / 2) + pan.y

4. Inverse Transform (Canvas → World) for click detection:
   worldX = (canvasX - (canvasWidth / 2) - pan.x) / zoom
   worldY = (canvasY - (canvasHeight / 2) - pan.y) / zoom
```

### 4.3 Zoom and Pan Behavior

```typescript
// D3 zoom handler (in initializeZoom)
zoomHandler.on('zoom', (event) => {
  const transform: ZoomTransform = event.transform;
  // transform.x = pan X offset
  // transform.y = pan Y offset
  // transform.k = zoom scale

  // Update PIXI stage to match D3 transform
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  pixiApp.stage.x = centerX + transform.x;  // Center + pan offset
  pixiApp.stage.y = centerY + transform.y;
  pixiApp.stage.scale.set(transform.k);     // Uniform zoom
});

// Effect of zoom on rendering:
// - Node visual size: radius * zoom (appears larger when zoomed in)
// - Node hit area: must scale inversely to maintain constant screen size
//   hitBoxRadius = max(baseRadius + 10, minScreenSize / zoom)
// - Labels: scale with zoom (readability at different levels)
// - Edge width: typically constant (or slight scale)
```

---

## 5. Rendering Pipeline

### 5.1 Frame-by-Frame Rendering Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ EVERY FRAME (60 FPS via PIXI.ticker)                                   │
└─────────────────────────────────────────────────────────────────────────┘

renderFrame() called by app.ticker
│
├─ [1] CHECK PAUSE STATE
│   └─ If paused: still render current positions, skip force updates
│
├─ [2] UPDATE PERFORMANCE METRICS
│   ├─ Calculate FPS
│   ├─ Track frame time
│   └─ Determine if optimization needed
│
├─ [3] UPDATE LOD SYSTEM
│   └─ lodSystem.updateViewport(viewportRef.current)
│
├─ [4] FOR EACH NODE:
│   │
│   ├─ Calculate LOD level
│   │   ├─ Transform world → screen coords
│   │   ├─ Check viewport bounds (cull if outside + buffer)
│   │   ├─ Calculate distance from viewport center
│   │   └─ Determine detail level:
│   │       ├─ LOD 0: Full detail (center of view, < 40% diagonal)
│   │       ├─ LOD 1: Reduced (medium distance, 40-80% diagonal)
│   │       ├─ LOD 2: Minimal (far from center, > 80% diagonal)
│   │       └─ LOD 3: Culled (outside viewport + buffer)
│   │
│   ├─ Update visibility
│   │   └─ node.pixiNode.visible = (node.lodLevel < 3)
│   │
│   ├─ Update position (world coords)
│   │   ├─ node.pixiNode.x = node.x
│   │   └─ node.pixiNode.y = node.y
│   │
│   ├─ Update visuals by LOD
│   │   ├─ Circle color (selection/hover/path states)
│   │   ├─ Circle size (may scale by LOD)
│   │   ├─ Labels visibility:
│   │   │   ├─ LOD 0: artistLabel.visible = true, titleLabel.visible = true
│   │   │   ├─ LOD 1: artistLabel.visible = false, titleLabel.visible = false
│   │   │   ├─ LOD 2: artistLabel.visible = false, titleLabel.visible = false
│   │   │   └─ LOD 3: (container not visible)
│   │   │
│   │   └─ Label positions (relative to circle):
│   │       ├─ artistLabel.y = -(radius + 5)  // Above circle
│   │       └─ titleLabel.y = radius + 5      // Below circle
│   │
│   └─ Update selection visuals
│       ├─ If selected: tint = COLOR_SCHEMES.node.selected
│       ├─ If in path: tint = COLOR_SCHEMES.node.path
│       ├─ If waypoint: tint = COLOR_SCHEMES.node.waypoint
│       ├─ If hovered: tint = COLOR_SCHEMES.node.hovered
│       └─ Else: tint = COLOR_SCHEMES.node.default
│
├─ [5] FOR EACH EDGE:
│   │
│   ├─ Calculate LOD level (based on source & target node LODs)
│   │   └─ edgeLOD = min(sourceLOD, targetLOD)
│   │       └─ If either node culled, check if edge crosses viewport
│   │
│   ├─ Update visibility
│   │   └─ edge.pixiEdge.visible = (edge.lodLevel < 3)
│   │
│   ├─ Update geometry
│   │   ├─ sourceX = edge.source.x (world coords)
│   │   ├─ sourceY = edge.source.y
│   │   ├─ targetX = edge.target.x
│   │   ├─ targetY = edge.target.y
│   │   ├─ edge.pixiEdge.clear()
│   │   ├─ edge.pixiEdge.moveTo(sourceX, sourceY)
│   │   ├─ edge.pixiEdge.lineTo(targetX, targetY)
│   │   └─ edge.pixiEdge.stroke()
│   │
│   └─ Update style
│       ├─ If in path: color = COLOR_SCHEMES.edge.path, width = 3
│       ├─ If strong edge (weight > 0.7): color = COLOR_SCHEMES.edge.strong
│       ├─ Else: color = COLOR_SCHEMES.edge.default
│       └─ Apply by LOD:
│           ├─ LOD 0: Full width
│           ├─ LOD 1: Reduced width
│           └─ LOD 2: Minimal width
│
├─ [6] SPATIAL INDEX UPDATE (if needed)
│   └─ spatialIndex.rebuild(nodes) every N frames
│
└─ [7] RENDER
    └─ PIXI.Application automatically renders at end of ticker callback
```

### 5.2 LOD (Level of Detail) System

```
┌─────────────────────────────────────────────────────────────────────────┐
│ LOD LEVEL DETERMINATION                                                │
└─────────────────────────────────────────────────────────────────────────┘

class LODSystem {
  getNodeLOD(node): number {
    // Step 1: Transform to screen coordinates
    screenX = node.x * zoom
    screenY = node.y * zoom

    // Step 2: Viewport culling (with buffer)
    buffer = 200px
    if (screenX < -buffer || screenX > width + buffer ||
        screenY < -buffer || screenY > height + buffer) {
      return 3; // CULLED - completely outside viewport
    }

    // Step 3: Calculate distance from viewport center
    centerX = width / 2
    centerY = height / 2
    distanceFromCenter = sqrt((screenX - centerX)² + (screenY - centerY)²)

    // Step 4: Normalize distance (0.0 to ~1.4 for diagonal)
    screenDiagonal = sqrt(width² + height²)
    normalizedDistance = distanceFromCenter / screenDiagonal

    // Step 5: Determine LOD based on normalized distance
    if (normalizedDistance > 0.8) {
      return 2; // MINIMAL - far from center
    } else if (normalizedDistance > 0.4) {
      return 1; // REDUCED - medium distance
    } else {
      return 0; // FULL - near center
    }
  }

  getEdgeLOD(edge): number {
    sourceLOD = getNodeLOD(edge.sourceNode)
    targetLOD = getNodeLOD(edge.targetNode)

    // If both nodes culled, cull edge
    if (sourceLOD === 3 && targetLOD === 3) {
      return 3;
    }

    // Edge LOD is the best (lowest) of its nodes
    return min(sourceLOD, targetLOD);
  }
}

┌─────────────────────────────────────────────────────────────────────────┐
│ LOD VISUAL PROPERTIES                                                  │
└─────────────────────────────────────────────────────────────────────────┘

LOD Level 0 (Full Detail):
  ├─ Circle: Full size, full color
  ├─ Title Label: VISIBLE
  ├─ Artist Label: VISIBLE
  └─ Interaction: Full hit area

LOD Level 1 (Reduced Detail):
  ├─ Circle: Full size, full color
  ├─ Title Label: HIDDEN
  ├─ Artist Label: HIDDEN
  └─ Interaction: Full hit area

LOD Level 2 (Minimal Detail):
  ├─ Circle: Slightly smaller, full color
  ├─ Title Label: HIDDEN
  ├─ Artist Label: HIDDEN
  └─ Interaction: Full hit area

LOD Level 3 (Culled):
  ├─ Container: visible = false
  ├─ No rendering
  └─ No interaction
```

---

## 6. Memory Management

### 6.1 Cleanup Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ REACT COMPONENT LIFECYCLE                                              │
└─────────────────────────────────────────────────────────────────────────┘

GraphVisualization Component Mount:
│
├─ useEffect(() => { initializePixi() }, [])
│   └─ Creates PIXI.Application, D3 simulation, D3 zoom
│
└─ useEffect(() => { return cleanup }, [])
    └─ CLEANUP FUNCTION (runs on unmount):
        │
        ├─ [1] Stop animation timers
        │   ├─ clearTimeout(animationTimerRef.current)
        │   ├─ clearInterval(uiTimerRef.current)
        │   ├─ clearInterval(performanceTimerRef.current)
        │   └─ clearTimeout(throttledFrameUpdate.current)
        │
        ├─ [2] Stop D3 simulation
        │   ├─ simulationRef.current.stop()
        │   ├─ simulationRef.current.on('tick', null)
        │   └─ simulationRef.current.on('end', null)
        │
        ├─ [3] Remove D3 zoom handlers
        │   └─ select(containerRef.current).on('.zoom', null)
        │
        ├─ [4] Destroy PIXI objects (CRITICAL!)
        │   │
        │   ├─ For each node:
        │   │   ├─ node.pixiLabel?.destroy({ children: true })
        │   │   ├─ node.pixiArtistLabel?.destroy({ children: true })
        │   │   ├─ node.pixiCircle?.destroy({ children: true })
        │   │   ├─ node.pixiNode?.destroy({ children: true })
        │   │   └─ Clear references: node.pixiNode = undefined, etc.
        │   │
        │   ├─ For each edge:
        │   │   ├─ edge.pixiEdge?.destroy({ children: true })
        │   │   └─ edge.pixiEdge = undefined
        │   │
        │   ├─ Destroy containers:
        │   │   ├─ edgesContainer?.destroy({ children: true })
        │   │   ├─ nodesContainer?.destroy({ children: true })
        │   │   ├─ labelsContainer?.destroy({ children: true })
        │   │   └─ interactionContainer?.destroy({ children: true })
        │   │
        │   └─ Destroy PIXI app:
        │       ├─ app.ticker.remove(renderFrame)
        │       ├─ app.stage.destroy({ children: true, texture: true })
        │       ├─ app.renderer.destroy(true) // ← Frees WebGL context
        │       └─ app.destroy(true, { children: true, texture: true })
        │
        ├─ [5] Clear data structures
        │   ├─ enhancedNodesRef.current.clear()
        │   ├─ enhancedEdgesRef.current.clear()
        │   └─ spatialIndexRef.current.clear()
        │
        └─ [6] Remove global debug references
            ├─ delete window.pixiApp
            ├─ delete window.__PIXI_APP__
            ├─ delete window.enhancedNodesRef
            └─ delete window.toggleSimulation
```

### 6.2 Memory Leak Prevention Checklist

```
✅ REQUIRED CLEANUP ACTIONS:

1. PIXI.js Objects:
   □ Destroy all Graphics objects
   □ Destroy all Text objects
   □ Destroy all Containers
   □ Remove all children before destroying parents
   □ Pass { children: true, texture: true, baseTexture: true } to destroy()
   □ Destroy renderer with destroy(true) to free WebGL context

2. D3 Objects:
   □ Call simulation.stop()
   □ Remove all simulation event listeners
   □ Remove all zoom event listeners with .on('.zoom', null)

3. Timers & Intervals:
   □ Clear all setTimeout() timers
   □ Clear all setInterval() intervals
   □ Clear all requestAnimationFrame() handles

4. Event Listeners:
   □ Remove all DOM event listeners (keydown, resize, etc.)
   □ Remove PIXI event listeners (pointerdown, pointerup, etc.)

5. References:
   □ Set all refs to null (pixiAppRef.current = null)
   □ Clear all Maps and Sets
   □ Remove global window references

6. WebGL Context:
   □ Call renderer.destroy(true) to release WebGL context
   □ Check browser DevTools for WebGL context leaks
```

---

## 7. Performance Optimization

### 7.1 Performance Systems

```
┌─────────────────────────────────────────────────────────────────────────┐
│ OPTIMIZATION LAYER 1: VIEWPORT CULLING                                 │
└─────────────────────────────────────────────────────────────────────────┘

Goal: Don't render objects outside the visible viewport

Implementation:
  ├─ LODSystem.getNodeLOD() checks screen bounds
  ├─ Returns LOD 3 (culled) if node is outside viewport + buffer
  └─ node.pixiNode.visible = false for culled nodes

Performance Impact:
  ├─ Typical culling rate: 60-80% of nodes when zoomed in
  ├─ Saves GPU draw calls
  └─ Reduces CPU transform calculations

┌─────────────────────────────────────────────────────────────────────────┐
│ OPTIMIZATION LAYER 2: LEVEL OF DETAIL (LOD)                            │
└─────────────────────────────────────────────────────────────────────────┘

Goal: Reduce visual complexity for distant objects

Implementation:
  ├─ Calculate normalized distance from viewport center
  ├─ Assign LOD level based on distance:
  │   ├─ LOD 0: 0-40% of diagonal (full detail)
  │   ├─ LOD 1: 40-80% of diagonal (reduced)
  │   └─ LOD 2: 80%+ of diagonal (minimal)
  │
  └─ Adjust visuals per LOD:
      ├─ Hide labels for LOD 1+
      ├─ Reduce circle size for LOD 2
      └─ Reduce edge width for LOD 1+

Performance Impact:
  ├─ Reduces text rendering overhead (50-70% of GPU time)
  ├─ Fewer draw calls for complex objects
  └─ Maintains 60 FPS with 1000+ nodes

┌─────────────────────────────────────────────────────────────────────────┐
│ OPTIMIZATION LAYER 3: SPATIAL INDEXING                                 │
└─────────────────────────────────────────────────────────────────────────┘

Goal: Fast nearest neighbor queries for interaction

Implementation:
  ├─ Grid-based spatial hash (100px cells)
  ├─ Rebuild every N frames or on major layout change
  └─ Used for:
      ├─ Node click detection
      ├─ Hover detection
      └─ Collision detection

Performance Impact:
  ├─ O(1) average case for click detection
  ├─ O(n) worst case vs O(n²) brute force
  └─ Negligible memory overhead

┌─────────────────────────────────────────────────────────────────────────┐
│ OPTIMIZATION LAYER 4: WEBGL ACCELERATION                               │
└─────────────────────────────────────────────────────────────────────────┘

Goal: Leverage GPU for rendering

Implementation:
  ├─ PIXI.js uses WebGL renderer by default
  ├─ All nodes/edges rendered as GPU primitives
  └─ Batched draw calls where possible

Performance Impact:
  ├─ 10-100x faster than Canvas 2D for large graphs
  ├─ Handles 5000+ nodes at 60 FPS
  └─ Smooth zoom/pan even with complex scenes

┌─────────────────────────────────────────────────────────────────────────┐
│ OPTIMIZATION LAYER 5: FRAME THROTTLING                                 │
└─────────────────────────────────────────────────────────────────────────┘

Goal: Prevent excessive re-renders from React

Implementation:
  ├─ Use refs instead of state where possible
  ├─ Throttle state updates with setTimeout (16ms = ~60fps)
  ├─ PIXI ticker runs independently of React renders
  └─ Only trigger React re-render when absolutely necessary

Performance Impact:
  ├─ Decouples rendering from React component lifecycle
  ├─ Prevents "cascade re-renders"
  └─ Smooth animation even during React updates

┌─────────────────────────────────────────────────────────────────────────┐
│ OPTIMIZATION LAYER 6: D3 SIMULATION TUNING                             │
└─────────────────────────────────────────────────────────────────────────┘

Goal: Balance layout quality with performance

Parameters:
  ├─ velocityDecay: 0.4 (moderate friction)
  ├─ alphaDecay: 0.0228 (standard cooling)
  ├─ alphaMin: 0.001 (early stop threshold)
  ├─ charge strength: -800 (balanced repulsion)
  └─ collision iterations: 3 (good quality)

Performance Impact:
  ├─ Settles in 300-500 ticks (5-8 seconds)
  ├─ Can be pre-computed for instant layout
  └─ Pause-able for frozen layouts

┌─────────────────────────────────────────────────────────────────────────┐
│ OPTIMIZATION LAYER 7: MEMORY POOLING                                   │
└─────────────────────────────────────────────────────────────────────────┘

Goal: Reduce garbage collection pauses

Implementation:
  ├─ Reuse PIXI.Graphics objects when possible
  ├─ Avoid creating temporary objects in render loop
  ├─ Use typed arrays for large datasets
  └─ Clear and reuse containers instead of destroying

Performance Impact:
  ├─ Reduces GC pressure
  ├─ Prevents frame drops from GC pauses
  └─ Stable memory usage over time
```

### 7.2 Performance Monitoring

```typescript
class PerformanceMonitor {
  update(): {
    frameRate: number;      // Current FPS
    renderTime: number;     // Frame time in ms
    shouldOptimize: boolean; // True if FPS < 80% of target
  }
}

// Usage:
const metrics = performanceMonitorRef.current.update();
if (metrics.shouldOptimize) {
  // Increase LOD aggressiveness
  // Reduce visible node count
  // Simplify visuals
}

// Metrics exposed to Zustand store:
useStore().performance.updateMetrics({
  frameRate: metrics.frameRate,
  renderTime: metrics.renderTime,
  nodeCount: enhancedNodesRef.current.size,
  edgeCount: enhancedEdgesRef.current.size,
  visibleNodes: countVisibleNodes(),
  visibleEdges: countVisibleEdges(),
  memoryUsage: getMemoryUsage(),
});
```

---

## 8. Event Flow

### 8.1 Click Event Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ USER CLICKS ON NODE                                                    │
└─────────────────────────────────────────────────────────────────────────┘

[1] Browser MouseEvent (screen coordinates)
    └─ Click at screen position (650px, 400px)

[2] PIXI Event System (automatic transform to local coordinates)
    ├─ PIXI.EventSystem receives native event
    ├─ Transforms screen → world coordinates using stage transform
    ├─ Performs hit testing against all interactive objects
    └─ Finds node.pixiNode container with matching hit area

[3] Node Container 'pointerdown' Event
    ├─ Fired on node.pixiNode (PIXI.Container)
    ├─ Store drag start position: { x: event.globalX, y: event.globalY }
    ├─ Set isPointerDown = true
    ├─ Visual feedback: flash circle tint white for 100ms
    └─ event.stopPropagation() to prevent bubbling

[4] User Releases Mouse

[5] Node Container 'pointerup' Event
    ├─ Calculate drag distance from start position
    ├─ If distance < 5px → treat as CLICK
    │   └─ Call processNodeClick(event, nodeId, node)
    └─ Else → treat as DRAG (ignore)

[6] processNodeClick() Handler
    ├─ Check for double-click (within 300ms of last click)
    │   └─ If yes: trigger special action (e.g., center camera on node)
    │
    ├─ Check for right-click
    │   ├─ If yes: trigger context menu
    │   └─ onTrackRightClick(node.track, { x, y })
    │
    └─ Else: regular click
        ├─ Check Ctrl/Cmd key: multi-select
        │   └─ graph.toggleNodeSelection(nodeId)
        │
        ├─ Check Shift key: range select
        │   └─ graph.selectNodeRange(lastSelectedId, nodeId)
        │
        └─ Else: single select
            ├─ graph.clearSelection()
            ├─ graph.selectNode(nodeId)
            └─ onTrackSelect(node.track) → parent component

[7] Zustand State Update
    ├─ viewState.selectedNodes → Set<string>
    └─ Triggers React re-render of UI components

[8] Visual Update (in renderFrame)
    ├─ getNodeColor(node) checks selection state
    ├─ Updates node.pixiCircle.tint
    └─ Shows selection highlight
```

### 8.2 Zoom/Pan Event Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ USER SCROLLS MOUSE WHEEL                                               │
└─────────────────────────────────────────────────────────────────────────┘

[1] Browser WheelEvent
    └─ event.deltaY (scroll amount)

[2] D3 Zoom Behavior (d3-zoom)
    ├─ Receives wheel event (via D3 selection)
    ├─ Calculates new zoom scale: k' = k * (1 + deltaY * factor)
    ├─ Calculates new pan to zoom toward mouse position
    │   ├─ mouseWorldX = (mouseX - centerX - pan.x) / k
    │   ├─ mouseWorldY = (mouseY - centerY - pan.y) / k
    │   ├─ newPan.x = mouseX - centerX - (mouseWorldX * k')
    │   └─ newPan.y = mouseY - centerY - (mouseWorldY * k')
    │
    └─ Creates new ZoomTransform: { x: newPan.x, y: newPan.y, k: k' }

[3] Zoom Event Handler (zoomHandler.on('zoom'))
    ├─ Extract transform from event
    ├─ Update currentTransformRef.current = transform
    ├─ Update viewportRef.current
    │   ├─ viewport.x = transform.x
    │   ├─ viewport.y = transform.y
    │   └─ viewport.zoom = transform.k
    │
    ├─ Update Zustand store (via requestAnimationFrame)
    │   └─ store.view.updateViewport(transform.k, { x, y })
    │
    ├─ Update LOD system
    │   └─ lodSystemRef.current.updateViewport(viewport)
    │
    ├─ Apply transform to PIXI stage
    │   ├─ stage.x = (width/2) + transform.x
    │   ├─ stage.y = (height/2) + transform.y
    │   └─ stage.scale.set(transform.k, transform.k)
    │
    └─ Update all node hit boxes for new zoom level
        └─ For each node:
            ├─ Calculate zoom-aware hitBoxRadius
            │   └─ max(baseRadius + 10, minScreenSize / zoom)
            └─ node.pixiNode.hitArea = new PIXI.Circle(0, 0, hitBoxRadius)

[4] Next Render Frame
    ├─ LOD system recalculates based on new viewport
    ├─ Node/edge visibility updated
    ├─ Labels shown/hidden based on new LOD levels
    └─ PIXI renders transformed scene
```

### 8.3 Hover Event Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ USER HOVERS MOUSE OVER NODE                                            │
└─────────────────────────────────────────────────────────────────────────┘

[1] PIXI 'pointerenter' Event
    ├─ Triggered when cursor enters node.pixiNode hit area
    ├─ Check if dragging (ignore hover during drag)
    └─ Call graph.setHoveredNode(nodeId)

[2] Zustand State Update
    └─ viewState.hoveredNode = nodeId

[3] Visual Feedback (immediate, no re-render)
    ├─ If not selected: node.pixiCircle.tint = COLOR_SCHEMES.node.hovered
    ├─ Show labels (if LOD 0):
    │   ├─ node.pixiLabel.visible = true
    │   └─ node.pixiArtistLabel.visible = true
    └─ Change cursor: node.pixiNode.cursor = 'pointer'

[4] User Moves Cursor Away

[5] PIXI 'pointerleave' Event
    ├─ Call graph.setHoveredNode(null)
    ├─ Reset tint:
    │   └─ isSelected ? COLOR_SCHEMES.node.selected : COLOR_SCHEMES.node.default
    └─ Hide labels (if LOD > 0):
        ├─ node.pixiLabel.visible = false
        └─ node.pixiArtistLabel.visible = false
```

---

## 9. Debugging Guide

### 9.1 Common Issues and Solutions

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ISSUE: Nodes are not visible on canvas                                │
└─────────────────────────────────────────────────────────────────────────┘

Diagnostic Steps:
1. Check if PIXI canvas exists in DOM
   → Inspect element, look for <canvas id="songnodes-pixi-canvas">

2. Check PIXI app initialization
   → Console: window.pixiApp
   → Should show PIXI.Application instance

3. Check stage transform
   → Console: window.pixiApp.stage.position
   → Should be (canvasWidth/2, canvasHeight/2)

4. Check node positions
   → Console: window.enhancedNodesRef.current
   → Check first node: x, y values should be numbers (not undefined/NaN)

5. Check node visibility
   → Console: Array.from(window.enhancedNodesRef.current.values())[0]
   → Check pixiNode.visible, lodLevel

6. Check viewport culling
   → Console: window.lodSystemRef.current
   → Call getNodeLOD(node) to see if nodes are being culled

7. Force a render
   → Console: window.pixiApp.render()

Common Causes:
  ├─ Stage not centered → Nodes at (0,0) are off-screen
  ├─ All nodes culled → Viewport calculation issue
  ├─ Nodes have NaN positions → D3 simulation not initialized
  └─ Zoom level too low → Nodes too small to see

┌─────────────────────────────────────────────────────────────────────────┐
│ ISSUE: Clicks on nodes don't work                                     │
└─────────────────────────────────────────────────────────────────────────┘

Diagnostic Steps:
1. Check if node containers are interactive
   → Console: node.pixiNode.eventMode
   → Should be 'static' (not 'none' or 'passive')

2. Check hit areas
   → Console: node.pixiNode.hitArea
   → Should be PIXI.Circle with radius > 0

3. Enable hit area debugging
   → Console: window.DEBUG_HIT_AREAS = true
   → Refresh page
   → Red circles should appear showing hit areas

4. Check event handlers
   → Add console.log in pointerdown/pointerup handlers
   → Click node, check if logs appear

5. Check z-index / pointer-events
   → Canvas style should have pointer-events: auto
   → Container should be position: relative

6. Check if click is being interpreted as drag
   → Console log in pointerup handler
   → Check dragDistance value (should be < 5 for clicks)

Common Causes:
  ├─ Hit area too small (especially when zoomed out)
  ├─ eventMode not set correctly
  ├─ Canvas has pointer-events: none
  ├─ Clicks interpreted as drags (threshold too low)
  └─ Event handlers not attached

┌─────────────────────────────────────────────────────────────────────────┐
│ ISSUE: Zoom is jerky or inverted                                      │
└─────────────────────────────────────────────────────────────────────────┘

Diagnostic Steps:
1. Check D3 zoom transform
   → Console: window.pixiApp.stage.scale.x
   → Should match D3 transform.k

2. Check stage position calculation
   → stageX should be: (width/2) + transform.x
   → stageY should be: (height/2) + transform.y

3. Check wheelDelta calculation
   → In initializeZoom, verify wheelDelta formula

4. Check for conflicting zoom handlers
   → Only one D3 zoom behavior should exist
   → Check if browser default zoom is disabled (touch-action: none)

Common Causes:
  ├─ Stage position calculated incorrectly
  ├─ Multiple zoom handlers fighting
  ├─ Browser default zoom not disabled
  └─ Delta calculation inverted

┌─────────────────────────────────────────────────────────────────────────┐
│ ISSUE: Memory leak / performance degrades over time                   │
└─────────────────────────────────────────────────────────────────────────┘

Diagnostic Steps:
1. Check PIXI textures
   → Console: window.pixiApp.renderer.texture.managedTextures.length
   → Should be stable, not growing

2. Check WebGL context
   → Chrome DevTools → More tools → Rendering → WebGL contexts
   → Should show 1 context, not growing

3. Check for orphaned event listeners
   → Unmount/remount component
   → Check if old handlers still firing (add console.logs)

4. Check ticker cleanup
   → Unmount component
   → Console: window.pixiApp?.ticker.started
   → Should be false after unmount

5. Monitor memory
   → Chrome DevTools → Memory → Take heap snapshot
   → Look for "Detached HTMLDivElement" (leaked DOM nodes)

Common Causes:
  ├─ PIXI objects not destroyed in cleanup
  ├─ Ticker not stopped
  ├─ Event listeners not removed
  ├─ Refs not cleared (circular references)
  └─ WebGL context not released
```

### 9.2 Debug Console Commands

```javascript
// Global debug utilities exposed via window object

// ========================================
// INSPECTION
// ========================================

// View PIXI app
window.pixiApp
window.__PIXI_APP__

// View canvas
window.pixiCanvas

// View data structures
window.enhancedNodesRef.current       // Map<id, EnhancedGraphNode>
window.enhancedEdgesRef.current       // Map<id, EnhancedGraphEdge>

// View systems
window.lodSystemRef.current           // LODSystem instance
window.viewportRef.current            // Viewport state

// ========================================
// ANIMATION CONTROL
// ========================================

// Pause/resume simulation
window.toggleSimulation()

// Manually restart animation
window.manualRefresh()

// ========================================
// VISUAL DEBUGGING
// ========================================

// Show hit areas (red circles)
window.DEBUG_HIT_AREAS = true
// Then refresh page or call updateGraphData()

// Check node at specific position
const node = Array.from(window.enhancedNodesRef.current.values())[0]
console.log('Node 0:', {
  id: node.id,
  position: { x: node.x, y: node.y },
  pixiPosition: { x: node.pixiNode.x, y: node.pixiNode.y },
  lodLevel: node.lodLevel,
  visible: node.pixiNode.visible,
  eventMode: node.pixiNode.eventMode,
  hitArea: node.pixiNode.hitArea
})

// Check all visible nodes
Array.from(window.enhancedNodesRef.current.values())
  .filter(n => n.pixiNode.visible)
  .length

// ========================================
// COORDINATE TESTING
// ========================================

// Test coordinate transformation
const testWorldToScreen = (worldX, worldY) => {
  const viewport = window.viewportRef.current
  const screenX = (worldX * viewport.zoom) + (viewport.width / 2) + viewport.x
  const screenY = (worldY * viewport.zoom) + (viewport.height / 2) + viewport.y
  return { screenX, screenY }
}

// Test screen to world
const testScreenToWorld = (screenX, screenY) => {
  const viewport = window.viewportRef.current
  const worldX = (screenX - (viewport.width / 2) - viewport.x) / viewport.zoom
  const worldY = (screenY - (viewport.height / 2) - viewport.y) / viewport.zoom
  return { worldX, worldY }
}

// ========================================
// PERFORMANCE
// ========================================

// Check FPS
window.pixiApp.ticker.FPS

// Force garbage collection (if available)
if (window.gc) {
  window.gc()
  console.log('Forced GC')
}

// Check WebGL memory
const gl = window.pixiApp.renderer.gl
if (gl) {
  console.log('WebGL info:', {
    vendor: gl.getParameter(gl.VENDOR),
    renderer: gl.getParameter(gl.RENDERER),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
  })
}
```

---

## Summary

This document provides a complete reference for the SongNodes graph visualization system. Key takeaways:

1. **Three coordinate spaces**: World (D3), Stage (PIXI local), Canvas (screen pixels)
2. **Single source of truth**: D3 ZoomTransform controls all coordinate conversions
3. **Separation of concerns**: PIXI renders, D3-force simulates, D3-zoom interacts
4. **Performance first**: LOD, culling, spatial indexing, WebGL
5. **Memory safety**: Explicit cleanup, ref-based tracking, no leaks

For onboarding new developers:
- Start with Section 1 (Overview) and Section 2 (Component Layer)
- Study Section 4 (Coordinate Systems) to understand positioning
- Reference Section 5 (Rendering Pipeline) for visual debugging
- Use Section 9 (Debugging Guide) when issues arise

For debugging coordinate issues:
- Check Section 4.2 (Coordinate System Diagram)
- Use Section 9.2 (Debug Console Commands)
- Verify stage.position = (width/2, height/2) + pan offset
- Confirm pixiNode.x/y = node.x/y (direct mapping in stage space)
