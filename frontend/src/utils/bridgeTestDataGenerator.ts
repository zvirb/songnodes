/**
 * Test Data Generator for Bridge Connection Visualization
 *
 * Creates synthetic graph data with known cluster structures and bridge connections
 * to verify the bridge detection and visualization system.
 */

export interface TestNode {
  id: string;
  label: string;
  cluster: string;
  type: 'cluster_core' | 'cluster_member' | 'bridge' | 'isolated';
}

export interface TestLink {
  source: string;
  target: string;
  similarity: number;
  type: 'intra_cluster' | 'bridge' | 'weak';
}

export interface TestGraphData {
  nodes: TestNode[];
  links: TestLink[];
  metadata: {
    clusters: string[];
    bridgeNodes: string[];
    description: string;
  };
}

/**
 * Generates a graph with two distinct clusters connected by bridge nodes
 */
export function generateTwoClusterBridgeScenario(): TestGraphData {
  const nodes: TestNode[] = [];
  const links: TestLink[] = [];

  // Cluster A: Electronic/House music
  const clusterA = {
    core: 'track_a_core',
    members: ['track_a1', 'track_a2', 'track_a3', 'track_a4', 'track_a5']
  };

  // Cluster B: Hip-Hop/Rap
  const clusterB = {
    core: 'track_b_core',
    members: ['track_b1', 'track_b2', 'track_b3', 'track_b4', 'track_b5']
  };

  // Bridge nodes that connect the clusters
  const bridges = ['track_bridge1', 'track_bridge2'];

  // Create Cluster A nodes
  nodes.push({
    id: clusterA.core,
    label: 'House Anthem (Core)',
    cluster: 'A',
    type: 'cluster_core'
  });

  clusterA.members.forEach((id, index) => {
    nodes.push({
      id,
      label: `House Track ${index + 1}`,
      cluster: 'A',
      type: 'cluster_member'
    });
  });

  // Create Cluster B nodes
  nodes.push({
    id: clusterB.core,
    label: 'Hip-Hop Classic (Core)',
    cluster: 'B',
    type: 'cluster_core'
  });

  clusterB.members.forEach((id, index) => {
    nodes.push({
      id,
      label: `Hip-Hop Track ${index + 1}`,
      cluster: 'B',
      type: 'cluster_member'
    });
  });

  // Create bridge nodes
  nodes.push({
    id: bridges[0],
    label: 'Crossover Hit 1 (Bridge)',
    cluster: 'Bridge',
    type: 'bridge'
  });

  nodes.push({
    id: bridges[1],
    label: 'Genre Fusion (Bridge)',
    cluster: 'Bridge',
    type: 'bridge'
  });

  // Create strong intra-cluster links for Cluster A
  // Core to all members
  clusterA.members.forEach(member => {
    links.push({
      source: clusterA.core,
      target: member,
      similarity: 0.85 + Math.random() * 0.1, // 0.85-0.95
      type: 'intra_cluster'
    });
  });

  // Some member-to-member links in Cluster A
  links.push(
    { source: clusterA.members[0], target: clusterA.members[1], similarity: 0.75, type: 'intra_cluster' },
    { source: clusterA.members[1], target: clusterA.members[2], similarity: 0.70, type: 'intra_cluster' },
    { source: clusterA.members[2], target: clusterA.members[3], similarity: 0.72, type: 'intra_cluster' }
  );

  // Create strong intra-cluster links for Cluster B
  // Core to all members
  clusterB.members.forEach(member => {
    links.push({
      source: clusterB.core,
      target: member,
      similarity: 0.82 + Math.random() * 0.1, // 0.82-0.92
      type: 'intra_cluster'
    });
  });

  // Some member-to-member links in Cluster B
  links.push(
    { source: clusterB.members[0], target: clusterB.members[1], similarity: 0.73, type: 'intra_cluster' },
    { source: clusterB.members[2], target: clusterB.members[3], similarity: 0.71, type: 'intra_cluster' },
    { source: clusterB.members[3], target: clusterB.members[4], similarity: 0.74, type: 'intra_cluster' }
  );

  // Create bridge connections
  // Bridge 1 strongly connects to both clusters
  links.push(
    { source: bridges[0], target: clusterA.core, similarity: 0.78, type: 'bridge' },
    { source: bridges[0], target: clusterB.core, similarity: 0.76, type: 'bridge' },
    { source: bridges[0], target: clusterA.members[0], similarity: 0.65, type: 'bridge' },
    { source: bridges[0], target: clusterB.members[1], similarity: 0.63, type: 'bridge' }
  );

  // Bridge 2 also connects both clusters
  links.push(
    { source: bridges[1], target: clusterA.members[2], similarity: 0.72, type: 'bridge' },
    { source: bridges[1], target: clusterB.members[3], similarity: 0.70, type: 'bridge' },
    { source: bridges[1], target: bridges[0], similarity: 0.68, type: 'bridge' } // Bridges connected to each other
  );

  return {
    nodes,
    links,
    metadata: {
      clusters: ['A', 'B'],
      bridgeNodes: bridges,
      description: 'Two distinct music genre clusters (House and Hip-Hop) connected by crossover/fusion tracks'
    }
  };
}

/**
 * Generates a graph with multiple clusters and complex bridge patterns
 */
export function generateMultiClusterBridgeScenario(): TestGraphData {
  const nodes: TestNode[] = [];
  const links: TestLink[] = [];

  // Define 4 clusters
  const clusters = {
    jazz: {
      core: 'jazz_core',
      members: ['jazz1', 'jazz2', 'jazz3']
    },
    rock: {
      core: 'rock_core',
      members: ['rock1', 'rock2', 'rock3']
    },
    electronic: {
      core: 'electronic_core',
      members: ['electronic1', 'electronic2', 'electronic3']
    },
    classical: {
      core: 'classical_core',
      members: ['classical1', 'classical2', 'classical3']
    }
  };

  // Bridge nodes connecting different pairs of clusters
  const bridges = {
    jazzRock: 'fusion_jazz_rock',
    electronicRock: 'electro_rock',
    jazzClassical: 'contemporary_classical',
    electronicAll: 'experimental_fusion' // Connects to multiple clusters
  };

  // Create all cluster nodes
  Object.entries(clusters).forEach(([genre, cluster]) => {
    nodes.push({
      id: cluster.core,
      label: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Core`,
      cluster: genre,
      type: 'cluster_core'
    });

    cluster.members.forEach((id, index) => {
      nodes.push({
        id,
        label: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Track ${index + 1}`,
        cluster: genre,
        type: 'cluster_member'
      });
    });
  });

  // Create bridge nodes
  Object.entries(bridges).forEach(([key, id]) => {
    nodes.push({
      id,
      label: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      cluster: 'Bridge',
      type: 'bridge'
    });
  });

  // Create intra-cluster links (strong connections within each cluster)
  Object.entries(clusters).forEach(([genre, cluster]) => {
    // Core to members
    cluster.members.forEach(member => {
      links.push({
        source: cluster.core,
        target: member,
        similarity: 0.8 + Math.random() * 0.15, // 0.8-0.95
        type: 'intra_cluster'
      });
    });

    // Some member-to-member connections
    if (cluster.members.length > 1) {
      links.push({
        source: cluster.members[0],
        target: cluster.members[1],
        similarity: 0.7 + Math.random() * 0.1,
        type: 'intra_cluster'
      });
    }
  });

  // Create bridge connections
  // Jazz-Rock fusion bridge
  links.push(
    { source: bridges.jazzRock, target: clusters.jazz.core, similarity: 0.75, type: 'bridge' },
    { source: bridges.jazzRock, target: clusters.rock.core, similarity: 0.73, type: 'bridge' },
    { source: bridges.jazzRock, target: clusters.jazz.members[0], similarity: 0.65, type: 'bridge' }
  );

  // Electronic-Rock bridge
  links.push(
    { source: bridges.electronicRock, target: clusters.electronic.core, similarity: 0.72, type: 'bridge' },
    { source: bridges.electronicRock, target: clusters.rock.members[1], similarity: 0.70, type: 'bridge' }
  );

  // Jazz-Classical bridge
  links.push(
    { source: bridges.jazzClassical, target: clusters.jazz.members[2], similarity: 0.68, type: 'bridge' },
    { source: bridges.jazzClassical, target: clusters.classical.core, similarity: 0.71, type: 'bridge' }
  );

  // Experimental fusion connects to multiple clusters
  links.push(
    { source: bridges.electronicAll, target: clusters.electronic.members[0], similarity: 0.66, type: 'bridge' },
    { source: bridges.electronicAll, target: clusters.jazz.members[1], similarity: 0.64, type: 'bridge' },
    { source: bridges.electronicAll, target: clusters.classical.members[1], similarity: 0.62, type: 'bridge' },
    { source: bridges.electronicAll, target: bridges.jazzRock, similarity: 0.60, type: 'bridge' } // Bridge to bridge
  );

  return {
    nodes,
    links,
    metadata: {
      clusters: ['jazz', 'rock', 'electronic', 'classical'],
      bridgeNodes: Object.values(bridges),
      description: 'Four music genre clusters with multiple fusion/crossover bridges creating a complex network'
    }
  };
}

/**
 * Generates a chain of clusters connected by bridges
 */
export function generateChainedClustersScenario(): TestGraphData {
  const nodes: TestNode[] = [];
  const links: TestLink[] = [];

  // Create a chain: Cluster A <-> Bridge1 <-> Cluster B <-> Bridge2 <-> Cluster C
  const chainClusters = [
    { id: 'cluster_a', members: ['a1', 'a2', 'a3', 'a4'] },
    { id: 'cluster_b', members: ['b1', 'b2', 'b3', 'b4'] },
    { id: 'cluster_c', members: ['c1', 'c2', 'c3', 'c4'] }
  ];

  const chainBridges = ['bridge_ab', 'bridge_bc'];

  // Create cluster nodes
  chainClusters.forEach((cluster, clusterIndex) => {
    const clusterLabel = String.fromCharCode(65 + clusterIndex); // A, B, C

    nodes.push({
      id: cluster.id,
      label: `Cluster ${clusterLabel} Core`,
      cluster: clusterLabel,
      type: 'cluster_core'
    });

    cluster.members.forEach((member, memberIndex) => {
      nodes.push({
        id: member,
        label: `${clusterLabel} Track ${memberIndex + 1}`,
        cluster: clusterLabel,
        type: 'cluster_member'
      });
    });
  });

  // Create bridge nodes
  chainBridges.forEach((bridge, index) => {
    nodes.push({
      id: bridge,
      label: `Bridge ${index + 1}`,
      cluster: 'Bridge',
      type: 'bridge'
    });
  });

  // Create strong intra-cluster connections
  chainClusters.forEach(cluster => {
    // Star pattern: core connected to all members
    cluster.members.forEach(member => {
      links.push({
        source: cluster.id,
        target: member,
        similarity: 0.85 + Math.random() * 0.1,
        type: 'intra_cluster'
      });
    });

    // Ring pattern: members connected in sequence
    for (let i = 0; i < cluster.members.length; i++) {
      const next = (i + 1) % cluster.members.length;
      links.push({
        source: cluster.members[i],
        target: cluster.members[next],
        similarity: 0.7 + Math.random() * 0.1,
        type: 'intra_cluster'
      });
    }
  });

  // Connect clusters through bridges
  // Cluster A <-> Bridge AB
  links.push(
    { source: chainBridges[0], target: chainClusters[0].id, similarity: 0.75, type: 'bridge' },
    { source: chainBridges[0], target: chainClusters[0].members[0], similarity: 0.65, type: 'bridge' }
  );

  // Bridge AB <-> Cluster B
  links.push(
    { source: chainBridges[0], target: chainClusters[1].id, similarity: 0.73, type: 'bridge' },
    { source: chainBridges[0], target: chainClusters[1].members[2], similarity: 0.63, type: 'bridge' }
  );

  // Cluster B <-> Bridge BC
  links.push(
    { source: chainBridges[1], target: chainClusters[1].members[1], similarity: 0.71, type: 'bridge' },
    { source: chainBridges[1], target: chainClusters[1].members[3], similarity: 0.67, type: 'bridge' }
  );

  // Bridge BC <-> Cluster C
  links.push(
    { source: chainBridges[1], target: chainClusters[2].id, similarity: 0.74, type: 'bridge' },
    { source: chainBridges[1], target: chainClusters[2].members[0], similarity: 0.64, type: 'bridge' }
  );

  return {
    nodes,
    links,
    metadata: {
      clusters: ['A', 'B', 'C'],
      bridgeNodes: chainBridges,
      description: 'Three clusters arranged in a chain, connected by bridge nodes'
    }
  };
}

/**
 * Converts test data to the format expected by the visualization
 */
export function convertToVisualizationFormat(testData: TestGraphData) {
  return {
    nodes: testData.nodes.map(node => ({
      id: node.id,
      label: node.label,
      cluster: node.cluster,
      isBridge: node.type === 'bridge',
      // Add visual properties for debugging
      color: node.type === 'bridge' ? '#ff6b6b' :
             node.type === 'cluster_core' ? '#4ecdc4' :
             '#95a5a6'
    })),
    links: testData.links.map(link => ({
      source: link.source,
      target: link.target,
      similarity: link.similarity,
      isBridgeLink: link.type === 'bridge'
    }))
  };
}

/**
 * Generates all test scenarios for comprehensive testing
 */
export function generateAllTestScenarios() {
  return {
    twoClusterBridge: generateTwoClusterBridgeScenario(),
    multiClusterBridge: generateMultiClusterBridgeScenario(),
    chainedClusters: generateChainedClustersScenario()
  };
}