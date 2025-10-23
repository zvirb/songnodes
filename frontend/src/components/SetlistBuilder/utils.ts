/**
 * Utility Functions for SetlistBuilder
 * Shared helper functions for track analysis and formatting
 */

import type { Track, TransitionQuality } from './types';

// Camelot Wheel mapping for harmonic mixing
const CAMELOT_WHEEL: Record<string, { number: number; letter: string; compatibles: string[] }> = {
  'C': { number: 8, letter: 'B', compatibles: ['G', 'F', 'Am', 'Dm'] },
  'Dm': { number: 7, letter: 'A', compatibles: ['C', 'Bb', 'Am', 'Gm'] },
  'G': { number: 9, letter: 'B', compatibles: ['C', 'D', 'Em', 'Am'] },
  'Am': { number: 8, letter: 'A', compatibles: ['C', 'Dm', 'G', 'Em'] },
  'F': { number: 7, letter: 'B', compatibles: ['C', 'Bb', 'Dm', 'Gm'] },
  'Em': { number: 9, letter: 'A', compatibles: ['G', 'Am', 'D', 'Bm'] },
  'Bb': { number: 6, letter: 'B', compatibles: ['F', 'Eb', 'Gm', 'Cm'] },
  'Gm': { number: 6, letter: 'A', compatibles: ['Bb', 'F', 'Dm', 'Cm'] },
  'D': { number: 10, letter: 'B', compatibles: ['G', 'A', 'Bm', 'Em'] },
  'Bm': { number: 10, letter: 'A', compatibles: ['D', 'G', 'Em', 'F#m'] },
  'A': { number: 11, letter: 'B', compatibles: ['D', 'E', 'F#m', 'Bm'] },
  'F#m': { number: 11, letter: 'A', compatibles: ['A', 'D', 'Bm', 'C#m'] },
  'E': { number: 12, letter: 'B', compatibles: ['A', 'B', 'C#m', 'F#m'] },
  'C#m': { number: 12, letter: 'A', compatibles: ['E', 'A', 'F#m', 'G#m'] },
  'B': { number: 1, letter: 'B', compatibles: ['E', 'F#', 'G#m', 'C#m'] },
  'G#m': { number: 1, letter: 'A', compatibles: ['B', 'E', 'C#m', 'D#m'] },
  'F#': { number: 2, letter: 'B', compatibles: ['B', 'C#', 'D#m', 'G#m'] },
  'D#m': { number: 2, letter: 'A', compatibles: ['F#', 'B', 'G#m', 'A#m'] },
  'Db': { number: 3, letter: 'B', compatibles: ['F#', 'Ab', 'Bbm', 'D#m'] },
  'Bbm': { number: 3, letter: 'A', compatibles: ['Db', 'F#', 'D#m', 'Fm'] },
  'Ab': { number: 4, letter: 'B', compatibles: ['Db', 'Eb', 'Fm', 'Bbm'] },
  'Fm': { number: 4, letter: 'A', compatibles: ['Ab', 'Db', 'Bbm', 'Cm'] },
  'Eb': { number: 5, letter: 'B', compatibles: ['Ab', 'Bb', 'Cm', 'Fm'] },
  'Cm': { number: 5, letter: 'A', compatibles: ['Eb', 'Ab', 'Fm', 'Gm'] },
};

/**
 * Format seconds into MM:SS format
 */
export const formatDuration = (seconds?: number): string => {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Get key compatibility using Camelot wheel
 */
export const getKeyCompatibility = (
  key1?: string,
  key2?: string
): 'perfect' | 'good' | 'poor' | 'unknown' => {
  if (!key1 || !key2) return 'unknown';

  const camelot1 = CAMELOT_WHEEL[key1];
  const camelot2 = CAMELOT_WHEEL[key2];

  if (!camelot1 || !camelot2) return 'unknown';

  if (key1 === key2) return 'perfect';
  if (camelot1.compatibles.includes(key2)) return 'good';

  // Check if adjacent on Camelot wheel
  const numberDiff = Math.abs(camelot1.number - camelot2.number);
  if ((numberDiff <= 1 || numberDiff >= 11) && camelot1.letter === camelot2.letter) {
    return 'good';
  }

  return 'poor';
};

/**
 * Get BPM compatibility for harmonic mixing
 */
export const getBpmCompatibility = (
  bpm1?: number,
  bpm2?: number
): 'perfect' | 'good' | 'poor' | 'unknown' => {
  if (!bpm1 || !bpm2) return 'unknown';

  const diff = Math.abs(bpm1 - bpm2);

  if (diff === 0) return 'perfect';
  if (diff <= 3) return 'good';
  if (diff <= 8) return 'good';

  // Check for harmonic mixing (double/half tempo)
  const ratio1 = bpm1 / bpm2;
  const ratio2 = bpm2 / bpm1;

  if (Math.abs(ratio1 - 2) < 0.1 || Math.abs(ratio2 - 2) < 0.1) return 'good';
  if (Math.abs(ratio1 - 1.5) < 0.1 || Math.abs(ratio2 - 1.5) < 0.1) return 'good';

  return 'poor';
};

/**
 * Calculate overall transition quality between two tracks
 */
export const getTransitionQuality = (track1: Track, track2: Track): TransitionQuality => {
  const keyComp = getKeyCompatibility(track1.key, track2.key);
  const bpmComp = getBpmCompatibility(track1.bpm, track2.bpm);

  let energyComp: 'good' | 'poor' | 'unknown' = 'unknown';
  if (track1.energy !== undefined && track2.energy !== undefined) {
    const energyDiff = Math.abs(track1.energy - track2.energy);
    energyComp = energyDiff <= 0.2 ? 'good' : 'poor';
  }

  // Calculate overall quality score
  let score = 0;
  if (keyComp === 'perfect') score += 3;
  else if (keyComp === 'good') score += 2;
  else if (keyComp === 'poor') score -= 1;

  if (bpmComp === 'perfect') score += 3;
  else if (bpmComp === 'good') score += 2;
  else if (bpmComp === 'poor') score -= 1;

  if (energyComp === 'good') score += 1;
  else if (energyComp === 'poor') score -= 1;

  let overall: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 5) overall = 'excellent';
  else if (score >= 3) overall = 'good';
  else if (score >= 1) overall = 'fair';
  else overall = 'poor';

  return { overall, key: keyComp, bpm: bpmComp, energy: energyComp };
};

/**
 * Get color for quality indicator
 */
export const getQualityColor = (quality: string): string => {
  switch (quality) {
    case 'excellent':
    case 'perfect':
      return 'rgb(126 211 33)'; // Green
    case 'good':
      return 'rgb(59 130 246)'; // Blue
    case 'fair':
      return 'rgb(250 204 21)'; // Yellow
    case 'poor':
      return 'rgb(239 68 68)'; // Red
    default:
      return 'rgb(156 163 175)'; // Gray
  }
};

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
