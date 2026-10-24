import React, { useMemo } from 'react';
import { GraphEdge } from '../types';
import { useStore } from '../store/useStore';
import { Link2, TrendingUp, Eye } from 'lucide-react';
import { HarmonicCompatibility } from './HarmonicCompatibility';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from './ui/Modal';
import { Button } from './ui/Button';

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
    adjacency: 'var(--color-brand-primary, #3b82f6)',
    similarity: 'var(--color-success, #10b981)',
    collaboration: '#8b5cf6',
    genre: '#f59e0b',
    key_compatibility: '#ec4899',
  };
  return colors[type] || 'var(--color-text-disabled, #6b7280)';
};

export const EdgeDetailsModal: React.FC<EdgeDetailsModalProps> = ({
  edge,
  onClose,
}) => {
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
  const strengthPercent = Math.min(
    100,
    Math.max(0, Math.round((edge.strength || edge.weight) * 100))
  );

  // Calculate BPM difference
  const bpmDiff =
    sourceNode?.track?.bpm && targetNode?.track?.bpm
      ? Math.abs(sourceNode.track.bpm - targetNode.track.bpm)
      : null;

  return (
    <Modal open={Boolean(edge)} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Connection Details</ModalTitle>
          <ModalDescription>
            Inspect the transition strength and relationship metrics between two nodes.
          </ModalDescription>
        </ModalHeader>

        <ModalBody className="space-y-6">
          {/* Edge Type Badge & Description */}
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4">
            <div className="mb-2 flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: typeColor }}
              />
              <h4 className="text-base font-bold text-[var(--color-text-primary)]">
                {getEdgeTypeLabel(edge.type)}
              </h4>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] pl-6">
              {getEdgeTypeDescription(edge.type)}
            </p>
          </div>

          {/* Connection Strength & Harmonized Metrics */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <TrendingUp size={16} className="text-[var(--color-brand-primary)]" />
              <span>Transition Metrics</span>
            </div>

            {/* Strength Bar */}
            <div className="relative h-8 overflow-hidden rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)]">
              <div
                className="absolute inset-y-0 left-0 transition-all duration-300 opacity-30"
                style={{
                  width: `${strengthPercent}%`,
                  backgroundColor: typeColor,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--color-text-primary)]">
                {strengthPercent}% Transition Probability
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-2.5 text-center">
                <div className="text-[10px] uppercase font-semibold text-[var(--color-text-tertiary)]">
                  Weight
                </div>
                <div className="text-sm font-mono font-bold text-[var(--color-text-primary)]">
                  {edge.weight.toFixed(3)}
                </div>
              </div>

              {edge.strength !== undefined && (
                <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-2.5 text-center">
                  <div className="text-[10px] uppercase font-semibold text-[var(--color-text-tertiary)]">
                    Strength
                  </div>
                  <div className="text-sm font-mono font-bold text-[var(--color-text-primary)]">
                    {edge.strength.toFixed(3)}
                  </div>
                </div>
              )}

              {bpmDiff !== null && (
                <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-2.5 text-center">
                  <div className="text-[10px] uppercase font-semibold text-[var(--color-text-tertiary)]">
                    BPM Delta
                  </div>
                  <div className="text-sm font-mono font-bold text-[var(--color-brand-primary)]">
                    ±{bpmDiff.toFixed(1)}
                  </div>
                </div>
              )}

              {sourceNode?.track?.key && targetNode?.track?.key && (
                <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-2.5 flex flex-col items-center justify-center">
                  <div className="text-[10px] uppercase font-semibold text-[var(--color-text-tertiary)] mb-1">
                    Harmonic Gap
                  </div>
                  <HarmonicCompatibility
                    currentKey={sourceNode.track.key as any}
                    targetKey={targetNode.track.key as any}
                    size="small"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Connected Tracks */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <Link2 size={16} className="text-[var(--color-brand-primary)]" />
              <span>Connected Tracks</span>
            </div>

            {/* Source Track */}
            {sourceNode && (
              <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-3">
                <div className="mb-1 text-[10px] uppercase font-semibold tracking-wider text-[var(--color-text-tertiary)]">
                  Source Node
                </div>
                <div className="text-sm font-bold text-[var(--color-text-primary)]">
                  {sourceNode.track?.name || sourceNode.label || 'Unknown Track'}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {sourceNode.track?.artist || 'Unknown Artist'}
                </div>
                {(sourceNode.track?.bpm || sourceNode.track?.key) && (
                  <div className="mt-2 flex gap-3 text-xs text-[var(--color-text-tertiary)]">
                    {sourceNode.track?.bpm && (
                      <span className="font-mono">{sourceNode.track.bpm} BPM</span>
                    )}
                    {sourceNode.track?.key && <span>{sourceNode.track.key}</span>}
                    {sourceNode.track?.energy !== undefined && (
                      <span>Energy: {Math.round(sourceNode.track.energy * 100)}%</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Transition Direction Indicator */}
            <div
              className="text-center font-bold text-lg"
              style={{ color: typeColor }}
            >
              ↓
            </div>

            {/* Target Track */}
            {targetNode && (
              <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-3">
                <div className="mb-1 text-[10px] uppercase font-semibold tracking-wider text-[var(--color-text-tertiary)]">
                  Target Node
                </div>
                <div className="text-sm font-bold text-[var(--color-text-primary)]">
                  {targetNode.track?.name || targetNode.label || 'Unknown Track'}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {targetNode.track?.artist || 'Unknown Artist'}
                </div>
                {(targetNode.track?.bpm || targetNode.track?.key) && (
                  <div className="mt-2 flex gap-3 text-xs text-[var(--color-text-tertiary)]">
                    {targetNode.track?.bpm && (
                      <span className="font-mono">{targetNode.track.bpm} BPM</span>
                    )}
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
            <div className="pt-3 border-t border-[var(--color-border-subtle)] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                <Eye size={14} />
                <span>Visual Graph Properties</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {edge.color && (
                  <div className="rounded bg-[var(--color-bg-secondary)] p-2">
                    <div className="text-[10px] text-[var(--color-text-tertiary)]">Color</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-xs border border-[var(--color-border-subtle)]"
                        style={{ backgroundColor: edge.color }}
                      />
                      <span className="font-mono text-xs">{edge.color}</span>
                    </div>
                  </div>
                )}
                {edge.opacity !== undefined && (
                  <div className="rounded bg-[var(--color-bg-secondary)] p-2">
                    <div className="text-[10px] text-[var(--color-text-tertiary)]">Opacity</div>
                    <div className="mt-1 text-xs font-mono font-medium">
                      {(edge.opacity * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
                {edge.distance !== undefined && (
                  <div className="rounded bg-[var(--color-bg-secondary)] p-2">
                    <div className="text-[10px] text-[var(--color-text-tertiary)]">Distance</div>
                    <div className="mt-1 text-xs font-mono font-medium">
                      {edge.distance.toFixed(1)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Technical Edge ID */}
          <div className="rounded bg-[var(--color-bg-secondary)] p-2 text-[10px] font-mono text-[var(--color-text-tertiary)] break-all">
            <span className="text-[var(--color-text-disabled)] mr-1">Edge ID:</span>
            {edge.id}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
