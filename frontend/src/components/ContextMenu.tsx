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
  FileEdit,
  Check
} from 'lucide-react';
import { SN } from '../lib/songnodes';

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
  /** Shown under a disabled item: what to do to enable it. */
  disabledReason?: string;
  shortcut?: string;
  /** Group heading (design-system ContextMenu: "Route", "Track", "View"). */
  group?: string;
  /** menuitemcheckbox state. */
  checked?: boolean;
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
            console.warn('Cannot calculate route: missing start or end track');
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
              console.log('Route calculated successfully:', result.path.length, 'tracks');
            } else {
              console.warn('Route calculation failed:', 'No route found for the selected tracks');
            }
          } catch (error) {
            console.error('Route calculation error:', error);
            pathfinding.setCurrentPath(null);
          } finally {
            pathfinding.setPathCalculating(false);
          }
        };

        items.push(
          {
            label: 'Set as starting track',
            group: 'Route',
            icon: <Flag size={16} />,
            action: () => {
              pathfinding.setStartTrack(node.id);
              selectNode(node.id);
              console.log('Start track set:', node.label);
              onClose();
            }
          },
          {
            label: pathfindingState.selectedWaypoints.has(node.id) ? 'Remove waypoint' : 'Set as waypoint',
            group: 'Route',
            icon: <MapPin size={16} />,
            action: () => {
              if (pathfindingState.selectedWaypoints.has(node.id)) {
                pathfinding.removeWaypoint(node.id);
                console.log('Waypoint removed:', node.label);
              } else {
                pathfinding.addWaypoint(node.id);
                console.log('Waypoint added:', node.label);
              }
              onClose();
            }
          },
          {
            label: 'Set as finish',
            group: 'Route',
            icon: <FlagTriangleRight size={16} />,
            action: () => {
              pathfinding.setEndTrack(node.id);
              selectNode(node.id);
              console.log('Finish track set:', node.label);
              onClose();
            }
          },
          {
            label: 'Calculate route',
            group: 'Route',
            icon: <Navigation size={16} />,
            action: async () => {
              await handleCalculateRoute();
              onClose();
            },
            disabled: !pathfindingState.startTrackId || !pathfindingState.endTrackId,
            disabledReason: 'Set a starting track and a finish first'
          },
          {
            label: 'Select track',
            group: 'Track',
            icon: <MousePointer2 size={16} />,
            action: () => {
              selectNode(node.id);
              onClose();
            }
          },
          {
            label: 'View track info',
            group: 'Track',
            icon: <FileEdit size={16} />,
            action: () => {
              selectNode(node.id);
              // Trigger track details modal via custom event
              window.dispatchEvent(new CustomEvent('openTrackDetails', {
                detail: { nodeId: node.id, track: node }
              }));
              console.log('Opening track info for:', node.label);
              onClose();
            }
          },
          {
            label: 'Clear route',
            group: 'Route',
            icon: <RefreshCw size={16} />,
            action: () => {
              pathfinding.setStartTrack('');
              pathfinding.setEndTrack('');
              pathfinding.clearWaypoints();
              pathfinding.setCurrentPath(null);
              console.log('Route reset - all pathfinding data cleared');
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
            console.warn('Cannot center on track: graph data not available');
            return;
          }

          // Find first node with matching track_id
          // Note: A track may appear multiple times (different artists), we center on first match
          const trackNode = graphData.nodes.find(n => n.track_id === track.id);

          if (trackNode && trackNode.id) {
            // Select the node and center view on it
            selectNode(trackNode.id);
            console.log('Centering on track node:', trackNode.id, track.title);

            // Trigger graph center via custom event
            // The GraphVisualization component will handle this
            window.dispatchEvent(new CustomEvent('centerOnNode', {
              detail: { nodeId: trackNode.id, zoomLevel: 2.0 }
            }));
          } else {
            console.warn('Track not found in graph:', track.id, track.title);
          }
        };

        items.push(
          {
            label: 'Play preview',
            icon: <Play size={16} />,
            action: () => {
              onClose();
            }
          },
          {
            label: 'Add to set',
            icon: <Plus size={16} />,
            action: () => {
              addToSetlist(track);
              onClose();
            }
          },
          {
            label: 'Show in graph',
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
            label: 'Fast drawing (sprites)',
            group: 'View',
            checked: !!graphSettings?.useSpriteMode,
            action: () => {
              if (graphSettings?.setUseSpriteMode) {
                graphSettings.setUseSpriteMode(!graphSettings.useSpriteMode);
              }
              onClose();
            }
          },
          {
            label: 'Reset view',
            group: 'View',
            icon: <Layers size={16} />,
            action: () => {
              // FIX: Use fitToContent to properly center and zoom to all nodes
              if (graphSettings?.fitToContent) {
                graphSettings.fitToContent();
              } else {
                // Fallback: Reset to identity transform if fitToContent not available
                console.warn('fitToContent not available, using fallback reset');
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
            label: 'Clear selection',
            group: 'View',
            action: () => {
              useStore.getState().graph.clearSelection();
              onClose();
            },
            shortcut: 'Esc'
          },
          {
            label: 'Show all tracks',
            group: 'View',
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
            label: 'View connection details',
            icon: <Info size={16} />,
            action: () => {
              setViewingEdge(edge);
              onClose();
            }
          },
          {
            label: edge?.type ? `Hide ${edge.type} links` : 'Hide links of this type',
            disabledReason: 'This link has no type',
            icon: <Filter size={16} />,
            action: () => {
              if (edge?.type) {
                toggleEdgeType(edge.type);
                console.log(`Hiding ${edge.type} edges`);
              } else {
                console.warn('Cannot hide edges: edge type not available');
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

  const position = calculatePosition();
  const menuItems = getMenuItems().filter((item) => !item.divider);

  // Title naming the target (design-system ContextMenu)
  const titleText = (() => {
    if (targetType === 'node' || targetType === 'track') {
      const d = targetData as any;
      const name = d?.title || d?.name || d?.label;
      return d?.artist && name ? `${d.artist} – ${name}` : name || 'Track';
    }
    if (targetType === 'edge') return 'Connection';
    return 'Graph';
  })();
  const titleMeta = (() => {
    if (targetType !== 'node' && targetType !== 'track') return null;
    const d = targetData as any;
    const key = d?.key ? SN.camelot(d.key) : null;
    const parts = [key, d?.bpm ? `${SN.format.bpm(d.bpm)} BPM` : null].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  })();

  // Focus the first item; arrow keys move, Home/End jump (WAI-ARIA menu)
  useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not([aria-disabled="true"])');
    first?.focus();
  }, []);
  const onMenuKey = (e: React.KeyboardEvent) => {
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? []);
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    const go = (n: number) => { e.preventDefault(); els[(n + els.length) % els.length]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(els.length - 1);
    else if (e.key === 'Tab') onClose();
  };

  const groups: { name?: string; items: MenuItem[] }[] = [];
  menuItems.forEach((item) => {
    const g = groups.find((x) => x.name === item.group);
    if (g) g.items.push(item); else groups.push({ name: item.group, items: [item] });
  });

  const renderItem = (item: MenuItem, index: number) => {
    const reasonId = item.disabled && item.disabledReason ? `cm-why-${index}` : undefined;
    return (
      <button
        key={`${item.label}-${index}`}
        type="button"
        className="sn-overflow-menu__item context-menu-item"
        role={item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
        aria-checked={item.checked}
        tabIndex={-1}
        aria-disabled={item.disabled || undefined}
        aria-describedby={reasonId}
        onClick={() => { if (!item.disabled) item.action(); }}
      >
        {item.icon}
        <span className="sn-overflow-menu__label">
          <span className="sn-overflow-menu__text">{item.label}</span>
          {reasonId ? <span className="sn-overflow-menu__reason" id={reasonId}>{item.disabledReason}</span> : null}
        </span>
        {item.checked ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : null}
        {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
      </button>
    );
  };

  let n = 0;
  return (
    <>
      {createPortal(
        <div className="sn-context-menu context-menu" style={{ left: position.left, top: position.top }}>
          <div ref={menuRef} className="sn-overflow-menu__menu" role="menu" aria-label={`Actions for ${titleText}`} onKeyDown={onMenuKey}>
            <div className="sn-overflow-menu__title" role="presentation">
              {titleText}
              {titleMeta ? <small>{titleMeta}</small> : null}
            </div>
            {groups.map((g, gi) => (
              <React.Fragment key={g.name ?? `g${gi}`}>
                {gi > 0 ? <div className="sn-overflow-menu__sep" role="separator" /> : null}
                {g.name ? (
                  <div role="group" aria-labelledby={`cm-h-${gi}`}>
                    <div className="sn-overflow-menu__heading" id={`cm-h-${gi}`} role="presentation">{g.name}</div>
                    {g.items.map((item) => renderItem(item, n++))}
                  </div>
                ) : g.items.map((item) => renderItem(item, n++))}
              </React.Fragment>
            ))}
          </div>
        </div>,
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