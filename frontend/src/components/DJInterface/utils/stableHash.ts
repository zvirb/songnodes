/**
 * Stable Hash Utility
 *
 * Provides deterministic hash function for generating stable random values
 * from string keys. Used for fallback data generation when metadata is missing.
 *
 * @module DJInterface/utils/stableHash
 */

/**
 * Generate a deterministic hash value from a string within a specified range
 *
 * This function creates a stable pseudo-random number from a string input,
 * ensuring the same string always produces the same output. Useful for
 * generating fallback BPM, duration, or energy values when metadata is missing.
 *
 * Algorithm: Simple hash accumulation with bit shifting and truncation to 32-bit
 *
 * @param str - Input string to hash
 * @param min - Minimum output value (inclusive)
 * @param max - Maximum output value (inclusive)
 * @returns Deterministic integer between min and max
 *
 * @example
 * ```typescript
 * // Generate stable BPM fallback
 * const bpm = getStableHashValue(trackId, 100, 140);
 *
 * // Generate stable duration (3-8 minutes)
 * const duration = getStableHashValue(trackId + '_duration', 180, 480);
 * ```
 */
export function getStableHashValue(str: string, min: number, max: number): number {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash) % (max - min + 1) + min;
}
