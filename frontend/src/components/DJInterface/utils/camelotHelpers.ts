/**
 * Camelot Wheel Helpers
 *
 * Utilities for working with the Camelot Wheel key notation system.
 * The Camelot Wheel is a DJ tool for harmonic mixing, mapping musical keys
 * to a numbered system (1A-12A for minor, 1B-12B for major).
 *
 * @module DJInterface/utils/camelotHelpers
 */

/**
 * All valid Camelot key notations
 *
 * Format: [1-12][A-B]
 * - Numbers 1-12: Position on the wheel (like clock positions)
 * - A: Minor keys
 * - B: Major keys
 *
 * Harmonic mixing rules:
 * - Same number: Perfect match (e.g., 1A → 1B)
 * - ±1 number: Compatible (e.g., 1A → 2A or 12A)
 * - +7 (opposite): Energy shift (e.g., 1A → 8A)
 */
export const CAMELOT_KEYS = [
  '1A', '2A', '3A', '4A', '5A', '6A',
  '7A', '8A', '9A', '10A', '11A', '12A',
  '1B', '2B', '3B', '4B', '5B', '6B',
  '7B', '8B', '9B', '10B', '11B', '12B'
] as const;

/**
 * Type guard to check if a string is a valid Camelot key
 *
 * @param key - String to validate
 * @returns true if key is valid Camelot notation
 *
 * @example
 * ```typescript
 * if (isValidCamelotKey(track.key)) {
 *   const compatible = getCompatibleKeys(track.key);
 * }
 * ```
 */
export function isValidCamelotKey(key: string | undefined): key is typeof CAMELOT_KEYS[number] {
  if (!key) return false;
  return CAMELOT_KEYS.includes(key as any);
}

/**
 * Get harmonically compatible keys for a given Camelot key
 *
 * Returns keys that will mix harmonically:
 * - Same key (perfect match)
 * - ±1 number (adjacent keys)
 * - Same number, opposite letter (major/minor switch)
 *
 * @param key - Camelot key to find compatible keys for
 * @returns Array of compatible Camelot keys
 *
 * @example
 * ```typescript
 * const compatible = getCompatibleKeys('5A');
 * // Returns: ['5A', '5B', '4A', '6A']
 * ```
 */
export function getCompatibleKeys(key: string): string[] {
  if (!isValidCamelotKey(key)) return [];

  const number = parseInt(key.substring(0, key.length - 1));
  const letter = key.slice(-1);

  const compatible: string[] = [key]; // Perfect match

  // Adjacent keys (±1)
  const prevNumber = number === 1 ? 12 : number - 1;
  const nextNumber = number === 12 ? 1 : number + 1;
  compatible.push(`${prevNumber}${letter}`, `${nextNumber}${letter}`);

  // Opposite letter (major/minor switch)
  const oppositeLetter = letter === 'A' ? 'B' : 'A';
  compatible.push(`${number}${oppositeLetter}`);

  return compatible;
}

/**
 * Calculate harmonic compatibility score between two keys
 *
 * Scoring:
 * - 100: Perfect match (same key)
 * - 80: Major/minor switch (energy change)
 * - 60: Adjacent keys (smooth transition)
 * - 0: Not compatible
 *
 * @param key1 - First Camelot key
 * @param key2 - Second Camelot key
 * @returns Compatibility score (0-100)
 *
 * @example
 * ```typescript
 * const score = getKeyCompatibilityScore('5A', '5B');
 * // Returns: 80 (major/minor switch)
 * ```
 */
export function getKeyCompatibilityScore(key1: string, key2: string): number {
  if (!isValidCamelotKey(key1) || !isValidCamelotKey(key2)) return 0;
  if (key1 === key2) return 100; // Perfect match

  const num1 = parseInt(key1.substring(0, key1.length - 1));
  const num2 = parseInt(key2.substring(0, key2.length - 1));
  const letter1 = key1.slice(-1);
  const letter2 = key2.slice(-1);

  // Major/minor switch (same number, different letter)
  if (num1 === num2 && letter1 !== letter2) return 80;

  // Adjacent keys (±1, same letter)
  const diff = Math.abs(num1 - num2);
  const isAdjacent = diff === 1 || diff === 11; // Handle 12→1 wrap
  if (isAdjacent && letter1 === letter2) return 60;

  return 0; // Not compatible
}
