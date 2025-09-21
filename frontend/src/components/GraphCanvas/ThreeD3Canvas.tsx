import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useAppSelector } from '../../store/index';

interface ThreeD3CanvasProps {
  width: number;
  height: number;
  className?: string;
  distancePower?: number;
}

/**
 * Enhanced 3D graph visualization with full interactive features
 * - OrbitControls for manual navigation (click & drag to rotate, scroll to zoom)
 * - Node selection and hover effects
 * - Path visualization and shortest path finding
 * - Edge coloring based on connections
 * - All features from 2D version
 */
export const ThreeD3Canvas: React.FC<ThreeD3CanvasProps> = ({
  width,
  height,
  className,
  distancePower = 1
}) => {
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
  const pathLinesRef = useRef<THREE.Line[]>([]);

  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [pathMode, setPathMode] = useState(false);
  const [startNode, setStartNode] = useState<string | null>(null);
  const [endNode, setEndNode] = useState<string | null>(null);
  const [shortestPath, setShortestPath] = useState<string[]>([]);

  // Get graph data from Redux
  const { nodes, edges } = useAppSelector(state => state.graph);

  // Color scheme matching 2D version
  const getNodeColor = useCallback((node: any) => {
    if (shortestPath.includes(node.id)) return '#FFD700'; // Gold for path
    if (selectedNodes.has(node.id)) return '#FF6B6B'; // Red for selected

    switch (node.type) {
      case 'artist': return '#3B82F6'; // Blue
      case 'venue': return '#10B981'; // Green
      case 'location': return '#F59E0B'; // Yellow
      case 'track': return '#8B5CF6'; // Purple
      case 'album': return '#EC4899'; // Pink
      default: return '#6B7280'; // Gray
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
  const updateEdgeLabels = useCallback(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const visibleCount = getVisibleNodesCount();
    const showEdgeLabels = visibleCount > 0 && visibleCount <= 3; // Show when zoomed in enough

    // Remove existing edge labels
    edgeLabelObjectsRef.current.forEach((sprite) => {
      scene.remove(sprite);
    });
    edgeLabelObjectsRef.current.clear();

    if (showEdgeLabels && cameraRef.current) {
      const camera = cameraRef.current;
      const frustum = new THREE.Frustum();
      const cameraMatrix = new THREE.Matrix4();
      cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(cameraMatrix);

      // Check each edge to see if at least one node is visible
      edges.forEach(edge => {
        const sourceNode = nodeObjectsRef.current.get(edge.source);
        const targetNode = nodeObjectsRef.current.get(edge.target);

        if (sourceNode && targetNode) {
          // Check if either node is visible in the viewport
          const sourceVisible = frustum.containsPoint(sourceNode.position);
          const targetVisible = frustum.containsPoint(targetNode.position);

          // Only show edge label if at least one node is visible
          if (sourceVisible || targetVisible) {
            // Determine which node to show in the label (the non-visible one, or either if both visible)
            let labelNodeData;
            if (sourceVisible && !targetVisible) {
              labelNodeData = nodes.find(n => n.id === edge.target);
            } else if (targetVisible && !sourceVisible) {
              labelNodeData = nodes.find(n => n.id === edge.source);
            } else {
              // Both visible - show target node info
              labelNodeData = nodes.find(n => n.id === edge.target);
            }

            if (labelNodeData) {
              // Create edge label
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              if (context) {
                  canvas.width = 256;
                  canvas.height = 48;

                  // Prepare label text
                  const artist = labelNodeData.artist || labelNodeData.label?.split(' - ')[0] || '';
                  const title = labelNodeData.title || labelNodeData.label?.split(' - ')[1] || labelNodeData.label || labelNodeData.id;
                  const displayText = artist ? `${artist} - ${title}` : title;

                  // Draw background
                  context.fillStyle = 'rgba(0, 0, 0, 0.8)';
                  context.roundRect(5, 5, 246, 38, 4);
                  context.fill();

                  // Draw text
                  context.fillStyle = 'rgba(255, 255, 255, 0.95)';
                  context.font = '12px Arial';
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
                    labeledNodeId: labelNodeData.id
                  };

                  scene.add(sprite);
                  edgeLabelObjectsRef.current.set(edge.id, sprite);
              }
            }
          }
        }
      });
    }
  }, [nodes, edges, getVisibleNodesCount]);

  // Initialize Three.js scene
  const initThreeJS = useCallback(() => {
    if (!mountRef.current || isInitialized || width === 0 || height === 0) {
      return false;
    }

    try {
      console.log('🎨 Initializing enhanced 3D scene...');

      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0F172A);
      scene.fog = new THREE.Fog(0x0F172A, 50, 200);
      sceneRef.current = scene;

      // Create camera with better initial position
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(40, 30, 40);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Create renderer with antialiasing
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

      // Append to DOM
      mountRef.current.appendChild(renderer.domElement);

      // Enhanced lighting setup
      const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
      scene.add(ambientLight);

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight1.position.set(50, 50, 25);
      directionalLight1.castShadow = true;
      directionalLight1.shadow.camera.near = 0.1;
      directionalLight1.shadow.camera.far = 200;
      directionalLight1.shadow.camera.left = -50;
      directionalLight1.shadow.camera.right = 50;
      directionalLight1.shadow.camera.top = 50;
      directionalLight1.shadow.camera.bottom = -50;
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0x4A90E2, 0.4);
      directionalLight2.position.set(-30, -30, -15);
      scene.add(directionalLight2);

      // Add point lights for better depth
      const pointLight1 = new THREE.PointLight(0xff6b6b, 0.5, 100);
      pointLight1.position.set(20, 20, 20);
      scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0x4ecdc4, 0.5, 100);
      pointLight2.position.set(-20, -20, -20);
      scene.add(pointLight2);

      // Initialize OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = true;
      controls.minDistance = 10;
      controls.maxDistance = 150;
      controls.maxPolarAngle = Math.PI;
      controls.enablePan = true;
      controls.enableZoom = true; // Enables mouse wheel and pinch zoom
      controls.zoomSpeed = 1.2;
      controls.panSpeed = 0.8;
      controls.rotateSpeed = 0.8;
      controlsRef.current = controls;

      console.log('✅ Enhanced 3D scene initialized with OrbitControls');
      setIsInitialized(true);
      return true;
    } catch (err) {
      console.error('❌ Three.js initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [width, height, isInitialized]);

  // Dijkstra's algorithm for shortest path
  const findShortestPath = useCallback((start: string, end: string) => {
    const distances: { [key: string]: number } = {};
    const previous: { [key: string]: string | null } = {};
    const unvisited = new Set<string>();

    // Initialize
    nodes.forEach(node => {
      distances[node.id] = node.id === start ? 0 : Infinity;
      previous[node.id] = null;
      unvisited.add(node.id);
    });

    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
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

      // Update distances to neighbors
      edges.forEach(edge => {
        let neighbor: string | null = null;
        if (edge.source === current) neighbor = edge.target;
        else if (edge.target === current) neighbor = edge.source;

        if (neighbor && unvisited.has(neighbor)) {
          const alt = distances[current] + 1;
          if (alt < distances[neighbor]) {
            distances[neighbor] = alt;
            previous[neighbor] = current;
          }
        }
      });
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = end;

    while (current !== null) {
      path.unshift(current);
      current = previous[current];
    }

    return path.length > 1 && path[0] === start ? path : [];
  }, [nodes, edges]);

  // Create 3D graph visualization
  const createGraph = useCallback(() => {
    if (!sceneRef.current || !nodes.length) return;

    const scene = sceneRef.current;

    // Clear existing objects
    scene.children = scene.children.filter(child => !child.userData.isGraphElement && !child.userData.isEdgeLabel);
    nodeObjectsRef.current.clear();
    edgeObjectsRef.current.clear();
    edgeLabelObjectsRef.current.clear();
    pathLinesRef.current = [];

    // Create nodes
    const nodeGroup = new THREE.Group();
    nodeGroup.userData.isGraphElement = true;

    // Position nodes in 3D space using force-directed layout simulation
    const nodePositions = new Map<string, THREE.Vector3>();

    nodes.forEach((node, index) => {
      // Spherical distribution with some randomness for natural layout
      const phi = Math.acos(-1 + (2 * index) / nodes.length);
      const theta = Math.sqrt(nodes.length * Math.PI) * phi;
      const radius = 30 + (node.ring || 0) * 10;

      const position = new THREE.Vector3(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi)
      );

      // Add some randomness
      position.x += (Math.random() - 0.5) * 5;
      position.y += (Math.random() - 0.5) * 5;
      position.z += (Math.random() - 0.5) * 5;

      nodePositions.set(node.id, position);

      // Determine node size based on connections
      const nodeConnections = edges.filter(e => e.source === node.id || e.target === node.id).length;
      const nodeRadius = 0.5 + Math.min(nodeConnections * 0.1, 2);

      // Create sphere for node
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
        connections: nodeConnections
      };

      nodeObjectsRef.current.set(node.id, sphere);
      nodeGroup.add(sphere);

      // Add label sprite with full artist and song info
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = 512;
        canvas.height = 96;

        // Prepare label text
        const artist = node.artist || node.label?.split(' - ')[0] || '';
        const title = node.title || node.label?.split(' - ')[1] || node.label || node.id;

        // Draw semi-transparent background
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.roundRect(10, 10, 492, 76, 8);
        context.fill();

        // Draw artist name (smaller, gray)
        context.fillStyle = 'rgba(150, 150, 150, 0.9)';
        context.font = '18px Arial';
        context.textAlign = 'center';
        if (artist) {
          context.fillText(artist, 256, 35);
        }

        // Draw song title (larger, white)
        context.fillStyle = 'rgba(255, 255, 255, 0.95)';
        context.font = 'bold 22px Arial';
        context.textAlign = 'center';

        // Truncate if too long but keep more characters
        const maxTitleLength = 40;
        const displayTitle = title.length > maxTitleLength
          ? title.substring(0, maxTitleLength - 3) + '...'
          : title;
        context.fillText(displayTitle, 256, artist ? 60 : 48);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.9
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.position.y += nodeRadius + 2;
        sprite.scale.set(12, 3, 1);
        sprite.userData.isGraphElement = true;
        nodeGroup.add(sprite);
      }
    });

    scene.add(nodeGroup);

    // Create edges
    const edgeGroup = new THREE.Group();
    edgeGroup.userData.isGraphElement = true;

    edges.forEach(edge => {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);

      if (sourcePos && targetPos) {
        // Create curved edge for better visibility
        const midPoint = new THREE.Vector3().addVectors(sourcePos, targetPos).multiplyScalar(0.5);
        midPoint.y += 2; // Curve upward

        const curve = new THREE.QuadraticBezierCurve3(sourcePos, midPoint, targetPos);
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Color based on connection strength
        const isInPath = shortestPath.includes(edge.source) && shortestPath.includes(edge.target);
        const isConnectedToSelected = selectedNodes.has(edge.source) || selectedNodes.has(edge.target);

        let edgeColor = 0x4A90E2; // Default blue
        let edgeOpacity = 0.3;
        let linewidth = 1;

        if (isInPath) {
          edgeColor = 0xFFD700; // Gold for path
          edgeOpacity = 1.0;
          linewidth = 3;
        } else if (isConnectedToSelected) {
          edgeColor = 0xFF6B6B; // Red for selected connections
          edgeOpacity = 0.8;
          linewidth = 2;
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
          targetId: edge.target
        };

        edgeObjectsRef.current.set(edge.id, line);
        edgeGroup.add(line);
      }
    });

    scene.add(edgeGroup);

    // Initial edge label update
    setTimeout(() => updateEdgeLabels(), 100);
  }, [nodes, edges, selectedNodes, shortestPath, getNodeColor, updateEdgeLabels]);

  // Handle mouse movement for hover
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycastRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycastRef.current.intersectObjects(Array.from(nodeObjectsRef.current.values()));

    // Reset previous hover
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
        hoveredMesh.scale.set(1.2, 1.2, 1.2);
      }

      setHoveredNode(nodeId);
      mountRef.current.style.cursor = 'pointer';
    } else {
      setHoveredNode(null);
      mountRef.current.style.cursor = controlsRef.current?.enabled ? 'grab' : 'default';
    }
  }, [hoveredNode]);

  // Handle mouse click for selection and path finding
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

      if (pathMode) {
        // Path finding mode
        if (!startNode) {
          setStartNode(nodeId);
          console.log('🎯 Path start:', nodeId);
        } else if (!endNode && nodeId !== startNode) {
          setEndNode(nodeId);
          const path = findShortestPath(startNode, nodeId);
          setShortestPath(path);
          console.log('🛤️ Path found:', path);
        } else {
          // Reset path
          setStartNode(nodeId);
          setEndNode(null);
          setShortestPath([]);
        }
      } else {
        // Selection mode
        const newSelected = new Set(selectedNodes);
        if (event.shiftKey) {
          // Multi-select with shift
          if (newSelected.has(nodeId)) {
            newSelected.delete(nodeId);
          } else {
            newSelected.add(nodeId);
          }
        } else {
          // Single select
          newSelected.clear();
          newSelected.add(nodeId);
        }
        setSelectedNodes(newSelected);
      }

      // Update graph to reflect changes
      createGraph();
    }
  }, [pathMode, startNode, endNode, selectedNodes, findShortestPath, createGraph]);

  // Animation loop
  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    // Update controls
    if (controlsRef.current) {
      controlsRef.current.update();
    }

    // Render scene
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationIdRef.current = requestAnimationFrame(animate);
  }, []);

  // Initialize Three.js
  useEffect(() => {
    if (isInitialized) return;

    const timer = setTimeout(() => {
      initThreeJS();
    }, 100);

    return () => clearTimeout(timer);
  }, [initThreeJS, isInitialized]);

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

  // Create graph when ready
  useEffect(() => {
    if (isInitialized && nodes.length > 0) {
      createGraph();
    }
  }, [isInitialized, nodes, edges, createGraph]);

  // Start animation
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

  // Handle resize
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) return;

    rendererRef.current.setSize(width, height);
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
  }, [width, height]);

  // Add event listeners
  useEffect(() => {
    if (!isInitialized || !mountRef.current) return;

    const mount = mountRef.current;
    mount.addEventListener('mousemove', handleMouseMove);
    mount.addEventListener('click', handleMouseClick);

    return () => {
      mount.removeEventListener('mousemove', handleMouseMove);
      mount.removeEventListener('click', handleMouseClick);
    };
  }, [isInitialized, handleMouseMove, handleMouseClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
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

      {/* Info Panel */}
      <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-3 rounded-lg shadow-lg max-w-xs">
        <div className="font-bold mb-2 text-blue-400">🌌 3D Graph Visualization</div>
        <div className="space-y-1">
          <div>Nodes: {nodes.length}</div>
          <div>Edges: {edges.length}</div>
          <div>Selected: {selectedNodes.size}</div>
          {hoveredNode && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-yellow-400">Hovering: {hoveredNode}</div>
              <div className="text-gray-400 text-xs">
                {nodeObjectsRef.current.get(hoveredNode)?.userData.connections} connections
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

      {/* Controls Help */}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs p-3 rounded-lg shadow-lg">
        <div className="font-bold mb-2 text-blue-400">🎮 Controls</div>
        <div className="space-y-1 text-gray-300">
          <div>• Left drag: Rotate view</div>
          <div>• Right drag: Pan camera</div>
          <div>• Scroll/Pinch: Zoom in/out</div>
          <div>• Click: Select node</div>
          <div>• Shift+Click: Multi-select</div>
          <div>• P key: Toggle path mode</div>
        </div>
      </div>

      {/* Mode Toggle Button */}
      <div className="absolute top-2 right-2">
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
      </div>
    </div>
  );
};