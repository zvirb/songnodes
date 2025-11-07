import React, { useMemo } from 'react';
import { GraphEdge, GraphNode } from '../types';
import { useStore } from '../store/useStore';
import { X, Link2, TrendingUp, Palette, Eye } from 'lucide-react';

interface EdgeDetailsModalProps {
  edge: GraphEdge | null;
  onClose: () => void;
}

const getEdgeTypeLabel = (type: GraphEdge['type']): string => {
  const labels = {
    adjacency: 'Setlist Adjacency',
    similarity: 'Musical Similarity',
    collaboration: 'Artist Collaboration',
    genre: 'Genre Connection',
    key_compatibility: 'Harmonic Compatibility'
  };
  return labels[type] || type;
};

const getEdgeTypeDescription = (type: GraphEdge['type']): string => {
  const descriptions = {
    adjacency: 'These tracks appear consecutively in real-world DJ setlists',
    similarity: 'Tracks share similar musical characteristics (BPM, energy, mood)',
    collaboration: 'Artists have worked together or are closely related',
    genre: 'Tracks belong to the same or related genres',
    key_compatibility: 'Tracks are harmonically compatible for smooth mixing'
  };
  return descriptions[type] || 'Connection between tracks';
};

const getEdgeTypeColor = (type: GraphEdge['type']): string => {
  const colors = {
    adjacency: '#3b82f6',      // Blue
    similarity: '#10b981',      // Green
    collaboration: '#8b5cf6',   // Purple
    genre: '#f59e0b',           // Orange
    key_compatibility: '#ec4899' // Pink
  };
  return colors[type] || '#6b7280';
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!edge) return null;

  const typeColor = getEdgeTypeColor(edge.type);
  const strengthPercent = ((edge.strength || edge.weight) * 100).toFixed(0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>Connection Details</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close connection details">
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-content">
          {/* Edge Type */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: typeColor,
                  boxShadow: `0 0 8px ${typeColor}50`
                }}
              />
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                {getEdgeTypeLabel(edge.type)}
              </h4>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginLeft: '24px' }}>
              {getEdgeTypeDescription(edge.type)}
            </p>
          </div>

          {/* Connection Strength */}
          <div style={{ marginBottom: '24px' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={16} />
              Connection Strength
            </label>
            <div style={{ position: 'relative', height: '32px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${strengthPercent}%`,
                  backgroundColor: typeColor,
                  transition: 'width 0.3s ease',
                  opacity: 0.3
                }}
              />
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                {strengthPercent}%
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Weight</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{edge.weight.toFixed(3)}</div>
              </div>
              {edge.strength !== undefined && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Strength</div>
                  <div style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{edge.strength.toFixed(3)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Connected Tracks */}
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Link2 size={16} />
              Connected Tracks
            </label>

            {/* Source Track */}
            {sourceNode && (
              <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>Source</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{sourceNode.track?.name || sourceNode.label || 'Unknown Track'}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{sourceNode.track?.artist || 'Unknown Artist'}</div>
                {(sourceNode.track?.bpm || sourceNode.track?.key) && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                    {sourceNode.track?.bpm && <span>{sourceNode.track.bpm} BPM</span>}
                    {sourceNode.track?.key && <span>{sourceNode.track.key}</span>}
                    {sourceNode.track?.energy !== undefined && <span>Energy: {Math.round(sourceNode.track.energy * 100)}%</span>}
                  </div>
                )}
              </div>
            )}

            {/* Arrow */}
            <div style={{ textAlign: 'center', margin: '8px 0', color: typeColor, fontSize: '20px' }}>
              ↓
            </div>

            {/* Target Track */}
            {targetNode && (
              <div style={{ padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>Target</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{targetNode.track?.name || targetNode.label || 'Unknown Track'}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{targetNode.track?.artist || 'Unknown Artist'}</div>
                {(targetNode.track?.bpm || targetNode.track?.key) && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                    {targetNode.track?.bpm && <span>{targetNode.track.bpm} BPM</span>}
                    {targetNode.track?.key && <span>{targetNode.track.key}</span>}
                    {targetNode.track?.energy !== undefined && <span>Energy: {Math.round(targetNode.track.energy * 100)}%</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visual Properties */}
          {(edge.color || edge.opacity !== undefined || edge.distance !== undefined) && (
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Eye size={16} />
                Visual Properties
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                {edge.color && (
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Color</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '2px', backgroundColor: edge.color, border: '1px solid rgba(255, 255, 255, 0.2)' }} />
                      <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{edge.color}</span>
                    </div>
                  </div>
                )}
                {edge.opacity !== undefined && (
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Opacity</div>
                    <div style={{ fontSize: '14px', marginTop: '4px' }}>{(edge.opacity * 100).toFixed(0)}%</div>
                  </div>
                )}
                {edge.distance !== undefined && (
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Distance</div>
                    <div style={{ fontSize: '14px', marginTop: '4px' }}>{edge.distance.toFixed(1)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Technical ID */}
          <div style={{ marginTop: '16px', padding: '8px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>Edge ID</div>
            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>
              {edge.id}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: '8px' }}>
          Press <kbd>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
};
