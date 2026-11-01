/**
 * Graph layout from the design system (design-system/components/GraphStyles, "Layout: rings around one track",
 * DR-034): tracks sit on rings around one anchor track a regular distance apart, so names can be read and links
 * followed. Link strength is drawn as line weight, never as distance.
 *
 * Spacing comes from the graph tokens (graph-ring-first, graph-ring-step, graph-ring-aspect, graph-seat-gap) and
 * the seating is the bundle's reference implementation (SN.ringLayout, SN.seatBox). Nothing here picks its own
 * distances: a change to spacing is a change to the design system.
 */
import { SN } from './songnodes';
import type { GraphSeat } from '../styles/design-system/index';

const tokenNumber = (name: string): number | undefined => {
  if (typeof document === 'undefined') return undefined;
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--${name}`));
  return Number.isFinite(value) ? value : undefined;
};

/**
 * Ring spacing read from the tokens. A token that cannot be read is left undefined, so SN.ringLayout uses its own
 * defaults, which are the same spec values (58 / 40 / 1.7 / 30).
 */
export function ringSpacing(read: (name: string) => number | undefined = tokenNumber) {
  return {
    first: read('graph-ring-first'),
    step: read('graph-ring-step'),
    aspect: read('graph-ring-aspect'),
    seatGap: read('graph-seat-gap'),
  };
}

/** GraphStyles, Nodes, Size: radius = clamp(4, 4 + 20 × √(links ÷ most links), 24) px. */
export const NODE_RADIUS = { min: 4, span: 20, max: 24 } as const;

export function nodeRadius(links: number, mostLinks: number): number {
  const share = mostLinks > 0 ? Math.sqrt(Math.max(0, links) / mostLinks) : 0;
  return Math.min(NODE_RADIUS.max, Math.max(NODE_RADIUS.min, NODE_RADIUS.min + NODE_RADIUS.span * share));
}

export interface SeatTrack {
  id: string;
  /** Width of the track's label at 100% in CSS px (GraphStyles, Seat box). */
  labelWidth?: number;
  /** The seat the track holds now; kept while the anchor stays the same. */
  seat?: GraphSeat;
}

export interface SeatLink { source: string; target: string; weight: number }

export interface Seating {
  seats: Record<string, GraphSeat>;
  radius: Record<string, number>;
  anchor: string | null;
}

/**
 * Seat every track on the rings. The anchor is now playing when there is one; otherwise SN.ringLayout takes the
 * track with the most links (whole-library view). Same input, same seats.
 */
export function seatTracks(tracks: SeatTrack[], links: SeatLink[], nowPlayingId: string | null = null, spacing = ringSpacing()): Seating {
  const ids = new Set(tracks.map((t) => t.id));
  const used = links.filter((l) => ids.has(l.source) && ids.has(l.target) && l.source !== l.target);
  const degree: Record<string, number> = {};
  used.forEach((l) => {
    degree[l.source] = (degree[l.source] ?? 0) + 1;
    degree[l.target] = (degree[l.target] ?? 0) + 1;
  });
  const most = Math.max(0, ...Object.values(degree));
  const radius: Record<string, number> = {};
  const prev: Record<string, GraphSeat> = {};
  const nodes = tracks.map((t) => {
    radius[t.id] = nodeRadius(degree[t.id] ?? 0, most);
    if (t.seat) prev[t.id] = t.seat;
    return { id: t.id, box: SN.seatBox(radius[t.id], t.labelWidth, t.id === nowPlayingId) };
  });
  const anchor = nowPlayingId && ids.has(nowPlayingId) ? nowPlayingId : undefined;
  const { pos, anchor: chosen } = SN.ringLayout(nodes, used, { ...spacing, anchor, prev });
  return { seats: pos, radius, anchor: chosen == null ? null : String(chosen) };
}

/** GraphControls, Spec: zoom runs from 25% to 400%. */
export const ZOOM_LIMITS = { min: 0.25, max: 4 } as const;

export interface FitTransform { x: number; y: number; k: number }

/**
 * The camera that fits every track in the canvas ("Fit the whole graph in view", GraphControls). Points are seat
 * centres with their radius; `pad` is kept clear on every side. x/y are offsets from the canvas centre, because
 * the PIXI stage is already centred (stage = centre + offset).
 */
export function fitTransform(
  points: Array<{ x: number; y: number; r?: number }>,
  viewport: { width: number; height: number },
  pad: number,
  limits: { min: number; max: number } = ZOOM_LIMITS,
): FitTransform | null {
  if (!points.length || viewport.width <= 0 || viewport.height <= 0) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  points.forEach(({ x, y, r = 0 }) => {
    minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r);
  });
  const roomW = Math.max(1, viewport.width - 2 * pad);
  const roomH = Math.max(1, viewport.height - 2 * pad);
  const fit = Math.min(roomW / Math.max(1, maxX - minX), roomH / Math.max(1, maxY - minY));
  const k = Math.min(limits.max, Math.max(limits.min, fit));
  return { x: -((minX + maxX) / 2) * k, y: -((minY + maxY) / 2) * k, k };
}

/** One coordinate of a cubic Bézier from (0, 0) to (1, 1) with control values a and b, at parameter s. */
const bezierAt = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;

/**
 * An easing function from a CSS `cubic-bezier(x1, y1, x2, y2)` token value (for example ease-standard), for d3
 * transitions. Anything else falls back to linear.
 */
export function cssEase(value: string): (t: number) => number {
  const m = /cubic-bezier\(([^)]+)\)/.exec(value);
  const p = m ? m[1].split(',').map(Number) : [];
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return (t) => t;
  const [x1, y1, x2, y2] = p;
  return (t) => {
    if (t <= 0 || t >= 1) return Math.min(1, Math.max(0, t));
    let lo = 0, hi = 1, s = t;
    for (let i = 0; i < 30; i++) {
      s = (lo + hi) / 2;
      if (bezierAt(x1, x2, s) < t) lo = s; else hi = s;
    }
    return bezierAt(y1, y2, s);
  };
}
