/**
 * Barnes-Hut Algorithm Implementation for Force Calculation Optimization
 * Reduces O(N²) force calculations to O(N log N) using spatial indexing
 */

export interface Point {
  x: number;
  y: number;
  mass?: number;
  vx?: number;
  vy?: number;
  id?: string;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ForceResult {
  fx: number;
  fy: number;
}

/**
 * QuadTree node for spatial partitioning
 */
export class QuadTreeNode {
  boundary: Rectangle;
  capacity: number;
  points: Point[];
  divided: boolean;
  
  // Center of mass data
  centerOfMass: Point | null;
  totalMass: number;
  
  // Child quadrants
  northwest: QuadTreeNode | null;
  northeast: QuadTreeNode | null;
  southwest: QuadTreeNode | null;
  southeast: QuadTreeNode | null;

  constructor(boundary: Rectangle, capacity: number = 1) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.points = [];
    this.divided = false;
    this.centerOfMass = null;
    this.totalMass = 0;
    
    this.northwest = null;
    this.northeast = null;
    this.southwest = null;
    this.southeast = null;
  }

  /**
   * Insert a point into the quadtree
   */
  insert(point: Point): boolean {
    if (!this.contains(point)) {
      return false;
    }

    // Add to center of mass calculation
    this.updateCenterOfMass(point);

    if (this.points.length < this.capacity && !this.divided) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    // Try to insert into one of the children
    return (
      this.northwest!.insert(point) ||
      this.northeast!.insert(point) ||
      this.southwest!.insert(point) ||
      this.southeast!.insert(point)
    );
  }

  /**
   * Check if point is within this node's boundary
   */
  private contains(point: Point): boolean {
    return (
      point.x >= this.boundary.x &&
      point.x < this.boundary.x + this.boundary.width &&
      point.y >= this.boundary.y &&
      point.y < this.boundary.y + this.boundary.height
    );
  }

  /**
   * Update center of mass for this node
   */
  private updateCenterOfMass(point: Point): void {
    const mass = point.mass || 1;
    
    if (this.centerOfMass === null) {
      this.centerOfMass = { x: point.x, y: point.y, mass };
      this.totalMass = mass;
    } else {
      const newTotalMass = this.totalMass + mass;
      this.centerOfMass.x = (this.centerOfMass.x * this.totalMass + point.x * mass) / newTotalMass;
      this.centerOfMass.y = (this.centerOfMass.y * this.totalMass + point.y * mass) / newTotalMass;
      this.centerOfMass.mass = newTotalMass;
      this.totalMass = newTotalMass;
    }
  }

  /**
   * Subdivide this node into four quadrants
   */
  private subdivide(): void {
    const x = this.boundary.x;
    const y = this.boundary.y;
    const w = this.boundary.width / 2;
    const h = this.boundary.height / 2;

    this.northwest = new QuadTreeNode({ x, y, width: w, height: h }, this.capacity);
    this.northeast = new QuadTreeNode({ x: x + w, y, width: w, height: h }, this.capacity);
    this.southwest = new QuadTreeNode({ x, y: y + h, width: w, height: h }, this.capacity);
    this.southeast = new QuadTreeNode({ x: x + w, y: y + h, width: w, height: h }, this.capacity);

    this.divided = true;

    // Redistribute existing points to children
    for (const point of this.points) {
      this.northwest.insert(point) ||
      this.northeast.insert(point) ||
      this.southwest.insert(point) ||
      this.southeast.insert(point);
    }

    // Clear points array as they're now in children
    this.points = [];
  }

  /**
   * Calculate force using Barnes-Hut approximation
   */
  calculateForce(point: Point, theta: number = 0.5): ForceResult {
    if (this.centerOfMass === null || this.totalMass === 0) {
      return { fx: 0, fy: 0 };
    }

    const dx = this.centerOfMass.x - point.x;
    const dy = this.centerOfMass.y - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Avoid self-interaction and division by zero
    if (distance < 1e-6) {
      return { fx: 0, fy: 0 };
    }

    // Barnes-Hut criterion: s/d < θ
    // If the ratio of the size of the region to the distance is small enough,
    // treat it as a single body
    const s = Math.max(this.boundary.width, this.boundary.height);
    if (s / distance < theta || !this.divided) {
      return this.calculateDirectForce(point, this.centerOfMass, distance);
    }

    // Otherwise, recursively calculate forces from children
    let totalForce: ForceResult = { fx: 0, fy: 0 };

    if (this.northwest) {
      const force = this.northwest.calculateForce(point, theta);
      totalForce.fx += force.fx;
      totalForce.fy += force.fy;
    }
    if (this.northeast) {
      const force = this.northeast.calculateForce(point, theta);
      totalForce.fx += force.fx;
      totalForce.fy += force.fy;
    }
    if (this.southwest) {
      const force = this.southwest.calculateForce(point, theta);
      totalForce.fx += force.fx;
      totalForce.fy += force.fy;
    }
    if (this.southeast) {
      const force = this.southeast.calculateForce(point, theta);
      totalForce.fx += force.fx;
      totalForce.fy += force.fy;
    }

    return totalForce;
  }

  /**
   * Calculate direct force between two points
   */
  private calculateDirectForce(point: Point, other: Point, distance: number): ForceResult {
    const dx = other.x - point.x;
    const dy = other.y - point.y;
    
    const pointMass = point.mass || 1;
    const otherMass = other.mass || 1;
    
    // Coulomb's law with gravitational constant
    const G = -30; // Repulsive force constant
    const force = (G * pointMass * otherMass) / (distance * distance * distance);
    
    return {
      fx: force * dx,
      fy: force * dy
    };
  }

  /**
   * Query points within a region
   */
  query(range: Rectangle): Point[] {
    const found: Point[] = [];
    
    if (!this.intersects(range)) {
      return found;
    }

    // Check points in this node
    for (const point of this.points) {
      if (this.pointInRange(point, range)) {
        found.push(point);
      }
    }

    // Recursively check children
    if (this.divided) {
      found.push(...this.northwest!.query(range));
      found.push(...this.northeast!.query(range));
      found.push(...this.southwest!.query(range));
      found.push(...this.southeast!.query(range));
    }

    return found;
  }

  /**
   * Check if this node's boundary intersects with the query range
   */
  private intersects(range: Rectangle): boolean {
    return !(
      range.x > this.boundary.x + this.boundary.width ||
      range.x + range.width < this.boundary.x ||
      range.y > this.boundary.y + this.boundary.height ||
      range.y + range.height < this.boundary.y
    );
  }

  /**
   * Check if point is within the query range
   */
  private pointInRange(point: Point, range: Rectangle): boolean {
    return (
      point.x >= range.x &&
      point.x <= range.x + range.width &&
      point.y >= range.y &&
      point.y <= range.y + range.height
    );
  }

  /**
   * Get total number of points in this subtree
   */
  getPointCount(): number {
    let count = this.points.length;
    
    if (this.divided) {
      count += this.northwest!.getPointCount();
      count += this.northeast!.getPointCount();
      count += this.southwest!.getPointCount();
      count += this.southeast!.getPointCount();
    }
    
    return count;
  }

  /**
   * Clear all points from the tree
   */
  clear(): void {
    this.points = [];
    this.centerOfMass = null;
    this.totalMass = 0;
    this.divided = false;
    this.northwest = null;
    this.northeast = null;
    this.southwest = null;
    this.southeast = null;
  }
}

/**
 * Barnes-Hut Force Simulation Implementation
 */
export class BarnesHutSimulation {
  private quadTree: QuadTreeNode;
  private bounds: Rectangle;
  private theta: number;
  private alpha: number;
  private alphaDecay: number;
  private velocityDecay: number;
  private forces: Map<string, { charge: number; collision: number; link: number }>;

  constructor(
    bounds: Rectangle,
    options: {
      theta?: number;
      alpha?: number;
      alphaDecay?: number;
      velocityDecay?: number;
    } = {}
  ) {
    this.bounds = bounds;
    this.theta = options.theta || 0.5;
    this.alpha = options.alpha || 1.0;
    this.alphaDecay = options.alphaDecay || 0.0228;
    this.velocityDecay = options.velocityDecay || 0.4;
    this.forces = new Map();
    
    this.quadTree = new QuadTreeNode(bounds);
  }

  /**
   * Update simulation for one tick
   */
  tick(points: Point[]): boolean {
    // Rebuild quadtree for current positions
    this.rebuildQuadTree(points);

    // Apply Barnes-Hut forces
    this.applyBarnesHutForces(points);

    // Apply additional forces (collision, links, etc.)
    this.applyAdditionalForces(points);

    // Update positions based on velocities
    this.updatePositions(points);

    // Update alpha
    this.alpha *= (1 - this.alphaDecay);

    return this.alpha > 0.005; // Continue simulation
  }

  /**
   * Rebuild the quadtree with current point positions
   */
  private rebuildQuadTree(points: Point[]): void {
    this.quadTree.clear();
    this.quadTree = new QuadTreeNode(this.bounds);

    for (const point of points) {
      this.quadTree.insert(point);
    }
  }

  /**
   * Apply Barnes-Hut force calculations
   */
  private applyBarnesHutForces(points: Point[]): void {
    for (const point of points) {
      const force = this.quadTree.calculateForce(point, this.theta);
      
      // Apply force with alpha scaling
      point.vx = (point.vx || 0) + force.fx * this.alpha;
      point.vy = (point.vy || 0) + force.fy * this.alpha;
      
      // Store force information for debugging
      if (point.id) {
        const forceInfo = this.forces.get(point.id) || { charge: 0, collision: 0, link: 0 };
        forceInfo.charge = Math.sqrt(force.fx * force.fx + force.fy * force.fy);
        this.forces.set(point.id, forceInfo);
      }
    }
  }

  /**
   * Apply additional forces (collision detection, links)
   */
  private applyAdditionalForces(points: Point[]): void {
    // Simple collision detection using spatial queries
    for (const point of points) {
      const radius = 20; // Node radius
      const queryBounds: Rectangle = {
        x: point.x - radius * 2,
        y: point.y - radius * 2,
        width: radius * 4,
        height: radius * 4
      };

      const nearby = this.quadTree.query(queryBounds);
      
      for (const other of nearby) {
        if (other === point) continue;

        const dx = other.x - point.x;
        const dy = other.y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = radius * 2;

        if (distance < minDistance && distance > 0) {
          const overlap = minDistance - distance;
          const force = overlap * 0.5;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          point.vx = (point.vx || 0) - fx * this.alpha;
          point.vy = (point.vy || 0) - fy * this.alpha;

          // Store collision force info
          if (point.id) {
            const forceInfo = this.forces.get(point.id) || { charge: 0, collision: 0, link: 0 };
            forceInfo.collision += Math.sqrt(fx * fx + fy * fy);
            this.forces.set(point.id, forceInfo);
          }
        }
      }
    }
  }

  /**
   * Update point positions based on velocities
   */
  private updatePositions(points: Point[]): void {
    for (const point of points) {
      // Apply velocity decay
      point.vx = (point.vx || 0) * this.velocityDecay;
      point.vy = (point.vy || 0) * this.velocityDecay;

      // Update positions
      point.x += point.vx || 0;
      point.y += point.vy || 0;

      // Keep points within bounds
      point.x = Math.max(10, Math.min(this.bounds.width - 10, point.x));
      point.y = Math.max(10, Math.min(this.bounds.height - 10, point.y));
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    nodeCount: number;
    theta: number;
    alpha: number;
    averageForce: number;
    maxForce: number;
  } {
    const forceValues = Array.from(this.forces.values())
      .map(f => f.charge + f.collision + f.link);
    
    return {
      nodeCount: this.quadTree.getPointCount(),
      theta: this.theta,
      alpha: this.alpha,
      averageForce: forceValues.length > 0 
        ? forceValues.reduce((sum, f) => sum + f, 0) / forceValues.length 
        : 0,
      maxForce: forceValues.length > 0 ? Math.max(...forceValues) : 0
    };
  }

  /**
   * Update simulation parameters
   */
  updateParameters(params: {
    theta?: number;
    alpha?: number;
    alphaDecay?: number;
    velocityDecay?: number;
  }): void {
    if (params.theta !== undefined) this.theta = params.theta;
    if (params.alpha !== undefined) this.alpha = params.alpha;
    if (params.alphaDecay !== undefined) this.alphaDecay = params.alphaDecay;
    if (params.velocityDecay !== undefined) this.velocityDecay = params.velocityDecay;
  }

  /**
   * Restart simulation with new alpha
   */
  restart(alpha: number = 1.0): void {
    this.alpha = alpha;
  }

  /**
   * Check if simulation is still running
   */
  isRunning(): boolean {
    return this.alpha > 0.005;
  }

  /**
   * Find points within radius using spatial indexing
   */
  findPointsInRadius(center: Point, radius: number): Point[] {
    const queryBounds: Rectangle = {
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2
    };

    const candidates = this.quadTree.query(queryBounds);
    
    return candidates.filter(point => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  /**
   * Find closest point to given coordinates
   */
  findClosestPoint(x: number, y: number): Point | null {
    const searchRadius = 50;
    const candidates = this.findPointsInRadius({ x, y }, searchRadius);
    
    if (candidates.length === 0) return null;

    let closest = candidates[0];
    let minDistance = Infinity;

    for (const candidate of candidates) {
      const dx = candidate.x - x;
      const dy = candidate.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        minDistance = distance;
        closest = candidate;
      }
    }

    return closest;
  }
}

let simulation: BarnesHutSimulation | null = null;
let nodes: Point[] = [];
let edges: any[] = [];

const tick = () => {
  if (!simulation) return;

  const shouldContinue = simulation.tick(nodes);

  self.postMessage({ type: 'tick', nodes });

  if (shouldContinue) {
    setTimeout(tick, 16); // ~60fps
  } else {
    self.postMessage({ type: 'end', nodes });
  }
};

self.onmessage = (event) => {
  const { type, nodes: newNodes, edges: newEdges, width, height, layoutOptions, alpha } = event.data;

  switch (type) {
    case 'start':
      nodes = newNodes.map((node: any) => ({
        ...node,
        x: node.x || Math.random() * width,
        y: node.y || Math.random() * height,
      }));
      edges = newEdges;
      const bounds = { x: 0, y: 0, width, height };
      simulation = new BarnesHutSimulation(bounds, layoutOptions.forceDirected);
      tick();
      break;
    case 'stop':
      simulation = null;
      break;
    case 'restart':
      if (simulation) {
        simulation.restart(alpha);
        tick();
      }
      break;
  }
};