/**
 * The graph controls dock (design-system/components/GraphControls): zoom in and out in ×1.25 steps between 25% and
 * 400%, fit the graph to the screen, reset the view, pause or resume the layout, the node and link count, and a
 * live line that announces each change. The canvas owner does the camera moves; this component only draws the
 * controls and reports clicks.
 */
import React from 'react';
import { SN, SnIcon } from '../lib/songnodes';
import { ZOOM_LIMITS } from '../lib/graphLayout';

/** GraphControls, Spec: one zoom step. */
export const ZOOM_STEP = 1.25;

/** The zoom after one step in (+1) or out (−1), kept inside 25–400%. */
export function zoomStep(k: number, direction: 1 | -1, limits = ZOOM_LIMITS): number {
  const next = direction > 0 ? k * ZOOM_STEP : k / ZOOM_STEP;
  return Math.min(limits.max, Math.max(limits.min, next));
}

/** Zoom as people read it ("125%"). */
export const zoomLabel = (k: number) => SN.format.percent(k);

/** Small tolerance so a zoom of 3.9999 still counts as the 400% limit. */
const atLimit = (k: number, limit: number) => Math.abs(k - limit) < 1e-3;

export interface GraphControlsDockProps {
  zoom: number;
  paused: boolean;
  nodes: number;
  links: number;
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

export const GraphControlsDock: React.FC<GraphControlsDockProps> = ({
  zoom, paused, nodes, links, announcement, onZoomIn, onZoomOut, onFit, onReset, onTogglePause,
}) => (
  <>
    {/* Above the PIXI canvas, which is added after these in the container. */}
    <div className="sn-graph-controls__count" style={{ zIndex: 'var(--z-sticky)' }}>
      {SN.format.count(nodes)} nodes · {SN.format.count(links)} links
    </div>
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
        <DockButton label="Zoom out" icon="zoom-out" onClick={onZoomOut} disabled={atLimit(zoom, ZOOM_LIMITS.min) || zoom < ZOOM_LIMITS.min} />
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

export default GraphControlsDock;
