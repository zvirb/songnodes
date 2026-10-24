import React, { useMemo } from 'react';
import { Link2, Search, Play } from 'lucide-react';
import { HarmonicCompatibility } from './HarmonicCompatibility';
import { formatStoredEnergy } from '../utils/trackMetadata';
import { Track } from '../types/dj';
import { useGraphNodes, useGraphEdges } from '../store/useStore';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  Button,
  Badge,
} from './ui';

/**
 * TrackDetailsModal - Detailed track inspection interface
 * Shows track metadata, relationships, and edges with option to set as currently playing
 *
 * Conforms to Design System Modal specifications
 */

interface TrackDetailsModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onSetAsCurrentlyPlaying: (track: Track) => void;
  currentlyPlayingTrack?: Track | null;
}

interface TrackEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  type: string;
  relatedTrack?: {
    id: string;
    name: string;
    artist: string;
    bpm?: number;
    key?: string;
  };
}

export const TrackDetailsModal: React.FC<TrackDetailsModalProps> = ({
  track,
  isOpen,
  onClose,
  onSetAsCurrentlyPlaying,
  currentlyPlayingTrack,
}) => {
  const graphNodes = useGraphNodes();
  const graphEdges = useGraphEdges();

  // Compute connected tracks from store data
  const edges = useMemo(() => {
    if (!track || !isOpen) {
      return [];
    }

    const connectedEdges = graphEdges.filter(
      (edge) => edge.source === track.id || edge.target === track.id
    );

    const trackEdges: TrackEdge[] = connectedEdges.map((edge, index) => {
      const relatedNodeId = edge.source === track.id ? edge.target : edge.source;
      const relatedNode = graphNodes.find((node) => node.id === relatedNodeId);

      const trackEdge: TrackEdge = {
        id: edge.id || `edge-${index}`,
        source: edge.source,
        target: edge.target,
        weight: edge.weight || 1,
        type: edge.type || 'adjacency',
        relatedTrack: relatedNode
          ? {
              id: relatedNode.id,
              name:
                relatedNode.track?.name ||
                relatedNode.title ||
                relatedNode.label ||
                'ERROR: No Track Name (Related)',
              artist: relatedNode.track?.artist || relatedNode.artist || 'ERROR: No Artist (Related)',
              bpm: relatedNode.track?.bpm || relatedNode.bpm,
              key: relatedNode.track?.key || relatedNode.key,
            }
          : {
              id: relatedNodeId,
              name: 'ERROR: Track Not Found in Graph',
              artist: 'ERROR: Missing Track Data',
            },
      };

      return trackEdge;
    });

    return trackEdges;
  }, [track, isOpen, graphEdges, graphNodes]);

  if (!track) return null;

  const isCurrentlyPlaying = currentlyPlayingTrack?.id === track.id;

  return (
    <Modal open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalContent size="lg" className="p-6">
        <ModalHeader className="pb-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pr-6">
            <div className="flex-1">
              <ModalTitle className="text-[var(--font-size-2xl)] font-bold leading-tight text-[var(--color-text-primary)]">
                {track.name}
              </ModalTitle>
              <p className="text-[var(--font-size-lg)] text-[var(--color-text-secondary)] mt-1">
                {track.artist}
              </p>

              {isCurrentlyPlaying && (
                <div className="mt-3">
                  <Badge variant="success" size="md" className="py-1 px-3">
                    <Play size={12} className="fill-current" aria-hidden="true" />
                    Currently Playing
                  </Badge>
                </div>
              )}
            </div>

            {!isCurrentlyPlaying && (
              <Button
                variant="primary"
                size="md"
                onClick={() => onSetAsCurrentlyPlaying(track)}
                className="shrink-0 gap-2"
                aria-label="Set this track as currently playing"
              >
                <Play size={16} className="fill-current" aria-hidden="true" />
                Set as Currently Playing
              </Button>
            )}
          </div>
        </ModalHeader>

        <ModalBody className="space-y-6 pt-4">
          {/* Track Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* BPM */}
            <div className="p-4 bg-[var(--color-brand-secondary-muted)] border border-[var(--color-brand-secondary)]/30 rounded-[var(--radius-md)] text-center">
              <div className="text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider font-semibold mb-1">
                BPM
              </div>
              <div className="text-[var(--color-brand-secondary)] text-2xl font-bold">
                {track.bpm || '---'}
              </div>
            </div>

            {/* Key */}
            <div className="p-4 bg-[var(--color-brand-primary-muted)] border border-[var(--color-brand-primary)]/30 rounded-[var(--radius-md)] text-center">
              <div className="text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider font-semibold mb-1">
                Key
              </div>
              <div className="text-[var(--color-brand-primary)] text-2xl font-bold">
                {track.key || '---'}
              </div>
            </div>

            {/* Energy */}
            <div className="p-4 bg-[var(--color-brand-tertiary-muted)] border border-[var(--color-brand-tertiary)]/30 rounded-[var(--radius-md)] text-center">
              <div className="text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider font-semibold mb-2">
                Energy
              </div>
              <span>{formatStoredEnergy(track.energy, track.energy_scale)}</span>
            </div>

            {/* Duration */}
            {track.duration && (
              <div className="p-4 bg-[var(--color-bg-elevated-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] text-center">
                <div className="text-[var(--color-text-tertiary)] text-xs uppercase tracking-wider font-semibold mb-1">
                  Duration
                </div>
                <div className="text-[var(--color-text-primary)] text-2xl font-bold">
                  {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                </div>
              </div>
            )}
          </div>

          {/* Edges/Relationships Section */}
          <div>
            <h3 className="text-[var(--font-size-lg)] font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <Link2 size={18} aria-hidden="true" />
              Connected Tracks ({edges.length})
            </h3>

            {edges.length > 0 ? (
              <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                {edges.map((edge) => (
                  <div
                    key={edge.id}
                    className="flex items-center gap-4 p-3 bg-[var(--color-bg-elevated-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)]"
                  >
                    {/* Connection Type */}
                    <Badge
                      variant={edge.type === 'adjacency' ? 'success' : 'secondary'}
                      size="sm"
                      className="uppercase shrink-0 min-w-[60px] justify-center"
                    >
                      {edge.type}
                    </Badge>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {edge.relatedTrack?.name || 'Unknown Track'}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {edge.relatedTrack?.artist || 'Unknown Artist'}
                      </div>
                    </div>

                    {/* Harmonic Compatibility */}
                    {track.key && edge.relatedTrack?.key && (
                      <HarmonicCompatibility
                        currentKey={track.key as any}
                        targetKey={edge.relatedTrack.key as any}
                        size="small"
                      />
                    )}

                    {/* Weight */}
                    <div className="text-xs text-[var(--color-text-tertiary)] shrink-0 font-mono">
                      w: {edge.weight.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated-1)]/50 border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] flex flex-col items-center gap-3">
                <Search size={40} className="text-[var(--color-text-disabled)]" aria-hidden="true" />
                <div>
                  <div className="text-base font-medium text-[var(--color-text-primary)] mb-1">
                    No connections found
                  </div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">
                    This track doesn't have any adjacency relationships in the current dataset
                  </div>
                </div>
              </div>
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default TrackDetailsModal;
