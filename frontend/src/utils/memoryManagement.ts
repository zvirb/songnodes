/**
 * Advanced Memory Management System
 * Object pooling, garbage collection optimization, and memory leak detection
 */

export interface PoolableObject {
  reset(): void;
  isInUse(): boolean;
  markInUse(): void;
  markAvailable(): void;
}

export interface MemoryPoolConfig {
  initialSize: number;
  maxSize: number;
  growthFactor: number;
  shrinkThreshold: number;
  autoShrink: boolean;
  gcHintThreshold: number;
}

export interface MemoryMetrics {
  poolSize: number;
  inUse: number;
  available: number;
  totalAllocated: number;
  totalReleased: number;
  hitRate: number;
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
  } | null;
  gcEvents: number;
  lastGC: number;
}

/**
 * Generic object pool for memory optimization
 */
export class ObjectPool<T extends PoolableObject> {
  private pool: T[] = [];
  private inUseObjects = new Set<T>();
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private config: MemoryPoolConfig;
  private metrics: MemoryMetrics;
  private shrinkTimer: number | null = null;

  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    config: Partial<MemoryPoolConfig> = {}
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.config = {
      initialSize: 10,
      maxSize: 1000,
      growthFactor: 1.5,
      shrinkThreshold: 0.25,
      autoShrink: true,
      gcHintThreshold: 100,
      ...config
    };

    this.metrics = {
      poolSize: 0,
      inUse: 0,
      available: 0,
      totalAllocated: 0,
      totalReleased: 0,
      hitRate: 0,
      memoryUsage: null,
      gcEvents: 0,
      lastGC: 0
    };

    this.preallocate();
    this.setupGCMonitoring();
  }

  /**
   * Acquire an object from the pool
   */
  acquire(): T {
    let obj: T;

    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
      this.metrics.totalAllocated++;
    } else {
      obj = this.createFn();
      this.metrics.totalAllocated++;
    }

    this.inUseObjects.add(obj);
    obj.markInUse();
    this.updateMetrics();

    return obj;
  }

  /**
   * Release an object back to the pool
   */
  release(obj: T): void {
    if (!this.inUseObjects.has(obj)) {
      console.warn('Attempting to release object not from this pool');
      return;
    }

    this.inUseObjects.delete(obj);
    obj.markAvailable();
    this.resetFn(obj);
    obj.reset();

    // Return to pool if under max size
    if (this.pool.length < this.config.maxSize) {
      this.pool.push(obj);
    }

    this.metrics.totalReleased++;
    this.updateMetrics();

    // Schedule shrinking if enabled
    if (this.config.autoShrink) {
      this.scheduleShrink();
    }

    // Hint garbage collection if many objects released
    if (this.metrics.totalReleased % this.config.gcHintThreshold === 0) {
      this.hintGarbageCollection();
    }
  }

  /**
   * Release all objects from pool
   */
  releaseAll(): void {
    this.inUseObjects.forEach(obj => {
      obj.markAvailable();
      this.resetFn(obj);
      obj.reset();
    });

    this.pool.push(...Array.from(this.inUseObjects));
    this.inUseObjects.clear();
    this.updateMetrics();
  }

  /**
   * Clear the entire pool
   */
  clear(): void {
    this.pool = [];
    this.inUseObjects.clear();
    this.updateMetrics();
  }

  /**
   * Get current metrics
   */
  getMetrics(): MemoryMetrics {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  /**
   * Force garbage collection hint
   */
  forceGC(): void {
    this.hintGarbageCollection();
  }

  /**
   * Optimize pool size based on usage patterns
   */
  optimize(): void {
    const utilizationRate = this.inUseObjects.size / this.pool.length;
    
    if (utilizationRate > 0.8 && this.pool.length < this.config.maxSize) {
      // Grow pool
      const growthSize = Math.floor(this.pool.length * (this.config.growthFactor - 1));
      this.grow(growthSize);
    } else if (utilizationRate < this.config.shrinkThreshold) {
      // Shrink pool
      this.shrink();
    }
  }

  /**
   * Private methods
   */
  private preallocate(): void {
    for (let i = 0; i < this.config.initialSize; i++) {
      const obj = this.createFn();
      this.resetFn(obj);
      obj.reset();
      this.pool.push(obj);
    }
    this.updateMetrics();
  }

  private grow(size: number): void {
    for (let i = 0; i < size && this.pool.length < this.config.maxSize; i++) {
      const obj = this.createFn();
      this.resetFn(obj);
      obj.reset();
      this.pool.push(obj);
    }
    this.updateMetrics();
  }

  private shrink(): void {
    const targetSize = Math.max(
      this.config.initialSize,
      Math.floor(this.inUseObjects.size * 1.5)
    );
    
    while (this.pool.length > targetSize) {
      this.pool.pop();
    }
    
    this.updateMetrics();
  }

  private scheduleShrink(): void {
    if (this.shrinkTimer) {
      clearTimeout(this.shrinkTimer);
    }

    this.shrinkTimer = window.setTimeout(() => {
      const utilizationRate = this.inUseObjects.size / (this.pool.length + this.inUseObjects.size);
      if (utilizationRate < this.config.shrinkThreshold) {
        this.shrink();
      }
      this.shrinkTimer = null;
    }, 5000); // Wait 5 seconds before shrinking
  }

  private updateMetrics(): void {
    this.metrics.poolSize = this.pool.length;
    this.metrics.inUse = this.inUseObjects.size;
    this.metrics.available = this.pool.length;
    
    const totalRequests = this.metrics.totalAllocated;
    const poolHits = totalRequests - this.countObjectsCreated();
    this.metrics.hitRate = totalRequests > 0 ? (poolHits / totalRequests) * 100 : 0;
  }

  private countObjectsCreated(): number {
    // Estimate based on pool size and total allocations
    return Math.max(0, this.metrics.totalAllocated - this.pool.length);
  }

  private updateMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
  }

  private hintGarbageCollection(): void {
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
      this.metrics.gcEvents++;
      this.metrics.lastGC = performance.now();
    }
  }

  private setupGCMonitoring(): void {
    // Monitor memory usage and trigger GC hints
    setInterval(() => {
      this.updateMemoryUsage();
      
      if (this.metrics.memoryUsage) {
        const memoryPressure = this.metrics.memoryUsage.used / this.metrics.memoryUsage.limit;
        
        if (memoryPressure > 0.8) {
          this.hintGarbageCollection();
          this.optimize();
        }
      }
    }, 10000); // Check every 10 seconds
  }
}

/**
 * Node object for graph visualization with pooling support
 */
export class PooledNode implements PoolableObject {
  id: string = '';
  x: number = 0;
  y: number = 0;
  vx: number = 0;
  vy: number = 0;
  radius: number = 5;
  color: string = '#666666';
  mass: number = 1;
  private inUseFlag: boolean = false;

  reset(): void {
    this.id = '';
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 5;
    this.color = '#666666';
    this.mass = 1;
  }

  isInUse(): boolean {
    return this.inUseFlag;
  }

  markInUse(): void {
    this.inUseFlag = true;
  }

  markAvailable(): void {
    this.inUseFlag = false;
  }

  initialize(data: {
    id: string;
    x?: number;
    y?: number;
    radius?: number;
    color?: string;
    mass?: number;
  }): void {
    this.id = data.id;
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.radius = data.radius || 5;
    this.color = data.color || '#666666';
    this.mass = data.mass || 1;
  }
}

/**
 * Edge object for graph visualization with pooling support
 */
export class PooledEdge implements PoolableObject {
  id: string = '';
  sourceId: string = '';
  targetId: string = '';
  weight: number = 1;
  color: string = '#666666';
  width: number = 1;
  private inUseFlag: boolean = false;

  reset(): void {
    this.id = '';
    this.sourceId = '';
    this.targetId = '';
    this.weight = 1;
    this.color = '#666666';
    this.width = 1;
  }

  isInUse(): boolean {
    return this.inUseFlag;
  }

  markInUse(): void {
    this.inUseFlag = true;
  }

  markAvailable(): void {
    this.inUseFlag = false;
  }

  initialize(data: {
    id: string;
    sourceId: string;
    targetId: string;
    weight?: number;
    color?: string;
    width?: number;
  }): void {
    this.id = data.id;
    this.sourceId = data.sourceId;
    this.targetId = data.targetId;
    this.weight = data.weight || 1;
    this.color = data.color || '#666666';
    this.width = data.width || 1;
  }
}

/**
 * WebGL buffer object with pooling support
 */
export class PooledWebGLBuffer implements PoolableObject {
  buffer: WebGLBuffer | null = null;
  size: number = 0;
  type: 'vertex' | 'index' = 'vertex';
  private inUseFlag: boolean = false;
  private gl: WebGLRenderingContext | null = null;

  reset(): void {
    if (this.gl && this.buffer) {
      this.gl.deleteBuffer(this.buffer);
    }
    this.buffer = null;
    this.size = 0;
    this.gl = null;
  }

  isInUse(): boolean {
    return this.inUseFlag;
  }

  markInUse(): void {
    this.inUseFlag = true;
  }

  markAvailable(): void {
    this.inUseFlag = false;
  }

  initialize(gl: WebGLRenderingContext, type: 'vertex' | 'index', size: number): void {
    this.gl = gl;
    this.type = type;
    this.size = size;
    this.buffer = gl.createBuffer();
  }
}

/**
 * Memory manager with multiple pools and monitoring
 */
export class MemoryManager {
  private nodePool: ObjectPool<PooledNode>;
  private edgePool: ObjectPool<PooledEdge>;
  private bufferPool: ObjectPool<PooledWebGLBuffer>;
  private memoryMonitor: MemoryMonitor;

  constructor() {
    // Initialize pools
    this.nodePool = new ObjectPool<PooledNode>(
      () => new PooledNode(),
      (node) => node.reset(),
      {
        initialSize: 100,
        maxSize: 10000,
        growthFactor: 1.5,
        autoShrink: true,
        gcHintThreshold: 50
      }
    );

    this.edgePool = new ObjectPool<PooledEdge>(
      () => new PooledEdge(),
      (edge) => edge.reset(),
      {
        initialSize: 200,
        maxSize: 50000,
        growthFactor: 1.5,
        autoShrink: true,
        gcHintThreshold: 100
      }
    );

    this.bufferPool = new ObjectPool<PooledWebGLBuffer>(
      () => new PooledWebGLBuffer(),
      (buffer) => buffer.reset(),
      {
        initialSize: 10,
        maxSize: 100,
        growthFactor: 1.2,
        autoShrink: true,
        gcHintThreshold: 10
      }
    );

    this.memoryMonitor = new MemoryMonitor();
    this.setupPeriodicOptimization();
  }

  /**
   * Acquire objects from pools
   */
  acquireNode(): PooledNode {
    return this.nodePool.acquire();
  }

  acquireEdge(): PooledEdge {
    return this.edgePool.acquire();
  }

  acquireBuffer(): PooledWebGLBuffer {
    return this.bufferPool.acquire();
  }

  /**
   * Release objects back to pools
   */
  releaseNode(node: PooledNode): void {
    this.nodePool.release(node);
  }

  releaseEdge(edge: PooledEdge): void {
    this.edgePool.release(edge);
  }

  releaseBuffer(buffer: PooledWebGLBuffer): void {
    this.bufferPool.release(buffer);
  }

  /**
   * Batch operations
   */
  acquireNodes(count: number): PooledNode[] {
    const nodes: PooledNode[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push(this.nodePool.acquire());
    }
    return nodes;
  }

  releaseNodes(nodes: PooledNode[]): void {
    nodes.forEach(node => this.nodePool.release(node));
  }

  acquireEdges(count: number): PooledEdge[] {
    const edges: PooledEdge[] = [];
    for (let i = 0; i < count; i++) {
      edges.push(this.edgePool.acquire());
    }
    return edges;
  }

  releaseEdges(edges: PooledEdge[]): void {
    edges.forEach(edge => this.edgePool.release(edge));
  }

  /**
   * Memory optimization and monitoring
   */
  optimize(): void {
    this.nodePool.optimize();
    this.edgePool.optimize();
    this.bufferPool.optimize();
  }

  forceGC(): void {
    this.nodePool.forceGC();
    this.edgePool.forceGC();
    this.bufferPool.forceGC();
  }

  getMetrics(): {
    nodes: MemoryMetrics;
    edges: MemoryMetrics;
    buffers: MemoryMetrics;
    overall: {
      totalObjects: number;
      memoryUsage: number;
      leakDetected: boolean;
    };
  } {
    const nodeMetrics = this.nodePool.getMetrics();
    const edgeMetrics = this.edgePool.getMetrics();
    const bufferMetrics = this.bufferPool.getMetrics();
    const monitorMetrics = this.memoryMonitor.getMetrics();

    return {
      nodes: nodeMetrics,
      edges: edgeMetrics,
      buffers: bufferMetrics,
      overall: {
        totalObjects: nodeMetrics.inUse + edgeMetrics.inUse + bufferMetrics.inUse,
        memoryUsage: monitorMetrics.currentUsage,
        leakDetected: monitorMetrics.leakDetected
      }
    };
  }

  /**
   * Cleanup all pools
   */
  cleanup(): void {
    this.nodePool.clear();
    this.edgePool.clear();
    this.bufferPool.clear();
  }

  private setupPeriodicOptimization(): void {
    setInterval(() => {
      this.optimize();
      
      const metrics = this.getMetrics();
      if (metrics.overall.leakDetected) {
        console.warn('Memory leak detected, forcing garbage collection');
        this.forceGC();
      }
    }, 30000); // Optimize every 30 seconds
  }
}

/**
 * Memory leak detection and monitoring
 */
export class MemoryMonitor {
  private samples: number[] = [];
  private readonly sampleSize = 20;
  private readonly growthThreshold = 50; // MB
  private lastGCTime = 0;

  getMetrics(): {
    currentUsage: number;
    averageUsage: number;
    peakUsage: number;
    growthRate: number;
    leakDetected: boolean;
    gcFrequency: number;
  } {
    const currentUsage = this.getCurrentMemoryUsage();
    this.samples.push(currentUsage);
    
    if (this.samples.length > this.sampleSize) {
      this.samples.shift();
    }

    const averageUsage = this.samples.reduce((sum, usage) => sum + usage, 0) / this.samples.length;
    const peakUsage = Math.max(...this.samples);
    const growthRate = this.calculateGrowthRate();
    const leakDetected = this.detectLeak();
    const gcFrequency = this.calculateGCFrequency();

    return {
      currentUsage,
      averageUsage,
      peakUsage,
      growthRate,
      leakDetected,
      gcFrequency
    };
  }

  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  private calculateGrowthRate(): number {
    if (this.samples.length < 2) return 0;
    
    const recent = this.samples.slice(-5);
    const older = this.samples.slice(0, 5);
    
    if (recent.length === 0 || older.length === 0) return 0;
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  private detectLeak(): boolean {
    if (this.samples.length < this.sampleSize) return false;
    
    const growthRate = this.calculateGrowthRate();
    const currentUsage = this.samples[this.samples.length - 1];
    const baselineUsage = this.samples[0];
    
    // Check for consistent growth over threshold
    return growthRate > 10 && (currentUsage - baselineUsage) > this.growthThreshold;
  }

  private calculateGCFrequency(): number {
    // Estimate GC frequency based on memory patterns
    const now = performance.now();
    const timeSinceLastGC = now - this.lastGCTime;
    
    // Look for memory drops indicating GC
    if (this.samples.length >= 2) {
      const current = this.samples[this.samples.length - 1];
      const previous = this.samples[this.samples.length - 2];
      
      if (previous > current + 5) { // 5MB drop indicates possible GC
        this.lastGCTime = now;
        return timeSinceLastGC;
      }
    }
    
    return timeSinceLastGC;
  }
}

// Global memory manager instance
export const globalMemoryManager = new MemoryManager();

// Utility functions for easy access
export function acquireNode(): PooledNode {
  return globalMemoryManager.acquireNode();
}

export function releaseNode(node: PooledNode): void {
  globalMemoryManager.releaseNode(node);
}

export function acquireEdge(): PooledEdge {
  return globalMemoryManager.acquireEdge();
}

export function releaseEdge(edge: PooledEdge): void {
  globalMemoryManager.releaseEdge(edge);
}

export function optimizeMemory(): void {
  globalMemoryManager.optimize();
}

export function forceGarbageCollection(): void {
  globalMemoryManager.forceGC();
}

export function getMemoryMetrics() {
  return globalMemoryManager.getMetrics();
}