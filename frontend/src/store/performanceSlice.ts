
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PerformanceState {
  fps: number;
  memory: number;
  gpu: string;
}

const initialState: PerformanceState = {
  fps: 60,
  memory: 45,
  gpu: 'WebGL',
};

const performanceSlice = createSlice({
  name: 'performance',
  initialState,
  reducers: {
    setPerformance: (state, action: PayloadAction<PerformanceState>) => {
      state.fps = action.payload.fps;
      state.memory = action.payload.memory;
      state.gpu = action.payload.gpu;
    },
  },
});

export const { setPerformance } = performanceSlice.actions;
export default performanceSlice.reducer;
