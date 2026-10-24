import React, { useMemo } from 'react';
import { GraphEdge, GraphNode } from '../types';
import { useStore } from '../store/useStore';
import { ArrowDown } from 'lucide-react';
import { Bpm, KeyBadge } from '../lib/songnodes';
import { Dialog, TrackEnergy } from './ds';
import './EdgeDetailsModal.css';

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
          <p className="edm__id">Link ID <code>{edge.id}</code></p>
        </div>
      )}
    </Dialog>
  );
};
