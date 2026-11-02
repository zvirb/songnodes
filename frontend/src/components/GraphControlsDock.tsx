/**
 * The graph controls dock (design-system/components/GraphControls): zoom in and out in ×1.25 steps between 25% and
 * 400%, fit the graph to the screen, reset the view, pause or resume the layout, the node and link count, and a
 * live line that announces each change. The canvas owner does the camera moves; this component only draws the
 * controls and reports clicks.
 */
import React, { useEffect } from 'react';
import { SN, SnIcon } from '../lib/songnodes';
import { ZOOM_LIMITS } from '../lib/graphLayout';
import { GRAPH_VIEWS, type GraphView } from '../lib/graphView';

/** GraphControls, Spec: one zoom step. */
export const ZOOM_STEP = 1.25;

/** The zoom after one step in (+1) or out (−1), kept inside 25–400% (or the Whole library view's fitted limit). */
export function zoomStep(k: number, direction: 1 | -1, limits: { min: number; max: number } = ZOOM_LIMITS): number {
  const next = direction > 0 ? k * ZOOM_STEP : k / ZOOM_STEP;
  return Math.min(limits.max, Math.max(limits.min, next));
}

/** Zoom as people read it ("125%"). */
export const zoomLabel = (k: number) => SN.format.percent(k);

/** Small tolerance so a zoom of 3.9999 still counts as the 400% limit (relative, so a 2% fitted limit works too). */
const atLimit = (k: number, limit: number) => Math.abs(k - limit) < limit * 1e-3;

export interface GraphControlsDockProps {
  zoom: number;
  /** Zoom-out limit: 25%, or the fitted zoom in the Whole library view (GraphControls, View). */
  minZoom?: number;
  paused: boolean;
  /** Tracks and links drawn in the current view. */
  nodes: number;
  links: number;
  /** Tracks in the library, when the neighbourhood cap cut some off ("200 of 1,284 nodes"). */
  ofNodes?: number;
  view?: GraphView;
  onViewChange?: (view: GraphView) => void;
  /** The live line ("Zoom 125%", "Layout paused"). */
  announcement: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onTogglePause: () => void;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

const DockButton: React.FC<{ label: string; icon: string; onClick: () => void; disabled?: boolean }> = ({ label, icon, onClick, disabled }) => (
  <button type="button" className="sn-btn sn-btn--icon" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
    <SnIcon name={icon} />
  </button>
);

/** InfoTip on a cut neighbourhood (GraphControls → View). */
const HOOD_TIP = (max: number) => SN.infoTip({
  id: 'graph-hood-tip', about: 'Why only some tracks show',
  text: `The ${SN.format.count(max)} tracks with the strongest links to the anchor. Switch the view to Whole library to see every track.`,
});

export const GraphControlsDock: React.FC<GraphControlsDockProps> = ({
  zoom, minZoom = ZOOM_LIMITS.min, paused, nodes, links, ofNodes, view, onViewChange, announcement,
  onZoomIn, onZoomOut, onFit, onReset, onTogglePause,
}) => {
  const capped = ofNodes != null && ofNodes > nodes;
  useEffect(() => { if (capped) SN.infoTips(); }, [capped]);
  return (
  <>
    {/* Above the PIXI canvas, which is added after these in the container. */}
    <div className="sn-graph-controls__count" style={{ zIndex: 'var(--z-sticky)' }}>
      {capped ? `${SN.format.count(nodes)} of ${SN.format.count(ofNodes)}` : SN.format.count(nodes)} nodes · {SN.format.count(links)} links
      {capped && <span dangerouslySetInnerHTML={{ __html: HOOD_TIP(nodes) }} />}
    </div>
    {view && onViewChange && (
      // The top-right panel (GraphControls anatomy); it holds only View until Colour by is built.
      <div className="sn-graph-controls__colour" onPointerDown={stop} onWheel={stop} onClick={stop}>
        <span className="sn-graph-controls__colour-label" id="graph-view-label">View</span>
        <div className="sn-seg" role="group" aria-labelledby="graph-view-label">
          {GRAPH_VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => onViewChange(v.id)}>{v.label}</button>
          ))}
        </div>
      </div>
    )}
    {paused && (
      <div
        className="sn-graph-controls__status"
        style={{ position: 'absolute', top: 'var(--space-3)', left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--z-sticky)' }}
      >
        <span className="sn-pill" data-status="idle">Layout paused</span>
      </div>
    )}
    {/* Pointer, wheel and double-click on the dock must not reach the canvas zoom behind it. */}
    <div
      className="sn-graph-controls__dock"
      role="group"
      aria-label="Graph controls"
      onPointerDown={stop}
      onMouseDown={stop}
      onWheel={stop}
      onDoubleClick={stop}
      onClick={stop}
    >
      <div className="sn-graph-controls__group">
        <DockButton label="Zoom in" icon="zoom-in" onClick={onZoomIn} disabled={atLimit(zoom, ZOOM_LIMITS.max) || zoom > ZOOM_LIMITS.max} />
        <div className="sn-graph-controls__zoom" aria-hidden="true">{zoomLabel(zoom)}</div>
        <DockButton label="Zoom out" icon="zoom-out" onClick={onZoomOut} disabled={atLimit(zoom, minZoom) || zoom < minZoom} />
        <DockButton label="Fit graph to screen" icon="maximize-2" onClick={onFit} disabled={nodes === 0} />
        <DockButton label="Reset view" icon="rotate-ccw" onClick={onReset} />
      </div>
      <div className="sn-graph-controls__group">
        <DockButton label={paused ? 'Resume layout' : 'Pause layout'} icon={paused ? 'play' : 'pause'} onClick={onTogglePause} />
      </div>
    </div>
    <p className="sn-sr" aria-live="polite">{announcement}</p>
  </>
  );
};

export default GraphControlsDock;
