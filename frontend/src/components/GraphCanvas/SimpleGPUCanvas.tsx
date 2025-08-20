/**
 * Simple GPU-Optimized Canvas Implementation
 * Minimal working version to demonstrate GPU optimization
 */

import React, { useEffect, useRef, useState } from 'react';
import { Application, Sprite } from 'pixi.js';
import * as PIXI from 'pixi.js';
import { GPUOptimizer } from '../../utils/gpuOptimizer';

interface SimpleGPUCanvasProps {
  width: number;
  height: number;
  nodeCount?: number;
}

interface GPUMetrics {
  fps: number;
  drawCalls: number;
  texturePoolSize: number;
  shaderCacheSize: number;
  contextType: string;
}

export const SimpleGPUCanvas: React.FC<SimpleGPUCanvasProps> = ({
  width = 800,
  height = 600,
  nodeCount = 1000,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const gpuOptimizerRef = useRef<GPUOptimizer | null>(null);
  const [gpuMetrics, setGPUMetrics] = useState<GPUMetrics>({
    fps: 0,
    drawCalls: 0,
    texturePoolSize: 0,
    shaderCacheSize: 0,
    contextType: 'unknown'
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const initializeGPUCanvas = async () => {
      try {
        console.log('🚀 Initializing GPU-optimized canvas...');
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // Initialize GPU optimizer
        gpuOptimizerRef.current = GPUOptimizer.getInstance();
        const optimizedApp = await gpuOptimizerRef.current.initializeOptimization(canvas, {
          enableComputeShaders: true,
          preferWebGL2: true,
          powerPreference: 'high-performance',
          antialias: false,
          maxTextureSize: 4096,
        });
        
        optimizedApp.renderer.backgroundColor = 0x0F172A;
        appRef.current = optimizedApp;
        containerRef.current.appendChild(canvas);
        
        console.log('✅ GPU optimization initialized successfully');
        
        // Create optimized particle container for nodes
        const particleContainer = gpuOptimizerRef.current.createOptimizedParticleContainer(
          nodeCount,
          {
            scale: true,
            position: true,
            rotation: false,
            uvs: false,
            alpha: true,
          }
        );
        
        optimizedApp.stage.addChild(particleContainer);
        
        // Generate test nodes to stress GPU
        for (let i = 0; i < nodeCount; i++) {
          const texture = gpuOptimizerRef.current.getOptimizedTexture('circle', 64);
          if (texture) {
            const sprite = new PIXI.Sprite(texture);
            sprite.x = Math.random() * width;
            sprite.y = Math.random() * height;
            sprite.tint = Math.random() * 0xFFFFFF;
            sprite.alpha = 0.7 + Math.random() * 0.3;
            sprite.anchor.set(0.5);
            particleContainer.addChild(sprite);
          } else {
            // Fallback: create simple graphics if texture not available
            const graphics = new PIXI.Graphics();
            graphics.beginFill(Math.random() * 0xFFFFFF, 0.8);
            graphics.drawCircle(0, 0, 8);
            graphics.endFill();
            graphics.x = Math.random() * width;
            graphics.y = Math.random() * height;
            particleContainer.addChild(graphics);
          }
        }
        
        // Start performance monitoring
        startPerformanceMonitoring();
        
      } catch (error) {
        console.error('Failed to initialize GPU canvas:', error);
      }
    };

    const startPerformanceMonitoring = () => {
      let frameCount = 0;
      let lastTime = performance.now();
      
      const updateMetrics = () => {
        frameCount++;
        
        if (frameCount % 60 === 0 && gpuOptimizerRef.current) {
          const currentTime = performance.now();
          const fps = 60 / ((currentTime - lastTime) / 1000);
          lastTime = currentTime;
          
          const metrics = gpuOptimizerRef.current.getPerformanceMetrics();
          
          setGPUMetrics({
            fps: Math.round(fps),
            drawCalls: metrics.drawCalls || 0,
            texturePoolSize: metrics.resources?.texturePoolSize || 0,
            shaderCacheSize: metrics.resources?.shaderCacheSize || 0,
            contextType: metrics.capabilities?.contextType || 'unknown'
          });
        }
        
        requestAnimationFrame(updateMetrics);
      };
      
      updateMetrics();
    };

    initializeGPUCanvas();

    return () => {
      if (gpuOptimizerRef.current) {
        gpuOptimizerRef.current.destroy();
      }
      if (appRef.current) {
        appRef.current.destroy(true);
      }
    };
  }, [width, height, nodeCount]);

  return (
    <div className="relative">
      <div 
        ref={containerRef} 
        className="border border-gray-300 rounded"
        style={{ width, height }}
      />
      
      {/* GPU Performance Metrics */}
      <div className="absolute top-4 right-4 bg-black/70 text-white p-3 rounded text-sm font-mono">
        <div className="text-green-400 font-bold mb-2">GPU Optimization Active</div>
        <div>FPS: {gpuMetrics.fps}</div>
        <div>WebGL: {gpuMetrics.contextType}</div>
        <div>Draw Calls: {gpuMetrics.drawCalls}</div>
        <div>Textures: {gpuMetrics.texturePoolSize}</div>
        <div>Shaders: {gpuMetrics.shaderCacheSize}</div>
        <div>Nodes: {nodeCount}</div>
      </div>
      
      {/* Status indicator */}
      <div className="absolute bottom-4 left-4 flex items-center space-x-2">
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-600">GPU Optimized Rendering</span>
      </div>
    </div>
  );
};