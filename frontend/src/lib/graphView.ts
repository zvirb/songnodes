/**
 * The graph View choice (design-system/components/GraphControls, "View", DR-057): the anchor's neighbourhood
 * (default) or the whole library. Neighbourhood draws the anchor and the tracks within graph-hood-steps links, at
 * most graph-hood-max, strongest link first (SN.neighbourhood). Whole library draws every track, and its Fit may
 * go below the 25% zoom floor.
 */
import { SN } from './songnodes';
import { ZOOM_LIMITS } from './graphLayout';

export type GraphView = 'neighbourhood' | 'library';

export const GRAPH_VIEWS: Array<{ id: GraphView; label: string }> = [
  { id: 'neighbourhood', label: 'Neighbourhood' },
  { id: 'library', label: 'Whole library' },
];

/** The choice is remembered per device (GraphControls). Storage can be missing or blocked; the default then holds. */
const STORE_KEY = 'sn-graph-view';

export function readGraphView(): GraphView {
  try {
    return localStorage.getItem(STORE_KEY) === 'library' ? 'library' : 'neighbourhood';
  } catch {
    return 'neighbourhood';
  }
}

export function storeGraphView(view: GraphView): void {
  try {
    localStorage.setItem(STORE_KEY, view);
  } catch {
    // Not remembered on this device; the view still changes.
  }
}

const tokenNumber = (name: string): number | undefined => {
  if (typeof document === 'undefined') return undefined;
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--${name}`));
  return Number.isFinite(value) ? value : undefined;
};

/** graph-hood-steps and graph-hood-max; a token that cannot be read leaves SN.neighbourhood's own default (3, 200). */
export function hoodSize(read: (name: string) => number | undefined = tokenNumber) {
  return { steps: read('graph-hood-steps'), max: read('graph-hood-max') };
}

export interface ViewTracks {
  /** Tracks to seat and draw; null = every track. */
  ids: Set<string> | null;
  /** The anchor the view was cut around (neighbourhood only). */
  anchor: string | null;
  /** The neighbourhood cap cut tracks off. */
  capped: boolean;
}

/** Which tracks the view draws, around `anchor` (null: SN.neighbourhood takes the most-linked track, as the ring layout does). */
export function viewTracks(
  view: GraphView,
  ids: string[],
  links: Array<{ source: string; target: string; weight: number }>,
  anchor: string | null,
  size = hoodSize(),
): ViewTracks {
  if (view === 'library') return { ids: null, anchor, capped: false };
  const hood = SN.neighbourhood(ids.map((id) => ({ id })), links, { anchor: anchor ?? undefined, steps: size.steps, max: size.max });
  return { ids: new Set(hood.ids.map(String)), anchor: hood.anchor == null ? null : String(hood.anchor), capped: hood.capped };
}

/**
 * The zoom range for a view. Neighbourhood keeps 25–400%. Whole library lets Fit go below 25%, and the fitted zoom
 * then becomes the zoom-out limit (GraphControls, Spec).
 */
export function zoomRange(view: GraphView, fitZoom: number | null): { min: number; max: number } {
  if (view === 'library' && fitZoom != null && fitZoom < ZOOM_LIMITS.min) return { min: fitZoom, max: ZOOM_LIMITS.max };
  return { min: ZOOM_LIMITS.min, max: ZOOM_LIMITS.max };
}

/** The lowest zoom Fit may use in a view (Whole library: well below 25%, so any library fits). */
export const fitFloor = (view: GraphView) => (view === 'library' ? 0.001 : ZOOM_LIMITS.min);

/** Below 25% a node is drawn at least 1.5px in radius on screen, so the shape of the library still reads. */
export const MIN_SCREEN_RADIUS = 1.5;

export function drawnRadius(radius: number, zoom: number): number {
  return zoom < ZOOM_LIMITS.min && zoom > 0 ? Math.max(radius, MIN_SCREEN_RADIUS / zoom) : radius;
}

/** Below 25% labels show only for hovered, selected and now playing tracks. */
export const labelsForAll = (zoom: number) => zoom >= ZOOM_LIMITS.min;
