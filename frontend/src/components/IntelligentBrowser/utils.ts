/**
 * Utility functions for IntelligentBrowser
 * Centralized logic for key compatibility, recommendations, and data processing
 */

import { SN } from '../../lib/songnodes';
import type { CamelotKey, CompatibilityLevel, Track, TrackRecommendation, GraphEdge } from './types';

/**
 * Harmonic compatibility between two keys, via the design system's Camelot
 * table (SN.camelot accepts "8A" or "A minor"; SN.compat gives the verdict).
 * Unknown keys score as a clash, as before.
 */
export const getKeyCompatibility = (key1: CamelotKey | string | undefined, key2: CamelotKey | string | undefined): CompatibilityLevel => {
  const a = key1 ? SN.camelot(key1) : null;
  const b = key2 ? SN.camelot(key2) : null;
  if (!a || !b) return 'clash';
  const level = SN.compat(a, b).level;
  return level === 'perfect' || level === 'compatible' || level === 'possible' ? level : 'clash';
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
 * Score band for a recommendation (design-system/17-governance.md Q9: 80/60/40
 * until enough accepted picks exist to fit bands from them). Rendered as a
 * CompatibilityBadge, so the glyph and word carry the band, not colour.
 */
export const scoreBand = (score: number): { level: 'perfect' | 'compatible' | 'possible' | 'clash'; label: string } => {
  if (score >= 80) return { level: 'perfect', label: `${score} strong` };
  if (score >= 60) return { level: 'compatible', label: `${score} good` };
  if (score >= 40) return { level: 'possible', label: `${score} fair` };
  return { level: 'clash', label: `${score} weak` };
};

/**
 * Track length as m:ss via the design system. Tracks from trackFromNode carry
 * duration in seconds. Missing → en dash.
 */
export const formatDuration = (durationSeconds: number | undefined): string =>
  durationSeconds && durationSeconds > 0 ? SN.format.duration(durationSeconds) : '–';

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
