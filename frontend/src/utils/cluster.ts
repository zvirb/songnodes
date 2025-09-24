export const clusterNodes = (nodes, zoom) => {
  if (zoom > 0.5) {
    return nodes.map(node => ({ ...node, isCluster: false }));
  }

  const gridSize = 100;
  const clusters = {};

  nodes.forEach(node => {
    const gridX = Math.floor(node.x / gridSize);
    const gridY = Math.floor(node.y / gridSize);
    const key = `${gridX}-${gridY}`;

    if (!clusters[key]) {
      clusters[key] = {
        nodes: [],
        x: 0,
        y: 0,
      };
    }
    clusters[key].nodes.push(node);
  });

  const clusteredNodes = [];
  for (const key in clusters) {
    const cluster = clusters[key];
    if (cluster.nodes.length > 1) {
      const { x, y } = cluster.nodes.reduce((acc, node) => {
        acc.x += node.x;
        acc.y += node.y;
        return acc;
      }, { x: 0, y: 0 });

      clusteredNodes.push({
        id: `cluster-${key}`,
        isCluster: true,
        x: x / cluster.nodes.length,
        y: y / cluster.nodes.length,
        size: cluster.nodes.length,
      });
    } else {
      clusteredNodes.push(...cluster.nodes.map(node => ({ ...node, isCluster: false })));
    }
  }

  return clusteredNodes;
};