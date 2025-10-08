import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { GraphNode, Track } from '../types';
import { findDJPath } from '../utils/pathfinding';
import { DEFAULT_CONSTRAINTS }from '../types/pathfinding';
import {
  Play, Plus, Info, Navigation, MapPin, Flag, FlagTriangleRight, RefreshCw, MousePointer2, Layers
} from 'lucide-react';

// Define more specific types for targetData
type ContextMenuTargetData = GraphNode | Track | { [key: string]: any } | undefined;

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  targetType: 'node' | 'track' | 'empty' | 'edge';
  targetData?: ContextMenuTargetData;
}

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  divider?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

/**
 * Renders a context-sensitive menu at a specific position on the screen.
 * The menu's content is dynamically generated based on the target type and data.
 *
 * @param {ContextMenuProps} props The component props.
 * @returns {React.ReactPortal} The context menu rendered via a React portal.
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, targetType, targetData }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  const { graph, pathfinding, pathfindingState, view, search, setlist } = useStore();

  // Calculate menu position, ensuring it stays within the viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;
    setPosition({
      left: x + menuRect.width > innerWidth ? innerWidth - menuRect.width - 10 : x,
      top: y + menuRect.height > innerHeight ? innerHeight - menuRect.height - 10 : y,
    });
  }, [x, y]);

  // Close menu on Escape key or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Build menu items based on the context
  const menuItems = useMemo((): MenuItem[] => {
    switch (targetType) {
      case 'node': {
        const node = targetData as GraphNode;
        return [
          { label: 'Set as Start', icon: <Flag size={16} />, action: () => pathfinding.setStartTrack(node.id) },
          { label: 'Add Waypoint', icon: <MapPin size={16} />, action: () => pathfinding.addWaypoint(node.id) },
          { label: 'Set as End', icon: <FlagTriangleRight size={16} />, action: () => pathfinding.setEndTrack(node.id) },
          { divider: true },
          { label: 'Select Node', icon: <MousePointer2 size={16} />, action: () => graph.selectNode(node.id) },
          { label: 'View Details', icon: <Info size={16} />, action: () => console.log('View details for', node.id) },
        ];
      }
      case 'empty': {
        return [
          { label: 'Reset View', icon: <Layers size={16} />, action: () => (targetData as any)?.fitToContent() },
          { label: 'Clear Selection', icon: <RefreshCw size={16} />, action: () => graph.clearSelection() },
        ];
      }
      default:
        return [{ label: 'No actions available', disabled: true }];
    }
  }, [targetType, targetData, graph, pathfinding]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[10000] min-w-[200px] bg-gray-900/80 border border-white/10 rounded-lg shadow-2xl backdrop-blur-md p-1 animate-fade-in"
      style={{ left: position.left, top: position.top }}
    >
      {menuItems.map((item, index) =>
        item.divider ? (
          <div key={index} className="h-px bg-white/10 my-1" />
        ) : (
          <button
            key={index}
            onClick={() => { item.action(); onClose(); }}
            disabled={item.disabled}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-left text-white/90 rounded hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="flex items-center gap-3">
              {item.icon || <span className="w-4" />}
              {item.label}
            </span>
            {item.shortcut && <span className="text-xs opacity-60">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>,
    document.body
  );
};

/**
 * A hook to simplify the management of the context menu's state.
 * @returns An object with the context menu state and functions to open and close it.
 */
export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetType: 'node' | 'track' | 'empty' | 'edge';
    targetData?: ContextMenuTargetData;
  } | null>(null);

  const openContextMenu = useCallback((
    e: React.MouseEvent,
    targetType: 'node' | 'track' | 'empty' | 'edge',
    targetData?: ContextMenuTargetData
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, targetType, targetData });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return { contextMenu, openContextMenu, closeContextMenu };
};