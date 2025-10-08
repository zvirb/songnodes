import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NowPlayingDeck } from './NowPlayingDeck';
import { IntelligentBrowser } from './IntelligentBrowser';
import GraphVisualization from './GraphVisualization';
import MobileTrackExplorer from './MobileTrackExplorer';
import { TrackDetailsModal } from './TrackDetailsModal';
import { ContextMenu } from './ContextMenu';
import { SettingsPanel } from './SettingsPanel';
import { PathfinderPanel } from './PathfinderPanel';
import { KeyMoodPanel } from './KeyMoodPanel';
import GraphFilterPanel from './GraphFilterPanel';
import { Track, GraphNode } from '../types';
import { DJMode } from '../types/dj';
import useStore from '../store/useStore';
import { useDataLoader } from '../hooks/useDataLoader';
import { useIsMobile } from '../hooks/useIsMobile';
import { transformNodeToTrack, isValidTrackNode } from '../utils/djInterfaceUtils';
import { Loader2 } from 'lucide-react';

/**
 * A memoized component to render a single track item in the library list.
 * Prevents re-rendering of individual tracks when the list changes.
 */
const TrackListItem = React.memo<{
  track: Track;
  isNowPlaying: boolean;
  onInspect: (track: Track) => void;
  onRightClick?: (track: Track, position: { x: number; y: number }) => void;
}>(({ track, isNowPlaying, onInspect, onRightClick }) => {
  const handleClick = useCallback(() => onInspect(track), [track, onInspect]);
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRightClick?.(track, { x: e.clientX, y: e.clientY });
  }, [track, onRightClick]);

  return (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`w-full p-2.5 text-left rounded-lg border border-white/10 transition-all duration-200 user-select-none flex flex-col justify-center min-h-[52px] overflow-hidden ${isNowPlaying ? 'bg-green-500/20' : 'bg-transparent hover:bg-white/5'}`}
    >
      <div className="text-sm font-semibold truncate text-white">{track.name}</div>
      <div className="text-xs text-gray-400 truncate">
        {track.artist}
        {track.bpm && ` • ${Math.round(track.bpm)} BPM`}
        {track.key && ` • ${track.key}`}
      </div>
    </button>
  );
});

interface DJInterfaceProps {
  initialMode?: DJMode;
}

/**
 * The main user interface for the DJ application.
 * It orchestrates all other components and manages the application's primary state,
 * including the current mode ('plan' or 'play'), the currently playing track,
 * and the visibility of various panels and modals.
 *
 * @param {DJInterfaceProps} props The component props, allowing for an initial mode to be set.
 * @returns {React.ReactElement} The rendered DJ interface.
 */
export const DJInterface: React.FC<DJInterfaceProps> = ({ initialMode = 'play' }) => {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<DJMode>(initialMode);
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);

  // State for modals and panels
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showGraphFilters, setShowGraphFilters] = useState(false);
  const [contextMenuTrack, setContextMenuTrack] = useState<Track | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'analysis' | 'keymood' | 'pathfinder'>('analysis');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');

  // Zustand store selectors
  const { graphData, isLoading, error, view } = useStore(state => ({
    graphData: state.graphData,
    isLoading: state.isLoading,
    error: state.error,
    view: state.view,
  }));

  // Custom hook for loading initial data
  useDataLoader();

  // Memoized list of valid and unique track nodes from the graph data
  const validNodes = useMemo(() => {
    if (!graphData?.nodes) return [];
    const uniqueNodesMap = new Map<string, GraphNode>();
    graphData.nodes.forEach(node => {
      if (isValidTrackNode(node) && !uniqueNodesMap.has(node.id)) {
        uniqueNodesMap.set(node.id, node);
      }
    });
    return Array.from(uniqueNodesMap.values());
  }, [graphData?.nodes]);

  // Memoized and sorted list of tracks transformed from the valid nodes
  const tracks = useMemo(() => {
    if (validNodes.length === 0) return [];
    return validNodes.map(transformNodeToTrack).sort((a, b) =>
      a.artist.localeCompare(b.artist) || a.name.localeCompare(b.name)
    );
  }, [validNodes]);

  // Memoized list of filtered library tracks for the PLAN mode search
  const filteredLibraryTracks = useMemo(() => {
    if (!librarySearchQuery.trim()) return tracks;
    const query = librarySearchQuery.toLowerCase();
    return tracks.filter(track =>
      track.name.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query)
    );
  }, [tracks, librarySearchQuery]);

  /**
   * Handles inspecting a track. This can be triggered from various child components.
   * It sets the track as "now playing" and navigates the graph to focus on the corresponding node.
   */
  const handleTrackInspect = useCallback((track: Track) => {
    view.navigateToNode(track.id, { highlight: true, selectNode: true });
    setNowPlaying(track);
  }, [view]);

  const handleContextMenu = useCallback((track: Track, position: { x: number; y: number }) => {
    setContextMenuTrack(track);
    setContextMenuPosition(position);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuTrack(null);
    setContextMenuPosition(null);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-950 text-gray-400">
        <Loader2 className="w-12 h-12 animate-spin text-green-500 mb-4" />
        <p className="text-lg">Loading your music library...</p>
        <p className="text-sm opacity-70">Found {tracks.length} tracks so far</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-950 text-red-400 text-center p-10">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-red-300 mb-2">Failed to Load Music Library</h2>
        <p className="text-gray-400 mb-6 max-w-md">{error}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white font-sans">
      <header className="flex justify-between items-center px-6 py-4 bg-black/80 border-b border-white/10 backdrop-blur-lg">
        <div className="flex items-center gap-5">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-green-400 text-transparent bg-clip-text">
            🎵 SongNodes DJ
          </h1>
          <div className="flex gap-2 bg-black/30 p-1 rounded-full border border-white/10">
            <button onClick={() => setMode('play')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-all ${mode === 'play' ? 'bg-green-500 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
              ▶️ PLAY
            </button>
            <button onClick={() => setMode('plan')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-all ${mode === 'plan' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
              📋 PLAN
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded-full">{tracks.length} Tracks</span>
          <span className="px-3 py-1.5 bg-green-500/20 text-green-300 text-xs font-semibold rounded-full">{graphData?.edges?.length || 0} Connections</span>
          <button onClick={() => setShowGraphFilters(true)} className="px-3 py-2 bg-white/10 text-sm rounded-lg hover:bg-white/20 transition-colors">🔧 Filters</button>
          <button onClick={() => setIsSettingsOpen(true)} className="px-3 py-2 bg-white/10 text-sm rounded-lg hover:bg-white/20 transition-colors">⚙️ Settings</button>
        </div>
      </header>

      <main className="flex-1 grid gap-4 p-4 overflow-hidden" style={{ gridTemplateRows: mode === 'play' ? 'auto 1fr' : '1fr' }}>
        {mode === 'play' ? (
          <>
            <section className="min-h-[150px] max-h-[220px]">
              <NowPlayingDeck track={nowPlaying} onTrackSelect={handleTrackInspect} />
            </section>
            <section className="grid grid-cols-[1fr_480px] gap-4 overflow-hidden min-h-0">
              <div className="bg-black/60 rounded-xl border border-white/10 overflow-hidden relative h-full w-full min-h-0">
                {isMobile ? <MobileTrackExplorer /> : <GraphVisualization onTrackSelect={handleTrackInspect} onTrackRightClick={handleContextMenu} />}
              </div>
              <div className="overflow-auto max-h-full">
                <IntelligentBrowser currentTrack={nowPlaying} allTracks={tracks} onTrackSelect={handleTrackInspect} graphEdges={graphData?.edges || []} />
              </div>
            </section>
          </>
        ) : (
          <section className="grid grid-cols-[250px_1fr_350px] gap-5 h-full overflow-hidden">
            <div className="bg-black/60 rounded-xl border border-white/10 p-5 flex flex-col overflow-hidden">
              <h3 className="text-lg font-semibold mb-3">Library</h3>
              <input type="text" placeholder="🔍 Search..." value={librarySearchQuery} onChange={e => setLibrarySearchQuery(e.target.value)} className="w-full px-3 py-2.5 bg-black/40 border border-white/20 rounded-lg text-sm mb-3 focus:border-blue-500 outline-none transition-colors" />
              <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                {filteredLibraryTracks.map(track => <TrackListItem key={track.id} track={track} isNowPlaying={nowPlaying?.id === track.id} onInspect={handleTrackInspect} onRightClick={handleContextMenu} />)}
              </div>
            </div>
            <div className="bg-black/60 rounded-xl border border-white/10 overflow-hidden h-full w-full min-h-0">
              <GraphVisualization onTrackSelect={handleTrackInspect} onTrackRightClick={handleContextMenu} />
            </div>
            <div className="bg-black/60 rounded-xl border border-white/10 overflow-hidden flex flex-col">
              <div className="flex border-b border-white/10">
                <button onClick={() => setRightPanelTab('analysis')} className={`flex-1 p-3 text-sm font-semibold transition-colors ${rightPanelTab === 'analysis' ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:bg-white/5'}`}>Analysis</button>
                <button onClick={() => setRightPanelTab('keymood')} className={`flex-1 p-3 text-sm font-semibold transition-colors ${rightPanelTab === 'keymood' ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:bg-white/5'}`}>Key & Mood</button>
                <button onClick={() => setRightPanelTab('pathfinder')} className={`flex-1 p-3 text-sm font-semibold transition-colors ${rightPanelTab === 'pathfinder' ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:bg-white/5'}`}>Pathfinder</button>
              </div>
              <div className="flex-1 p-5 overflow-y-auto">
                {rightPanelTab === 'analysis' && (nowPlaying ? <div>Analysis for {nowPlaying.name}</div> : <div className="text-gray-400">Select a track to analyze.</div>)}
                {rightPanelTab === 'keymood' && <KeyMoodPanel showInSidePanel={true} className="h-full" />}
                {rightPanelTab === 'pathfinder' && <PathfinderPanel />}
              </div>
            </div>
          </section>
        )}
      </main>

      <TrackDetailsModal track={isModalOpen ? (inspectedTrack || nowPlaying) : null} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSetAsCurrentlyPlaying={handleTrackInspect} currentlyPlayingTrack={nowPlaying} />
      {contextMenuTrack && contextMenuPosition && (
        <ContextMenu x={contextMenuPosition.x} y={contextMenuPosition.y} targetType="node" targetData={{ ...contextMenuTrack, id: contextMenuTrack.id, label: contextMenuTrack.name, type: 'track' }} onClose={handleCloseContextMenu} />
      )}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <GraphFilterPanel isOpen={showGraphFilters} onClose={() => setShowGraphFilters(false)} />
    </div>
  );
};

export default DJInterface;