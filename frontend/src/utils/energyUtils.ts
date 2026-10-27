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
export const getEnergyColor = (level: number): string => {
  const colors: { [key: number]: string } = {
    1: '#2E3A87',
    2: '#3A4A9C',
    3: '#4A5FB1',
    4: '#5A7AC6',
    5: '#4A90E2',
    6: '#62B0FF',
    7: '#FFA500',
    8: '#FF7F00',
    9: '#FF5500',
    10: '#FF0000'
  };
  return colors[level] || colors[5];
};

/**
 * Sizing definitions for the EnergyMeter component.
 */
export const SIZES = {
  small: { width: 'w-16', height: 'h-5', bars: 5 },
  medium: { width: 'w-24', height: 'h-7', bars: 10 },
  large: { width: 'w-36', height: 'h-10', bars: 10 }
};