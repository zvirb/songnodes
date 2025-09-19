/**
 * Performance Metrics for Bridge Detection Algorithm
 *
 * Provides comprehensive metrics to measure the effectiveness and performance
 * of the bridge detection system in graph visualizations.
 */

export interface BridgeDetectionMetrics {
  // Detection accuracy
  truePositives: number;    // Correctly identified bridges
  falsePositives: number;   // Incorrectly identified as bridges
  falseNegatives: number;   // Missed bridge connections
  trueNegatives: number;    // Correctly identified non-bridges

  // Performance metrics
  detectionTimeMs: number;  // Time to detect all bridges
  edgesProcessed: number;   // Total edges analyzed
  nodesAnalyzed: number;    // Total nodes considered

  // Cluster metrics
  clustersIdentified: number;  // Number of distinct clusters
  bridgesDetected: number;     // Total bridge connections found
  averageClusterSize: number;  // Average nodes per cluster
  bridgeToEdgeRatio: number;   // Proportion of edges that are bridges

  // Quality metrics
  clusterSeparation: number;   // Average distance between clusters
  clusterCohesion: number;     // Average intra-cluster edge density
  bridgeEffectiveness: number; // How well bridges connect clusters
}

export class BridgeDetectionAnalyzer {
  private startTime: number = 0;
  private metrics: BridgeDetectionMetrics;

  constructor() {
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): BridgeDetectionMetrics {
    return {
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      trueNegatives: 0,
      detectionTimeMs: 0,
      edgesProcessed: 0,
      nodesAnalyzed: 0,
      clustersIdentified: 0,
      bridgesDetected: 0,
      averageClusterSize: 0,
      bridgeToEdgeRatio: 0,
      clusterSeparation: 0,
      clusterCohesion: 0,
      bridgeEffectiveness: 0
    };
  }

  /**
   * Start timing the bridge detection process
   */
  startDetection() {
    this.startTime = performance.now();
    this.metrics = this.initializeMetrics();
  }

  /**
   * End timing and record the duration
   */
  endDetection() {
    this.metrics.detectionTimeMs = performance.now() - this.startTime;
  }

  /**
   * Analyze bridge detection results against ground truth
   */
  analyzeDetectionAccuracy(
    detectedBridges: Set<string>,
    groundTruthBridges: Set<string>,
    allEdges: Array<{ id: string; source: string; target: string }>
  ) {
    // Calculate true/false positives and negatives
    allEdges.forEach(edge => {
      const edgeId = edge.id || `${edge.source}-${edge.target}`;
      const isDetected = detectedBridges.has(edgeId);
      const isActuallyBridge = groundTruthBridges.has(edgeId);

      if (isDetected && isActuallyBridge) {
        this.metrics.truePositives++;
      } else if (isDetected && !isActuallyBridge) {
        this.metrics.falsePositives++;
      } else if (!isDetected && isActuallyBridge) {
        this.metrics.falseNegatives++;
      } else {
        this.metrics.trueNegatives++;
      }
    });

    this.metrics.edgesProcessed = allEdges.length;
    this.metrics.bridgesDetected = detectedBridges.size;
    this.metrics.bridgeToEdgeRatio = detectedBridges.size / Math.max(1, allEdges.length);
  }

  /**
   * Analyze cluster structure and quality
   */
  analyzeClusterStructure(
    nodes: Array<{ id: string; x?: number; y?: number; cluster?: string }>,
    edges: Array<{ source: string; target: string; isBridge?: boolean }>
  ) {
    // Identify clusters using connected components (excluding bridge edges)
    const clusters = this.identifyClusters(nodes, edges);
    this.metrics.clustersIdentified = clusters.length;
    this.metrics.nodesAnalyzed = nodes.length;

    if (clusters.length > 0) {
      // Calculate average cluster size
      const totalNodesInClusters = clusters.reduce((sum, cluster) => sum + cluster.size, 0);
      this.metrics.averageClusterSize = totalNodesInClusters / clusters.length;

      // Calculate cluster cohesion (intra-cluster edge density)
      let totalCohesion = 0;
      clusters.forEach(cluster => {
        const clusterNodes = Array.from(cluster);
        const intraClusterEdges = edges.filter(edge => {
          const sourceInCluster = clusterNodes.includes(edge.source);
          const targetInCluster = clusterNodes.includes(edge.target);
          return sourceInCluster && targetInCluster && !edge.isBridge;
        });

        const possibleEdges = (clusterNodes.length * (clusterNodes.length - 1)) / 2;
        const density = possibleEdges > 0 ? intraClusterEdges.length / possibleEdges : 0;
        totalCohesion += density;
      });
      this.metrics.clusterCohesion = totalCohesion / clusters.length;

      // Calculate cluster separation
      if (clusters.length > 1 && nodes[0]?.x !== undefined) {
        let totalSeparation = 0;
        let pairCount = 0;

        for (let i = 0; i < clusters.length - 1; i++) {
          for (let j = i + 1; j < clusters.length; j++) {
            const separation = this.calculateClusterDistance(
              clusters[i],
              clusters[j],
              nodes
            );
            if (separation > 0) {
              totalSeparation += separation;
              pairCount++;
            }
          }
        }
        this.metrics.clusterSeparation = pairCount > 0 ? totalSeparation / pairCount : 0;
      }

      // Calculate bridge effectiveness
      const bridgeEdges = edges.filter(e => e.isBridge);
      if (bridgeEdges.length > 0) {
        let effectiveBridges = 0;
        bridgeEdges.forEach(bridge => {
          // Check if bridge connects different clusters
          const sourceCluster = this.findNodeCluster(bridge.source, clusters);
          const targetCluster = this.findNodeCluster(bridge.target, clusters);
          if (sourceCluster !== targetCluster) {
            effectiveBridges++;
          }
        });
        this.metrics.bridgeEffectiveness = effectiveBridges / bridgeEdges.length;
      }
    }
  }

  /**
   * Identify clusters using connected components algorithm
   */
  private identifyClusters(
    nodes: Array<{ id: string }>,
    edges: Array<{ source: string; target: string; isBridge?: boolean }>
  ): Set<string>[] {
    const adjacencyList = new Map<string, Set<string>>();
    const visited = new Set<string>();
    const clusters: Set<string>[] = [];

    // Build adjacency list (excluding bridge edges)
    nodes.forEach(node => adjacencyList.set(node.id, new Set()));
    edges.forEach(edge => {
      if (!edge.isBridge) {
        adjacencyList.get(edge.source)?.add(edge.target);
        adjacencyList.get(edge.target)?.add(edge.source);
      }
    });

    // DFS to find connected components
    const dfs = (nodeId: string, cluster: Set<string>) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      cluster.add(nodeId);

      const neighbors = adjacencyList.get(nodeId);
      if (neighbors) {
        neighbors.forEach(neighbor => dfs(neighbor, cluster));
      }
    };

    // Find all clusters
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const cluster = new Set<string>();
        dfs(node.id, cluster);
        if (cluster.size > 0) {
          clusters.push(cluster);
        }
      }
    });

    return clusters;
  }

  /**
   * Calculate distance between two clusters
   */
  private calculateClusterDistance(
    cluster1: Set<string>,
    cluster2: Set<string>,
    nodes: Array<{ id: string; x?: number; y?: number }>
  ): number {
    let minDistance = Infinity;

    cluster1.forEach(id1 => {
      const node1 = nodes.find(n => n.id === id1);
      if (node1?.x !== undefined && node1?.y !== undefined) {
        cluster2.forEach(id2 => {
          const node2 = nodes.find(n => n.id === id2);
          if (node2?.x !== undefined && node2?.y !== undefined) {
            const dx = node2.x - node1.x;
            const dy = node2.y - node1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            minDistance = Math.min(minDistance, distance);
          }
        });
      }
    });

    return minDistance === Infinity ? 0 : minDistance;
  }

  /**
   * Find which cluster a node belongs to
   */
  private findNodeCluster(nodeId: string, clusters: Set<string>[]): number {
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].has(nodeId)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get comprehensive metrics report
   */
  getMetrics(): BridgeDetectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Calculate accuracy metrics
   */
  getAccuracyMetrics() {
    const total = this.metrics.truePositives + this.metrics.falsePositives +
                  this.metrics.falseNegatives + this.metrics.trueNegatives;

    if (total === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0
      };
    }

    const accuracy = (this.metrics.truePositives + this.metrics.trueNegatives) / total;

    const precision = this.metrics.truePositives > 0
      ? this.metrics.truePositives / (this.metrics.truePositives + this.metrics.falsePositives)
      : 0;

    const recall = this.metrics.truePositives > 0
      ? this.metrics.truePositives / (this.metrics.truePositives + this.metrics.falseNegatives)
      : 0;

    const f1Score = precision + recall > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const accuracy = this.getAccuracyMetrics();

    return `
Bridge Detection Performance Report
===================================

Detection Accuracy:
------------------
True Positives:  ${this.metrics.truePositives}
False Positives: ${this.metrics.falsePositives}
False Negatives: ${this.metrics.falseNegatives}
True Negatives:  ${this.metrics.trueNegatives}

Accuracy:  ${(accuracy.accuracy * 100).toFixed(2)}%
Precision: ${(accuracy.precision * 100).toFixed(2)}%
Recall:    ${(accuracy.recall * 100).toFixed(2)}%
F1 Score:  ${(accuracy.f1Score * 100).toFixed(2)}%

Performance Metrics:
-------------------
Detection Time:     ${this.metrics.detectionTimeMs.toFixed(2)}ms
Edges Processed:    ${this.metrics.edgesProcessed}
Nodes Analyzed:     ${this.metrics.nodesAnalyzed}
Edges/Second:       ${(this.metrics.edgesProcessed / (this.metrics.detectionTimeMs / 1000)).toFixed(0)}

Cluster Analysis:
----------------
Clusters Found:     ${this.metrics.clustersIdentified}
Bridges Detected:   ${this.metrics.bridgesDetected}
Avg Cluster Size:   ${this.metrics.averageClusterSize.toFixed(1)} nodes
Bridge/Edge Ratio:  ${(this.metrics.bridgeToEdgeRatio * 100).toFixed(2)}%

Quality Metrics:
---------------
Cluster Cohesion:   ${(this.metrics.clusterCohesion * 100).toFixed(2)}%
Cluster Separation: ${this.metrics.clusterSeparation.toFixed(1)}px
Bridge Effectiveness: ${(this.metrics.bridgeEffectiveness * 100).toFixed(2)}%
`;
  }
}

/**
 * Run performance benchmarks on test scenarios
 */
export function runBridgeBenchmarks(
  testScenarios: Array<{
    name: string;
    nodes: any[];
    edges: any[];
    expectedBridges: Set<string>;
  }>
): string {
  const results: string[] = [];

  testScenarios.forEach(scenario => {
    const analyzer = new BridgeDetectionAnalyzer();

    analyzer.startDetection();

    // Simulate bridge detection (would be replaced with actual detection logic)
    const detectedBridges = new Set<string>();
    scenario.edges.forEach((edge: any) => {
      if (edge.type === 'bridge' || edge.isBridgeLink) {
        detectedBridges.add(edge.id || `${edge.source}-${edge.target}`);
      }
    });

    analyzer.endDetection();

    // Analyze results
    analyzer.analyzeDetectionAccuracy(
      detectedBridges,
      scenario.expectedBridges,
      scenario.edges
    );

    analyzer.analyzeClusterStructure(scenario.nodes, scenario.edges);

    // Add scenario report
    results.push(`\n=== ${scenario.name} ===\n${analyzer.generateReport()}`);
  });

  return results.join('\n');
}