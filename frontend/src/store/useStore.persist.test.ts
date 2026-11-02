/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { useStore } from './useStore';

// The graph camera is never kept between visits (GR1): /graph opens fitted, so a stored pan from an older
// session no longer trips "Detected extreme viewport values" on every load.
describe('useStore persistence of the graph camera', () => {
  it('stores pan 0, 0 and the default zoom, whatever the camera is now', () => {
    useStore.getState().view.updateViewport(0.3, { x: -56522, y: 45250 });
    const stored = useStore.persist.getOptions().partialize!(useStore.getState()) as { viewState: { pan: unknown; zoom: number } };
    expect(stored.viewState.pan).toEqual({ x: 0, y: 0 });
    expect(stored.viewState.zoom).toBe(1);
  });

  it('drops a camera stored by an older version without a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('songnodes-store', JSON.stringify({
      state: { viewState: { ...useStore.getState().viewState, selectedNodes: [], hiddenEdgeTypes: [], pan: { x: -56522, y: 45250 }, zoom: 0.1 } },
      version: 6,
    }));
    await useStore.persist.rehydrate();
    expect(useStore.getState().viewState.pan).toEqual({ x: 0, y: 0 });
    expect(useStore.getState().viewState.zoom).toBe(1);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('extreme viewport'))).toBe(false);
    warn.mockRestore();
  });
});
