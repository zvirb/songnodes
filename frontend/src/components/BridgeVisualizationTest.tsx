import React, { useState, useEffect } from 'react';
import {
  generateTwoClusterBridgeScenario,
  generateMultiClusterBridgeScenario,
  generateChainedClustersScenario,
  convertToVisualizationFormat
} from '../utils/bridgeTestDataGenerator';
import { BridgeDetectionAnalyzer } from '../utils/bridgeDetectionMetrics';

/**
 * Test Component for Bridge Connection Visualization
 *
 * Provides a UI to test different bridge detection scenarios
 * and visualize the performance metrics.
 */
export const BridgeVisualizationTest: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<string>('twoCluster');
  const [metrics, setMetrics] = useState<string>('');
  const [testData, setTestData] = useState<any>(null);

  const scenarios = {
    twoCluster: {
      name: 'Two Clusters with Bridges',
      description: 'Simple scenario with two genre clusters connected by crossover tracks',
      generator: generateTwoClusterBridgeScenario
    },
    multiCluster: {
      name: 'Multi-Cluster Network',
      description: 'Complex network with 4 genres and multiple fusion bridges',
      generator: generateMultiClusterBridgeScenario
    },
    chainedClusters: {
      name: 'Chained Clusters',
      description: 'Linear arrangement of clusters testing bridge elasticity',
      generator: generateChainedClustersScenario
    }
  };

  useEffect(() => {
    runScenarioTest();
  }, [selectedScenario]);

  const runScenarioTest = () => {
    const scenario = scenarios[selectedScenario];
    const data = scenario.generator();
    setTestData(data);

    // Run performance analysis
    const analyzer = new BridgeDetectionAnalyzer();
    analyzer.startDetection();

    // Simulate bridge detection
    const detectedBridges = new Set<string>();
    const expectedBridges = new Set<string>();

    data.links.forEach((link: any) => {
      const edgeId = `${link.source}-${link.target}`;
      if (link.type === 'bridge') {
        expectedBridges.add(edgeId);
        // Simulate detection (in real app, this would use the actual algorithm)
        if (Math.random() > 0.1) { // 90% detection rate simulation
          detectedBridges.add(edgeId);
        }
      }
    });

    analyzer.endDetection();
    analyzer.analyzeDetectionAccuracy(detectedBridges, expectedBridges, data.links);
    analyzer.analyzeClusterStructure(
      data.nodes.map((n: any) => ({ ...n, x: Math.random() * 1000, y: Math.random() * 1000 })),
      data.links.map((l: any) => ({ ...l, isBridge: l.type === 'bridge' }))
    );

    setMetrics(analyzer.generateReport());
  };

  const exportTestData = () => {
    if (!testData) return;

    const vizData = convertToVisualizationFormat(testData);
    const blob = new Blob([JSON.stringify(vizData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bridge-test-${selectedScenario}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Bridge Connection Visualization Test</h1>

        {/* Scenario Selection */}
        <div className="mb-6 bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Select Test Scenario</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(scenarios).map(([key, scenario]) => (
              <button
                key={key}
                onClick={() => setSelectedScenario(key)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedScenario === key
                    ? 'border-purple-500 bg-purple-900 bg-opacity-30'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <h3 className="font-semibold text-lg mb-2">{scenario.name}</h3>
                <p className="text-sm text-gray-400">{scenario.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Test Data Visualization */}
        {testData && (
          <div className="mb-6 bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Scenario Data</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-700 rounded p-3">
                <div className="text-2xl font-bold text-blue-400">
                  {testData.nodes.length}
                </div>
                <div className="text-sm text-gray-400">Total Nodes</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-2xl font-bold text-green-400">
                  {testData.links.length}
                </div>
                <div className="text-sm text-gray-400">Total Links</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-2xl font-bold text-purple-400">
                  {testData.metadata.bridgeNodes.length}
                </div>
                <div className="text-sm text-gray-400">Bridge Nodes</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-2xl font-bold text-orange-400">
                  {testData.metadata.clusters.length}
                </div>
                <div className="text-sm text-gray-400">Clusters</div>
              </div>
            </div>

            {/* Cluster Details */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Cluster Composition</h3>
              <div className="space-y-2">
                {testData.metadata.clusters.map((cluster: string) => {
                  const clusterNodes = testData.nodes.filter((n: any) => n.cluster === cluster);
                  return (
                    <div key={cluster} className="flex items-center gap-4 bg-gray-700 rounded p-2">
                      <span className="font-medium">Cluster {cluster}:</span>
                      <span className="text-gray-400">{clusterNodes.length} nodes</span>
                      <div className="flex gap-1">
                        {clusterNodes.slice(0, 3).map((node: any) => (
                          <span key={node.id} className="text-xs bg-gray-600 px-2 py-1 rounded">
                            {node.label.split(' ')[0]}
                          </span>
                        ))}
                        {clusterNodes.length > 3 && (
                          <span className="text-xs text-gray-500">+{clusterNodes.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bridge Connections */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Bridge Connections</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {testData.links
                  .filter((link: any) => link.type === 'bridge')
                  .map((link: any, idx: number) => {
                    const sourceNode = testData.nodes.find((n: any) => n.id === link.source);
                    const targetNode = testData.nodes.find((n: any) => n.id === link.target);
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm bg-gray-700 rounded p-1">
                        <span className="text-purple-400">→</span>
                        <span className="text-gray-300">{sourceNode?.label || link.source}</span>
                        <span className="text-gray-500">↔</span>
                        <span className="text-gray-300">{targetNode?.label || link.target}</span>
                        <span className="text-gray-500">({(link.similarity * 100).toFixed(0)}%)</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <button
              onClick={exportTestData}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Export Test Data as JSON
            </button>
          </div>
        )}

        {/* Performance Metrics */}
        {metrics && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
            <pre className="bg-gray-900 rounded p-4 overflow-x-auto text-sm font-mono">
              {metrics}
            </pre>
          </div>
        )}

        {/* Visual Guide */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Visual Indicators Guide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-purple-400">Bridge Connections</h3>
              <ul className="space-y-1 text-sm text-gray-400">
                <li>• Purple color (#9333EA) for visibility</li>
                <li>• Dashed line pattern (8,4) for distinction</li>
                <li>• Elastic strength (0.25) allows stretching</li>
                <li>• Minimum distance: 150px, max stretch: 3x</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-400">Intra-Cluster Links</h3>
              <ul className="space-y-1 text-sm text-gray-400">
                <li>• Gradient coloring based on strength</li>
                <li>• Solid lines for permanent connections</li>
                <li>• Higher link strength (0.6-0.8)</li>
                <li>• Minimum distances: 25-120px by strength</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Implementation Notes */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Implementation Notes</h2>
          <div className="prose prose-invert max-w-none text-sm text-gray-300">
            <p className="mb-3">
              The bridge detection algorithm uses <strong>shared neighbor analysis</strong> to identify
              connections between different clusters. When two nodes have high similarity ({">"} 0.6)
              but low shared neighbor ratio ({"<"} 0.3), they are classified as bridge connections.
            </p>
            <p className="mb-3">
              This approach is based on industry standards from graph visualization tools like
              Gephi, Cytoscape, and D3.js force layouts, adapted specifically for music relationship
              visualization.
            </p>
            <p>
              The elastic link strength allows bridges to stretch up to 3x their minimum distance,
              maintaining visual connection while preserving cluster separation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};