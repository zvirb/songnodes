/**
 * FE5 Camelot Module - Core Logic
 */

import { getModulationTargets } from '../../utils/camelotUtils';

export type CamelotKey = string;

/**
 * Returns an array of keys compatible with the given Camelot key based on
 * the Camelot wheel rules: same key, ±1 hour (same letter), and the relative
 * major/minor key (same number, different letter).
 *
 * @param key The base key, e.g. "8A"
 * @returns Array of compatible keys
 */
export function compatibleKeys(key: string | null): string[] {
  if (!key) return [];
  const match = key.match(/^(\d{1,2})([AB])$/i);
  if (!match) return [];

  const numStr = match[1];
  const letter = match[2].toUpperCase();
  const num = parseInt(numStr, 10);

  if (isNaN(num) || num < 1 || num > 12) return [];

  const otherLetter = letter === 'A' ? 'B' : 'A';
  const plus1 = (num % 12) + 1;
  const minus1 = ((num + 10) % 12) + 1;

  // Standard Camelot harmonic mixing rules:
  // 1. Same key
  // 2. Relative key (same number, opposite letter)
  // 3. Adjacent key +1
  // 4. Adjacent key -1
  return [
    `${num}${letter}`,
    `${num}${otherLetter}`,
    `${plus1}${letter}`,
    `${minus1}${letter}`
  ];
}

export interface MoveTarget {
  id: string;
  label: string;
  hint: string;
  key: string;
}

export function moveTargets(key: string | null): MoveTarget[] {
  if (!key) return [];
  const targets = getModulationTargets(key);
  if (!targets) return [];

  const isMinor = targets.exactMatch.endsWith('A');
  const relativeLabel = isMinor ? 'Relative major' : 'Relative minor';

  return [
    { id: 'same', label: 'Same key', hint: '', key: targets.exactMatch },
    { id: 'plus1', label: 'Up one', hint: '+1', key: targets.adjacentPlus1 },
    { id: 'minus1', label: 'Down one', hint: '-1', key: targets.adjacentMinus1 },
    { id: 'relative', label: relativeLabel, hint: '', key: targets.relative },
    { id: 'boost', label: 'Energy boost +2', hint: '', key: targets.energyBoostPlus2 },
    { id: 'lift', label: 'Energy lift +7 (one semitone up)', hint: '', key: targets.energyBoostPlus7 },
  ];
}
