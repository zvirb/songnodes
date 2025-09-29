import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { Track, GraphNode } from '../types';
import {
  Play,
  Plus,
  Info,
  Share2,
  Copy,
  ExternalLink,
  Target,
  Filter,
  Layers,
  MoreHorizontal
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  targetType: 'node' | 'track' | 'empty' | 'edge';
  targetData?: GraphNode | Track | any;
}

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  divider?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  targetType,
  targetData
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Store actions
  const selectNode = useStore(state => state.graph.selectNode);
  const setHoveredNode = useStore(state => state.graph.setHoveredNode);
  const addToSetlist = useStore(state => state.setlist.addTrack);
  const applyFilters = useStore(state => state.search.applyFilters);
  const setSelectedTool = useStore(state => state.view.setSelectedTool);

  // Calculate menu position to keep it on screen
  const calculatePosition = useCallback(() => {
    if (!menuRef.current) return { left: x, top: y };

    const menuRect = menuRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // Adjust if menu would go off right edge
    if (x + menuRect.width > windowWidth) {
      adjustedX = windowWidth - menuRect.width - 10;
    }

    // Adjust if menu would go off bottom edge
    if (y + menuRect.height > windowHeight) {
      adjustedY = windowHeight - menuRect.height - 10;
    }

    return { left: adjustedX, top: adjustedY };
  }, [x, y]);

  // Build menu items based on context
  const getMenuItems = (): MenuItem[] => {
    const items: MenuItem[] = [];

    switch (targetType) {
      case 'node':
        const node = targetData as GraphNode;
        items.push(
          {
            label: 'Play Preview',
            icon: <Play size={16} />,
            action: () => {
              console.log('Playing preview for:', node.label);
              // TODO: Integrate with audio player
              onClose();
            },
            shortcut: 'Space'
          },
          {
            label: 'Add to Setlist',
            icon: <Plus size={16} />,
            action: () => {
              if (node.track) {
                addToSetlist(node.track);
              }
              onClose();
            },
            shortcut: 'A'
          },
          {
            label: 'View Details',
            icon: <Info size={16} />,
            action: () => {
              selectNode(node.id);
              onClose();
            },
            shortcut: 'I'
          },
          { divider: true } as MenuItem,
          {
            label: 'Find Similar',
            icon: <Filter size={16} />,
            action: () => {
              // Apply filters based on node properties
              applyFilters({
                genre: node.genre ? [node.genre] : undefined,
                bpmRange: node.bpm ? [node.bpm - 5, node.bpm + 5] : undefined,
                keyRange: node.key ? [node.key] : undefined
              });
              onClose();
            }
          },
          {
            label: 'Create Path From',
            icon: <Share2 size={16} />,
            action: () => {
              selectNode(node.id);
              setSelectedTool('path');
              onClose();
            }
          },
          {
            label: 'Set as Target',
            icon: <Target size={16} />,
            action: () => {
              console.log('Setting as target:', node.label);
              // TODO: Integrate with target tracks
              onClose();
            }
          },
          { divider: true } as MenuItem,
          {
            label: 'Copy Track Info',
            icon: <Copy size={16} />,
            action: () => {
              const info = `${node.label} - ${node.artist || 'Unknown Artist'}`;
              navigator.clipboard.writeText(info);
              onClose();
            },
            shortcut: 'Ctrl+C'
          },
          {
            label: 'Open in Spotify',
            icon: <ExternalLink size={16} />,
            action: () => {
              // TODO: Open in music service
              console.log('Opening in Spotify:', node.label);
              onClose();
            },
            disabled: !node.track?.spotify_id
          }
        );
        break;

      case 'track':
        const track = targetData as Track;
        items.push(
          {
            label: 'Play Preview',
            icon: <Play size={16} />,
            action: () => {
              console.log('Playing:', track.name);
              onClose();
            }
          },
          {
            label: 'Add to Setlist',
            icon: <Plus size={16} />,
            action: () => {
              addToSetlist(track);
              onClose();
            }
          },
          {
            label: 'View in Graph',
            icon: <Layers size={16} />,
            action: () => {
              // TODO: Center graph on this track
              onClose();
            }
          }
        );
        break;

      case 'empty':
        items.push(
          {
            label: 'Reset View',
            icon: <Layers size={16} />,
            action: () => {
              // TODO: Reset viewport
              onClose();
            }
          },
          {
            label: 'Clear Selection',
            action: () => {
              useStore.getState().graph.clearSelection();
              onClose();
            },
            shortcut: 'Esc'
          },
          { divider: true } as MenuItem,
          {
            label: 'Show All Nodes',
            action: () => {
              applyFilters({});
              onClose();
            }
          },
          {
            label: 'Hide Labels',
            action: () => {
              useStore.getState().view.toggleLabels();
              onClose();
            }
          },
          {
            label: 'Hide Edges',
            action: () => {
              useStore.getState().view.toggleEdges();
              onClose();
            }
          }
        );
        break;

      case 'edge':
        items.push(
          {
            label: 'View Connection Details',
            icon: <Info size={16} />,
            action: () => {
              console.log('Edge details:', targetData);
              onClose();
            }
          },
          {
            label: 'Hide Similar Edges',
            icon: <Filter size={16} />,
            action: () => {
              // TODO: Filter edges by type
              onClose();
            }
          }
        );
        break;
    }

    return items;
  };

  // Close on escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const position = calculatePosition();
  const menuItems = getMenuItems();

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        zIndex: 10000,
        minWidth: '200px',
        backgroundColor: 'rgba(30, 30, 40, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(10px)',
        padding: '4px',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      {menuItems.map((item, index) => {
        if (item.divider) {
          return (
            <div
              key={index}
              style={{
                height: '1px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                margin: '4px 0'
              }}
            />
          );
        }

        return (
          <button
            key={index}
            className="context-menu-item"
            onClick={item.action}
            disabled={item.disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              color: item.disabled ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.9)',
              border: 'none',
              borderRadius: '4px',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              transition: 'all 0.15s ease',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#fff';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = item.disabled ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.9)';
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {item.icon}
              {item.label}
            </span>
            {item.shortcut && (
              <span style={{
                fontSize: '11px',
                opacity: 0.6,
                marginLeft: '20px'
              }}>
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
};

// Hook to manage context menu state
export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    targetType: 'node' | 'track' | 'empty' | 'edge';
    targetData?: any;
  } | null>(null);

  const openContextMenu = useCallback((
    e: React.MouseEvent,
    targetType: 'node' | 'track' | 'empty' | 'edge',
    targetData?: any
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetType,
      targetData
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu
  };
};