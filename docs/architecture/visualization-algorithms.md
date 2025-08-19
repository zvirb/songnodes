# Visualization Algorithms & Techniques

## Overview

This document details the core algorithms and mathematical techniques used in the SongNodes Phase 6 visualization system. These algorithms power the graph layout, path-finding, clustering, and recommendation features that enable intelligent music exploration.

## Graph Layout Algorithms

### 1. Force-Directed Layout (Fruchterman-Reingold)

The primary layout algorithm for interactive graph visualization, simulating physical forces between nodes.

```typescript
interface ForceDirectedLayout {
  // Core algorithm parameters
  parameters: {
    iterations: number;              // Default: 500
    temperature: number;             // Initial: 1000, cooling rate: 0.95
    idealDistance: number;           // k = sqrt(area / nodeCount)
    gravity: number;                 // Central attraction: 0.1
    repulsion: number;              // Node repulsion strength: 1.0
    attraction: number;             // Edge attraction strength: 0.01
  };
  
  // Force calculations
  forces: {
    repulsive: (distance: number, k: number) => {
      // F_rep = k² / distance
      return (k * k) / distance;
    };
    
    attractive: (distance: number, k: number) => {
      // F_attr = distance² / k
      return (distance * distance) / k;
    };
    
    gravity: (position: Vector, center: Vector, strength: number) => {
      // F_grav = strength * (center - position)
      return center.subtract(position).multiply(strength);
    };
  };
  
  // Algorithm implementation
  algorithm: {
    initialize: () => {
      // Random or circular initial placement
      nodes.forEach(node => {
        node.position = randomPosition(bounds);
        node.velocity = Vector.zero();
      });
    };
    
    iterate: () => {
      // Calculate repulsive forces between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const delta = nodes[i].position.subtract(nodes[j].position);
          const distance = Math.max(delta.magnitude(), 0.01);
          const force = repulsive(distance, idealDistance);
          
          nodes[i].velocity.add(delta.normalize().multiply(force));
          nodes[j].velocity.subtract(delta.normalize().multiply(force));
        }
      }
      
      // Calculate attractive forces along edges
      edges.forEach(edge => {
        const delta = edge.target.position.subtract(edge.source.position);
        const distance = delta.magnitude();
        const force = attractive(distance, idealDistance) * edge.weight;
        
        edge.source.velocity.add(delta.normalize().multiply(force));
        edge.target.velocity.subtract(delta.normalize().multiply(force));
      });
      
      // Apply forces with temperature cooling
      nodes.forEach(node => {
        const displacement = node.velocity.multiply(temperature);
        node.position.add(displacement.limit(temperature));
        node.velocity.multiply(damping);
      });
      
      temperature *= coolingRate;
    };
  };
  
  // Optimization techniques
  optimizations: {
    barnesHut: {
      // Quadtree/Octree for O(n log n) complexity
      theta: 0.8;  // Accuracy parameter
      buildTree: () => QuadTree;
      calculateForces: () => void;
    };
    
    multilevel: {
      // Coarsen graph, layout, then refine
      coarsenLevels: 3;
      coarsenRatio: 0.5;
      refinementIterations: 50;
    };
    
    gpu: {
      // WebGL/CUDA acceleration
      useWebGL: boolean;
      maxTextureSize: 4096;
      forceShader: WebGLShader;
    };
  };
}
```

### 2. Hierarchical Layout (Sugiyama Framework)

For displaying genre hierarchies and temporal progressions.

```typescript
interface HierarchicalLayout {
  // Layout phases
  phases: {
    // Phase 1: Cycle removal
    removeCycles: {
      algorithm: 'dfs' | 'greedy' | 'feedback_arc_set';
      
      depthFirstSearch: () => {
        const visited = new Set();
        const recursionStack = new Set();
        const reversedEdges = [];
        
        function dfs(node) {
          visited.add(node);
          recursionStack.add(node);
          
          for (const neighbor of node.neighbors) {
            if (!visited.has(neighbor)) {
              dfs(neighbor);
            } else if (recursionStack.has(neighbor)) {
              // Back edge found - reverse it
              reversedEdges.push([node, neighbor]);
            }
          }
          
          recursionStack.delete(node);
        }
        
        return reversedEdges;
      };
    };
    
    // Phase 2: Layer assignment
    layerAssignment: {
      algorithm: 'longest_path' | 'network_simplex';
      
      longestPath: () => {
        const layers = new Map();
        const topologicalOrder = topologicalSort(graph);
        
        topologicalOrder.forEach(node => {
          const incomingLayers = node.incoming
            .map(edge => layers.get(edge.source))
            .filter(layer => layer !== undefined);
          
          layers.set(node, Math.max(0, ...incomingLayers) + 1);
        });
        
        return layers;
      };
      
      minimizeHeight: boolean;
      minimizeWidth: boolean;
    };
    
    // Phase 3: Crossing minimization
    crossingMinimization: {
      algorithm: 'barycenter' | 'median' | 'sifting';
      iterations: 10;
      
      barycenter: (layer: Node[]) => {
        return layer.sort((a, b) => {
          const avgA = average(a.neighbors.map(n => n.position));
          const avgB = average(b.neighbors.map(n => n.position));
          return avgA - avgB;
        });
      };
      
      countCrossings: (layer1: Node[], layer2: Node[]) => number;
    };
    
    // Phase 4: Coordinate assignment
    coordinateAssignment: {
      algorithm: 'brandes' | 'fast_simplex';
      
      brandesKoepf: () => {
        // Assign x-coordinates minimizing edge bends
        const coordinates = new Map();
        
        // Four alignment passes
        ['up-left', 'up-right', 'down-left', 'down-right'].forEach(align => {
          const aligned = computeAlignment(layers, align);
          const compacted = horizontalCompaction(aligned);
          updateCoordinates(coordinates, compacted);
        });
        
        return balanceCoordinates(coordinates);
      };
      
      nodeSpacing: number;
      layerSpacing: number;
    };
  };
}
```

### 3. Circular Layout

For visualizing cyclic relationships and genre circles.

```typescript
interface CircularLayout {
  // Layout calculation
  calculate: {
    // Basic circular placement
    basic: (nodes: Node[]) => {
      const angleStep = (2 * Math.PI) / nodes.length;
      const radius = calculateRadius(nodes.length);
      
      nodes.forEach((node, index) => {
        const angle = index * angleStep;
        node.position = {
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle)
        };
      });
    };
    
    // Optimized for minimum crossings
    crossingMinimization: () => {
      // Use simulated annealing or genetic algorithm
      let currentOrder = [...nodes];
      let currentCrossings = countCrossings(currentOrder);
      let temperature = 100;
      
      while (temperature > 0.01) {
        const newOrder = permuteNodes(currentOrder);
        const newCrossings = countCrossings(newOrder);
        
        if (acceptChange(currentCrossings, newCrossings, temperature)) {
          currentOrder = newOrder;
          currentCrossings = newCrossings;
        }
        
        temperature *= 0.99;
      }
      
      return currentOrder;
    };
    
    // Group-based circular layout
    grouped: (groups: NodeGroup[]) => {
      const groupAngleStep = (2 * Math.PI) / groups.length;
      
      groups.forEach((group, groupIndex) => {
        const groupAngle = groupIndex * groupAngleStep;
        const groupCenter = {
          x: center.x + groupRadius * Math.cos(groupAngle),
          y: center.y + groupRadius * Math.sin(groupAngle)
        };
        
        // Place nodes within group
        const nodeAngleStep = (Math.PI / 3) / group.nodes.length;
        group.nodes.forEach((node, nodeIndex) => {
          const nodeAngle = groupAngle + (nodeIndex - group.nodes.length/2) * nodeAngleStep;
          node.position = {
            x: center.x + nodeRadius * Math.cos(nodeAngle),
            y: center.y + nodeRadius * Math.sin(nodeAngle)
          };
        });
      });
    };
  };
  
  // Edge routing
  edgeRouting: {
    straight: boolean;
    bundled: {
      enabled: boolean;
      strength: number;  // 0-1
      compatibility: number;  // Edge compatibility threshold
    };
    arc: {
      enabled: boolean;
      height: number;  // Arc height factor
    };
  };
}
```

## Path-Finding Algorithms

### 1. Dijkstra's Algorithm

Classic shortest path algorithm with modifications for musical constraints.

```typescript
class DijkstraPathfinder {
  findPath(
    start: Node,
    end: Node,
    constraints?: PathConstraints
  ): Path | null {
    const distances = new Map<Node, number>();
    const previous = new Map<Node, Node>();
    const unvisited = new PriorityQueue<Node>();
    
    // Initialize
    graph.nodes.forEach(node => {
      distances.set(node, Infinity);
      unvisited.add(node, Infinity);
    });
    distances.set(start, 0);
    unvisited.updatePriority(start, 0);
    
    while (!unvisited.isEmpty()) {
      const current = unvisited.extractMin();
      
      if (current === end) {
        return reconstructPath(previous, end);
      }
      
      for (const edge of current.edges) {
        const neighbor = edge.target;
        
        // Apply constraints
        if (constraints) {
          if (!satisfiesConstraints(edge, constraints)) {
            continue;
          }
        }
        
        // Calculate distance with edge weight
        const edgeDistance = 1 / (edge.weight + 0.01);  // Inverse weight
        const newDistance = distances.get(current) + edgeDistance;
        
        if (newDistance < distances.get(neighbor)) {
          distances.set(neighbor, newDistance);
          previous.set(neighbor, current);
          unvisited.updatePriority(neighbor, newDistance);
        }
      }
    }
    
    return null;  // No path found
  }
  
  // Musical constraint checking
  satisfiesConstraints(edge: Edge, constraints: PathConstraints): boolean {
    const source = edge.source;
    const target = edge.target;
    
    // BPM constraint
    if (constraints.bpmTolerance) {
      const bpmDiff = Math.abs(source.bpm - target.bpm);
      if (bpmDiff > constraints.bpmTolerance) {
        return false;
      }
    }
    
    // Key compatibility
    if (constraints.keyCompatibility) {
      if (!areKeysCompatible(source.key, target.key)) {
        return false;
      }
    }
    
    // Energy progression
    if (constraints.energyProgression) {
      const energyDiff = target.energy - source.energy;
      if (constraints.energyProgression === 'ascending' && energyDiff < -0.1) {
        return false;
      }
      if (constraints.energyProgression === 'descending' && energyDiff > 0.1) {
        return false;
      }
    }
    
    return true;
  }
}
```

### 2. A* Algorithm

Heuristic-based pathfinding for faster results.

```typescript
class AStarPathfinder {
  findPath(
    start: Node,
    end: Node,
    heuristic: HeuristicFunction
  ): Path | null {
    const openSet = new PriorityQueue<Node>();
    const closedSet = new Set<Node>();
    const gScore = new Map<Node, number>();
    const fScore = new Map<Node, number>();
    const previous = new Map<Node, Node>();
    
    // Initialize
    gScore.set(start, 0);
    fScore.set(start, heuristic(start, end));
    openSet.add(start, fScore.get(start));
    
    while (!openSet.isEmpty()) {
      const current = openSet.extractMin();
      
      if (current === end) {
        return reconstructPath(previous, end);
      }
      
      closedSet.add(current);
      
      for (const edge of current.edges) {
        const neighbor = edge.target;
        
        if (closedSet.has(neighbor)) {
          continue;
        }
        
        const tentativeGScore = gScore.get(current) + edgeCost(edge);
        
        if (!gScore.has(neighbor) || tentativeGScore < gScore.get(neighbor)) {
          previous.set(neighbor, current);
          gScore.set(neighbor, tentativeGScore);
          fScore.set(neighbor, tentativeGScore + heuristic(neighbor, end));
          
          if (!openSet.contains(neighbor)) {
            openSet.add(neighbor, fScore.get(neighbor));
          } else {
            openSet.updatePriority(neighbor, fScore.get(neighbor));
          }
        }
      }
    }
    
    return null;
  }
  
  // Musical heuristics
  heuristics = {
    // Euclidean distance in feature space
    euclidean: (a: Node, b: Node): number => {
      const features = ['bpm', 'energy', 'valence', 'danceability'];
      return Math.sqrt(
        features.reduce((sum, feature) => {
          const diff = (a[feature] || 0) - (b[feature] || 0);
          return sum + diff * diff;
        }, 0)
      );
    },
    
    // Genre-based distance
    genreDistance: (a: Node, b: Node): number => {
      const aGenres = new Set(a.genres);
      const bGenres = new Set(b.genres);
      const intersection = new Set([...aGenres].filter(g => bGenres.has(g)));
      const union = new Set([...aGenres, ...bGenres]);
      
      return 1 - (intersection.size / union.size);  // Jaccard distance
    },
    
    // Harmonic distance
    harmonicDistance: (a: Node, b: Node): number => {
      const keyDistance = getKeyDistance(a.key, b.key);
      const bpmRatio = Math.max(a.bpm, b.bpm) / Math.min(a.bpm, b.bpm);
      
      return keyDistance * 0.7 + Math.log(bpmRatio) * 0.3;
    }
  };
}
```

### 3. K-Shortest Paths (Yen's Algorithm)

Finding multiple alternative paths for variety.

```typescript
class YensKShortestPaths {
  findKPaths(
    start: Node,
    end: Node,
    k: number,
    diversityFactor: number = 0
  ): Path[] {
    const paths: Path[] = [];
    const candidates = new PriorityQueue<Path>();
    
    // Find the shortest path
    const shortestPath = dijkstra.findPath(start, end);
    if (!shortestPath) return [];
    
    paths.push(shortestPath);
    
    for (let i = 1; i < k; i++) {
      const previousPath = paths[i - 1];
      
      for (let j = 0; j < previousPath.nodes.length - 1; j++) {
        const spurNode = previousPath.nodes[j];
        const rootPath = previousPath.nodes.slice(0, j + 1);
        
        // Remove edges used in previous paths with same root
        const removedEdges = [];
        for (const path of paths) {
          if (arraysEqual(path.nodes.slice(0, j + 1), rootPath)) {
            const edge = getEdge(path.nodes[j], path.nodes[j + 1]);
            if (edge) {
              graph.removeEdge(edge);
              removedEdges.push(edge);
            }
          }
        }
        
        // Remove nodes in root path (except spur node)
        const removedNodes = [];
        for (let n = 0; n < j; n++) {
          graph.removeNode(rootPath[n]);
          removedNodes.push(rootPath[n]);
        }
        
        // Find shortest path from spur to end
        const spurPath = dijkstra.findPath(spurNode, end);
        
        // Restore graph
        removedEdges.forEach(edge => graph.addEdge(edge));
        removedNodes.forEach(node => graph.addNode(node));
        
        if (spurPath) {
          const totalPath = concatenatePaths(
            rootPath.slice(0, -1),
            spurPath.nodes
          );
          
          // Apply diversity factor
          if (diversityFactor > 0) {
            const diversity = calculateDiversity(totalPath, paths);
            const adjustedCost = totalPath.cost * (1 - diversityFactor * diversity);
            totalPath.adjustedCost = adjustedCost;
          }
          
          candidates.add(totalPath, totalPath.adjustedCost || totalPath.cost);
        }
      }
      
      if (candidates.isEmpty()) {
        break;
      }
      
      const nextPath = candidates.extractMin();
      paths.push(nextPath);
    }
    
    return paths;
  }
  
  calculateDiversity(path: Path, existingPaths: Path[]): number {
    let diversity = 0;
    
    for (const existing of existingPaths) {
      const sharedNodes = path.nodes.filter(node => 
        existing.nodes.includes(node)
      );
      const similarity = sharedNodes.length / 
        Math.max(path.nodes.length, existing.nodes.length);
      diversity += (1 - similarity);
    }
    
    return diversity / existingPaths.length;
  }
}
```

## Clustering Algorithms

### 1. Louvain Community Detection

Fast algorithm for detecting communities in large networks.

```typescript
class LouvainClustering {
  detectCommunities(
    graph: Graph,
    resolution: number = 1.0
  ): Map<Node, number> {
    let communities = new Map<Node, number>();
    let modularity = 0;
    let improved = true;
    
    // Initialize: each node in its own community
    graph.nodes.forEach((node, index) => {
      communities.set(node, index);
    });
    
    while (improved) {
      improved = false;
      
      // Phase 1: Local optimization
      for (const node of randomOrder(graph.nodes)) {
        const currentCommunity = communities.get(node);
        const neighborCommunities = getNeighborCommunities(node, communities);
        
        let bestCommunity = currentCommunity;
        let bestGain = 0;
        
        for (const community of neighborCommunities) {
          const gain = calculateModularityGain(
            node,
            community,
            communities,
            resolution
          );
          
          if (gain > bestGain) {
            bestGain = gain;
            bestCommunity = community;
          }
        }
        
        if (bestCommunity !== currentCommunity) {
          communities.set(node, bestCommunity);
          improved = true;
        }
      }
      
      // Phase 2: Community aggregation
      if (improved) {
        graph = buildCommunityGraph(graph, communities);
        communities = updateCommunities(communities);
      }
    }
    
    return communities;
  }
  
  calculateModularityGain(
    node: Node,
    targetCommunity: number,
    communities: Map<Node, number>,
    resolution: number
  ): number {
    const m = graph.totalWeight;
    const k_i = node.degree;
    const sigma_tot = getCommunityWeight(targetCommunity);
    const k_i_in = getNodeCommunityWeight(node, targetCommunity);
    
    // Modularity gain formula
    const gain = (k_i_in / m) - 
      resolution * ((sigma_tot * k_i) / (2 * m * m));
    
    return gain;
  }
  
  // Musical clustering extensions
  musicalClustering = {
    // Genre-based clustering
    genreClustering: () => {
      const genreWeights = new Map();
      
      graph.edges.forEach(edge => {
        const sourceGenres = new Set(edge.source.genres);
        const targetGenres = new Set(edge.target.genres);
        const sharedGenres = intersection(sourceGenres, targetGenres);
        
        // Increase edge weight for shared genres
        edge.weight *= (1 + 0.5 * sharedGenres.size);
      });
      
      return this.detectCommunities(graph);
    },
    
    // Temporal clustering (by era)
    temporalClustering: () => {
      const timeWindows = [
        { start: 1950, end: 1960, label: '50s' },
        { start: 1960, end: 1970, label: '60s' },
        { start: 1970, end: 1980, label: '70s' },
        { start: 1980, end: 1990, label: '80s' },
        { start: 1990, end: 2000, label: '90s' },
        { start: 2000, end: 2010, label: '00s' },
        { start: 2010, end: 2020, label: '10s' },
        { start: 2020, end: 2030, label: '20s' }
      ];
      
      return clusterByTimeWindows(graph, timeWindows);
    },
    
    // Harmonic clustering (key and BPM)
    harmonicClustering: () => {
      const harmonicGraph = graph.copy();
      
      harmonicGraph.edges.forEach(edge => {
        const keyCompatibility = getKeyCompatibility(
          edge.source.key,
          edge.target.key
        );
        const bpmRatio = Math.min(
          edge.source.bpm / edge.target.bpm,
          edge.target.bpm / edge.source.bpm
        );
        
        edge.weight *= (keyCompatibility * 0.6 + bpmRatio * 0.4);
      });
      
      return this.detectCommunities(harmonicGraph);
    }
  };
}
```

### 2. K-Means Clustering

For clustering based on audio features.

```typescript
class KMeansClustering {
  cluster(
    nodes: Node[],
    k: number,
    features: string[],
    maxIterations: number = 100
  ): Cluster[] {
    // Extract feature vectors
    const vectors = nodes.map(node => 
      features.map(f => node[f] || 0)
    );
    
    // Initialize centroids (k-means++)
    const centroids = this.initializeCentroidsKMeansPlusPlus(vectors, k);
    
    let clusters: Cluster[] = [];
    let iterations = 0;
    let changed = true;
    
    while (changed && iterations < maxIterations) {
      changed = false;
      
      // Assignment step
      const newClusters = Array(k).fill(null).map(() => []);
      
      vectors.forEach((vector, index) => {
        const closestCentroid = this.findClosestCentroid(vector, centroids);
        newClusters[closestCentroid].push(index);
        
        if (!clusters[closestCentroid] || 
            !clusters[closestCentroid].includes(index)) {
          changed = true;
        }
      });
      
      clusters = newClusters;
      
      // Update step
      for (let i = 0; i < k; i++) {
        if (clusters[i].length > 0) {
          centroids[i] = this.calculateCentroid(
            clusters[i].map(idx => vectors[idx])
          );
        }
      }
      
      iterations++;
    }
    
    // Convert to Cluster objects
    return clusters.map((cluster, index) => ({
      id: `cluster_${index}`,
      nodes: cluster.map(idx => nodes[idx]),
      centroid: centroids[index],
      features: features,
      metrics: this.calculateClusterMetrics(
        cluster.map(idx => vectors[idx]),
        centroids[index]
      )
    }));
  }
  
  initializeCentroidsKMeansPlusPlus(
    vectors: number[][],
    k: number
  ): number[][] {
    const centroids = [];
    
    // Choose first centroid randomly
    const firstIndex = Math.floor(Math.random() * vectors.length);
    centroids.push([...vectors[firstIndex]]);
    
    // Choose remaining centroids
    for (let i = 1; i < k; i++) {
      const distances = vectors.map(vector => {
        const minDist = Math.min(
          ...centroids.map(c => this.euclideanDistance(vector, c))
        );
        return minDist * minDist;
      });
      
      // Choose next centroid with probability proportional to distance²
      const totalDistance = distances.reduce((a, b) => a + b, 0);
      let random = Math.random() * totalDistance;
      
      for (let j = 0; j < vectors.length; j++) {
        random -= distances[j];
        if (random <= 0) {
          centroids.push([...vectors[j]]);
          break;
        }
      }
    }
    
    return centroids;
  }
  
  // Silhouette coefficient for cluster quality
  calculateSilhouetteCoefficient(clusters: Cluster[]): number {
    let totalSilhouette = 0;
    let totalPoints = 0;
    
    clusters.forEach((cluster, clusterIndex) => {
      cluster.nodes.forEach(node => {
        // a(i) = average distance to points in same cluster
        const a = this.averageDistance(node, cluster.nodes);
        
        // b(i) = minimum average distance to points in other clusters
        let b = Infinity;
        clusters.forEach((otherCluster, otherIndex) => {
          if (otherIndex !== clusterIndex) {
            const avgDist = this.averageDistance(node, otherCluster.nodes);
            b = Math.min(b, avgDist);
          }
        });
        
        // s(i) = (b(i) - a(i)) / max(a(i), b(i))
        const silhouette = (b - a) / Math.max(a, b);
        totalSilhouette += silhouette;
        totalPoints++;
      });
    });
    
    return totalSilhouette / totalPoints;
  }
}
```

## Graph Analysis Algorithms

### 1. Centrality Measures

Identifying important nodes in the network.

```typescript
class CentralityAnalysis {
  // Degree centrality
  degreeCentrality(node: Node): number {
    return node.edges.length / (graph.nodes.length - 1);
  }
  
  // Betweenness centrality
  betweennessCentrality(graph: Graph): Map<Node, number> {
    const centrality = new Map<Node, number>();
    graph.nodes.forEach(node => centrality.set(node, 0));
    
    for (const source of graph.nodes) {
      const stack = [];
      const predecessors = new Map<Node, Node[]>();
      const sigma = new Map<Node, number>();
      const delta = new Map<Node, number>();
      const distance = new Map<Node, number>();
      
      graph.nodes.forEach(node => {
        predecessors.set(node, []);
        sigma.set(node, 0);
        delta.set(node, 0);
        distance.set(node, -1);
      });
      
      sigma.set(source, 1);
      distance.set(source, 0);
      
      const queue = [source];
      
      // BFS
      while (queue.length > 0) {
        const v = queue.shift();
        stack.push(v);
        
        for (const edge of v.edges) {
          const w = edge.target;
          
          if (distance.get(w) < 0) {
            queue.push(w);
            distance.set(w, distance.get(v) + 1);
          }
          
          if (distance.get(w) === distance.get(v) + 1) {
            sigma.set(w, sigma.get(w) + sigma.get(v));
            predecessors.get(w).push(v);
          }
        }
      }
      
      // Accumulation
      while (stack.length > 0) {
        const w = stack.pop();
        
        for (const v of predecessors.get(w)) {
          const contribution = (sigma.get(v) / sigma.get(w)) * 
                             (1 + delta.get(w));
          delta.set(v, delta.get(v) + contribution);
        }
        
        if (w !== source) {
          centrality.set(w, centrality.get(w) + delta.get(w));
        }
      }
    }
    
    // Normalize
    const n = graph.nodes.length;
    const normalizer = 2 / ((n - 1) * (n - 2));
    
    centrality.forEach((value, node) => {
      centrality.set(node, value * normalizer);
    });
    
    return centrality;
  }
  
  // PageRank
  pageRank(
    graph: Graph,
    damping: number = 0.85,
    iterations: number = 100
  ): Map<Node, number> {
    const n = graph.nodes.length;
    const pagerank = new Map<Node, number>();
    
    // Initialize
    graph.nodes.forEach(node => {
      pagerank.set(node, 1 / n);
    });
    
    for (let iter = 0; iter < iterations; iter++) {
      const newPagerank = new Map<Node, number>();
      
      graph.nodes.forEach(node => {
        let rank = (1 - damping) / n;
        
        // Sum contributions from incoming edges
        node.incomingEdges.forEach(edge => {
          const source = edge.source;
          const sourceRank = pagerank.get(source);
          const sourceOutDegree = source.edges.length;
          
          rank += damping * (sourceRank / sourceOutDegree) * edge.weight;
        });
        
        newPagerank.set(node, rank);
      });
      
      // Update pagerank values
      newPagerank.forEach((value, node) => {
        pagerank.set(node, value);
      });
    }
    
    return pagerank;
  }
  
  // Musical influence score
  musicalInfluence(node: Node): number {
    const features = {
      popularity: node.popularity / 100,
      connections: this.degreeCentrality(node),
      genres: node.genres.length / 10,
      collaborations: node.collaborations?.length / 20 || 0,
      remixes: node.remixes?.length / 10 || 0
    };
    
    const weights = {
      popularity: 0.3,
      connections: 0.25,
      genres: 0.15,
      collaborations: 0.2,
      remixes: 0.1
    };
    
    return Object.keys(features).reduce((score, key) => 
      score + features[key] * weights[key], 0
    );
  }
}
```

### 2. Music-Specific Algorithms

#### Harmonic Compatibility

```typescript
class HarmonicAnalysis {
  // Camelot Wheel for key compatibility
  camelotWheel = {
    'C': '8B', 'Am': '8A',
    'G': '9B', 'Em': '9A',
    'D': '10B', 'Bm': '10A',
    'A': '11B', 'F#m': '11A',
    'E': '12B', 'C#m': '12A',
    'B': '1B', 'G#m': '1A',
    'F#': '2B', 'D#m': '2A',
    'Db': '3B', 'Bbm': '3A',
    'Ab': '4B', 'Fm': '4A',
    'Eb': '5B', 'Cm': '5A',
    'Bb': '6B', 'Gm': '6A',
    'F': '7B', 'Dm': '7A'
  };
  
  getKeyCompatibility(key1: string, key2: string): number {
    const camelot1 = this.camelotWheel[key1];
    const camelot2 = this.camelotWheel[key2];
    
    if (!camelot1 || !camelot2) return 0.5;
    
    const num1 = parseInt(camelot1);
    const num2 = parseInt(camelot2);
    const letter1 = camelot1[camelot1.length - 1];
    const letter2 = camelot2[camelot2.length - 1];
    
    // Perfect match
    if (camelot1 === camelot2) return 1.0;
    
    // Adjacent keys (±1 on wheel)
    const numDiff = Math.min(
      Math.abs(num1 - num2),
      12 - Math.abs(num1 - num2)
    );
    
    if (numDiff === 1 && letter1 === letter2) return 0.9;
    
    // Relative major/minor
    if (num1 === num2 && letter1 !== letter2) return 0.85;
    
    // Energy boost (+1 semitone)
    if (numDiff === 1 && letter1 !== letter2) return 0.8;
    
    // Subdominant/dominant
    if (numDiff === 5 || numDiff === 7) return 0.7;
    
    // Less compatible
    return Math.max(0, 1 - numDiff * 0.15);
  }
  
  // BPM compatibility for mixing
  getBPMCompatibility(bpm1: number, bpm2: number): number {
    const ratio = Math.max(bpm1, bpm2) / Math.min(bpm1, bpm2);
    
    // Perfect match
    if (Math.abs(bpm1 - bpm2) < 1) return 1.0;
    
    // Beatmatching range (±8%)
    if (ratio <= 1.08) return 0.9;
    
    // Half/double time
    if (Math.abs(ratio - 2) < 0.05 || Math.abs(ratio - 0.5) < 0.025) {
      return 0.85;
    }
    
    // 3/4 or 4/3 time
    if (Math.abs(ratio - 1.33) < 0.04 || Math.abs(ratio - 0.75) < 0.03) {
      return 0.75;
    }
    
    // Wider range (±16%)
    if (ratio <= 1.16) return 0.7;
    
    // Not easily mixable
    return Math.max(0, 1 - (ratio - 1) * 2);
  }
}
```

#### Energy Flow Analysis

```typescript
class EnergyFlowAnalysis {
  analyzeEnergyProgression(path: Node[]): EnergyProfile {
    const energyValues = path.map(node => node.energy || 0);
    
    return {
      profile: energyValues,
      average: mean(energyValues),
      variance: variance(energyValues),
      trend: this.calculateTrend(energyValues),
      peaks: this.findPeaks(energyValues),
      valleys: this.findValleys(energyValues),
      smoothness: this.calculateSmoothness(energyValues),
      classification: this.classifyProgression(energyValues)
    };
  }
  
  calculateTrend(values: number[]): 'ascending' | 'descending' | 'wave' | 'flat' {
    const regression = linearRegression(values);
    const slope = regression.slope;
    const waveScore = this.calculateWaveScore(values);
    
    if (Math.abs(slope) < 0.01) return 'flat';
    if (waveScore > 0.7) return 'wave';
    if (slope > 0) return 'ascending';
    return 'descending';
  }
  
  calculateWaveScore(values: number[]): number {
    let changes = 0;
    let lastDirection = 0;
    
    for (let i = 1; i < values.length; i++) {
      const direction = Math.sign(values[i] - values[i-1]);
      if (direction !== 0 && direction !== lastDirection) {
        changes++;
        lastDirection = direction;
      }
    }
    
    return changes / (values.length - 1);
  }
  
  calculateSmoothness(values: number[]): number {
    if (values.length < 2) return 1;
    
    let totalChange = 0;
    for (let i = 1; i < values.length; i++) {
      totalChange += Math.abs(values[i] - values[i-1]);
    }
    
    const avgChange = totalChange / (values.length - 1);
    return Math.exp(-avgChange * 5);  // Exponential decay
  }
  
  optimizeEnergyFlow(
    nodes: Node[],
    targetProfile: 'smooth' | 'building' | 'dropping' | 'wave'
  ): Node[] {
    const profiles = {
      smooth: (i: number, n: number) => 0.5,
      building: (i: number, n: number) => i / n,
      dropping: (i: number, n: number) => 1 - i / n,
      wave: (i: number, n: number) => 0.5 + 0.5 * Math.sin(2 * Math.PI * i / n)
    };
    
    const targetFunction = profiles[targetProfile];
    const n = nodes.length;
    
    // Use Hungarian algorithm for optimal assignment
    const costMatrix = nodes.map((node, i) => 
      Array(n).fill(0).map((_, j) => {
        const targetEnergy = targetFunction(j, n);
        return Math.abs(node.energy - targetEnergy);
      })
    );
    
    const assignment = hungarianAlgorithm(costMatrix);
    return assignment.map(i => nodes[i]);
  }
}
```

## Recommendation Algorithms

### 1. Collaborative Filtering

```typescript
class CollaborativeFiltering {
  // User-based collaborative filtering
  userBasedRecommendation(
    userId: string,
    userSongMatrix: Matrix,
    k: number = 10
  ): Node[] {
    const userVector = userSongMatrix.getRow(userId);
    const similarities = new Map<string, number>();
    
    // Calculate similarities with other users
    userSongMatrix.forEachRow((otherUserId, otherVector) => {
      if (otherUserId !== userId) {
        const similarity = this.cosineSimilarity(userVector, otherVector);
        similarities.set(otherUserId, similarity);
      }
    });
    
    // Get k most similar users
    const neighbors = Array.from(similarities.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([id, sim]) => ({ id, similarity: sim }));
    
    // Predict ratings for unrated songs
    const predictions = new Map<string, number>();
    
    userSongMatrix.forEachColumn((songId, songVector) => {
      if (!userVector.get(songId)) {
        let weightedSum = 0;
        let weightSum = 0;
        
        neighbors.forEach(neighbor => {
          const rating = userSongMatrix.get(neighbor.id, songId);
          if (rating) {
            weightedSum += rating * neighbor.similarity;
            weightSum += neighbor.similarity;
          }
        });
        
        if (weightSum > 0) {
          predictions.set(songId, weightedSum / weightSum);
        }
      }
    });
    
    // Return top recommendations
    return Array.from(predictions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([songId]) => graph.getNode(songId));
  }
  
  // Item-based collaborative filtering
  itemBasedRecommendation(
    songId: string,
    songSimilarityMatrix: Matrix
  ): Node[] {
    const similarities = songSimilarityMatrix.getRow(songId);
    
    return Array.from(similarities.entries())
      .filter(([id]) => id !== songId)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id]) => graph.getNode(id));
  }
  
  // Matrix factorization (SVD)
  matrixFactorization(
    userSongMatrix: Matrix,
    factors: number = 50,
    iterations: number = 100,
    learningRate: number = 0.01,
    regularization: number = 0.01
  ): { U: Matrix, V: Matrix } {
    const m = userSongMatrix.rows;
    const n = userSongMatrix.cols;
    
    // Initialize factor matrices
    let U = Matrix.random(m, factors, 0, 0.01);
    let V = Matrix.random(n, factors, 0, 0.01);
    
    for (let iter = 0; iter < iterations; iter++) {
      userSongMatrix.forEachNonZero((i, j, rating) => {
        // Predict rating
        const prediction = U.getRow(i).dot(V.getRow(j));
        const error = rating - prediction;
        
        // Update factors using gradient descent
        for (let f = 0; f < factors; f++) {
          const u_if = U.get(i, f);
          const v_jf = V.get(j, f);
          
          U.set(i, f, u_if + learningRate * (error * v_jf - regularization * u_if));
          V.set(j, f, v_jf + learningRate * (error * u_if - regularization * v_jf));
        }
      });
    }
    
    return { U, V };
  }
}
```

### 2. Content-Based Filtering

```typescript
class ContentBasedFiltering {
  recommendSimilar(
    song: Node,
    features: string[],
    weights?: Map<string, number>
  ): Node[] {
    const songVector = this.extractFeatureVector(song, features);
    const similarities = new Map<Node, number>();
    
    graph.nodes.forEach(otherSong => {
      if (otherSong !== song) {
        const otherVector = this.extractFeatureVector(otherSong, features);
        const similarity = this.weightedCosineSimilarity(
          songVector,
          otherVector,
          weights
        );
        similarities.set(otherSong, similarity);
      }
    });
    
    return Array.from(similarities.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([node]) => node);
  }
  
  extractFeatureVector(song: Node, features: string[]): number[] {
    return features.map(feature => {
      switch (feature) {
        case 'genre':
          return this.encodeGenres(song.genres);
        case 'key':
          return this.encodeKey(song.key);
        case 'mood':
          return this.encodeMood(song);
        default:
          return song[feature] || 0;
      }
    }).flat();
  }
  
  // TF-IDF for text features
  calculateTFIDF(
    songs: Node[],
    textField: string
  ): Map<Node, Map<string, number>> {
    const tfidf = new Map<Node, Map<string, number>>();
    const documentFrequency = new Map<string, number>();
    const N = songs.length;
    
    // Calculate document frequency
    songs.forEach(song => {
      const terms = this.tokenize(song[textField]);
      const uniqueTerms = new Set(terms);
      
      uniqueTerms.forEach(term => {
        documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
      });
    });
    
    // Calculate TF-IDF
    songs.forEach(song => {
      const terms = this.tokenize(song[textField]);
      const termFrequency = new Map<string, number>();
      
      // Calculate term frequency
      terms.forEach(term => {
        termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
      });
      
      // Calculate TF-IDF scores
      const tfidfScores = new Map<string, number>();
      termFrequency.forEach((tf, term) => {
        const df = documentFrequency.get(term) || 1;
        const idf = Math.log(N / df);
        tfidfScores.set(term, (tf / terms.length) * idf);
      });
      
      tfidf.set(song, tfidfScores);
    });
    
    return tfidf;
  }
}
```

## Performance Optimization Techniques

### 1. Spatial Indexing

```typescript
class SpatialIndex {
  // Quadtree for 2D spatial queries
  class QuadTree {
    constructor(
      public bounds: Rectangle,
      public maxObjects: number = 10,
      public maxLevels: number = 5,
      public level: number = 0
    ) {
      this.objects = [];
      this.nodes = [];
    }
    
    insert(node: Node): void {
      if (this.nodes.length > 0) {
        const index = this.getIndex(node);
        if (index !== -1) {
          this.nodes[index].insert(node);
          return;
        }
      }
      
      this.objects.push(node);
      
      if (this.objects.length > this.maxObjects && 
          this.level < this.maxLevels) {
        if (this.nodes.length === 0) {
          this.split();
        }
        
        let i = this.objects.length - 1;
        while (i >= 0) {
          const index = this.getIndex(this.objects[i]);
          if (index !== -1) {
            this.nodes[index].insert(this.objects.splice(i, 1)[0]);
          }
          i--;
        }
      }
    }
    
    retrieve(bounds: Rectangle): Node[] {
      const objects = [...this.objects];
      
      if (this.nodes.length > 0) {
        for (let i = 0; i < this.nodes.length; i++) {
          if (this.nodes[i].bounds.intersects(bounds)) {
            objects.push(...this.nodes[i].retrieve(bounds));
          }
        }
      }
      
      return objects;
    }
    
    nearestNeighbors(point: Point, k: number): Node[] {
      const candidates = new PriorityQueue<Node>();
      this.searchNearest(point, k, candidates, Infinity);
      
      return candidates.toArray().slice(0, k);
    }
  }
  
  // R-tree for multidimensional indexing
  class RTree {
    constructor(
      public dimensions: number,
      public maxEntries: number = 9,
      public minEntries: number = 4
    ) {
      this.root = new RTreeNode(dimensions);
    }
    
    insert(node: Node, bounds: number[]): void {
      const leaf = this.chooseLeaf(this.root, bounds);
      leaf.addEntry(node, bounds);
      
      if (leaf.entries.length > this.maxEntries) {
        const [node1, node2] = this.splitNode(leaf);
        this.adjustTree(leaf, node1, node2);
      } else {
        this.adjustTree(leaf);
      }
    }
    
    search(searchBounds: number[]): Node[] {
      const results = [];
      this.searchNode(this.root, searchBounds, results);
      return results;
    }
    
    knn(point: number[], k: number): Node[] {
      const queue = new PriorityQueue<{node: RTreeNode, dist: number}>();
      const results = new PriorityQueue<{node: Node, dist: number}>();
      
      queue.add({node: this.root, dist: 0}, 0);
      
      while (!queue.isEmpty() && results.size < k) {
        const {node, dist} = queue.extractMin();
        
        if (node.isLeaf()) {
          node.entries.forEach(entry => {
            const entryDist = this.distance(point, entry.bounds);
            if (results.size < k || entryDist < results.peekMax().dist) {
              results.add({node: entry.node, dist: entryDist}, entryDist);
              if (results.size > k) {
                results.extractMax();
              }
            }
          });
        } else {
          node.children.forEach(child => {
            const childDist = this.minDistance(point, child.bounds);
            if (results.size < k || childDist < results.peekMax().dist) {
              queue.add({node: child, dist: childDist}, childDist);
            }
          });
        }
      }
      
      return results.toArray().map(r => r.node);
    }
  }
}
```

### 2. Graph Preprocessing

```typescript
class GraphPreprocessing {
  // Contraction hierarchies for fast shortest paths
  class ContractionHierarchy {
    private shortcuts: Map<string, Edge[]>;
    private nodeOrder: Node[];
    
    preprocess(graph: Graph): void {
      this.nodeOrder = this.calculateNodeOrder(graph);
      this.shortcuts = new Map();
      
      const contractedGraph = graph.copy();
      
      for (const node of this.nodeOrder) {
        // Find shortcuts needed when contracting node
        const shortcuts = this.findShortcuts(contractedGraph, node);
        this.shortcuts.set(node.id, shortcuts);
        
        // Add shortcuts to graph
        shortcuts.forEach(shortcut => {
          contractedGraph.addEdge(shortcut);
        });
        
        // Remove contracted node
        contractedGraph.removeNode(node);
      }
    }
    
    findShortcuts(graph: Graph, node: Node): Edge[] {
      const shortcuts = [];
      const incoming = node.incomingEdges;
      const outgoing = node.outgoingEdges;
      
      for (const inEdge of incoming) {
        for (const outEdge of outgoing) {
          const source = inEdge.source;
          const target = outEdge.target;
          
          if (source === target) continue;
          
          const directDistance = inEdge.weight + outEdge.weight;
          
          // Check if shortcut is necessary
          const alternativePath = this.findPath(
            graph,
            source,
            target,
            node,
            directDistance
          );
          
          if (!alternativePath || alternativePath.distance > directDistance) {
            shortcuts.push({
              source,
              target,
              weight: directDistance,
              type: 'shortcut',
              via: node
            });
          }
        }
      }
      
      return shortcuts;
    }
    
    query(start: Node, end: Node): Path {
      // Bidirectional search using preprocessing
      const forward = new PriorityQueue();
      const backward = new PriorityQueue();
      const forwardDist = new Map();
      const backwardDist = new Map();
      
      forward.add(start, 0);
      backward.add(end, 0);
      forwardDist.set(start, 0);
      backwardDist.set(end, 0);
      
      let bestDistance = Infinity;
      let meetingPoint = null;
      
      while (!forward.isEmpty() || !backward.isEmpty()) {
        // Forward search
        if (!forward.isEmpty()) {
          const current = forward.extractMin();
          
          if (forwardDist.get(current) + backwardDist.get(current) < bestDistance) {
            bestDistance = forwardDist.get(current) + backwardDist.get(current);
            meetingPoint = current;
          }
          
          // Explore edges (including shortcuts)
          this.exploreEdges(current, forward, forwardDist, true);
        }
        
        // Backward search
        if (!backward.isEmpty()) {
          const current = backward.extractMin();
          
          if (forwardDist.get(current) + backwardDist.get(current) < bestDistance) {
            bestDistance = forwardDist.get(current) + backwardDist.get(current);
            meetingPoint = current;
          }
          
          // Explore edges (including shortcuts)
          this.exploreEdges(current, backward, backwardDist, false);
        }
      }
      
      return this.reconstructPath(meetingPoint, forwardDist, backwardDist);
    }
  }
  
  // 2-hop reachability index
  class TwoHopIndex {
    private labels: Map<Node, {in: Set<Node>, out: Set<Node>}>;
    
    build(graph: Graph): void {
      this.labels = new Map();
      
      // Initialize labels
      graph.nodes.forEach(node => {
        this.labels.set(node, {
          in: new Set(),
          out: new Set()
        });
      });
      
      // Build 2-hop cover
      const nodeOrder = this.calculateNodeOrder(graph);
      
      for (const hub of nodeOrder) {
        // BFS from hub
        const forwardReach = this.bfs(graph, hub, 'forward');
        const backwardReach = this.bfs(graph, hub, 'backward');
        
        // Update labels
        forwardReach.forEach(node => {
          this.labels.get(node).in.add(hub);
        });
        
        backwardReach.forEach(node => {
          this.labels.get(node).out.add(hub);
        });
      }
    }
    
    query(source: Node, target: Node): boolean {
      const sourceOut = this.labels.get(source).out;
      const targetIn = this.labels.get(target).in;
      
      // Check if there's a common hub
      for (const hub of sourceOut) {
        if (targetIn.has(hub)) {
          return true;
        }
      }
      
      return false;
    }
  }
}
```

## Conclusion

These algorithms form the computational backbone of the Phase 6 visualization system. They enable efficient graph layout, intelligent path-finding, meaningful clustering, and personalized recommendations. The combination of classic graph algorithms with music-specific enhancements creates a powerful platform for exploring and understanding musical relationships.

The implementation focuses on:
- **Performance**: Using spatial indexing, preprocessing, and approximation algorithms for real-time interaction
- **Accuracy**: Implementing proven algorithms with musical domain adaptations
- **Scalability**: Supporting graphs with 10,000+ nodes through optimization techniques
- **Flexibility**: Providing multiple algorithms for each task to suit different use cases

These algorithms work together to create an intuitive, responsive, and insightful music visualization experience.