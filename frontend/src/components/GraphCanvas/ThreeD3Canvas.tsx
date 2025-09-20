import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { useAppSelector } from '../../store/index';

interface ThreeD3CanvasProps {
  width: number;
  height: number;
  className?: string;
  distancePower?: number;
}

/**
 * 3D graph visualization using Three.js for immersive track relationship exploration
 * Uses the same data source as the working 2D visualization
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
  const animationIdRef = useRef<number>();
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the same data as the working 2D visualization
  const { nodes, edges } = useAppSelector(state => state.graph);

  // Color mapping for different node types (same as 2D version)
  const getNodeColor = useCallback((node: any) => {
    switch (node.type) {
      case 'artist': return '#3B82F6'; // Blue
      case 'venue': return '#10B981'; // Green
      case 'location': return '#F59E0B'; // Yellow
      case 'track': return '#8B5CF6'; // Purple
      case 'album': return '#EC4899'; // Pink
      default: return '#6B7280'; // Gray
    }
  }, []);

  // Initialize Three.js scene
  const initThreeJS = useCallback(() => {
    if (!mountRef.current || isInitialized) return;

    try {
      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0F172A); // Dark background
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(0, 0, 50);
      cameraRef.current = camera;

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      rendererRef.current = renderer;

      // Append to DOM
      mountRef.current.appendChild(renderer.domElement);

      // Add basic lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 5);
      scene.add(directionalLight);

      setIsInitialized(true);
      console.log('🌌 Three.js scene initialized successfully');
    } catch (err) {
      console.error('❌ Three.js initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [width, height, isInitialized]);

  // Create 3D graph visualization
  const createGraph = useCallback(() => {
    if (!sceneRef.current || !nodes.length) return;

    const scene = sceneRef.current;

    // Clear existing objects
    const objectsToRemove = scene.children.filter(child =>
      child.userData.isGraphElement
    );
    objectsToRemove.forEach(obj => scene.remove(obj));

    console.log('🎨 Creating 3D graph with', nodes.length, 'nodes and', edges.length, 'edges');

    // Create node geometry and materials
    const nodeGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const nodeGroup = new THREE.Group();
    nodeGroup.userData.isGraphElement = true;

    // Position nodes in 3D space
    const nodePositions = new Map<string, THREE.Vector3>();
    nodes.forEach((node, index) => {
      // Create spherical distribution for better 3D layout
      const phi = Math.acos(1 - 2 * (index + 0.5) / nodes.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * index;
      const radius = 20;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const position = new THREE.Vector3(x, y, z);
      nodePositions.set(node.id, position);

      // Create node material with proper color
      const color = new THREE.Color(getNodeColor(node));
      const nodeMaterial = new THREE.MeshLambertMaterial({ color });

      // Create node mesh
      const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
      nodeMesh.position.copy(position);
      nodeMesh.userData = {
        nodeId: node.id,
        nodeData: node,
        isGraphElement: true
      };

      nodeGroup.add(nodeMesh);

      // Add text label
      if (node.title || node.label) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.width = 256;
          canvas.height = 64;
          context.fillStyle = '#FFFFFF';
          context.font = '16px Arial';
          context.textAlign = 'center';
          context.fillText(
            (node.title || node.label).substring(0, 20),
            canvas.width / 2,
            canvas.height / 2
          );

          const texture = new THREE.CanvasTexture(canvas);
          const labelMaterial = new THREE.SpriteMaterial({ map: texture });
          const label = new THREE.Sprite(labelMaterial);
          label.position.copy(position);
          label.position.y += 1.5;
          label.scale.set(4, 1, 1);
          label.userData.isGraphElement = true;

          nodeGroup.add(label);
        }
      }
    });

    scene.add(nodeGroup);

    // Create edges
    if (edges.length > 0) {
      const edgeGroup = new THREE.Group();
      edgeGroup.userData.isGraphElement = true;

      edges.forEach(edge => {
        const sourcePos = nodePositions.get(edge.source);
        const targetPos = nodePositions.get(edge.target);

        if (sourcePos && targetPos) {
          const points = [sourcePos, targetPos];
          const geometry = new THREE.BufferGeometry().setFromPoints(points);

          // Edge color based on frequency/strength
          const metadata = edge.metadata || {};
          const frequency = metadata.adjacency_frequency || 1;
          const alpha = Math.min(1, 0.3 + frequency * 0.1);

          const material = new THREE.LineBasicMaterial({
            color: 0x4A90E2,
            opacity: alpha,
            transparent: true
          });

          const line = new THREE.Line(geometry, material);
          line.userData.isGraphElement = true;
          edgeGroup.add(line);
        }
      });

      scene.add(edgeGroup);
    }

    console.log('✅ 3D graph created successfully');
  }, [nodes, edges, getNodeColor]);

  // Animation loop
  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    // Slow rotation around Y-axis for a dynamic view
    const time = Date.now() * 0.0005;
    cameraRef.current.position.x = Math.cos(time) * 50;
    cameraRef.current.position.z = Math.sin(time) * 50;
    cameraRef.current.lookAt(0, 0, 0);

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationIdRef.current = requestAnimationFrame(animate);
  }, []);

  // Initialize Three.js when component mounts
  useEffect(() => {
    initThreeJS();

    return () => {
      // Cleanup
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [initThreeJS]);

  // Create graph when data is available and scene is initialized
  useEffect(() => {
    if (isInitialized && nodes.length > 0) {
      createGraph();
    }
  }, [isInitialized, nodes, edges, createGraph]);

  // Start animation when scene is ready
  useEffect(() => {
    if (isInitialized && !animationIdRef.current) {
      animate();
    }
  }, [isInitialized, animate]);

  // Handle window resize
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) return;

    rendererRef.current.setSize(width, height);
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
  }, [width, height]);

  // Error state
  if (error) {
    return (
      <div
        className={className || "absolute inset-0"}
        style={{ width, height, backgroundColor: '#0F172A' }}
        data-testid="3d-canvas-error"
      >
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="text-xl font-bold mb-2 text-red-400">❌ 3D Visualization Error</div>
            <div className="text-sm text-gray-400 mb-2">{error}</div>
            <div className="text-xs text-gray-500">
              Check browser WebGL support and console for details
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (!isInitialized) {
    return (
      <div
        className={className || "absolute inset-0"}
        style={{ width, height, backgroundColor: '#0F172A' }}
        data-testid="3d-canvas-loading"
      >
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="text-xl font-bold mb-2">🌌 Initializing 3D Visualization</div>
            <div className="text-sm text-blue-400 mb-2">Setting up Three.js scene...</div>
            <div className="text-xs text-gray-500">
              Data ready: {nodes.length} nodes, {edges.length} edges
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!nodes.length) {
    return (
      <div
        className={className || "absolute inset-0"}
        style={{ width, height, backgroundColor: '#0F172A' }}
        data-testid="3d-canvas-no-data"
      >
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="text-xl font-bold mb-2">🌌 3D Graph Visualization</div>
            <div className="text-sm text-gray-400">Waiting for graph data...</div>
            <div className="text-xs text-gray-500 mt-2">
              Nodes: {nodes.length} | Edges: {edges.length}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render the 3D canvas
  return (
    <div
      className={className || "absolute inset-0"}
      style={{ width, height, backgroundColor: '#0F172A' }}
      data-testid="3d-canvas"
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Debug info overlay */}
      <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
        <div>🌌 3D Mode</div>
        <div>Nodes: {nodes.length}</div>
        <div>Edges: {edges.length}</div>
        <div>WebGL: ✅</div>
      </div>
    </div>
  );
};