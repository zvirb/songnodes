import { describe, it, expect } from 'vitest';
import { exportM3U8, exportRekordbox, exportTidal, getMissingFieldsSummary, formatMissingFieldsSummary } from './exporters';
import type { LibraryTrack, SavedSet } from '../musicLibrary/data';

describe('Set Exporters', () => {
  const mockSet: SavedSet = {
    id: 'set-1',
    name: 'Test Set & Cool Vibes',
    shape: 'journey',
    minutes: 60,
    mix: {},
    pool: 'active',
    tidal: true,
    seed: 1,
    updated: '2026-10-26T12:00:00Z',
    created: '2026-10-26T12:00:00Z',
    tracks: [
      { id: 't1', tgt: 5 },
      { id: 't2', tgt: 6 },
      { id: 't3', tgt: 5 }
    ]
  };

  const byId = new Map<string, LibraryTrack>([
    ['t1', {
      id: 't1', a: 'Artist 1', t: 'Title 1', m: null, d: 180, bpm: 120, k: '8A', e: 5, p: 'House', rot: 1, tags: [], src: [], first: null, last: null, g: null, lbl: null, sync: null, tidal: 'tidal-1', dz: null, bp: null, chart: null, rev: false, ovr: false, local: true
    }],
    ['t2', {
      id: 't2', a: 'Artist 2 & Friends', t: 'Title <2>', m: null, d: null, bpm: null, k: null, e: 6, p: 'House', rot: 1, tags: [], src: [], first: null, last: null, g: null, lbl: null, sync: null, tidal: null, dz: null, bp: null, chart: null, rev: false, ovr: false, local: false
    }],
    ['t3', {
      id: 't3', a: 'Artist 3', t: 'Title "3"', m: null, d: 240, bpm: 125, k: '9B', e: 5, p: 'Techno', rot: 1, tags: [], src: [], first: null, last: null, g: null, lbl: null, sync: null, tidal: 'tidal-3', dz: null, bp: null, chart: null, rev: false, ovr: false, local: false
    }]
  ]);

  it('exports M3U8 correctly', () => {
    const m3u8 = exportM3U8(mockSet, byId);
    expect(m3u8).toBe([
      '#EXTM3U',
      '#EXTINF:180,Artist 1 - Title 1',
      'tracks/t1.mp3',
      '#EXTINF:-1,Artist 2 & Friends - Title <2>',
      'songnodes://track/t2',
      '#EXTINF:240,Artist 3 - Title "3"',
      'songnodes://track/t3'
    ].join('\n'));
  });

  it('exports Rekordbox XML correctly', () => {
    const xml = exportRekordbox(mockSet, byId);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<TRACK TrackID="1" Name="Title 1" Artist="Artist 1" Kind="MP3 File" TotalTime="180" AverageBpm="120" Tonality="8A"/>');
    expect(xml).toContain('<TRACK TrackID="2" Name="Title &lt;2&gt;" Artist="Artist 2 &amp; Friends" Kind="MP3 File"/>');
    expect(xml).toContain('<TRACK TrackID="3" Name="Title &quot;3&quot;" Artist="Artist 3" Kind="MP3 File" TotalTime="240" AverageBpm="125" Tonality="9B"/>');
    expect(xml).toContain('<NODE Type="1" Name="Test Set &amp; Cool Vibes" KeyType="0" Entries="3">');
  });

  it('exports TIDAL JSON correctly', () => {
    const json = exportTidal(mockSet, byId);
    expect(JSON.parse(json)).toEqual(['tidal-1', 'tidal-3']);
  });

  it('generates summary of missing fields', () => {
    const summary = getMissingFieldsSummary(mockSet, byId);
    expect(summary).toEqual({
      missingBpm: 1,
      missingKey: 1,
      missingTidal: 1,
      missingDuration: 1,
      total: 3
    });

    const lines = formatMissingFieldsSummary(summary);
    expect(lines).toContain('1 tracks have no BPM');
    expect(lines).toContain('1 tracks have no Key');
    expect(lines).toContain('1 tracks have no TIDAL id');
  });
});
