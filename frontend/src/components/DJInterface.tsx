import { trackFromNode as transformNodeToTrack } from '../utils/trackMetadata';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Play, ListChecks, SlidersHorizontal, Settings, FileText, UserPen, Trash2, Search, X,
  Library, SearchX, ServerCrash, MousePointerClick,
} from 'lucide-react';
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
import { DJMode } from '../types/dj';
import { Track, GraphNode } from '../types/index';
import useStore from '../store/useStore';
import { useDataLoader } from '../hooks/useDataLoader';
import { useIsMobile } from '../hooks/useIsMobile';
import { SN, StatusPill, KeyBadge, Bpm } from '../lib/songnodes';
import {
  SegmentedControl, Tabs, TabPanel, OverflowMenu, ConfirmDialog, showToast,
  EmptyPanel, ErrorPanel, LoadingPanel, TrackEnergy,
} from './ds';
import './DJInterface.graph.css';

/**
 * DJInterface - Main container implementing dual-mode interface
 * PLAN Mode: Full complexity for preparation and track selection
 * PLAY Mode: Cognitive offloading for live performance
 */

interface DJInterfaceProps {
  initialMode?: DJMode;
}

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
      type="button"
      className="gx-row"
      data-now={isNowPlaying ? '' : undefined}
      aria-current={isNowPlaying ? 'true' : undefined}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      <span className="gx-row__title">{track.name}</span>
      <span className="gx-row__meta">
        <span className="gx-row__artist">{track.artist}</span>
        {track.bpm ? <Bpm value={track.bpm} /> : null}
        {track.key || track.camelotKey ? <KeyBadge value={track.camelotKey || track.key} /> : null}
      </span>
    </button>
  );
});

type RightTab = 'analysis' | 'keymood' | 'pathfinder' | 'tidal' | 'spotify' | 'targets';
const RIGHT_TABS: { id: RightTab; label: string }[] = [
  { id: 'analysis', label: 'Track analysis' },
  { id: 'keymood', label: 'Key & mood' },
  { id: 'pathfinder', label: 'Pathfinder' },
  { id: 'tidal', label: 'TIDAL' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'targets', label: 'Targets' },
];
const isRightTab = (v: string | null): v is RightTab => !!v && RIGHT_TABS.some((t) => t.id === v);
const isMode = (v: string | null): v is DJMode => v === 'play' || v === 'plan';

interface QueueClearResult {
  total_items_cleared?: number;
  cleared_queues?: Record<string, number>;
}

export const DJInterface: React.FC<DJInterfaceProps> = ({ initialMode = 'play' }) => {
  // Detect if we're on a mobile device
  const isMobile = useIsMobile();

  // Mode and right-panel tab live in the URL (?mode=play|plan, ?tab=…)
  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  const tabParam = searchParams.get('tab');
  // A deep link to a Plan-only tab (e.g. /paths → ?tab=pathfinder) opens Plan mode
  const mode: DJMode = isMode(modeParam) ? modeParam : isRightTab(tabParam) ? 'plan' : initialMode;
  const rightPanelTab: RightTab = isRightTab(tabParam) ? tabParam : 'analysis';

  const updateParams = useCallback((patch: Record<string, string>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => next.set(k, v));
      return next;
    }, { replace: false });
  }, [setSearchParams]);
  const setMode = useCallback((m: DJMode) => updateParams({ mode: m }), [updateParams]);
  const setRightPanelTab = useCallback((t: RightTab) => updateParams({ mode: 'plan', tab: t }), [updateParams]);

  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);

  // Track inspection modal state
  const [inspectedTrack, setInspectedTrack] = useState<Track | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Settings panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Graph filter panel state
  const [showGraphFilters, setShowGraphFilters] = useState(false);

  // Context menu state for pathfinder
  const [contextMenuTrack, setContextMenuTrack] = useState<Track | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Artist Attribution Manager state
  const [showArtistAttribution, setShowArtistAttribution] = useState(false);

  // Tracklist Importer state
  const [showTracklistImporter, setShowTracklistImporter] = useState(false);

  // Clear-queue confirmation
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearQueueError, setClearQueueError] = useState<string | null>(null);

  // Manual trigger states
  const [triggerStates, setTriggerStates] = useState({
    targetSearch: { loading: false, lastTriggered: null as string | null },
    scraperTasks: { loading: false, lastTriggered: null as string | null },
    clearQueue: { loading: false, lastTriggered: null as string | null }
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
        const trackData = transformNodeToTrack({ ...track, id: track.id || nodeId });

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
  }, [graphData?.nodes]);

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

  /** Runs after the person confirms in the ConfirmDialog. */
  const clearQueue = useCallback(async () => {
    setClearQueueError(null);
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
        throw new Error(`The server answered ${response.status}`);
      }

      const result: QueueClearResult = await response.json();
      const total = result.total_items_cleared;

      setTriggerStates(prev => ({
        ...prev,
        clearQueue: { loading: false, lastTriggered: new Date().toISOString() }
      }));
      setConfirmClearOpen(false);
      showToast(
        total === undefined
          ? 'Scraping queue cleared'
          : `Scraping queue cleared: ${SN.format.count(total)} ${total === 1 ? 'task' : 'tasks'}`
      );
    } catch (error) {
      console.error('Failed to clear queue:', error);
      setClearQueueError(error instanceof Error ? error.message : 'The request failed');
      setTriggerStates(prev => ({
        ...prev,
        clearQueue: { ...prev.clearQueue, loading: false }
      }));
    }
  }, []);

  const handleMenuAction = useCallback((id: string) => {
    if (id === 'import') setShowTracklistImporter(true);
    else if (id === 'attribution') setShowArtistAttribution(true);
    else if (id === 'settings') setIsSettingsOpen(true);
    else if (id === 'clear-queue') { setClearQueueError(null); setConfirmClearOpen(true); }
  }, []);

  const edgeCount = graphData?.edges?.length || 0;

  // Loading and failure replace only the canvas; the panels keep their frame.
  const graphCanvas = isLoading ? (
    <div className="gx-state">
      <LoadingPanel
        message={tracks.length > 0 ? `Loading the graph: ${SN.format.count(tracks.length)} tracks so far…` : 'Loading the graph…'}
      />
    </div>
  ) : error ? (
    <div className="gx-state">
      <ErrorPanel
        icon={ServerCrash}
        status="bad"
        title="SongNodes couldn’t load the graph"
        retry="Try again in a few minutes. If it keeps failing, check that the graph service is running."
        actions={<button type="button" className="sn-btn" onClick={() => window.location.reload()}>Try again</button>}
      >
        {error}
      </ErrorPanel>
    </div>
  ) : isMobile ? (
    <MobileTrackExplorer />
  ) : (
    <GraphVisualization
      onTrackSelect={handleTrackInspect}
      onTrackRightClick={handleTrackRightClick}
      nowPlayingId={nowPlaying?.id ?? null}
    />
  );

  return (
    <div className="dj-interface gx">
      {/* Page toolbar: the shell's AppHeader owns the wordmark and page title */}
      <div className="gx-toolbar" role="toolbar" aria-label="Graph tools">
        <SegmentedControl<DJMode>
          label="Mode"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'play', label: 'Play', icon: Play },
            { value: 'plan', label: 'Plan', icon: ListChecks },
          ]}
        />
        <div className="gx-toolbar__meta" aria-live="polite">
          {isLoading ? (
            <StatusPill raw="running" label="Loading" />
          ) : error ? (
            <StatusPill raw="error" label="Not loaded" />
          ) : (
            <>
              <span className="sn-tag"><span className="gx-count">{SN.format.count(tracks.length)}</span> {tracks.length === 1 ? 'track' : 'tracks'}</span>
              <span className="sn-tag"><span className="gx-count">{SN.format.count(edgeCount)}</span> {edgeCount === 1 ? 'connection' : 'connections'}</span>
            </>
          )}
        </div>
        <div className="gx-toolbar__actions">
          <button type="button" className="sn-btn sn-btn--sm" onClick={() => setShowGraphFilters(true)}>
            <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
            Filters
          </button>
          <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={16} strokeWidth={2} aria-hidden="true" />
            Settings
          </button>
          <OverflowMenu
            small
            onSelect={handleMenuAction}
            items={[
              { id: 'import', label: 'Import tracklist', icon: FileText, group: 'Library' },
              { id: 'attribution', label: 'Fix artist attribution', icon: UserPen, group: 'Library' },
              { id: 'clear-queue', label: 'Clear scraping queue…', icon: Trash2, destructive: true },
            ]}
          />
        </div>
      </div>

      {/* Main Content Area */}
      {mode === 'play' && (
        <div className="gx-main gx-main--play visualization-section">
          <section className="gx-panel gx-panel--canvas" aria-label="Track graph">
            {graphCanvas}
            {!isMobile && !isLoading && !error && (
              <div className="gx-legend" aria-label="Legend">
                <p className="gx-legend__title">Graph</p>
                <ul className="sn-graph-controls__legend">
                  <li className="sn-graph-controls__legend-note">All tracks alike; only states carry colour.</li>
                  <li><span className="sn-graph-controls__ring" style={{ ['--c' as string]: 'var(--brand)' } as React.CSSProperties} aria-hidden="true" />Selected</li>
                  <li><span className="sn-graph-controls__ring" style={{ ['--c' as string]: 'var(--now)' } as React.CSSProperties} aria-hidden="true" />Now playing</li>
                  <li><span className="sn-graph-controls__ring" style={{ ['--c' as string]: 'var(--mod-paths)' } as React.CSSProperties} aria-hidden="true" />Path</li>
                </ul>
              </div>
            )}
          </section>

          <section className="gx-panel gx-panel--scroll" aria-label="Next track suggestions">
            <IntelligentBrowser
              currentTrack={nowPlaying as any}
              allTracks={tracks as any}
              onTrackSelect={handleTrackInspect as any}
              graphEdges={graphData?.edges || []} // Graph edges drive adjacency-based recommendations
              config={{
                maxRecommendations: 12,
                showReasons: true,
                groupBy: 'compatibility'
              }}
            />
          </section>
        </div>
      )}

      {mode === 'plan' && (
        <div className="gx-main gx-main--plan">
          {/* Library Browser */}
          <section className="gx-panel" aria-labelledby="gx-library-title">
            <div className="gx-panel__head">
              <h2 className="sn-title title-s" id="gx-library-title">Library</h2>
            </div>
            <div className="gx-panel__body">
              <div className="gx-search">
                <span className="gx-search__icon" aria-hidden="true"><Search size={16} strokeWidth={2} /></span>
                <input
                  type="search"
                  className="sn-input"
                  aria-label="Search the library"
                  placeholder="Search tracks"
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                />
                {librarySearchQuery && (
                  <button
                    type="button"
                    className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm gx-search__clear"
                    aria-label="Clear search"
                    title="Clear search"
                    onClick={() => setLibrarySearchQuery('')}
                  >
                    <X size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>

              {librarySearchQuery && (
                <p className="gx-results" role="status">
                  {SN.format.count(filteredLibraryTracks.length)} of {SN.format.count(tracks.length)} tracks
                </p>
              )}

              {filteredLibraryTracks.length === 0 ? (
                librarySearchQuery ? (
                  <EmptyPanel
                    compact
                    icon={SearchX}
                    title="No tracks match this search"
                    meta={<span className="sn-tag">{librarySearchQuery}</span>}
                    actions={<button type="button" className="sn-btn" onClick={() => setLibrarySearchQuery('')}>Clear search</button>}
                  >
                    None of the {SN.format.count(tracks.length)} tracks match.
                  </EmptyPanel>
                ) : (
                  isLoading ? (
                    <LoadingPanel message="Loading tracks…" rows={8} />
                  ) : (
                    <EmptyPanel compact icon={Library} title={error ? 'Library not loaded' : 'No tracks in the graph yet'}>
                      {error
                        ? 'The track list fills in once the graph loads.'
                        : 'Tracks appear here once the graph has tracks with an artist and a title.'}
                    </EmptyPanel>
                  )
                )
              ) : (
                <div className="gx-list">
                  {filteredLibraryTracks.map(track => (
                    <TrackListItem
                      key={track.id}
                      track={track}
                      isNowPlaying={nowPlaying?.id === track.id}
                      onInspect={handleTrackInspect}
                      onRightClick={handleTrackRightClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Central Area - Graph */}
          <section className="gx-panel gx-panel--canvas" aria-label="Track graph">
            {graphCanvas}
          </section>

          {/* Right Panel with Tabs */}
          <section className="gx-panel" aria-label="Plan tools">
            <Tabs<RightTab>
              label="Plan tools"
              idBase="gx-plan"
              tabs={RIGHT_TABS}
              value={rightPanelTab}
              onChange={setRightPanelTab}
            />
            <TabPanel idBase="gx-plan" id={rightPanelTab}>
              {rightPanelTab === 'analysis' && (
                nowPlaying ? (
                  <div className="gx-analysis">
                    <div>
                      <h3 className="sn-title title-s">{nowPlaying.name}</h3>
                      <p className="gx-analysis__artist">{nowPlaying.artist}</p>
                    </div>
                    <div className="gx-kv">
                      <div className="gx-kv__cell">
                        <div className="gx-kv__label">BPM</div>
                        <Bpm value={nowPlaying.bpm} />
                      </div>
                      <div className="gx-kv__cell">
                        <div className="gx-kv__label">Key</div>
                        <KeyBadge value={nowPlaying.camelotKey || nowPlaying.key} withName />
                      </div>
                    </div>
                    <div>
                      <div className="gx-kv__label">Energy</div>
                      <TrackEnergy energy={nowPlaying.energy} scale={(nowPlaying as { energy_scale?: string }).energy_scale} />
                    </div>
                  </div>
                ) : (
                  <EmptyPanel compact icon={MousePointerClick} title="No track selected">
                    Pick a track in the library or the graph to see its BPM, key and energy.
                  </EmptyPanel>
                )
              )}

              {rightPanelTab === 'keymood' && (
                <KeyMoodPanel showInSidePanel={true} />
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
            </TabPanel>
          </section>
        </div>
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

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear the scraping queue?"
        confirmLabel="Clear queue"
        busy={triggerStates.clearQueue.loading}
        busyLabel="Clearing queue…"
        onConfirm={clearQueue}
        onCancel={() => setConfirmClearOpen(false)}
        facts={[
          'Removes every pending task from the high, medium, low, main and failed queues.',
          'Target tracks and scraped playlists stay as they are.',
          ...(clearQueueError ? [<span key="err" className="sn-field__error" role="alert">Couldn’t clear the queue: {clearQueueError}.</span>] : []),
        ]}
      >
        Scrapers stop working through the queued searches. This can’t be undone.
      </ConfirmDialog>

    </div>
  );
};

export default DJInterface;
