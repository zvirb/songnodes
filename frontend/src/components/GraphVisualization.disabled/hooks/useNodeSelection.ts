/**
 * useNodeSelection Hook
 * Manages multi-select, keyboard navigation, and focus state for graph nodes
 *
 * Features:
 * - Single-select (click)
 * - Multi-select (Ctrl+click, Shift+click range)
 * - Select all (Ctrl+A)
 * - Clear selection (Escape)
 * - Keyboard navigation (arrow keys)
 * - Focus management for accessibility
 * - Selection change events
 * - Max selection limit support
 *
 * Keyboard Shortcuts:
 * - Click: Single select
 * - Ctrl+Click: Toggle selection
 * - Shift+Click: Range select
 * - Ctrl+A: Select all
 * - Escape: Clear selection
 * - Arrow keys: Navigate between nodes
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { EnhancedGraphNode } from '../types';

/* ============================================
   TYPES
   ============================================ */

/**
 * Selection mode
 */
export type SelectionMode = 'single' | 'toggle' | 'range';

/**
 * Hook options
 */
export interface UseNodeSelectionOptions {
  /** Array of all graph nodes */
  nodes: EnhancedGraphNode[];

  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: Set<string>) => void;

  /** Callback when focused node changes */
  onFocusChange?: (focusedId: string | null) => void;

  /** Maximum number of nodes that can be selected (0 = unlimited) */
  maxSelection?: number;

  /** Enable keyboard navigation */
  enableKeyboard?: boolean;

  /** Initial selected node IDs */
  initialSelection?: Set<string>;

  /** Initial focused node ID */
  initialFocus?: string | null;
}

/**
 * Hook return value
 */
export interface UseNodeSelectionReturn {
  /** Set of selected node IDs */
  selectedIds: Set<string>;

  /** Currently focused node ID (for keyboard navigation) */
  focusedId: string | null;

  /** Select a node with specified mode */
  selectNode: (nodeId: string, mode?: SelectionMode) => void;

  /** Select multiple nodes at once */
  selectNodes: (nodeIds: string[]) => void;

  /** Deselect a node */
  deselectNode: (nodeId: string) => void;

  /** Select all nodes */
  selectAll: () => void;

  /** Clear all selections */
  clearSelection: () => void;

  /** Toggle selection of a node */
  toggleNode: (nodeId: string) => void;

  /** Check if a node is selected */
  isSelected: (nodeId: string) => boolean;

  /** Check if a node is focused */
  isFocused: (nodeId: string) => boolean;

  /** Set focused node */
  setFocusedNode: (nodeId: string | null) => void;

  /** Navigate to next node (keyboard navigation) */
  focusNext: () => void;

  /** Navigate to previous node (keyboard navigation) */
  focusPrevious: () => void;

  /** Navigate to adjacent node in direction */
  focusDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;

  /** Get array of selected nodes */
  getSelectedNodes: () => EnhancedGraphNode[];
}

/* ============================================
   CONSTANTS
   ============================================ */

const DEFAULT_OPTIONS: Partial<UseNodeSelectionOptions> = {
  maxSelection: 0, // Unlimited
  enableKeyboard: true,
};

/* ============================================
   HELPER FUNCTIONS
   ============================================ */

/**
 * Find nearest node in a given direction
 * @param fromNode - Starting node
 * @param nodes - All nodes
 * @param direction - Direction to search
 * @returns Nearest node in that direction or null
 */
function findNodeInDirection(
  fromNode: EnhancedGraphNode,
  nodes: EnhancedGraphNode[],
  direction: 'up' | 'down' | 'left' | 'right'
): EnhancedGraphNode | null {
  if (!fromNode.x || !fromNode.y) return null;

  let bestNode: EnhancedGraphNode | null = null;
  let bestDistance = Infinity;

  for (const node of nodes) {
    if (node.id === fromNode.id || !node.x || !node.y) continue;

    const dx = node.x - fromNode.x;
    const dy = node.y - fromNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if node is in the correct direction
    let isCorrectDirection = false;

    switch (direction) {
      case 'up':
        isCorrectDirection = dy < 0 && Math.abs(dy) > Math.abs(dx) * 0.5;
        break;
      case 'down':
        isCorrectDirection = dy > 0 && Math.abs(dy) > Math.abs(dx) * 0.5;
        break;
      case 'left':
        isCorrectDirection = dx < 0 && Math.abs(dx) > Math.abs(dy) * 0.5;
        break;
      case 'right':
        isCorrectDirection = dx > 0 && Math.abs(dx) > Math.abs(dy) * 0.5;
        break;
    }

    if (isCorrectDirection && distance < bestDistance) {
      bestNode = node;
      bestDistance = distance;
    }
  }

  return bestNode;
}

/* ============================================
   MAIN HOOK
   ============================================ */

/**
 * Custom hook for managing node selection and focus
 * @param options - Hook options
 * @returns Selection state and control functions
 */
export function useNodeSelection(options: UseNodeSelectionOptions): UseNodeSelectionReturn {
  const {
    nodes,
    onSelectionChange,
    onFocusChange,
    maxSelection = 0,
    enableKeyboard = true,
    initialSelection = new Set(),
    initialFocus = null,
  } = { ...DEFAULT_OPTIONS, ...options };

  // State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelection);
  const [focusedId, setFocusedId] = useState<string | null>(initialFocus);

  // Refs
  const lastClickedRef = useRef<string | null>(null);
  const nodesRef = useRef<EnhancedGraphNode[]>(nodes);

  // Update nodes ref when nodes change
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  /**
   * Notify selection change
   */
  useEffect(() => {
    onSelectionChange?.(selectedIds);
  }, [selectedIds, onSelectionChange]);

  /**
   * Notify focus change
   */
  useEffect(() => {
    onFocusChange?.(focusedId);
  }, [focusedId, onFocusChange]);

  /* ============================================
     SELECTION FUNCTIONS
     ============================================ */

  /**
   * Select a node
   */
  const selectNode = useCallback(
    (nodeId: string, mode: SelectionMode = 'single') => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (mode === 'single') {
          // Single select: clear all and select this one
          next.clear();
          next.add(nodeId);
          lastClickedRef.current = nodeId;
        } else if (mode === 'toggle') {
          // Toggle: add or remove
          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            // Check max selection limit
            if (maxSelection > 0 && next.size >= maxSelection) {
              console.warn(
                `[useNodeSelection] Max selection limit reached: ${maxSelection}`
              );
              return prev; // Return unchanged
            }
            next.add(nodeId);
          }
          lastClickedRef.current = nodeId;
        } else if (mode === 'range') {
          // Range select: select all nodes between last and current
          if (lastClickedRef.current) {
            const nodeIds = nodesRef.current.map((n) => n.id);
            const startIdx = nodeIds.indexOf(lastClickedRef.current);
            const endIdx = nodeIds.indexOf(nodeId);

            if (startIdx !== -1 && endIdx !== -1) {
              const [start, end] =
                startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

              for (let i = start; i <= end; i++) {
                // Check max selection limit
                if (maxSelection > 0 && next.size >= maxSelection) {
                  break;
                }
                next.add(nodeIds[i]);
              }
            }
          } else {
            // No last clicked, just select this one
            next.clear();
            next.add(nodeId);
          }

          lastClickedRef.current = nodeId;
        }

        return next;
      });
    },
    [maxSelection]
  );

  /**
   * Select multiple nodes at once
   */
  const selectNodes = useCallback(
    (nodeIds: string[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        for (const nodeId of nodeIds) {
          // Check max selection limit
          if (maxSelection > 0 && next.size >= maxSelection) {
            break;
          }
          next.add(nodeId);
        }

        return next;
      });
    },
    [maxSelection]
  );

  /**
   * Deselect a node
   */
  const deselectNode = useCallback((nodeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  /**
   * Select all nodes
   */
  const selectAll = useCallback(() => {
    const allIds = nodesRef.current.map((n) => n.id);

    // Apply max selection limit if set
    const idsToSelect = maxSelection > 0 ? allIds.slice(0, maxSelection) : allIds;

    setSelectedIds(new Set(idsToSelect));
  }, [maxSelection]);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setFocusedId(null);
    lastClickedRef.current = null;
  }, []);

  /**
   * Toggle selection of a node
   */
  const toggleNode = useCallback(
    (nodeId: string) => {
      selectNode(nodeId, 'toggle');
    },
    [selectNode]
  );

  /**
   * Check if a node is selected
   */
  const isSelected = useCallback(
    (nodeId: string): boolean => {
      return selectedIds.has(nodeId);
    },
    [selectedIds]
  );

  /**
   * Check if a node is focused
   */
  const isFocused = useCallback(
    (nodeId: string): boolean => {
      return focusedId === nodeId;
    },
    [focusedId]
  );

  /**
   * Set focused node
   */
  const setFocusedNode = useCallback((nodeId: string | null) => {
    setFocusedId(nodeId);
  }, []);

  /* ============================================
     KEYBOARD NAVIGATION
     ============================================ */

  /**
   * Focus next node
   */
  const focusNext = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    const currentIndex = focusedId
      ? nodes.findIndex((n) => n.id === focusedId)
      : -1;

    const nextIndex = (currentIndex + 1) % nodes.length;
    setFocusedId(nodes[nextIndex].id);
  }, [focusedId]);

  /**
   * Focus previous node
   */
  const focusPrevious = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    const currentIndex = focusedId
      ? nodes.findIndex((n) => n.id === focusedId)
      : -1;

    const prevIndex = currentIndex <= 0 ? nodes.length - 1 : currentIndex - 1;
    setFocusedId(nodes[prevIndex].id);
  }, [focusedId]);

  /**
   * Focus node in direction (spatial navigation)
   */
  const focusDirection = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      const nodes = nodesRef.current;
      if (nodes.length === 0) return;

      let fromNode: EnhancedGraphNode | null = null;

      if (focusedId) {
        fromNode = nodes.find((n) => n.id === focusedId) || null;
      } else {
        // No focused node, start from first node
        fromNode = nodes[0];
      }

      if (!fromNode) return;

      const nextNode = findNodeInDirection(fromNode, nodes, direction);

      if (nextNode) {
        setFocusedId(nextNode.id);
      }
    },
    [focusedId]
  );

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enableKeyboard) return;

      // Escape: Clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
      }
      // Ctrl+A: Select all
      else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
      // Arrow keys: Navigate
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusDirection('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusDirection('down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        focusDirection('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        focusDirection('right');
      }
      // Tab: Next node
      else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          focusPrevious();
        } else {
          focusNext();
        }
      }
      // Enter/Space: Select focused node
      else if (
        (e.key === 'Enter' || e.key === ' ') &&
        focusedId
      ) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Enter: Toggle selection
          toggleNode(focusedId);
        } else if (e.shiftKey && lastClickedRef.current) {
          // Shift+Enter: Range select
          selectNode(focusedId, 'range');
        } else {
          // Enter: Single select
          selectNode(focusedId, 'single');
        }
      }
      // Delete/Backspace: Deselect focused node
      else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        focusedId &&
        selectedIds.has(focusedId)
      ) {
        e.preventDefault();
        deselectNode(focusedId);
      }
    },
    [
      enableKeyboard,
      clearSelection,
      selectAll,
      focusDirection,
      focusNext,
      focusPrevious,
      focusedId,
      toggleNode,
      selectNode,
      selectedIds,
      deselectNode,
    ]
  );

  /**
   * Attach keyboard event listener
   */
  useEffect(() => {
    if (!enableKeyboard) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableKeyboard, handleKeyDown]);

  /**
   * Get array of selected nodes
   */
  const getSelectedNodes = useCallback((): EnhancedGraphNode[] => {
    return nodesRef.current.filter((node) => selectedIds.has(node.id));
  }, [selectedIds]);

  return {
    selectedIds,
    focusedId,
    selectNode,
    selectNodes,
    deselectNode,
    selectAll,
    clearSelection,
    toggleNode,
    isSelected,
    isFocused,
    setFocusedNode,
    focusNext,
    focusPrevious,
    focusDirection,
    getSelectedNodes,
  };
}
