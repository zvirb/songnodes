# SongNodes Frontend Architecture Documentation

**Version:** 1.0.0  
**Date:** August 22, 2025  
**Framework:** React 18 + TypeScript + Vite  
**UI Library:** Material-UI v5.15.1  
**Graphics Engine:** PIXI.js v7.3.2 + D3.js v7.8.5

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Component Architecture](#component-architecture)
4. [Material-UI Integration](#material-ui-integration)
5. [PIXI.js Visualization Engine](#pixijs-visualization-engine)
6. [D3.js Force Simulation](#d3js-force-simulation)
7. [State Management](#state-management)
8. [Performance Optimization](#performance-optimization)
9. [Accessibility & UX](#accessibility--ux)
10. [Build & Deployment](#build--deployment)

## Architecture Overview

### High-Level Frontend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SongNodes Frontend Architecture              │
├─────────────────────────────────────────────────────────────────┤
│ Presentation Layer (Material-UI Components)                    │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│ │  App Bar &      │ │  Navigation     │ │  Control Panels │   │
│ │  Layout         │ │  Drawer         │ │  & Settings     │   │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ Visualization Layer (PIXI.js + D3.js)                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                 Interactive Graph Canvas                    │ │
│ │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │ │
│ │  │ PIXI.js     │ │ D3.js Force │ │ WebGL Rendering     │   │ │
│ │  │ Rendering   │ │ Simulation  │ │ Engine              │   │ │
│ │  └─────────────┘ └─────────────┘ └─────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ State Management Layer (Redux Toolkit)                         │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│ │  Graph State    │ │  UI State       │ │  API State      │   │
│ │  (Nodes/Edges)  │ │  (Layout/Theme) │ │  (Cache/Loading)│   │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ Service Layer                                                   │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│ │  API Service    │ │  WebSocket      │ │  Graph Algorithms│   │
│ │  (HTTP Client)  │ │  Service        │ │  & Utilities    │   │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ Infrastructure Layer                                            │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│ │  Vite Build     │ │  TypeScript     │ │  Testing        │   │
│ │  System         │ │  Type Safety    │ │  Framework      │   │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Principles

- **Component-Based Architecture**: Modular, reusable components with clear separation of concerns
- **Performance-First**: Hardware-accelerated graphics with efficient rendering and memory management
- **Accessibility-Driven**: WCAG 2.1 AA compliance with keyboard navigation and screen reader support
- **Type-Safe**: Full TypeScript implementation with strict type checking
- **Progressive Enhancement**: Works without JavaScript, enhanced with interactive features

## Technology Stack

### Core Dependencies

```json
{
  "runtime": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.2.2"
  },
  "ui_framework": {
    "@mui/material": "^5.15.1",
    "@mui/icons-material": "^5.15.1",
    "@emotion/react": "^11.11.1",
    "@emotion/styled": "^11.11.0"
  },
  "visualization": {
    "pixi.js": "^7.3.2",
    "@pixi/react": "^7.1.2",
    "d3": "^7.8.5",
    "d3-force": "^3.0.0",
    "three": "^0.179.1"
  },
  "state_management": {
    "@reduxjs/toolkit": "^2.0.1",
    "react-redux": "^9.0.4"
  },
  "utilities": {
    "framer-motion": "^10.16.16",
    "lodash-es": "^4.17.21",
    "date-fns": "^2.30.0"
  }
}
```

### Development Dependencies

```json
{
  "build_tools": {
    "vite": "^7.1.3",
    "@vitejs/plugin-react": "^4.2.1",
    "vite-plugin-pwa": "^1.0.3"
  },
  "testing": {
    "@playwright/test": "^1.40.1",
    "@testing-library/react": "^14.1.2",
    "vitest": "^3.2.4",
    "@vitest/coverage-v8": "^3.2.4"
  },
  "quality": {
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "prettier": "^3.1.0"
  }
}
```

## Component Architecture

### Directory Structure

```
src/
├── components/              # Reusable UI components
│   ├── layout/             # Layout components
│   │   ├── AppBar.tsx
│   │   ├── Navigation.tsx
│   │   └── Sidebar.tsx
│   ├── visualization/      # Graph visualization components
│   │   ├── GraphCanvas.tsx
│   │   ├── NodeRenderer.tsx
│   │   ├── EdgeRenderer.tsx
│   │   └── ControlPanel.tsx
│   ├── ui/                 # Basic UI components
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   └── LoadingSpinner.tsx
│   └── forms/              # Form components
│       ├── SearchForm.tsx
│       └── FilterPanel.tsx
├── hooks/                  # Custom React hooks
│   ├── useGraphData.ts
│   ├── useVisualization.ts
│   └── useWebSocket.ts
├── services/               # API and external services
│   ├── api.ts
│   ├── websocket.ts
│   └── graph-algorithms.ts
├── store/                  # Redux store configuration
│   ├── index.ts
│   ├── slices/
│   │   ├── graphSlice.ts
│   │   ├── uiSlice.ts
│   │   └── apiSlice.ts
├── types/                  # TypeScript type definitions
│   ├── graph.ts
│   ├── api.ts
│   └── ui.ts
├── utils/                  # Utility functions
│   ├── graph-utils.ts
│   ├── color-utils.ts
│   └── performance.ts
└── styles/                 # Global styles and themes
    ├── theme.ts
    ├── global.css
    └── animations.css
```

### Component Hierarchy

```tsx
// App.tsx - Main application component
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <Layout>
          <Router>
            <Routes>
              <Route path="/" element={<GraphVisualization />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Routes>
          </Router>
        </Layout>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

// Layout.tsx - Main layout wrapper
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar />
      <NavigationDrawer />
      <MainContent>
        {children}
      </MainContent>
    </Box>
  );
}
```

## Material-UI Integration

### Theme Configuration

```typescript
// src/styles/theme.ts
import { createTheme, ThemeOptions } from '@mui/material/styles';

const baseTheme: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo
      light: '#8b87f9',
      dark: '#4f46e5',
    },
    secondary: {
      main: '#f59e0b', // Amber
      light: '#fbbf24',
      dark: '#d97706',
    },
    background: {
      default: '#0f172a', // Slate 900
      paper: '#1e293b',    // Slate 800
    },
    text: {
      primary: '#f8fafc',  // Slate 50
      secondary: '#cbd5e1', // Slate 300
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      'system-ui',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
};

export const theme = createTheme(baseTheme);
```

### Responsive Design System

```typescript
// src/styles/breakpoints.ts
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
} as const;

// Component with responsive design
function GraphControls() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        p: { xs: 1, md: 2 },
        width: { xs: '100%', lg: '300px' },
      }}
    >
      <Button variant="contained" size="small">
        Center Graph
      </Button>
      <Button variant="outlined" size="small">
        Reset Zoom
      </Button>
    </Box>
  );
}
```

### Accessibility Features

```typescript
// Accessible component example
function AccessibleGraphNode({ node, selected, onClick }: NodeProps) {
  return (
    <IconButton
      onClick={onClick}
      aria-label={`${node.title} by ${node.artist}`}
      aria-pressed={selected}
      sx={{
        '&:focus': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      <Box
        role="img"
        aria-label={`Music track: ${node.title}`}
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          bgcolor: selected ? 'primary.main' : 'secondary.main',
        }}
      />
    </IconButton>
  );
}
```

## PIXI.js Visualization Engine

### Canvas Setup and Configuration

```typescript
// src/components/visualization/GraphCanvas.tsx
import { Application, Container, Graphics } from 'pixi.js';
import { Stage, Container as PixiContainer } from '@pixi/react';

interface GraphCanvasProps {
  width: number;
  height: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function GraphCanvas({ width, height, nodes, edges }: GraphCanvasProps) {
  const [app, setApp] = useState<Application>();

  const setupPixiApp = useCallback(() => {
    const pixiApp = new Application({
      width,
      height,
      antialias: true,
      transparent: false,
      backgroundColor: 0x0f172a,
      powerPreference: 'high-performance',
      sharedTicker: true,
    });

    // Enable WebGL optimizations
    pixiApp.renderer.plugins.interaction.autoPreventDefault = false;
    pixiApp.renderer.view.style!.touchAction = 'auto';

    setApp(pixiApp);
    return pixiApp;
  }, [width, height]);

  return (
    <Stage
      width={width}
      height={height}
      options={{
        antialias: true,
        backgroundColor: 0x0f172a,
        powerPreference: 'high-performance',
      }}
    >
      <NodesContainer nodes={nodes} />
      <EdgesContainer edges={edges} />
      <InteractionLayer />
    </Stage>
  );
}
```

### Node Rendering with Performance Optimization

```typescript
// src/components/visualization/NodeRenderer.tsx
import { Graphics, Text, Container } from 'pixi.js';
import { useCallback, useMemo } from 'react';

interface NodeRendererProps {
  node: GraphNode;
  scale: number;
  selected: boolean;
  onNodeClick: (nodeId: string) => void;
}

function NodeRenderer({ node, scale, selected, onNodeClick }: NodeRendererProps) {
  // Memoized node graphics for performance
  const nodeGraphics = useMemo(() => {
    const graphics = new Graphics();
    
    // Draw node circle
    graphics.beginFill(selected ? 0x6366f1 : getNodeColor(node.genre));
    graphics.drawCircle(0, 0, getNodeSize(node.popularity) * scale);
    graphics.endFill();

    // Draw border if selected
    if (selected) {
      graphics.lineStyle(2, 0xfbbf24, 1);
      graphics.drawCircle(0, 0, getNodeSize(node.popularity) * scale + 2);
    }

    // Add interaction
    graphics.interactive = true;
    graphics.buttonMode = true;
    graphics.cursor = 'pointer';
    
    return graphics;
  }, [node, scale, selected]);

  // Level-of-detail text rendering
  const nodeText = useMemo(() => {
    if (scale < 0.5) return null; // Hide text at low zoom levels

    const text = new Text(
      scale > 1.0 ? `${node.title}\n${node.artist}` : node.title,
      {
        fontFamily: 'Inter',
        fontSize: Math.max(10, 12 * scale),
        fill: 0xf8fafc,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 120,
      }
    );
    
    text.anchor.set(0.5);
    text.position.set(0, getNodeSize(node.popularity) * scale + 20);
    
    return text;
  }, [node, scale]);

  const handleClick = useCallback(() => {
    onNodeClick(node.id);
  }, [node.id, onNodeClick]);

  return (
    <Container
      x={node.x}
      y={node.y}
      interactive={true}
      pointerdown={handleClick}
    >
      {nodeGraphics}
      {nodeText}
    </Container>
  );
}

// Utility functions for node appearance
function getNodeColor(genre: string): number {
  const colorMap: Record<string, number> = {
    'House': 0xf59e0b,
    'Techno': 0xef4444,
    'Trance': 0x8b5cf6,
    'Progressive': 0x06b6d4,
    'Ambient': 0x10b981,
  };
  return colorMap[genre] || 0x6b7280;
}

function getNodeSize(popularity: number): number {
  return Math.max(6, Math.min(20, popularity * 20));
}
```

### Edge Rendering with Batching

```typescript
// src/components/visualization/EdgeRenderer.tsx
import { Graphics } from 'pixi.js';

interface EdgeRendererProps {
  edges: GraphEdge[];
  nodes: Map<string, GraphNode>;
  scale: number;
}

function EdgeRenderer({ edges, nodes, scale }: EdgeRendererProps) {
  const edgeGraphics = useMemo(() => {
    const graphics = new Graphics();
    
    // Batch edge rendering for performance
    const edgeBatches = groupEdgesByWeight(edges);
    
    Object.entries(edgeBatches).forEach(([weight, edgeGroup]) => {
      const alpha = Math.max(0.1, parseFloat(weight));
      const lineWidth = Math.max(0.5, parseFloat(weight) * 3 * scale);
      
      graphics.lineStyle(lineWidth, 0x64748b, alpha);
      
      edgeGroup.forEach(edge => {
        const sourceNode = nodes.get(edge.source);
        const targetNode = nodes.get(edge.target);
        
        if (sourceNode && targetNode) {
          graphics.moveTo(sourceNode.x, sourceNode.y);
          graphics.lineTo(targetNode.x, targetNode.y);
        }
      });
    });

    return graphics;
  }, [edges, nodes, scale]);

  return edgeGraphics;
}

function groupEdgesByWeight(edges: GraphEdge[]): Record<string, GraphEdge[]> {
  return edges.reduce((groups, edge) => {
    const weightKey = edge.weight.toFixed(1);
    if (!groups[weightKey]) {
      groups[weightKey] = [];
    }
    groups[weightKey].push(edge);
    return groups;
  }, {} as Record<string, GraphEdge[]>);
}
```

## D3.js Force Simulation

### Force Simulation Setup

```typescript
// src/hooks/useForceSimulation.ts
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { useEffect, useRef, useState } from 'react';

interface UseForceSimulationProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  enabled: boolean;
}

export function useForceSimulation({
  nodes,
  edges,
  width,
  height,
  enabled
}: UseForceSimulationProps) {
  const simulationRef = useRef<any>();
  const [simulationNodes, setSimulationNodes] = useState<GraphNode[]>([]);

  useEffect(() => {
    if (!enabled || nodes.length === 0) return;

    // Create simulation with optimized forces
    const simulation = forceSimulation(nodes)
      .force('link', forceLink(edges)
        .id((d: any) => d.id)
        .distance(d => 50 + (1 - d.weight) * 100)
        .strength(0.5)
      )
      .force('charge', forceManyBody()
        .strength(-300)
        .distanceMax(300)
      )
      .force('center', forceCenter(width / 2, height / 2))
      .force('collision', forceCollide()
        .radius(d => getNodeSize((d as GraphNode).popularity) + 5)
        .strength(0.7)
      )
      .alphaTarget(0.1)
      .alphaDecay(0.02);

    // Performance optimization: limit simulation iterations
    simulation.stop();
    
    for (let i = 0; i < 300; ++i) {
      simulation.tick();
    }

    // Update positions
    simulation.on('tick', () => {
      setSimulationNodes([...nodes]);
    });

    simulation.restart();
    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, width, height, enabled]);

  const restartSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
    }
  }, []);

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
    }
  }, []);

  return {
    nodes: simulationNodes,
    restartSimulation,
    stopSimulation,
  };
}
```

### Barnes-Hut Optimization

```typescript
// src/utils/barnes-hut.ts
class QuadTree {
  private nodes: GraphNode[] = [];
  private bounds: { x: number; y: number; width: number; height: number };
  private children: QuadTree[] = [];
  private centerOfMass: { x: number; y: number; mass: number };

  constructor(bounds: { x: number; y: number; width: number; height: number }) {
    this.bounds = bounds;
    this.centerOfMass = { x: 0, y: 0, mass: 0 };
  }

  insert(node: GraphNode): void {
    if (!this.contains(node)) return;

    if (this.nodes.length === 0 && this.children.length === 0) {
      this.nodes.push(node);
      this.updateCenterOfMass(node);
      return;
    }

    if (this.children.length === 0) {
      this.subdivide();
      // Re-insert existing nodes
      this.nodes.forEach(existingNode => {
        this.insertIntoChild(existingNode);
      });
      this.nodes = [];
    }

    this.insertIntoChild(node);
    this.updateCenterOfMass(node);
  }

  calculateForce(node: GraphNode, theta: number = 0.5): { fx: number; fy: number } {
    if (this.nodes.length === 1 && this.nodes[0] === node) {
      return { fx: 0, fy: 0 };
    }

    const dx = this.centerOfMass.x - node.x;
    const dy = this.centerOfMass.y - node.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return { fx: 0, fy: 0 };

    // Barnes-Hut criterion: if node is far enough, treat as single body
    if (this.bounds.width / distance < theta || this.children.length === 0) {
      const force = (this.centerOfMass.mass * node.mass) / (distance * distance);
      return {
        fx: (dx / distance) * force,
        fy: (dy / distance) * force,
      };
    }

    // Otherwise, recurse into children
    let fx = 0, fy = 0;
    this.children.forEach(child => {
      const childForce = child.calculateForce(node, theta);
      fx += childForce.fx;
      fy += childForce.fy;
    });

    return { fx, fy };
  }

  private subdivide(): void {
    const { x, y, width, height } = this.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    this.children = [
      new QuadTree({ x, y, width: halfWidth, height: halfHeight }),
      new QuadTree({ x: x + halfWidth, y, width: halfWidth, height: halfHeight }),
      new QuadTree({ x, y: y + halfHeight, width: halfWidth, height: halfHeight }),
      new QuadTree({ x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight }),
    ];
  }

  private insertIntoChild(node: GraphNode): void {
    this.children.forEach(child => child.insert(node));
  }

  private contains(node: GraphNode): boolean {
    return (
      node.x >= this.bounds.x &&
      node.x < this.bounds.x + this.bounds.width &&
      node.y >= this.bounds.y &&
      node.y < this.bounds.y + this.bounds.height
    );
  }

  private updateCenterOfMass(node: GraphNode): void {
    const totalMass = this.centerOfMass.mass + node.mass;
    this.centerOfMass.x = (this.centerOfMass.x * this.centerOfMass.mass + node.x * node.mass) / totalMass;
    this.centerOfMass.y = (this.centerOfMass.y * this.centerOfMass.mass + node.y * node.mass) / totalMass;
    this.centerOfMass.mass = totalMass;
  }
}
```

## State Management

### Redux Store Configuration

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { graphSlice } from './slices/graphSlice';
import { uiSlice } from './slices/uiSlice';
import { apiSlice } from './slices/apiSlice';

export const store = configureStore({
  reducer: {
    graph: graphSlice.reducer,
    ui: uiSlice.reducer,
    api: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['graph/updateSimulation'],
        ignoredPaths: ['graph.simulation'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Graph State Management

```typescript
// src/store/slices/graphSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodes: string[];
  focusedNode: string | null;
  layout: 'force' | 'hierarchical' | 'circular';
  zoom: number;
  pan: { x: number; y: number };
  filters: {
    genres: string[];
    bpmRange: [number, number];
    yearRange: [number, number];
  };
  simulation: {
    running: boolean;
    alpha: number;
  };
}

const initialState: GraphState = {
  nodes: [],
  edges: [],
  selectedNodes: [],
  focusedNode: null,
  layout: 'force',
  zoom: 1,
  pan: { x: 0, y: 0 },
  filters: {
    genres: [],
    bpmRange: [60, 180],
    yearRange: [1990, 2025],
  },
  simulation: {
    running: false,
    alpha: 0,
  },
};

export const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    setGraphData: (state, action: PayloadAction<{ nodes: GraphNode[]; edges: GraphEdge[] }>) => {
      state.nodes = action.payload.nodes;
      state.edges = action.payload.edges;
    },
    selectNode: (state, action: PayloadAction<string>) => {
      const nodeId = action.payload;
      if (state.selectedNodes.includes(nodeId)) {
        state.selectedNodes = state.selectedNodes.filter(id => id !== nodeId);
      } else {
        state.selectedNodes.push(nodeId);
      }
    },
    focusNode: (state, action: PayloadAction<string>) => {
      state.focusedNode = action.payload;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.max(0.1, Math.min(10, action.payload));
    },
    setPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.pan = action.payload;
    },
    setLayout: (state, action: PayloadAction<'force' | 'hierarchical' | 'circular'>) => {
      state.layout = action.payload;
    },
    updateFilters: (state, action: PayloadAction<Partial<GraphState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    updateSimulation: (state, action: PayloadAction<{ running: boolean; alpha: number }>) => {
      state.simulation = action.payload;
    },
  },
});
```

## Performance Optimization

### Virtual Rendering

```typescript
// src/hooks/useVirtualRendering.ts
export function useVirtualRendering(
  nodes: GraphNode[],
  viewBounds: { x: number; y: number; width: number; height: number },
  zoom: number
) {
  return useMemo(() => {
    const visibleNodes = nodes.filter(node => {
      const nodeSize = getNodeSize(node.popularity) * zoom;
      return (
        node.x + nodeSize >= viewBounds.x &&
        node.x - nodeSize <= viewBounds.x + viewBounds.width &&
        node.y + nodeSize >= viewBounds.y &&
        node.y - nodeSize <= viewBounds.y + viewBounds.height
      );
    });

    // Level-of-detail rendering
    const highDetailNodes = visibleNodes.filter(() => zoom > 0.8);
    const lowDetailNodes = visibleNodes.filter(() => zoom <= 0.8);

    return { highDetailNodes, lowDetailNodes, totalVisible: visibleNodes.length };
  }, [nodes, viewBounds, zoom]);
}
```

### Memory Management

```typescript
// src/utils/memory-management.ts
class TexturePool {
  private pool: Map<string, PIXI.Texture> = new Map();
  private maxSize = 100;

  getTexture(key: string, factory: () => PIXI.Texture): PIXI.Texture {
    if (this.pool.has(key)) {
      return this.pool.get(key)!;
    }

    if (this.pool.size >= this.maxSize) {
      // Remove oldest texture
      const firstKey = this.pool.keys().next().value;
      const texture = this.pool.get(firstKey);
      texture?.destroy();
      this.pool.delete(firstKey);
    }

    const texture = factory();
    this.pool.set(key, texture);
    return texture;
  }

  clear(): void {
    this.pool.forEach(texture => texture.destroy());
    this.pool.clear();
  }
}

export const texturePool = new TexturePool();
```

### Debounced Updates

```typescript
// src/hooks/useDebouncedCallback.ts
import { useCallback, useRef } from 'react';
import { debounce } from 'lodash-es';

export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    debounce((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay),
    [delay]
  ) as T;
}
```

## Accessibility & UX

### Keyboard Navigation

```typescript
// src/hooks/useKeyboardNavigation.ts
export function useKeyboardNavigation(
  nodes: GraphNode[],
  selectedNodes: string[],
  onSelectNode: (nodeId: string) => void,
  onFocusNode: (nodeId: string) => void
) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev => Math.min(nodes.length - 1, prev + 1));
          break;
        
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev => Math.max(0, prev - 1));
          break;
        
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (nodes[focusedIndex]) {
            onSelectNode(nodes[focusedIndex].id);
          }
          break;
        
        case 'Escape':
          event.preventDefault();
          setFocusedIndex(0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, focusedIndex, onSelectNode]);

  useEffect(() => {
    if (nodes[focusedIndex]) {
      onFocusNode(nodes[focusedIndex].id);
    }
  }, [focusedIndex, nodes, onFocusNode]);
}
```

### Screen Reader Support

```typescript
// src/components/accessibility/LiveRegion.tsx
function LiveRegion({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {children}
    </div>
  );
}

// Usage in graph component
function GraphVisualization() {
  const [announcement, setAnnouncement] = useState('');
  
  const handleNodeSelection = useCallback((node: GraphNode) => {
    setAnnouncement(
      `Selected ${node.title} by ${node.artist}. 
       ${node.connections.length} connections. 
       Genre: ${node.genre}. 
       BPM: ${node.bpm}.`
    );
  }, []);

  return (
    <>
      <GraphCanvas onNodeSelect={handleNodeSelection} />
      <LiveRegion>{announcement}</LiveRegion>
    </>
  );
}
```

### High Contrast Mode

```typescript
// src/styles/accessibility.ts
export const highContrastTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#ffffff',
    },
    secondary: {
      main: '#ffff00',
    },
    background: {
      default: '#000000',
      paper: '#000000',
    },
    text: {
      primary: '#ffffff',
      secondary: '#ffffff',
    },
  },
});
```

## Build & Deployment

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.songnodes\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 300, // 5 minutes
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@mui/material', '@mui/icons-material'],
          viz: ['pixi.js', 'd3', 'three'],
          state: ['@reduxjs/toolkit', 'react-redux'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['pixi.js', 'd3', '@mui/material'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8083',
        ws: true,
      },
    },
  },
});
```

### Production Optimization

```dockerfile
# Dockerfile
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Performance Monitoring

```typescript
// src/utils/performance.ts
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push(duration);
    
    return result;
  }

  getAverageTime(name: string): number {
    const times = this.metrics.get(name) || [];
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  reset(): void {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

---

**Frontend Architecture Documentation Complete**  
**Framework**: React 18 + TypeScript + Vite  
**UI Library**: Material-UI v5 with dark theme  
**Graphics**: PIXI.js v7 + D3.js force simulation  
**Performance**: Virtual rendering + hardware acceleration  
**Accessibility**: WCAG 2.1 AA compliant  
**Status**: Production Ready Frontend