/**
 * Utility functions for IntelligentBrowser
 * Centralized logic for key compatibility, recommendations, and data processing
 */

import type { CamelotKey, CompatibilityLevel, Track, TrackRecommendation, GraphEdge } from './types';

/**
 * Calculate harmonic compatibility between two Camelot keys
 */
export const getKeyCompatibility = (key1: CamelotKey | undefined, key2: CamelotKey | undefined): CompatibilityLevel => {
  if (!key1 || !key2) return 'clash';
  if (key1 === key2) return 'perfect';

  const num1 = parseInt(key1.slice(0, -1));
  const letter1 = key1.slice(-1);
  const num2 = parseInt(key2.slice(0, -1));
  const letter2 = key2.slice(-1);

  // Same number, different letter (relative major/minor)
  if (num1 === num2) return 'perfect';

  // Adjacent on the wheel (+1/-1)
  const diff = Math.abs(num1 - num2);
  const wrappedDiff = Math.min(diff, 12 - diff);

  if (wrappedDiff === 1 && letter1 === letter2) return 'compatible';

  return 'clash';
};

/**
 * Calculate intelligent recommendations based on current track and graph adjacencies
 */
export const calculateRecommendations = (
  currentTrack: Track | null,
  allTracks: Track[],
  graphEdges?: GraphEdge[]
): TrackRecommendation[] => {
  if (!currentTrack) return [];

  // Build adjacency map from graph edges (HIGHEST PRIORITY)
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

  return allTracks
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

      // PRIORITY #1: Graph Adjacency (60-80 points)
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

      // Harmonic compatibility (0-25 points)
      const keyCompat = getKeyCompatibility(currentTrack.key as CamelotKey, track.key as CamelotKey);
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

      // Energy flow (0-15 points)
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

      // BPM compatibility (0-15 points)
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

/**
 * Get color for score visualization
 */
export const getScoreColor = (score: number): string => {
  if (score >= 80) return '#7ED321'; // Excellent
  if (score >= 60) return '#F5A623'; // Good
  if (score >= 40) return '#FFA500'; // Okay
  return '#8E8E93'; // Poor
};

/**
 * Format duration in milliseconds to MM:SS
 */
export const formatDuration = (durationMs: number | undefined): string => {
  if (!durationMs) return '---';
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Debounce function for search/filtering
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Group recommendations by compatibility level
 */
export const groupRecommendations = (recommendations: TrackRecommendation[]): Record<string, TrackRecommendation[]> => {
  return {
    excellent: recommendations.filter(r => r.score >= 80),
    good: recommendations.filter(r => r.score >= 60 && r.score < 80),
    acceptable: recommendations.filter(r => r.score < 60)
  };
};

/**
 * Filter recommendations by search query
 */
export const filterBySearch = (recommendations: TrackRecommendation[], query: string): TrackRecommendation[] => {
  if (!query.trim()) return recommendations;

  const lowerQuery = query.toLowerCase();
  return recommendations.filter(rec =>
    rec.track.name.toLowerCase().includes(lowerQuery) ||
    rec.track.artist.toLowerCase().includes(lowerQuery) ||
    rec.track.genre?.toLowerCase().includes(lowerQuery)
  );
};
