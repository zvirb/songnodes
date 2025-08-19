import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import graphReducer from './graphSlice';
import uiReducer from './uiSlice';
import performanceReducer from './performanceSlice';
import searchReducer from './searchSlice';
import filtersReducer from './filtersSlice';
import pathfindingReducer from './pathfindingSlice';
import collaborationReducer from './collaborationSlice';
import settingsReducer from './settingsSlice';

export const store = configureStore({
  reducer: {
    graph: graphReducer,
    ui: uiReducer,
    performance: performanceReducer,
    search: searchReducer,
    filters: filtersReducer,
    pathfinding: pathfindingReducer,
    collaboration: collaborationReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          'graph/updateNodePositions',
          'performance/updateMetrics',
          'ui/updateViewport',
        ],
        // Ignore these field paths in all actions
        ignoredActionsPaths: ['payload.timestamp', 'payload.callback'],
        // Ignore these paths in the state
        ignoredPaths: ['graph.simulation', 'ui.animationFrameId'],
      },
      thunk: {
        extraArgument: {
          // Add any extra services here
        },
      },
    }),
  devTools: import.meta.env.DEV,
  preloadedState: undefined,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;