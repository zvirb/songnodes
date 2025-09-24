import React, { useRef, useEffect, useState } from 'react';
import { clusterNodes } from '../../utils/cluster';
import * as PIXI from 'pixi.js';

interface PixiCanvasProps {
  width: number;
  height: number;
  nodes: any[];
  edges: any[];
}

export const PixiCanvas: React.FC<PixiCanvasProps> = ({ width, height, nodes, edges }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const [usePixi, setUsePixi] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Canvas 2D fallback rendering
  useEffect(() => {
    if (!usePixi && canvas2dRef.current && nodes.length > 0) {
      const ctx = canvas2dRef.current.getContext('2d');
      if (!ctx) return;

      console.log('🎨 Rendering with Canvas 2D fallback');

      // Clear canvas
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);

      // Draw edges
      ctx.strokeStyle = 'rgba(153, 153, 153, 0.3)';
      ctx.lineWidth = 0.5;
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (source && target && source.x && source.y && target.x && target.y) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        if (node.x && node.y) {
          // Node circle
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
          ctx.fill();

          // Node label
          if (node.title) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(node.title.substring(0, 20), node.x, node.y - 8);
          }
        }
      });

      console.log(`✅ Canvas 2D rendered: ${nodes.length} nodes, ${edges.length} edges`);
    }
  }, [usePixi, nodes, edges, width, height]);

  // PIXI rendering
  useEffect(() => {
    if (!canvasRef.current || !usePixi) return;

    let app: PIXI.Application | null = null;
    let cleanedUp = false;

    try {
      console.log('🎮 Attempting to initialize PIXI.js...');

      // Try to create PIXI application with fallback options
      try {
        app = new PIXI.Application({
          width,
          height,
          backgroundColor: 0x0F172A,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true
        });
      } catch (webglError) {
        console.warn('WebGL failed, trying Canvas fallback...');
        app = new PIXI.Application({
          width,
          height,
          backgroundColor: 0x0F172A,
          forceCanvas: true
        });
      }

      appRef.current = app;
      canvasRef.current.appendChild(app.view as unknown as Node);
      console.log('✅ PIXI.js initialized successfully');

      const container = new PIXI.Container();
      app.stage.addChild(container);

      const graphics = new PIXI.Graphics();
      container.addChild(graphics);

      const draw = () => {
        if (cleanedUp) return;

        graphics.clear();

        const zoom = app.stage.scale.x;
        const clusteredNodes = clusterNodes(nodes, zoom);

        const screenWidth = app.renderer.width / zoom;
        const screenHeight = app.renderer.height / zoom;
        const screenX = -app.stage.x / zoom;
        const screenY = -app.stage.y / zoom;

        const visibleNodes = clusteredNodes.filter(node => {
          return node.x > screenX - 50 && node.x < screenX + screenWidth + 50 &&
                 node.y > screenY - 50 && node.y < screenY + screenHeight + 50;
        });

        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
        const visibleEdges = edges.filter(edge =>
          visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
        );

        // Draw edges
        visibleEdges.forEach(edge => {
          const source = visibleNodes.find(n => n.id === edge.source);
          const target = visibleNodes.find(n => n.id === edge.target);
          if (source && target) {
            const lineWidth = zoom > 0.5 ? 1 : 0.5;
            graphics.lineStyle(lineWidth, 0x999999, 0.5);
            graphics.moveTo(source.x, source.y);
            graphics.lineTo(target.x, target.y);
          }
        });

        // Draw nodes
        visibleNodes.forEach(node => {
          if (node.isCluster) {
            const clusterRadius = 5 + Math.sqrt(node.size) * 2;
            graphics.beginFill(0x00ff00, 0.5);
            graphics.drawCircle(node.x, node.y, clusterRadius);
            graphics.endFill();
          } else {
            const nodeRadius = 5;
            graphics.beginFill(0x00ff00, 1);
            graphics.drawCircle(node.x, node.y, nodeRadius);
            graphics.endFill();
          }
        });
      };

      app.ticker.add(draw);

      return () => {
        cleanedUp = true;
        if (app && !app.destroyed) {
          try {
            app.ticker.remove(draw);
            app.destroy(true, { children: true, texture: true, baseTexture: true });
          } catch (e) {
            console.error('Error destroying PIXI app:', e);
          }
        }
        appRef.current = null;
      };

    } catch (err) {
      console.error('❌ PIXI.js initialization failed:', err);
      setError(err instanceof Error ? err.message : 'PIXI initialization failed');
      setUsePixi(false);

      if (app && !app.destroyed) {
        try {
          app.destroy(true);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }, [width, height, nodes, edges, usePixi]);

  // Handle resize for PIXI
  useEffect(() => {
    if (appRef.current && !appRef.current.destroyed) {
      try {
        appRef.current.renderer.resize(width, height);
      } catch (e) {
        console.error('Error resizing PIXI renderer:', e);
      }
    }
  }, [width, height]);

  // Use Canvas 2D fallback if PIXI fails
  if (!usePixi) {
    return (
      <div style={{ position: 'relative', width, height }}>
        <canvas
          ref={canvas2dRef}
          width={width}
          height={height}
          style={{ display: 'block', background: '#0F172A' }}
        />
        {error && (
          <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            color: '#fbbf24',
            fontSize: '12px',
            background: 'rgba(0,0,0,0.8)',
            padding: '5px 10px',
            borderRadius: '3px',
            border: '1px solid #fbbf24'
          }}>
            ⚠️ Using Canvas 2D fallback
          </div>
        )}
      </div>
    );
  }

  return <div ref={canvasRef} style={{ width, height }} />;
};