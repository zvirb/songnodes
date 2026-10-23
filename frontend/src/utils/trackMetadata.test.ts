import { describe, expect, it } from 'vitest';
import { formatStoredEnergy, graphNodeFromApi, routeTracksFromNodes, trackFromNode } from './trackMetadata';

const measured = {
  id: 'song_fixture', position: { x: 0, y: 0 }, metadata: {
    title: 'Measured', artist: 'Fixture', bpm: 240, key: 'Am', camelot_key: '8A',
    energy: 0, energy_scale: 'legacy_0_1', danceability: 0, valence: 0,
    duration_ms: 210500, tidal_id: 123, deezer_id: '456',
    label: 'Fixture - Measured', record_label: 'Example Records', mix_name: 'Extended',
  },
};

describe('stored track metadata transport', () => {
  it('preserves measurements, identifiers, zeroes and units across initial loads and remapping', () => {
    const first = graphNodeFromApi(measured);
    expect(first.x).toBe(0);
    expect(first.y).toBe(0);
    const track = trackFromNode(graphNodeFromApi(first));
    expect(track).toMatchObject({ bpm: 240, key: 'Am', camelot_key: '8A', energy: 0,
      energy_scale: 'legacy_0_1', danceability: 0, valence: 0, duration: 210.5,
      duration_ms: 210500, tidal_id: '123', deezer_id: '456',
      record_label: 'Example Records', mix_name: 'Extended' });
  });
  it('does not invent missing facts or mistake graph display labels for record labels', () => {
    const track = trackFromNode({ id: 'unknown', metadata: { label: 'Display label' } });
    for (const field of ['bpm', 'key', 'energy', 'duration', 'record_label']) {
      expect(track[field as keyof typeof track]).toBeUndefined();
    }
  });
  it('clears stale cached measurements when refreshed metadata explicitly contains null', () => {
    const track = trackFromNode({ id: 'same', metadata: { bpm: null, key: null, energy: null, duration_ms: null },
      track: { bpm: 128, key: 'Am', energy: 0.7, duration: 180 } });
    expect(track.bpm).toBeUndefined();
    expect(track.key).toBeUndefined();
    expect(track.energy).toBeUndefined();
    expect(track.duration).toBeUndefined();
  });
  it('rejects invalid numeric values while retaining fractional energy without calibration', () => {
    expect(trackFromNode({ bpm: true, duration_ms: 'NaN', energy: '0.72' })).toMatchObject({ energy: 0.72 });
    expect(trackFromNode({ bpm: true }).bpm).toBeUndefined();
    expect(formatStoredEnergy(0)).toBe('0 (scale not recorded)');
    expect(formatStoredEnergy(undefined)).toBe('Unknown');
    expect(formatStoredEnergy(7, 'dj_1_10')).toBe('7 (dj_1_10)');
  });
  it('sends measured durations and zero energy to routing and rejects unknown durations', () => {
    expect(routeTracksFromNodes([measured])[0]).toMatchObject({ duration_ms: 210500, energy: 0, camelot_key: '8A' });
    expect(() => routeTracksFromNodes([{ id: 'unknown', title: 'No duration' }])).toThrow('duration is unknown for No duration');
  });
});
