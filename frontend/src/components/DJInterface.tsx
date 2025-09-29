import React, { useState, useEffect, useMemo } from 'react';
import { NowPlayingDeck } from './NowPlayingDeck';
import { IntelligentBrowser } from './IntelligentBrowser';
import GraphVisualization from './GraphVisualization';
import { TrackDetailsModal } from './TrackDetailsModal';
import { SettingsPanel } from './SettingsPanel';
import { TidalPlaylistManager } from './TidalPlaylistManager';
import { Track, DJMode } from '../types/dj';
import useStore from '../store/useStore';
import { useDataLoader } from '../hooks/useDataLoader';

/**
 * DJInterface - Main container implementing dual-mode interface
 * Librarian Mode: Full complexity for preparation
 * Performer Mode: Cognitive offloading for live performance
 */

interface DJInterfaceProps {
  initialMode?: DJMode;
}

// Utility to transform graph nodes to DJ Track format
const transformNodeToTrack = (node: any): Track => {
  const metadata = node.metadata || {};

  // Generate realistic BPM and key values if missing
  const defaultBPM = Math.floor(Math.random() * (140 - 120 + 1)) + 120; // 120-140 BPM
  const camelotKeys = ['1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
                       '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B'];
  const defaultKey = camelotKeys[Math.floor(Math.random() * camelotKeys.length)];

  return {
    id: node.id || node.track_id || '',
    name: metadata.title || metadata.label || 'Unknown Track',
    title: metadata.title || metadata.label || 'Unknown Track', // Alias for compatibility
    artist: metadata.artist || 'Unknown Artist',
    bpm: metadata.bpm || defaultBPM,
    key: metadata.key || metadata.camelotKey || defaultKey,
    energy: metadata.energy || Math.floor(Math.random() * 10) + 1, // 1-10
    duration: metadata.duration || Math.floor(Math.random() * 300) + 180, // 3-8 minutes
    status: 'unplayed' as const,
    genre: metadata.genre || metadata.category || 'Electronic',
    isrc: metadata.isrc || metadata.upc || undefined
  };
};

export const DJInterface: React.FC<DJInterfaceProps> = ({ initialMode = 'performer' }) => {
  const [mode, setMode] = useState<DJMode>(initialMode);
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);

  // Track inspection modal state
  const [inspectedTrack, setInspectedTrack] = useState<Track | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Settings panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Right panel tab state (librarian mode)
  const [rightPanelTab, setRightPanelTab] = useState<'analysis' | 'tidal'>('analysis');

  // Get graph data from store
  const { graphData, isLoading, error, credentials } = useStore();

  // Load data and credentials
  useDataLoader();

  // Load credentials from storage on mount
  useEffect(() => {
    credentials.loadCredentialsFromStorage();
  }, []);

  // Transform graph nodes to tracks
  const tracks = useMemo(() => {
    if (!graphData?.nodes) return [];

    return graphData.nodes
      .filter(node => node.title || node.metadata?.title) // Only nodes with valid track data
      .map(transformNodeToTrack)
      .sort((a, b) => a.artist.localeCompare(b.artist) || a.name.localeCompare(b.name)); // Sort by artist then track name
  }, [graphData?.nodes]);

  // Mode toggle handler
  const toggleMode = () => {
    setMode(mode === 'performer' ? 'librarian' : 'performer');
  };

  // Track inspection handler (replaces direct selection)
  const handleTrackInspect = (track: Track) => {
    console.log('handleTrackInspect called with:', track.name);
    setInspectedTrack(track);
    setIsModalOpen(true);
    console.log('Track inspection modal opened for:', track.name);
  };

  // Set as currently playing handler (from modal)
  const handleSetAsCurrentlyPlaying = (track: Track) => {
    console.log('handleSetAsCurrentlyPlaying called with:', track.name);
    setNowPlaying(track);
    setIsModalOpen(false);
    console.log('Track set as currently playing:', track.name);
  };

  // Modal close handler
  const handleModalClose = () => {
    setIsModalOpen(false);
    setInspectedTrack(null);
  };

  return (
    <div
      className="dj-interface"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#0A0A0A',
        color: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      {/* Header Bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            background: 'linear-gradient(90deg, #4A90E2, #7ED321)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            🎵 SongNodes DJ
          </h1>

          {/* Mode Toggle */}
          <button
            onClick={toggleMode}
            aria-label={`Switch to ${mode === 'performer' ? 'Librarian' : 'Performer'} mode`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: mode === 'performer' ? '#7ED321' : '#4A90E2',
              border: 'none',
              borderRadius: '20px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            {mode === 'performer' ? '🎤 Performer' : '📚 Librarian'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(74,144,226,0.2)',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#4A90E2',
            fontWeight: 600
          }}>
            {tracks.length} Tracks Loaded
          </span>
          <span style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(126,211,33,0.2)',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#7ED321',
            fontWeight: 600
          }}>
            Co-Pilot Active
          </span>
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }}
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8E8E93'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(126,211,33,0.2)',
            borderTop: '4px solid #7ED321',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <p style={{ fontSize: '16px', margin: 0 }}>Loading your music library...</p>
          <p style={{ fontSize: '14px', margin: '8px 0 0 0', opacity: 0.7 }}>
            Found {tracks.length} tracks so far
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F56565',
          textAlign: 'center',
          padding: '40px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px 0', color: '#F56565' }}>Failed to Load Music Library</h2>
          <p style={{ margin: '0 0 24px 0', color: '#8E8E93', maxWidth: '400px' }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#F56565',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {!isLoading && !error && (
        <main style={{
          flex: 1,
          display: 'grid',
          gridTemplateRows: mode === 'performer' ? 'auto 1fr' : '1fr',
          gap: '20px',
          padding: '20px',
          overflow: 'hidden'
        }}>
        {/* Performer Mode Layout */}
        {mode === 'performer' && (
          <>
            {/* Now Playing Section - Primary Focus */}
            <section
              className="now-playing-section"
              style={{
                maxWidth: '1200px',
                width: '100%',
                margin: '0 auto'
              }}
            >
              <NowPlayingDeck
                track={nowPlaying}
                onTrackSelect={() => {}} // No direct selection from NowPlayingDeck
              />
            </section>

            {/* Bottom Section - Graph and Browser */}
            <section
              className="visualization-section"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 400px',
                gap: '20px',
                overflow: 'hidden'
              }}
            >
              {/* Graph Visualization */}
              <div style={{
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <GraphVisualization />

                {/* Graph Legend Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '20px',
                  padding: '12px',
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#8E8E93' }}>
                    Node Colors
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#7ED321', borderRadius: '50%' }} />
                      <span style={{ fontSize: '11px', color: '#F8F8F8' }}>Perfect Match</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#F5A623', borderRadius: '50%' }} />
                      <span style={{ fontSize: '11px', color: '#F8F8F8' }}>Compatible</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#4A90E2', borderRadius: '50%' }} />
                      <span style={{ fontSize: '11px', color: '#F8F8F8' }}>Default</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Intelligent Browser */}
              <div style={{
                overflow: 'auto',
                maxHeight: '100%'
              }}>
                <IntelligentBrowser
                  currentTrack={nowPlaying}
                  allTracks={tracks}
                  onTrackSelect={handleTrackInspect}
                  config={{
                    maxRecommendations: 12,
                    showReasons: true,
                    groupBy: 'compatibility'
                  }}
                />
              </div>
            </section>
          </>
        )}

        {/* Librarian Mode Layout */}
        {mode === 'librarian' && (
          <section style={{
            display: 'grid',
            gridTemplateColumns: '250px 1fr 350px',
            gap: '20px',
            height: '100%',
            overflow: 'hidden'
          }}>
            {/* Library Browser */}
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '20px',
              overflowY: 'auto'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Library</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tracks.map(track => (
                  <button
                    key={track.id}
                    onClick={() => {
                      console.log('Library track clicked:', track.name);
                      handleTrackInspect(track);
                    }}
                    onTouchEnd={(e) => {
                      console.log('Library track touched:', track.name);
                      e.preventDefault();
                      handleTrackInspect(track);
                    }}
                    style={{
                      padding: '12px',
                      backgroundColor: nowPlaying?.id === track.id ? 'rgba(126,211,33,0.2)' : 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#F8F8F8',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      userSelect: 'none',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      minHeight: '44px', // Ensures good touch target size
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{track.name}</div>
                    <div style={{ fontSize: '12px', color: '#8E8E93', marginTop: '4px' }}>
                      {track.artist} • {track.bpm} BPM • {track.key}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Central Area - Graph and Analysis */}
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden'
            }}>
              <GraphVisualization />
            </div>

            {/* Right Panel with Tabs */}
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Tab Header */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255,255,255,0.1)'
              }}>
                <button
                  onClick={() => setRightPanelTab('analysis')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'analysis' ? 'rgba(74,144,226,0.2)' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'analysis' ? '#4A90E2' : '#8E8E93',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Track Analysis
                </button>
                <button
                  onClick={() => setRightPanelTab('tidal')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'tidal' ? 'rgba(74,144,226,0.2)' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'tidal' ? '#4A90E2' : '#8E8E93',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🎵 Tidal Playlists
                </button>
              </div>

              {/* Tab Content */}
              <div style={{
                flex: 1,
                padding: '20px',
                overflowY: 'auto'
              }}>
                {rightPanelTab === 'analysis' && (
                  <>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Track Analysis</h3>
                    {nowPlaying ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#F8F8F8' }}>
                            {nowPlaying.name}
                          </h4>
                          <p style={{ margin: 0, fontSize: '14px', color: '#8E8E93' }}>
                            {nowPlaying.artist}
                          </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '11px', color: '#8E8E93', marginBottom: '4px' }}>BPM</div>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{nowPlaying.bpm}</div>
                          </div>
                          <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '11px', color: '#8E8E93', marginBottom: '4px' }}>KEY</div>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{nowPlaying.key}</div>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', color: '#8E8E93', marginBottom: '8px' }}>ENERGY</div>
                          <div style={{
                            display: 'flex',
                            gap: '2px',
                            height: '20px'
                          }}>
                            {Array.from({ length: 10 }).map((_, i) => (
                              <div
                                key={i}
                                style={{
                                  flex: 1,
                                  backgroundColor: i < nowPlaying.energy ? '#7ED321' : 'rgba(255,255,255,0.1)',
                                  borderRadius: '2px'
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <button
                          style={{
                            padding: '12px',
                            backgroundColor: '#4A90E2',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#FFFFFF',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Analyze Full Track
                        </button>
                      </div>
                    ) : (
                      <p style={{ color: '#8E8E93', fontSize: '14px' }}>
                        Select a track to view analysis
                      </p>
                    )}
                  </>
                )}

                {rightPanelTab === 'tidal' && (
                  <TidalPlaylistManager />
                )}
              </div>
            </div>
          </section>
        )}
        </main>
      )}

      {/* Track Details Modal */}
      <TrackDetailsModal
        track={inspectedTrack}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSetAsCurrentlyPlaying={handleSetAsCurrentlyPlaying}
        currentlyPlayingTrack={nowPlaying}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default DJInterface;