import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { startPathCalculation, setPathResult } from '../store/pathfindingSlice';
import { computeRoute } from '../utils/path';

/**
 * Hook that automatically triggers path calculation when start and end nodes are selected
 */
export const useAutoPathCalculation = () => {
  const dispatch = useAppDispatch();
  const { startNode, endNode, waypoints, isCalculating } = useAppSelector(state => state.pathfinding);
  const { nodes, edges } = useAppSelector(state => state.graph);

  useEffect(() => {
    // Only trigger if both start and end are set and not already calculating
    if (startNode && endNode && !isCalculating) {
      console.log('🚀 Auto-triggering path calculation:', { startNode, endNode, waypoints });

      // Dispatch calculation start
      dispatch(startPathCalculation());

      // Perform the actual calculation
      const path = computeRoute(nodes, edges, { start: startNode, end: endNode, waypoints: waypoints || [] });

      if (path) {
        // Build PathResult for the store
        const pathResult = {
          id: `path_${Date.now()}`,
          nodes: path,
          edges: [], // You could calculate edge IDs here if needed
          distance: path.length,
          metrics: {
            smoothness: 0.8,
            diversity: 0.7,
            feasibility: 1.0,
            avgWeight: 1.0
          },
          reasoning: `Auto-calculated route with ${waypoints?.length || 0} waypoints`
        };

        dispatch(setPathResult(pathResult));
        console.log('✅ Auto-calculation completed:', path);
      } else {
        console.log('❌ Auto-calculation failed: No route found');
      }
    }
  }, [startNode, endNode, waypoints, isCalculating, dispatch, nodes, edges]);
};