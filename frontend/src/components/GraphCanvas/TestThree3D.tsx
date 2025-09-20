import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface TestThree3DProps {
  width: number;
  height: number;
  className?: string;
}

/**
 * Simplified 3D test component to verify Three.js rendering works
 */
export const TestThree3D: React.FC<TestThree3DProps> = ({
  width,
  height,
  className
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationIdRef = useRef<number>(0);

  useEffect(() => {
    if (!mountRef.current) return;

    console.log('🧪 TestThree3D: Initializing simple 3D scene...');

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0F172A);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 500;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Clear and add to DOM
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create test geometry - simple nodes
    const testNodes = [
      { x: 0, y: 0, z: 0, color: 0xff0000 },
      { x: 100, y: 100, z: 0, color: 0x00ff00 },
      { x: -100, y: -100, z: 0, color: 0x0000ff },
      { x: 200, y: 0, z: 100, color: 0xffff00 },
      { x: -200, y: 0, z: -100, color: 0xff00ff },
    ];

    // Create node meshes
    testNodes.forEach((nodeData, index) => {
      const geometry = new THREE.SphereGeometry(20, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color: nodeData.color });
      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.set(nodeData.x, nodeData.y, nodeData.z);
      scene.add(mesh);

      console.log(`🧪 Added test node ${index} at position:`, nodeData);
    });

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Rotate camera around the scene
      const time = Date.now() * 0.001;
      camera.position.x = Math.cos(time) * 300;
      camera.position.z = Math.sin(time) * 300;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();
    console.log('🧪 TestThree3D: Animation started, test nodes created');

    // Cleanup
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      console.log('🧪 TestThree3D: Cleaned up');
    };
  }, [width, height]);

  return (
    <div className={className || "absolute inset-0"} style={{ width, height }}>
      <div ref={mountRef} className="w-full h-full" />

      {/* Debug overlay */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white text-xs p-2 rounded">
        <div className="font-bold">🧪 3D Test Mode</div>
        <div>Rendering 5 test nodes with rotation</div>
        <div>Dimensions: {width}×{height}</div>
        <div>WebGL: {typeof WebGLRenderingContext !== 'undefined' ? '✅' : '❌'}</div>
      </div>
    </div>
  );
};