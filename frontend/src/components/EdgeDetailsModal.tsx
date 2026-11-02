import React, { useEffect, useMemo, useState } from 'react';
import { GraphEdge, GraphNode } from '../types';
import { useStore } from '../store/useStore';
import { ArrowDown } from 'lucide-react';
import { Bpm, KeyBadge, SN, type CompatLevel } from '../lib/songnodes';
import { CompatibilityBadge, Dialog, TrackEnergy } from './ds';
import './EdgeDetailsModal.css';

/** Stored harmonic scoring of an observed edge (graph API `scoring`, spec harmonic-1 section 2.7). Null when unscored. */
export interface EdgeScoring {
  key_relation: string | null; key_level: CompatLevel | null;
  bpm_relation: string | null; bpm_gap: number | null; bpm_level: CompatLevel | null;
  energy_move: string | null; scored_at: string | null;
}

type ScoringState = { status: 'loading' } | { status: 'error'; cause: string } | { status: 'ready'; scoring: EdgeScoring | null };
type ApiEdges = { edges?: Array<{ source: string; target: string; scoring?: EdgeScoring }> };

const none = <span className="sn-none">–</span>;

/** The stored scoring of the directed edge source → target, read from the graph API (never recomputed here). */
const useStoredScoring = (edge: GraphEdge | null): ScoringState => {
  const [answer, setAnswer] = useState<{ id: string; state: ScoringState } | null>(null);
  useEffect(() => {
    if (!edge) return undefined;
    const controller = new AbortController();
    const settle = (state: ScoringState) => setAnswer({ id: edge.id, state });
    const ids = [edge.source, edge.target].map(encodeURIComponent).join(',');
    fetch(`/api/graph/edges?node_ids=${ids}&limit=2`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The graph API answered ${response.status}`);
        const data: ApiEdges = await response.json();
        const found = (data.edges || []).find((e) => e.source === edge.source && e.target === edge.target);
        settle({ status: 'ready', scoring: found?.scoring ?? null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) settle({ status: 'error', cause: error instanceof Error ? error.message : 'The graph API did not answer' });
      });
    return () => controller.abort();
  }, [edge]);
  return answer && edge && answer.id === edge.id ? answer.state : { status: 'loading' };
};

/** The stored level is the verdict; the words are the design system's for the tracks' values only when they give that
 *  same verdict, otherwise the badge names the stored level alone. */
const keyBadge = (s: EdgeScoring, from?: string, to?: string) => {
  if (!s.key_level) return none;
  if (s.key_level === 'unknown') return <CompatibilityBadge level="unknown" label="key ?" />;
  const words = from && to ? SN.compat(from, to) : null;
  return <CompatibilityBadge level={s.key_level} label={words?.level === s.key_level ? words.label : undefined} />;
};

const bpmBadge = (s: EdgeScoring, from?: number, to?: number) => {
  if (!s.bpm_level) return none;
  if (s.bpm_level === 'unknown') return <CompatibilityBadge level="unknown" label="BPM ?" />;
  const words = from != null && to != null ? SN.bpmStep(from, to) : null;
  const same = words?.level === s.bpm_level && words.relation === s.bpm_relation && words.gap === s.bpm_gap;
  return <CompatibilityBadge level={s.bpm_level} label={same && words ? words.label : undefined} />;
};

const energyBadge = (s: EdgeScoring) => {
  if (!s.energy_move) return none;
  const move = SN.energyMove(s.energy_move);
  return <CompatibilityBadge level={move.level} label={move.label} />;
};

interface EdgeDetailsModalProps {
  edge: GraphEdge | null;
  onClose: () => void;
}

const getEdgeTypeLabel = (type: GraphEdge['type']): string => {
  const labels = {
    adjacency: 'Played back to back in a set',
    similarity: 'Similar sound',
    collaboration: 'Same artists',
    genre: 'Same genre',
    key_compatibility: 'Compatible key'
  };
  return labels[type] || type;
};

const getEdgeTypeDescription = (type: GraphEdge['type']): string => {
  const descriptions = {
    adjacency: 'DJs have played these two tracks one after the other in real sets.',
    similarity: 'The tracks share tempo and energy.',
    collaboration: 'The artists have worked together.',
    genre: 'The tracks are in the same or a related genre.',
    key_compatibility: 'The keys mix cleanly on the Camelot wheel.'
  };
  return descriptions[type] || 'Connection between tracks';
};

export const EdgeDetailsModal: React.FC<EdgeDetailsModalProps> = ({ edge, onClose }) => {
  const graphData = useStore(state => state.graphData);

  // Find source and target nodes
  const { sourceNode, targetNode } = useMemo(() => {
    if (!edge || !graphData.nodes) {
      return { sourceNode: null, targetNode: null };
    }

    const source = graphData.nodes.find(n => n.id === edge.source);
    const target = graphData.nodes.find(n => n.id === edge.target);

    return { sourceNode: source, targetNode: target };
  }, [edge, graphData.nodes]);
  const stored = useStoredScoring(edge);

  const trackBlock = (label: string, node?: GraphNode | null) => {
    if (!node) return null;
    const t = node.track;
    const name = t?.name || node.label;
    const artist = t?.artist;
    return (
      <div className="edm__track">
        <span className="edm__label">{label}</span>
        <div className="sn-track-cell">
          <span className="sn-track-cell__title">
            <span className="sn-track-cell__name">
              {artist ? <span className="sn-track-cell__artist">{artist} –</span> : null} {name || <span className="sn-none">–</span>}
            </span>
          </span>
          <span className="sn-track-cell__meta">
            <Bpm value={t?.bpm} />
            <span className="sn-track-cell__sep" aria-hidden="true">·</span>
            <KeyBadge value={t?.camelotKey || t?.key} />
            <span className="sn-track-cell__sep" aria-hidden="true">·</span>
            <TrackEnergy energy={t?.energy} scale={(t as { energy_scale?: string } | undefined)?.energy_scale} />
          </span>
        </div>
      </div>
    );
  };

  const scoringBlock = () => {
    if (stored.status === 'loading') return <p className="edm__text">Loading the stored scoring…</p>;
    if (stored.status === 'error') return <p className="edm__text" role="alert">Stored scoring did not load: {stored.cause}.</p>;
    const s = stored.scoring;
    if (!s) return <p className="edm__text">No stored scoring: this link is not an observed transition.</p>;
    const from = sourceNode?.track, to = targetNode?.track;
    return (
      <>
        <dl className="edm__facts" aria-label="Stored scoring">
          <div><dt>Key</dt><dd>{keyBadge(s, from?.camelotKey || from?.key, to?.camelotKey || to?.key)}</dd></div>
          <div><dt>BPM</dt><dd>{bpmBadge(s, from?.bpm, to?.bpm)}</dd></div>
          <div><dt>Energy</dt><dd>{energyBadge(s)}</dd></div>
        </dl>
        {!s.scored_at && <p className="edm__text">Not scored yet.</p>}
      </>
    );
  };

  return (
    <Dialog open={!!edge} title="Connection details" sub={edge ? getEdgeTypeLabel(edge.type) : undefined} size="s" onClose={onClose}
      footer={<button type="button" className="sn-btn" onClick={onClose}>Close</button>}
    >
      {edge && (
        <div className="edm">
          <p className="edm__text">{getEdgeTypeDescription(edge.type)}</p>
          {trackBlock('From', sourceNode)}
          <span className="edm__arrow" aria-hidden="true"><ArrowDown size={16} strokeWidth={2} /></span>
          {trackBlock('To', targetNode)}
          <dl className="edm__facts">
            <div><dt>Weight</dt><dd>{edge.weight.toFixed(3)}</dd></div>
            {edge.strength !== undefined && <div><dt>Strength</dt><dd>{edge.strength.toFixed(3)}</dd></div>}
            {edge.distance !== undefined && <div><dt>Distance</dt><dd>{edge.distance.toFixed(1)}</dd></div>}
          </dl>
          {scoringBlock()}
          <p className="edm__id">Link ID <code>{edge.id}</code></p>
        </div>
      )}
    </Dialog>
  );
};
