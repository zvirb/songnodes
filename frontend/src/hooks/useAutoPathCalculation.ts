import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { startPathCalculation } from '../store/pathfindingSlice';

/**
 * Hook that automatically triggers path calculation when start and end nodes are selected
 */
export const useAutoPathCalculation = () => {
  const dispatch = useAppDispatch();
  const { startNode, endNode, waypoints, isCalculating } = useAppSelector(state => state.pathfinding);

  useEffect(() => {
    // Only trigger if both start and end are set and not already calculating
    if (startNode && endNode && !isCalculating) {
      console.log('🚀 Auto-triggering path calculation:', { startNode, endNode, waypoints });
      dispatch(startPathCalculation());
    }
  }, [startNode, endNode, waypoints, isCalculating, dispatch]);
};