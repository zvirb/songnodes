/**
 * @file Filter Panel Utilities
 * @description Contains constants and helper functions for the FilterPanel component.
 */

/**
 * A list of common genres in electronic and dance music, used for populating filter options.
 */
export const COMMON_GENRES = [
  'House', 'Techno', 'Trance', 'Dubstep', 'Drum & Bass', 'Breakbeat',
  'Ambient', 'Progressive', 'Deep House', 'Tech House', 'Minimal', 'Hardstyle',
  'Psytrance', 'Big Room', 'Future Bass', 'Trap', 'Electro', 'Acid'
];

/**
 * A map of Camelot keys to their musical key names.
 */
export const CAMELOT_WHEEL_MUSICAL_MAP: { [key: string]: string } = {
  '1B': 'C major', '2B': 'G major', '3B': 'D major', '4B': 'A major',
  '5B': 'E major', '6B': 'B major', '7B': 'F# major', '8B': 'Db major',
  '9B': 'Ab major', '10B': 'Eb major', '11B': 'Bb major', '12B': 'F major',
  '1A': 'A minor', '2A': 'E minor', '3A': 'B minor', '4A': 'F# minor',
  '5A': 'C# minor', '6A': 'G# minor', '7A': 'Eb minor', '8A': 'Bb minor',
  '9A': 'F minor', '10A': 'C minor', '11A': 'G minor', '12A': 'D minor'
};