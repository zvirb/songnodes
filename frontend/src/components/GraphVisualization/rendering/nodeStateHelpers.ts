/**
 * Node State Helper Utilities
 * Determines node rendering state based on interaction context
 */

import type { EnhancedGraphNode } from '../types';
import type { NodeState } from './TextureAtlas';

/**
 * Interaction context for determining node state
 */
export interface NodeInteractionContext {
  hoveredNodeId: string | null;
  selectedNodeIds: Set<string>;
  playingNodeId: string | null;
  pathNodeIds: Set<string>;
}

/**
 * Get the current rendering state of a node
 * Priority: playing > hovered > selected > path > default
 */
export function getNodeState(
  node: EnhancedGraphNode,
  context: NodeInteractionContext
): NodeState {
  const { hoveredNodeId, selectedNodeIds, playingNodeId, pathNodeIds } = context;

  // Playing state has highest priority
  if (playingNodeId === node.id) {
    return 'playing';
  }

  // Hovered state
  if (hoveredNodeId === node.id) {
    return 'hovered';
  }

  // Selected state
  if (selectedNodeIds.has(node.id)) {
    return 'selected';
  }

  // Path/waypoint state
  if (pathNodeIds.has(node.id)) {
    // Determine if waypoint (intermediate) or path (start/end)
    return node.isInPath ? 'waypoint' : 'path';
  }

  // Default state
  return 'default';
}

/**
 * Get the tint color for a node based on state
 * Tint is applied on top of the base texture
 */
export function getNodeTint(node: EnhancedGraphNode, state: NodeState): number {
  // Use node's community color if available
  if (node.color) {
    return node.color;
  }

  // Default tint based on state
  switch (state) {
    case 'playing':
      return 0xff1744; // Bright red
    case 'hovered':
      return 0x7ed321; // Green
    case 'selected':
      return 0xff6b35; // Orange
    case 'path':
      return 0x9013fe; // Purple
    case 'waypoint':
      return 0xf5a623; // Amber
    case 'default':
    default:
      return 0x4a90e2; // Blue
  }
}

/**
 * Calculate node size multiplier based on various factors
 * @param node - The node
 * @param baseSize - Base size in pixels
 * @param state - Current node state
 * @param zoom - Current zoom level
 * @returns Size multiplier
 */
export function getNodeSizeMultiplier(
  node: EnhancedGraphNode,
  state: NodeState,
  zoom: number
): number {
  let multiplier = 1.0;

  // Increase size for important nodes
  if (state === 'playing') {
    multiplier *= 1.3;
  } else if (state === 'hovered') {
    multiplier *= 1.15;
  } else if (state === 'selected') {
    multiplier *= 1.1;
  }

  // Scale based on node degree (importance)
  if (node.degree) {
    const degreeMultiplier = 1 + Math.min(0.5, node.degree / 50);
    multiplier *= degreeMultiplier;
  }

  return multiplier;
}

/**
 * Check if node should pulse (animated)
 */
export function shouldNodePulse(state: NodeState): boolean {
  return state === 'playing' || state === 'hovered';
}

/**
 * Get pulse animation parameters
 * @param time - Current time in ms
 * @returns Pulse scale multiplier
 */
export function getPulseMultiplier(time: number): number {
  const pulseSpeed = 0.002; // Oscillations per ms
  const pulseAmount = 0.1; // 10% size variation
  return 1 + Math.sin(time * pulseSpeed) * pulseAmount;
}
