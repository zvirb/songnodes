/**
 * @file Energy Utilities
 * @description Contains constants and helper functions related to track energy levels.
 */

/**
 * Descriptions for each energy level, based on the Mixed In Key standard.
 */
export const ENERGY_DESCRIPTORS: { [key: number]: { label: string; desc: string } } = {
  1: { label: 'Ambient', desc: 'Very low energy, chill' },
  2: { label: 'Minimal', desc: 'Low energy, background' },
  3: { label: 'Relaxed', desc: 'Easy listening' },
  4: { label: 'Moderate', desc: 'Building energy' },
  5: { label: 'Groovy', desc: 'Danceable, steady' },
  6: { label: 'Energetic', desc: 'High groove, driving' },
  7: { label: 'Peak', desc: 'Party atmosphere' },
  8: { label: 'Intense', desc: 'Very high energy' },
  9: { label: 'Extreme', desc: 'Festival energy' },
  10: { label: 'Maximum', desc: 'Peak time anthem' }
};

/**
 * Color gradient for energy levels, from cool (blue) to hot (red).
 * @param {number} level - The energy level (1-10).
 * @returns {string} The corresponding hex color code.
 */
/**
 * Resolve a design-system token to its computed value (for canvas/PIXI callers that
 * cannot use var()). Falls back to the var() reference when no DOM is available.
 */
const readToken = (name: string): string => {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

export const getEnergyColor = (level: number): string => {
  const step = Math.min(10, Math.max(1, Math.round(level) || 5));
  return readToken(`--energy-${step}`) || `var(--energy-${step})`;
};

/**
 * Sizing definitions for the EnergyMeter component.
 */
export const SIZES = {
  small: { width: 'w-16', height: 'h-5', bars: 5 },
  medium: { width: 'w-24', height: 'h-7', bars: 10 },
  large: { width: 'w-36', height: 'h-10', bars: 10 }
};