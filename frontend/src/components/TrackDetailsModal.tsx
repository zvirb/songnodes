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
  ModalDescription,
  ModalBody,
  ModalFooter,
} from './ui/Modal';
import { Button } from './ui/Button';

/**
 * TrackDetailsModal - Detailed track inspection interface
 * Shows track metadata, relationships, and edges with option to set as currently playing
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
              artist:
                relatedNode.track?.artist ||
                relatedNode.artist ||
                'ERROR: No Artist (Related)',
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
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="lg">
        <ModalHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <ModalTitle className="text-2xl font-bold text-[var(--color-text-primary)]">
                {track.name}
              </ModalTitle>
              <ModalDescription className="text-lg text-[var(--color-text-secondary)]">
                {track.artist}
              </ModalDescription>
              {isCurrentlyPlaying && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--color-success,#7ED321)] px-4 py-1 text-xs font-semibold text-white">
                  <Play size={12} fill="currentColor" stroke="currentColor" aria-hidden="true" />
                  Currently Playing
                </div>
              )}
            </div>
            {!isCurrentlyPlaying && (
              <Button
                variant="primary"
                onClick={() => onSetAsCurrentlyPlaying(track)}
                leftIcon={<Play size={16} fill="currentColor" stroke="currentColor" aria-hidden="true" />}
              >
                Set as Currently Playing
              </Button>
            )}
          </div>
        </ModalHeader>

        <ModalBody className="space-y-6">
          {/* Track Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* BPM */}
            <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4 text-center">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                BPM
              </div>
              <div className="text-2xl font-bold text-[var(--color-brand-primary)]">
                {track.bpm || '---'}
              </div>
            </div>

            {/* Key */}
            <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4 text-center">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Key
              </div>
              <div className="text-2xl font-bold text-[var(--color-success,#7ED321)]">
                {track.key || '---'}
              </div>
            </div>

            {/* Energy */}
            <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4 text-center">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Energy
              </div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                {formatStoredEnergy(track.energy, track.energy_scale)}
              </div>
            </div>

            {/* Duration */}
            <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4 text-center">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Duration
              </div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {track.duration
                  ? `${Math.floor(track.duration / 60)}:${(track.duration % 60)
                      .toString()
                      .padStart(2, '0')}`
                  : '---'}
              </div>
            </div>
          </div>

          {/* Connected Tracks */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
              <Link2 size={20} strokeWidth={2} aria-hidden="true" />
              Connected Tracks ({edges.length})
            </h3>

            {edges.length > 0 ? (
              <div className="custom-scrollbar flex max-h-[280px] flex-col gap-3 overflow-y-auto pr-1">
                {edges.map((edge) => (
                  <div
                    key={edge.id}
                    className="flex items-center gap-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-3"
                  >
                    {/* Connection Type */}
                    <div className="min-w-[70px] rounded-full bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-primary)]">
                      {edge.type}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                        {edge.relatedTrack?.name || 'Unknown Track'}
                      </div>
                      <div className="truncate text-xs text-[var(--color-text-secondary)]">
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
                    <div className="min-w-[45px] text-right text-xs text-[var(--color-text-tertiary)] font-mono">
                      w: {edge.weight.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-8 text-center text-[var(--color-text-secondary)]">
                <Search size={40} strokeWidth={1.5} className="text-[var(--color-text-disabled)]" aria-hidden="true" />
                <div className="text-base font-medium text-[var(--color-text-primary)]">No connections found</div>
                <div className="text-xs text-[var(--color-text-tertiary)]">
                  This track doesn't have any adjacency relationships in the current dataset
                </div>
              </div>
            )}
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

export default TrackDetailsModal;
