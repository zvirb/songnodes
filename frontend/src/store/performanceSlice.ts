import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PerformanceMetrics } from '@types/graph';

interface PerformanceState {
  metrics: PerformanceMetrics;
  history: Array<{
    timestamp: number;
    metrics: PerformanceMetrics;
  }>;
  warnings: Array<{
    id: string;
    type: 'fps' | 'memory' | 'render' | 'network';
    message: string;
    timestamp: number;
    dismissed: boolean;
  }>;
  settings: {
    autoOptimize: boolean;
    fpsTarget: number;
    memoryThreshold: number; // MB
    renderTimeThreshold: number; // ms
    enableProfiling: boolean;
    historySize: number;
    updateInterval: number; // ms
  };
  optimization: {
    lodLevel: number;
    cullingEnabled: boolean;
    particleSystemEnabled: boolean;
    shadowsEnabled: boolean;
    bloomEnabled: boolean;
    antialiasingEnabled: boolean;
    lastOptimization: number;
  };
  profiling: {
    enabled: boolean;
    samples: Array<{
      timestamp: number;
      phase: 'layout' | 'render' | 'interaction' | 'update';
      duration: number;
      details: Record<string, unknown>;
    }>;
  };
}

const initialState: PerformanceState = {
  metrics: {
    fps: 60,
    frameTime: 16.67,
    renderTime: 10,
    updateTime: 2,
    memoryUsage: {
      heap: 0,
      total: 0,
      external: 0,
    },
    nodeCount: {
      total: 0,
      visible: 0,
      rendered: 0,
    },
    edgeCount: {
      total: 0,
      visible: 0,
      rendered: 0,
    },
  },
  history: [],
  warnings: [],
  settings: {
    autoOptimize: true,
    fpsTarget: 60,
    memoryThreshold: 500,
    renderTimeThreshold: 16,
    enableProfiling: false,
    historySize: 100,
    updateInterval: 1000,
  },
  optimization: {
    lodLevel: 0,
    cullingEnabled: true,
    particleSystemEnabled: true,
    shadowsEnabled: false,
    bloomEnabled: false,
    antialiasingEnabled: true,
    lastOptimization: 0,
  },
  profiling: {
    enabled: false,
    samples: [],
  },
};

const performanceSlice = createSlice({
  name: 'performance',
  initialState,
  reducers: {
    updateMetrics: (state, action: PayloadAction<PerformanceMetrics>) => {
      const newMetrics = action.payload;
      const timestamp = Date.now();
      
      state.metrics = newMetrics;
      
      // Add to history
      state.history.push({
        timestamp,
        metrics: newMetrics,
      });
      
      // Trim history to configured size
      if (state.history.length > state.settings.historySize) {
        state.history = state.history.slice(-state.settings.historySize);
      }
      
      // Check for performance warnings
      const warnings = [];
      
      // FPS warning
      if (newMetrics.fps < state.settings.fpsTarget * 0.8) {
        warnings.push({
          id: `fps-${timestamp}`,
          type: 'fps' as const,
          message: `Low FPS detected: ${newMetrics.fps.toFixed(1)} (target: ${state.settings.fpsTarget})`,
          timestamp,
          dismissed: false,
        });
      }
      
      // Memory warning
      const memoryMB = newMetrics.memoryUsage.heap / (1024 * 1024);
      if (memoryMB > state.settings.memoryThreshold) {
        warnings.push({
          id: `memory-${timestamp}`,
          type: 'memory' as const,
          message: `High memory usage: ${memoryMB.toFixed(1)}MB (threshold: ${state.settings.memoryThreshold}MB)`,
          timestamp,
          dismissed: false,
        });
      }
      
      // Render time warning
      if (newMetrics.renderTime > state.settings.renderTimeThreshold) {
        warnings.push({
          id: `render-${timestamp}`,
          type: 'render' as const,
          message: `Slow rendering: ${newMetrics.renderTime.toFixed(1)}ms (threshold: ${state.settings.renderTimeThreshold}ms)`,
          timestamp,
          dismissed: false,
        });
      }
      
      // Add new warnings
      state.warnings.push(...warnings);
      
      // Remove old warnings (keep last 50)
      if (state.warnings.length > 50) {
        state.warnings = state.warnings.slice(-50);
      }
      
      // Auto-optimization
      if (state.settings.autoOptimize && warnings.length > 0) {
        const now = Date.now();
        const timeSinceLastOptimization = now - state.optimization.lastOptimization;
        
        // Only optimize once per 5 seconds to avoid thrashing
        if (timeSinceLastOptimization > 5000) {
          // Apply automatic optimizations based on warnings
          warnings.forEach(warning => {
            switch (warning.type) {
              case 'fps':
              case 'render':
                // Reduce quality settings
                if (state.optimization.shadowsEnabled) {
                  state.optimization.shadowsEnabled = false;
                } else if (state.optimization.bloomEnabled) {
                  state.optimization.bloomEnabled = false;
                } else if (state.optimization.antialiasingEnabled) {
                  state.optimization.antialiasingEnabled = false;
                } else if (state.optimization.lodLevel < 3) {
                  state.optimization.lodLevel += 1;
                }
                break;
                
              case 'memory':
                // Enable more aggressive culling and reduce LOD
                state.optimization.cullingEnabled = true;
                if (state.optimization.lodLevel < 4) {
                  state.optimization.lodLevel += 1;
                }
                // Disable particle system if memory is critical
                if (memoryMB > state.settings.memoryThreshold * 1.5) {
                  state.optimization.particleSystemEnabled = false;
                }
                break;
            }
          });
          
          state.optimization.lastOptimization = now;
        }
      }
    },
    
    updateSettings: (state, action: PayloadAction<Partial<PerformanceState['settings']>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    
    updateOptimizationSettings: (state, action: PayloadAction<Partial<PerformanceState['optimization']>>) => {
      state.optimization = { ...state.optimization, ...action.payload };
    },
    
    dismissWarning: (state, action: PayloadAction<string>) => {
      const warning = state.warnings.find(w => w.id === action.payload);
      if (warning) {
        warning.dismissed = true;
      }
    },
    
    clearWarnings: (state) => {
      state.warnings = [];
    },
    
    clearHistory: (state) => {
      state.history = [];
    },
    
    // Profiling actions
    startProfiling: (state) => {
      state.profiling.enabled = true;
      state.profiling.samples = [];
    },
    
    stopProfiling: (state) => {
      state.profiling.enabled = false;
    },
    
    addProfilingSample: (state, action: PayloadAction<{
      phase: 'layout' | 'render' | 'interaction' | 'update';
      duration: number;
      details?: Record<string, unknown>;
    }>) => {
      if (state.profiling.enabled) {
        state.profiling.samples.push({
          timestamp: Date.now(),
          ...action.payload,
          details: action.payload.details || {},
        });
        
        // Keep only last 1000 samples
        if (state.profiling.samples.length > 1000) {
          state.profiling.samples = state.profiling.samples.slice(-1000);
        }
      }
    },
    
    clearProfilingSamples: (state) => {
      state.profiling.samples = [];
    },
    
    // Utility actions
    resetOptimizations: (state) => {
      state.optimization = {
        ...initialState.optimization,
        lastOptimization: Date.now(),
      };
    },
    
    applyOptimizationPreset: (state, action: PayloadAction<'performance' | 'quality' | 'balanced'>) => {
      const preset = action.payload;
      
      switch (preset) {
        case 'performance':
          state.optimization = {
            ...state.optimization,
            lodLevel: 3,
            cullingEnabled: true,
            particleSystemEnabled: false,
            shadowsEnabled: false,
            bloomEnabled: false,
            antialiasingEnabled: false,
          };
          break;
          
        case 'quality':
          state.optimization = {
            ...state.optimization,
            lodLevel: 0,
            cullingEnabled: false,
            particleSystemEnabled: true,
            shadowsEnabled: true,
            bloomEnabled: true,
            antialiasingEnabled: true,
          };
          break;
          
        case 'balanced':
        default:
          state.optimization = {
            ...state.optimization,
            lodLevel: 1,
            cullingEnabled: true,
            particleSystemEnabled: true,
            shadowsEnabled: false,
            bloomEnabled: false,
            antialiasingEnabled: true,
          };
          break;
      }
      
      state.optimization.lastOptimization = Date.now();
    },
    
    // Benchmarking
    runBenchmark: (state) => {
      // This would trigger a benchmark sequence
      // Implementation would be handled by middleware or saga
    },
  },
});

export const {
  updateMetrics,
  updateSettings,
  updateOptimizationSettings,
  dismissWarning,
  clearWarnings,
  clearHistory,
  startProfiling,
  stopProfiling,
  addProfilingSample,
  clearProfilingSamples,
  resetOptimizations,
  applyOptimizationPreset,
  runBenchmark,
} = performanceSlice.actions;

export default performanceSlice.reducer;