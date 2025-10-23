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
import { Track } from '../types/index';
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

// Stable constants and utility functions (moved outside component for performance)
const CAMELOT_KEYS = ['1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
                      '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B'];

const ONBOARDING_STORAGE_KEY = 'songnodes-onboarding-dismissed';

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

  // Get track name from multiple potential sources
  const trackName = node.title || metadata.title || metadata.label || node.label || 'Unknown Track';

  // Get artist name from multiple potential sources
  const artistName = node.artist || metadata.artist || 'Unknown Artist';

  return {
    id: trackId,
    name: trackName,
    title: trackName, // Alias for compatibility
    artist: artistName,
    bpm: metadata.bpm || undefined,
    key: metadata.key || metadata.camelotKey || undefined,
    energy: metadata.energy || undefined,
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
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      style={{
        padding: '8px 10px',
        backgroundColor: isNowPlaying ? 'rgba(126,211,33,0.2)' : 'transparent',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '6px',
        color: '#F8F8F8',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        minHeight: '52px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        overflow: 'hidden'
      }}
    >
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        lineHeight: '1.3',
        marginBottom: '3px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%'
      }}>
        {track.name}
      </div>
      <div style={{
        fontSize: '11px',
        color: '#8E8E93',
        lineHeight: '1.4',
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

  // Get graph data from store with selective subscriptions to prevent unnecessary re-renders
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

  // Listen for openSettings event from child components (e.g., TidalPlaylistManager)
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
        // Transform node data to Track format if needed
        const trackData: Track = {
          id: track.id || nodeId,
          name: track.name || track.label || track.title || 'Unknown Track',
          title: track.name || track.label || track.title || 'Unknown Track',
          artist: track.artist || 'Unknown Artist',
          bpm: track.bpm,
          key: track.key,
          energy: track.energy,
          duration: track.duration,
          status: 'unplayed' as const,
          genre: track.genre || track.category || 'Electronic',
          isrc: track.isrc
        };

        setInspectedTrack(trackData);
        setIsModalOpen(true);
      }
    };

    window.addEventListener('openTrackDetails', handleOpenTrackDetails as EventListener);
    return () => window.removeEventListener('openTrackDetails', handleOpenTrackDetails as EventListener);
  }, []);

  // Credentials are now loaded automatically via Zustand onRehydrateStorage
  // No need to manually load on mount

  // Memoize track nodes to prevent recalculation on every render
  const validNodes = useMemo(() => {
    if (!graphData?.nodes) return [];

    // CRITICAL FIX: Deduplicate nodes by ID at the source
    // Backend may return duplicate nodes in the graph data
    const uniqueNodesMap = new Map<string, GraphNode>();

    graphData.nodes
      .filter(isValidTrackNode)
      .forEach(node => {
        if (!uniqueNodesMap.has(node.id)) {
          uniqueNodesMap.set(node.id, node);
        }
      });

    return Array.from(uniqueNodesMap.values());
  }, [graphData?.nodes?.length]);

  // Transform nodes to tracks with stable references
  const tracks = useMemo(() => {
    if (validNodes.length === 0) return [];

    // CRITICAL FIX: Deduplicate tracks by ID to prevent React key warnings
    // Backend may return duplicate nodes, so we use a Map to keep only the first occurrence
    const uniqueTracksMap = new Map<string, Track>();

    validNodes
      .map(transformNodeToTrack)
      .forEach(track => {
        if (!uniqueTracksMap.has(track.id)) {
          uniqueTracksMap.set(track.id, track);
        }
      });

    // Convert back to array and sort
    const transformedTracks = Array.from(uniqueTracksMap.values())
      .sort((a, b) => a.artist.localeCompare(b.artist) || a.name.localeCompare(b.name));

    return transformedTracks;
  }, [validNodes]);

  // Filtered tracks for PLAN mode with scoring algorithm
  const filteredLibraryTracks = useMemo(() => {
    if (!librarySearchQuery.trim()) return tracks;

    const query = librarySearchQuery.toLowerCase().trim();
    const searchTerms = query.split(/\s+/); // Support multi-term search

    // Scoring function
    const calculateScore = (track: Track): number => {
      let score = 0;
      const name = track.name?.toLowerCase() || '';
      const artist = track.artist?.toLowerCase() || '';
      const genre = track.genre?.toLowerCase() || '';
      const key = track.key?.toLowerCase() || '';
      const bpm = track.bpm?.toString() || '';

      searchTerms.forEach(term => {
        // Exact phrase matches (highest priority)
        if (name === term) score += 1000;
        if (artist === term) score += 900;

        // Word starts with term (high priority)
        const nameWords = name.split(/\s+/);
        const artistWords = artist.split(/\s+/);
        if (nameWords.some(word => word.startsWith(term))) score += 500;
        if (artistWords.some(word => word.startsWith(term))) score += 400;

        // Contains exact term (medium priority)
        if (name.includes(term)) score += 300;
        if (artist.includes(term)) score += 250;
        if (genre.includes(term)) score += 200;
        if (key.includes(term)) score += 150;
        if (bpm.includes(term)) score += 150;

        // Fuzzy match (1 char difference) - low priority
        const fuzzyMatch = (str: string, term: string): boolean => {
          if (Math.abs(str.length - term.length) > 1) return false;
          let diff = 0;
          const maxLen = Math.max(str.length, term.length);
          for (let i = 0; i < maxLen; i++) {
            if (str[i] !== term[i]) diff++;
            if (diff > 1) return false;
          }
          return diff === 1;
        };

        if (nameWords.some(word => fuzzyMatch(word, term))) score += 10;
        if (artistWords.some(word => fuzzyMatch(word, term))) score += 8;
      });

      return score;
    };

    // Filter and score tracks
    const scoredTracks = tracks
      .map(track => ({ track, score: calculateScore(track) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ track }) => track);

    return scoredTracks;
  }, [tracks, librarySearchQuery]);

  // Mode toggle handler
  const toggleMode = () => {
    setMode(mode === 'play' ? 'plan' : 'play');
  };

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

  // Memoized event handlers to prevent child re-renders
  const handleTrackInspect = useCallback((track: Track) => {
    // Trigger zoom-to-node navigation for the selected track
    // Find the node ID corresponding to this track
    const nodeId = track.id || `track-${track.artist}-${track.title}`;
    view.navigateToNode(nodeId, {
      highlight: true,
      openModal: false, // Never open modal - consistent behavior in both modes
      selectNode: true
    });

    // Set as now playing in both PLAN and PLAY modes (consistent behavior)
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
    } catch (error) {
      console.error('Failed to trigger target search:', error);
      setTriggerStates(prev => ({
        ...prev,
        targetSearch: { ...prev.targetSearch, loading: false }
      }));
    }
  }, []);

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

      setTriggerStates(prev => ({
        ...prev,
        scraperTasks: { loading: false, lastTriggered: new Date().toISOString() }
      }));
    } catch (error) {
      console.error('Failed to trigger scraper tasks:', error);
      setTriggerStates(prev => ({
        ...prev,
        scraperTasks: { ...prev.scraperTasks, loading: false }
      }));
    }
  }, []);

  const clearQueue = useCallback(async () => {
    // Confirm before clearing
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to clear all queued scraping tasks?\n\n' +
      'This will remove all pending tasks from:\n' +
      '• High priority queue\n' +
      '• Medium priority queue\n' +
      '• Low priority queue\n' +
      '• Main queue\n' +
      '• Failed queue\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    setTriggerStates(prev => ({
      ...prev,
      clearQueue: { ...prev.clearQueue, loading: true }
    }));

    try {
      const response = await fetch('/api/v1/scrapers/queue/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to clear queue: ${response.status}`);
      }

      const result = await response.json();

      alert(
        `✅ Queue Cleared Successfully!\n\n` +
        `Total items removed: ${result.total_items_cleared}\n\n` +
        `Details:\n` +
        `• High priority: ${result.cleared_queues.high}\n` +
        `• Medium priority: ${result.cleared_queues.medium}\n` +
        `• Low priority: ${result.cleared_queues.low}\n` +
        `• Main queue: ${result.cleared_queues.main}\n` +
        `• Failed queue: ${result.cleared_queues.failed}`
      );

      setTriggerStates(prev => ({
        ...prev,
        clearQueue: { loading: false, lastTriggered: new Date().toISOString() }
      }));
    } catch (error) {
      console.error('Failed to clear queue:', error);
      alert(`❌ Failed to clear queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTriggerStates(prev => ({
        ...prev,
        clearQueue: { ...prev.clearQueue, loading: false }
      }));
    }
  }, []);

  return (
    <div
      className="app-container dj-interface"
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
              onClick={() => setMode('play')}
              aria-label="Switch to PLAY mode"
              aria-pressed={mode === 'play'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: mode === 'play' ? '#7ED321' : 'transparent',
                border: 'none',
                borderRadius: '20px',
                color: mode === 'play' ? '#FFFFFF' : '#8E8E93',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                opacity: mode === 'play' ? 1 : 0.7
              }}
            >
              ▶️ PLAY
            </button>
            <button
              onClick={() => setMode('plan')}
              aria-label="Switch to PLAN mode"
              aria-pressed={mode === 'plan'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: mode === 'plan' ? '#4A90E2' : 'transparent',
                border: 'none',
                borderRadius: '20px',
                color: mode === 'plan' ? '#FFFFFF' : '#8E8E93',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                opacity: mode === 'plan' ? 1 : 0.7
              }}
            >
              📋 PLAN
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          overflowX: 'auto',
          flexWrap: 'nowrap',
          flex: 1,
          minWidth: 0,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.3) transparent'
        }}>
          <span style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(74,144,226,0.2)',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#4A90E2',
            fontWeight: 600,
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}>
            {tracks.length} Tracks Loaded
          </span>
          <span style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(126,211,33,0.2)',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#7ED321',
            fontWeight: 600,
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}>
            {graphData?.edges?.length || 0} Connections
          </span>

          <button
            onClick={() => setShowArtistAttribution(true)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(231,76,60,0.2)',
              border: '1px solid rgba(231,76,60,0.4)',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              marginRight: '8px',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(231,76,60,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(231,76,60,0.2)';
            }}
          >
            🎨 Fix Artist Attribution
          </button>

          <button
            onClick={() => setShowTracklistImporter(true)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(155,89,182,0.2)',
              border: '1px solid rgba(155,89,182,0.4)',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              marginRight: '8px',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(155,89,182,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(155,89,182,0.2)';
            }}
          >
            📝 Import Tracklist
          </button>

          <button
            onClick={() => setShowGraphFilters(true)}
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
              transition: 'all 0.2s',
              marginRight: '8px',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }}
          >
            🔧 Filters
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
              transition: 'all 0.2s',
              flexShrink: 0,
              whiteSpace: 'nowrap'
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

          <button
            onClick={() => setShowOnboarding(true)}
            title={onboardingTooltip}
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(69,90,100,0.2)',
              border: '1px solid rgba(69,90,100,0.4)',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(69,90,100,0.32)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(69,90,100,0.2)';
            }}
          >
            <HelpCircle size={18} strokeWidth={1.8} />
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
          gridTemplateRows: '1fr',
          gap: '16px',
          padding: '16px',
          overflow: 'hidden'
        }}>
        {/* PLAY Mode Layout */}
        {mode === 'play' && (
          <>
            {/* Graph and Browser Section - Full Height */}
            <section
              className="visualization-section"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 480px',
                gap: '16px',
                overflow: 'hidden',
                minHeight: 0,
                height: '100%'
              }}
            >
              {/* Graph Visualization */}
              <div style={{
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
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

        {/* PLAN Mode Layout */}
        {mode === 'plan' && (
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
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Library</h3>

              {/* Search Input */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search tracks, artists, BPM, key..."
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 32px 10px 12px',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#F8F8F8',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(74,144,226,0.6)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  }}
                />
                {librarySearchQuery && (
                  <button
                    onClick={() => setLibrarySearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#8E8E93',
                      cursor: 'pointer',
                      padding: '4px',
                      fontSize: '16px',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s'
                    }}
                    title="Clear search"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#F8F8F8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#8E8E93';
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Results Counter */}
              {librarySearchQuery && (
                <div style={{
                  fontSize: '11px',
                  color: '#8E8E93',
                  marginBottom: '8px',
                  padding: '0 4px'
                }}>
                  {filteredLibraryTracks.length} of {tracks.length} tracks
                </div>
              )}

              {/* Track List */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                overflowY: 'auto',
                flex: 1,
                minHeight: 0
              }}>
                {filteredLibraryTracks.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    color: '#8E8E93',
                    padding: '60px 20px',
                    fontSize: '14px'
                  }}>
                    {librarySearchQuery ? (
                      <>
                        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🔍</div>
                        <div style={{ fontWeight: 600, marginBottom: '8px' }}>No tracks found</div>
                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                          Try a different search term
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📚</div>
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

            {/* Central Area - Graph and Analysis */}
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
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
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                overflowX: 'auto',
                flexWrap: 'nowrap',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.3) transparent'
              }}>
                <button
                  onClick={() => setRightPanelTab('analysis')}
                  style={{
                    flexShrink: 0,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'analysis' ? 'rgba(74,144,226,0.2)' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'analysis' ? '#4A90E2' : '#8E8E93',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Track Analysis
                </button>
                <button
                  onClick={() => setRightPanelTab('keymood')}
                  style={{
                    flexShrink: 0,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'keymood' ? 'rgba(74,144,226,0.2)' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'keymood' ? '#4A90E2' : '#8E8E93',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🎭 Key & Mood
                </button>
                <button
                  onClick={() => setRightPanelTab('pathfinder')}
                  style={{
                    flexShrink: 0,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'pathfinder' ? 'rgba(138,43,226,0.2)' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'pathfinder' ? '#8A2BE2' : '#8E8E93',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🗺️ Pathfinder
                </button>
                <button
                  onClick={() => setRightPanelTab('tidal')}
                  style={{
                    flexShrink: 0,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'tidal' ? 'rgba(74,144,226,0.2)' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'tidal' ? '#4A90E2' : '#8E8E93',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🎵 Tidal
                </button>
                <button
                  onClick={() => setRightPanelTab('spotify')}
                  style={{
                    flexShrink: 0,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'spotify' ? 'rgba(29,185,84,0.2)' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'spotify' ? '#1DB954' : '#8E8E93',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🎧 Spotify
                </button>
                <button
                  onClick={() => setRightPanelTab('targets')}
                  style={{
                    flexShrink: 0,
                    padding: '12px 16px',
                    backgroundColor: rightPanelTab === 'targets' ? 'rgba(74,144,226,0.2)' : 'transparent',
                    border: 'none',
                    color: rightPanelTab === 'targets' ? '#4A90E2' : '#8E8E93',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🎯 Targets
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
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{nowPlaying.bpm || '---'}</div>
                          </div>
                          <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '11px', color: '#8E8E93', marginBottom: '4px' }}>KEY</div>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{nowPlaying.key || '---'}</div>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', color: '#8E8E93', marginBottom: '8px' }}>ENERGY</div>
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
                                    backgroundColor: i < nowPlaying.energy! ? '#7ED321' : 'rgba(255,255,255,0.1)',
                                    borderRadius: '2px'
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '14px', color: '#8E8E93' }}>---</div>
                          )}
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

                {rightPanelTab === 'pathfinder' && (
                  <PathfinderPanel />
                )}

                {rightPanelTab === 'tidal' && (
                  <TidalPlaylistManager />
                )}

                {rightPanelTab === 'spotify' && (
                  <SpotifyPlaylistManager />
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
        track={inspectedTrack as any}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSetAsCurrentlyPlaying={handleSetAsCurrentlyPlaying as any}
        currentlyPlayingTrack={nowPlaying as any}
      />

      {/* Track Context Menu for Pathfinder - Convert track to node format */}
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
