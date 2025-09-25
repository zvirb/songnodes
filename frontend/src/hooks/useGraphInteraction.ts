import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { GraphNode } from '../types';

export const useGraphInteraction = () => {
  const selectNode = useStore(state => state.graph.selectNode);
  const setHoveredNode = useStore(state => state.graph.setHoveredNode);
  const addTrackToSetlist = useStore(state => state.setlist.addTrackToSetlist);
  const updateNodePositions = useStore(state => state.graph.updateNodePositions);

  const handleNodeClick = useCallback((node: GraphNode) => {
    selectNode(node.id);
  }, [selectNode]);

  const handleNodeRightClick = useCallback((node: GraphNode, event: React.MouseEvent) => {
    event.preventDefault();
    // Could show context menu here
    if (node.track) {
      addTrackToSetlist(node.track);
    }
  }, [addTrackToSetlist]);

  const handleNodeHover = useCallback((node: GraphNode, isHovering: boolean) => {
    setHoveredNode(isHovering ? node.id : null);
  }, [setHoveredNode]);

  const handleDrag = useCallback((nodeId: string, x: number, y: number) => {
    updateNodePositions([{ id: nodeId, x, y }]);
  }, [updateNodePositions]);

  const handleDoubleClick = useCallback((node: GraphNode) => {
    // Focus on node and its neighbors
    selectNode(node.id);
  }, [selectNode]);

  return {
    handleNodeClick,
    handleNodeRightClick,
    handleNodeHover,
    handleDrag,
    handleDoubleClick,
  };
};