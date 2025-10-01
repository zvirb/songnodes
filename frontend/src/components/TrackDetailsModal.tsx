import React, { useState, useEffect, useMemo } from 'react';
import { HarmonicCompatibility } from './HarmonicCompatibility';
import { EnergyMeter } from './EnergyMeter';
import { Track } from '../types/dj';
import { useGraphNodes, useGraphEdges } from '../store/useStore';

/**
 * TrackDetailsModal - Detailed track inspection interface
 * Shows track metadata, relationships, and edges with option to set as currently playing
 *
 * ✅ FIX: Uses edges from Zustand store instead of making API calls
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
  // ✅ FIX: Get edges and nodes from Zustand store instead of API
  const graphNodes = useGraphNodes();
  const graphEdges = useGraphEdges();

  // Compute connected tracks from store data
  const edges = useMemo(() => {
    if (!track || !isOpen) {
      return [];
    }

    console.log('🔍 Computing edges for track:', track.id, track.name);
    console.log('📊 Available edges in store:', graphEdges.length);
    console.log('📊 Available nodes in store:', graphNodes.length);

    // Find all edges connected to this track
    const connectedEdges = graphEdges.filter(
      edge => edge.source === track.id || edge.target === track.id
    );

    console.log(`✅ Found ${connectedEdges.length} connected edges for ${track.name}`);

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
              name: relatedNode.track?.name || relatedNode.title || relatedNode.label || 'Unknown Track',
              artist: relatedNode.track?.artist || relatedNode.artist || 'Unknown Artist',
              bpm: relatedNode.track?.bpm || relatedNode.bpm,
              key: relatedNode.track?.key || relatedNode.key,
            }
          : {
              id: relatedNodeId,
              name: 'Unknown Track',
              artist: 'Unknown Artist',
            },
      };

      console.log(`  → Edge to: ${trackEdge.relatedTrack?.name} (${trackEdge.type}, weight: ${trackEdge.weight})`);

      return trackEdge;
    });

    return trackEdges;
  }, [track, isOpen, graphEdges, graphNodes]);

  if (!isOpen || !track) return null;

  const isCurrentlyPlaying = currentlyPlayingTrack?.id === track.id;

  return (
    <div
      className="track-details-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="track-details-modal"
        style={{
          backgroundColor: '#1A1A1A',
          borderRadius: '16px',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#8E8E93',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#8E8E93';
          }}
        >
          ✕
        </button>

        <div style={{ padding: '32px' }}>
          {/* Track Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px'
          }}>
            <div style={{ flex: 1, paddingRight: '20px' }}>
              <h2 style={{
                color: '#FFFFFF',
                fontSize: '28px',
                margin: '0 0 8px 0',
                fontWeight: 700,
                lineHeight: 1.2
              }}>
                {track.name}
              </h2>
              <p style={{
                color: '#8E8E93',
                fontSize: '18px',
                margin: '0 0 16px 0'
              }}>
                {track.artist}
              </p>

              {isCurrentlyPlaying && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: '#7ED321',
                  borderRadius: '20px',
                  marginBottom: '16px'
                }}>
                  <span style={{
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 600
                  }}>
                    🎯 Currently Playing
                  </span>
                </div>
              )}
            </div>

            {/* Action Button */}
            {!isCurrentlyPlaying && (
              <button
                onClick={() => {
                  console.log('Setting as currently playing:', track.name);
                  onSetAsCurrentlyPlaying(track);
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#4A90E2',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#357ABD';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#4A90E2';
                }}
              >
                🎵 Set as Currently Playing
              </button>
            )}
          </div>

          {/* Track Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginBottom: '32px'
          }}>
            {/* BPM */}
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(74, 144, 226, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(74, 144, 226, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{
                color: '#8E8E93',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '8px'
              }}>
                BPM
              </div>
              <div style={{
                color: '#4A90E2',
                fontSize: '24px',
                fontWeight: 700
              }}>
                {track.bpm || '---'}
              </div>
            </div>

            {/* Key */}
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(126, 211, 33, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(126, 211, 33, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{
                color: '#8E8E93',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '8px'
              }}>
                Key
              </div>
              <div style={{
                color: '#7ED321',
                fontSize: '24px',
                fontWeight: 700
              }}>
                {track.key || '---'}
              </div>
            </div>

            {/* Energy */}
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(255, 107, 53, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{
                color: '#8E8E93',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px'
              }}>
                Energy
              </div>
              <EnergyMeter level={track.energy || 5} size="small" />
            </div>

            {/* Duration */}
            {track.duration && (
              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'center'
              }}>
                <div style={{
                  color: '#8E8E93',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '8px'
                }}>
                  Duration
                </div>
                <div style={{
                  color: '#FFFFFF',
                  fontSize: '24px',
                  fontWeight: 700
                }}>
                  {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                </div>
              </div>
            )}
          </div>

          {/* Edges/Relationships Section */}
          <div>
            <h3 style={{
              color: '#FFFFFF',
              fontSize: '20px',
              margin: '0 0 16px 0',
              fontWeight: 600
            }}>
              🔗 Connected Tracks ({edges.length})
            </h3>

            {edges.length > 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {edges.map(edge => (
                  <div
                    key={edge.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    {/* Connection Type */}
                    <div style={{
                      padding: '4px 8px',
                      backgroundColor: edge.type === 'adjacency' ? 'rgba(126, 211, 33, 0.2)' : 'rgba(74, 144, 226, 0.2)',
                      color: edge.type === 'adjacency' ? '#7ED321' : '#4A90E2',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      minWidth: '60px',
                      textAlign: 'center'
                    }}>
                      {edge.type}
                    </div>

                    {/* Track Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        color: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: 600,
                        marginBottom: '2px'
                      }}>
                        {edge.relatedTrack?.name || 'Unknown Track'}
                      </div>
                      <div style={{
                        color: '#8E8E93',
                        fontSize: '12px'
                      }}>
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
                    <div style={{
                      color: '#8E8E93',
                      fontSize: '12px',
                      minWidth: '40px',
                      textAlign: 'right'
                    }}>
                      w: {edge.weight.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#8E8E93',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                  No connections found
                </div>
                <div style={{ fontSize: '14px' }}>
                  This track doesn't have any adjacency relationships in the current dataset
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackDetailsModal;