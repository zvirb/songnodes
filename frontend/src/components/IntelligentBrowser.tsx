import React, { useState, useMemo } from 'react';
import { HarmonicCompatibility } from './HarmonicCompatibility';
import { EnergyMeter } from './EnergyMeter';
import {
  Track,
  TrackRecommendation,
  DJFilterCriteria,
  IntelligentBrowserConfig,
  CamelotKey
} from '../types/dj';

/**
 * IntelligentBrowser - The Co-Pilot Interface
 * Implements Hick's Law by limiting choices to 10-20 tracks
 * Provides transparent reasoning for recommendations
 */

interface IntelligentBrowserProps {
  currentTrack: Track | null;
  allTracks: Track[];
  onTrackSelect: (track: Track) => void;
  config?: Partial<IntelligentBrowserConfig>;
  graphEdges?: Array<{ source: string; target: string; weight: number; type: string }>; // ✅ Add graph edges
}

// Default configuration following Hick's Law
const DEFAULT_CONFIG: IntelligentBrowserConfig = {
  maxRecommendations: 15, // Sweet spot between choice and paralysis
  sortBy: 'score',
  groupBy: 'compatibility',
  showReasons: true,
  autoUpdate: true,
  updateInterval: 5000
};

// ✅ Intelligent recommendation engine - PRIORITIZE GRAPH ADJACENCIES
const calculateRecommendations = (
  currentTrack: Track | null,
  allTracks: Track[],
  graphEdges?: Array<{ source: string; target: string; weight: number; type: string }>
): TrackRecommendation[] => {
  if (!currentTrack) return [];

  // ✅ Build adjacency map from graph edges
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

      // ✅ PRIORITY #1: Graph Adjacency (HIGHEST WEIGHT)
      const adjacency = adjacencyMap.get(track.id);
      if (adjacency) {
        const adjacencyScore = 60 + (adjacency.weight * 20); // 60-80 points
        recommendation.score += adjacencyScore;
        recommendation.reasons.push({
          type: 'history',
          description: `Mixed together in real DJ sets (${adjacency.type})`,
          weight: adjacencyScore
        });
      }

      // Harmonic compatibility scoring
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

      // Energy flow scoring (with safety checks)
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

      // BPM compatibility scoring (with safety checks)
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

// Helper function for key compatibility
const getKeyCompatibility = (key1: CamelotKey, key2: CamelotKey): 'perfect' | 'compatible' | 'clash' => {
  // Guard against undefined/null keys
  if (!key1 || !key2) return 'clash';
  if (key1 === key2) return 'perfect';

  const num1 = parseInt(key1.slice(0, -1));
  const letter1 = key1.slice(-1);
  const num2 = parseInt(key2.slice(0, -1));
  const letter2 = key2.slice(-1);

  // Same number, different letter (major/minor)
  if (num1 === num2) return 'perfect';

  // Adjacent on wheel
  const diff = Math.abs(num1 - num2);
  const wrappedDiff = Math.min(diff, 12 - diff);
  if (wrappedDiff === 1 && letter1 === letter2) return 'compatible';

  return 'clash';
};

// Track recommendation card component
const RecommendationCard: React.FC<{
  recommendation: TrackRecommendation;
  currentTrack: Track;
  onSelect: () => void;
  showReasons: boolean;
}> = ({ recommendation, currentTrack, onSelect, showReasons }) => {
  const { track, score, reasons, compatibility } = recommendation;

  // Visual indicator for overall recommendation quality
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#7ED321'; // Excellent
    if (score >= 60) return '#F5A623'; // Good
    if (score >= 40) return '#FFA500'; // Okay
    return '#8E8E93'; // Poor
  };

  return (
    <div
      className="recommendation-card"
      onClick={() => {
        onSelect();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        onSelect();
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        border: `2px solid ${getScoreColor(score)}40`,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      {/* Track Info Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div style={{ flex: 1 }}>
          <h4 style={{
            color: '#FFFFFF',
            fontSize: '16px',
            margin: 0,
            fontWeight: 600
          }}>
            {track.name}
          </h4>
          <p style={{
            color: '#8E8E93',
            fontSize: '14px',
            margin: '4px 0 0 0'
          }}>
            {track.artist}
          </p>
        </div>

        {/* Score Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: `${getScoreColor(score)}20`,
          border: `2px solid ${getScoreColor(score)}`,
          color: getScoreColor(score),
          fontSize: '18px',
          fontWeight: 700
        }}>
          {score}
        </div>
      </div>

      {/* Compatibility Indicators */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px'
      }}>
        {/* Harmonic */}
        <div style={{ textAlign: 'center' }}>
          <HarmonicCompatibility
            currentKey={currentTrack.key as any}
            targetKey={track.key as any}
            size="small"
          />
          <div style={{
            color: '#8E8E93',
            fontSize: '10px',
            marginTop: '4px'
          }}>
            {track.key}
          </div>
        </div>

        {/* Energy */}
        <div style={{ textAlign: 'center' }}>
          <EnergyMeter level={track.energy || 5} size="small" />
          <div style={{
            color: '#8E8E93',
            fontSize: '10px',
            marginTop: '4px'
          }}>
            Energy
          </div>
        </div>

        {/* BPM */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            color: compatibility.bpm === 'perfect' ? '#7ED321' :
                   compatibility.bpm === 'close' ? '#F5A623' : '#8E8E93',
            fontSize: '20px',
            fontWeight: 600
          }}>
            {track.bpm}
          </div>
          <div style={{
            color: '#8E8E93',
            fontSize: '10px'
          }}>
            BPM
          </div>
        </div>

        {/* Genre/Tag */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            padding: '4px 8px',
            backgroundColor: 'rgba(74,144,226,0.2)',
            borderRadius: '12px',
            color: '#4A90E2',
            fontSize: '10px',
            fontWeight: 600
          }}>
            {track.genre || 'House'}
          </div>
        </div>
      </div>

      {/* Reasoning (Co-pilot transparency) */}
      {showReasons && reasons.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          {reasons.slice(0, 3).map((reason, i) => (
            <span
              key={i}
              style={{
                padding: '2px 8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                color: '#8E8E93',
                fontSize: '11px'
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
  graphEdges = [] // ✅ Accept graph edges
}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [sortBy, setSortBy] = useState(finalConfig.sortBy);

  // Calculate recommendations with graph edges
  const allRecommendations = useMemo(() => {
    return calculateRecommendations(currentTrack, allTracks, graphEdges);
  }, [currentTrack, allTracks, graphEdges]);

  // Filter and sort recommendations based on selected tab
  const recommendations = useMemo(() => {
    let filtered = [...allRecommendations];

    // Apply sorting based on selected tab
    switch (sortBy) {
      case 'score':
        // Already sorted by score in calculateRecommendations
        break;

      case 'energy':
        // Sort by energy similarity (closest energy to current track first)
        filtered = filtered.sort((a, b) => {
          const aDiff = Math.abs((a.track.energy ?? 0) - (currentTrack?.energy ?? 0));
          const bDiff = Math.abs((b.track.energy ?? 0) - (currentTrack?.energy ?? 0));
          return aDiff - bDiff;
        });
        break;

      case 'bpm':
        // Sort by BPM similarity (closest BPM to current track first)
        filtered = filtered.sort((a, b) => {
          const aDiff = Math.abs((a.track.bpm ?? 0) - (currentTrack?.bpm ?? 0));
          const bDiff = Math.abs((b.track.bpm ?? 0) - (currentTrack?.bpm ?? 0));
          return aDiff - bDiff;
        });
        break;
    }

    return filtered.slice(0, finalConfig.maxRecommendations);
  }, [allRecommendations, sortBy, currentTrack, finalConfig.maxRecommendations]);

  // Group recommendations by compatibility if requested
  const groupedRecommendations = useMemo(() => {
    if (finalConfig.groupBy === 'none') return { all: recommendations };

    const groups: Record<string, TrackRecommendation[]> = {
      excellent: [],
      good: [],
      acceptable: []
    };

    recommendations.forEach(rec => {
      if (rec.score >= 80) groups.excellent.push(rec);
      else if (rec.score >= 60) groups.good.push(rec);
      else groups.acceptable.push(rec);
    });

    return groups;
  }, [recommendations, finalConfig.groupBy]);

  if (!currentTrack) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#8E8E93', fontSize: '16px' }}>
          Load a track to see intelligent recommendations
        </p>
      </div>
    );
  }

  return (
    <div className="intelligent-browser" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '24px',
      backgroundColor: 'rgba(0,0,0,0.9)',
      borderRadius: '12px',
      border: '2px solid rgba(255,255,255,0.1)',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{
            color: '#FFFFFF',
            fontSize: '20px',
            margin: 0,
            fontWeight: 600
          }}>
            Track Browser
          </h3>
          <p style={{
            color: '#8E8E93',
            fontSize: '12px',
            margin: '4px 0 0 0'
          }}>
            {recommendations.length} track{recommendations.length !== 1 ? 's' : ''} • Sorted by {
              sortBy === 'score' ? 'Best Match' :
              sortBy === 'energy' ? 'Energy Similarity' :
              'Tempo Similarity'
            }
          </p>
        </div>
        <span style={{
          color: '#7ED321',
          fontSize: '14px',
          padding: '4px 12px',
          backgroundColor: 'rgba(126,211,33,0.2)',
          borderRadius: '12px'
        }}>
          Co-Pilot Active
        </span>
      </div>

      {/* Quick Filters */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setSortBy('score')}
          title="Sort by overall compatibility score (harmonic + energy + BPM + playlist history)"
          style={{
            padding: '8px 16px',
            backgroundColor: sortBy === 'score' ? '#4A90E2' : 'transparent',
            color: '#FFFFFF',
            border: '1px solid #4A90E2',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (sortBy !== 'score') {
              e.currentTarget.style.backgroundColor = 'rgba(74,144,226,0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (sortBy !== 'score') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          Best Match
        </button>
        <button
          onClick={() => setSortBy('energy')}
          title="Sort by energy level similarity (smooth transitions)"
          style={{
            padding: '8px 16px',
            backgroundColor: sortBy === 'energy' ? '#7ED321' : 'transparent',
            color: '#FFFFFF',
            border: sortBy === 'energy' ? '1px solid #7ED321' : '1px solid #7ED32180',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (sortBy !== 'energy') {
              e.currentTarget.style.backgroundColor = 'rgba(126,211,33,0.2)';
              e.currentTarget.style.borderColor = '#7ED321';
            }
          }}
          onMouseLeave={(e) => {
            if (sortBy !== 'energy') {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#7ED32180';
            }
          }}
        >
          Energy Flow
        </button>
        <button
          onClick={() => setSortBy('bpm')}
          title="Sort by BPM similarity (closest tempo first)"
          style={{
            padding: '8px 16px',
            backgroundColor: sortBy === 'bpm' ? '#F5A623' : 'transparent',
            color: '#FFFFFF',
            border: sortBy === 'bpm' ? '1px solid #F5A623' : '1px solid #F5A62380',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (sortBy !== 'bpm') {
              e.currentTarget.style.backgroundColor = 'rgba(245,166,35,0.2)';
              e.currentTarget.style.borderColor = '#F5A623';
            }
          }}
          onMouseLeave={(e) => {
            if (sortBy !== 'bpm') {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#F5A62380';
            }
          }}
        >
          Tempo Match
        </button>
      </div>

      {/* Recommendations - Hide empty groups */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {Object.entries(groupedRecommendations)
          .filter(([group, recs]) => recs.length > 0) // ✅ Hide empty groups
          .map(([group, recs]) => (
          <div key={group}>
            {finalConfig.groupBy !== 'none' && (
              <h4 style={{
                color: group === 'excellent' ? '#7ED321' :
                       group === 'good' ? '#F5A623' : '#8E8E93',
                fontSize: '12px',
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: 700
              }}>
                {group} ({recs.length})
              </h4>
            )}
            {recs.map(rec => (
              <RecommendationCard
                key={rec.track.id}
                recommendation={rec}
                currentTrack={currentTrack}
                onSelect={() => onTrackSelect(rec.track)}
                showReasons={finalConfig.showReasons}
              />
            ))}
          </div>
        ))}
      </div>

      {/* No recommendations message */}
      {recommendations.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center'
        }}>
          <p style={{
            color: '#F5A623',
            fontSize: '16px'
          }}>
            No compatible tracks found
          </p>
          <p style={{
            color: '#8E8E93',
            fontSize: '14px',
            marginTop: '8px'
          }}>
            Try adjusting your filters or adding more tracks to your library
          </p>
        </div>
      )}
    </div>
  );
};

export default IntelligentBrowser;