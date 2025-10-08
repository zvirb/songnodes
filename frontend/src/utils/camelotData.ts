import { CamelotKey } from '../types';

/**
 * @file Camelot Wheel Data
 * @description Contains the static data definition for the Camelot wheel,
 * including keys, musical properties, colors, and harmonic compatibilities.
 * This data is based on the industry standard for harmonic mixing.
 */

export const CAMELOT_KEYS: CamelotKey[] = [
  // Major keys (outer ring)
  { id: '1A', musical: 'C Major', openKey: '8d', position: 0, mode: 'major', energy: 6, mood: 'uplifting', color: '#3b82f6', energyColor: '#60a5fa', compatible: ['12A', '2A', '1B'] },
  { id: '2A', musical: 'G Major', openKey: '9d', position: 1, mode: 'major', energy: 8, mood: 'bright', color: '#10b981', energyColor: '#34d399', compatible: ['1A', '3A', '2B'] },
  { id: '3A', musical: 'D Major', openKey: '10d', position: 2, mode: 'major', energy: 9, mood: 'energetic', color: '#f59e0b', energyColor: '#fbbf24', compatible: ['2A', '4A', '3B'] },
  { id: '4A', musical: 'A Major', openKey: '11d', position: 3, mode: 'major', energy: 8, mood: 'triumphant', color: '#f97316', energyColor: '#fb923c', compatible: ['3A', '5A', '4B'] },
  { id: '5A', musical: 'E Major', openKey: '12d', position: 4, mode: 'major', energy: 9, mood: 'powerful', color: '#ef4444', energyColor: '#f87171', compatible: ['4A', '6A', '5B'] },
  { id: '6A', musical: 'B Major', openKey: '1d', position: 5, mode: 'major', energy: 7, mood: 'intense', color: '#ec4899', energyColor: '#f472b6', compatible: ['5A', '7A', '6B'] },
  { id: '7A', musical: 'F# Major', openKey: '2d', position: 6, mode: 'major', energy: 8, mood: 'driving', color: '#a855f7', energyColor: '#c084fc', compatible: ['6A', '8A', '7B'] },
  { id: '8A', musical: 'C# Major', openKey: '3d', position: 7, mode: 'major', energy: 6, mood: 'ethereal', color: '#8b5cf6', energyColor: '#a78bfa', compatible: ['7A', '9A', '8B'] },
  { id: '9A', musical: 'G# Major', openKey: '4d', position: 8, mode: 'major', energy: 7, mood: 'mysterious', color: '#6366f1', energyColor: '#818cf8', compatible: ['8A', '10A', '9B'] },
  { id: '10A', musical: 'D# Major', openKey: '5d', position: 9, mode: 'major', energy: 8, mood: 'exotic', color: '#06b6d4', energyColor: '#22d3ee', compatible: ['9A', '11A', '10B'] },
  { id: '11A', musical: 'A# Major', openKey: '6d', position: 10, mode: 'major', energy: 9, mood: 'bold', color: '#0891b2', energyColor: '#0ea5e9', compatible: ['10A', '12A', '11B'] },
  { id: '12A', musical: 'F Major', openKey: '7d', position: 11, mode: 'major', energy: 5, mood: 'warm', color: '#059669', energyColor: '#10b981', compatible: ['11A', '1A', '12B'] },

  // Minor keys (inner ring)
  { id: '1B', musical: 'A Minor', openKey: '8m', position: 0, mode: 'minor', energy: 4, mood: 'melancholic', color: '#374151', energyColor: '#6b7280', compatible: ['12B', '2B', '1A'] },
  { id: '2B', musical: 'E Minor', openKey: '9m', position: 1, mode: 'minor', energy: 6, mood: 'contemplative', color: '#475569', energyColor: '#64748b', compatible: ['1B', '3B', '2A'] },
  { id: '3B', musical: 'B Minor', openKey: '10m', position: 2, mode: 'minor', energy: 7, mood: 'dramatic', color: '#581c87', energyColor: '#7c3aed', compatible: ['2B', '4B', '3A'] },
  { id: '4B', musical: 'F# Minor', openKey: '11m', position: 3, mode: 'minor', energy: 6, mood: 'introspective', color: '#7c2d12', energyColor: '#dc2626', compatible: ['3B', '5B', '4A'] },
  { id: '5B', musical: 'C# Minor', openKey: '12m', position: 4, mode: 'minor', energy: 7, mood: 'passionate', color: '#92400e', energyColor: '#ea580c', compatible: ['4B', '6B', '5A'] },
  { id: '6B', musical: 'G# Minor', openKey: '1m', position: 5, mode: 'minor', energy: 5, mood: 'haunting', color: '#991b1b', energyColor: '#dc2626', compatible: ['5B', '7B', '6A'] },
  { id: '7B', musical: 'D# Minor', openKey: '2m', position: 6, mode: 'minor', energy: 6, mood: 'dark', color: '#be185d', energyColor: '#ec4899', compatible: ['6B', '8B', '7A'] },
  { id: '8B', musical: 'A# Minor', openKey: '3m', position: 7, mode: 'minor', energy: 4, mood: 'mysterious', color: '#7c3aed', energyColor: '#a855f7', compatible: ['7B', '9B', '8A'] },
  { id: '9B', musical: 'E# Minor', openKey: '4m', position: 8, mode: 'minor', energy: 5, mood: 'ethereal', color: '#4338ca', energyColor: '#6366f1', compatible: ['8B', '10B', '9A'] },
  { id: '10B', musical: 'B# Minor', openKey: '5m', position: 9, mode: 'minor', energy: 6, mood: 'sad', color: '#0e7490', energyColor: '#06b6d4', compatible: ['9B', '11B', '10A'] },
  { id: '11B', musical: 'F## Minor', openKey: '6m', position: 10, mode: 'minor', energy: 7, mood: 'somber', color: '#047857', energyColor: '#059669', compatible: ['10B', '12B', '11A'] },
  { id: '12B', musical: 'D Minor', openKey: '7m', position: 11, mode: 'minor', energy: 3, mood: 'gentle', color: '#365314', energyColor: '#65a30d', compatible: ['11B', '1B', '12A'] }
];