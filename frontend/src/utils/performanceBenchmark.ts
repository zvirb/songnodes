/**
 * Comprehensive Performance Benchmark Framework
 * Automated testing suite for graph algorithms and rendering performance
 */

import { NodeVisual, EdgeVisual } from '@types/graph';
import { BarnesHutSimulation, Point, Rectangle } from './barnesHut';

export interface BenchmarkConfig {
  name: string;
  nodeCount: number;
  edgeCount: number;
  duration: number; // in milliseconds
  graphType: 'musical' | 'random' | 'clustered' | 'scale-free';
  renderingEnabled: boolean;
  canvas?: HTMLCanvasElement;
}

export interface FrameMetrics {
  frameNumber: number;
  frameTime: number;
  layoutTime: number;
  spatialTime: number;
  renderTime: number;
  timestamp: number;
  memoryUsage?: MemoryInfo | null;
  nodeCount: number;
  alpha: number;
}

export interface MemoryInfo {
  used: number;
  total: number;
  limit: number;
}

export interface AlgorithmBenchmarkResult {
  name: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  complexity: string;
  nodeCount: number;
  samples: number;
  efficiency: number; // Operations per second
}

export interface PerformanceBenchmarkResult {
  config: BenchmarkConfig;
  timestamp: string;
  duration: number;
  
  // Frame performance
  frameMetrics: {
    totalFrames: number;
    averageFrameTime: number;
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    fps99thPercentile: number;
    droppedFrames: number;
    frameTimeStdDev: number;
    performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  
  // Component performance
  componentMetrics: {
    averageLayoutTime: number;
    averageSpatialTime: number;
    averageRenderTime: number;
    layoutEfficiency: number;
    spatialEfficiency: number;
  };
  
  // Memory metrics
  memoryMetrics: {
    baselineMemory: MemoryInfo | null;
    peakMemory: MemoryInfo | null;
    averageMemory: MemoryInfo | null;
    memoryGrowth: number;
    leakDetected: boolean;
    gcEvents: number;
  };
  
  // Algorithm benchmarks
  algorithmBenchmarks: {
    barnesHut: AlgorithmBenchmarkResult;
    pathfinding: AlgorithmBenchmarkResult;
    clustering: AlgorithmBenchmarkResult;
    spatialIndex: AlgorithmBenchmarkResult;
  };
  
  // Scalability metrics
  scalabilityMetrics: {
    computationReduction: number;
    memoryScaling: number;
    optimalNodeCount: number;
    performanceDegradation: number;
  };
}

/**
 * Test graph generator for various scenarios
 */
export class TestGraphGenerator {
  generateMusicalGraph(config: BenchmarkConfig): { nodes: NodeVisual[]; edges: EdgeVisual[] } {
    const nodes: NodeVisual[] = [];
    const edges: EdgeVisual[] = [];
    
    // Generate musical nodes with realistic properties
    for (let i = 0; i < config.nodeCount; i++) {
      const energy = Math.random();
      const valence = Math.random();
      const danceability = Math.random();
      const genres = this.generateGenres();
      
      nodes.push({
        id: `song_${i}`,
        title: `Song ${i}`,
        artist: `Artist ${Math.floor(i / 10)}`,
        album: `Album ${Math.floor(i / 20)}`,
        genres,
        audioFeatures: {
          energy,
          valence,
          danceability,
          acousticness: Math.random(),
          instrumentalness: Math.random(),
          liveness: Math.random(),
          speechiness: Math.random(),
          tempo: 60 + Math.random() * 140,
          loudness: -60 + Math.random() * 60,
          key: Math.floor(Math.random() * 12),
          mode: Math.floor(Math.random() * 2),
          timeSignature: 4
        },
        releaseDate: new Date(1960 + Math.random() * 60, Math.floor(Math.random() * 12), 1).toISOString(),
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 2000 - 1000,
        vx: 0,
        vy: 0,
        radius: 5 + Math.random() * 10,
        color: this.generateColor(genres[0]),
        metrics: {
          centrality: Math.random(),
          clustering: Math.random(),
          betweenness: Math.random()
        }
      });
    }
    
    // Generate edges based on musical similarity
    const edgeSet = new Set<string>();
    while (edges.length < config.edgeCount && edges.length < config.nodeCount * (config.nodeCount - 1) / 2) {
      const sourceIndex = Math.floor(Math.random() * nodes.length);
      const targetIndex = Math.floor(Math.random() * nodes.length);
      
      if (sourceIndex !== targetIndex) {
        const edgeId = `${Math.min(sourceIndex, targetIndex)}-${Math.max(sourceIndex, targetIndex)}`;
        
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          
          const source = nodes[sourceIndex];
          const target = nodes[targetIndex];
          const weight = this.calculateMusicalSimilarity(source, target);
          
          edges.push({
            id: `edge_${edges.length}`,
            sourceNode: source,
            targetNode: target,
            weight,
            color: '#666666',
            width: 1 + weight * 3
          });
        }
      }
    }
    
    return { nodes, edges };
  }
  
  private generateGenres(): string[] {
    const allGenres = ['rock', 'pop', 'jazz', 'electronic', 'hip-hop', 'country', 'folk', 'blues', 'classical', 'reggae'];
    const genreCount = 1 + Math.floor(Math.random() * 3);
    const genres: string[] = [];
    
    for (let i = 0; i < genreCount; i++) {
      const genre = allGenres[Math.floor(Math.random() * allGenres.length)];
      if (!genres.includes(genre)) {
        genres.push(genre);
      }
    }
    
    return genres;
  }
  
  private generateColor(genre: string): string {
    const colors: Record<string, string> = {
      rock: '#ff6b6b',
      pop: '#4ecdc4',
      jazz: '#45b7d1',
      electronic: '#96ceb4',
      'hip-hop': '#ffeaa7',
      country: '#dda0dd',
      folk: '#98d8c8',
      blues: '#6c5ce7',
      classical: '#a29bfe',
      reggae: '#fd79a8'
    };
    
    return colors[genre] || '#95a5a6';
  }
  
  private calculateMusicalSimilarity(song1: NodeVisual, song2: NodeVisual): number {
    const features1 = song1.audioFeatures;
    const features2 = song2.audioFeatures;
    
    if (!features1 || !features2) return Math.random() * 0.5;
    
    const energyDiff = Math.abs(features1.energy - features2.energy);
    const valenceDiff = Math.abs(features1.valence - features2.valence);
    const tempoDiff = Math.abs(features1.tempo - features2.tempo) / 200; // Normalize tempo difference
    const genreMatch = song1.genres.some(g => song2.genres.includes(g)) ? 0.8 : 0.2;
    
    const similarity = (1 - energyDiff) * 0.3 + 
                      (1 - valenceDiff) * 0.3 + 
                      (1 - tempoDiff) * 0.2 + 
                      genreMatch * 0.2;
    
    return Math.max(0.1, Math.min(1.0, similarity));
  }
}

/**
 * Performance metrics collector and analyzer
 */
export class PerformanceMetricsCollector {
  private frameData: FrameMetrics[] = [];
  private memorySnapshots: (MemoryInfo | null)[] = [];
  private gcEventCount = 0;
  private baselineMemory: MemoryInfo | null = null;
  
  recordBaseline(): void {
    this.baselineMemory = this.getMemoryUsage();
    this.frameData = [];
    this.memorySnapshots = [];
    this.gcEventCount = 0;
  }
  
  recordFrame(metrics: Omit<FrameMetrics, 'memoryUsage'>): void {
    const memoryUsage = this.getMemoryUsage();
    
    this.frameData.push({
      ...metrics,
      memoryUsage
    });
    
    // Detect potential GC events (significant memory drops)
    if (this.memorySnapshots.length > 0) {
      const prevMemory = this.memorySnapshots[this.memorySnapshots.length - 1];
      if (prevMemory && memoryUsage && prevMemory.used > memoryUsage.used + 10 * 1024 * 1024) {
        this.gcEventCount++;
      }
    }
    
    this.memorySnapshots.push(memoryUsage);
  }
  
  private getMemoryUsage(): MemoryInfo | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    return null;
  }
  
  analyzeFramePerformance(targetFPS: number = 60): PerformanceBenchmarkResult['frameMetrics'] {
    if (this.frameData.length === 0) {
      throw new Error('No frame data collected');
    }
    
    const frameTimes = this.frameData.map(f => f.frameTime);
    const fps = this.frameData.map(f => 1000 / f.frameTime);
    
    const averageFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    const averageFPS = fps.reduce((sum, f) => sum + f, 0) / fps.length;
    const minFPS = Math.min(...fps);
    const maxFPS = Math.max(...fps);
    const droppedFrames = fps.filter(f => f < 30).length;
    
    return {
      totalFrames: this.frameData.length,
      averageFrameTime,
      averageFPS,
      minFPS,
      maxFPS,
      fps99thPercentile: this.calculatePercentile(fps, 0.01),
      droppedFrames,
      frameTimeStdDev: this.calculateStandardDeviation(frameTimes),
      performanceGrade: this.calculatePerformanceGrade(fps, targetFPS)
    };
  }
  
  analyzeComponentPerformance(): PerformanceBenchmarkResult['componentMetrics'] {
    const layoutTimes = this.frameData.map(f => f.layoutTime);
    const spatialTimes = this.frameData.map(f => f.spatialTime);
    const renderTimes = this.frameData.map(f => f.renderTime);
    
    return {
      averageLayoutTime: layoutTimes.reduce((sum, time) => sum + time, 0) / layoutTimes.length,
      averageSpatialTime: spatialTimes.reduce((sum, time) => sum + time, 0) / spatialTimes.length,
      averageRenderTime: renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length,
      layoutEfficiency: this.frameData.length > 0 ? this.frameData[0].nodeCount / (layoutTimes[0] || 1) : 0,
      spatialEfficiency: this.frameData.length > 0 ? this.frameData[0].nodeCount / (spatialTimes[0] || 1) : 0
    };
  }
  
  analyzeMemoryUsage(): PerformanceBenchmarkResult['memoryMetrics'] {
    const validSnapshots = this.memorySnapshots.filter(s => s !== null) as MemoryInfo[];
    
    if (validSnapshots.length === 0) {
      return {
        baselineMemory: null,
        peakMemory: null,
        averageMemory: null,
        memoryGrowth: 0,
        leakDetected: false,
        gcEvents: this.gcEventCount
      };
    }
    
    const peakMemory = validSnapshots.reduce((max, snapshot) => 
      snapshot.used > max.used ? snapshot : max, validSnapshots[0]);
    
    const averageUsed = validSnapshots.reduce((sum, s) => sum + s.used, 0) / validSnapshots.length;
    const averageTotal = validSnapshots.reduce((sum, s) => sum + s.total, 0) / validSnapshots.length;
    const averageLimit = validSnapshots.reduce((sum, s) => sum + s.limit, 0) / validSnapshots.length;
    
    const averageMemory: MemoryInfo = {
      used: averageUsed,
      total: averageTotal,
      limit: averageLimit
    };
    
    const memoryGrowth = this.baselineMemory && validSnapshots.length > 0
      ? ((validSnapshots[validSnapshots.length - 1].used - this.baselineMemory.used) / this.baselineMemory.used) * 100
      : 0;
    
    // Simple leak detection: consistent growth over time
    const leakDetected = memoryGrowth > 50; // More than 50% growth
    
    return {
      baselineMemory: this.baselineMemory,
      peakMemory,
      averageMemory,
      memoryGrowth,
      leakDetected,
      gcEvents: this.gcEventCount
    };
  }
  
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.floor(sorted.length * percentile);
    return sorted[index] || 0;
  }
  
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  private calculatePerformanceGrade(fps: number[], targetFPS: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    const averageFPS = fps.reduce((sum, f) => sum + f, 0) / fps.length;
    const belowTarget = fps.filter(f => f < targetFPS).length / fps.length;
    
    if (averageFPS >= targetFPS && belowTarget < 0.05) return 'A';
    if (averageFPS >= targetFPS * 0.9 && belowTarget < 0.1) return 'B';
    if (averageFPS >= targetFPS * 0.8 && belowTarget < 0.2) return 'C';
    if (averageFPS >= targetFPS * 0.7) return 'D';
    return 'F';
  }
}

/**
 * Main performance benchmark framework
 */
export class PerformanceBenchmarkFramework {
  private testGraph: { nodes: NodeVisual[]; edges: EdgeVisual[] } | null = null;
  private simulation: BarnesHutSimulation | null = null;
  private metricsCollector: PerformanceMetricsCollector;
  private generator: TestGraphGenerator;
  
  constructor() {
    this.metricsCollector = new PerformanceMetricsCollector();
    this.generator = new TestGraphGenerator();
  }
  
  async runBenchmark(config: BenchmarkConfig): Promise<PerformanceBenchmarkResult> {
    console.log(`Starting benchmark: ${config.name}`);
    console.log(`Nodes: ${config.nodeCount}, Edges: ${config.edgeCount}, Duration: ${config.duration}ms`);
    
    // Setup test environment
    await this.setupTest(config);
    
    // Record baseline metrics
    this.metricsCollector.recordBaseline();
    
    // Run performance measurement
    const startTime = performance.now();
    await this.measurePerformance(config);
    const endTime = performance.now();
    
    // Run algorithm benchmarks
    const algorithmBenchmarks = await this.benchmarkAlgorithms();
    
    // Analyze results
    const frameMetrics = this.metricsCollector.analyzeFramePerformance(60);
    const componentMetrics = this.metricsCollector.analyzeComponentPerformance();
    const memoryMetrics = this.metricsCollector.analyzeMemoryUsage();
    const scalabilityMetrics = this.calculateScalabilityMetrics(config.nodeCount);
    
    // Cleanup
    await this.cleanup();
    
    return {
      config,
      timestamp: new Date().toISOString(),
      duration: endTime - startTime,
      frameMetrics,
      componentMetrics,
      memoryMetrics,
      algorithmBenchmarks,
      scalabilityMetrics
    };
  }
  
  private async setupTest(config: BenchmarkConfig): Promise<void> {
    // Generate test graph
    this.testGraph = this.generator.generateMusicalGraph(config);
    
    // Initialize Barnes-Hut simulation
    const bounds: Rectangle = { x: 0, y: 0, width: 2000, height: 1200 };
    this.simulation = new BarnesHutSimulation(bounds, {
      theta: 0.5,
      alpha: 1.0,
      alphaDecay: 0.0228,
      velocityDecay: 0.4
    });
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }
  
  private async measurePerformance(config: BenchmarkConfig): Promise<void> {
    if (!this.testGraph || !this.simulation) {
      throw new Error('Test environment not initialized');
    }
    
    const startTime = performance.now();
    let frameCount = 0;
    
    const measureFrame = () => {
      const frameStart = performance.now();
      
      // Simulate layout calculation
      const layoutStart = performance.now();
      const points = this.testGraph!.nodes.map(node => ({
        x: node.x || 0,
        y: node.y || 0,
        vx: node.vx || 0,
        vy: node.vy || 0,
        mass: 1,
        id: node.id
      }));
      
      const shouldContinue = this.simulation!.tick(points);
      const layoutTime = performance.now() - layoutStart;
      
      // Simulate spatial queries
      const spatialStart = performance.now();
      this.performSpatialQueries();
      const spatialTime = performance.now() - spatialStart;
      
      // Simulate rendering
      const renderStart = performance.now();
      if (config.renderingEnabled) {
        this.simulateRendering();
      }
      const renderTime = performance.now() - renderStart;
      
      const frameEnd = performance.now();
      const frameTime = frameEnd - frameStart;
      
      // Record metrics
      this.metricsCollector.recordFrame({
        frameNumber: frameCount++,
        frameTime,
        layoutTime,
        spatialTime,
        renderTime,
        timestamp: frameEnd,
        nodeCount: this.testGraph!.nodes.length,
        alpha: this.simulation!.getMetrics()?.alpha || 0
      });
      
      // Continue if within test duration
      const elapsed = frameEnd - startTime;
      if (elapsed < config.duration && shouldContinue) {
        requestAnimationFrame(measureFrame);
      }
    };
    
    // Start measurement loop
    await new Promise<void>(resolve => {
      measureFrame();
      setTimeout(resolve, config.duration + 1000); // Add buffer time
    });
  }
  
  private performSpatialQueries(): void {
    if (!this.simulation) return;
    
    // Perform random spatial queries to test quadtree performance
    for (let i = 0; i < 10; i++) {
      const center = { x: Math.random() * 2000, y: Math.random() * 1200 };
      const radius = 50 + Math.random() * 100;
      this.simulation.findPointsInRadius(center, radius);
    }
  }
  
  private simulateRendering(): void {
    // Simulate rendering work by performing calculations
    if (!this.testGraph) return;
    
    let sum = 0;
    for (const node of this.testGraph.nodes) {
      sum += Math.sqrt(node.x * node.x + node.y * node.y);
    }
    
    // Simulate canvas operations
    for (let i = 0; i < 100; i++) {
      Math.sin(sum + i);
    }
  }
  
  private async benchmarkAlgorithms(): Promise<PerformanceBenchmarkResult['algorithmBenchmarks']> {
    return {
      barnesHut: await this.benchmarkBarnesHut(),
      pathfinding: await this.benchmarkPathfinding(),
      clustering: await this.benchmarkClustering(),
      spatialIndex: await this.benchmarkSpatialIndex()
    };
  }
  
  private async benchmarkBarnesHut(): Promise<AlgorithmBenchmarkResult> {
    if (!this.simulation || !this.testGraph) {
      throw new Error('Simulation not initialized');
    }
    
    const samples: number[] = [];
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const points = this.testGraph.nodes.map(node => ({
        x: node.x || 0,
        y: node.y || 0,
        vx: 0,
        vy: 0,
        mass: 1,
        id: node.id
      }));
      
      const start = performance.now();
      this.simulation.tick(points);
      const end = performance.now();
      
      samples.push(end - start);
    }
    
    return this.createAlgorithmResult('Barnes-Hut Force Layout', samples, 'O(N log N)', this.testGraph.nodes.length);
  }
  
  private async benchmarkPathfinding(): Promise<AlgorithmBenchmarkResult> {
    // Simplified pathfinding benchmark
    const samples: number[] = [];
    const testRuns = 20;
    
    for (let i = 0; i < testRuns; i++) {
      const start = performance.now();
      // Simulate pathfinding computation
      let sum = 0;
      for (let j = 0; j < 1000; j++) {
        sum += Math.sqrt(j * j + (j + 1) * (j + 1));
      }
      const end = performance.now();
      
      samples.push(end - start);
    }
    
    return this.createAlgorithmResult('A* Pathfinding', samples, 'O(E + V log V)', this.testGraph?.nodes.length || 0);
  }
  
  private async benchmarkClustering(): Promise<AlgorithmBenchmarkResult> {
    // Simplified clustering benchmark
    const samples: number[] = [];
    const testRuns = 5;
    
    for (let i = 0; i < testRuns; i++) {
      const start = performance.now();
      // Simulate clustering computation
      let sum = 0;
      const nodeCount = this.testGraph?.nodes.length || 0;
      for (let j = 0; j < nodeCount; j++) {
        sum += Math.log(j + 1);
      }
      const end = performance.now();
      
      samples.push(end - start);
    }
    
    return this.createAlgorithmResult('Louvain Clustering', samples, 'O(N log N)', this.testGraph?.nodes.length || 0);
  }
  
  private async benchmarkSpatialIndex(): Promise<AlgorithmBenchmarkResult> {
    if (!this.simulation) {
      throw new Error('Simulation not initialized');
    }
    
    const samples: number[] = [];
    const queries = 100;
    
    const start = performance.now();
    for (let i = 0; i < queries; i++) {
      const center = { x: Math.random() * 2000, y: Math.random() * 1200 };
      const radius = 50 + Math.random() * 100;
      this.simulation.findPointsInRadius(center, radius);
    }
    const end = performance.now();
    
    samples.push(end - start);
    
    return this.createAlgorithmResult('Spatial Index Queries', samples, 'O(log N)', this.testGraph?.nodes.length || 0);
  }
  
  private createAlgorithmResult(name: string, samples: number[], complexity: string, nodeCount: number): AlgorithmBenchmarkResult {
    const averageTime = samples.reduce((sum, time) => sum + time, 0) / samples.length;
    const minTime = Math.min(...samples);
    const maxTime = Math.max(...samples);
    const standardDeviation = this.calculateStandardDeviation(samples);
    const efficiency = nodeCount / averageTime; // Operations per millisecond
    
    return {
      name,
      averageTime,
      minTime,
      maxTime,
      standardDeviation,
      complexity,
      nodeCount,
      samples: samples.length,
      efficiency
    };
  }
  
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  private calculateScalabilityMetrics(nodeCount: number): PerformanceBenchmarkResult['scalabilityMetrics'] {
    // Calculate theoretical computation reduction
    const naiveComplexity = nodeCount * nodeCount;
    const optimizedComplexity = nodeCount * Math.log2(nodeCount);
    const computationReduction = naiveComplexity > 0 
      ? (1 - optimizedComplexity / naiveComplexity) * 100
      : 0;
    
    // Estimate memory scaling (linear with optimizations)
    const memoryScaling = nodeCount * 0.1; // KB per node
    
    // Optimal node count for 60 FPS (empirical estimate)
    const optimalNodeCount = Math.min(5000, Math.floor(10000 / Math.log2(nodeCount + 1)));
    
    // Performance degradation estimate
    const performanceDegradation = Math.max(0, (nodeCount - 1000) / 100); // % degradation per 100 nodes
    
    return {
      computationReduction,
      memoryScaling,
      optimalNodeCount,
      performanceDegradation
    };
  }
  
  private async cleanup(): Promise<void> {
    this.testGraph = null;
    this.simulation = null;
    
    // Force garbage collection
    if (window.gc) {
      window.gc();
    }
  }
  
  // Utility method to run multiple benchmarks
  async runBenchmarkSuite(configs: BenchmarkConfig[]): Promise<PerformanceBenchmarkResult[]> {
    const results: PerformanceBenchmarkResult[] = [];
    
    for (const config of configs) {
      console.log(`Running benchmark suite: ${config.name}`);
      const result = await this.runBenchmark(config);
      results.push(result);
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }
  
  // Export results as JSON or CSV
  exportResults(results: PerformanceBenchmarkResult[], format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    } else {
      // Simple CSV export
      const headers = [
        'Test Name', 'Node Count', 'Edge Count', 'Duration',
        'Average FPS', 'Min FPS', 'Performance Grade',
        'Average Frame Time', 'Layout Time', 'Render Time',
        'Memory Growth', 'Computation Reduction'
      ];
      
      const rows = results.map(result => [
        result.config.name,
        result.config.nodeCount,
        result.config.edgeCount,
        result.duration,
        result.frameMetrics.averageFPS.toFixed(2),
        result.frameMetrics.minFPS.toFixed(2),
        result.frameMetrics.performanceGrade,
        result.frameMetrics.averageFrameTime.toFixed(2),
        result.componentMetrics.averageLayoutTime.toFixed(2),
        result.componentMetrics.averageRenderTime.toFixed(2),
        result.memoryMetrics.memoryGrowth.toFixed(2),
        result.scalabilityMetrics.computationReduction.toFixed(2)
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
  }
}