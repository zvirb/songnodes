# Particle Life Physics Mode

## Overview

The **Particle Life** physics mode is an emergent visualization system inspired by [Particle Life simulations](https://github.com/hunar4321/particle-life) and the research paper "Emergent Worlds: Simulating Life-Like Physics Patterns with D3.js". This mode creates living, dynamic patterns where music tracks interact based on their musical properties (genre, key, energy) through asymmetric attraction/repulsion forces.

## What Makes It Special

Unlike traditional physics simulations that follow Newton's third law (equal and opposite reactions), Particle Life uses **asymmetric forces**:

- Genre A might attract Genre B while B simultaneously repels A
- This creates continuous energy injection and motion
- Produces emergent behaviors like:
  - **Flocking**: Similar tracks moving together
  - **Orbiting**: Tracks circling each other
  - **Chasing**: Predator-prey dynamics between genres
  - **Clustering**: Self-organizing genre groups

## How It Works

### 1. Musical Interaction Matrix

Each genre has defined interaction strengths with every other genre:

```typescript
const particleLifeMatrix = {
  'house': {
    'house': 0.2,      // Mild self-attraction
    'techno': 0.3,     // Attracted to techno
    'trance': -0.1,    // Repelled by trance
    'dubstep': -0.2,   // Repelled by dubstep
    // ...
  },
  'techno': {
    'house': -0.1,     // Repelled by house (asymmetric!)
    'techno': 0.3,     // Self-attraction
    'trance': 0.4,     // Strongly attracted to trance
    // ...
  },
  // ... more genres
}
```

**Values**:
- `-1.0 to 0.0` = Repulsion (flee)
- `0.0 to +1.0` = Attraction (chase)

### 2. Force Calculation

For each pair of tracks within the interaction radius:

```typescript
// Asymmetric force calculation
force_A_from_B = matrix[genreA][genreB] / distance
force_B_from_A = matrix[genreB][genreA] / distance  // Different!

// Apply forces
nodeA.velocity += force_A_from_B * direction
nodeB.velocity -= force_B_from_A * direction
```

### 3. Continuous Simulation

Unlike other modes that "cool down" and settle:

```typescript
simulation.alphaDecay(0);      // NO COOLING - stays active
simulation.alphaMin(0.3);      // Minimum energy threshold
simulation.velocityDecay(0);   // Damping in custom force
```

The simulation runs continuously, creating ever-changing patterns!

## Usage

### Switching to Particle Life Mode

1. **Right-click** on empty space in the graph visualization
2. Select **"Particle Life (Emergent)"** from the Layout Mode menu
3. Watch the tracks come alive!

### Adjusting Parameters

The following parameters can be tuned in the `forceSettings` state:

- **`particleLifeInteractionRadius`** (default: 150)
  - Range at which tracks influence each other
  - Larger = more global interactions
  - Smaller = more localized clusters

- **`particleLifeDamping`** (default: 0.4)
  - Velocity retention per tick
  - 0.4 = 60% velocity retained
  - Higher = more energy/motion
  - Lower = more stability

- **`particleLifeStrength`** (default: 1.0)
  - Global multiplier for all interaction forces
  - Higher = stronger forces, faster movement
  - Lower = gentler, slower patterns

### Editing the Interaction Matrix

To customize genre relationships, edit the `particleLifeMatrix` in `GraphVisualization.tsx`:

```typescript
const particleLifeMatrix: ParticleLifeInteractionMatrix = {
  'your-genre': {
    'other-genre': 0.5,  // Attract
    'another-genre': -0.3, // Repel
  },
  // ...
}
```

## Visual Feedback

- **Genre-based coloring**: Tracks are colored by their genre for easy visual distinction
- **Continuous motion**: The simulation never settles, creating living patterns
- **Collision prevention**: Weak collision forces prevent overlap while allowing free movement

## Performance Considerations

### Complexity

The current implementation uses **O(n²)** complexity, checking all pairs of nodes:

```typescript
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    // Check distance and apply forces
  }
}
```

### Optimization for Large Graphs

For graphs with >500 nodes, consider adding a **spatial index** (quadtree):

```typescript
// Build quadtree once per tick
const quadtree = d3.quadtree()
  .x(d => d.x)
  .y(d => d.y)
  .addAll(nodes);

// For each node, query only nearby neighbors
nodes.forEach(nodeA => {
  quadtree.visit((quad, x1, y1, x2, y2) => {
    // Only check nodes within interaction radius
    if (distance < interactionRadius) {
      // Apply forces
    }
  });
});
```

This reduces complexity from O(n²) to O(n log n).

## Implementation Details

### Key Files Modified

1. **`frontend/src/components/GraphVisualization.tsx`**
   - Added `'particle-life'` to `LayoutMode` type
   - Extended `ForceSettings` interface
   - Created `particleLifeMatrix` interaction matrix
   - Implemented `particleLifeForce()` custom D3 force
   - Integrated particle-life into simulation configuration
   - Added genre-based coloring for particle-life mode

2. **`frontend/src/components/ContextMenu.tsx`**
   - Added "Particle Life (Emergent)" menu option
   - Updated `switchLayoutMode()` type signature

### Simulation Configuration

```typescript
if (forceSettings.layoutMode === 'particle-life') {
  // Disable standard forces
  simulation.force('x', null);
  simulation.force('genre-cluster', null);
  simulation.force('center', null);

  // Enable particle life force
  simulation.force('particle-life', particleLifeForce);

  // Prevent cooling
  simulation.alphaDecay(0);
  simulation.alphaMin(0.3);
  simulation.velocityDecay(0);

  // Weak collision
  simulation.force('collide', forceCollide()
    .radius(d => d.radius * 1.5)
    .strength(0.3)
  );
}
```

## Troubleshooting

### Nodes Flying Off Screen

- **Cause**: Interaction forces too strong or damping too low
- **Solution**:
  - Reduce `particleLifeStrength` (e.g., 0.5)
  - Increase `particleLifeDamping` (e.g., 0.6)

### Simulation Too Slow

- **Cause**: Too many nodes (>500)
- **Solution**:
  - Add quadtree spatial indexing (see Performance section)
  - Filter graph to fewer nodes

### No Movement

- **Cause**: Alpha cooled down or no genre data
- **Solution**:
  - Verify `alphaDecay` is 0
  - Check that nodes have `genre` property
  - Ensure genres exist in interaction matrix

## Future Enhancements

1. **Adaptive Interaction Matrix**: Learn genre relationships from play history
2. **Multi-Property Forces**: Combine genre, key, and energy interactions
3. **Temporal Patterns**: Create time-based attraction/repulsion cycles
4. **3D Particle Life**: Extend to 3D visualization with Three.js
5. **User-Editable Matrix**: UI for customizing interaction strengths

## References

- [Particle Life GitHub](https://github.com/hunar4321/particle-life)
- [Emergent Worlds: D3.js Physics Patterns](https://example.com) (inspiration document)
- [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life)
- [Boids Algorithm](https://en.wikipedia.org/wiki/Boids)
- [Reaction-Diffusion Systems](https://en.wikipedia.org/wiki/Reaction%E2%80%93diffusion_system)

## Credits

**Implementation**: Claude Code (2025)
**Inspiration**: Particle Life by hunar4321, "Emergent Worlds" research paper
**Project**: SongNodes - Music Graph Visualization Platform
