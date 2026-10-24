import React, { useMemo } from 'react';
import { GraphEdge } from '../types';
import { useStore } from '../store/useStore';
import { Link2, TrendingUp, Eye } from 'lucide-react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  Button,
} from './ui';

interface EdgeDetailsModalProps {
  edge: GraphEdge | null;
  onClose: () => void;
}

const getEdgeTypeLabel = (type: GraphEdge['type']): string => {
  const labels: Record<string, string> = {
    adjacency: 'Setlist Adjacency',
    similarity: 'Musical Similarity',
    collaboration: 'Artist Collaboration',
    genre: 'Genre Connection',
    key_compatibility: 'Harmonic Compatibility',
  };
  return labels[type] || type;
};

const getEdgeTypeDescription = (type: GraphEdge['type']): string => {
  const descriptions: Record<string, string> = {
    adjacency: 'These tracks appear consecutively in real-world DJ setlists',
    similarity: 'Tracks share similar musical characteristics (BPM, energy, mood)',
    collaboration: 'Artists have worked together or are closely related',
    genre: 'Tracks belong to the same or related genres',
    key_compatibility: 'Tracks are harmonically compatible for smooth mixing',
  };
  return descriptions[type] || 'Connection between tracks';
};

const getEdgeTypeColor = (type: GraphEdge['type']): string => {
  const colors: Record<string, string> = {
    adjacency: 'var(--color-brand-secondary)',
    similarity: 'var(--color-success)',
    collaboration: '#8b5cf6',
    genre: '#f59e0b',
    key_compatibility: '#ec4899',
  };
  return colors[type] || 'var(--color-text-secondary)';
};

export const EdgeDetailsModal: React.FC<EdgeDetailsModalProps> = ({ edge, onClose }) => {
  const graphData = useStore((state) => state.graphData);

  // Find source and target nodes
  const { sourceNode, targetNode } = useMemo(() => {
    if (!edge || !graphData.nodes) {
      return { sourceNode: null, targetNode: null };
    }

    const source = graphData.nodes.find((n) => n.id === edge.source);
    const target = graphData.nodes.find((n) => n.id === edge.target);

    return { sourceNode: source, targetNode: target };
  }, [edge, graphData.nodes]);

  if (!edge) return null;

  const typeColor = getEdgeTypeColor(edge.type);
  const strengthPercent = ((edge.strength || edge.weight) * 100).toFixed(0);

  return (
    <Modal open={!!edge} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalContent size="md" className="p-6">
        <ModalHeader className="pb-4 border-b border-[var(--color-border-subtle)]">
          <ModalTitle>Connection Details</ModalTitle>
        </ModalHeader>

        <ModalBody className="space-y-6 pt-4">
          {/* Edge Type */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: typeColor }}
              />
              <h4 className="text-[var(--font-size-lg)] font-bold text-[var(--color-text-primary)]">
                {getEdgeTypeLabel(edge.type)}
              </h4>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] pl-6">
              {getEdgeTypeDescription(edge.type)}
            </p>
          </div>

          {/* Connection Strength */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <TrendingUp size={16} />
              Connection Strength
            </label>
            <div className="relative h-8 bg-[var(--color-bg-elevated-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-base)] overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 transition-all duration-300 opacity-40"
                style={{
                  width: `${strengthPercent}%`,
                  backgroundColor: typeColor,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[var(--color-text-primary)]">
                {strengthPercent}%
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-xs text-[var(--color-text-tertiary)]">Weight</div>
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{edge.weight.toFixed(3)}</div>
              </div>
              {edge.strength !== undefined && (
                <div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">Strength</div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">{edge.strength.toFixed(3)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Connected Tracks */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Link2 size={16} />
              Connected Tracks
            </label>

            {/* Source Track */}
            {sourceNode && (
              <div className="p-3 bg-[var(--color-bg-elevated-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-card)]">
                <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Source</div>
                <div className="text-sm font-bold text-[var(--color-text-primary)]">
                  {sourceNode.track?.name || sourceNode.label || 'Unknown Track'}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {sourceNode.track?.artist || 'Unknown Artist'}
                </div>
                {(sourceNode.track?.bpm || sourceNode.track?.key) && (
                  <div className="flex gap-3 mt-2 text-xs text-[var(--color-text-tertiary)]">
                    {sourceNode.track?.bpm && <span>{sourceNode.track.bpm} BPM</span>}
                    {sourceNode.track?.key && <span>{sourceNode.track.key}</span>}
                    {sourceNode.track?.energy !== undefined && (
                      <span>Energy: {Math.round(sourceNode.track.energy * 100)}%</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Direction Indicator */}
            <div className="text-center text-lg font-bold" style={{ color: typeColor }}>
              ↓
            </div>

            {/* Target Track */}
            {targetNode && (
              <div className="p-3 bg-[var(--color-bg-elevated-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-card)]">
                <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Target</div>
                <div className="text-sm font-bold text-[var(--color-text-primary)]">
                  {targetNode.track?.name || targetNode.label || 'Unknown Track'}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {targetNode.track?.artist || 'Unknown Artist'}
                </div>
                {(targetNode.track?.bpm || targetNode.track?.key) && (
                  <div className="flex gap-3 mt-2 text-xs text-[var(--color-text-tertiary)]">
                    {targetNode.track?.bpm && <span>{targetNode.track.bpm} BPM</span>}
                    {targetNode.track?.key && <span>{targetNode.track.key}</span>}
                    {targetNode.track?.energy !== undefined && (
                      <span>Energy: {Math.round(targetNode.track.energy * 100)}%</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visual Properties */}
          {(edge.color || edge.opacity !== undefined || edge.distance !== undefined) && (
            <div className="pt-4 border-t border-[var(--color-border-subtle)] space-y-2">
              <label className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <Eye size={16} />
                Visual Properties
              </label>
              <div className="grid grid-cols-3 gap-3">
                {edge.color && (
                  <div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">Color</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-4 h-4 rounded border border-[var(--color-border-default)]"
                        style={{ backgroundColor: edge.color }}
                      />
                      <span className="text-xs font-mono text-[var(--color-text-primary)]">{edge.color}</span>
                    </div>
                  </div>
                )}
                {edge.opacity !== undefined && (
                  <div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">Opacity</div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                      {(edge.opacity * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
                {edge.distance !== undefined && (
                  <div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">Distance</div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                      {edge.distance.toFixed(1)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Technical ID */}
          <div className="p-2.5 bg-[var(--color-bg-elevated-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-base)]">
            <div className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-semibold mb-1">
              Edge ID
            </div>
            <div className="text-xs font-mono text-[var(--color-text-secondary)] break-all">
              {edge.id}
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="pt-4 border-t border-[var(--color-border-subtle)] justify-between items-center">
          <div className="text-xs text-[var(--color-text-tertiary)]">
            Press <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-elevated-3)] rounded text-[var(--color-text-secondary)] font-mono">Esc</kbd> to close
          </div>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
