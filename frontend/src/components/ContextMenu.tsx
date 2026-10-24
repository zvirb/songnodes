import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { select } from 'd3-selection';
import { zoomIdentity } from 'd3-zoom';
import 'd3-transition'; // Adds .transition() method to selections
import { useStore } from '../store/useStore';
import { Track, GraphNode, GraphEdge } from '../types';
import { findDJPath } from '../utils/pathfinding';
import { DEFAULT_CONSTRAINTS } from '../types/pathfinding';
import { EdgeDetailsModal } from './EdgeDetailsModal';
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
  MousePointer2,
  FileEdit
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
  const [viewingEdge, setViewingEdge] = useState<GraphEdge | null>(null);

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
              console.warn('⚠️ Route calculation failed:', 'No route found for the selected tracks');
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
            label: 'View Track Info',
            icon: <FileEdit size={16} />,
            action: () => {
              selectNode(node.id);
              // Trigger track details modal via custom event
              window.dispatchEvent(new CustomEvent('openTrackDetails', {
                detail: { nodeId: node.id, track: node }
              }));
              console.log('📝 Opening track info for:', node.label);
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

        // Helper to find and center on track's node in graph
        const centerOnTrack = () => {
          // Get graph data from store to find the node
          const graphData = useStore.getState().graphData;
          if (!graphData || !graphData.nodes) {
            console.warn('⚠️ Cannot center on track: graph data not available');
            return;
          }

          // Find first node with matching track_id
          // Note: A track may appear multiple times (different artists), we center on first match
          const trackNode = graphData.nodes.find(n => n.track_id === track.id);

          if (trackNode && trackNode.id) {
            // Select the node and center view on it
            selectNode(trackNode.id);
            console.log('🎯 Centering on track node:', trackNode.id, track.title);

            // Trigger graph center via custom event
            // The GraphVisualization component will handle this
            window.dispatchEvent(new CustomEvent('centerOnNode', {
              detail: { nodeId: trackNode.id, zoomLevel: 2.0 }
            }));
          } else {
            console.warn('⚠️ Track not found in graph:', track.id, track.title);
          }
        };

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
              centerOnTrack();
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
        const edge = targetData as GraphEdge; // Edge data passed from context menu trigger

        // Get the store action
        const toggleEdgeType = useStore.getState().view.toggleEdgeTypeVisibility;

        items.push(
          {
            label: 'View Connection Details',
            icon: <Info size={16} />,
            action: () => {
              setViewingEdge(edge);
              onClose();
            }
          },
          {
            label: edge?.type ? `Hide ${edge.type} edges` : 'Hide Similar Edges',
            icon: <Filter size={16} />,
            action: () => {
              if (edge?.type) {
                toggleEdgeType(edge.type);
                console.log(`🔇 Hiding ${edge.type} edges`);
              } else {
                console.warn('⚠️ Cannot hide edges: edge type not available');
              }
              onClose();
            },
            disabled: !edge?.type
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

  // Manage key navigation focus among menu items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!menuRef.current) return;
        const buttons = Array.from(
          menuRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
        );
        if (buttons.length === 0) return;

        const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'ArrowDown') {
          const nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
          buttons[nextIndex]?.focus();
        } else {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
          buttons[prevIndex]?.focus();
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    // Focus first active menu item upon render
    const timer = setTimeout(() => {
      if (menuRef.current) {
        const firstButton = menuRef.current.querySelector<HTMLButtonElement>('button:not([disabled])');
        firstButton?.focus();
      }
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [onClose]);

  const position = calculatePosition();
  const menuItems = getMenuItems();

  return (
    <>
      {createPortal(
        <>
          {/* Transparent Backdrop to dismiss context menu */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 'var(--z-dropdown)',
              backgroundColor: 'transparent'
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          />

          <div
            ref={menuRef}
            role="menu"
            aria-label="Context Menu"
            className="context-menu"
            style={{
              position: 'fixed',
              left: position.left,
              top: position.top,
              zIndex: 'calc(var(--z-dropdown) + 1)',
              minWidth: '200px',
              backgroundColor: 'var(--color-panel-bg)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-panel)',
              boxShadow: 'var(--shadow-dropdown)',
              backdropFilter: 'blur(12px)',
              padding: 'var(--space-1)',
              animation: 'fadeIn var(--duration-fast) var(--ease-out)'
            }}
          >
            {menuItems.map((item, index) => {
              if (item.divider) {
                return (
                  <div
                    key={index}
                    role="separator"
                    style={{
                      height: '1px',
                      backgroundColor: 'var(--color-border-subtle)',
                      margin: 'var(--space-1) 0'
                    }}
                  />
                );
              }

              return (
                <button
                  key={index}
                  role="menuitem"
                  className="context-menu-item"
                  onClick={item.action}
                  disabled={item.disabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: 'transparent',
                    color: item.disabled ? 'var(--color-text-disabled)' : 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    transition: 'all var(--duration-fast) var(--ease-out)',
                    textAlign: 'left',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!item.disabled) {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated-3)';
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                      e.currentTarget.style.boxShadow = 'var(--glow-accent-sm)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = item.disabled ? 'var(--color-text-disabled)' : 'var(--color-text-primary)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onFocus={(e) => {
                    if (!item.disabled) {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated-3)';
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                      e.currentTarget.style.boxShadow = 'var(--glow-accent-sm)';
                    }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = item.disabled ? 'var(--color-text-disabled)' : 'var(--color-text-primary)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {item.icon}
                    {item.label}
                  </span>
                  {item.shortcut && (
                    <span style={{
                      fontSize: 'var(--font-size-xs)',
                      opacity: 0.6,
                      marginLeft: 'var(--space-4)'
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
          </div>
        </>,
        document.body
      )}

      {/* Edge Details Modal */}
      <EdgeDetailsModal
        edge={viewingEdge}
        onClose={() => setViewingEdge(null)}
      />
    </>
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