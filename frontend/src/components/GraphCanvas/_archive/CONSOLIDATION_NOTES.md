# Canvas Component Consolidation Notes

## Date: 2025-01-23

### Components Archived
The following duplicate/unused canvas components were moved to this archive folder:
- `D3GraphCanvas.tsx` - Old version with Legend button
- `GraphCanvas.tsx` - Original canvas implementation
- `OptimizedGraphCanvas.tsx` - Alternative optimization attempt
- `SimpleGraphCanvas.tsx` - Simplified version
- `SimpleGPUCanvas.tsx` - GPU-accelerated attempt
- `DataDebugCanvas.tsx` - Debug visualization
- `D3ForceSimulation.tsx` - Separate simulation module
- `ThreeD3CanvasOLD.tsx` - Old 3D implementation

### Active Components
The following components remain active:
- `WorkingD3Canvas.tsx` - Primary 2D visualization with all features
- `ThreeD3CanvasEnhanced.tsx` - Active 3D visualization
- `TestThree3D.tsx` - 3D testing component
- `InteractionLayer.tsx` - Shared interaction handling
- `WebGLRenderer.tsx` - WebGL rendering utilities

### Features Consolidated into WorkingD3Canvas
✅ Artist and title display on nodes
✅ Smart edge labels (no redundancy)
✅ Edge culling for performance
✅ Viewport-based rendering optimization
✅ Zoom-adaptive edge density
✅ Static layout after initial calculation
✅ Manual node dragging without simulation restart
✅ Slider-based simulation recalculation
✅ All sliders: distancePower, relationshipPower, nodeSize, edgeLabelSize

### Why Consolidation Was Needed
- Multiple canvas versions caused confusion
- Legend button kept reappearing from D3GraphCanvas
- Features were split across different implementations
- Maintenance was difficult with so many versions

### Test Files Updated
- `GraphCanvas.test.tsx`
- `GraphCanvas.a11y.test.tsx`
- `GraphCanvas.performance.test.tsx`
All now import `WorkingD3Canvas` as `GraphCanvas` for compatibility.