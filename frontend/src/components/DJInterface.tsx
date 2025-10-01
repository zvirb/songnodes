import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NowPlayingDeck } from './NowPlayingDeck';
import { IntelligentBrowser } from './IntelligentBrowser';
import GraphVisualization from './GraphVisualization';
import { TrackDetailsModal } from './TrackDetailsModal';
import { SettingsPanel } from './SettingsPanel';
import { TidalPlaylistManager } from './TidalPlaylistManager';
import { KeyMoodPanel } from './KeyMoodPanel';
import TargetTracksManager from './TargetTracksManager';
// Import removed - PipelineMonitoringDashboard has missing dependencies
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

// Stable constants and utility functions (moved outside component for performance)
const CAMELOT_KEYS = ['1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
                      '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B'];

// Deterministic hash function for stable random values
const getStableHashValue = (str: string, min: number, max: number): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % (max - min + 1) + min;
};

// Pure function for track transformation - no React.memo needed for regular functions
const transformNodeToTrack = (node: any): Track => {
  const metadata = node.metadata || {};
  const trackId = node.id || node.track_id || '';

  // Stable defaults based on track ID
  const defaultBPM = metadata.bpm || getStableHashValue(trackId + '_bpm', 120, 140);
  const defaultKey = metadata.key || metadata.camelotKey ||
                     CAMELOT_KEYS[getStableHashValue(trackId + '_key', 0, CAMELOT_KEYS.length - 1)];

  // Get track name from multiple potential sources
  const trackName = node.title || metadata.title || metadata.label || node.label || 'Unknown Track';

  // Get artist name from multiple potential sources
  const artistName = node.artist || metadata.artist || 'Unknown Artist';

  return {
    id: trackId,
    name: trackName,
    title: trackName, // Alias for compatibility
    artist: artistName,
    bpm: defaultBPM,
    key: defaultKey,
    energy: metadata.energy || getStableHashValue(trackId + '_energy', 1, 10),
    duration: metadata.duration || getStableHashValue(trackId + '_duration', 180, 480), // 3-8 minutes
    status: 'unplayed' as const,
    genre: metadata.genre || metadata.category || 'Electronic',
    isrc: metadata.isrc || metadata.upc || undefined
  };
};

// Optimized node validation function
const isValidTrackNode = (node: any): boolean => {
  const hasTitle = node.title || node.metadata?.title || node.metadata?.label;
  const hasArtist = node.artist || node.metadata?.artist;
  return Boolean(hasTitle && hasArtist);
};

// Memoized track list item to prevent individual track re-renders
const TrackListItem = React.memo<{
  track: Track;
  isNowPlaying: boolean;
  onInspect: (track: Track) => void;
}>(({ track, isNowPlaying, onInspect }) => {
  const handleClick = useCallback(() => {
    onInspect(track);
  }, [track, onInspect]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    onInspect(track);
  }, [track, onInspect]);

  return (
    <button
      key={track.id}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      style={{
        padding: '12px',
        backgroundColor: isNowPlaying ? 'rgba(126,211,33,0.2)' : 'transparent',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#F8F8F8',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        minHeight: '44px',
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
  );
});

export const DJInterface: React.FC<DJInterfaceProps> = ({ initialMode = 'performer' }) => {
  const [mode, setMode] = useState<DJMode>(initialMode);
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);

  // Track inspection modal state
  const [inspectedTrack, setInspectedTrack] = useState<Track | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Settings panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Right panel tab state (librarian mode)
  const [rightPanelTab, setRightPanelTab] = useState<'analysis' | 'keymood' | 'tidal' | 'targets'>('analysis');

  // Monitoring dashboard state
  const [showMonitoringDashboard, setShowMonitoringDashboard] = useState(false);
  const [monitoringData, setMonitoringData] = useState({
    isLoading: true,
    metrics: null,
    runs: [],
    error: null
  });

  // Manual trigger states
  const [triggerStates, setTriggerStates] = useState({
    targetSearch: { loading: false, lastTriggered: null },
    scraperTasks: { loading: false, lastTriggered: null }
  });
  // Animation controls state
  const [isAnimationPaused, setIsAnimationPaused] = useState(false);

  // Get graph data from store with selective subscriptions to prevent unnecessary re-renders
  const graphData = useStore(state => state.graphData);
  const isLoading = useStore(state => state.isLoading);
  const error = useStore(state => state.error);
  const credentials = useStore(state => state.credentials);

  // Load data and credentials
  useDataLoader();

  // Credentials are now loaded automatically via Zustand onRehydrateStorage
  // No need to manually load on mount

  // Memoize track nodes to prevent recalculation on every render
  const validNodes = useMemo(() => {
    if (!graphData?.nodes) return [];
    return graphData.nodes.filter(isValidTrackNode);
  }, [graphData?.nodes]);

  // Transform nodes to tracks with stable references
  const tracks = useMemo(() => {
    if (validNodes.length === 0) return [];

    const transformedTracks = validNodes
      .map(transformNodeToTrack)
      .sort((a, b) => a.artist.localeCompare(b.artist) || a.name.localeCompare(b.name));

    console.log(`DJInterface: Transformed ${transformedTracks.length} tracks (only logs when data actually changes)`);
    return transformedTracks;
  }, [validNodes]);

  // Mode toggle handler
  const toggleMode = () => {
    setMode(mode === 'performer' ? 'librarian' : 'performer');
  };

  // Memoized event handlers to prevent child re-renders
  const handleTrackInspect = useCallback((track: Track) => {
    console.log('🎵 Track selected:', track.name, 'Mode:', mode);

    // ✅ FIX: In Performer mode, set as now playing instead of opening modal
    if (mode === 'performer') {
      setNowPlaying(track);
      console.log('✅ Set as now playing in Performer mode');
    } else {
      // In Librarian mode, open inspection modal
      setInspectedTrack(track);
      setIsModalOpen(true);
      console.log('✅ Opened modal in Librarian mode');
    }
  }, [mode]);

  const handleSetAsCurrentlyPlaying = useCallback((track: Track) => {
    setNowPlaying(track);
    setIsModalOpen(false);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setInspectedTrack(null);
  }, []);

  // Animation control handlers
  const handleToggleAnimation = useCallback(() => {
    const toggleFn = (window as any).toggleSimulation;
    if (toggleFn) {
      toggleFn();
      setIsAnimationPaused(prev => !prev);
    } else {
      console.warn('toggleSimulation function not available');
    }
  }, []);

  const handleRestartAnimation = useCallback(() => {
    const restartFn = (window as any).manualRefresh;
    if (restartFn) {
      restartFn();
      setIsAnimationPaused(false);
    } else {
      console.warn('manualRefresh function not available');
    }
  }, []);

  // Fetch monitoring data when dashboard is opened
  const fetchMonitoringData = useCallback(async () => {
    setMonitoringData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [metricsResponse, runsResponse] = await Promise.all([
        fetch('/api/v1/observability/metrics/summary'),
        fetch('/api/v1/observability/runs')
      ]);

      if (!metricsResponse.ok || !runsResponse.ok) {
        throw new Error(`API Error: ${metricsResponse.status} / ${runsResponse.status}`);
      }

      const [metrics, runs] = await Promise.all([
        metricsResponse.json(),
        runsResponse.json()
      ]);

      setMonitoringData({
        isLoading: false,
        metrics: metrics.summary || null,
        runs: runs || [],
        error: null
      });
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      setMonitoringData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, []);

  // Manual trigger functions
  const triggerTargetSearch = useCallback(async () => {
    setTriggerStates(prev => ({
      ...prev,
      targetSearch: { ...prev.targetSearch, loading: true }
    }));

    try {
      const response = await fetch('/api/v1/scrapers/target-tracks/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force_rescrape: true,
          limit: 20
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger target search: ${response.status}`);
      }

      const result = await response.json();
      setTriggerStates(prev => ({
        ...prev,
        targetSearch: { loading: false, lastTriggered: new Date().toISOString() }
      }));

      // Refresh monitoring data after trigger
      setTimeout(fetchMonitoringData, 2000);

      console.log('Target search triggered successfully:', result);
    } catch (error) {
      console.error('Failed to trigger target search:', error);
      setTriggerStates(prev => ({
        ...prev,
        targetSearch: { ...prev.targetSearch, loading: false }
      }));
    }
  }, [fetchMonitoringData]);

  const triggerScraperTasks = useCallback(async () => {
    setTriggerStates(prev => ({
      ...prev,
      scraperTasks: { ...prev.scraperTasks, loading: true }
    }));

    try {
      // Trigger orchestrator to process ALL active target tracks
      const response = await fetch('/api/v1/scrapers/target-tracks/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force_rescrape: true,
          limit: 100  // Process up to 100 tracks
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger scrapers: ${response.status}`);
      }

      const result = await response.json();
      console.log('Scrapers triggered successfully:', result);

      setTriggerStates(prev => ({
        ...prev,
        scraperTasks: { loading: false, lastTriggered: new Date().toISOString() }
      }));

      // Refresh monitoring data after trigger
      setTimeout(fetchMonitoringData, 3000);
    } catch (error) {
      console.error('Failed to trigger scraper tasks:', error);
      setTriggerStates(prev => ({
        ...prev,
        scraperTasks: { ...prev.scraperTasks, loading: false }
      }));
    }
  }, [fetchMonitoringData]);

  // Fetch data when dashboard opens
  useEffect(() => {
    if (showMonitoringDashboard) {
      fetchMonitoringData();
    }
  }, [showMonitoringDashboard, fetchMonitoringData]);

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

          {/* Mode Toggle - Show both options with active highlight */}
          <div style={{
            display: 'flex',
            gap: '8px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            padding: '4px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <button
              onClick={() => setMode('performer')}
              aria-label="Switch to Performer mode"
              aria-pressed={mode === 'performer'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: mode === 'performer' ? '#7ED321' : 'transparent',
                border: 'none',
                borderRadius: '20px',
                color: mode === 'performer' ? '#FFFFFF' : '#8E8E93',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                opacity: mode === 'performer' ? 1 : 0.7
              }}
            >
              🎤 Performer
            </button>
            <button
              onClick={() => setMode('librarian')}
              aria-label="Switch to Librarian mode"
              aria-pressed={mode === 'librarian'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: mode === 'librarian' ? '#4A90E2' : 'transparent',
                border: 'none',
                borderRadius: '20px',
                color: mode === 'librarian' ? '#FFFFFF' : '#8E8E93',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                opacity: mode === 'librarian' ? 1 : 0.7
              }}
            >
              📚 Librarian
            </button>
          </div>
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

          {/* TEST: Quick track selector workaround */}
          <button
            onClick={() => {
              if (tracks.length > 0) {
                const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
                console.log('🧪 TEST: Manually triggering track modal for:', randomTrack);
                handleTrackInspect(randomTrack);
              }
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: 'rgba(255,165,0,0.2)',
              border: '1px solid rgba(255,165,0,0.4)',
              borderRadius: '8px',
              color: '#FFA500',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Test track modal with random track"
          >
            🧪 Test Modal
          </button>
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
          {/* Animation Controls */}
          <button
            onClick={handleToggleAnimation}
            style={{
              padding: '8px 12px',
              backgroundColor: isAnimationPaused ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)',
              border: `1px solid ${isAnimationPaused ? 'rgba(76,175,80,0.4)' : 'rgba(244,67,54,0.4)'}`,
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              marginRight: '8px'
            }}
            title={isAnimationPaused ? 'Resume graph animation' : 'Pause graph animation'}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isAnimationPaused ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isAnimationPaused ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)';
            }}
          >
            {isAnimationPaused ? '▶️' : '⏸️'}
          </button>

          <button
            onClick={handleRestartAnimation}
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(33,150,243,0.2)',
              border: '1px solid rgba(33,150,243,0.4)',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              marginRight: '8px'
            }}
            title="Restart graph animation"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(33,150,243,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(33,150,243,0.2)';
            }}
          >
            🔄
          </button>

          <button
            onClick={() => setShowMonitoringDashboard(true)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(126,211,33,0.2)',
              border: '1px solid rgba(126,211,33,0.4)',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              marginRight: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(126,211,33,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(126,211,33,0.2)';
            }}
          >
            📊 Recently Scraped Data
          </button>

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
          gridTemplateRows: mode === 'performer' ? 'minmax(150px, auto) 1fr' : '1fr',
          gap: '16px',
          padding: '16px',
          overflow: 'hidden'
        }}>
        {/* Performer Mode Layout */}
        {mode === 'performer' && (
          <>
            {/* Now Playing Section - Compact Primary Focus */}
            <section
              className="now-playing-section"
              style={{
                maxWidth: '100%',
                width: '100%',
                minHeight: '150px',
                maxHeight: '220px',
                overflow: 'hidden'
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
                gridTemplateColumns: '1fr 480px',
                gap: '16px',
                overflow: 'hidden',
                minHeight: 0
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
                <GraphVisualization onTrackSelect={handleTrackInspect} />

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
                  graphEdges={graphData?.edges || []} // ✅ Pass graph edges for adjacency-based recommendations
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
                  <TrackListItem
                    key={track.id}
                    track={track}
                    isNowPlaying={nowPlaying?.id === track.id}
                    onInspect={handleTrackInspect}
                  />
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
              <GraphVisualization onTrackSelect={handleTrackInspect} />
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
                  onClick={() => setRightPanelTab('keymood')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'keymood' ? 'rgba(74,144,226,0.2)' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'keymood' ? '#4A90E2' : '#8E8E93',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🎭 Key & Mood
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
                <button
                  onClick={() => setRightPanelTab('targets')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'targets' ? 'rgba(74,144,226,0.2)' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'targets' ? '#4A90E2' : '#8E8E93',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🎯 Target Tracks
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

                {rightPanelTab === 'keymood' && (
                  <KeyMoodPanel
                    showInSidePanel={true}
                    className="h-full"
                  />
                )}

                {rightPanelTab === 'tidal' && (
                  <TidalPlaylistManager />
                )}

                {rightPanelTab === 'targets' && (
                  <TargetTracksManager />
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

      {/* Pipeline Monitoring Dashboard Modal */}
      {showMonitoringDashboard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '95vw',
            height: '90vh',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowMonitoringDashboard(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                zIndex: 10001,
                color: '#666',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              ✕
            </button>

            {/* Dashboard Content */}
            <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: '20px' }}>
              <div style={{ padding: '20px 0' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', color: '#333' }}>
                  Recently Scraped Data
                </h1>

                {/* Status Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                  <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px', padding: '16px' }}>
                    <h3 style={{ fontSize: '14px', color: '#6c757d', margin: '0 0 8px 0' }}>Total Runs</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#495057' }}>
                      {monitoringData.isLoading ? 'Loading...' :
                       monitoringData.error ? 'Error' :
                       monitoringData.metrics?.total_runs ?? 'N/A'}
                    </p>
                  </div>

                  <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px', padding: '16px' }}>
                    <h3 style={{ fontSize: '14px', color: '#155724', margin: '0 0 8px 0' }}>Success Rate</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#155724' }}>
                      {monitoringData.isLoading ? 'Loading...' :
                       monitoringData.error ? 'Error' :
                       monitoringData.metrics?.total_runs > 0 ?
                         Math.round((monitoringData.metrics.successful_runs / monitoringData.metrics.total_runs) * 100) + '%' :
                         'N/A'}
                    </p>
                  </div>

                  <div style={{ background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '8px', padding: '16px' }}>
                    <h3 style={{ fontSize: '14px', color: '#856404', margin: '0 0 8px 0' }}>Songs Scraped</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#856404' }}>
                      {monitoringData.isLoading ? 'Loading...' :
                       monitoringData.error ? 'Error' :
                       monitoringData.metrics?.total_songs_scraped ?? 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Recent Runs */}
                <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid #dee2e6', background: '#f8f9fa' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#495057' }}>Recent Scraping Runs</h3>
                  </div>

                  <div style={{ padding: '20px' }}>
                    {monitoringData.isLoading ? (
                      <div style={{ textAlign: 'center', color: '#6c757d' }}>
                        <p style={{ margin: 0, fontSize: '14px' }}>
                          🔄 Loading recent scraping activity...
                        </p>
                      </div>
                    ) : monitoringData.error ? (
                      <div style={{ textAlign: 'center', color: '#dc3545' }}>
                        <p style={{ margin: 0, fontSize: '14px' }}>
                          ⚠️ Error loading data: {monitoringData.error}
                        </p>
                        <button
                          onClick={fetchMonitoringData}
                          style={{
                            marginTop: '10px',
                            padding: '8px 16px',
                            backgroundColor: '#007bff',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    ) : monitoringData.runs.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#6c757d' }}>
                        <p style={{ margin: 0, fontSize: '14px' }}>
                          📭 No recent scraping runs found
                        </p>
                        <p style={{ margin: '10px 0 0 0', fontSize: '12px' }}>
                          This shows data from the last 24 hours across all scrapers:<br/>
                          • 1001tracklists<br/>
                          • MixesDB<br/>
                          • Setlist.fm<br/>
                          • Reddit
                        </p>
                      </div>
                    ) : (
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {monitoringData.runs.slice(0, 10).map((run: any, index: number) => (
                          <div key={run.id || index} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            borderBottom: index < Math.min(monitoringData.runs.length - 1, 9) ? '1px solid #dee2e6' : 'none',
                            fontSize: '14px'
                          }}>
                            <div>
                              <strong>{run.source || 'Unknown Source'}</strong>
                              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                                {run.songs_count || 0} songs • Run ID: {run.id}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                backgroundColor: run.status === 'completed' ? '#d4edda' :
                                                run.status === 'failed' ? '#f8d7da' :
                                                run.status === 'running' ? '#fff3cd' : '#e2e3e5',
                                color: run.status === 'completed' ? '#155724' :
                                       run.status === 'failed' ? '#721c24' :
                                       run.status === 'running' ? '#856404' : '#495057'
                              }}>
                                {run.status || 'unknown'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                                {run.created_at ? new Date(run.created_at).toLocaleDateString() : 'Unknown date'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Triggers Section */}
                <div style={{ marginTop: '30px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid #dee2e6', background: '#e9ecef' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#495057', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🚀 Manual Triggers
                      <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: 'normal' }}>
                        (Trigger scraping without waiting for scheduled times)
                      </span>
                    </h3>
                  </div>

                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Target Search Trigger */}
                    <div style={{ padding: '16px', background: '#fff', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#495057', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🎯 Target Track Search
                      </h4>
                      <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#6c757d', lineHeight: 1.4 }}>
                        Search for target tracks across all sources. Runs before scraping to identify what to collect.
                      </p>
                      <button
                        onClick={triggerTargetSearch}
                        disabled={triggerStates.targetSearch.loading}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: triggerStates.targetSearch.loading ? '#6c757d' : '#28a745',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: triggerStates.targetSearch.loading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: triggerStates.targetSearch.loading ? 0.7 : 1,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!triggerStates.targetSearch.loading) {
                            e.currentTarget.style.backgroundColor = '#218838';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!triggerStates.targetSearch.loading) {
                            e.currentTarget.style.backgroundColor = '#28a745';
                          }
                        }}
                      >
                        {triggerStates.targetSearch.loading ? (
                          <>
                            <div style={{
                              width: '12px',
                              height: '12px',
                              border: '2px solid #fff',
                              borderTop: '2px solid transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }} />
                            Running...
                          </>
                        ) : (
                          'Start Target Search'
                        )}
                      </button>
                      {triggerStates.targetSearch.lastTriggered && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#28a745' }}>
                          ✅ Last triggered: {new Date(triggerStates.targetSearch.lastTriggered).toLocaleTimeString()}
                        </div>
                      )}
                    </div>

                    {/* Scraper Tasks Trigger */}
                    <div style={{ padding: '16px', background: '#fff', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#495057', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🕷️ Run All Scrapers
                      </h4>
                      <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#6c757d', lineHeight: 1.4 }}>
                        Trigger immediate scraping across 1001tracklists, MixesDB, Setlist.fm, and Reddit sources.
                      </p>
                      <button
                        onClick={triggerScraperTasks}
                        disabled={triggerStates.scraperTasks.loading}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: triggerStates.scraperTasks.loading ? '#6c757d' : '#007bff',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: triggerStates.scraperTasks.loading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: triggerStates.scraperTasks.loading ? 0.7 : 1,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!triggerStates.scraperTasks.loading) {
                            e.currentTarget.style.backgroundColor = '#0056b3';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!triggerStates.scraperTasks.loading) {
                            e.currentTarget.style.backgroundColor = '#007bff';
                          }
                        }}
                      >
                        {triggerStates.scraperTasks.loading ? (
                          <>
                            <div style={{
                              width: '12px',
                              height: '12px',
                              border: '2px solid #fff',
                              borderTop: '2px solid transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }} />
                            Running...
                          </>
                        ) : (
                          'Start Scraping'
                        )}
                      </button>
                      {triggerStates.scraperTasks.lastTriggered && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#007bff' }}>
                          ✅ Last triggered: {new Date(triggerStates.scraperTasks.lastTriggered).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Usage Instructions */}
                  <div style={{ padding: '12px 20px', background: '#e7f3ff', borderTop: '1px solid #b8daff', fontSize: '11px', color: '#004085' }}>
                    <strong>Usage:</strong> Use "Target Search" first to identify tracks to scrape, then "Run All Scrapers" to collect data.
                    Results will appear in the sections above within a few minutes.
                  </div>
                </div>

                {/* API Connection Status */}
                <div style={{ marginTop: '20px', padding: '16px', background: '#e7f3ff', border: '1px solid #b8daff', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#004085' }}>📡 API Connection</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#004085' }}>
                    To see live scraping data, the monitoring API endpoints need to be connected.
                    The monitoring service should be running on port 8082.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default DJInterface;