import { CamelotKey } from '../types';

/**
 * @file Camelot Wheel Data
 * @description Static data definition for the Camelot wheel.
 * SongNodes & Camelot standard:
 * Ring A = Minor keys (1A - 12A)
 * Ring B = Major keys (1B - 12B)
 * Uses official design system CSS variable tokens (`var(--key-*)`).
 */

export const CAMELOT_KEYS: CamelotKey[] = [
  // Minor keys (A ring in SongNodes)
  { id: '1A', musical: 'Ab Minor', openKey: '8m', position: 0, mode: 'minor', energy: 4, mood: 'Melancholic & Deep', color: 'var(--key-1a)', energyColor: 'var(--key-1a)', compatible: ['12A', '2A', '1B', '3A', '8A'] },
  { id: '2A', musical: 'Eb Minor', openKey: '9m', position: 1, mode: 'minor', energy: 6, mood: 'Contemplative & Driving', color: 'var(--key-2a)', energyColor: 'var(--key-2a)', compatible: ['1A', '3A', '2B', '4A', '9A'] },
  { id: '3A', musical: 'Bb Minor', openKey: '10m', position: 2, mode: 'minor', energy: 7, mood: 'Dramatic & Dark', color: 'var(--key-3a)', energyColor: 'var(--key-3a)', compatible: ['2A', '4A', '3B', '5A', '10A'] },
  { id: '4A', musical: 'F Minor', openKey: '11m', position: 3, mode: 'minor', energy: 6, mood: 'Introspective & Moody', color: 'var(--key-4a)', energyColor: 'var(--key-4a)', compatible: ['3A', '5A', '4B', '6A', '11A'] },
  { id: '5A', musical: 'C Minor', openKey: '12m', position: 4, mode: 'minor', energy: 7, mood: 'Passionate & Intense', color: 'var(--key-5a)', energyColor: 'var(--key-5a)', compatible: ['4A', '6A', '5B', '7A', '12A'] },
  { id: '6A', musical: 'G Minor', openKey: '1m', position: 5, mode: 'minor', energy: 5, mood: 'Haunting & Hypnotic', color: 'var(--key-6a)', energyColor: 'var(--key-6a)', compatible: ['5A', '7A', '6B', '8A', '1A'] },
  { id: '7A', musical: 'D Minor', openKey: '2m', position: 6, mode: 'minor', energy: 6, mood: 'Dark & Edgy', color: 'var(--key-7a)', energyColor: 'var(--key-7a)', compatible: ['6A', '8A', '7B', '9A', '2A'] },
  { id: '8A', musical: 'A Minor', openKey: '3m', position: 7, mode: 'minor', energy: 4, mood: 'Melancholic & Reflective', color: 'var(--key-8a)', energyColor: 'var(--key-8a)', compatible: ['7A', '9A', '8B', '10A', '3A'] },
  { id: '9A', musical: 'E Minor', openKey: '4m', position: 8, mode: 'minor', energy: 5, mood: 'Atmospheric & Deep', color: 'var(--key-9a)', energyColor: 'var(--key-9a)', compatible: ['8A', '10A', '9B', '11A', '4A'] },
  { id: '10A', musical: 'B Minor', openKey: '5m', position: 9, mode: 'minor', energy: 6, mood: 'Somber & Heavy', color: 'var(--key-10a)', energyColor: 'var(--key-10a)', compatible: ['9A', '11A', '10B', '12A', '5A'] },
  { id: '11A', musical: 'F# Minor', openKey: '6m', position: 10, mode: 'minor', energy: 7, mood: 'Tense & Energetic', color: 'var(--key-11a)', energyColor: 'var(--key-11a)', compatible: ['10A', '12A', '11B', '1A', '6A'] },
  { id: '12A', musical: 'C# Minor', openKey: '7m', position: 11, mode: 'minor', energy: 5, mood: 'Ethereal & Mystical', color: 'var(--key-12a)', energyColor: 'var(--key-12a)', compatible: ['11A', '1A', '12B', '2A', '7A'] },

  // Major keys (B ring in SongNodes)
  { id: '1B', musical: 'B Major', openKey: '8d', position: 0, mode: 'major', energy: 6, mood: 'Uplifting & Bright', color: 'var(--key-1b)', energyColor: 'var(--key-1b)', compatible: ['12B', '2B', '1A', '3B', '8B'] },
  { id: '2B', musical: 'F# Major', openKey: '9d', position: 1, mode: 'major', energy: 8, mood: 'Bright & Vibrant', color: 'var(--key-2b)', energyColor: 'var(--key-2b)', compatible: ['1B', '3B', '2A', '4B', '9B'] },
  { id: '3B', musical: 'Db Major', openKey: '10d', position: 2, mode: 'major', energy: 9, mood: 'Energetic & Heroic', color: 'var(--key-3b)', energyColor: 'var(--key-3b)', compatible: ['2B', '4B', '3A', '5B', '10B'] },
  { id: '4B', musical: 'Ab Major', openKey: '11d', position: 3, mode: 'major', energy: 8, mood: 'Triumphant & Joyful', color: 'var(--key-4b)', energyColor: 'var(--key-4b)', compatible: ['3B', '5B', '4A', '6B', '11B'] },
  { id: '5B', musical: 'Eb Major', openKey: '12d', position: 4, mode: 'major', energy: 9, mood: 'Powerful & Bright', color: 'var(--key-5b)', energyColor: 'var(--key-5b)', compatible: ['4B', '6B', '5A', '7B', '12B'] },
  { id: '6B', musical: 'Bb Major', openKey: '1d', position: 5, mode: 'major', energy: 7, mood: 'Intense & Warm', color: 'var(--key-6b)', energyColor: 'var(--key-6b)', compatible: ['5B', '7B', '6A', '8B', '1B'] },
  { id: '7B', musical: 'F Major', openKey: '2d', position: 6, mode: 'major', energy: 8, mood: 'Driving & Warm', color: 'var(--key-7b)', energyColor: 'var(--key-7b)', compatible: ['6B', '8B', '7A', '9B', '2B'] },
  { id: '8B', musical: 'C Major', openKey: '3d', position: 7, mode: 'major', energy: 6, mood: 'Pure & Regal', color: 'var(--key-8b)', energyColor: 'var(--key-8b)', compatible: ['7B', '9B', '8A', '10B', '3B'] },
  { id: '9B', musical: 'G Major', openKey: '4d', position: 8, mode: 'major', energy: 7, mood: 'Lush & Optimistic', color: 'var(--key-9b)', energyColor: 'var(--key-9b)', compatible: ['8B', '10B', '9A', '11B', '4B'] },
  { id: '10B', musical: 'D Major', openKey: '5d', position: 9, mode: 'major', energy: 8, mood: 'Exotic & Bold', color: 'var(--key-10b)', energyColor: 'var(--key-10b)', compatible: ['9B', '11B', '10A', '12B', '5B'] },
  { id: '11B', musical: 'A Major', openKey: '6d', position: 10, mode: 'major', energy: 9, mood: 'Bold & Euphoric', color: 'var(--key-11b)', energyColor: 'var(--key-11b)', compatible: ['10B', '12B', '11A', '1B', '6B'] },
  { id: '12B', musical: 'E Major', openKey: '7d', position: 11, mode: 'major', energy: 5, mood: 'Warm & Uplifting', color: 'var(--key-12b)', energyColor: 'var(--key-12b)', compatible: ['11B', '1B', '12A', '2B', '7B'] }
];
