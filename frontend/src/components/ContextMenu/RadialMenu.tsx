import React, { useState, useEffect } from 'react';
import classNames from 'classnames';
import { useAppDispatch, useAppSelector } from '@store/index';
import { setStartNode, setEndNode, addWaypoint } from '@store/pathfindingSlice';
import { setSelectedNodes } from '@store/graphSlice';

interface RadialMenuItem {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  color?: string;
}

interface RadialMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  nodeId?: string;
  onClose: () => void;
}

export const RadialMenu: React.FC<RadialMenuProps> = ({
  isOpen,
  position,
  nodeId,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const { nodes } = useAppSelector(state => state.graph);
  const { startNode, endNode, waypoints } = useAppSelector(state => state.pathfinding);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  const node = nodes.find(n => n.id === nodeId);

  if (!isOpen || !nodeId || !node) return null;

  const menuItems: RadialMenuItem[] = [
    {
      id: 'set-start',
      label: 'Set Start',
      icon: '🟢',
      action: () => {
        dispatch(setStartNode(nodeId));
        onClose();
      },
      color: 'bg-green-600',
    },
    {
      id: 'set-end',
      label: 'Set End',
      icon: '🔴',
      action: () => {
        dispatch(setEndNode(nodeId));
        onClose();
      },
      color: 'bg-red-600',
    },
    {
      id: 'add-waypoint',
      label: 'Add Waypoint',
      icon: '🟠',
      action: () => {
        dispatch(addWaypoint(nodeId));
        onClose();
      },
      color: 'bg-orange-600',
    },
    {
      id: 'view-details',
      label: 'View Details',
      icon: '📊',
      action: () => {
        dispatch(setSelectedNodes([nodeId]));
        onClose();
      },
      color: 'bg-blue-600',
    },
    {
      id: 'find-similar',
      label: 'Find Similar',
      icon: '🔍',
      action: () => {
        // Implement find similar functionality
        console.log('Find similar to:', node);
        onClose();
      },
      color: 'bg-purple-600',
    },
    {
      id: 'remove',
      label: 'Remove',
      icon: '✕',
      action: () => {
        // Implement remove functionality
        console.log('Remove node:', nodeId);
        onClose();
      },
      color: 'bg-gray-600',
    },
  ];

  // Calculate item positions in a circle
  const radius = 80;
  const angleStep = (2 * Math.PI) / menuItems.length;
  const startAngle = -Math.PI / 2; // Start from top

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          setSelectedItemIndex(prev =>
            prev === null ? 0 : (prev + 1) % menuItems.length
          );
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          setSelectedItemIndex(prev =>
            prev === null ? menuItems.length - 1 : (prev - 1 + menuItems.length) % menuItems.length
          );
          break;
        case 'Enter':
        case ' ':
          if (selectedItemIndex !== null) {
            menuItems[selectedItemIndex].action();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedItemIndex, menuItems, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[8000]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Radial Menu Container */}
      <div
        className="fixed z-[8001]"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
        }}
        role="menu"
        aria-label="Node context menu"
      >
        {/* Center node info */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-xs text-gray-400 text-center max-w-[80px] truncate">
            {node.title || (node as any).label || nodeId}
          </div>
        </div>

        {/* Menu items */}
        {menuItems.map((item, index) => {
          const angle = startAngle + index * angleStep;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const isSelected = selectedItemIndex === index;

          return (
            <button
              key={item.id}
              className={classNames(
                'absolute flex flex-col items-center justify-center',
                'w-16 h-16 rounded-full',
                'transition-all duration-200',
                'shadow-lg border-2',
                item.color,
                isSelected
                  ? 'scale-110 border-white'
                  : 'border-transparent hover:scale-105 hover:border-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-white'
              )}
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={item.action}
              onMouseEnter={() => setSelectedItemIndex(index)}
              onMouseLeave={() => setSelectedItemIndex(null)}
              aria-label={item.label}
              role="menuitem"
            >
              <span className="text-lg mb-1">{item.icon}</span>
              <span className="text-[10px] text-white font-medium">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};