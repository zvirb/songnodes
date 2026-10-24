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
 * IntelligentBrowser - Legacy Co-Pilot Interface
 * Refactored to utilize global design system tokens
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--color-brand-primary)';
    if (score >= 60) return 'var(--color-warning)';
    if (score >= 40) return 'var(--color-warning)';
    return 'var(--color-text-disabled)';
  };

  return (
    <div
      className="recommendation-card"
      onClick={() => onSelect()}
      onTouchEnd={(e) => {
        e.preventDefault();
        onSelect();
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--color-bg-elevated-1)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all var(--duration-fast) var(--ease-out)',
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
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-base)',
            margin: 0,
            fontWeight: 'var(--font-weight-semibold)'
          }}>
            {track.name}
          </h4>
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            margin: 'var(--space-1) 0 0 0'
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
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-bg-elevated-2)',
          border: `2px solid ${getScoreColor(score)}`,
          color: getScoreColor(score),
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-bold)'
        }}>
          {score}
        </div>
      </div>

      {/* Compatibility Indicators */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-3)'
      }}>
        {/* Harmonic */}
        <div style={{ textAlign: 'center' }}>
          <HarmonicCompatibility
            currentKey={currentTrack.key as any}
            targetKey={track.key as any}
            size="small"
          />
          <div style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-xs)',
            marginTop: 'var(--space-1)'
          }}>
            {track.key}
          </div>
        </div>

        {/* Energy */}
        <div style={{ textAlign: 'center' }}>
          <EnergyMeter level={track.energy || 5} size="small" />
          <div style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-xs)',
            marginTop: 'var(--space-1)'
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
            color: compatibility.bpm === 'perfect' ? 'var(--color-brand-primary)' :
                   compatibility.bpm === 'close' ? 'var(--color-warning)' : 'var(--color-text-disabled)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)'
          }}>
            {track.bpm}
          </div>
          <div style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-xs)'
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
            padding: 'var(--space-1) var(--space-2)',
            backgroundColor: 'var(--color-brand-secondary-muted)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--color-brand-secondary)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)'
          }}>
            {track.genre || 'House'}
          </div>
        </div>
      </div>

      {/* Reasoning */}
      {showReasons && reasons.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-1)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--color-border-subtle)'
        }}>
          {reasons.slice(0, 3).map((reason, i) => (
            <span
              key={i}
              style={{
                padding: 'var(--space-1) var(--space-2)',
                backgroundColor: 'var(--color-bg-elevated-2)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)'
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
      case 'score':
        break;

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
    }

    return filtered.slice(0, finalConfig.maxRecommendations);
  }, [allRecommendations, sortBy, currentTrack, finalConfig.maxRecommendations]);

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
        padding: 'var(--space-6)',
        backgroundColor: 'var(--color-bg-base)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-subtle)',
        textAlign: 'center'
      }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
          Load a track to see intelligent recommendations
        </p>
      </div>
    );
  }

  return (
    <div className="intelligent-browser" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)',
      padding: 'var(--space-6)',
      backgroundColor: 'var(--color-bg-base)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border-default)',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      {/* Header - Current Track Info */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ flex: 1 }}>
            <h3 style={{
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xl)',
              margin: 0,
              fontWeight: 'var(--font-weight-bold)',
              lineHeight: 'var(--line-height-tight)'
            }}>
              {currentTrack.name}
            </h3>
            <p style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-base)',
              margin: 'var(--space-1) 0 0 0'
            }}>
              {currentTrack.artist}
            </p>
          </div>
          <span style={{
            color: 'var(--color-brand-primary)',
            fontSize: 'var(--font-size-xs)',
            padding: 'var(--space-1) var(--space-3)',
            backgroundColor: 'var(--color-brand-primary-muted)',
            borderRadius: 'var(--radius-full)',
            whiteSpace: 'nowrap'
          }}>
            Co-Pilot Active
          </span>
        </div>

        {/* Track Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--space-3)'
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-elevated-1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            border: '1px solid var(--color-border-subtle)'
          }}>
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              marginBottom: 'var(--space-1)',
              letterSpacing: 'var(--letter-spacing-wider)'
            }}>
              BPM
            </div>
            <div style={{
              fontSize: 'var(--font-size-xl)',
              color: 'var(--color-brand-secondary)',
              fontWeight: 'var(--font-weight-bold)'
            }}>
              {currentTrack.bpm || '---'}
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--color-bg-elevated-1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            border: '1px solid var(--color-border-subtle)'
          }}>
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              marginBottom: 'var(--space-1)',
              letterSpacing: 'var(--letter-spacing-wider)'
            }}>
              KEY
            </div>
            <div style={{
              fontSize: 'var(--font-size-xl)',
              color: 'var(--color-brand-primary)',
              fontWeight: 'var(--font-weight-bold)'
            }}>
              {currentTrack.key || '---'}
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--color-bg-elevated-1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            border: '1px solid var(--color-border-subtle)'
          }}>
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              marginBottom: 'var(--space-1)',
              letterSpacing: 'var(--letter-spacing-wider)'
            }}>
              ENERGY
            </div>
            {currentTrack.energy !== undefined ? (
              <div style={{
                display: 'flex',
                gap: '2px',
                alignItems: 'center',
                height: '24px'
              }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: '100%',
                      backgroundColor: i < Math.ceil(currentTrack.energy! / 2) ? 'var(--color-brand-primary)' : 'var(--color-bg-elevated-3)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                fontSize: 'var(--font-size-xl)',
                color: 'var(--color-text-secondary)',
                fontWeight: 'var(--font-weight-bold)'
              }}>
                ---
              </div>
            )}
          </div>

          <div style={{
            backgroundColor: 'var(--color-bg-elevated-1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            border: '1px solid var(--color-border-subtle)'
          }}>
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              marginBottom: 'var(--space-1)',
              letterSpacing: 'var(--letter-spacing-wider)'
            }}>
              TIME
            </div>
            <div style={{
              fontSize: 'var(--font-size-xl)',
              color: 'var(--color-text-primary)',
              fontWeight: 'var(--font-weight-bold)'
            }}>
              {currentTrack.duration ? `${Math.floor(currentTrack.duration / 60)}:${String(currentTrack.duration % 60).padStart(2, '0')}` : '---'}
            </div>
          </div>
        </div>

        <div style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--color-border-subtle)'
        }}>
          {recommendations.length} track{recommendations.length !== 1 ? 's' : ''} • Sorted by {
            sortBy === 'score' ? 'Best Match' :
            sortBy === 'energy' ? 'Energy Similarity' :
            'Tempo Similarity'
          }
        </div>
      </div>

      {/* Quick Filters */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-2)',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setSortBy('score')}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: sortBy === 'score' ? 'var(--color-brand-primary)' : 'transparent',
            color: sortBy === 'score' ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
            border: '1px solid var(--color-brand-primary)',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            transition: 'all var(--duration-fast) var(--ease-out)'
          }}
        >
          Best Match
        </button>
        <button
          onClick={() => setSortBy('energy')}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: sortBy === 'energy' ? 'var(--color-brand-secondary)' : 'transparent',
            color: sortBy === 'energy' ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
            border: '1px solid var(--color-brand-secondary)',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            transition: 'all var(--duration-fast) var(--ease-out)'
          }}
        >
          Energy Flow
        </button>
        <button
          onClick={() => setSortBy('bpm')}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: sortBy === 'bpm' ? 'var(--color-warning)' : 'transparent',
            color: sortBy === 'bpm' ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
            border: '1px solid var(--color-warning)',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            transition: 'all var(--duration-fast) var(--ease-out)'
          }}
        >
          Tempo Match
        </button>
      </div>

      {/* Recommendations */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)'
      }}>
        {Object.entries(groupedRecommendations)
          .filter(([_, recs]) => recs.length > 0)
          .map(([group, recs]) => (
          <div key={group}>
            {finalConfig.groupBy !== 'none' && (
              <h4 style={{
                color: group === 'excellent' ? 'var(--color-brand-primary)' :
                       group === 'good' ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                margin: '0 0 var(--space-2) 0',
                textTransform: 'uppercase',
                letterSpacing: 'var(--letter-spacing-wider)',
                fontWeight: 'var(--font-weight-bold)'
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

      {recommendations.length === 0 && (
        <div style={{
          padding: 'var(--space-8)',
          textAlign: 'center'
        }}>
          <p style={{
            color: 'var(--color-warning)',
            fontSize: 'var(--font-size-base)'
          }}>
            No compatible tracks found
          </p>
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            marginTop: 'var(--space-2)'
          }}>
            Try adjusting your filters or adding more tracks to your library
          </p>
        </div>
      )}
    </div>
  );
};

export default IntelligentBrowser;
