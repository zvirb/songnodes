import { trackFromNode as transformNodeToTrack } from '../utils/trackMetadata';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { HelpCircle } from 'lucide-react';
import { NowPlayingDeck } from './NowPlayingDeck';
import { IntelligentBrowser } from './IntelligentBrowser';
import GraphVisualization from './GraphVisualization';
import MobileTrackExplorer from './MobileTrackExplorer';
import { TrackDetailsModal } from './TrackDetailsModal';
import { ContextMenu } from './ContextMenu';
import { SettingsPanel } from './SettingsPanel';
import { TidalPlaylistManager } from './TidalPlaylistManager';
import { SpotifyPlaylistManager } from './SpotifyPlaylistManager';
import { PathfinderPanel } from './PathfinderPanel';
import { KeyMoodPanel } from './KeyMoodPanel';
import TargetTracksManager from './TargetTracksManager';
import GraphFilterPanel from './GraphFilterPanel';
import { ArtistAttributionManager } from './ArtistAttributionManager';
import { TracklistImporter } from './TracklistImporter';
import { Track as DJTrack, DJMode } from '../types/dj';
import { Track, GraphNode } from '../types/index';
import useStore from '../store/useStore';
import { useDataLoader } from '../hooks/useDataLoader';
import { useIsMobile } from '../hooks/useIsMobile';
import { OnboardingOverlay } from './OnboardingOverlay';

/**
 * DJInterface - Main container implementing dual-mode interface
 * PLAN Mode: Full complexity for preparation and track selection
 * PLAY Mode: Cognitive offloading for live performance
 */

interface DJInterfaceProps {
  initialMode?: DJMode;
}

// Stable constants and utility functions
const CAMELOT_KEYS = ['1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
                      '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B'];

const ONBOARDING_STORAGE_KEY = 'songnodes-onboarding-dismissed';

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
  onRightClick?: (track: Track, position: { x: number; y: number }) => void;
}>(({ track, isNowPlaying, onInspect, onRightClick }) => {
  const handleClick = useCallback(() => {
    onInspect(track);
  }, [track, onInspect]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    onInspect(track);
  }, [track, onInspect]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRightClick) {
      onRightClick(track, { x: e.clientX, y: e.clientY });
    }
  }, [track, onRightClick]);

  return (
    <button
      key={track.id}
      data-testid="track-item"
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      aria-label={`${track.name} by ${track.artist}`}
      aria-current={isNowPlaying ? 'true' : undefined}
      style={{
        padding: 'var(--space-2) var(--space-3)',
        backgroundColor: isNowPlaying ? 'var(--color-brand-primary-muted)' : 'transparent',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-base)',
        color: 'var(--color-text-primary)',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'var(--transition-button)',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        minHeight: 'var(--touch-target-min)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        overflow: 'hidden'
      }}
    >
      <div style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-semibold)',
        lineHeight: 'var(--line-height-tight)',
        marginBottom: 'var(--space-1)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%'
      }}>
        {track.name}
      </div>
      <div style={{
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-tertiary)',
        lineHeight: 'var(--line-height-normal)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%'
      }}>
        {track.artist}
        {track.bpm && <> • {track.bpm} BPM</>}
        {track.key && <> • {track.key}</>}
      </div>
    </button>
  );
});

export const DJInterface: React.FC<DJInterfaceProps> = ({ initialMode = 'play' }) => {
  // Detect if we're on a mobile device
  const isMobile = useIsMobile();

  const [mode, setMode] = useState<DJMode>(initialMode);
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);

  // Track inspection modal state
  const [inspectedTrack, setInspectedTrack] = useState<Track | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Settings panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Orientation overlay state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Graph filter panel state
  const [showGraphFilters, setShowGraphFilters] = useState(false);

  // Context menu state for pathfinder
  const [contextMenuTrack, setContextMenuTrack] = useState<Track | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Right panel tab state (PLAN mode)
  const [rightPanelTab, setRightPanelTab] = useState<'analysis' | 'keymood' | 'pathfinder' | 'tidal' | 'spotify' | 'targets'>('analysis');

  // Artist Attribution Manager state
  const [showArtistAttribution, setShowArtistAttribution] = useState(false);

  // Tracklist Importer state
  const [showTracklistImporter, setShowTracklistImporter] = useState(false);

  // Manual trigger states
  const [triggerStates, setTriggerStates] = useState({
    targetSearch: { loading: false, lastTriggered: null },
    scraperTasks: { loading: false, lastTriggered: null },
    clearQueue: { loading: false, lastTriggered: null }
  });

  // Library search state (PLAN mode)
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');

  // Get graph data from store
  const graphData = useStore(state => state.graphData);
  const isLoading = useStore(state => state.isLoading);
  const error = useStore(state => state.error);
  const credentials = useStore(state => state.credentials);
  const view = useStore(state => state.view);

  // Load data and credentials
  useDataLoader();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const dismissed = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
      setOnboardingDismissed(dismissed);
      if (!dismissed) {
        setShowOnboarding(true);
      }
    } catch (error) {
      console.warn('[DJInterface] Unable to read onboarding preference:', error);
    }
  }, []);

  // Listen for openSettings event from child components
  useEffect(() => {
    const handleOpenSettings = () => {
      setIsSettingsOpen(true);
    };

    window.addEventListener('openSettings', handleOpenSettings);
    return () => window.removeEventListener('openSettings', handleOpenSettings);
  }, []);

  // Listen for openTrackDetails event from context menu
  useEffect(() => {
    const handleOpenTrackDetails = (event: CustomEvent) => {
      const { track, nodeId } = event.detail;
      if (track) {
        const trackData = transformNodeToTrack({ ...track, id: track.id || nodeId });
        setInspectedTrack(trackData);
        setIsModalOpen(true);
      }
    };

    window.addEventListener('openTrackDetails', handleOpenTrackDetails as EventListener);
    return () => window.removeEventListener('openTrackDetails', handleOpenTrackDetails as EventListener);
  }, []);

  // Memoize track nodes
  const validNodes = useMemo(() => {
    if (!graphData?.nodes) return [];

    const uniqueNodesMap = new Map<string, GraphNode>();
    graphData.nodes
      .filter(isValidTrackNode)
      .forEach(node => {
        if (!uniqueNodesMap.has(node.id)) {
          uniqueNodesMap.set(node.id, node);
        }
      });

    return Array.from(uniqueNodesMap.values());
  }, [graphData?.nodes]);

  // Transform nodes to tracks
  const tracks = useMemo(() => {
    if (validNodes.length === 0) return [];

    const uniqueTracksMap = new Map<string, Track>();
    validNodes
      .map(transformNodeToTrack)
      .forEach(track => {
        if (!uniqueTracksMap.has(track.id)) {
          uniqueTracksMap.set(track.id, track);
        }
      });

    return Array.from(uniqueTracksMap.values())
      .sort((a, b) => a.artist.localeCompare(b.artist) || a.name.localeCompare(b.name));
  }, [validNodes]);

  // Filtered tracks for PLAN mode
  const filteredLibraryTracks = useMemo(() => {
    if (!librarySearchQuery.trim()) return tracks;

    const query = librarySearchQuery.toLowerCase().trim();
    const searchTerms = query.split(/\s+/);

    const calculateScore = (track: Track): number => {
      let score = 0;
      const name = track.name?.toLowerCase() || '';
      const artist = track.artist?.toLowerCase() || '';
      const genre = track.genre?.toLowerCase() || '';
      const key = track.key?.toLowerCase() || '';
      const bpm = track.bpm?.toString() || '';

      searchTerms.forEach(term => {
        if (name === term) score += 1000;
        if (artist === term) score += 900;

        const nameWords = name.split(/\s+/);
        const artistWords = artist.split(/\s+/);
        if (nameWords.some(word => word.startsWith(term))) score += 500;
        if (artistWords.some(word => word.startsWith(term))) score += 400;

        if (name.includes(term)) score += 300;
        if (artist.includes(term)) score += 250;
        if (genre.includes(term)) score += 200;
        if (key.includes(term)) score += 150;
        if (bpm.includes(term)) score += 150;
      });

      return score;
    };

    return tracks
      .map(track => ({ track, score: calculateScore(track) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ track }) => track);
  }, [tracks, librarySearchQuery]);

  const handleOnboardingDismiss = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const handleOnboardingDisable = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      } catch (error) {
        console.warn('[DJInterface] Unable to persist onboarding preference:', error);
      }
    }
    setOnboardingDismissed(true);
    setShowOnboarding(false);
  }, []);

  const onboardingTooltip = onboardingDismissed
    ? 'Open the orientation guide again'
    : 'Show a quick orientation guide';

  const handleTrackInspect = useCallback((track: Track) => {
    const nodeId = track.id || `track-${track.artist}-${track.name}`;
    view.navigateToNode(nodeId, {
      highlight: true,
      openModal: false,
      selectNode: true
    });
    setNowPlaying(track);
  }, [view]);

  const handleSetAsCurrentlyPlaying = useCallback((track: Track) => {
    setNowPlaying(track);
    setIsModalOpen(false);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setInspectedTrack(null);
  }, []);

  const handleTrackRightClick = useCallback((track: Track, position: { x: number; y: number }) => {
    setContextMenuTrack(track);
    setContextMenuPosition(position);
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenuTrack(null);
    setContextMenuPosition(null);
  }, []);

  return (
    <div
      className="app-container dj-interface"
      data-testid="dj-interface"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--color-bg-base)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-family-base)'
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
        padding: 'var(--space-4) var(--space-6)',
        backgroundColor: 'var(--color-panel-bg)',
        borderBottom: '1px solid var(--color-border-subtle)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
          <h1 style={{
            margin: 0,
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            background: 'linear-gradient(90deg, var(--color-brand-secondary), var(--color-brand-primary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            🎵 SongNodes DJ
          </h1>

          {/* Mode Toggle */}
          <div
            data-testid="dj-mode-selector"
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              backgroundColor: 'var(--color-bg-elevated-1)',
              padding: 'var(--space-1)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border-subtle)'
            }}
          >
            <button
              onClick={() => setMode('play')}
              data-testid="mode-toggle"
              aria-label="Switch to PLAY mode"
              aria-pressed={mode === 'play'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: mode === 'play' ? 'var(--color-brand-primary)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                color: mode === 'play' ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: 'pointer',
                transition: 'var(--transition-button)',
                opacity: mode === 'play' ? 1 : 0.7,
                minHeight: 'var(--button-height-base)'
              }}
            >
              ▶️ PLAY
            </button>
            <button
              onClick={() => setMode('plan')}
              data-testid="mode-toggle-plan"
              aria-label="Switch to PLAN mode"
              aria-pressed={mode === 'plan'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: mode === 'plan' ? 'var(--color-brand-secondary)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                color: mode === 'plan' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: 'pointer',
                transition: 'var(--transition-button)',
                opacity: mode === 'plan' ? 1 : 0.7,
                minHeight: 'var(--button-height-base)'
              }}
            >
              📋 PLAN
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'center',
          overflowX: 'auto',
          flexWrap: 'nowrap',
          flex: 1,
          minWidth: 0,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-border-subtle) transparent'
        }}>
          <span style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-brand-secondary-muted)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-brand-secondary)',
            fontWeight: 'var(--font-weight-semibold)',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}>
            {tracks.length} Tracks Loaded
          </span>
          <span style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-success-bg)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-success)',
            fontWeight: 'var(--font-weight-semibold)',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}>
            {graphData?.edges?.length || 0} Connections
          </span>

          <button
            onClick={() => setShowArtistAttribution(true)}
            data-testid="fix-artist-attribution-button"
            aria-label="Fix artist attribution"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              transition: 'var(--transition-button)',
              marginRight: 'var(--space-2)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              minHeight: 'var(--button-height-base)'
            }}
          >
            🎨 Fix Artist Attribution
          </button>

          <button
            onClick={() => setShowTracklistImporter(true)}
            data-testid="import-tracklist-button"
            aria-label="Import tracklist"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-info-bg)',
              border: '1px solid var(--color-info-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              transition: 'var(--transition-button)',
              marginRight: 'var(--space-2)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              minHeight: 'var(--button-height-base)'
            }}
          >
            📝 Import Tracklist
          </button>

          <button
            onClick={() => setShowGraphFilters(true)}
            data-testid="graph-filters-button"
            aria-label="Open graph filters"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-bg-elevated-2)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              transition: 'var(--transition-button)',
              marginRight: 'var(--space-2)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              minHeight: 'var(--button-height-base)'
            }}
          >
            🔧 Filters
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            data-testid="settings-toggle"
            aria-label="Open settings panel"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-bg-elevated-2)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              transition: 'var(--transition-button)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              minHeight: 'var(--button-height-base)'
            }}
          >
            ⚙️ Settings
          </button>

          <button
            onClick={() => setShowOnboarding(true)}
            data-testid="quick-tour-button"
            title={onboardingTooltip}
            aria-label={onboardingTooltip}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-bg-elevated-2)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              transition: 'var(--transition-button)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              minHeight: 'var(--button-height-base)'
            }}
          >
            <HelpCircle size={18} strokeWidth={1.8} aria-hidden="true" />
            Quick Tour
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
          color: 'var(--color-text-tertiary)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid var(--color-brand-primary-muted)',
            borderTop: '4px solid var(--color-brand-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: 'var(--space-4)'
          }} />
          <p style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>Loading your music library...</p>
          <p style={{ fontSize: 'var(--font-size-sm)', margin: 'var(--space-2) 0 0 0', opacity: 0.7 }}>
            Found {tracks.length} tracks so far
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div
          data-testid="data-loading-error"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-error)',
            textAlign: 'center',
            padding: 'var(--space-10)'
          }}
        >
          <div style={{ fontSize: 'var(--font-size-4xl)', marginBottom: 'var(--space-4)' }}>⚠️</div>
          <h2 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--color-error)' }}>Failed to Load Music Library</h2>
          <p style={{ margin: '0 0 var(--space-6) 0', color: 'var(--color-text-tertiary)', maxWidth: '400px' }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              backgroundColor: 'var(--color-error)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
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
          gridTemplateRows: '1fr',
          gap: 'var(--space-4)',
          padding: 'var(--space-4)',
          overflow: 'hidden'
        }}>
        {/* PLAY Mode Layout */}
        {mode === 'play' && (
          <section
            className="visualization-section"
            data-testid="play-mode-panel"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 480px',
              gap: 'var(--space-4)',
              overflow: 'hidden',
              minHeight: 0,
              height: '100%'
            }}
          >
            {/* Graph Visualization */}
            <div style={{
              backgroundColor: 'var(--color-panel-bg)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              overflow: 'hidden',
              position: 'relative',
              height: '100%',
              width: '100%',
              minHeight: 0
            }}>
              {isMobile ? (
                <MobileTrackExplorer />
              ) : (
                <>
                  <GraphVisualization
                    onTrackSelect={handleTrackInspect}
                    onTrackRightClick={handleTrackRightClick}
                  />

                  {/* Graph Legend Overlay */}
                  <div style={{
                    position: 'absolute',
                    bottom: 'var(--space-5)',
                    left: 'var(--space-5)',
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-bg-base)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                      Node Colors
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--color-brand-primary)', borderRadius: '50%' }} />
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Perfect Match</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--color-warning)', borderRadius: '50%' }} />
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Compatible</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--color-brand-secondary)', borderRadius: '50%' }} />
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>Default</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Intelligent Browser */}
            <div style={{
              overflow: 'auto',
              maxHeight: '100%'
            }}>
              <IntelligentBrowser
                currentTrack={nowPlaying as any}
                allTracks={tracks as any}
                onTrackSelect={handleTrackInspect as any}
                graphEdges={graphData?.edges || []}
                config={{
                  maxRecommendations: 12,
                  showReasons: true,
                  groupBy: 'compatibility'
                }}
              />
            </div>
          </section>
        )}

        {/* PLAN Mode Layout */}
        {mode === 'plan' && (
          <section
            data-testid="plan-mode-panel"
            style={{
              display: 'grid',
              gridTemplateColumns: '250px 1fr 350px',
              gap: 'var(--space-5)',
              height: '100%',
              overflow: 'hidden'
            }}
          >
            {/* Library Browser */}
            <div style={{
              backgroundColor: 'var(--color-panel-bg)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Library</h3>

              {/* Search Input */}
              <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
                <input
                  type="text"
                  data-testid="track-search-input"
                  placeholder="🔍 Search tracks, artists, BPM, key..."
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  aria-label="Search library tracks"
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-8) var(--space-2) var(--space-3)',
                    backgroundColor: 'var(--color-bg-elevated-1)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    outline: 'none',
                    transition: 'var(--transition-all)'
                  }}
                />
                {librarySearchQuery && (
                  <button
                    onClick={() => setLibrarySearchQuery('')}
                    data-testid="clear-search-button"
                    aria-label="Clear search"
                    style={{
                      position: 'absolute',
                      right: 'var(--space-2)',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-tertiary)',
                      cursor: 'pointer',
                      padding: 'var(--space-1)',
                      fontSize: 'var(--font-size-base)',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'var(--transition-color)'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Results Counter */}
              {librarySearchQuery && (
                <div style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  marginBottom: 'var(--space-2)',
                  padding: '0 var(--space-1)'
                }}>
                  {filteredLibraryTracks.length} of {tracks.length} tracks
                </div>
              )}

              {/* Track List */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
                overflowY: 'auto',
                flex: 1,
                minHeight: 0
              }}>
                {filteredLibraryTracks.length === 0 ? (
                  <div
                    data-testid="no-search-results"
                    style={{
                      textAlign: 'center',
                      color: 'var(--color-text-tertiary)',
                      padding: 'var(--space-10) var(--space-5)',
                      fontSize: 'var(--font-size-sm)'
                    }}
                  >
                    {librarySearchQuery ? (
                      <>
                        <div style={{ fontSize: 'var(--font-size-4xl)', marginBottom: 'var(--space-4)', opacity: 0.5 }}>🔍</div>
                        <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>No tracks found</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.7 }}>
                          Try a different search term
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 'var(--font-size-4xl)', marginBottom: 'var(--space-4)', opacity: 0.5 }}>📚</div>
                        <div>No tracks in library</div>
                      </>
                    )}
                  </div>
                ) : (
                  filteredLibraryTracks.map(track => (
                    <TrackListItem
                      key={track.id}
                      track={track}
                      isNowPlaying={nowPlaying?.id === track.id}
                      onInspect={handleTrackInspect}
                      onRightClick={handleTrackRightClick}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Central Area - Graph */}
            <div style={{
              backgroundColor: 'var(--color-panel-bg)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              overflow: 'hidden',
              height: '100%',
              width: '100%',
              minHeight: 0
            }}>
              {isMobile ? (
                <MobileTrackExplorer />
              ) : (
                <GraphVisualization
                  onTrackSelect={handleTrackInspect}
                  onTrackRightClick={handleTrackRightClick}
                />
              )}
            </div>

            {/* Right Panel with Tabs */}
            <div
              data-testid="right-panel"
              style={{
                backgroundColor: 'var(--color-panel-bg)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Tab Header */}
              <div
                role="tablist"
                style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  overflowX: 'auto',
                  flexWrap: 'nowrap',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--color-border-subtle) transparent'
                }}
              >
                <button
                  onClick={() => setRightPanelTab('analysis')}
                  data-testid="right-panel-tab-analysis"
                  role="tab"
                  aria-selected={rightPanelTab === 'analysis'}
                  style={{
                    flexShrink: 0,
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: rightPanelTab === 'analysis' ? 'var(--color-brand-secondary-muted)' : 'transparent',
                    border: 'none',
                    borderBottom: rightPanelTab === 'analysis' ? '2px solid var(--color-brand-secondary)' : '2px solid transparent',
                    color: rightPanelTab === 'analysis' ? 'var(--color-brand-secondary)' : 'var(--color-text-tertiary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    cursor: 'pointer',
                    transition: 'var(--transition-color)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Track Analysis
                </button>
                <button
                  onClick={() => setRightPanelTab('keymood')}
                  data-testid="right-panel-tab-keymood"
                  role="tab"
                  aria-selected={rightPanelTab === 'keymood'}
                  style={{
                    flexShrink: 0,
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: rightPanelTab === 'keymood' ? 'var(--color-brand-primary-muted)' : 'transparent',
                    border: 'none',
                    borderBottom: rightPanelTab === 'keymood' ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
                    color: rightPanelTab === 'keymood' ? 'var(--color-brand-primary)' : 'var(--color-text-tertiary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    cursor: 'pointer',
                    transition: 'var(--transition-color)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🎭 Key & Mood
                </button>
                <button
                  onClick={() => setRightPanelTab('pathfinder')}
                  data-testid="right-panel-tab-pathfinder"
                  role="tab"
                  aria-selected={rightPanelTab === 'pathfinder'}
                  style={{
                    flexShrink: 0,
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: rightPanelTab === 'pathfinder' ? 'rgba(138,43,226,0.2)' : 'transparent',
                    border: 'none',
                    borderBottom: rightPanelTab === 'pathfinder' ? '2px solid #8A2BE2' : '2px solid transparent',
                    color: rightPanelTab === 'pathfinder' ? '#8A2BE2' : 'var(--color-text-tertiary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    cursor: 'pointer',
                    transition: 'var(--transition-color)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🗺️ Pathfinder
                </button>
                <button
                  onClick={() => setRightPanelTab('tidal')}
                  data-testid="right-panel-tab-tidal"
                  role="tab"
                  aria-selected={rightPanelTab === 'tidal'}
                  style={{
                    flexShrink: 0,
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: rightPanelTab === 'tidal' ? 'var(--color-brand-secondary-muted)' : 'transparent',
                    border: 'none',
                    borderBottom: rightPanelTab === 'tidal' ? '2px solid var(--color-brand-secondary)' : '2px solid transparent',
                    color: rightPanelTab === 'tidal' ? 'var(--color-brand-secondary)' : 'var(--color-text-tertiary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    cursor: 'pointer',
                    transition: 'var(--transition-color)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🎵 Tidal
                </button>
                <button
                  onClick={() => setRightPanelTab('spotify')}
                  data-testid="right-panel-tab-spotify"
                  role="tab"
                  aria-selected={rightPanelTab === 'spotify'}
                  style={{
                    flexShrink: 0,
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: rightPanelTab === 'spotify' ? 'var(--color-success-bg)' : 'transparent',
                    border: 'none',
                    borderBottom: rightPanelTab === 'spotify' ? '2px solid var(--color-success)' : '2px solid transparent',
                    color: rightPanelTab === 'spotify' ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    cursor: 'pointer',
                    transition: 'var(--transition-color)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🎧 Spotify
                </button>
                <button
                  onClick={() => setRightPanelTab('targets')}
                  data-testid="right-panel-tab-targets"
                  role="tab"
                  aria-selected={rightPanelTab === 'targets'}
                  style={{
                    flexShrink: 0,
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: rightPanelTab === 'targets' ? 'var(--color-brand-secondary-muted)' : 'transparent',
                    border: 'none',
                    borderBottom: rightPanelTab === 'targets' ? '2px solid var(--color-brand-secondary)' : '2px solid transparent',
                    color: rightPanelTab === 'targets' ? 'var(--color-brand-secondary)' : 'var(--color-text-tertiary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    cursor: 'pointer',
                    transition: 'var(--transition-color)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🎯 Targets
                </button>
              </div>

              {/* Tab Content */}
              <div style={{
                flex: 1,
                padding: 'var(--space-5)',
                overflowY: 'auto'
              }}>
                {rightPanelTab === 'analysis' && (
                  <div data-testid="analysis-panel">
                    <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--font-size-base)' }}>Track Analysis</h3>
                    {nowPlaying ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div>
                          <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>
                            {nowPlaying.name}
                          </h4>
                          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
                            {nowPlaying.artist}
                          </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-elevated-1)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>BPM</div>
                            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>{nowPlaying.bpm || '---'}</div>
                          </div>
                          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-elevated-1)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>KEY</div>
                            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>{nowPlaying.key || '---'}</div>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>ENERGY</div>
                          {nowPlaying.energy !== undefined ? (
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
                                    backgroundColor: i < nowPlaying.energy! ? 'var(--color-brand-primary)' : 'var(--color-bg-elevated-2)',
                                    borderRadius: '2px'
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>---</div>
                          )}
                        </div>

                        <button
                          style={{
                            padding: 'var(--space-3)',
                            backgroundColor: 'var(--color-brand-secondary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--color-text-primary)',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 'var(--font-weight-semibold)',
                            cursor: 'pointer'
                          }}
                        >
                          Analyze Full Track
                        </button>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                        Select a track to view analysis
                      </p>
                    )}
                  </div>
                )}

                {rightPanelTab === 'keymood' && (
                  <div data-testid="key-mood-panel">
                    <KeyMoodPanel
                      showInSidePanel={true}
                      className="h-full"
                    />
                  </div>
                )}

                {rightPanelTab === 'pathfinder' && (
                  <div data-testid="pathfinder-panel">
                    <PathfinderPanel />
                  </div>
                )}

                {rightPanelTab === 'tidal' && (
                  <div data-testid="tidal-panel">
                    <TidalPlaylistManager />
                  </div>
                )}

                {rightPanelTab === 'spotify' && (
                  <div data-testid="spotify-panel">
                    <SpotifyPlaylistManager />
                  </div>
                )}

                {rightPanelTab === 'targets' && (
                  <div data-testid="targets-panel">
                    <TargetTracksManager />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        </main>
      )}

      {/* Track Details Modal */}
      <TrackDetailsModal
        track={inspectedTrack as any}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSetAsCurrentlyPlaying={handleSetAsCurrentlyPlaying as any}
        currentlyPlayingTrack={nowPlaying as any}
      />

      {/* Track Context Menu for Pathfinder */}
      {contextMenuTrack && contextMenuPosition && (
        <ContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          targetType="node"
          targetData={{
            id: contextMenuTrack.id,
            label: contextMenuTrack.name,
            type: 'track',
            track: contextMenuTrack,
            artist: contextMenuTrack.artist,
            genre: contextMenuTrack.genre,
            bpm: contextMenuTrack.bpm,
            key: contextMenuTrack.key,
          }}
          onClose={handleContextMenuClose}
        />
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Graph Filter Panel */}
      <GraphFilterPanel
        isOpen={showGraphFilters}
        onClose={() => setShowGraphFilters(false)}
      />

      {/* Artist Attribution Manager */}
      {showArtistAttribution && (
        <ArtistAttributionManager
          onClose={() => setShowArtistAttribution(false)}
        />
      )}

      {/* Tracklist Importer */}
      {showTracklistImporter && (
        <TracklistImporter
          onClose={() => setShowTracklistImporter(false)}
        />
      )}

      <OnboardingOverlay
        open={showOnboarding}
        onClose={handleOnboardingDismiss}
        onDisable={handleOnboardingDisable}
      />
    </div>
  );
};

export default DJInterface;
