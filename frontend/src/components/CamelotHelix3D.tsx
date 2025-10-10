import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import useStore from '../store/useStore';
import { GraphNode } from '../types';
import { Music, RotateCcw, Maximize2, Eye, EyeOff } from 'lucide-react';

/**
 * CamelotHelix3D Component
 *
 * 3D visualization of the Camelot wheel as a double helix/cylinder
 *
 * FEATURES:
 * - Major keys: Outer cylinder (larger radius)
 * - Minor keys: Inner cylinder (smaller radius)
 * - Height (Z-axis): BPM range
 * - Tracks positioned by key and BPM
 * - Color coding by energy
 * - Interactive rotation and zoom
 * - Track selection and highlighting
 * - Harmonic compatibility connections
 *
 * STRUCTURE:
 * - 12 positions around cylinder (Camelot wheel positions)
 * - 2 concentric cylinders (major/minor)
 * - Vertical axis represents BPM (60-180 typical range)
 * - Tracks are spheres positioned in 3D space
 * - Lines connect harmonically compatible keys
 */

interface CamelotHelix3DProps {
  width?: number;
  height?: number;
  showConnections?: boolean;
  onTrackClick?: (node: GraphNode) => void;
  className?: string;
}

// Camelot key data
const CAMELOT_KEYS = [
  // Major keys (outer)
  { id: '8B', musical: 'C Major', position: 0, mode: 'major', color: 0x3b82f6 },
  { id: '9B', musical: 'G Major', position: 1, mode: 'major', color: 0x10b981 },
  { id: '10B', musical: 'D Major', position: 2, mode: 'major', color: 0xf59e0b },
  { id: '11B', musical: 'A Major', position: 3, mode: 'major', color: 0xf97316 },
  { id: '12B', musical: 'E Major', position: 4, mode: 'major', color: 0xef4444 },
  { id: '1B', musical: 'B Major', position: 5, mode: 'major', color: 0xec4899 },
  { id: '2B', musical: 'F# Major', position: 6, mode: 'major', color: 0xa855f7 },
  { id: '3B', musical: 'C# Major', position: 7, mode: 'major', color: 0x8b5cf6 },
  { id: '4B', musical: 'G# Major', position: 8, mode: 'major', color: 0x6366f1 },
  { id: '5B', musical: 'D# Major', position: 9, mode: 'major', color: 0x06b6d4 },
  { id: '6B', musical: 'A# Major', position: 10, mode: 'major', color: 0x0891b2 },
  { id: '7B', musical: 'F Major', position: 11, mode: 'major', color: 0x059669 },
  // Minor keys (inner)
  { id: '8A', musical: 'A Minor', position: 0, mode: 'minor', color: 0x374151 },
  { id: '9A', musical: 'E Minor', position: 1, mode: 'minor', color: 0x475569 },
  { id: '10A', musical: 'B Minor', position: 2, mode: 'minor', color: 0x581c87 },
  { id: '11A', musical: 'F# Minor', position: 3, mode: 'minor', color: 0x7c2d12 },
  { id: '12A', musical: 'C# Minor', position: 4, mode: 'minor', color: 0x92400e },
  { id: '1A', musical: 'G# Minor', position: 5, mode: 'minor', color: 0x991b1b },
  { id: '2A', musical: 'D# Minor', position: 6, mode: 'minor', color: 0xbe185d },
  { id: '3A', musical: 'A# Minor', position: 7, mode: 'minor', color: 0x7c3aed },
  { id: '4A', musical: 'F Minor', position: 8, mode: 'minor', color: 0x4338ca },
  { id: '5A', musical: 'C Minor', position: 9, mode: 'minor', color: 0x0e7490 },
  { id: '6A', musical: 'G Minor', position: 10, mode: 'minor', color: 0x047857 },
  { id: '7A', musical: 'D Minor', position: 11, mode: 'minor', color: 0x365314 },
] as const;

export const CamelotHelix3D: React.FC<CamelotHelix3DProps> = ({
  width = 800,
  height = 600,
  showConnections = true,
  onTrackClick,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const trackObjectsRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Store state
  const graphData = useStore(state => state.graphData);
  const selectedNodes = useStore(state => state.viewState.selectedNodes);
  const selectNode = useStore(state => state.graph.selectNode);

  // Local state
  const [showLabels, setShowLabels] = useState(true);
  const [showCylinders, setShowCylinders] = useState(true);

  /**
   * Convert musical key to Camelot notation
   */
  const musicalKeyToCamelot = useCallback((key: string): string | null => {
    if (!key || typeof key !== 'string') return null;

    const normalized = key.trim().toLowerCase();
    if (normalized.match(/^\d+[ab]$/i)) return key.toUpperCase();

    let note = '';
    let mode: 'major' | 'minor' | null = null;

    const patterns = [
      /^([a-g][#b]?)\s*(major|minor|maj|min)/i,
      /^([a-g][#b]?)m$/i,
      /^([a-g][#b]?)$/i,
    ];

    let match = null;
    for (const pattern of patterns) {
      match = normalized.match(pattern);
      if (match) break;
    }

    if (!match) return null;

    note = match[1].toUpperCase();
    if (match[2]) {
      mode = match[2].toLowerCase().startsWith('maj') ? 'major' : 'minor';
    } else if (normalized.endsWith('m')) {
      mode = 'minor';
    } else {
      mode = 'major';
    }

    const noteMap: Record<string, string> = {
      'C': 'C', 'C#': 'C#', 'DB': 'C#',
      'D': 'D', 'D#': 'D#', 'EB': 'D#',
      'E': 'E', 'F': 'F',
      'F#': 'F#', 'GB': 'F#',
      'G': 'G', 'G#': 'G#', 'AB': 'G#',
      'A': 'A', 'A#': 'A#', 'BB': 'A#',
      'B': 'B', 'CB': 'B',
    };

    const canonicalNote = noteMap[note];
    if (!canonicalNote) return null;

    const majorMap: Record<string, string> = {
      'C': '8B', 'C#': '3B', 'D': '10B', 'D#': '5B', 'E': '12B', 'F': '7B',
      'F#': '2B', 'G': '9B', 'G#': '4B', 'A': '11B', 'A#': '6B', 'B': '1B',
    };

    const minorMap: Record<string, string> = {
      'A': '8A', 'A#': '3A', 'B': '10A', 'C': '5A', 'C#': '12A', 'D': '7A',
      'D#': '2A', 'E': '9A', 'F': '4A', 'F#': '11A', 'G': '6A', 'G#': '1A',
    };

    return mode === 'major' ? majorMap[canonicalNote] : minorMap[canonicalNote];
  }, []);

  /**
   * Get Camelot key from node
   */
  const getNodeKey = useCallback((node: GraphNode): string | null => {
    const key = node.key || node.metadata?.key || node.track?.key || node.track?.camelotKey;
    if (!key) return null;
    if (key.match(/^\d+[AB]$/i)) return key.toUpperCase();
    return musicalKeyToCamelot(key);
  }, [musicalKeyToCamelot]);

  /**
   * Calculate 3D position for track
   */
  const calculatePosition = useCallback((node: GraphNode): THREE.Vector3 => {
    const camelotKey = getNodeKey(node);
    const bpm = node.bpm || node.track?.bpm || 120;

    const keyData = CAMELOT_KEYS.find(k => k.id === camelotKey);

    if (keyData) {
      const angle = (keyData.position / 12) * Math.PI * 2;
      const radius = keyData.mode === 'major' ? 50 : 30;

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = ((bpm - 120) / 60) * 50; // Normalized height

      return new THREE.Vector3(x, y, z);
    }

    // Fallback
    return new THREE.Vector3(0, 0, 0);
  }, [getNodeKey]);

  /**
   * Initialize Three.js scene
   */
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 300;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-50, -50, -50);
    scene.add(directionalLight2);

    // Create cylinders for major and minor keys
    if (showCylinders) {
      // Outer cylinder (major keys)
      const outerGeometry = new THREE.CylinderGeometry(50, 50, 150, 32, 1, true);
      const outerMaterial = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        wireframe: true,
      });
      const outerCylinder = new THREE.Mesh(outerGeometry, outerMaterial);
      outerCylinder.rotation.x = Math.PI / 2;
      scene.add(outerCylinder);

      // Inner cylinder (minor keys)
      const innerGeometry = new THREE.CylinderGeometry(30, 30, 150, 32, 1, true);
      const innerMaterial = new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        wireframe: true,
      });
      const innerCylinder = new THREE.Mesh(innerGeometry, innerMaterial);
      innerCylinder.rotation.x = Math.PI / 2;
      scene.add(innerCylinder);
    }

    // Add key position markers
    CAMELOT_KEYS.forEach(keyData => {
      const angle = (keyData.position / 12) * Math.PI * 2;
      const radius = keyData.mode === 'major' ? 50 : 30;

      // Marker sphere
      const markerGeometry = new THREE.SphereGeometry(1, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: keyData.color });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      marker.position.set(x, y, 0);
      scene.add(marker);

      // Label
      if (showLabels) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 128;
        canvas.height = 64;
        context.fillStyle = '#ffffff';
        context.font = 'bold 24px Arial';
        context.textAlign = 'center';
        context.fillText(keyData.id, 64, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(x * 1.3, y * 1.3, 0);
        sprite.scale.set(10, 5, 1);
        scene.add(sprite);
      }
    });

    // Add grid helper
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      controls.dispose();
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [width, height, showLabels, showCylinders]);

  /**
   * Update tracks based on graph data
   */
  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    // Remove old track objects
    trackObjectsRef.current.forEach(mesh => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    trackObjectsRef.current.clear();

    // Add new track objects
    graphData.nodes.forEach(node => {
      const position = calculatePosition(node);
      const energy = node.energy || node.track?.energy || 0.5;

      // Create sphere for track
      const geometry = new THREE.SphereGeometry(2, 16, 16);
      const color = new THREE.Color();
      color.setHSL(energy, 0.8, 0.5);

      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: selectedNodes.has(node.id) ? 0xff6b35 : 0x000000,
        emissiveIntensity: selectedNodes.has(node.id) ? 0.5 : 0,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.userData = { nodeId: node.id, node };

      scene.add(mesh);
      trackObjectsRef.current.set(node.id, mesh);
    });
  }, [graphData, selectedNodes, calculatePosition]);

  /**
   * Handle mouse click for track selection
   */
  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const trackMeshes = Array.from(trackObjectsRef.current.values());
    const intersects = raycasterRef.current.intersectObjects(trackMeshes);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const nodeId = mesh.userData.nodeId;

      if (nodeId) {
        selectNode(nodeId);

        if (onTrackClick) {
          onTrackClick(mesh.userData.node);
        }
      }
    }
  }, [selectNode, onTrackClick]);

  /**
   * Reset camera
   */
  const handleResetCamera = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(100, 100, 100);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  /**
   * Fit view
   */
  const handleFitView = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(150, 150, 150);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Three.js Canvas */}
      <div ref={mountRef} onClick={handleClick} style={{ width, height }} />

      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setShowLabels(!showLabels)}
          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
          title={showLabels ? 'Hide Labels' : 'Show Labels'}
        >
          {showLabels ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
        <button
          onClick={handleFitView}
          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
          title="Fit to View"
        >
          <Maximize2 size={20} />
        </button>
        <button
          onClick={handleResetCamera}
          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
          title="Reset Camera"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      {/* Info Panel */}
      <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg">
        <div className="flex items-center gap-2 font-semibold mb-1">
          <Music size={16} />
          Camelot Helix 3D
        </div>
        <div className="text-xs text-white/80">
          Outer Ring: Major Keys<br />
          Inner Ring: Minor Keys<br />
          Height: BPM Range<br />
          Color: Energy Level
        </div>
        <div className="mt-2 text-xs text-white/60">
          Tracks: {graphData.nodes.length}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-xs">
        <div>Left Click + Drag: Rotate</div>
        <div>Right Click + Drag: Pan</div>
        <div>Scroll: Zoom</div>
        <div>Click Track: Select</div>
      </div>
    </div>
  );
};

export default CamelotHelix3D;
