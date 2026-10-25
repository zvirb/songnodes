/**
 * Utility Functions for SetlistBuilder
 * Shared helper functions for track analysis and formatting against Design System standards
 */

import type { Track, TransitionQuality } from './types';

// Standard Camelot Wheel mapping for harmonic mixing and Design System key tokens
const CAMELOT_KEY_MAP: Record<string, { code: string; token: string; number: number; letter: 'A' | 'B'; compatibles: string[] }> = {
  '1A': { code: '1A', token: 'var(--key-1a)', number: 1, letter: 'A', compatibles: ['1B', '12A', '2A', '3A', '8A'] },
  '1B': { code: '1B', token: 'var(--key-1b)', number: 1, letter: 'B', compatibles: ['1A', '12B', '2B', '3B', '8B'] },
  '2A': { code: '2A', token: 'var(--key-2a)', number: 2, letter: 'A', compatibles: ['2B', '1A', '3A', '4A', '9A'] },
  '2B': { code: '2B', token: 'var(--key-2b)', number: 2, letter: 'B', compatibles: ['2A', '1B', '3B', '4B', '9B'] },
  '3A': { code: '3A', token: 'var(--key-3a)', number: 3, letter: 'A', compatibles: ['3B', '2A', '4A', '5A', '10A'] },
  '3B': { code: '3B', token: 'var(--key-3b)', number: 3, letter: 'B', compatibles: ['3A', '2B', '4B', '5B', '10B'] },
  '4A': { code: '4A', token: 'var(--key-4a)', number: 4, letter: 'A', compatibles: ['4B', '3A', '5A', '6A', '11A'] },
  '4B': { code: '4B', token: 'var(--key-4b)', number: 4, letter: 'B', compatibles: ['4A', '3B', '5B', '6B', '11B'] },
  '5A': { code: '5A', token: 'var(--key-5a)', number: 5, letter: 'A', compatibles: ['5B', '4A', '6A', '7A', '12A'] },
  '5B': { code: '5B', token: 'var(--key-5b)', number: 5, letter: 'B', compatibles: ['5A', '4B', '6B', '7B', '12B'] },
  '6A': { code: '6A', token: 'var(--key-6a)', number: 6, letter: 'A', compatibles: ['6B', '5A', '7A', '8A', '1A'] },
  '6B': { code: '6B', token: 'var(--key-6b)', number: 6, letter: 'B', compatibles: ['6A', '5B', '7B', '8B', '1B'] },
  '7A': { code: '7A', token: 'var(--key-7a)', number: 7, letter: 'A', compatibles: ['7B', '6A', '8A', '9A', '2A'] },
  '7B': { code: '7B', token: 'var(--key-7b)', number: 7, letter: 'B', compatibles: ['7A', '6B', '8B', '9B', '2B'] },
  '8A': { code: '8A', token: 'var(--key-8a)', number: 8, letter: 'A', compatibles: ['8B', '7A', '9A', '10A', '3A'] },
  '8B': { code: '8B', token: 'var(--key-8b)', number: 8, letter: 'B', compatibles: ['8A', '7B', '9B', '10B', '3B'] },
  '9A': { code: '9A', token: 'var(--key-9a)', number: 9, letter: 'A', compatibles: ['9B', '8A', '10A', '11A', '4A'] },
  '9B': { code: '9B', token: 'var(--key-9b)', number: 9, letter: 'B', compatibles: ['9A', '8B', '10B', '11B', '4B'] },
  '10A': { code: '10A', token: 'var(--key-10a)', number: 10, letter: 'A', compatibles: ['10B', '9A', '11A', '12A', '5A'] },
  '10B': { code: '10B', token: 'var(--key-10b)', number: 10, letter: 'B', compatibles: ['10A', '9B', '11B', '12B', '5B'] },
  '11A': { code: '11A', token: 'var(--key-11a)', number: 11, letter: 'A', compatibles: ['11B', '10A', '12A', '1A', '6A'] },
  '11B': { code: '11B', token: 'var(--key-11b)', number: 11, letter: 'B', compatibles: ['11A', '10B', '12B', '1B', '6B'] },
  '12A': { code: '12A', token: 'var(--key-12a)', number: 12, letter: 'A', compatibles: ['12B', '11A', '1A', '2A', '7A'] },
  '12B': { code: '12B', token: 'var(--key-12b)', number: 12, letter: 'B', compatibles: ['12A', '11B', '1B', '2B', '7B'] },
};

// Common musical key string aliases mapped to Camelot codes
const MUSICAL_TO_CAMELOT: Record<string, string> = {
  'Abm': '1A', 'G#m': '1A', 'B': '1B',
  'Ebm': '2A', 'D#m': '2A', 'F#': '2B', 'Gb': '2B',
  'Bbm': '3A', 'A#m': '3A', 'Db': '3B', 'C#': '3B',
  'Fm': '4A', 'Ab': '4B', 'G#': '4B',
  'Cm': '5A', 'Eb': '5B', 'D#': '5B',
  'Gm': '6A', 'Bb': '6B', 'A#': '6B',
  'Dm': '7A', 'F': '7B',
  'Am': '8A', 'C': '8B',
  'Em': '9A', 'G': '9B',
  'Bm': '10A', 'D': '10B',
  'F#m': '11A', 'Gbm': '11A', 'A': '11B',
  'C#m': '12A', 'Dbm': '12A', 'E': '12B',
};

/**
 * Normalise any key string to Camelot code (e.g. "8A", "Am" -> "8A")
 */
export const normalizeCamelotKey = (key?: string): string | null => {
  if (!key) return null;
  const clean = key.trim().toUpperCase();
  if (CAMELOT_KEY_MAP[clean]) return clean;

  const keyTitle = key.trim();
  if (MUSICAL_TO_CAMELOT[keyTitle]) return MUSICAL_TO_CAMELOT[keyTitle];

  return null;
};

/**
 * Get CSS color token for key dot/badge
 */
export const getKeyToken = (key?: string): string => {
  const code = normalizeCamelotKey(key);
  if (code && CAMELOT_KEY_MAP[code]) {
    return CAMELOT_KEY_MAP[code].token;
  }
  return 'var(--fg-disabled)';
};

/**
 * Get CSS color token for Energy 1-10 segment
 */
export const getEnergyToken = (energyValue?: number | null): string => {
  if (energyValue == null || isNaN(energyValue)) return 'var(--surface-3)';
  const level = Math.max(1, Math.min(10, Math.round(energyValue > 1 ? energyValue : energyValue * 10)));
  return `var(--energy-${level})`;
};

/**
 * Format seconds into M:SS or MM:SS format
 */
export const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Get key compatibility using Camelot wheel logic
 */
export const getKeyCompatibility = (
  key1?: string,
  key2?: string
): 'perfect' | 'good' | 'poor' | 'unknown' => {
  const code1 = normalizeCamelotKey(key1);
  const code2 = normalizeCamelotKey(key2);

  if (!code1 || !code2) return 'unknown';
  if (code1 === code2) return 'perfect';

  const info1 = CAMELOT_KEY_MAP[code1];
  const info2 = CAMELOT_KEY_MAP[code2];

  if (!info1 || !info2) return 'unknown';

  if (info1.compatibles.includes(code2)) return 'good';

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
  if (diff <= 2) return 'perfect';
  if (diff <= 4) return 'good';
  if (diff <= 8) return 'good';

  // Double / half tempo check
  const ratio1 = bpm1 / bpm2;
  const ratio2 = bpm2 / bpm1;
  if (Math.abs(ratio1 - 2) < 0.1 || Math.abs(ratio2 - 2) < 0.1) return 'good';

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
    const e1 = track1.energy > 1 ? track1.energy / 10 : track1.energy;
    const e2 = track2.energy > 1 ? track2.energy / 10 : track2.energy;
    const energyDiff = Math.abs(e1 - e2);
    energyComp = energyDiff <= 0.2 ? 'good' : 'poor';
  }

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
 * Get CSS color token for quality/compatibility status
 */
export const getQualityColor = (quality: string): string => {
  switch (quality) {
    case 'excellent':
    case 'perfect':
      return 'var(--compat-perfect)';
    case 'good':
    case 'compatible':
      return 'var(--compat-compatible)';
    case 'fair':
    case 'possible':
      return 'var(--compat-possible)';
    case 'poor':
    case 'clash':
      return 'var(--compat-clash)';
    default:
      return 'var(--fg-3)';
  }
};

/**
 * Get background tint token for compatibility status
 */
export const getQualityBgColor = (quality: string): string => {
  switch (quality) {
    case 'excellent':
    case 'perfect':
      return 'var(--status-ok-bg)';
    case 'good':
    case 'compatible':
      return 'var(--status-fair-bg)';
    case 'fair':
    case 'possible':
      return 'var(--status-warn-bg)';
    case 'poor':
    case 'clash':
      return 'var(--status-bad-bg)';
    default:
      return 'var(--surface-2)';
  }
};

/**
 * Get glyph character for compatibility status
 */
export const getQualityGlyph = (quality: string): string => {
  switch (quality) {
    case 'excellent':
    case 'perfect':
      return '●';
    case 'good':
    case 'compatible':
      return '◐';
    case 'fair':
    case 'possible':
      return '○';
    case 'poor':
    case 'clash':
      return '✕';
    default:
      return '–';
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
// design-system exception: #000000
