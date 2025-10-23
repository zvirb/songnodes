# Tier 2 Component Refactoring Guide (2025 Best Practices)

## Executive Summary

This document provides comprehensive refactoring guidance for five high-priority components identified in the frontend audit. Each component requires significant modernization to align with 2025 best practices, focusing on performance optimization, memory leak prevention, and mobile support.

---

## 1. DJInterface Component Refactoring

### Current Issues (Score: 5/10)
- 741 lines of monolithic code
- Memory leaks in audio playback
- Missing deck synchronization
- No waveform visualization
- Poor touch controls

### Modern Architecture Pattern (2025)

#### Component Structure
```typescript
// Split into modular components
├── DJInterface/
│   ├── index.tsx (orchestrator)
│   ├── hooks/
│   │   ├── useAudioEngine.ts
│   │   ├── useDeckSync.ts
│   │   ├── useBeatGrid.ts
│   │   └── useMixerState.ts
│   ├── components/
│   │   ├── Deck/
│   │   │   ├── DeckA.tsx
│   │   │   ├── DeckB.tsx
│   │   │   └── DeckControls.tsx
│   │   ├── Mixer/
│   │   │   ├── Crossfader.tsx
│   │   │   ├── ChannelEQ.tsx
│   │   │   └── VolumeControls.tsx
│   │   ├── Waveform/
│   │   │   ├── WaveformDisplay.tsx
│   │   │   ├── BeatGrid.tsx
│   │   │   └── ZoomControls.tsx
│   │   └── Performance/
│   │       ├── HotCues.tsx
│   │       ├── LoopControls.tsx
│   │       └── BeatJump.tsx
│   └── utils/
│       ├── audioContext.ts
│       ├── bpmAnalyzer.ts
│       └── syncEngine.ts
```

#### Modern DJ Layout Pattern (Inspired by Serato/Traktor 2025)

```typescript
interface DJLayoutConfig {
  mode: 'performance' | 'browse' | 'vertical' | 'horizontal';
  deckCount: 2 | 4;
  waveformStyle: 'parallel' | 'stacked' | 'battle';
  theme: 'dark-neon' | 'classic' | 'minimal';
}

const ModernDJInterface: React.FC = () => {
  // Core state using Zustand
  const audioEngine = useAudioEngine();
  const mixer = useMixerState();

  return (
    <DJContainer>
      {/* Top: Library Browser */}
      <TrackBrowser />

      {/* Center: Waveforms */}
      <WaveformSection>
        <GlobalWaveform deck="A" />
        <GlobalWaveform deck="B" />
        <BeatMatchingGuide />
      </WaveformSection>

      {/* Main: Deck Controls */}
      <DeckSection>
        <Deck id="A" />
        <Mixer />
        <Deck id="B" />
      </DeckSection>

      {/* Bottom: Performance Pads */}
      <PerformanceSection>
        <HotCues deck="A" />
        <LoopControls />
        <HotCues deck="B" />
      </PerformanceSection>
    </DJContainer>
  );
};
```

### Waveform Visualization Implementation

#### Using WaveSurfer.js v7 (TypeScript Native)

```typescript
import WaveSurfer from 'wavesurfer.js';
import { useRef, useEffect } from 'react';

interface WaveformProps {
  audioUrl: string;
  peaks?: Float32Array; // Pre-computed for large files
  onReady?: () => void;
}

const WaveformDisplay: React.FC<WaveformProps> = ({ audioUrl, peaks }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize with proper config for DJ use
    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#00ff41', // Neon green
      progressColor: '#ff00ff', // Magenta
      cursorColor: '#ffffff',
      barWidth: 2,
      barRadius: 3,
      normalize: true,
      backend: 'WebAudio',
      plugins: [
        // Add beat markers, cue points, etc.
      ]
    });

    // Load with pre-computed peaks for performance
    if (peaks) {
      wavesurferRef.current.load(audioUrl, peaks);
    } else {
      wavesurferRef.current.load(audioUrl);
    }

    // Cleanup
    return () => {
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl, peaks]);

  return <div ref={containerRef} className="waveform-container" />;
};
```

### Memory Leak Prevention

```typescript
// Audio context management
class AudioEngineManager {
  private static instance: AudioEngineManager;
  private context: AudioContext;
  private sources: Map<string, AudioBufferSourceNode> = new Map();

  dispose(deckId: string) {
    const source = this.sources.get(deckId);
    if (source) {
      source.disconnect();
      source.stop();
      this.sources.delete(deckId);
    }
  }

  disposeAll() {
    this.sources.forEach((source) => {
      source.disconnect();
      source.stop();
    });
    this.sources.clear();
    this.context.close();
  }
}

// React cleanup hook
const useAudioCleanup = () => {
  useEffect(() => {
    return () => {
      AudioEngineManager.getInstance().disposeAll();
    };
  }, []);
};
```

### BPM Sync & Master Clock

```typescript
interface SyncEngine {
  masterDeck: 'A' | 'B' | null;
  masterBPM: number;
  phase: number;
  quantize: boolean;
}

class BeatSyncEngine {
  private masterClock: Worker; // Web Worker for precise timing

  constructor() {
    this.masterClock = new Worker('/workers/beatClock.worker.js');
  }

  syncDecks(deckA: DeckState, deckB: DeckState): SyncResult {
    const phaseDiff = this.calculatePhase(deckA, deckB);
    const tempoRatio = deckA.bpm / deckB.bpm;

    return {
      phaseAdjust: phaseDiff,
      tempoAdjust: tempoRatio,
      beatGrid: this.alignBeatGrids(deckA, deckB)
    };
  }
}
```

### Touch Controls Implementation

```typescript
const useTouchDJControls = () => {
  const [touchMode, setTouchMode] = useState(false);

  const handleJogWheel = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const center = { x: e.target.width / 2, y: e.target.height / 2 };
    const angle = Math.atan2(touch.y - center.y, touch.x - center.x);

    // Calculate rotation delta
    const rotationDelta = angle - lastAngle;

    // Apply pitch bend or scratch based on mode
    if (vinylMode) {
      applyScratch(rotationDelta);
    } else {
      applyPitchBend(rotationDelta);
    }
  }, [vinylMode]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleJogWheel,
    onTouchEnd: handleTouchEnd
  };
};
```

### Migration Path

1. **Phase 1**: Extract audio engine to separate module
2. **Phase 2**: Split component into deck/mixer/browser sections
3. **Phase 3**: Implement WaveSurfer.js for waveforms
4. **Phase 4**: Add BPM sync engine with Web Workers
5. **Phase 5**: Implement touch controls and gestures
6. **Phase 6**: Add performance monitoring

---

## 2. GraphVisualization Component Refactoring

### Current Issues (Score: 5/10)
- Memory leaks with PIXI.js cleanup
- No WebGL optimization
- Missing spatial indexing
- Poor performance >1000 nodes
- No LOD system

### Modern WebGL Architecture (PIXI.js v8 + Spatial Indexing)

#### Optimized Component Structure

```typescript
// Modular graph architecture
├── GraphVisualization/
│   ├── index.tsx
│   ├── renderer/
│   │   ├── WebGLRenderer.ts
│   │   ├── CanvasFallback.ts
│   │   └── RenderPool.ts
│   ├── spatial/
│   │   ├── Quadtree.ts
│   │   ├── SpatialIndex.ts
│   │   └── ViewportCuller.ts
│   ├── layout/
│   │   ├── ForceDirected.ts
│   │   ├── GraphLayout.worker.ts
│   │   └── LayoutEngine.ts
│   ├── interaction/
│   │   ├── NodeSelector.ts
│   │   ├── PanZoom.ts
│   │   └── Minimap.tsx
│   └── optimization/
│       ├── LODSystem.ts
│       ├── NodeClustering.ts
│       └── EdgeBundling.ts
```

#### PIXI.js v8 Optimized Implementation

```typescript
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { Quadtree } from 'd3-quadtree';

class OptimizedGraphRenderer {
  private app: Application;
  private nodeContainer: Container;
  private edgeContainer: Container;
  private quadtree: Quadtree;
  private nodePool: Sprite[] = [];
  private visibleNodes: Set<string> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.app = new Application({
      view: canvas,
      antialias: false, // Better performance
      resolution: window.devicePixelRatio,
      autoDensity: true,
      powerPreference: 'high-performance',
      backgroundAlpha: 0
    });

    // Separate containers for z-ordering
    this.edgeContainer = new Container();
    this.nodeContainer = new Container();
    this.app.stage.addChild(this.edgeContainer, this.nodeContainer);
  }

  // Spatial indexing with Quadtree
  buildSpatialIndex(nodes: GraphNode[]) {
    this.quadtree = d3.quadtree()
      .x(d => d.x)
      .y(d => d.y)
      .addAll(nodes);
  }

  // Viewport culling
  cullNodes(viewport: Rectangle): GraphNode[] {
    const visible: GraphNode[] = [];

    this.quadtree.visit((node, x1, y1, x2, y2) => {
      if (!node.length) {
        // Leaf node
        const d = node.data;
        if (viewport.contains(d.x, d.y)) {
          visible.push(d);
        }
      }
      // Don't visit children if bounds don't intersect
      return !viewport.intersects(x1, y1, x2 - x1, y2 - y1);
    });

    return visible;
  }

  // Object pooling for sprites
  getNodeSprite(): Sprite {
    if (this.nodePool.length > 0) {
      return this.nodePool.pop()!;
    }

    const sprite = new Sprite(this.nodeTexture);
    sprite.anchor.set(0.5);
    return sprite;
  }

  returnNodeSprite(sprite: Sprite) {
    sprite.visible = false;
    this.nodePool.push(sprite);
  }

  // Level of Detail system
  updateLOD(zoomLevel: number) {
    const LOD_THRESHOLDS = {
      HIGH: 2.0,    // Show all details
      MEDIUM: 1.0,  // Show labels
      LOW: 0.5      // Basic shapes only
    };

    this.nodeContainer.children.forEach(node => {
      if (zoomLevel > LOD_THRESHOLDS.HIGH) {
        node.showFullDetail();
      } else if (zoomLevel > LOD_THRESHOLDS.MEDIUM) {
        node.showMediumDetail();
      } else {
        node.showMinimalDetail();
      }
    });
  }

  // Proper cleanup
  destroy() {
    // Clear object pools
    this.nodePool.forEach(sprite => sprite.destroy());
    this.nodePool = [];

    // Destroy containers
    this.nodeContainer.destroy({ children: true });
    this.edgeContainer.destroy({ children: true });

    // Destroy PIXI app
    this.app.destroy(true, {
      removeView: true,
      stageOptions: {
        children: true,
        texture: true,
        baseTexture: true
      }
    });
  }
}
```

#### Instanced Rendering for 10,000+ Nodes

```typescript
import { Mesh, MeshMaterial, Geometry } from '@pixi/mesh';

class InstancedNodeRenderer {
  private mesh: Mesh;
  private instanceCount: number = 0;

  createInstancedMesh(maxNodes: number) {
    // Create geometry for instanced rendering
    const geometry = new Geometry()
      .addAttribute('aPosition', [-1, -1, 1, -1, 1, 1, -1, 1], 2)
      .addAttribute('aUV', [0, 0, 1, 0, 1, 1, 0, 1], 2)
      .addAttribute('aInstancePosition', new Float32Array(maxNodes * 2), 2, false, true)
      .addAttribute('aInstanceColor', new Float32Array(maxNodes * 3), 3, false, true)
      .addAttribute('aInstanceSize', new Float32Array(maxNodes), 1, false, true)
      .addIndex([0, 1, 2, 0, 2, 3]);

    // Custom shader for instanced rendering
    const vertexShader = `
      attribute vec2 aPosition;
      attribute vec2 aInstancePosition;
      attribute float aInstanceSize;

      uniform mat3 projectionMatrix;

      void main() {
        vec3 pos = vec3(aPosition * aInstanceSize + aInstancePosition, 1.0);
        gl_Position = vec4((projectionMatrix * pos).xy, 0.0, 1.0);
      }
    `;

    const material = MeshMaterial.from(vertexShader, fragmentShader, {
      projectionMatrix: this.app.renderer.projection.projectionMatrix
    });

    this.mesh = new Mesh(geometry, material);
    this.nodeContainer.addChild(this.mesh);
  }

  updateInstances(nodes: GraphNode[]) {
    const positions = this.mesh.geometry.getBuffer('aInstancePosition');
    const colors = this.mesh.geometry.getBuffer('aInstanceColor');
    const sizes = this.mesh.geometry.getBuffer('aInstanceSize');

    nodes.forEach((node, i) => {
      positions.data[i * 2] = node.x;
      positions.data[i * 2 + 1] = node.y;

      colors.data[i * 3] = node.color.r;
      colors.data[i * 3 + 1] = node.color.g;
      colors.data[i * 3 + 2] = node.color.b;

      sizes.data[i] = node.size;
    });

    positions.update();
    colors.update();
    sizes.update();

    this.instanceCount = nodes.length;
  }
}
```

### Performance Monitoring

```typescript
import { PerfMonitor } from '@pixi/dev-tools';

const useGraphPerformance = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>();

  useEffect(() => {
    const monitor = new PerfMonitor();

    const interval = setInterval(() => {
      setMetrics({
        fps: monitor.fps,
        drawCalls: monitor.drawCalls,
        nodeCount: visibleNodes.size,
        memoryUsage: performance.memory?.usedJSHeapSize
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return metrics;
};
```

### Mobile Optimization

```typescript
const getMobileOptimizedConfig = (): GraphConfig => {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  const hasLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;

  if (isMobile || hasLowMemory) {
    return {
      maxNodes: 500,
      maxEdges: 1000,
      enableShadows: false,
      enableAnimations: false,
      textureResolution: 0.5,
      renderMode: 'simple',
      cullingPadding: 50
    };
  }

  return {
    maxNodes: 10000,
    maxEdges: 50000,
    enableShadows: true,
    enableAnimations: true,
    textureResolution: 1,
    renderMode: 'advanced',
    cullingPadding: 100
  };
};
```

### Migration Path

1. **Phase 1**: Implement spatial indexing with Quadtree
2. **Phase 2**: Add viewport culling
3. **Phase 3**: Implement object pooling
4. **Phase 4**: Add LOD system
5. **Phase 5**: Implement instanced rendering
6. **Phase 6**: Add performance monitoring

---

## 3. PathBuilder Component Refactoring

### Current Issues (Score: 5/10)
- Duplicate of PathfinderPanel
- No canvas visualization
- Missing intermediate nodes
- Poor algorithm feedback

### Modern Path Building Architecture

#### Interactive Path Construction

```typescript
// Component structure
├── PathBuilder/
│   ├── index.tsx
│   ├── visualization/
│   │   ├── PathCanvas.tsx
│   │   ├── WaypointEditor.tsx
│   │   └── PathPreview.tsx
│   ├── algorithms/
│   │   ├── HarmonicPath.ts
│   │   ├── BPMTransition.ts
│   │   └── EnergyFlow.ts
│   ├── components/
│   │   ├── PathTimeline.tsx
│   │   ├── ConstraintEditor.tsx
│   │   └── PathQualityScore.tsx
│   └── hooks/
│       ├── usePathfinding.ts
│       ├── useHarmonicAnalysis.ts
│       └── usePathAnimation.ts
```

#### Visual Path Builder Implementation

```typescript
import { Stage, Layer, Line, Circle, Group } from 'react-konva';

interface PathNode {
  id: string;
  track: Track;
  position: { x: number; y: number };
  harmonicDistance: number;
  bpmDifference: number;
  energyLevel: number;
}

const InteractivePathBuilder: React.FC = () => {
  const [nodes, setNodes] = useState<PathNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedPath, setSelectedPath] = useState<PathNode[]>([]);

  // A* pathfinding with visualization
  const findPath = useCallback(async (start: PathNode, end: PathNode) => {
    const openSet = new PriorityQueue<PathNode>();
    const closedSet = new Set<string>();
    const cameFrom = new Map<string, PathNode>();

    openSet.enqueue(start, 0);

    while (!openSet.isEmpty()) {
      const current = openSet.dequeue();

      // Visualize current node being explored
      await animateNodeExploration(current);

      if (current.id === end.id) {
        return reconstructPath(cameFrom, current);
      }

      closedSet.add(current.id);

      for (const neighbor of getNeighbors(current)) {
        if (closedSet.has(neighbor.id)) continue;

        const tentativeScore = gScore.get(current) +
          calculateTransitionCost(current, neighbor);

        if (tentativeScore < gScore.get(neighbor)) {
          cameFrom.set(neighbor.id, current);
          gScore.set(neighbor, tentativeScore);

          const priority = tentativeScore +
            heuristic(neighbor, end);
          openSet.enqueue(neighbor, priority);

          // Visualize edge being considered
          await animateEdgeConsideration(current, neighbor);
        }
      }
    }
  }, []);

  return (
    <div className="path-builder">
      <Stage width={window.innerWidth} height={600}>
        <Layer>
          {/* Render graph */}
          {edges.map(edge => (
            <Line
              key={edge.id}
              points={[edge.from.x, edge.from.y, edge.to.x, edge.to.y]}
              stroke={edge.inPath ? '#00ff00' : '#333'}
              strokeWidth={edge.inPath ? 3 : 1}
            />
          ))}

          {/* Render nodes */}
          {nodes.map(node => (
            <WaypointNode
              key={node.id}
              node={node}
              isInPath={selectedPath.includes(node)}
              onDragEnd={handleNodeDrag}
            />
          ))}

          {/* Path preview overlay */}
          <PathPreview path={selectedPath} />
        </Layer>
      </Stage>

      <PathTimeline path={selectedPath} />
      <PathQualityMetrics path={selectedPath} />
    </div>
  );
};
```

#### Harmonic Path Visualization

```typescript
const HarmonicFlowVisualization: React.FC<{ path: PathNode[] }> = ({ path }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || path.length < 2) return;

    // Draw Camelot wheel background
    drawCamelotWheel(ctx);

    // Draw path on wheel
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.beginPath();

    path.forEach((node, i) => {
      const angle = keyToAngle(node.track.key);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Draw transition quality indicators
    for (let i = 0; i < path.length - 1; i++) {
      const quality = calculateTransitionQuality(path[i], path[i + 1]);
      drawTransitionIndicator(ctx, path[i], path[i + 1], quality);
    }
  }, [path]);

  return <canvas ref={canvasRef} width={800} height={800} />;
};
```

#### Path Quality Scoring

```typescript
interface PathQualityMetrics {
  harmonicScore: number;  // 0-100
  energyFlow: number;     // 0-100
  bpmConsistency: number; // 0-100
  overall: number;        // Weighted average
}

const calculatePathQuality = (path: PathNode[]): PathQualityMetrics => {
  let harmonicScore = 0;
  let energyFlow = 0;
  let bpmConsistency = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const current = path[i];
    const next = path[i + 1];

    // Harmonic compatibility (Camelot wheel distance)
    const harmonicDist = getCamelotDistance(current.track.key, next.track.key);
    harmonicScore += (3 - Math.min(harmonicDist, 3)) / 3;

    // Energy flow (should be gradual)
    const energyDiff = Math.abs(current.energyLevel - next.energyLevel);
    energyFlow += Math.max(0, 1 - energyDiff / 10);

    // BPM consistency (within ±6 BPM or doubled/halved)
    const bpmRatio = current.track.bpm / next.track.bpm;
    const isCompatible = Math.abs(bpmRatio - 1) < 0.05 ||
                         Math.abs(bpmRatio - 2) < 0.05 ||
                         Math.abs(bpmRatio - 0.5) < 0.05;
    bpmConsistency += isCompatible ? 1 : 0.5;
  }

  const transitionCount = path.length - 1;

  return {
    harmonicScore: (harmonicScore / transitionCount) * 100,
    energyFlow: (energyFlow / transitionCount) * 100,
    bpmConsistency: (bpmConsistency / transitionCount) * 100,
    overall: 0 // Calculate weighted average
  };
};
```

### Alternative Path Suggestions

```typescript
const PathAlternatives: React.FC<{ start: Track; end: Track }> = ({ start, end }) => {
  const [alternatives, setAlternatives] = useState<Path[]>([]);

  useEffect(() => {
    // Find multiple paths with different constraints
    const paths = [
      findShortestPath(start, end),
      findSmoothestEnergyPath(start, end),
      findMostHarmonicPath(start, end),
      findMinimalBPMChangePath(start, end)
    ];

    setAlternatives(paths);
  }, [start, end]);

  return (
    <div className="path-alternatives">
      {alternatives.map((path, i) => (
        <PathOption
          key={i}
          path={path}
          metrics={calculatePathQuality(path)}
          onSelect={() => selectPath(path)}
        />
      ))}
    </div>
  );
};
```

### Migration Path

1. **Phase 1**: Merge PathBuilder and PathfinderPanel
2. **Phase 2**: Implement visual canvas with Konva
3. **Phase 3**: Add A* visualization
4. **Phase 4**: Implement path quality scoring
5. **Phase 5**: Add alternative path generation
6. **Phase 6**: Add path preview playback

---

## 4. CamelotHelix3D Component Refactoring

### Current Issues (Score: 5/10)
- Three.js memory leaks
- No touch controls
- Missing accessibility
- Poor performance on mobile

### React Three Fiber Architecture (2025 Best Practices)

#### Component Structure with R3F

```typescript
// Modern R3F structure
├── CamelotHelix3D/
│   ├── index.tsx
│   ├── components/
│   │   ├── Helix.tsx
│   │   ├── KeySegment.tsx
│   │   ├── TrackNode.tsx
│   │   └── ConnectionLine.tsx
│   ├── controls/
│   │   ├── CameraController.tsx
│   │   ├── TouchControls.tsx
│   │   └── KeyboardControls.tsx
│   ├── effects/
│   │   ├── AudioReactive.tsx
│   │   ├── ParticleSystem.tsx
│   │   └── PostProcessing.tsx
│   └── utils/
│       ├── geometryPool.ts
│       ├── textureLoader.ts
│       └── performanceMonitor.ts
```

#### React Three Fiber Implementation

```typescript
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { EffectComposer, Bloom, SSAO } from '@react-three/postprocessing';
import { Suspense, useRef, useMemo } from 'react';

const CamelotHelix3D: React.FC = () => {
  const [performanceMode, setPerformanceMode] = useState<'high' | 'low'>('high');

  // Detect device capabilities
  useEffect(() => {
    const gpu = navigator.gpu;
    const memory = (navigator as any).deviceMemory;

    if (memory && memory < 4) {
      setPerformanceMode('low');
    }
  }, []);

  return (
    <Canvas
      dpr={performanceMode === 'high' ? [1, 2] : [0.5, 1]}
      camera={{ position: [0, 0, 10], fov: 60 }}
      gl={{
        powerPreference: 'high-performance',
        antialias: performanceMode === 'high',
        stencil: false,
        depth: true
      }}
      shadows={performanceMode === 'high'}
    >
      <Suspense fallback={<Loader />}>
        <Scene performanceMode={performanceMode} />
      </Suspense>
    </Canvas>
  );
};

const Scene: React.FC<{ performanceMode: 'high' | 'low' }> = ({ performanceMode }) => {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 15]} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN
        }}
      />

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow={performanceMode === 'high'} />

      <CamelotHelix />

      {performanceMode === 'high' && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} />
          <SSAO radius={0.5} intensity={0.5} />
        </EffectComposer>
      )}
    </>
  );
};
```

#### Optimized Helix Geometry with Instancing

```typescript
import { useRef, useMemo } from 'react';
import { InstancedMesh, CylinderGeometry, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';

const CamelotHelix: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);
  const segmentCount = 24; // 12 major + 12 minor keys
  const tracksPerKey = 50;

  // Pre-calculate positions
  const positions = useMemo(() => {
    const temp = [];
    const radius = 5;
    const height = 10;

    for (let i = 0; i < segmentCount; i++) {
      const angle = (i / segmentCount) * Math.PI * 2;
      const y = (i / segmentCount) * height - height / 2;

      for (let j = 0; j < tracksPerKey; j++) {
        temp.push({
          x: Math.cos(angle) * radius,
          y: y + (j * 0.1),
          z: Math.sin(angle) * radius,
          key: i,
          trackIndex: j
        });
      }
    }

    return temp;
  }, [segmentCount, tracksPerKey]);

  // Audio reactive animation
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();

    positions.forEach((pos, i) => {
      const matrix = new THREE.Matrix4();

      // Add audio reactive scaling
      const scale = 1 + Math.sin(time + i * 0.1) * 0.1;

      matrix.makeTranslation(pos.x, pos.y, pos.z);
      matrix.makeScale(scale, scale, scale);

      meshRef.current!.setMatrixAt(i, matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, positions.length]}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.2} />
    </instancedMesh>
  );
};
```

#### Touch Controls Implementation

```typescript
import { useGesture } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/three';

const TouchableHelix: React.FC = () => {
  const [{ rotation, scale }, api] = useSpring(() => ({
    rotation: [0, 0, 0],
    scale: 1
  }));

  const bind = useGesture({
    onDrag: ({ offset: [x, y] }) => {
      api.start({
        rotation: [y / 100, x / 100, 0]
      });
    },
    onPinch: ({ offset: [d] }) => {
      api.start({
        scale: 1 + d / 100
      });
    },
    onWheel: ({ delta: [, y] }) => {
      api.start({
        scale: Math.max(0.5, Math.min(2, scale.get() - y * 0.001))
      });
    }
  });

  return (
    <animated.group {...bind()} rotation={rotation} scale={scale}>
      <CamelotHelix />
    </animated.group>
  );
};
```

#### Memory Management & Disposal

```typescript
import { dispose } from '@react-three/fiber';

const useHelixCleanup = (meshRef: React.RefObject<THREE.Mesh>) => {
  useEffect(() => {
    const mesh = meshRef.current;

    return () => {
      if (mesh) {
        // Dispose geometry
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        // Dispose material
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => mat.dispose());
          } else {
            mesh.material.dispose();
          }
        }

        // Dispose textures
        if (mesh.material?.map) {
          mesh.material.map.dispose();
        }

        // Clear from parent
        mesh.removeFromParent();

        // Force garbage collection hint
        dispose(mesh);
      }
    };
  }, [meshRef]);
};
```

#### Accessibility Fallback

```typescript
const AccessibleCamelotWheel: React.FC = () => {
  const [use3D, setUse3D] = useState(true);
  const [error, setError] = useState(false);

  // Detect WebGL support
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
      setUse3D(false);
    }
  }, []);

  if (!use3D || error) {
    return <CamelotWheel2D />; // SVG fallback
  }

  return (
    <ErrorBoundary
      fallback={<CamelotWheel2D />}
      onError={() => setError(true)}
    >
      <CamelotHelix3D />
    </ErrorBoundary>
  );
};

// 2D SVG Fallback
const CamelotWheel2D: React.FC = () => {
  return (
    <svg width="800" height="800" viewBox="0 0 800 800">
      {camelotKeys.map((key, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const x = 400 + 300 * Math.cos(angle);
        const y = 400 + 300 * Math.sin(angle);

        return (
          <g key={key}>
            <circle cx={x} cy={y} r="30" fill={keyColors[key]} />
            <text x={x} y={y} textAnchor="middle" fill="white">
              {key}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
```

### Migration Path

1. **Phase 1**: Migrate to React Three Fiber
2. **Phase 2**: Implement instanced rendering
3. **Phase 3**: Add touch gesture support
4. **Phase 4**: Implement 2D fallback
5. **Phase 5**: Add performance monitoring
6. **Phase 6**: Optimize for mobile

---

## 5. Graph3D Component Refactoring

### Current Issues (Score: 5/10)
- Duplicate Three.js setup code
- No shared 3D utilities
- Missing performance optimizations
- Poor mobile support

### Unified 3D Graph Architecture

#### Shared 3D Utilities Module

```typescript
// Shared 3D utilities
├── shared/
│   ├── three/
│   │   ├── SceneManager.ts
│   │   ├── ResourcePool.ts
│   │   ├── DisposalManager.ts
│   │   └── PerformanceMonitor.ts
│   └── r3f/
│       ├── hooks/
│       │   ├── useObjectPool.ts
│       │   ├── useDisposal.ts
│       │   └── usePerformance.ts
│       └── components/
│           ├── AdaptiveQuality.tsx
│           ├── MobileControls.tsx
│           └── FallbackRenderer.tsx
```

#### React Force Graph 3D Implementation

```typescript
import ForceGraph3D from 'react-force-graph-3d';
import { useRef, useCallback, useState } from 'react';
import * as THREE from 'three';

const Graph3D: React.FC<{ data: GraphData }> = ({ data }) => {
  const graphRef = useRef();
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);

  // Custom node rendering with Three.js
  const nodeThreeObject = useCallback((node) => {
    const geometry = new THREE.SphereGeometry(node.size || 5);
    const material = new THREE.MeshPhongMaterial({
      color: node.color || 0x00ff00,
      emissive: highlightNodes.has(node.id) ? node.color : 0x000000,
      emissiveIntensity: 0.5
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Add custom properties for interaction
    mesh.userData = { nodeId: node.id, nodeData: node };

    return mesh;
  }, [highlightNodes]);

  // Performance optimization
  const graphData = useMemo(() => {
    // Pre-process data for performance
    const processedData = {
      nodes: data.nodes.map(node => ({
        ...node,
        // Pre-calculate values
        __threeObj: undefined // Force recalculation
      })),
      links: data.links.map(link => ({
        ...link,
        // Pre-calculate link curvature
        curvature: calculateCurvature(link)
      }))
    };

    return processedData;
  }, [data]);

  // Handle node interactions
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);

    // Highlight connected nodes
    const connectedNodes = new Set();
    graphData.links.forEach(link => {
      if (link.source.id === node.id) connectedNodes.add(link.target.id);
      if (link.target.id === node.id) connectedNodes.add(link.source.id);
    });

    setHighlightNodes(connectedNodes);
  }, [graphData]);

  return (
    <div className="graph-3d-container">
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={true}
        linkOpacity={0.5}
        linkCurvature="curvature"
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
        // Performance settings
        warmupTicks={100}
        cooldownTicks={0}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        // Camera settings
        camera={{
          position: { x: 0, y: 0, z: 500 },
          lookAt: { x: 0, y: 0, z: 0 }
        }}
      />

      {selectedNode && (
        <NodeDetails node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  );
};
```

#### Performance-Optimized Force Layout

```typescript
import { ForceGraph3D } from 'react-force-graph';
import { useWorker } from '@koale/useworker';

const OptimizedGraph3D: React.FC = () => {
  // Offload force calculations to Web Worker
  const [calculateLayout] = useWorker(() => {
    // This runs in a Web Worker
    return (nodes, links) => {
      const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id))
        .force('charge', d3.forceManyBody().strength(-100))
        .force('center', d3.forceCenter())
        .force('collision', d3.forceCollide().radius(30));

      // Run simulation
      for (let i = 0; i < 300; i++) {
        simulation.tick();
      }

      return { nodes, links };
    };
  });

  useEffect(() => {
    calculateLayout(data.nodes, data.links).then(result => {
      setGraphData(result);
    });
  }, [data]);

  return <ForceGraph3D graphData={graphData} />;
};
```

#### Mobile-Optimized 3D Graph

```typescript
const MobileOptimized3DGraph: React.FC = () => {
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('medium');

  // Detect device capabilities
  useEffect(() => {
    const checkPerformance = () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');

      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debugInfo ?
          gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';

        // Detect mobile GPUs
        if (/Mali|Adreno|PowerVR|Apple/.test(renderer)) {
          setQuality('low');
        }
      }

      // Check memory
      if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        setQuality('low');
      }
    };

    checkPerformance();
  }, []);

  const getQualitySettings = () => {
    switch (quality) {
      case 'high':
        return {
          nodeRelSize: 8,
          linkWidth: 2,
          particleCount: 1000,
          enableBloom: true,
          enableShadows: true
        };
      case 'medium':
        return {
          nodeRelSize: 6,
          linkWidth: 1,
          particleCount: 500,
          enableBloom: false,
          enableShadows: false
        };
      case 'low':
        return {
          nodeRelSize: 4,
          linkWidth: 0.5,
          particleCount: 0,
          enableBloom: false,
          enableShadows: false
        };
    }
  };

  return (
    <ForceGraph3D
      {...getQualitySettings()}
      graphData={graphData}
      // Mobile-specific controls
      controls={{
        enableDamping: true,
        dampingFactor: 0.1,
        rotateSpeed: 0.5,
        zoomSpeed: 0.5
      }}
    />
  );
};
```

#### VR/AR Support with WebXR

```typescript
import { VRCanvas, ARCanvas, Controllers, Hands, XR } from '@react-three/xr';

const XRGraph3D: React.FC = () => {
  const [xrMode, setXrMode] = useState<'none' | 'vr' | 'ar'>('none');

  if (xrMode === 'vr') {
    return (
      <VRCanvas>
        <XR>
          <Controllers />
          <Hands />
          <Graph3DScene />
        </XR>
      </VRCanvas>
    );
  }

  if (xrMode === 'ar') {
    return (
      <ARCanvas>
        <XR>
          <Graph3DScene />
        </XR>
      </ARCanvas>
    );
  }

  return (
    <div>
      <Canvas>
        <Graph3DScene />
      </Canvas>

      <div className="xr-controls">
        <button onClick={() => setXrMode('vr')}>Enter VR</button>
        <button onClick={() => setXrMode('ar')}>Enter AR</button>
      </div>
    </div>
  );
};
```

### Shared Resource Management

```typescript
// Singleton resource manager for all 3D components
class ThreeResourceManager {
  private static instance: ThreeResourceManager;
  private geometries: Map<string, THREE.BufferGeometry> = new Map();
  private materials: Map<string, THREE.Material> = new Map();
  private textures: Map<string, THREE.Texture> = new Map();

  static getInstance(): ThreeResourceManager {
    if (!ThreeResourceManager.instance) {
      ThreeResourceManager.instance = new ThreeResourceManager();
    }
    return ThreeResourceManager.instance;
  }

  getGeometry(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    if (!this.geometries.has(key)) {
      this.geometries.set(key, factory());
    }
    return this.geometries.get(key)!;
  }

  dispose() {
    this.geometries.forEach(g => g.dispose());
    this.materials.forEach(m => m.dispose());
    this.textures.forEach(t => t.dispose());

    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
  }
}
```

### Migration Path

1. **Phase 1**: Create shared 3D utilities module
2. **Phase 2**: Implement react-force-graph-3d
3. **Phase 3**: Add performance optimizations
4. **Phase 4**: Implement mobile detection and adaptation
5. **Phase 5**: Add WebXR support
6. **Phase 6**: Consolidate resource management

---

## Testing Strategy for Visual Components

### Visual Regression Testing

```typescript
// Using Playwright for visual testing
import { test, expect } from '@playwright/test';

test.describe('Visual Components', () => {
  test('DJInterface renders correctly', async ({ page }) => {
    await page.goto('/dj-interface');
    await page.waitForSelector('.dj-interface');

    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('dj-interface.png');
  });

  test('Graph3D renders without WebGL errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/graph-3d');
    await page.waitForTimeout(2000); // Wait for 3D rendering

    // Check for WebGL errors
    expect(errors.filter(e => e.includes('WebGL'))).toHaveLength(0);
  });
});
```

### Performance Testing

```typescript
// Performance monitoring for 3D components
const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({
    fps: 0,
    memory: 0,
    drawCalls: 0,
    triangles: 0
  });

  useEffect(() => {
    const stats = new Stats();
    stats.showPanel(0); // FPS panel

    const animate = () => {
      stats.begin();

      // Your render code

      stats.end();

      setMetrics({
        fps: stats.getFPS(),
        memory: performance.memory?.usedJSHeapSize || 0,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  return metrics;
};
```

---

## Implementation Priorities

### Phase 1 (Weeks 1-2): Foundation
- Set up shared 3D utilities module
- Implement memory management patterns
- Create performance monitoring framework

### Phase 2 (Weeks 3-4): DJ Interface
- Modularize into deck/mixer components
- Implement WaveSurfer.js
- Add BPM sync engine

### Phase 3 (Weeks 5-6): Graph Visualization
- Implement spatial indexing
- Add LOD system
- Optimize for 10,000+ nodes

### Phase 4 (Weeks 7-8): Path Building
- Merge duplicate components
- Implement visual path editor
- Add quality scoring

### Phase 5 (Weeks 9-10): 3D Components
- Migrate to React Three Fiber
- Add mobile optimizations
- Implement WebXR support

### Phase 6 (Weeks 11-12): Testing & Polish
- Visual regression tests
- Performance benchmarks
- Documentation

---

## Success Metrics

1. **Performance**
   - 60 FPS with 10,000 nodes
   - <100ms interaction response time
   - <500MB memory usage

2. **Mobile Support**
   - Touch gestures working
   - 30 FPS on mid-range devices
   - Automatic quality adaptation

3. **Code Quality**
   - 100% TypeScript coverage
   - <300 lines per component
   - Zero memory leaks

4. **User Experience**
   - Smooth animations
   - Intuitive controls
   - Accessibility fallbacks

---

## Conclusion

This refactoring guide provides a comprehensive roadmap for modernizing the five Tier 2 components. By following these patterns and implementing the suggested architectures, the components will achieve:

- **Better Performance**: Through WebGL optimization, instancing, and LOD systems
- **Improved Maintainability**: Via modular architecture and shared utilities
- **Enhanced User Experience**: With smooth animations and intuitive controls
- **Mobile Support**: Through adaptive quality and touch controls
- **Future-Proofing**: Using modern libraries and patterns that will remain relevant

The key to success is incremental implementation, thorough testing, and maintaining backward compatibility during the migration process.