/**
 * Performance Benchmark Framework for Graph Algorithm Validation
 * Comprehensive testing suite for music visualization performance
 */

class PerformanceBenchmarkFramework {
  constructor(config = {}) {
    this.config = {
      targetFPS: 60,
      memoryBaseline: 200 * 1024 * 1024, // 200MB in bytes
      maxTestDuration: 60000, // 60 seconds
      sampleInterval: 16.67, // ~60 FPS sampling
      ...config
    };
    
    this.metrics = new PerformanceMetrics();
    this.testResults = [];
    this.isRunning = false;
  }

  /**
   * Core benchmark execution with comprehensive metrics
   */
  async runBenchmark(testConfig) {
    if (this.isRunning) {
      throw new Error('Benchmark already running');
    }

    this.isRunning = true;
    const results = new BenchmarkResults(testConfig);
    
    try {
      console.log(`Starting benchmark: ${testConfig.name}`);
      console.log(`Nodes: ${testConfig.nodeCount}, Edges: ${testConfig.edgeCount}`);
      
      // Pre-test setup and validation
      await this.setupTest(testConfig);
      
      // Performance measurement phase
      const measurementResults = await this.measurePerformance(testConfig);
      results.addMeasurements(measurementResults);
      
      // Algorithm-specific benchmarks
      const algorithmResults = await this.benchmarkAlgorithms(testConfig);
      results.addAlgorithmMetrics(algorithmResults);
      
      // Memory stress testing
      const memoryResults = await this.stressTestMemory(testConfig);
      results.addMemoryMetrics(memoryResults);
      
      // Scalability analysis
      const scalabilityResults = await this.analyzeScalability(testConfig);
      results.addScalabilityMetrics(scalabilityResults);
      
      this.testResults.push(results);
      return results;
      
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }
  }

  /**
   * Initialize test environment with specified graph configuration
   */
  async setupTest(testConfig) {
    // Clear previous test data
    if (this.testGraph) {
      this.testGraph.destroy();
    }
    
    // Generate test graph based on configuration
    this.testGraph = await this.generateTestGraph(testConfig);
    
    // Initialize spatial indexing
    this.spatialIndex = new QuadTreeIndex(this.testGraph.bounds);
    this.testGraph.nodes.forEach(node => {
      this.spatialIndex.insert(node);
    });
    
    // Setup rendering context
    this.renderer = new WebGLRenderer(testConfig.canvas || this.createTestCanvas());
    await this.renderer.initialize();
    
    // Force garbage collection before test
    if (window.gc) {
      window.gc();
    }
    
    // Record baseline metrics
    this.metrics.recordBaseline({
      memoryUsage: this.getMemoryUsage(),
      timestamp: performance.now()
    });
  }

  /**
   * Core performance measurement with frame-by-frame analysis
   */
  async measurePerformance(testConfig) {
    const frameData = [];
    const startTime = performance.now();
    const testDuration = Math.min(testConfig.duration || 30000, this.config.maxTestDuration);
    
    console.log(`Measuring performance for ${testDuration}ms...`);
    
    let frameCount = 0;
    const measureFrame = async () => {
      const frameStart = performance.now();
      
      // Simulate typical graph operations
      const layoutStart = performance.now();
      await this.updateLayout();
      const layoutTime = performance.now() - layoutStart;
      
      const spatialStart = performance.now();
      await this.performSpatialQueries();
      const spatialTime = performance.now() - spatialStart;
      
      const renderStart = performance.now();
      await this.renderFrame();
      const renderTime = performance.now() - renderStart;
      
      const frameEnd = performance.now();
      const frameTime = frameEnd - frameStart;
      
      frameData.push({
        frameNumber: frameCount++,
        frameTime,
        layoutTime,
        spatialTime,
        renderTime,
        timestamp: frameEnd,
        memoryUsage: frameCount % 60 === 0 ? this.getMemoryUsage() : null // Sample memory every second
      });
      
      // Continue if within test duration
      if (frameEnd - startTime < testDuration) {
        requestAnimationFrame(measureFrame);
      }
    };
    
    // Start frame measurement loop
    await new Promise(resolve => {
      requestAnimationFrame(async () => {
        await measureFrame();
        resolve();
      });
    });
    
    return this.analyzeFrameData(frameData);
  }

  /**
   * Algorithm-specific benchmark testing
   */
  async benchmarkAlgorithms(testConfig) {
    const results = {};
    
    // Barnes-Hut Force Layout Benchmark
    console.log('Benchmarking Barnes-Hut force layout...');
    results.barnesHut = await this.benchmarkBarnesHut();
    
    // A* Pathfinding Benchmark
    console.log('Benchmarking A* pathfinding...');
    results.pathfinding = await this.benchmarkPathfinding();
    
    // Louvain Clustering Benchmark
    console.log('Benchmarking Louvain clustering...');
    results.clustering = await this.benchmarkClustering();
    
    // Spatial Indexing Benchmark
    console.log('Benchmarking spatial indexing...');
    results.spatialIndex = await this.benchmarkSpatialIndex();
    
    return results;
  }

  /**
   * Barnes-Hut algorithm performance testing
   */
  async benchmarkBarnesHut() {
    const barnesHut = new BarnesHutLayout({
      theta: 0.5,
      iterations: 100,
      nodeCount: this.testGraph.nodes.length
    });
    
    const samples = [];
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await barnesHut.calculateForces(this.testGraph.nodes);
      const end = performance.now();
      
      samples.push(end - start);
    }
    
    return {
      averageTime: samples.reduce((a, b) => a + b, 0) / samples.length,
      minTime: Math.min(...samples),
      maxTime: Math.max(...samples),
      standardDeviation: this.calculateStandardDeviation(samples),
      complexity: 'O(N log N)',
      nodeCount: this.testGraph.nodes.length,
      theta: 0.5
    };
  }

  /**
   * A* pathfinding performance testing
   */
  async benchmarkPathfinding() {
    const pathfinder = new MusicalAStarPathfinder(this.testGraph);
    const nodes = this.testGraph.nodes;
    const samples = [];
    const pathTests = 20;
    
    for (let i = 0; i < pathTests; i++) {
      const start = nodes[Math.floor(Math.random() * nodes.length)];
      const end = nodes[Math.floor(Math.random() * nodes.length)];
      
      const testStart = performance.now();
      const path = await pathfinder.findPath(start, end, {
        heuristic: 'euclidean',
        constraints: {
          maxBpmDeviation: 20,
          keyCompatibility: true
        }
      });
      const testEnd = performance.now();
      
      samples.push({
        time: testEnd - testStart,
        pathLength: path ? path.length : 0,
        nodesExplored: pathfinder.getLastSearchStats().nodesExplored
      });
    }
    
    return {
      averageTime: samples.reduce((sum, s) => sum + s.time, 0) / samples.length,
      averagePathLength: samples.reduce((sum, s) => sum + s.pathLength, 0) / samples.length,
      averageNodesExplored: samples.reduce((sum, s) => sum + s.nodesExplored, 0) / samples.length,
      successRate: samples.filter(s => s.pathLength > 0).length / samples.length,
      complexity: 'O(E + V log V)'
    };
  }

  /**
   * Louvain clustering performance testing
   */
  async benchmarkClustering() {
    const louvain = new LouvainClustering();
    const samples = [];
    const runs = 5;
    
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      const communities = await louvain.detectCommunities(this.testGraph, 1.0);
      const end = performance.now();
      
      const modularity = this.calculateModularity(this.testGraph, communities);
      const communityCount = new Set(communities.values()).size;
      
      samples.push({
        time: end - start,
        modularity,
        communityCount
      });
    }
    
    return {
      averageTime: samples.reduce((sum, s) => sum + s.time, 0) / samples.length,
      averageModularity: samples.reduce((sum, s) => sum + s.modularity, 0) / samples.length,
      averageCommunityCount: samples.reduce((sum, s) => sum + s.communityCount, 0) / samples.length,
      complexity: 'O(N log N)',
      nodeCount: this.testGraph.nodes.length,
      edgeCount: this.testGraph.edges.length
    };
  }

  /**
   * Spatial indexing performance testing
   */
  async benchmarkSpatialIndex() {
    const queries = 1000;
    const queryResults = [];
    
    // Test insertion performance
    const insertionStart = performance.now();
    const tempIndex = new QuadTreeIndex(this.testGraph.bounds);
    this.testGraph.nodes.forEach(node => tempIndex.insert(node));
    const insertionTime = performance.now() - insertionStart;
    
    // Test query performance
    const queryStart = performance.now();
    for (let i = 0; i < queries; i++) {
      const queryBounds = this.generateRandomQueryBounds();
      const results = this.spatialIndex.query(queryBounds);
      queryResults.push(results.length);
    }
    const queryTime = performance.now() - queryStart;
    
    return {
      insertionTime,
      averageQueryTime: queryTime / queries,
      averageResultCount: queryResults.reduce((a, b) => a + b, 0) / queryResults.length,
      indexSize: this.spatialIndex.getSize(),
      complexity: 'O(log N)',
      nodeCount: this.testGraph.nodes.length
    };
  }

  /**
   * Memory stress testing with leak detection
   */
  async stressTestMemory(testConfig) {
    const memorySnapshots = [];
    const testDuration = 30000; // 30 seconds
    const snapshotInterval = 1000; // 1 second
    
    console.log('Running memory stress test...');
    
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();
    
    const memoryTest = async () => {
      // Simulate continuous graph operations
      await this.performGraphOperations();
      
      // Take memory snapshot
      const currentTime = performance.now();
      const currentMemory = this.getMemoryUsage();
      
      memorySnapshots.push({
        timestamp: currentTime - startTime,
        memoryUsage: currentMemory,
        delta: currentMemory - (memorySnapshots.length > 0 ? 
          memorySnapshots[memorySnapshots.length - 1].memoryUsage : startMemory)
      });
      
      // Continue test if within duration
      if (currentTime - startTime < testDuration) {
        setTimeout(memoryTest, snapshotInterval);
      }
    };
    
    await memoryTest();
    
    // Analyze memory patterns
    const memoryGrowth = this.analyzeMemoryGrowth(memorySnapshots);
    const leakDetection = this.detectMemoryLeaks(memorySnapshots);
    
    return {
      baselineMemory: startMemory,
      peakMemory: Math.max(...memorySnapshots.map(s => s.memoryUsage)),
      averageMemory: memorySnapshots.reduce((sum, s) => sum + s.memoryUsage, 0) / memorySnapshots.length,
      memoryGrowth,
      leakDetection,
      snapshots: memorySnapshots
    };
  }

  /**
   * Scalability analysis across different graph sizes
   */
  async analyzeScalability(testConfig) {
    const scalabilityTests = [
      { nodes: 1000, edges: 5000 },
      { nodes: 2000, edges: 10000 },
      { nodes: 5000, edges: 25000 },
      { nodes: 10000, edges: 50000 },
      { nodes: 20000, edges: 100000 }
    ];
    
    const results = [];
    
    for (const test of scalabilityTests) {
      if (test.nodes <= testConfig.nodeCount) {
        console.log(`Testing scalability with ${test.nodes} nodes...`);
        
        const subGraph = this.generateSubGraph(test.nodes, test.edges);
        const performance = await this.measureSubGraphPerformance(subGraph);
        
        results.push({
          nodeCount: test.nodes,
          edgeCount: test.edges,
          averageFPS: performance.averageFPS,
          memoryUsage: performance.memoryUsage,
          layoutTime: performance.layoutTime
        });
      }
    }
    
    return {
      scalabilityData: results,
      performanceDegradation: this.calculatePerformanceDegradation(results),
      memoryScaling: this.calculateMemoryScaling(results),
      optimalNodeCount: this.findOptimalNodeCount(results)
    };
  }

  /**
   * Analyze frame data for comprehensive performance metrics
   */
  analyzeFrameData(frameData) {
    const frameTimes = frameData.map(f => f.frameTime);
    const fps = frameData.map(f => 1000 / f.frameTime);
    
    return {
      frameCount: frameData.length,
      averageFrameTime: frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length,
      averageFPS: fps.reduce((a, b) => a + b, 0) / fps.length,
      minFPS: Math.min(...fps),
      maxFPS: Math.max(...fps),
      fps99thPercentile: this.calculatePercentile(fps, 0.01), // 1% worst frames
      droppedFrames: fps.filter(f => f < 30).length, // Frames below 30 FPS
      frameTimeStdDev: this.calculateStandardDeviation(frameTimes),
      averageLayoutTime: frameData.reduce((sum, f) => sum + f.layoutTime, 0) / frameData.length,
      averageSpatialTime: frameData.reduce((sum, f) => sum + f.spatialTime, 0) / frameData.length,
      averageRenderTime: frameData.reduce((sum, f) => sum + f.renderTime, 0) / frameData.length,
      performanceGrade: this.calculatePerformanceGrade(fps)
    };
  }

  /**
   * Calculate performance grade based on FPS consistency
   */
  calculatePerformanceGrade(fps) {
    const averageFPS = fps.reduce((a, b) => a + b, 0) / fps.length;
    const belowTarget = fps.filter(f => f < this.config.targetFPS).length / fps.length;
    
    if (averageFPS >= this.config.targetFPS && belowTarget < 0.05) return 'A';
    if (averageFPS >= this.config.targetFPS * 0.9 && belowTarget < 0.1) return 'B';
    if (averageFPS >= this.config.targetFPS * 0.8 && belowTarget < 0.2) return 'C';
    if (averageFPS >= this.config.targetFPS * 0.7) return 'D';
    return 'F';
  }

  /**
   * Utility methods for statistical analysis
   */
  calculateStandardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }

  calculatePercentile(values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.floor(sorted.length * percentile);
    return sorted[index];
  }

  /**
   * Memory usage measurement (platform-specific)
   */
  getMemoryUsage() {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
    
    // Fallback estimation
    return {
      used: 0,
      total: 0,
      limit: 0,
      estimated: true
    };
  }

  /**
   * Generate test graphs with various characteristics
   */
  async generateTestGraph(config) {
    const generator = new TestGraphGenerator();
    
    switch (config.graphType || 'musical') {
      case 'musical':
        return generator.generateMusicalGraph(config);
      case 'random':
        return generator.generateRandomGraph(config);
      case 'clustered':
        return generator.generateClusteredGraph(config);
      case 'scale-free':
        return generator.generateScaleFreeGraph(config);
      default:
        throw new Error(`Unknown graph type: ${config.graphType}`);
    }
  }

  /**
   * Cleanup resources after testing
   */
  async cleanup() {
    if (this.testGraph) {
      this.testGraph.destroy();
      this.testGraph = null;
    }
    
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
    
    if (this.spatialIndex) {
      this.spatialIndex.clear();
      this.spatialIndex = null;
    }
    
    // Force garbage collection
    if (window.gc) {
      window.gc();
    }
  }

  /**
   * Export results for analysis
   */
  exportResults(format = 'json') {
    const data = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.testResults,
      summary: this.generateSummary()
    };
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        return data;
    }
  }
}

/**
 * Test graph generator for various graph types
 */
class TestGraphGenerator {
  generateMusicalGraph(config) {
    const nodes = [];
    const edges = [];
    
    // Generate musical nodes with realistic properties
    for (let i = 0; i < config.nodeCount; i++) {
      nodes.push({
        id: `song_${i}`,
        title: `Song ${i}`,
        artist: `Artist ${Math.floor(i / 10)}`,
        genre: this.randomGenre(),
        energy: Math.random(),
        valence: Math.random(),
        danceability: Math.random(),
        bpm: 60 + Math.random() * 140,
        key: this.randomKey(),
        year: 1960 + Math.floor(Math.random() * 60),
        position: {
          x: Math.random() * 2000 - 1000,
          y: Math.random() * 2000 - 1000
        }
      });
    }
    
    // Generate edges based on musical similarity
    for (let i = 0; i < config.edgeCount; i++) {
      const source = nodes[Math.floor(Math.random() * nodes.length)];
      const target = nodes[Math.floor(Math.random() * nodes.length)];
      
      if (source !== target) {
        edges.push({
          id: `edge_${i}`,
          source,
          target,
          weight: this.calculateMusicalSimilarity(source, target)
        });
      }
    }
    
    return new Graph(nodes, edges);
  }
  
  randomGenre() {
    const genres = ['rock', 'pop', 'jazz', 'electronic', 'hip-hop', 'country', 'folk', 'blues'];
    return genres[Math.floor(Math.random() * genres.length)];
  }
  
  randomKey() {
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const modes = ['', 'm']; // major and minor
    return keys[Math.floor(Math.random() * keys.length)] + modes[Math.floor(Math.random() * modes.length)];
  }
  
  calculateMusicalSimilarity(song1, song2) {
    const energyDiff = Math.abs(song1.energy - song2.energy);
    const valenceDiff = Math.abs(song1.valence - song2.valence);
    const bpmRatio = Math.min(song1.bpm, song2.bpm) / Math.max(song1.bpm, song2.bpm);
    const genreMatch = song1.genre === song2.genre ? 0.8 : 0.2;
    
    return (1 - energyDiff) * 0.3 + (1 - valenceDiff) * 0.3 + bpmRatio * 0.2 + genreMatch * 0.2;
  }
}

/**
 * Benchmark results container
 */
class BenchmarkResults {
  constructor(testConfig) {
    this.testConfig = testConfig;
    this.timestamp = new Date().toISOString();
    this.measurements = {};
    this.algorithmMetrics = {};
    this.memoryMetrics = {};
    this.scalabilityMetrics = {};
  }
  
  addMeasurements(measurements) {
    this.measurements = measurements;
  }
  
  addAlgorithmMetrics(metrics) {
    this.algorithmMetrics = metrics;
  }
  
  addMemoryMetrics(metrics) {
    this.memoryMetrics = metrics;
  }
  
  addScalabilityMetrics(metrics) {
    this.scalabilityMetrics = metrics;
  }
  
  getSummary() {
    return {
      performanceGrade: this.measurements.performanceGrade,
      averageFPS: this.measurements.averageFPS,
      memoryUsage: this.memoryMetrics.peakMemory,
      nodeCount: this.testConfig.nodeCount,
      edgeCount: this.testConfig.edgeCount
    };
  }
}

// Export for use in testing environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PerformanceBenchmarkFramework,
    TestGraphGenerator,
    BenchmarkResults
  };
}