import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useAppSelector } from '../../store/index';
import {
  forceSimulation as forceSimulation3d,
  forceLink as forceLink3d,
  forceManyBody as forceManyBody3d,
  forceCenter as forceCenter3d,
  forceCollide as forceCollide3d,
  ForceSimulation3D,
  ForceLink3D
} from 'd3-force-3d';
import { cullEdges, getEdgeStyle, type Edge as CullingEdge, type Node as CullingNode, type ViewportBounds } from '../../utils/edgeCulling';

interface ThreeD3CanvasProps {
  width: number;
  height: number;
  className?: string;
  distancePower?: number;
  relationshipPower?: number;
  nodeSize?: number;
  edgeLabelSize?: number;
  onNodeClick?: (node: any) => void;
  onEdgeClick?: (edge: any) => void;
}

type LayoutMode = 'sphere' | 'force';

interface SimulationNode {
  id: string;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
}

/**
 * Enhanced 3D graph visualization with multiple layout modes (NO PLANE VERSION)
 * - Sphere Layout: Organized spherical distribution
 * - Force Layout: Physics-based positioning based on connection strength
 * - NO GridHelper plane visualization
 */
export const ThreeD3Canvas: React.FC<ThreeD3CanvasProps> = ({
  width,
  height,
  className,
  distancePower = 1,
  relationshipPower = 0,
  nodeSize = 12,
  edgeLabelSize = 12,
  onNodeClick,
  onEdgeClick
}) => {
  console.log('🚀 ThreeD3CanvasEnhanced loaded - NO GRID PLANE VERSION');
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const controlsRef = useRef<OrbitControls>();
  const animationIdRef = useRef<number>();
  const raycastRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const nodeObjectsRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const edgeObjectsRef = useRef<Map<string, THREE.Line>>(new Map());
  const edgeLabelObjectsRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const simulationRef = useRef<any>();

  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [pathMode, setPathMode] = useState(false);
  const [startNode, setStartNode] = useState<string | null>(null);
  const [endNode, setEndNode] = useState<string | null>(null);
  const [shortestPath, setShortestPath] = useState<string[]>([]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force');
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [nodeMenu, setNodeMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [initialPositions, setInitialPositions] = useState<Map<string, THREE.Vector3>>(new Map());
  const [forceSimulationCompleted, setForceSimulationCompleted] = useState(false);

  // Get graph data from Redux
  const { nodes, edges } = useAppSelector(state => state.graph);

  // Calculate connection strength between nodes
  const connectionStrengths = useMemo(() => {
    const strengths = new Map<string, Map<string, number>>();

    edges.forEach(edge => {
      // Get weight from metadata or default to 1
      const weight = edge.metadata?.adjacency_frequency || edge.weight || 1;

      if (!strengths.has(edge.source)) strengths.set(edge.source, new Map());
      if (!strengths.has(edge.target)) strengths.set(edge.target, new Map());

      strengths.get(edge.source)!.set(edge.target, weight);
      strengths.get(edge.target)!.set(edge.source, weight);
    });

    return strengths;
  }, [edges]);

  // Color scheme
  const getNodeColor = useCallback((node: any) => {
    if (shortestPath.includes(node.id)) return '#FFD700';
    if (selectedNodes.has(node.id)) return '#FF6B6B';

    switch (node.type) {
      case 'artist': return '#3B82F6';
      case 'venue': return '#10B981';
      case 'location': return '#F59E0B';
      case 'track': return '#8B5CF6';
      case 'album': return '#EC4899';
      default: return '#6B7280';
    }
  }, [selectedNodes, shortestPath]);

  // Check if only one node is visible in current viewport (for edge labeling)
  const getVisibleNodesCount = useCallback(() => {
    if (!cameraRef.current || !nodeObjectsRef.current.size) return 0;

    const camera = cameraRef.current;
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4();
    cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraMatrix);

    let visibleCount = 0;
    nodeObjectsRef.current.forEach((nodeObject) => {
      if (frustum.containsPoint(nodeObject.position)) {
        visibleCount++;
      }
    });

    return visibleCount;
  }, []);

  // Update edge labels based on viewport visibility
  // Helper function to check if a node is visible in the camera frustum
  const isNodeVisibleInCamera = useCallback((nodeObject: THREE.Object3D): boolean => {
    if (!cameraRef.current) return false;

    const camera = cameraRef.current;
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4();
    cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraMatrix);

    return frustum.containsPoint(nodeObject.position);
  }, []);

  const updateEdgeLabels = useCallback(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    // Remove existing edge labels
    edgeLabelObjectsRef.current.forEach((sprite) => {
      scene.remove(sprite);
      if (sprite.material?.map) {
        sprite.material.map.dispose();
      }
      if (sprite.material) {
        sprite.material.dispose();
      }
    });
    edgeLabelObjectsRef.current.clear();

    // Show edge labels only when exactly one node is selected
    if (selectedNodes.size === 1) {
      const selectedNodeId = Array.from(selectedNodes)[0];
      console.log(`🏷️ Showing edge labels for selected node: ${selectedNodeId}`);

      // Only show labels for edges connected to the selected node
      edges.forEach(edge => {
        // Check if this edge is connected to the selected node
        if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
          const sourceNode = nodeObjectsRef.current.get(edge.source);
          const targetNode = nodeObjectsRef.current.get(edge.target);

          if (sourceNode && targetNode) {
            // Get the OTHER node (not the selected one) for the label
            const labelNodeId = edge.source === selectedNodeId ? edge.target : edge.source;
            const labelNodeData = nodes.find(n => n.id === labelNodeId);

            if (labelNodeData) {
              // Create edge label
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              if (context) {
                canvas.width = 256;
                canvas.height = 48;

                // Prepare label text using metadata structure
                const artist = labelNodeData.metadata?.artist || labelNodeData.label?.split(' - ')[0] || '';
                const title = labelNodeData.metadata?.title || labelNodeData.label?.split(' - ')[1] || labelNodeData.label || labelNodeData.id;
                const displayText = artist ? `${artist} - ${title}` : title;

                // Draw background
                context.fillStyle = 'rgba(0, 0, 0, 0.8)';
                context.roundRect(5, 5, 246, 38, 4);
                context.fill();

                // Draw text
                context.fillStyle = 'rgba(255, 255, 255, 0.95)';
                context.font = `${edgeLabelSize}px Arial`;
                context.textAlign = 'center';

                // Truncate if too long
                const maxLength = 30;
                const truncatedText = displayText.length > maxLength
                  ? displayText.substring(0, maxLength - 3) + '...'
                  : displayText;

                context.fillText(truncatedText, 128, 28);

                const texture = new THREE.CanvasTexture(canvas);
                const spriteMaterial = new THREE.SpriteMaterial({
                  map: texture,
                  transparent: true,
                  opacity: 0.9
                });
                const sprite = new THREE.Sprite(spriteMaterial);

                // Position label at midpoint of edge
                const midpoint = new THREE.Vector3().addVectors(sourceNode.position, targetNode.position).multiplyScalar(0.5);
                sprite.position.copy(midpoint);
                sprite.scale.set(8, 2, 1);
                sprite.userData = {
                  isEdgeLabel: true,
                  edgeId: edge.id,
                  labeledNodeId: labelNodeId
                };

                scene.add(sprite);
                edgeLabelObjectsRef.current.set(edge.id, sprite);
              }
            }
          }
        }
      });
    }
  }, [nodes, edges, selectedNodes, edgeLabelSize]);

  // Initialize Three.js scene
  const initThreeJS = useCallback(() => {
    if (!mountRef.current || isInitialized || width === 0 || height === 0) {
      return false;
    }

    try {
      console.log('🎨 Initializing enhanced 3D scene with dual layouts...');

      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0F172A);
      scene.fog = new THREE.Fog(0x0F172A, 100, 400);
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(60, 40, 60);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Create renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      mountRef.current.appendChild(renderer.domElement);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
      scene.add(ambientLight);

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight1.position.set(50, 50, 25);
      directionalLight1.castShadow = true;
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0x4A90E2, 0.4);
      directionalLight2.position.set(-30, -30, -15);
      scene.add(directionalLight2);

      // OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = true;
      controls.minDistance = 20;
      controls.maxDistance = 300;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.zoomSpeed = 1.2;
      controlsRef.current = controls;

      console.log('✅ Enhanced 3D scene initialized');
      setIsInitialized(true);
      return true;
    } catch (err) {
      console.error('❌ Three.js initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [width, height, isInitialized]);

  // Calculate force-directed positions - only once on initial load
  const calculateForcePositions = useCallback((forceDistancePower: number = distancePower, forceRelationshipPower: number = relationshipPower, nodesToUse: any[] = nodes) => {
    console.log('🌀 Calculating force-directed layout...');

    // Use existing positions if available, otherwise random
    const simNodes: SimulationNode[] = nodesToUse.map(node => {
      const existingPos = initialPositions.get(node.id);
      return {
        id: node.id,
        x: existingPos?.x || (Math.random() - 0.5) * 100,
        y: existingPos?.y || (Math.random() - 0.5) * 100,
        z: existingPos?.z || (Math.random() - 0.5) * 100
      };
    });

    const simLinks = edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      // Inverse weight: stronger connections = shorter distance
      distance: 30 / Math.max(1, edge.metadata?.adjacency_frequency || edge.weight || 1)
    }));

    // Create force simulation with provided power values
    const simulation = forceSimulation3d(simNodes)
      .force('link', forceLink3d(simLinks)
        .id((d: any) => d.id)
        .distance((d: any) => d.distance * Math.pow(10, forceDistancePower / 5))
        .strength(1.5 * Math.pow(10, forceRelationshipPower / 5)))
      .force('charge', forceManyBody3d()
        .strength(-300 * Math.pow(10, forceDistancePower / 5))
        .distanceMin(5)
        .distanceMax(200 * Math.pow(10, forceDistancePower / 5)))
      .force('center', forceCenter3d(0, 0, 0))
      .force('collision', forceCollide3d(10 * (nodeSize / 12)))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = simulation;
    setSimulationRunning(true);

    // Run simulation
    simulation.on('tick', () => {
      // Update node positions in real-time
      simNodes.forEach(simNode => {
        const mesh = nodeObjectsRef.current.get(simNode.id);
        if (mesh && simNode.x !== undefined && simNode.y !== undefined && simNode.z !== undefined) {
          mesh.position.set(simNode.x, simNode.y, simNode.z);
        }
      });

      // Update edge positions
      updateEdgePositions();
    });

    simulation.on('end', () => {
      console.log('✅ Force simulation complete');
      setSimulationRunning(false);
      setForceSimulationCompleted(true);

      // Store final positions
      const finalPositions = new Map<string, THREE.Vector3>();
      simNodes.forEach(simNode => {
        if (simNode.x !== undefined && simNode.y !== undefined && simNode.z !== undefined) {
          finalPositions.set(simNode.id, new THREE.Vector3(simNode.x, simNode.y, simNode.z));
        }
      });
      setInitialPositions(finalPositions);
    });

    return simNodes;
  }, [nodes, edges, nodeSize, initialPositions]);

  // Calculate sphere positions
  const calculateSpherePositions = useCallback((nodesToUse: any[] = nodes) => {
    const positions = new Map<string, THREE.Vector3>();

    nodesToUse.forEach((node, index) => {
      const phi = Math.acos(-1 + (2 * index) / nodesToUse.length);
      const theta = Math.sqrt(nodesToUse.length * Math.PI) * phi;
      const radius = 40 + (node.ring || 0) * 15;

      const position = new THREE.Vector3(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi)
      );

      position.x += (Math.random() - 0.5) * 8;
      position.y += (Math.random() - 0.5) * 8;
      position.z += (Math.random() - 0.5) * 8;

      positions.set(node.id, position);
    });

    return positions;
  }, [nodes]);

  // Update edge positions
  const updateEdgePositions = useCallback(() => {
    edgeObjectsRef.current.forEach((line, edgeId) => {
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) return;

      const sourceNode = nodeObjectsRef.current.get(edge.source);
      const targetNode = nodeObjectsRef.current.get(edge.target);

      if (sourceNode && targetNode) {
        const sourcePos = sourceNode.position;
        const targetPos = targetNode.position;

        // Update curve
        const midPoint = new THREE.Vector3().addVectors(sourcePos, targetPos).multiplyScalar(0.5);
        midPoint.y += 3;

        const curve = new THREE.QuadraticBezierCurve3(sourcePos, midPoint, targetPos);
        const points = curve.getPoints(50);

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        line.geometry.dispose();
        line.geometry = geometry;
      }
    });
  }, [edges]);

  // Create 3D graph
  const createGraph = useCallback(() => {
    if (!sceneRef.current || !nodes.length) return;

    const scene = sceneRef.current;

    // Clear existing
    scene.children = scene.children.filter(child => !child.userData.isGraphElement && !child.userData.isEdgeLabel);
    nodeObjectsRef.current.clear();
    edgeObjectsRef.current.clear();
    edgeLabelObjectsRef.current.clear();

    // Filter out nodes with no edges and log them
    const nodesWithEdges = new Set<string>();
    const unconnectedNodes: any[] = [];

    // Find all nodes that have at least one edge
    edges.forEach(edge => {
      nodesWithEdges.add(edge.source);
      nodesWithEdges.add(edge.target);
    });

    // Identify and log unconnected nodes
    nodes.forEach(node => {
      if (!nodesWithEdges.has(node.id)) {
        unconnectedNodes.push({
          id: node.id,
          label: node.label,
          metadata: node.metadata,
          type: node.type
        });
      }
    });

    // Log error for unconnected nodes
    if (unconnectedNodes.length > 0) {
      console.error('🔴 ERROR: Found nodes with no edges (hidden from visualization):', {
        count: unconnectedNodes.length,
        nodes: unconnectedNodes,
        message: 'These nodes have no connections in the graph. This may indicate:',
        possibleCauses: [
          '1. Missing adjacency data in the database',
          '2. Incomplete scraping of track relationships',
          '3. Isolated tracks not part of any setlist',
          '4. Data pipeline error during adjacency generation'
        ]
      });
    }

    // Filter nodes to only include connected ones
    const connectedNodes = nodes.filter(node => nodesWithEdges.has(node.id));
    console.log(`🔗 Displaying ${connectedNodes.length}/${nodes.length} connected nodes`);

    // Calculate positions based on layout mode
    let nodePositions: Map<string, THREE.Vector3>;

    if (layoutMode === 'force') {
      // Initialize force simulation with only connected nodes
      const simNodes = calculateForcePositions(distancePower, relationshipPower, connectedNodes);
      nodePositions = new Map();
      simNodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
          nodePositions.set(node.id, new THREE.Vector3(node.x, node.y, node.z));
        }
      });
    } else {
      // Use sphere layout with only connected nodes
      nodePositions = calculateSpherePositions(connectedNodes);
    }

    // Create nodes (only connected ones)
    const nodeGroup = new THREE.Group();
    nodeGroup.userData.isGraphElement = true;

    connectedNodes.forEach(node => {
      const position = nodePositions.get(node.id) || new THREE.Vector3(0, 0, 0);

      // Node size based on connections
      const nodeConnections = edges.filter(e => e.source === node.id || e.target === node.id).length;
      const connectionStrength = connectionStrengths.get(node.id);
      const totalStrength = connectionStrength
        ? Array.from(connectionStrength.values()).reduce((a, b) => a + b, 0)
        : 0;

      const nodeRadius = (nodeSize / 12) * 0.8 + Math.min(totalStrength * 0.2, 3);

      // Create sphere
      const geometry = new THREE.SphereGeometry(nodeRadius, 32, 32);
      const material = new THREE.MeshPhongMaterial({
        color: getNodeColor(node),
        emissive: getNodeColor(node),
        emissiveIntensity: 0.2,
        shininess: 150,
        specular: 0x222222
      });

      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(position);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      sphere.userData = {
        isGraphElement: true,
        nodeId: node.id,
        nodeData: node,
        originalColor: getNodeColor(node),
        connections: nodeConnections,
        connectionStrength: totalStrength
      };

      nodeObjectsRef.current.set(node.id, sphere);
      nodeGroup.add(sphere);

      // Add node title label - only show when node is selected or hovered
      const isNodeSelected = selectedNodes.has(node.id);
      const shouldShowLabel = isNodeSelected || hoveredNode === node.id;

      if (shouldShowLabel) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.width = 512;
          canvas.height = 96;

          // Extract artist and title from metadata
          const artist = node.metadata?.artist || node.artist || node.label?.split(' - ')[0] || '';
          const title = node.metadata?.title || node.title || node.label?.split(' - ')[1] || node.label || node.id;

          context.fillStyle = 'rgba(0, 0, 0, 0.85)';
          context.roundRect(10, 10, 492, 76, 8);
          context.fill();

          // Artist name
          context.fillStyle = 'rgba(150, 150, 150, 0.9)';
          context.font = '18px Arial';
          context.textAlign = 'center';
          if (artist) {
            context.fillText(artist, 256, 35);
          }

          // Track title
          context.fillStyle = 'rgba(255, 255, 255, 0.95)';
          context.font = 'bold 22px Arial';
          context.textAlign = 'center';

          const maxTitleLength = 40;
          const displayTitle = title.length > maxTitleLength
            ? title.substring(0, maxTitleLength - 3) + '...'
            : title;
          context.fillText(displayTitle, 256, artist ? 60 : 48);

          // Add connection strength indicator
          if (layoutMode === 'force') {
            context.fillStyle = 'rgba(100, 200, 255, 0.8)';
            context.font = '14px Arial';
            context.fillText(`Strength: ${totalStrength.toFixed(1)}`, 256, 80);
          }

          const texture = new THREE.CanvasTexture(canvas);
          const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: isNodeSelected ? 1.0 : 0.8
          });
          const sprite = new THREE.Sprite(spriteMaterial);
          sprite.position.copy(position);
          sprite.position.y += nodeRadius + 2;
          sprite.scale.set(12, 3, 1);
          sprite.userData.isGraphElement = true;
          sprite.userData.isNodeLabel = true;
          sprite.userData.nodeId = node.id;
          nodeGroup.add(sprite);
        }
      }
    });

    scene.add(nodeGroup);

    // Calculate viewport bounds for 3D culling
    const camera = cameraRef.current;
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4();

    if (camera) {
      matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(matrix);
    }

    // Get camera distance for zoom level calculation
    const cameraDistance = camera ? camera.position.length() : 100;
    const zoomLevel = 100 / cameraDistance; // Inverse relationship for 3D

    // Convert connected nodes to culling format with 3D positions
    const cullingNodes: CullingNode[] = connectedNodes.map(node => {
      const pos = nodePositions.get(node.id);
      return {
        id: node.id,
        x: pos?.x || 0,
        y: pos?.y || 0,
        z: pos?.z || 0,
        visible: true
      };
    });

    // Apply edge culling
    const viewportBounds: ViewportBounds = {
      left: -1000,  // Will use frustum culling instead
      right: 1000,
      top: -1000,
      bottom: 1000,
      near: -1000,
      far: 1000
    };

    const cullingResult = cullEdges({
      viewport: viewportBounds,
      zoomLevel,
      nodes: cullingNodes,
      edges: edges as CullingEdge[],
      highlightedPath: shortestPath,
      selectedNodes: Array.from(selectedNodes),
      preserveHighlighted: true,
      is3D: true
    });

    console.log(`3D Edge culling: showing ${cullingResult.visibleEdges.length}/${edges.length} edges at zoom ${zoomLevel.toFixed(2)}`);

    // Create edges
    const edgeGroup = new THREE.Group();
    edgeGroup.userData.isGraphElement = true;

    cullingResult.visibleEdges.forEach(edge => {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);

      if (sourcePos && targetPos) {
        // Curve for visibility
        const midPoint = new THREE.Vector3().addVectors(sourcePos, targetPos).multiplyScalar(0.5);
        midPoint.y += 3;

        const curve = new THREE.QuadraticBezierCurve3(sourcePos, midPoint, targetPos);
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Color and width based on connection strength
        const strength = edge.metadata?.adjacency_frequency || edge.weight || 1;
        const isInPath = shortestPath.includes(edge.source) && shortestPath.includes(edge.target);
        const isConnectedToSelected = selectedNodes.has(edge.source) || selectedNodes.has(edge.target);

        let edgeColor = new THREE.Color(0x4A90E2);
        let edgeOpacity = 0.2 + Math.min(strength * 0.1, 0.6);
        let linewidth = Math.max(1, Math.min(strength, 5));

        if (isInPath) {
          edgeColor = new THREE.Color(0xFFD700);
          edgeOpacity = 1.0;
          linewidth = 4;
        } else if (isConnectedToSelected) {
          edgeColor = new THREE.Color(0xFF6B6B);
          edgeOpacity = 0.8;
          linewidth = 3;
        } else if (layoutMode === 'force') {
          // Color gradient based on strength in force mode
          const hue = 0.6 - (strength / 10) * 0.4; // Blue to red
          edgeColor.setHSL(hue, 0.8, 0.5);
        }

        const material = new THREE.LineBasicMaterial({
          color: edgeColor,
          opacity: edgeOpacity,
          transparent: true,
          linewidth: linewidth
        });

        const line = new THREE.Line(geometry, material);
        line.userData = {
          isGraphElement: true,
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          strength: strength
        };

        edgeObjectsRef.current.set(edge.id, line);
        edgeGroup.add(line);
      }
    });

    scene.add(edgeGroup);

    // Initial edge label update
    setTimeout(() => updateEdgeLabels(), 100);

    // Update node labels when selection changes
    requestAnimationFrame(() => {
      // Force a re-render to update node labels
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    });
  }, [nodes, edges, selectedNodes, shortestPath, getNodeColor, layoutMode, calculateForcePositions, calculateSpherePositions, connectionStrengths, updateEdgeLabels, hoveredNode]);

  // Dijkstra's shortest path
  const findShortestPath = useCallback((start: string, end: string) => {
    const distances: { [key: string]: number } = {};
    const previous: { [key: string]: string | null } = {};
    const unvisited = new Set<string>();

    nodes.forEach(node => {
      distances[node.id] = node.id === start ? 0 : Infinity;
      previous[node.id] = null;
      unvisited.add(node.id);
    });

    while (unvisited.size > 0) {
      let current: string | null = null;
      let minDistance = Infinity;

      unvisited.forEach(nodeId => {
        if (distances[nodeId] < minDistance) {
          current = nodeId;
          minDistance = distances[nodeId];
        }
      });

      if (!current || minDistance === Infinity) break;
      if (current === end) break;

      unvisited.delete(current);

      edges.forEach(edge => {
        let neighbor: string | null = null;
        if (edge.source === current) neighbor = edge.target;
        else if (edge.target === current) neighbor = edge.source;

        if (neighbor && unvisited.has(neighbor)) {
          // Use inverse of connection strength as distance
          const strength = edge.metadata?.adjacency_frequency || edge.weight || 1;
          const edgeDistance = 1 / strength;
          const alt = distances[current] + edgeDistance;

          if (alt < distances[neighbor]) {
            distances[neighbor] = alt;
            previous[neighbor] = current;
          }
        }
      });
    }

    const path: string[] = [];
    let current: string | null = end;

    while (current !== null) {
      path.unshift(current);
      current = previous[current];
    }

    return path.length > 1 && path[0] === start ? path : [];
  }, [nodes, edges]);

  // Mouse handlers
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycastRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycastRef.current.intersectObjects(Array.from(nodeObjectsRef.current.values()));

    nodeObjectsRef.current.forEach((mesh, nodeId) => {
      if (nodeId === hoveredNode && mesh.material instanceof THREE.MeshPhongMaterial) {
        mesh.material.emissiveIntensity = 0.2;
        mesh.scale.set(1, 1, 1);
      }
    });

    if (intersects.length > 0) {
      const hoveredMesh = intersects[0].object as THREE.Mesh;
      const nodeId = hoveredMesh.userData.nodeId;

      if (hoveredMesh.material instanceof THREE.MeshPhongMaterial) {
        hoveredMesh.material.emissiveIntensity = 0.6;
        // Dynamic scaling based on nodeSize prop
        const hoverScale = Math.min(1.5, 1 + (nodeSize / 20));
        hoveredMesh.scale.set(hoverScale, hoverScale, hoverScale);
      }

      setHoveredNode(nodeId);
      mountRef.current.style.cursor = 'pointer';
    } else {
      setHoveredNode(null);
      mountRef.current.style.cursor = 'grab';
    }
  }, [hoveredNode, nodeSize]);

  const handleMouseClick = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycastRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycastRef.current.intersectObjects(Array.from(nodeObjectsRef.current.values()));

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object as THREE.Mesh;
      const nodeId = clickedMesh.userData.nodeId;
      const nodeData = clickedMesh.userData.nodeData;

      if (pathMode) {
        if (!startNode) {
          setStartNode(nodeId);
        } else if (!endNode && nodeId !== startNode) {
          setEndNode(nodeId);
          const path = findShortestPath(startNode, nodeId);
          setShortestPath(path);
        } else {
          setStartNode(nodeId);
          setEndNode(null);
          setShortestPath([]);
        }
      } else {
        const newSelected = new Set(selectedNodes);
        if (event.shiftKey) {
          if (newSelected.has(nodeId)) {
            newSelected.delete(nodeId);
          } else {
            newSelected.add(nodeId);
          }
        } else {
          newSelected.clear();
          newSelected.add(nodeId);
        }
        setSelectedNodes(newSelected);

        // Show node menu on right click or when node is selected
        if (event.button === 2 || newSelected.has(nodeId)) {
          setNodeMenu({
            nodeId,
            x: event.clientX,
            y: event.clientY
          });
        }
      }

      // Call the onNodeClick prop if provided
      if (onNodeClick && nodeData) {
        onNodeClick(nodeData);
      }

      createGraph();
    } else {
      // Clear selection and menu when clicking empty space
      setSelectedNodes(new Set());
      setNodeMenu(null);
      createGraph();
    }
  }, [pathMode, startNode, endNode, selectedNodes, findShortestPath, createGraph, onNodeClick]);

  // Animation loop
  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    if (controlsRef.current) {
      controlsRef.current.update();
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationIdRef.current = requestAnimationFrame(animate);
  }, []);

  // Initialize
  useEffect(() => {
    if (isInitialized) return;
    const timer = setTimeout(() => {
      initThreeJS();
    }, 100);
    return () => clearTimeout(timer);
  }, [initThreeJS, isInitialized]);

  // Create graph - with proper dependency on slider values
  useEffect(() => {
    if (isInitialized && nodes.length > 0) {
      // Only recalculate if sliders change and we're in force mode
      if (layoutMode === 'force' && forceSimulationCompleted) {
        // Check if we need to recalculate based on slider changes
        calculateForcePositions(distancePower, relationshipPower);
      } else {
        createGraph();
      }
    }
  }, [isInitialized, nodes, edges, createGraph, distancePower, relationshipPower, layoutMode, forceSimulationCompleted, calculateForcePositions]);

  // Setup controls event listener for edge labels
  useEffect(() => {
    if (isInitialized && controlsRef.current) {
      const controls = controlsRef.current;

      const handleControlsChange = () => {
        // Debounce the update to avoid excessive recalculation
        setTimeout(() => updateEdgeLabels(), 50);
      };

      controls.addEventListener('change', handleControlsChange);

      return () => {
        controls.removeEventListener('change', handleControlsChange);
      };
    }
  }, [isInitialized, updateEdgeLabels]);

  // Animation
  useEffect(() => {
    if (isInitialized) {
      animate();
      return () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
      };
    }
  }, [isInitialized, animate]);

  // Resize
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) return;
    rendererRef.current.setSize(width, height);
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
  }, [width, height]);

  // Event listeners
  useEffect(() => {
    if (!isInitialized || !mountRef.current) return;
    const mount = mountRef.current;

    // Prevent context menu on right click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleMouseClick(e);
    };

    mount.addEventListener('mousemove', handleMouseMove);
    mount.addEventListener('click', handleMouseClick);
    mount.addEventListener('contextmenu', handleContextMenu);
    return () => {
      mount.removeEventListener('mousemove', handleMouseMove);
      mount.removeEventListener('click', handleMouseClick);
      mount.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isInitialized, handleMouseMove, handleMouseClick]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, []);

  if (error) {
    return (
      <div className={className || "absolute inset-0"} style={{ width, height }}>
        <div className="flex items-center justify-center h-full text-red-400">
          <div className="text-center">
            <div className="text-xl mb-2">❌ 3D Visualization Error</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={className || "absolute inset-0"}
      style={{ width, height, backgroundColor: '#0F172A' }}
      data-testid="3d-canvas"
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Node Selection Menu */}
      {nodeMenu && (
        <div
          className="absolute bg-gray-900 bg-opacity-95 text-white text-xs rounded-lg shadow-xl p-2 z-50"
          style={{
            left: `${nodeMenu.x}px`,
            top: `${nodeMenu.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="font-bold mb-2 text-blue-400 border-b border-gray-700 pb-1">
            Node Options
          </div>
          <div className="space-y-1">
            <button
              onClick={() => {
                setStartNode(nodeMenu.nodeId);
                setPathMode(true);
                setNodeMenu(null);
              }}
              className="block w-full text-left px-2 py-1 hover:bg-gray-800 rounded"
            >
              🏁 Set as Start
            </button>
            <button
              onClick={() => {
                if (startNode && startNode !== nodeMenu.nodeId) {
                  setEndNode(nodeMenu.nodeId);
                  const path = findShortestPath(startNode, nodeMenu.nodeId);
                  setShortestPath(path);
                  setPathMode(true);
                }
                setNodeMenu(null);
              }}
              className="block w-full text-left px-2 py-1 hover:bg-gray-800 rounded"
              disabled={!startNode || startNode === nodeMenu.nodeId}
            >
              🎯 Set as End
            </button>
            <button
              onClick={() => {
                // Find connected nodes
                const connectedNodes = edges
                  .filter(e => e.source === nodeMenu.nodeId || e.target === nodeMenu.nodeId)
                  .map(e => e.source === nodeMenu.nodeId ? e.target : e.source);

                // Select all connected nodes
                const newSelection = new Set(selectedNodes);
                connectedNodes.forEach(nodeId => newSelection.add(nodeId));
                setSelectedNodes(newSelection);
                setNodeMenu(null);
                createGraph();
              }}
              className="block w-full text-left px-2 py-1 hover:bg-gray-800 rounded"
            >
              🔗 Select Connected
            </button>
            <button
              onClick={() => {
                const node = nodes.find(n => n.id === nodeMenu.nodeId);
                if (node && onNodeClick) {
                  onNodeClick(node);
                }
                setNodeMenu(null);
              }}
              className="block w-full text-left px-2 py-1 hover:bg-gray-800 rounded"
            >
              ℹ️ Show Details
            </button>
            <div className="border-t border-gray-700 pt-1 mt-1">
              <button
                onClick={() => setNodeMenu(null)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-800 rounded text-gray-400"
              >
                ❌ Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-3 rounded-lg shadow-lg max-w-xs">
        <div className="font-bold mb-2 text-blue-400">
          🌌 3D Graph - {layoutMode === 'sphere' ? '🌐 Sphere' : '🔀 Force'} Layout
        </div>
        <div className="space-y-1">
          <div>Nodes: {nodeObjectsRef.current.size}/{nodes.length}</div>
          <div>Edges: {edgeObjectsRef.current.size}/{edges.length}</div>
          <div>Selected: {selectedNodes.size}</div>
          {nodeObjectsRef.current.size < nodes.length && (
            <div className="text-orange-400 text-xs">⚠️ {nodes.length - nodeObjectsRef.current.size} unconnected nodes hidden</div>
          )}
          {simulationRunning && (
            <div className="text-yellow-400">⚡ Simulating forces...</div>
          )}
          {hoveredNode && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-yellow-400">Hovering: {hoveredNode}</div>
              <div className="text-gray-400 text-xs">
                Connections: {nodeObjectsRef.current.get(hoveredNode)?.userData.connections}<br/>
                {layoutMode === 'force' && (
                  <>Strength: {nodeObjectsRef.current.get(hoveredNode)?.userData.connectionStrength?.toFixed(1)}</>
                )}
              </div>
            </div>
          )}
          {pathMode && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-green-400">Path Mode Active</div>
              {startNode && <div className="text-xs">Start: {startNode}</div>}
              {endNode && <div className="text-xs">End: {endNode}</div>}
              {shortestPath.length > 0 && (
                <div className="text-xs">Distance: {shortestPath.length - 1} hops</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs p-3 rounded-lg shadow-lg">
        <div className="font-bold mb-2 text-blue-400">🎮 Controls</div>
        <div className="space-y-1 text-gray-300">
          <div>• Left drag: Rotate</div>
          <div>• Right drag: Pan</div>
          <div>• Scroll/Pinch: Zoom</div>
          <div>• Click: Select</div>
          <div>• Shift+Click: Multi-select</div>
        </div>
      </div>

      {/* Mode Controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-2">
        <button
          onClick={() => {
            setLayoutMode(layoutMode === 'sphere' ? 'force' : 'sphere');
            setTimeout(() => createGraph(), 100);
          }}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            layoutMode === 'force'
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {layoutMode === 'sphere' ? '🌐 Sphere Layout' : '🔀 Force Layout'}
        </button>

        <button
          onClick={() => {
            setPathMode(!pathMode);
            setStartNode(null);
            setEndNode(null);
            setShortestPath([]);
          }}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            pathMode
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {pathMode ? '🛤️ Path Mode' : '🎯 Select Mode'}
        </button>

        {layoutMode === 'force' && !simulationRunning && (
          <button
            onClick={() => createGraph()}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-yellow-600 hover:bg-yellow-700 text-white transition-colors"
          >
            ⚡ Re-simulate
          </button>
        )}
      </div>
    </div>
  );
};