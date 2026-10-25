import React, { useEffect, useMemo, useRef } from 'react';
import { X, Play, AudioWaveform, Unlink } from 'lucide-react';
import { SN, Bpm, KeyBadge } from '../lib/songnodes';
import { EmptyPanel, TrackEnergy } from './ds';
import { HarmonicCompatibility } from './HarmonicCompatibility';
import { Track } from '../types/dj';
import { useGraphNodes, useGraphEdges } from '../store/useStore';

/**
 * TrackDetailsModal - Detailed track inspection interface
 * Shows track metadata, relationships, and edges with option to set as currently playing
 *
 * Uses edges from Zustand store instead of making API calls
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
  currentlyPlayingTrack
}) => {
  // Get edges and nodes from Zustand store
  const graphNodes = useGraphNodes();
  const graphEdges = useGraphEdges();
  const sheetRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Compute connected tracks from store data
  const edges = useMemo(() => {
    if (!track || !isOpen) {
      return [];
    }

    // Find all edges connected to this track
    const connectedEdges = graphEdges.filter(
      edge => edge.source === track.id || edge.target === track.id
    );

    // Transform edges and add related track info from nodes
    const trackEdges: TrackEdge[] = connectedEdges.map((edge, index) => {
      const relatedNodeId = edge.source === track.id ? edge.target : edge.source;
      const relatedNode = graphNodes.find(node => node.id === relatedNodeId);

      const trackEdge: TrackEdge = {
        id: edge.id || `edge-${index}`,
        source: edge.source,
        target: edge.target,
        weight: edge.weight || 1,
        type: edge.type || 'adjacency',
        relatedTrack: relatedNode
          ? {
              id: relatedNode.id,
              name: relatedNode.track?.name || relatedNode.title || relatedNode.label || '–',
              artist: relatedNode.track?.artist || relatedNode.artist || '–',
              bpm: relatedNode.track?.bpm || relatedNode.bpm,
              key: relatedNode.track?.key || relatedNode.key,
            }
          : {
              id: relatedNodeId,
              name: 'Track not in the graph',
              artist: '–',
            },
      };

      return trackEdge;
    });

    return trackEdges;
  }, [track, isOpen, graphEdges, graphNodes]);

  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore focus on close
    const previousFocus = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      // Simple focus trap
      if (e.key === 'Tab' && sheetRef.current) {
        const focusables = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1);

        if (focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [isOpen, track?.id, onClose]);

  if (!isOpen || !track) return null;

  const isCurrentlyPlaying = currentlyPlayingTrack?.id === track.id;
  const seconds = track.duration && track.duration > 0 ? track.duration : null;
  const linkLabel = (type: string) => ({
    adjacency: 'Played next',
    similarity: 'Similar sound',
    collaboration: 'Same artists',
    genre: 'Same genre',
    key_compatibility: 'Compatible key',
  } as Record<string, string>)[type] ?? type;

  return (
    <aside
      ref={sheetRef}
      className="sn-side-sheet sn-side-sheet--overlay track-details-modal"
      aria-labelledby="tdm-title"
      aria-modal="true"
      role="dialog"
    >
      <span className="sn-side-sheet__handle" aria-hidden="true" />
      <div className="sn-side-sheet__head">
        <h2 className="sn-title title-s sn-side-sheet__title" id="tdm-title" tabIndex={-1} ref={titleRef}>
          <span className="sn-lead">Track:</span> {track.artist} – {track.name}
        </h2>
        <button type="button" className="sn-btn sn-btn--icon sn-btn--quiet" onClick={onClose} aria-label="Close track details" title="Close">
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="sn-side-sheet__body">
        {isCurrentlyPlaying && (
          <span className="sn-track-cell__now" style={{ color: 'var(--now)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
            <AudioWaveform size={16} strokeWidth={2} aria-hidden="true" />
            Now playing
          </span>
        )}

        <dl className="sn-side-sheet__facts">
          <dt>BPM</dt><dd><Bpm value={track.bpm} /></dd>
          <dt>Key</dt><dd><KeyBadge value={track.camelotKey || track.key} withName /></dd>
          <dt>Energy</dt><dd><TrackEnergy energy={track.energy} scale={track.energy_scale} /></dd>
          <dt>Length</dt><dd>{seconds ? <span className="sn-bpm">{SN.format.duration(seconds)}</span> : <span className="sn-none">–</span>}</dd>
        </dl>

        <section className="sn-side-sheet__section" aria-labelledby="tdm-links">
          <h3 className="sn-side-sheet__label label" id="tdm-links">Connected tracks <span className="sn-bpm">{edges.length}</span></h3>
          {edges.length > 0 ? (
            <ul className="sn-side-sheet__list">
              {edges.map(edge => (
                <li key={edge.id} className="sn-side-sheet__item" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                  <div className="sn-track-cell">
                    <span className="sn-track-cell__title">
                      <span className="sn-track-cell__name" title={`${edge.relatedTrack?.artist ?? ''} – ${edge.relatedTrack?.name ?? ''}`}>
                        <span className="sn-track-cell__artist">{edge.relatedTrack?.artist} –</span> {edge.relatedTrack?.name}
                      </span>
                    </span>
                    <span className="sn-track-cell__meta">
                      <span>{linkLabel(edge.type)}</span>
                      <span className="sn-track-cell__sep" aria-hidden="true">·</span>
                      <span>weight {edge.weight.toFixed(1)}</span>
                    </span>
                  </div>
                  {track.key && edge.relatedTrack?.key
                    ? <HarmonicCompatibility currentKey={track.key} targetKey={edge.relatedTrack.key} />
                    : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyPanel compact icon={Unlink} title="No connections yet">
              No DJ set in the data plays this track next to another one.
            </EmptyPanel>
          )}
        </section>
      </div>

      {!isCurrentlyPlaying && (
        <div className="sn-side-sheet__foot">
          <button type="button" className="sn-btn sn-btn--primary" onClick={() => onSetAsCurrentlyPlaying(track)}>
            <Play size={16} strokeWidth={2} aria-hidden="true" />
            Set as now playing
          </button>
        </div>
      )}
    </aside>
  );
};

export default TrackDetailsModal;
