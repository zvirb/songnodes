import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { setSelectedNodes } from '../../store/graphSlice';
import { setStartNode, setEndNode, addWaypoint } from '../../store/pathfindingSlice';

interface ThreeD3CanvasProps {
  width: number;
  height: number;
  className?: string;
  distancePower?: number;
}

interface Node3D {
  id: string;
  label: string;
  type: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh?: THREE.Mesh;
  selected?: boolean;
}

interface Edge3D {
  id: string;
  source: string;
  target: string;
  weight?: number;
  metadata?: any;
  line?: THREE.Line;
}

/**
 * 3D graph visualization using Three.js for immersive track relationship exploration
 */
export const ThreeD3Canvas: React.FC<ThreeD3CanvasProps> = ({
  width,
  height,
  className,
  distancePower = 1
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationIdRef = useRef<number>(0);
  const nodesRef = useRef<Node3D[]>([]);
  const edgesRef = useRef<Edge3D[]>([]);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const dispatch = useAppDispatch();
  const { nodes, edges, selectedNodes } = useAppSelector(state => state.graph);
  const pathState = useAppSelector(state => state.pathfinding);

  // Get node color based on type and selection state
  const getNodeColor = useCallback((node: any): number => {
    if (node.selected || selectedNodes.includes(node.id)) return 0xF59E0B; // Amber
    if (node.highlighted) return 0xEF4444; // Red

    // Grey out if not in collection
    const owned = node?.metadata?.owned;
    if (owned === false) return 0x475569; // Slate grey

    const nodeType = node.type || node.metadata?.type || 'unknown';
    switch (nodeType) {
      case 'artist': return 0x3B82F6; // Blue
      case 'venue': return 0x10B981; // Green
      case 'location': return 0xF59E0B; // Yellow
      case 'track': return 0x8B5CF6; // Purple
      case 'album': return 0xEC4899; // Pink
      default: return 0x6B7280; // Gray
    }
  }, [selectedNodes]);

  // Get edge color based on adjacency strength
  const getEdgeColor = useCallback((edge: Edge3D): number => {
    const metadata = edge.metadata || {};
    const strengthCategory = metadata.strength_category || 'weak';

    switch (strengthCategory) {
      case 'very_strong': return 0xFF4444; // Bright red
      case 'strong': return 0x00E5CC; // Bright teal
      case 'moderate': return 0x3B82F6; // Bright blue
      default: return 0xA855F7; // Purple
    }
  }, []);

  // Initialize 3D scene
  const initScene = useCallback(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0F172A); // Dark blue background
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    camera.position.set(0, 0, 500);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add controls for mouse interaction
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;

    const onMouseMove = (event: MouseEvent) => {
      if (!isMouseDown) {
        mouseX = (event.clientX - width / 2) * 0.001;
        mouseY = (event.clientY - height / 2) * 0.001;
      }
    };

    const onMouseDown = () => setIsMouseDown(true);
    const onMouseUp = () => setIsMouseDown(false);

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Gentle camera rotation when not interacting
      if (!isMouseDown) {
        targetX = mouseX;
        targetY = mouseY;
      }

      camera.position.x += (targetX * 200 - camera.position.x) * 0.02;
      camera.position.y += (-targetY * 200 - camera.position.y) * 0.02;
      camera.lookAt(scene.position);

      // Update physics simulation
      updatePhysics();

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
    };
  }, [width, height, isMouseDown]);

  // 3D physics simulation
  const updatePhysics = useCallback(() => {
    const nodes3D = nodesRef.current;
    const edges3D = edgesRef.current;

    if (nodes3D.length === 0) return;

    // Apply forces
    for (const node of nodes3D) {
      // Reset forces
      const force = new THREE.Vector3(0, 0, 0);

      // Repulsion from other nodes
      for (const other of nodes3D) {
        if (node.id === other.id) continue;

        const distance = node.position.distanceTo(other.position);
        if (distance > 0) {
          const repulsion = node.position.clone().sub(other.position).normalize();
          repulsion.multiplyScalar(1000 / (distance * distance));
          force.add(repulsion);
        }
      }

      // Attraction along edges
      for (const edge of edges3D) {
        let connectedNode: Node3D | undefined;
        let isSource = false;

        if (edge.source === node.id) {
          connectedNode = nodes3D.find(n => n.id === edge.target);
          isSource = true;
        } else if (edge.target === node.id) {
          connectedNode = nodes3D.find(n => n.id === edge.source);
        }

        if (connectedNode) {
          const metadata = edge.metadata || {};
          const frequency = metadata.adjacency_frequency || 1;
          const strengthCategory = metadata.strength_category || 'weak';

          // Calculate target distance based on strength
          let targetDistance;
          switch (strengthCategory) {
            case 'very_strong': targetDistance = 50 * distancePower; break;
            case 'strong': targetDistance = 100 * distancePower; break;
            case 'moderate': targetDistance = 200 * distancePower; break;
            default: targetDistance = 300 * distancePower; break;
          }

          const distance = node.position.distanceTo(connectedNode.position);
          const difference = distance - targetDistance;

          if (Math.abs(difference) > 5) {
            const attraction = connectedNode.position.clone().sub(node.position).normalize();
            attraction.multiplyScalar(difference * 0.01 * (frequency * 0.1 + 0.1));
            force.add(attraction);
          }
        }
      }

      // Center attraction (weak)
      const centerForce = node.position.clone().multiplyScalar(-0.0001);
      force.add(centerForce);

      // Apply force to velocity
      node.velocity.add(force.multiplyScalar(0.01));

      // Damping
      node.velocity.multiplyScalar(0.95);

      // Update position
      node.position.add(node.velocity);

      // Update mesh position
      if (node.mesh) {
        node.mesh.position.copy(node.position);
      }
    }

    // Update edge positions
    for (const edge of edges3D) {
      const sourceNode = nodes3D.find(n => n.id === edge.source);
      const targetNode = nodes3D.find(n => n.id === edge.target);

      if (sourceNode && targetNode && edge.line) {
        const geometry = edge.line.geometry as THREE.BufferGeometry;
        const positions = geometry.attributes.position;
        positions.setXYZ(0, sourceNode.position.x, sourceNode.position.y, sourceNode.position.z);
        positions.setXYZ(1, targetNode.position.x, targetNode.position.y, targetNode.position.z);
        positions.needsUpdate = true;
      }
    }
  }, [distancePower]);

  // Create 3D nodes and edges
  useEffect(() => {
    console.log('🌐 3D useEffect triggered:', {
      sceneExists: !!sceneRef.current,
      nodesLength: nodes.length,
      edgesLength: edges.length,
      firstNode: nodes[0]
    });

    if (!sceneRef.current || !nodes.length) {
      console.log('🌐 Skipping 3D creation:', {
        sceneExists: !!sceneRef.current,
        nodesLength: nodes.length
      });
      return;
    }

    console.log('🌐 Creating 3D visualization with', nodes.length, 'nodes and', edges.length, 'edges');

    const scene = sceneRef.current;

    // Clear previous objects (but keep lights)
    const objectsToRemove = scene.children.filter(child =>
      child.type === 'Mesh' || child.type === 'Line'
    );
    console.log('🧹 Removing', objectsToRemove.length, 'previous 3D objects');
    objectsToRemove.forEach(child => scene.remove(child));

    // Create 3D nodes
    const nodes3D: Node3D[] = nodes.map((node, index) => {
      // Arrange in 3D sphere
      const radius = 200;
      const phi = Math.acos(-1 + (2 * index) / nodes.length);
      const theta = Math.sqrt(nodes.length * Math.PI) * phi;

      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);

      // Create sphere geometry for nodes
      const geometry = new THREE.SphereGeometry(8, 16, 16);
      const material = new THREE.MeshLambertMaterial({
        color: getNodeColor(node),
        transparent: true,
        opacity: 0.8
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Store node reference for interaction
      mesh.userData = { nodeId: node.id, nodeData: node };

      scene.add(mesh);

      return {
        id: node.id,
        label: node.label || node.title || 'Unknown',
        type: node.type || node.metadata?.type || 'unknown',
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(0, 0, 0),
        mesh,
        selected: selectedNodes.includes(node.id)
      };
    });

    // Create 3D edges
    const edges3D: Edge3D[] = edges.map((edge, index) => {
      const sourceNode = nodes3D.find(n => n.id === edge.source);
      const targetNode = nodes3D.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return null;

      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(6); // 2 points * 3 coordinates

      positions[0] = sourceNode.position.x;
      positions[1] = sourceNode.position.y;
      positions[2] = sourceNode.position.z;
      positions[3] = targetNode.position.x;
      positions[4] = targetNode.position.y;
      positions[5] = targetNode.position.z;

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: getEdgeColor({ ...edge, metadata: edge.metadata }),
        transparent: true,
        opacity: 0.6
      });

      const line = new THREE.Line(geometry, material);
      scene.add(line);

      return {
        id: edge.id || `edge_${index}`,
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        metadata: edge.metadata,
        line
      };
    }).filter(Boolean) as Edge3D[];

    nodesRef.current = nodes3D;
    edgesRef.current = edges3D;

  }, [nodes, edges, selectedNodes, getNodeColor, getEdgeColor]);

  // Initialize scene
  useEffect(() => {
    const cleanup = initScene();
    return () => {
      if (cleanup) cleanup();
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [initScene]);

  // Update camera aspect ratio
  useEffect(() => {
    if (cameraRef.current && rendererRef.current) {
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    }
  }, [width, height]);

  // Debug logging
  console.log('🌌 ThreeD3Canvas render:', {
    nodesLength: nodes.length,
    edgesLength: edges.length,
    width,
    height,
    sceneExists: !!sceneRef.current
  });

  if (!nodes.length) {
    return (
      <div
        className={className || "absolute inset-0"}
        style={{ width, height, backgroundColor: '#0F172A' }}
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

  return (
    <div
      className={className || "absolute inset-0"}
      style={{ width, height }}
    >
      <div ref={mountRef} style={{ width, height }} />

      {/* Instructions overlay */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white text-sm px-3 py-2 rounded">
        🖱️ Move mouse to rotate • 🎵 Track relationships in 3D space
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{ position: 'fixed', top: tooltip.y + 10, left: tooltip.x + 10, pointerEvents: 'none' }}
          className="bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded shadow"
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default ThreeD3Canvas;