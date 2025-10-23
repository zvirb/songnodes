/**
 * Texture Atlas Generator for Node States
 * Pre-generates textures for different node states to improve rendering performance
 * Reduces draw calls and GPU state changes
 */

import * as PIXI from 'pixi.js';
import type { TextureEntry } from '../types';

/**
 * Node state types for texture generation
 */
export type NodeState = 'default' | 'selected' | 'hovered' | 'playing' | 'path' | 'waypoint';

/**
 * Texture Atlas Manager
 */
export class TextureAtlas {
  private textures: Map<string, PIXI.Texture> = new Map();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  /**
   * Color schemes for different node states
   */
  private colors = {
    default: 0x4a90e2,
    selected: 0xff6b35,
    hovered: 0x7ed321,
    playing: 0xff1744,
    path: 0x9013fe,
    waypoint: 0xf5a623,
  };

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Generate a node texture
   * @param radius - Node radius in pixels
   * @param state - Node state
   * @param color - Custom color (optional, overrides state color)
   * @returns PIXI Texture
   */
  generateNodeTexture(
    radius: number,
    state: NodeState = 'default',
    color?: number
  ): PIXI.Texture {
    // Round radius for better cache hits
    const roundedRadius = Math.round(radius);
    const finalColor = color ?? this.colors[state];
    const key = `node_${roundedRadius}_${state}_${finalColor}`;

    // Return cached texture if exists
    if (this.textures.has(key)) {
      return this.textures.get(key)!;
    }

    // Create texture
    const texture = this.createNodeTexture(roundedRadius, finalColor, state);
    this.textures.set(key, texture);

    return texture;
  }

  /**
   * Create a node texture from scratch
   */
  private createNodeTexture(
    radius: number,
    color: number,
    state: NodeState
  ): PIXI.Texture {
    // Calculate canvas size (with padding for glow/outline)
    const padding = state === 'selected' || state === 'hovered' ? 6 : 2;
    const size = Math.ceil((radius + padding) * 2 + 4);

    // Create temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d')!;

    const centerX = size / 2;
    const centerY = size / 2;

    // Draw glow for hovered/playing states
    if (state === 'hovered' || state === 'playing') {
      this.drawGlow(tempCtx, centerX, centerY, radius, color);
    }

    // Draw selection ring for selected state
    if (state === 'selected') {
      this.drawSelectionRing(tempCtx, centerX, centerY, radius);
    }

    // Draw main circle
    this.drawCircle(tempCtx, centerX, centerY, radius, color);

    // Draw inner highlight for depth
    this.drawInnerHighlight(tempCtx, centerX, centerY, radius);

    // Add special indicators for waypoint/path states
    if (state === 'waypoint') {
      this.drawWaypointIndicator(tempCtx, centerX, centerY, radius);
    } else if (state === 'path') {
      this.drawPathIndicator(tempCtx, centerX, centerY, radius);
    }

    // Create PIXI texture
    const texture = PIXI.Texture.from(tempCanvas);

    return texture;
  }

  /**
   * Draw a glow effect around the node
   */
  private drawGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: number
  ): void {
    const glowRadius = radius + 4;
    const gradient = ctx.createRadialGradient(x, y, radius * 0.8, x, y, glowRadius);

    const colorHex = `#${color.toString(16).padStart(6, '0')}`;
    gradient.addColorStop(0, `${colorHex}00`); // Transparent at center
    gradient.addColorStop(0.5, `${colorHex}40`); // 25% opacity mid
    gradient.addColorStop(1, `${colorHex}00`); // Transparent at edge

    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  /**
   * Draw selection ring around node
   */
  private drawSelectionRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Draw main circle
   */
  private drawCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: number
  ): void {
    const colorHex = `#${color.toString(16).padStart(6, '0')}`;

    // Create gradient for depth
    const gradient = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3,
      0,
      x,
      y,
      radius
    );
    gradient.addColorStop(0, this.lightenColor(colorHex, 20));
    gradient.addColorStop(1, colorHex);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  /**
   * Draw inner highlight for 3D effect
   */
  private drawInnerHighlight(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    const highlightRadius = radius * 0.4;
    const highlightX = x - radius * 0.25;
    const highlightY = y - radius * 0.25;

    const gradient = ctx.createRadialGradient(
      highlightX,
      highlightY,
      0,
      highlightX,
      highlightY,
      highlightRadius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(highlightX, highlightY, highlightRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  /**
   * Draw waypoint indicator (star shape)
   */
  private drawWaypointIndicator(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    const innerRadius = radius * 0.5;
    const outerRadius = radius * 0.3;
    const points = 4;

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /**
   * Draw path indicator (arrow shape)
   */
  private drawPathIndicator(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    const size = radius * 0.4;

    ctx.beginPath();
    ctx.moveTo(x - size, y - size * 0.5);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x - size, y + size * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /**
   * Lighten a hex color by a percentage
   */
  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + (255 * percent) / 100);
    const g = Math.min(255, ((num >> 8) & 0xff) + (255 * percent) / 100);
    const b = Math.min(255, (num & 0xff) + (255 * percent) / 100);

    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }

  /**
   * Pre-generate common textures to avoid runtime overhead
   * @param radii - Array of radii to pre-generate
   * @param states - Array of states to pre-generate (default: all)
   */
  preGenerateTextures(
    radii: number[] = [4, 6, 8, 10, 12, 16, 20, 24],
    states: NodeState[] = ['default', 'selected', 'hovered', 'playing', 'path', 'waypoint']
  ): void {
    let count = 0;

    for (const radius of radii) {
      for (const state of states) {
        this.generateNodeTexture(radius, state);
        count++;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[TextureAtlas] Pre-generated ${count} textures`);
    }
  }

  /**
   * Get a texture by key (for direct access)
   * @param key - Texture key
   * @returns Texture or undefined
   */
  getTexture(key: string): PIXI.Texture | undefined {
    return this.textures.get(key);
  }

  /**
   * Get all texture keys (for debugging)
   */
  getTextureKeys(): string[] {
    return Array.from(this.textures.keys());
  }

  /**
   * Get texture count
   */
  getTextureCount(): number {
    return this.textures.size;
  }

  /**
   * Clear a specific texture
   * @param key - Texture key to clear
   */
  clearTexture(key: string): void {
    const texture = this.textures.get(key);
    if (texture) {
      texture.destroy(true);
      this.textures.delete(key);
    }
  }

  /**
   * Clear all textures and free memory
   */
  destroy(): void {
    this.textures.forEach((texture) => {
      texture.destroy(true);
    });
    this.textures.clear();

    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
    }
  }

  /**
   * Update color scheme
   * @param state - Node state
   * @param color - New color value
   */
  updateColor(state: NodeState, color: number): void {
    this.colors[state] = color;
    // Invalidate cached textures for this state
    const keysToDelete: string[] = [];
    this.textures.forEach((_, key) => {
      if (key.includes(`_${state}_`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.clearTexture(key));
  }

  /**
   * Get memory usage estimate (in MB)
   */
  getMemoryUsage(): number {
    let totalPixels = 0;

    this.textures.forEach((texture) => {
      const width = texture.width;
      const height = texture.height;
      totalPixels += width * height;
    });

    // Estimate: 4 bytes per pixel (RGBA)
    const bytes = totalPixels * 4;
    return bytes / (1024 * 1024); // Convert to MB
  }
}
