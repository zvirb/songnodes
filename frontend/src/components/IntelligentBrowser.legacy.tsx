import React, { useState, useMemo } from 'react';
import { HarmonicCompatibility } from './HarmonicCompatibility';
import { EnergyMeter } from './EnergyMeter';
import {
  Track,
  TrackRecommendation,
  IntelligentBrowserConfig,
  CamelotKey
} from '../types/dj';

/**
 * IntelligentBrowser (Legacy export)
 * Design System compliant fallback component.
 */

interface IntelligentBrowserProps {
  currentTrack: Track | null;
  allTracks: Track[];
  onTrackSelect: (track: Track) => void;
  config?: Partial<IntelligentBrowserConfig>;
  graphEdges?: Array<{ source: string; target: string; weight: number; type: string }>;
}

const DEFAULT_CONFIG: IntelligentBrowserConfig = {
  maxRecommendations: 15,
  sortBy: 'score',
  groupBy: 'compatibility',
  showReasons: true,
  autoUpdate: true,
  updateInterval: 5000
};

const calculateRecommendations = (
  currentTrack: Track | null,
  allTracks: Track[],
  graphEdges?: Array<{ source: string; target: string; weight: number; type: string }>
): TrackRecommendation[] => {
  if (!currentTrack) return [];

  const adjacencyMap = new Map<string, { weight: number; type: string }>();
  if (graphEdges && graphEdges.length > 0) {
    graphEdges.forEach(edge => {
      if (edge.source === currentTrack.id) {
        adjacencyMap.set(edge.target, { weight: edge.weight, type: edge.type });
      } else if (edge.target === currentTrack.id) {
        adjacencyMap.set(edge.source, { weight: edge.weight, type: edge.type });
      }
    });
  }

  return (allTracks || [])
    .filter(track => track.id !== currentTrack.id)
    .map(track => {
      const recommendation: TrackRecommendation = {
        track,
        score: 0,
        reasons: [],
        compatibility: {
          harmonic: 'clash',
          energy: 'risky',
          bpm: 'needs_adjustment'
        }
      };

      const adjacency = adjacencyMap.get(track.id);
      if (adjacency) {
        const adjacencyScore = 60 + (adjacency.weight * 20);
        recommendation.score += adjacencyScore;
        recommendation.reasons.push({
          type: 'history',
          description: `Mixed together in real DJ sets (${adjacency.type})`,
          weight: adjacencyScore
        });
      }

      const keyCompat = getKeyCompatibility(currentTrack.key as any, track.key as any);
      if (keyCompat === 'perfect') {
        recommendation.score += 25;
        recommendation.reasons.push({
          type: 'harmonic',
          description: 'Perfect harmonic match',
          weight: 25
        });
        recommendation.compatibility.harmonic = 'perfect';
      } else if (keyCompat === 'compatible') {
        recommendation.score += 15;
        recommendation.reasons.push({
          type: 'harmonic',
          description: 'Harmonically compatible',
          weight: 15
        });
        recommendation.compatibility.harmonic = 'compatible';
      }

      if (track.energy !== undefined && currentTrack.energy !== undefined) {
        const energyDiff = Math.abs(track.energy - currentTrack.energy);
        if (energyDiff <= 1) {
          recommendation.score += 15;
          recommendation.reasons.push({
            type: 'energy',
            description: energyDiff === 0 ? 'Same energy level' : 'Smooth energy transition',
            weight: 15
          });
          recommendation.compatibility.energy = 'perfect';
        } else if (energyDiff <= 2) {
          recommendation.score += 10;
          recommendation.reasons.push({
            type: 'energy',
            description: 'Manageable energy change',
            weight: 10
          });
          recommendation.compatibility.energy = 'good';
        }
      }

      if (track.bpm !== undefined && currentTrack.bpm !== undefined && currentTrack.bpm > 0) {
        const bpmDiff = Math.abs(track.bpm - currentTrack.bpm);
        const bpmPercent = (bpmDiff / currentTrack.bpm) * 100;
        if (bpmPercent <= 2) {
          recommendation.score += 15;
          recommendation.reasons.push({
            type: 'bpm',
            description: 'Perfect tempo match',
            weight: 15
          });
          recommendation.compatibility.bpm = 'perfect';
        } else if (bpmPercent <= 6) {
          recommendation.score += 10;
          recommendation.reasons.push({
            type: 'bpm',
            description: 'Close tempo (pitch adjust)',
            weight: 10
          });
          recommendation.compatibility.bpm = 'close';
        }
      }

      return recommendation;
    })
    .sort((a, b) => b.score - a.score);
};

const getKeyCompatibility = (key1: CamelotKey, key2: CamelotKey): 'perfect' | 'compatible' | 'clash' => {
  if (!key1 || !key2) return 'clash';
  if (key1 === key2) return 'perfect';

  const num1 = parseInt(key1.slice(0, -1));
  const letter1 = key1.slice(-1);
  const num2 = parseInt(key2.slice(0, -1));
  const letter2 = key2.slice(-1);

  if (num1 === num2) return 'perfect';

  const diff = Math.abs(num1 - num2);
  const wrappedDiff = Math.min(diff, 12 - diff);
  if (wrappedDiff === 1 && letter1 === letter2) return 'compatible';

  return 'clash';
};

const RecommendationCard: React.FC<{
  recommendation: TrackRecommendation;
  currentTrack: Track;
  onSelect: () => void;
  showReasons: boolean;
}> = ({ recommendation, currentTrack, onSelect, showReasons }) => {
  const { track, score, reasons, compatibility } = recommendation;

  return (
    <div
      className="recommendation-card"
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-3)',
        backgroundColor: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-control)',
        cursor: 'pointer',
        transition: 'background var(--duration-fast) var(--ease-standard)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ color: 'var(--fg)', fontSize: '0.9375rem', margin: 0, fontWeight: 600 }}>
            {track.name}
          </h4>
          <p style={{ color: 'var(--fg-2)', fontSize: '0.8125rem', margin: '2px 0 0 0' }}>
            {track.artist}
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--line)',
          color: 'var(--brand)',
          fontSize: '0.875rem',
          fontWeight: 700
        }}>
          {score}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
        <div style={{ textAlign: 'center' }}>
          <HarmonicCompatibility
            currentKey={currentTrack.key as any}
            targetKey={track.key as any}
            size="small"
          />
          <div style={{ color: 'var(--fg-3)', fontSize: '0.6875rem', marginTop: '2px' }}>
            {track.key}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <EnergyMeter level={track.energy || 5} size="small" />
          <div style={{ color: 'var(--fg-3)', fontSize: '0.6875rem', marginTop: '2px' }}>
            Energy
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            color: compatibility.bpm === 'perfect' ? 'var(--status-ok)' :
                   compatibility.bpm === 'close' ? 'var(--status-warn)' : 'var(--fg-3)',
            fontSize: '1rem',
            fontWeight: 600,
            fontFamily: 'var(--font-data)'
          }}>
            {track.bpm}
          </div>
          <div style={{ color: 'var(--fg-3)', fontSize: '0.6875rem' }}>
            BPM
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            padding: '2px 8px',
            backgroundColor: 'var(--surface-2)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--fg-2)',
            fontSize: '0.6875rem',
            fontWeight: 600
          }}>
            {track.genre || 'House'}
          </div>
        </div>
      </div>

      {showReasons && reasons.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-1)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--line)'
        }}>
          {reasons.slice(0, 3).map((reason, i) => (
            <span
              key={i}
              style={{
                padding: '2px 6px',
                backgroundColor: 'var(--surface-2)',
                borderRadius: 'var(--radius-chip)',
                color: 'var(--fg-3)',
                fontSize: '0.6875rem'
              }}
            >
              {reason.description}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const IntelligentBrowser: React.FC<IntelligentBrowserProps> = ({
  currentTrack,
  allTracks,
  onTrackSelect,
  config = {},
  graphEdges = []
}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [sortBy, setSortBy] = useState(finalConfig.sortBy);

  const allRecommendations = useMemo(() => {
    return calculateRecommendations(currentTrack, allTracks, graphEdges);
  }, [currentTrack, allTracks, graphEdges]);

  const recommendations = useMemo(() => {
    let filtered = [...allRecommendations];

    switch (sortBy) {
      case 'energy':
        filtered = filtered.sort((a, b) => {
          const aDiff = Math.abs((a.track.energy ?? 0) - (currentTrack?.energy ?? 0));
          const bDiff = Math.abs((b.track.energy ?? 0) - (currentTrack?.energy ?? 0));
          return aDiff - bDiff;
        });
        break;

      case 'bpm':
        filtered = filtered.sort((a, b) => {
          const aDiff = Math.abs((a.track.bpm ?? 0) - (currentTrack?.bpm ?? 0));
          const bDiff = Math.abs((b.track.bpm ?? 0) - (currentTrack?.bpm ?? 0));
          return aDiff - bDiff;
        });
        break;

      case 'score':
      default:
        break;
    }

    return filtered.slice(0, finalConfig.maxRecommendations);
  }, [allRecommendations, sortBy, currentTrack, finalConfig.maxRecommendations]);

  if (!currentTrack) {
    return (
      <div style={{
        padding: 'var(--space-6)',
        backgroundColor: 'var(--surface-1)',
        borderRadius: 'var(--radius-control)',
        border: '1px solid var(--line)',
        textAlign: 'center'
      }}>
        <p style={{ color: 'var(--fg-2)', fontSize: '0.9375rem', margin: 0 }}>
          Load a track to see intelligent recommendations
        </p>
      </div>
    );
  }

  return (
    <div className="intelligent-browser" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      padding: 'var(--space-4)',
      backgroundColor: 'var(--bg)',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--line)',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ color: 'var(--fg)', fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>
              {currentTrack.name}
            </h3>
            <p style={{ color: 'var(--fg-2)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
              {currentTrack.artist}
            </p>
          </div>
          <span className="sn-tag">Co-Pilot Active</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setSortBy('score')}
          className={`sn-btn ${sortBy === 'score' ? 'sn-btn--primary' : 'sn-btn--quiet'}`}
        >
          Best Match
        </button>
        <button
          type="button"
          onClick={() => setSortBy('energy')}
          className={`sn-btn ${sortBy === 'energy' ? 'sn-btn--primary' : 'sn-btn--quiet'}`}
        >
          Energy Flow
        </button>
        <button
          type="button"
          onClick={() => setSortBy('bpm')}
          className={`sn-btn ${sortBy === 'bpm' ? 'sn-btn--primary' : 'sn-btn--quiet'}`}
        >
          Tempo Match
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {recommendations.map(rec => (
          <RecommendationCard
            key={rec.track.id}
            recommendation={rec}
            currentTrack={currentTrack}
            onSelect={() => onTrackSelect(rec.track)}
            showReasons={finalConfig.showReasons}
          />
        ))}
      </div>
    </div>
  );
};

export default IntelligentBrowser;
