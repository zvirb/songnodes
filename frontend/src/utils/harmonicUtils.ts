/**
 * @file Harmonic Compatibility Utilities
 * @description Contains types, constants, and functions related to harmonic mixing and the Camelot wheel.
 */

import { CamelotKey } from '../types/dj';

export type HarmonicCompatibilityType = 'perfect' | 'compatible' | 'possible' | 'clash';

/**
 * Determines the harmonic compatibility between two Camelot keys.
 * @param {CamelotKey} current - The starting key.
 * @param {CamelotKey} target - The target key.
 * @returns {HarmonicCompatibilityType} The level of compatibility.
 */
export const getCompatibility = (current: CamelotKey, target: CamelotKey): HarmonicCompatibilityType => {
  if (!current || !target) return 'clash';

  const currentNum = parseInt(current.slice(0, -1), 10);
  const currentLetter = current.slice(-1);
  const targetNum = parseInt(target.slice(0, -1), 10);
  const targetLetter = target.slice(-1);

  if (current === target) return 'perfect';
  if (currentNum === targetNum && currentLetter !== targetLetter) return 'perfect';

  const numDiff = Math.abs(currentNum - targetNum);
  const wrappedDiff = Math.min(numDiff, 12 - numDiff);

  if (wrappedDiff === 1 && currentLetter === targetLetter) return 'compatible';
  if (wrappedDiff === 2 && currentLetter === targetLetter) return 'possible';

  return 'clash';
};

/**
 * Defines the visual properties (colors, labels, icons) for each compatibility level.
 */
export const COMPATIBILITY_PROPS: { [key in HarmonicCompatibilityType]: {
  bgClass: string;
  textClass: string;
  label: string;
  icon: string;
  colorValue: string;
} } = {
  perfect:    { bgClass: 'bg-green-400',    textClass: 'text-black',     label: 'Perfect',    icon: '✓✓', colorValue: '#4ade80' },
  compatible: { bgClass: 'bg-yellow-400',   textClass: 'text-black',     label: 'Compatible', icon: '✓',  colorValue: '#facc15' },
  possible:   { bgClass: 'bg-orange-400',   textClass: 'text-black',     label: 'Possible',   icon: '~',  colorValue: '#fb923c' },
  clash:      { bgClass: 'bg-red-500',      textClass: 'text-white',     label: 'Clash',      icon: '✗',  colorValue: '#ef4444' },
};

/**
 * Defines the size variants for the HarmonicCompatibility component.
 */
export const SIZES = {
  small:  { container: 'w-6 h-6',  fontSize: 'text-xs' },
  medium: { container: 'w-10 h-10', fontSize: 'text-sm' },
  large:  { container: 'w-14 h-14', fontSize: 'text-base' },
};