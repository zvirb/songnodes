/**
 * @file Intelligent Browser Utilities
 * @description Contains the core logic for generating track recommendations based on harmonic,
 * energy, BPM, and graph-based adjacency compatibility.
 */

import { Track, TrackRecommendation, CamelotKey, GraphEdge } from '../types';

const getKeyCompatibility = (key1?: string, key2?: string): 'perfect' | 'compatible' | 'clash' => {
  if (!key1 || !key2) return 'clash';
  if (key1 === key2) return 'perfect';

  const num1 = parseInt(key1.slice(0, -1), 10);
  const letter1 = key1.slice(-1);
  const num2 = parseInt(key2.slice(0, -1), 10);
  const letter2 = key2.slice(-1);

  if (isNaN(num1) || isNaN(num2)) return 'clash';

  if (num1 === num2 && letter1 !== letter2) return 'perfect';

  const diff = Math.abs(num1 - num2);
  const wrappedDiff = Math.min(diff, 12 - diff);

  if (wrappedDiff === 1 && letter1 === letter2) return 'compatible';

  return 'clash';
};

/**
 * Calculates a list of track recommendations based on a currently playing track.
 * The scoring algorithm prioritizes real-world playlist connections (graph adjacency)
 * over theoretical harmonic compatibility.
 * @param {Track | null} currentTrack - The track that is currently playing.
 * @param {Track[]} allTracks - A list of all available tracks to recommend from.
 * @param {GraphEdge[]} graphEdges - The graph edges to determine track adjacency.
 * @returns {TrackRecommendation[]} A sorted list of track recommendations.
 */
export const calculateRecommendations = (
  currentTrack: Track | null,
  allTracks: Track[],
  graphEdges: GraphEdge[] = []
): TrackRecommendation[] => {
  if (!currentTrack) return [];

  const adjacencyMap = new Map<string, { weight: number; type: string }>();
  if (graphEdges.length > 0) {
    for (const edge of graphEdges) {
      if (edge.source === currentTrack.id) {
        adjacencyMap.set(edge.target, { weight: edge.weight, type: edge.type });
      } else if (edge.target === currentTrack.id) {
        adjacencyMap.set(edge.source, { weight: edge.weight, type: edge.type });
      }
    }
  }

  return allTracks
    .filter(track => track.id !== currentTrack.id)
    .map(track => {
      const recommendation: TrackRecommendation = {
        track,
        score: 0,
        reasons: [],
        compatibility: { harmonic: 'clash', energy: 'risky', bpm: 'needs_adjustment' },
      };

      // 1. Graph Adjacency Score (Highest Weight)
      const adjacency = adjacencyMap.get(track.id);
      if (adjacency) {
        const adjacencyScore = 60 + (adjacency.weight * 20);
        recommendation.score += adjacencyScore;
        recommendation.reasons.push({ type: 'history', description: `Often played together`, weight: adjacencyScore });
      }

      // 2. Harmonic Compatibility Score
      const keyCompat = getKeyCompatibility(currentTrack.key, track.key);
      if (keyCompat === 'perfect') {
        recommendation.score += 25;
        recommendation.reasons.push({ type: 'harmonic', description: 'Perfect harmonic match', weight: 25 });
        recommendation.compatibility.harmonic = 'perfect';
      } else if (keyCompat === 'compatible') {
        recommendation.score += 15;
        recommendation.reasons.push({ type: 'harmonic', description: 'Harmonically compatible', weight: 15 });
        recommendation.compatibility.harmonic = 'compatible';
      }

      // 3. Energy Flow Score
      if (track.energy != null && currentTrack.energy != null) {
        const energyDiff = Math.abs(track.energy - currentTrack.energy);
        if (energyDiff <= 0.1) recommendation.score += 15;
        else if (energyDiff <= 0.2) recommendation.score += 10;
        recommendation.compatibility.energy = energyDiff <= 0.1 ? 'perfect' : 'good';
      }

      // 4. BPM Compatibility Score
      if (track.bpm != null && currentTrack.bpm != null && currentTrack.bpm > 0) {
        const bpmPercent = Math.abs(track.bpm - currentTrack.bpm) / currentTrack.bpm * 100;
        if (bpmPercent <= 2) recommendation.score += 15;
        else if (bpmPercent <= 6) recommendation.score += 10;
        recommendation.compatibility.bpm = bpmPercent <= 2 ? 'perfect' : 'close';
      }

      return recommendation;
    })
    .sort((a, b) => b.score - a.score);
};