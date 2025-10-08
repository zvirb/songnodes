import React, { useState, useMemo, useCallback } from 'react';
import { Track } from '../types';
import useStore from '../store/useStore';
import { transformNodesToTracks, getConnectedTracks, ConnectedTrack } from '../utils/mobileExplorerUtils';
import { Search, ArrowLeft, XCircle } from 'lucide-react';

interface NavigationHistoryItem {
  trackId: string;
  trackName: string;
}

/**
 * A mobile-optimized interface for exploring track connections.
 * It uses a card-based navigation system instead of the WebGL graph
 * to ensure performance on lower-powered devices.
 */
export const MobileTrackExplorer: React.FC = () => {
  const { graphData } = useStore();

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const allTracks = useMemo(() => transformNodesToTracks(graphData?.nodes || []), [graphData?.nodes]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allTracks.filter(track =>
      track.name.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query)
    ).slice(0, 20);
  }, [searchQuery, allTracks]);

  const currentTrack = useMemo(() => allTracks.find(t => t.id === currentTrackId) || null, [currentTrackId, allTracks]);

  const connectedTracks = useMemo(() => {
    if (!currentTrackId) return [];
    return getConnectedTracks(currentTrackId, graphData?.edges || [], allTracks);
  }, [currentTrackId, graphData?.edges, allTracks]);

  const navigateToTrack = useCallback((trackId: string, trackName: string) => {
    if (currentTrackId && currentTrack) {
      setNavigationHistory(prev => [...prev, { trackId: currentTrackId, trackName: currentTrack.name }]);
    }
    setCurrentTrackId(trackId);
    setSearchQuery('');
  }, [currentTrackId, currentTrack]);

  const navigateBack = useCallback(() => {
    if (navigationHistory.length > 0) {
      const previous = navigationHistory[navigationHistory.length - 1];
      setCurrentTrackId(previous.trackId);
      setNavigationHistory(prev => prev.slice(0, -1));
    } else {
      setCurrentTrackId(null);
    }
  }, [navigationHistory]);

  // Search View
  if (!currentTrackId) {
    return (
      <div className="flex flex-col h-full p-4 bg-gray-900 text-white overflow-hidden">
        <header className="mb-4">
          <h2 className="text-2xl font-bold">Explore Tracks</h2>
          <p className="text-sm text-gray-400">Search for a track to start</p>
        </header>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search by track or artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {searchResults.map(track => (
            <button
              key={track.id}
              onClick={() => navigateToTrack(track.id, track.name)}
              className="w-full p-3 bg-gray-800 rounded-lg text-left hover:bg-gray-700 active:bg-gray-600 transition-colors"
            >
              <div className="font-semibold">{track.name}</div>
              <div className="text-sm text-gray-400">{track.artist}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Track Detail View
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      <header className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <button onClick={navigateBack} className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
          <ArrowLeft size={20} />
          Back
        </button>
        <button onClick={() => setCurrentTrackId(null)} className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
          <Search size={16} />
          Search
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {currentTrack && (
          <div className="p-5 bg-gray-800 border-2 border-green-500/50 rounded-xl">
            <p className="text-xs text-gray-400 uppercase mb-2">Now Viewing</p>
            <h1 className="text-2xl font-bold mb-1">{currentTrack.name}</h1>
            <p className="text-lg text-gray-400 mb-4">{currentTrack.artist}</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-400">BPM</p>
                <p className="text-xl font-semibold">{currentTrack.bpm}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Key</p>
                <p className="text-xl font-semibold">{currentTrack.key}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Energy</p>
                <p className="text-xl font-semibold">{currentTrack.energy}/10</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-bold mb-3">Connected Tracks ({connectedTracks.length})</h3>
          <div className="space-y-3">
            {connectedTracks.length > 0 ? (
              connectedTracks.map(({ track, connectionStrength }) => (
                <button
                  key={track.id}
                  onClick={() => navigateToTrack(track.id, track.name)}
                  className="w-full p-4 bg-gray-800 rounded-lg text-left relative hover:bg-gray-700 active:bg-gray-600 transition-colors"
                >
                  <div className="absolute top-3 right-3 px-2 py-0.5 text-xs font-bold text-black bg-green-400 rounded-full" style={{ opacity: Math.min(connectionStrength, 1) }}>
                    {Math.round(connectionStrength * 100)}%
                  </div>
                  <div className="font-semibold pr-16">{track.name}</div>
                  <div className="text-sm text-gray-400 mb-2">{track.artist}</div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>{track.bpm} BPM</span>
                    <span>•</span>
                    <span>{track.key}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center bg-gray-800 rounded-lg text-gray-500">
                <p>No connected tracks found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileTrackExplorer;