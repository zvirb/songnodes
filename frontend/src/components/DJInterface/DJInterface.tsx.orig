/**
 * DJInterface - Main DJ Control Center
 *
 * Dual-mode graph exploration interface for track discovery and playlist management.
 * Orchestrates sub-components for PLAN (preparation) and PLAY (performance) modes.
 *
 * @module DJInterface
 */

import React, { useState, useCallback, useEffect } from 'react';
import { TrackDetailsModal } from '../TrackDetailsModal';
import { ContextMenu } from '../ContextMenu';
import { SettingsPanel } from '../SettingsPanel';
import GraphFilterPanel from '../GraphFilterPanel';
import { ArtistAttributionManager } from '../ArtistAttributionManager';
import { TracklistImporter } from '../TracklistImporter';
import { OnboardingOverlay } from '../OnboardingOverlay';
import { DJHeader } from './DJHeader';
import { PlayModePanel } from './panels/PlayModePanel';
import { PlanModePanel } from './panels/PlanModePanel';
import { useDJMode } from './hooks/useDJMode';
import { useTrackManagement } from './hooks/useTrackManagement';
import { useOnboarding } from './hooks/useOnboarding';
import useStore from '../../store/useStore';
import { useDataLoader } from '../../hooks/useDataLoader';
import type { Track } from '../../types';
import type { DJInterfaceProps, RightPanelTab, ContextMenuState } from './types';
import styles from './DJInterface.module.css';

/**
 * DJInterface - Main container component
 *
 * Implements dual-mode interface pattern:
 *
 * **PLAN Mode** (Preparation):
 * - Full library browser with fuzzy search
 * - Graph visualization for track relationships
 * - Track analysis panels
 * - Playlist managers (Tidal, Spotify)
 * - Pathfinder for track discovery
 * - Key/Mood visualization
 *
 * **PLAY Mode** (Performance):
 * - Simplified interface for live sets
 * - Now playing deck focus
 * - Intelligent browser with AI recommendations
 * - Cognitive offloading design
 * - Touch-optimized controls
 *
 * @param props - DJInterfaceProps
 * @returns React component
 */
export function DJInterface({ initialMode = 'play' }: DJInterfaceProps): React.ReactElement {
  // ============================================
  // STATE MANAGEMENT (Custom Hooks)
  // ============================================

  const { mode, setToPlan, setToPlay } = useDJMode(initialMode);
  const onboarding = useOnboarding();

  // Load graph data from store
  const graphData = useStore(state => state.graphData);
  const isLoading = useStore(state => state.isLoading);
  const error = useStore(state => state.error);
  const view = useStore(state => state.view);

  // Load data automatically
  useDataLoader();

  // Transform graph nodes to tracks
  const {
    tracks,
    selectedTrack,
    nowPlaying,
    playTrack,
  } = useTrackManagement(graphData?.nodes || []);

  // ============================================
  // LOCAL COMPONENT STATE
  // ============================================

  // Modal states
  const [inspectedTrack, setInspectedTrack] = useState<Track | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showGraphFilters, setShowGraphFilters] = useState(false);
  const [showArtistAttribution, setShowArtistAttribution] = useState(false);
  const [showTracklistImporter, setShowTracklistImporter] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    track: null,
    position: null,
    isOpen: false,
  });

  // PLAN mode specific state
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('analysis');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Handle track inspection (both modes)
   * Navigates to track in graph and updates now playing
   */
  const handleTrackInspect = useCallback((track: Track) => {
    const nodeId = track.id || `track-${track.artist}-${track.name}`;

    // Navigate to node in graph
    view.navigateToNode(nodeId, {
      highlight: true,
      openModal: false,
      selectNode: true
    });

    // Update now playing
    playTrack(track);
  }, [view, playTrack]);

  /**
   * Handle track right-click (context menu)
   */
  const handleTrackRightClick = useCallback((track: Track, position: { x: number; y: number }) => {
    setContextMenu({
      track,
      position,
      isOpen: true,
    });
  }, []);

  /**
   * Close context menu
   */
  const handleContextMenuClose = useCallback(() => {
    setContextMenu({
      track: null,
      position: null,
      isOpen: false,
    });
  }, []);

  /**
   * Close track details modal
   */
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setInspectedTrack(null);
  }, []);

  /**
   * Set track as currently playing from modal
   */
  const handleSetAsCurrentlyPlaying = useCallback((track: Track) => {
    playTrack(track);
    setIsModalOpen(false);
  }, [playTrack]);

  // ============================================
  // LIFECYCLE & SIDE EFFECTS
  // ============================================

  /**
   * Listen for openSettings event from child components
   */
  useEffect(() => {
    const handleOpenSettings = () => {
      setIsSettingsOpen(true);
    };

    window.addEventListener('openSettings', handleOpenSettings);
    return () => window.removeEventListener('openSettings', handleOpenSettings);
  }, []);

  /**
   * Listen for openTrackDetails event from context menu
   */
  useEffect(() => {
    const handleOpenTrackDetails = (event: CustomEvent) => {
      const { track, nodeId } = event.detail;
      if (track) {
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

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={styles.container} data-testid="dj-interface">
      {/* Header Bar */}
      <DJHeader
        mode={mode}
        onModeChange={(newMode) => newMode === 'plan' ? setToPlan() : setToPlay()}
        trackCount={tracks.length}
        connectionCount={graphData?.edges?.length || 0}
        onOpenArtistAttribution={() => setShowArtistAttribution(true)}
        onOpenTracklistImporter={() => setShowTracklistImporter(true)}
        onOpenGraphFilters={() => setShowGraphFilters(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenOnboarding={onboarding.show}
        onboardingDismissed={onboarding.isDismissed}
      />

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p className="title-lead" style={{ margin: 0, fontWeight: 600, color: 'var(--fg)' }}>
            Loading your music library...
          </p>
          <p className="body" style={{ fontSize: '0.875rem', margin: 'var(--space-2) 0 0 0', color: 'var(--fg-3)' }}>
            Found <strong className="data" style={{ color: 'var(--fg)' }}>{tracks.length}</strong> tracks so far
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>Failed to Load Music Library</h2>
          <p className={styles.errorMessage}>{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={styles.headerButton}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content (Mode-specific panels) */}
      {!isLoading && !error && (
        <main className={styles.main}>
          {mode === 'play' ? (
            <PlayModePanel
              tracks={tracks}
              selectedTrack={selectedTrack}
              nowPlaying={nowPlaying}
              onTrackSelect={handleTrackInspect}
              onTrackRightClick={handleTrackRightClick}
              graphEdges={graphData?.edges || []}
            />
          ) : (
            <PlanModePanel
              tracks={tracks}
              selectedTrack={selectedTrack}
              nowPlaying={nowPlaying}
              onTrackSelect={handleTrackInspect}
              onTrackRightClick={handleTrackRightClick}
              graphEdges={graphData?.edges || []}
              librarySearchQuery={librarySearchQuery}
              onSearchQueryChange={setLibrarySearchQuery}
              rightPanelTab={rightPanelTab}
              onRightPanelTabChange={setRightPanelTab}
            />
          )}
        </main>
      )}

      {/* ============================================
          GLOBAL MODALS & OVERLAYS
          ============================================ */}

      {/* Track Details Modal */}
      <TrackDetailsModal
        track={inspectedTrack as any}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSetAsCurrentlyPlaying={handleSetAsCurrentlyPlaying as any}
        currentlyPlayingTrack={nowPlaying as any}
      />

      {/* Track Context Menu (Pathfinder) */}
      {contextMenu.isOpen && contextMenu.track && contextMenu.position && (
        <ContextMenu
          x={contextMenu.position.x}
          y={contextMenu.position.y}
          targetType="node"
          targetData={{
            id: contextMenu.track.id,
            label: contextMenu.track.name,
            type: 'track',
            track: contextMenu.track,
            artist: contextMenu.track.artist,
            genre: contextMenu.track.genre,
            bpm: contextMenu.track.bpm,
            key: contextMenu.track.key,
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

      {/* Onboarding Overlay */}
      <OnboardingOverlay
        open={onboarding.isShown}
        onClose={onboarding.hide}
        onDisable={onboarding.dismiss}
      />
    </div>
  );
}

export default DJInterface;
