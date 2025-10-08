import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { select } from 'd3-selection';
import { zoomIdentity } from 'd3-zoom';
import 'd3-transition'; // Adds .transition() method to selections
import { useStore } from '../store/useStore';
import { Track, GraphNode } from '../types';
import { findDJPath } from '../utils/pathfinding';
import { DEFAULT_CONSTRAINTS } from '../types/pathfinding';
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
  MoreHorizontal,
  Navigation,
  MapPin,
  Flag,
  FlagTriangleRight,
  RefreshCw,
  MousePointer2
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
  const addToSetlist = useStore(state => state.setlist.addTrackToSetlist);
  const applyFilters = useStore(state => state.search.applyFilters);
  const setSelectedTool = useStore(state => state.view.setSelectedTool);

  // Pathfinding actions
  const pathfinding = useStore(state => state.pathfinding);
  const pathfindingState = useStore(state => state.pathfindingState);

  // View state for toggle indicators
  const showLabels = useStore(state => state.viewState.showLabels);
  const showEdges = useStore(state => state.viewState.showEdges);

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

        // Helper function to calculate route
        const handleCalculateRoute = async () => {
          if (!pathfindingState.startTrackId || !pathfindingState.endTrackId) {
            console.warn('⚠️ Cannot calculate route: missing start or end track');
            return;
          }

          try {
            pathfinding.setPathCalculating(true);
            const graphData = useStore.getState().graphData;

            const options = {
              startTrackId: pathfindingState.startTrackId,
              endTrackId: pathfindingState.endTrackId,
              waypoints: pathfindingState.selectedWaypoints,
              maxBpmChange: 20,
              energyFlow: 'ascending' as const,
              timeConstraints: {
                maxDuration: 3600, // 60 minutes
              },
            };

            const result = await findDJPath(
              graphData,
              options,
              DEFAULT_CONSTRAINTS.flexible,
              pathfindingState.algorithm
            );

            pathfinding.setCurrentPath(result);

            if (result.success) {
              console.log('✅ Route calculated successfully:', result.path.length, 'tracks');
            } else {
              console.warn('⚠️ Route calculation failed:', result.error);
            }
          } catch (error) {
            console.error('❌ Route calculation error:', error);
            pathfinding.setCurrentPath(null);
          } finally {
            pathfinding.setPathCalculating(false);
          }
        };

        items.push(
          {
            label: 'Calculate Route',
            icon: <Navigation size={16} />,
            action: async () => {
              await handleCalculateRoute();
              onClose();
            },
            disabled: !pathfindingState.startTrackId || !pathfindingState.endTrackId
          },
          { divider: true } as MenuItem,
          {
            label: 'Set as Starting Track',
            icon: <Flag size={16} />,
            action: () => {
              pathfinding.setStartTrack(node.id);
              selectNode(node.id);
              console.log('🏁 Start track set:', node.label);
              onClose();
            }
          },
          {
            label: 'Set as Waypoint',
            icon: <MapPin size={16} />,
            action: () => {
              if (pathfindingState.selectedWaypoints.has(node.id)) {
                pathfinding.removeWaypoint(node.id);
                console.log('📍 Waypoint removed:', node.label);
              } else {
                pathfinding.addWaypoint(node.id);
                console.log('📍 Waypoint added:', node.label);
              }
              onClose();
            }
          },
          {
            label: 'Set as Finish Point',
            icon: <FlagTriangleRight size={16} />,
            action: () => {
              pathfinding.setEndTrack(node.id);
              selectNode(node.id);
              console.log('🏁 Finish track set:', node.label);
              onClose();
            }
          },
          { divider: true } as MenuItem,
          {
            label: 'Select Track',
            icon: <MousePointer2 size={16} />,
            action: () => {
              selectNode(node.id);
              onClose();
            }
          },
          {
            label: 'Reset Route',
            icon: <RefreshCw size={16} />,
            action: () => {
              pathfinding.setStartTrack('');
              pathfinding.setEndTrack('');
              pathfinding.clearWaypoints();
              pathfinding.setCurrentPath(null);
              console.log('🔄 Route reset - all pathfinding data cleared');
              onClose();
            }
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
        const graphSettings = targetData as any;

        items.push(
          {
            label: graphSettings?.useSpriteMode ? '✓ Sprite Mode (Performance)' : 'Sprite Mode (Performance)',
            action: () => {
              if (graphSettings?.setUseSpriteMode) {
                graphSettings.setUseSpriteMode(!graphSettings.useSpriteMode);
              }
              onClose();
            }
          },
          { divider: true } as MenuItem,
          {
            label: 'Reset View',
            icon: <Layers size={16} />,
            action: () => {
              // ✅ FIX: Use fitToContent to properly center and zoom to all nodes
              if (graphSettings?.fitToContent) {
                graphSettings.fitToContent();
              } else {
                // Fallback: Reset to identity transform if fitToContent not available
                console.warn('⚠️ fitToContent not available, using fallback reset');
                if (graphSettings?.zoomBehaviorRef?.current && graphSettings?.containerRef?.current) {
                  const container = graphSettings.containerRef.current;
                  const zoomHandler = graphSettings.zoomBehaviorRef.current;
                  const selection = (select as any)(container);
                  selection.transition()
                    .duration(500)
                    .call(zoomHandler.transform, zoomIdentity);
                }
              }
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
          // Labels and edges permanently enabled - toggles removed
        );
        break;

      case 'edge':
        items.push(
          {
            label: 'View Connection Details',
            icon: <Info size={16} />,
            action: () => {
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