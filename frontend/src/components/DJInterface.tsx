import React, { useState, useEffect } from 'react';
import { NowPlayingDeck } from './NowPlayingDeck';
import { IntelligentBrowser } from './IntelligentBrowser';
import GraphVisualization from './GraphVisualization';
import { Track, DJMode, DJInterfaceState } from '../types/dj';
import useStore from '../store/useStore';

/**
 * DJInterface - Main container implementing dual-mode interface
 * Librarian Mode: Full complexity for preparation
 * Performer Mode: Cognitive offloading for live performance
 */

interface DJInterfaceProps {
  initialMode?: DJMode;
}

// Mock tracks for testing
const MOCK_TRACKS: Track[] = [
  { id: '1', name: 'Strobe', artist: 'Deadmau5', bpm: 128, key: '8A', energy: 7, duration: 633, status: 'unplayed' },
  { id: '2', name: 'Opus', artist: 'Eric Prydz', bpm: 126, key: '9A', energy: 8, duration: 540, status: 'unplayed' },
  { id: '3', name: 'Your Mind', artist: 'Adam Beyer', bpm: 128, key: '8B', energy: 6, duration: 420, status: 'unplayed' },
  { id: '4', name: 'Cafe Del Mar', artist: 'Energy 52', bpm: 130, key: '7A', energy: 5, duration: 480, status: 'unplayed' },
  { id: '5', name: 'One', artist: 'Swedish House Mafia', bpm: 128, key: '8A', energy: 9, duration: 380, status: 'unplayed' },
];

export const DJInterface: React.FC<DJInterfaceProps> = ({ initialMode = 'performer' }) => {
  const [mode, setMode] = useState<DJMode>(initialMode);
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [tracks] = useState<Track[]>(MOCK_TRACKS);

  // Get graph data from store
  const { nodes, edges } = useStore();

  // Mode toggle handler
  const toggleMode = () => {
    setMode(mode === 'performer' ? 'librarian' : 'performer');
  };

  // Track selection handler
  const handleTrackSelect = (track: Track) => {
    setNowPlaying(track);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // Time update handler
  const handleTimeUpdate = (time: number) => {
    if (nowPlaying && time <= nowPlaying.duration) {
      setCurrentTime(time);
    }
  };

  // Track end handler
  const handleTrackEnd = () => {
    setIsPlaying(false);
    if (nowPlaying) {
      const updatedTrack = { ...nowPlaying, status: 'played' as const };
      setNowPlaying(updatedTrack);
    }
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
            backgroundColor: 'rgba(126,211,33,0.2)',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#7ED321',
            fontWeight: 600
          }}>
            Co-Pilot Active
          </span>
        </div>
      </header>

      {/* Main Content Area */}
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
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={nowPlaying?.duration || 0}
                onTimeUpdate={handleTimeUpdate}
                onTrackEnd={handleTrackEnd}
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
                  onTrackSelect={handleTrackSelect}
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
                    onClick={() => handleTrackSelect(track)}
                    style={{
                      padding: '12px',
                      backgroundColor: nowPlaying?.id === track.id ? 'rgba(126,211,33,0.2)' : 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#F8F8F8',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
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

            {/* Track Details Panel */}
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '20px',
              overflowY: 'auto'
            }}>
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
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default DJInterface;