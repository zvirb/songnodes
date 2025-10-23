/**
 * Node Renderer for High-Performance Graph Visualization
 * Renders 10,000+ nodes efficiently using PIXI.js ParticleContainer
 * Integrates with LODManager, TextureAtlas, and FrustumCuller
 *
 * Performance Targets:
 * - 10,000 nodes @ 60 FPS
 * - 60-75% viewport culling
 * - < 150MB memory for 10,000 nodes
 * - Smooth LOD transitions (300ms)
 */

import * as PIXI from 'pixi.js';
import type { Application, Container, ParticleContainer, Sprite, Text, Graphics } from 'pixi.js';
import type { EnhancedGraphNode, LODLevel, Viewport } from '../types';
import { TextureAtlas, NodeState } from './TextureAtlas';
import { LODManager } from './LODManager';
import { FrustumCuller } from '../spatial/FrustumCuller';
import { getNodeState, getNodeTint } from './nodeStateHelpers';

/**
 * Node sprite with metadata
 */
interface NodeSpriteData {
  sprite: PIXI.Sprite;
  label?: PIXI.Text;
  glow?: PIXI.Sprite;
  lastLOD: LODLevel;
  lastState: NodeState;
}

/**
 * Render statistics
 */
export interface NodeRenderStats {
  totalNodes: number;
  visibleNodes: number;
  culledNodes: number;
  lod0Nodes: number;
  lod1Nodes: number;
  lod2Nodes: number;
  labelsRendered: number;
  memoryUsageMB: number;
}

/**
 * Node Renderer Configuration
 */
export interface NodeRendererConfig {
  baseNodeSize: number;
  enableGlow: boolean;
  enableLabels: boolean;
  labelFontSize: number;
  labelFontFamily: string;
  labelOffset: number;
  transitionDuration: number;
  particleContainerSize: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: NodeRendererConfig = {
  baseNodeSize: 16,
  enableGlow: true,
  enableLabels: true,
  labelFontSize: 12,
  labelFontFamily: 'var(--font-sans, Arial, sans-serif)',
  labelOffset: 20,
  transitionDuration: 300,
  particleContainerSize: 15000,
};

/**
 * Node Renderer
 * Manages rendering of all graph nodes with LOD and culling
 */
export class NodeRenderer {
  private app: Application;
  private container: PIXI.Container;
  private particleContainer: PIXI.ParticleContainer;
  private labelContainer: PIXI.Container;
  private glowContainer: PIXI.Container;

  private textureAtlas: TextureAtlas;
  private lodManager: LODManager;
  private frustumCuller: FrustumCuller;

  private nodeSprites: Map<string, NodeSpriteData> = new Map();
  private config: NodeRendererConfig;

  // Interaction state
  private hoveredNodeId: string | null = null;
  private selectedNodeIds: Set<string> = new Set();
  private playingNodeId: string | null = null;
  private pathNodeIds: Set<string> = new Set();

  /**
   * Create a new NodeRenderer
   */
  constructor(
    app: Application,
    textureAtlas: TextureAtlas,
    lodManager: LODManager,
    frustumCuller: FrustumCuller,
    config: Partial<NodeRendererConfig> = {}
  ) {
    this.app = app;
    this.textureAtlas = textureAtlas;
    this.lodManager = lodManager;
    this.frustumCuller = frustumCuller;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create containers
    this.container = new PIXI.Container();
    this.container.name = 'NodeRendererContainer';

    // Glow layer (behind nodes)
    this.glowContainer = new PIXI.Container();
    this.glowContainer.name = 'NodeGlowLayer';
    this.container.addChild(this.glowContainer);

    // Particle container for nodes (optimal for massive node counts)
    this.particleContainer = new PIXI.ParticleContainer(
      this.config.particleContainerSize,
      {
        vertices: false,
        position: true,
        rotation: false,
        uvs: false,
        tint: true,
      }
    );
    this.particleContainer.name = 'NodeParticleContainer';
    this.container.addChild(this.particleContainer);

    // Label layer (on top of nodes)
    this.labelContainer = new PIXI.Container();
    this.labelContainer.name = 'NodeLabelLayer';
    this.container.addChild(this.labelContainer);

    // Add to stage
    this.app.stage.addChild(this.container);
  }

  /**
   * Initialize nodes (create sprites for all nodes)
   * @param nodes - Array of graph nodes
   */
  initialize(nodes: EnhancedGraphNode[]): void {
    // Clear existing sprites
    this.clear();

    // Create sprite for each node
    for (const node of nodes) {
      this.createNodeSprite(node);
    }

    console.log(`[NodeRenderer] Initialized ${nodes.length} nodes`);
  }

  /**
   * Create a sprite for a node
   */
  private createNodeSprite(node: EnhancedGraphNode): void {
    if (!node.x || !node.y) {
      console.warn(`[NodeRenderer] Node ${node.id} missing position`);
      return;
    }

    // Determine node state and texture
    const state = getNodeState(node, {
      hoveredNodeId: this.hoveredNodeId,
      selectedNodeIds: this.selectedNodeIds,
      playingNodeId: this.playingNodeId,
      pathNodeIds: this.pathNodeIds,
    });

    const lod = this.lodManager.getNodeLOD(node);
    const radius = this.config.baseNodeSize / 2;
    const texture = this.textureAtlas.generateNodeTexture(radius, state);

    // Create sprite
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.x = node.x;
    sprite.y = node.y;
    sprite.tint = getNodeTint(node, state);

    // Enable interaction
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    // Store sprite data
    const spriteData: NodeSpriteData = {
      sprite,
      lastLOD: lod,
      lastState: state,
    };

    this.nodeSprites.set(node.id, spriteData);
    this.particleContainer.addChild(sprite);

    // Update node reference
    node.pixiCircle = sprite;
    node.lodLevel = lod;
    node.isVisible = true;
  }

  /**
   * Get or create sprite for a node
   */
  private getOrCreateSprite(node: EnhancedGraphNode): NodeSpriteData {
    let spriteData = this.nodeSprites.get(node.id);

    if (!spriteData) {
      this.createNodeSprite(node);
      spriteData = this.nodeSprites.get(node.id)!;
    }

    return spriteData;
  }

  /**
   * Main render method
   * @param nodes - All graph nodes
   * @param viewport - Current viewport state
   */
  render(nodes: EnhancedGraphNode[], viewport: Viewport): void {
    // Update frustum culler viewport
    this.frustumCuller.updateViewport(viewport);

    // Update LOD manager counts
    this.lodManager.updateCounts(nodes.length, 0);

    // Get visible nodes (culled by viewport)
    const visibleNodes = this.frustumCuller.queryVisibleNodes();

    // Clear label container
    this.labelContainer.removeChildren();
    this.glowContainer.removeChildren();

    // Render each visible node
    for (const node of visibleNodes) {
      this.renderNode(node, viewport.zoom);
    }

    // Hide culled nodes
    this.cullInvisibleNodes(nodes, visibleNodes);
  }

  /**
   * Render a single node
   */
  private renderNode(node: EnhancedGraphNode, zoom: number): void {
    if (!node.x || !node.y) return;

    const spriteData = this.getOrCreateSprite(node);
    const { sprite } = spriteData;

    // Calculate LOD
    const lod = this.lodManager.getNodeLOD(node);
    node.lodLevel = lod;

    // Skip if culled
    if (lod === 3) {
      sprite.visible = false;
      node.isVisible = false;
      return;
    }

    // Determine node state
    const state = getNodeState(node, {
      hoveredNodeId: this.hoveredNodeId,
      selectedNodeIds: this.selectedNodeIds,
      playingNodeId: this.playingNodeId,
      pathNodeIds: this.pathNodeIds,
    });

    // Update position
    sprite.x = node.x;
    sprite.y = node.y;

    // Update texture if state changed
    if (state !== spriteData.lastState || lod !== spriteData.lastLOD) {
      const radius = this.config.baseNodeSize / 2;
      const newTexture = this.textureAtlas.generateNodeTexture(radius, state);
      sprite.texture = newTexture;
      spriteData.lastState = state;
      spriteData.lastLOD = lod;
    }

    // Update tint
    sprite.tint = getNodeTint(node, state);

    // Update size based on LOD
    const sizeMultiplier = this.lodManager.getNodeSizeMultiplier(lod);
    const screenSize = this.config.baseNodeSize * zoom * sizeMultiplier;
    sprite.scale.set(screenSize / this.config.baseNodeSize);

    // Make visible
    sprite.visible = true;
    node.isVisible = true;

    // Render glow for hovered/playing nodes
    if (this.config.enableGlow && (state === 'hovered' || state === 'playing')) {
      this.renderGlow(node, state, zoom);
    }

    // Render label if LOD allows
    if (this.config.enableLabels && this.lodManager.shouldRenderLabel(lod)) {
      this.renderLabel(node, lod, zoom);
    }
  }

  /**
   * Render glow effect for a node
   */
  private renderGlow(node: EnhancedGraphNode, state: NodeState, zoom: number): void {
    if (!node.x || !node.y) return;

    const glowRadius = (this.config.baseNodeSize / 2) + 8;
    const glowTexture = this.textureAtlas.generateNodeTexture(glowRadius, state);

    const glow = new PIXI.Sprite(glowTexture);
    glow.anchor.set(0.5);
    glow.x = node.x;
    glow.y = node.y;
    glow.alpha = state === 'playing' ? 0.8 : 0.5;
    glow.blendMode = PIXI.BLEND_MODES.ADD;

    const glowScale = (glowRadius * 2 * zoom) / this.config.baseNodeSize;
    glow.scale.set(glowScale);

    this.glowContainer.addChild(glow);
  }

  /**
   * Render label for a node
   */
  private renderLabel(node: EnhancedGraphNode, lod: LODLevel, zoom: number): void {
    if (!node.x || !node.y) return;

    // Determine label text
    const labelText = node.track?.artist_name || 'Unknown';

    // Create label
    const fontSize = lod === 0 ? this.config.labelFontSize : this.config.labelFontSize - 2;
    const label = new PIXI.Text(labelText, {
      fontFamily: this.config.labelFontFamily,
      fontSize: fontSize * zoom,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2 * zoom,
      align: 'center',
    });

    label.anchor.set(0.5);
    label.x = node.x;
    label.y = node.y + this.config.labelOffset * zoom;
    label.alpha = this.lodManager.getLabelAlpha(lod);

    this.labelContainer.addChild(label);
    node.pixiLabel = label;
  }

  /**
   * Hide nodes that are outside viewport
   */
  private cullInvisibleNodes(allNodes: EnhancedGraphNode[], visibleNodes: EnhancedGraphNode[]): void {
    const visibleIds = new Set(visibleNodes.map(n => n.id));

    for (const node of allNodes) {
      if (!visibleIds.has(node.id)) {
        const spriteData = this.nodeSprites.get(node.id);
        if (spriteData) {
          spriteData.sprite.visible = false;
          node.isVisible = false;
        }
      }
    }
  }

  /**
   * Update interaction state
   */
  setHoveredNode(nodeId: string | null): void {
    this.hoveredNodeId = nodeId;
  }

  setSelectedNodes(nodeIds: Set<string>): void {
    this.selectedNodeIds = nodeIds;
  }

  setPlayingNode(nodeId: string | null): void {
    this.playingNodeId = nodeId;
  }

  setPathNodes(nodeIds: Set<string>): void {
    this.pathNodeIds = nodeIds;
  }

  /**
   * Get render statistics
   */
  getStats(): NodeRenderStats {
    let visibleNodes = 0;
    let lod0 = 0;
    let lod1 = 0;
    let lod2 = 0;

    this.nodeSprites.forEach((spriteData) => {
      if (spriteData.sprite.visible) {
        visibleNodes++;

        switch (spriteData.lastLOD) {
          case 0: lod0++; break;
          case 1: lod1++; break;
          case 2: lod2++; break;
        }
      }
    });

    return {
      totalNodes: this.nodeSprites.size,
      visibleNodes,
      culledNodes: this.nodeSprites.size - visibleNodes,
      lod0Nodes: lod0,
      lod1Nodes: lod1,
      lod2Nodes: lod2,
      labelsRendered: this.labelContainer.children.length,
      memoryUsageMB: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate memory usage in MB
   */
  private estimateMemoryUsage(): number {
    // Rough estimate:
    // - Sprite: ~200 bytes
    // - Texture reference: ~50 bytes
    // - Label: ~300 bytes (if rendered)

    const spriteMemory = this.nodeSprites.size * 250;
    const labelMemory = this.labelContainer.children.length * 300;
    const textureMemory = this.textureAtlas.getMemoryUsage() * 1024 * 1024; // Convert back to bytes

    const totalBytes = spriteMemory + labelMemory + textureMemory;
    return totalBytes / (1024 * 1024); // Convert to MB
  }

  /**
   * Get node at screen position (for hit testing)
   * @param screenX - Screen X coordinate
   * @param screenY - Screen Y coordinate
   * @returns Node at position or null
   */
  getNodeAtPosition(screenX: number, screenY: number): EnhancedGraphNode | null {
    const worldPos = this.frustumCuller.screenToWorld(screenX, screenY);
    const hitRadius = this.config.baseNodeSize; // Hit radius in world units

    return this.frustumCuller.findNearestNode(worldPos.x, worldPos.y, hitRadius);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NodeRendererConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    this.particleContainer.removeChildren();
    this.labelContainer.removeChildren();
    this.glowContainer.removeChildren();
    this.nodeSprites.clear();
  }

  /**
   * Cleanup and destroy renderer
   */
  cleanup(): void {
    console.log('[NodeRenderer] Cleaning up...');

    // Remove all children
    this.particleContainer.removeChildren();
    this.labelContainer.removeChildren();
    this.glowContainer.removeChildren();

    // Destroy containers
    this.particleContainer.destroy({ children: true });
    this.labelContainer.destroy({ children: true });
    this.glowContainer.destroy({ children: true });
    this.container.destroy({ children: true });

    // Clear maps
    this.nodeSprites.clear();
    this.selectedNodeIds.clear();
    this.pathNodeIds.clear();

    console.log('[NodeRenderer] Cleanup complete');
  }
}
