import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { GraphNode, Track } from '../types';
import {
  Play,
  Plus,
  Info,
  Share2,
  Target,
  Filter,
  Layers,
  Music,
  BarChart,
  Shuffle
} from 'lucide-react';

interface RadialMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  action: () => void;
  disabled?: boolean;
}

interface RadialMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  targetNode?: GraphNode;
  targetTrack?: Track;
}

export const RadialMenu: React.FC<RadialMenuProps> = ({
  x,
  y,
  onClose,
  targetNode,
  targetTrack
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Store actions
  const selectNode = useStore(state => state.graph.selectNode);
  const addToSetlist = useStore(state => state.setlist.addTrackToSetlist);
  const setSelectedTool = useStore(state => state.view.setSelectedTool);
  const applyFilters = useStore(state => state.search.applyFilters);

  // Configuration
  const RADIUS = 80;
  const ITEM_RADIUS = 32;
  const CENTER_RADIUS = 30;

  // Build menu items based on context
  const getMenuItems = (): RadialMenuItem[] => {
    if (targetNode) {
      return [
        {
          id: 'play',
          label: 'Play',
          icon: <Play size={20} />,
          color: '#10b981',
          action: () => {
            onClose();
          }
        },
        {
          id: 'add',
          label: 'Add to Set',
          icon: <Plus size={20} />,
          color: '#3b82f6',
          action: () => {
            if (targetNode.track) {
              addToSetlist(targetNode.track);
            }
            onClose();
          }
        },
        {
          id: 'info',
          label: 'Details',
          icon: <Info size={20} />,
          color: '#8b5cf6',
          action: () => {
            selectNode(targetNode.id);
            onClose();
          }
        },
        {
          id: 'path',
          label: 'Path From',
          icon: <Share2 size={20} />,
          color: '#f59e0b',
          action: () => {
            selectNode(targetNode.id);
            setSelectedTool('path');
            onClose();
          }
        },
        {
          id: 'filter',
          label: 'Find Similar',
          icon: <Filter size={20} />,
          color: '#ec4899',
          action: () => {
            applyFilters({
              genre: targetNode.genre ? [targetNode.genre] : undefined,
              bpmRange: targetNode.bpm ? [targetNode.bpm - 5, targetNode.bpm + 5] : undefined
            });
            onClose();
          }
        },
        {
          id: 'target',
          label: 'Set Target',
          icon: <Target size={20} />,
          color: '#ef4444',
          action: () => {
            onClose();
          }
        }
      ];
    } else if (targetTrack) {
      return [
        {
          id: 'play',
          label: 'Play',
          icon: <Play size={20} />,
          color: '#10b981',
          action: () => {
            onClose();
          }
        },
        {
          id: 'add',
          label: 'Add to Set',
          icon: <Plus size={20} />,
          color: '#3b82f6',
          action: () => {
            addToSetlist(targetTrack);
            onClose();
          }
        },
        {
          id: 'graph',
          label: 'View in Graph',
          icon: <Layers size={20} />,
          color: '#8b5cf6',
          action: () => {
            onClose();
          }
        },
        {
          id: 'analyze',
          label: 'Analyze',
          icon: <BarChart size={20} />,
          color: '#f59e0b',
          action: () => {
            onClose();
          }
        }
      ];
    } else {
      // General menu items
      return [
        {
          id: 'browse',
          label: 'Browse',
          icon: <Music size={20} />,
          color: '#3b82f6',
          action: () => {
            setSelectedTool('select');
            onClose();
          }
        },
        {
          id: 'shuffle',
          label: 'Shuffle',
          icon: <Shuffle size={20} />,
          color: '#10b981',
          action: () => {
            onClose();
          }
        },
        {
          id: 'filter',
          label: 'Filter',
          icon: <Filter size={20} />,
          color: '#ec4899',
          action: () => {
            setSelectedTool('filter');
            onClose();
          }
        },
        {
          id: 'layers',
          label: 'Layers',
          icon: <Layers size={20} />,
          color: '#8b5cf6',
          action: () => {
            onClose();
          }
        }
      ];
    }
  };

  const menuItems = getMenuItems();

  // Calculate item positions
  const getItemPosition = (index: number, total: number) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    return {
      x: Math.cos(angle) * RADIUS,
      y: Math.sin(angle) * RADIUS
    };
  };

  // Handle mouse/touch interaction
  const handlePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < CENTER_RADIUS) {
      setSelectedIndex(null);
      return;
    }

    const angle = Math.atan2(dy, dx);
    const normalizedAngle = angle < -Math.PI / 2
      ? angle + Math.PI * 2
      : angle;

    const itemAngle = (Math.PI * 2) / menuItems.length;
    const index = Math.round((normalizedAngle + Math.PI / 2) / itemAngle) % menuItems.length;

    setSelectedIndex(index);
  }, [menuItems.length]);

  // Handle selection
  const handlePointerUp = useCallback(() => {
    if (selectedIndex !== null && menuItems[selectedIndex]) {
      menuItems[selectedIndex].action();
    } else {
      onClose();
    }
  }, [selectedIndex, menuItems, onClose]);

  // Setup event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchmove', handlePointerMove);
    document.addEventListener('touchend', handlePointerUp);

    // Start animation
    setTimeout(() => setIsAnimating(false), 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handlePointerMove);
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchmove', handlePointerMove);
      document.removeEventListener('touchend', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp, onClose]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--color-modal-overlay)',
          backdropFilter: 'blur(12px)',
          zIndex: 'var(--z-dropdown)',
          cursor: 'pointer'
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      />

      {/* Radial Menu */}
      <div
        ref={menuRef}
        role="menu"
        aria-label="Context Actions Menu"
        style={{
          position: 'fixed',
          left: x,
          top: y,
          transform: 'translate(-50%, -50%)',
          zIndex: 'calc(var(--z-dropdown) + 1)',
          width: RADIUS * 2 + ITEM_RADIUS * 2,
          height: RADIUS * 2 + ITEM_RADIUS * 2,
          pointerEvents: 'none'
        }}
      >
        {/* Connection lines */}
        <svg
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        >
          {menuItems.map((_, index) => {
            const pos = getItemPosition(index, menuItems.length);
            return (
              <line
                key={index}
                x1="50%"
                y1="50%"
                x2={`calc(50% + ${pos.x}px)`}
                y2={`calc(50% + ${pos.y}px)`}
                stroke={selectedIndex === index ? 'var(--color-brand-primary)' : 'var(--color-border-default)'}
                strokeWidth={selectedIndex === index ? 2 : 1}
                style={{
                  transition: 'all var(--duration-fast) var(--ease-out)'
                }}
              />
            );
          })}
        </svg>

        {/* Center circle */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${isAnimating ? 0 : 1})`,
            width: CENTER_RADIUS * 2,
            height: CENTER_RADIUS * 2,
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-panel-bg)',
            border: '2px solid var(--color-border-default)',
            boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform var(--duration-base) var(--ease-spring)',
            pointerEvents: 'auto',
            cursor: 'pointer'
          }}
        >
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-brand-primary)',
            boxShadow: 'var(--glow-accent-sm)'
          }} />
        </div>

        {/* Menu items */}
        {menuItems.map((item, index) => {
          const pos = getItemPosition(index, menuItems.length);
          const isSelected = selectedIndex === index;

          return (
            <div
              key={item.id}
              role="menuitem"
              tabIndex={0}
              aria-label={item.label}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${isAnimating ? 0 : isSelected ? 1.15 : 1})`,
                width: ITEM_RADIUS * 2,
                height: ITEM_RADIUS * 2,
                borderRadius: 'var(--radius-full)',
                backgroundColor: isSelected ? item.color : 'var(--color-bg-elevated-2)',
                border: `2px solid ${isSelected ? item.color : 'var(--color-border-default)'}`,
                boxShadow: isSelected ? 'var(--glow-accent-md, 0 0 20px rgba(0, 255, 65, 0.6))' : 'var(--shadow-dropdown)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--duration-fast) var(--ease-out)',
                cursor: 'pointer',
                pointerEvents: 'auto',
                opacity: item.disabled ? 0.5 : 1,
                animation: `fadeIn var(--duration-fast) var(--ease-out)`
              }}
              onMouseEnter={() => !item.disabled && setSelectedIndex(index)}
              onMouseLeave={() => setSelectedIndex(null)}
              onClick={() => !item.disabled && item.action()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !item.disabled) {
                  e.preventDefault();
                  item.action();
                }
              }}
            >
              <div style={{
                color: isSelected ? 'var(--color-white)' : 'var(--color-text-secondary)',
                transition: 'color var(--duration-fast) var(--ease-out)'
              }}>
                {item.icon}
              </div>
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  bottom: '-28px',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-tooltip-text)',
                  whiteSpace: 'nowrap',
                  backgroundColor: 'var(--color-tooltip-bg)',
                  border: '1px solid var(--color-border-subtle)',
                  boxShadow: 'var(--shadow-tooltip)',
                  padding: 'var(--space-1) var(--space-2)',
                  borderRadius: 'var(--radius-tooltip)',
                  pointerEvents: 'none'
                }}>
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </>,
    document.body
  );
};

// Hook to manage radial menu
export const useRadialMenu = () => {
  const [radialMenu, setRadialMenu] = useState<{
    x: number;
    y: number;
    targetNode?: GraphNode;
    targetTrack?: Track;
  } | null>(null);

  const openRadialMenu = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    targetNode?: GraphNode,
    targetTrack?: Track
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let x: number, y: number;
    if ('touches' in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }

    setRadialMenu({ x, y, targetNode, targetTrack });
  }, []);

  const closeRadialMenu = useCallback(() => {
    setRadialMenu(null);
  }, []);

  return {
    radialMenu,
    openRadialMenu,
    closeRadialMenu
  };
};