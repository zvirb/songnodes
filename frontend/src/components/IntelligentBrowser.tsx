import React, { useState, useMemo } from 'react';
import { HarmonicCompatibility } from './HarmonicCompatibility';
import { EnergyMeter } from './EnergyMeter';
import { Track, TrackRecommendation, IntelligentBrowserConfig, CamelotKey, GraphEdge } from '../types';
import { calculateRecommendations } from '../utils/intelligentBrowserUtils';

const DEFAULT_CONFIG: IntelligentBrowserConfig = {
  maxRecommendations: 15,
  sortBy: 'score',
  groupBy: 'compatibility',
  showReasons: true,
  autoUpdate: true,
  updateInterval: 5000,
};

interface RecommendationCardProps {
  recommendation: TrackRecommendation;
  currentTrack: Track;
  onSelect: () => void;
  showReasons: boolean;
}

/**
 * A card component that displays a single track recommendation, including its compatibility score and reasons.
 */
const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation, currentTrack, onSelect, showReasons }) => {
  const { track, score, reasons, compatibility } = recommendation;

  const scoreColorClass = useMemo(() => {
    if (score >= 80) return 'border-green-400/50 bg-green-400/10 text-green-300';
    if (score >= 60) return 'border-yellow-400/50 bg-yellow-400/10 text-yellow-300';
    if (score >= 40) return 'border-orange-400/50 bg-orange-400/10 text-orange-300';
    return 'border-gray-600 bg-gray-600/10 text-gray-400';
  }, [score]);

  return (
    <div
      onClick={onSelect}
      className={`flex flex-col gap-3 p-4 bg-gray-800/50 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:bg-gray-800/80 ${scoreColorClass}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-semibold text-white">{track.name}</h4>
          <p className="text-sm text-gray-400">{track.artist}</p>
        </div>
        <div className={`flex items-center justify-center w-12 h-12 rounded-full text-lg font-bold ${scoreColorClass}`}>
          {Math.round(score)}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <HarmonicCompatibility currentKey={currentTrack.key as CamelotKey} targetKey={track.key as CamelotKey} size="small" />
          <div className="text-xs text-gray-400 mt-1">{track.key}</div>
        </div>
        <div>
          <EnergyMeter level={track.energy || 5} size="small" />
          <div className="text-xs text-gray-400 mt-1">Energy</div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <div className={`text-xl font-bold ${compatibility.bpm === 'perfect' ? 'text-green-400' : 'text-yellow-400'}`}>{track.bpm}</div>
          <div className="text-xs text-gray-400">BPM</div>
        </div>
        <div className="flex items-center justify-center">
          <span className="px-2 py-1 text-xs font-semibold bg-blue-500/20 text-blue-300 rounded-full">{track.genre}</span>
        </div>
      </div>

      {showReasons && reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10">
          {reasons.slice(0, 3).map((reason, i) => (
            <span key={i} className="px-2 py-0.5 bg-white/5 text-gray-400 text-[11px] rounded-full">{reason.description}</span>
          ))}
        </div>
      )}
    </div>
  );
};

interface IntelligentBrowserProps {
  /** The currently playing track, which serves as the basis for recommendations. */
  currentTrack: Track | null;
  /** The full list of available tracks to recommend from. */
  allTracks: Track[];
  /** Callback function invoked when a recommended track is selected. */
  onTrackSelect: (track: Track) => void;
  /** Optional configuration to override the default browser behavior. */
  config?: Partial<IntelligentBrowserConfig>;
  /** The graph edges, used to determine real-world playlist connections. */
  graphEdges?: GraphEdge[];
}

/**
 * The IntelligentBrowser is a "co-pilot" interface that provides smart track recommendations.
 * It uses a scoring algorithm based on graph connections, harmonic compatibility, energy, and BPM.
 */
export const IntelligentBrowser: React.FC<IntelligentBrowserProps> = ({
  currentTrack,
  allTracks,
  onTrackSelect,
  config = {},
  graphEdges = [],
}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [sortBy, setSortBy] = useState(finalConfig.sortBy);

  const recommendations = useMemo(() => {
    const recs = calculateRecommendations(currentTrack, allTracks, graphEdges);

    switch (sortBy) {
      case 'energy':
        return recs.sort((a, b) => Math.abs((a.track.energy ?? 0) - (currentTrack?.energy ?? 0)) - Math.abs((b.track.energy ?? 0) - (currentTrack?.energy ?? 0)));
      case 'bpm':
        return recs.sort((a, b) => Math.abs((a.track.bpm ?? 0) - (currentTrack?.bpm ?? 0)) - Math.abs((b.track.bpm ?? 0) - (currentTrack?.bpm ?? 0)));
      case 'score':
      default:
        return recs;
    }
  }, [currentTrack, allTracks, graphEdges, sortBy]);

  if (!currentTrack) {
    return (
      <div className="p-6 bg-gray-900 rounded-xl text-center">
        <p className="text-gray-400">Load a track to see intelligent recommendations.</p>
      </div>
    );
  }

  const limitedRecommendations = recommendations.slice(0, finalConfig.maxRecommendations);

  return (
    <div className="flex flex-col gap-5 p-6 bg-gray-900/90 rounded-xl border-2 border-white/10 max-h-full overflow-y-auto">
      <header className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-white">Track Browser</h3>
          <p className="text-xs text-gray-400">{limitedRecommendations.length} recommendations</p>
        </div>
        <span className="px-3 py-1 text-sm font-semibold bg-green-500/20 text-green-300 rounded-full">Co-Pilot Active</span>
      </header>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSortBy('score')} className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${sortBy === 'score' ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}>Best Match</button>
        <button onClick={() => setSortBy('energy')} className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${sortBy === 'energy' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}>Energy Flow</button>
        <button onClick={() => setSortBy('bpm')} className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${sortBy === 'bpm' ? 'bg-yellow-500 border-yellow-500 text-black' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}>Tempo Match</button>
      </div>

      <div className="flex flex-col gap-3">
        {limitedRecommendations.length > 0 ? (
          limitedRecommendations.map(rec => (
            <RecommendationCard
              key={rec.track.id}
              recommendation={rec}
              currentTrack={currentTrack}
              onSelect={() => onTrackSelect(rec.track)}
              showReasons={finalConfig.showReasons}
            />
          ))
        ) : (
          <div className="py-10 text-center">
            <p className="text-yellow-400">No compatible tracks found.</p>
            <p className="text-sm text-gray-400 mt-2">Try adjusting filters or adding more tracks.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelligentBrowser;