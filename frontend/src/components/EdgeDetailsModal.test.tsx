/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { EdgeDetailsModal, type EdgeScoring } from './EdgeDetailsModal';
import type { GraphEdge } from '../types';

const nodes = [
  { id: 'song_a', label: 'A', track: { name: 'Strobe', artist: 'Deadmau5', bpm: 128, camelotKey: '8A', energy: 6 } },
  { id: 'song_b', label: 'B', track: { name: 'Opus', artist: 'Eric Prydz', bpm: 131, camelotKey: '9A', energy: 8.5 } },
];

vi.mock('../store/useStore', () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({ graphData: { nodes, edges: [] } }),
}));

const edge: GraphEdge = { id: 'song_a__song_b', source: 'song_a', target: 'song_b', weight: 4, type: 'adjacency' };

const scored: EdgeScoring = {
  key_relation: 'plus_one', key_level: 'compatible', bpm_relation: 'direct', bpm_gap: 3, bpm_level: 'compatible',
  energy_move: 'lift', scored_at: '2026-11-02T01:00:00+00:00',
};
const unscored: EdgeScoring = {
  key_relation: null, key_level: null, bpm_relation: null, bpm_gap: null, bpm_level: null, energy_move: null, scored_at: null,
};

const answer = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

const badge = (term: string): HTMLElement => {
  const value = screen.getByText(term, { selector: 'dt' }).parentElement?.querySelector<HTMLElement>('dd > span');
  if (!value) throw new Error(`No value for ${term}`);
  return value;
};

describe('EdgeDetailsModal stored scoring', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('shows the stored verdicts, with the energy move worded by the design system', async () => {
    const fetchSpy = answer({ edges: [{ source: 'song_a', target: 'song_b', scoring: scored }] });
    render(<EdgeDetailsModal edge={edge} onClose={() => {}} />);
    expect(await screen.findByText('push')).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledWith('/api/graph/edges?node_ids=song_a,song_b&limit=2', expect.anything());
    expect(badge('Key').dataset.compat).toBe('compatible');
    expect(badge('Key').textContent).toBe('+1 key');
    expect(badge('BPM').textContent).toBe('+3 BPM');
    expect(badge('Energy').dataset.compat).toBe('clash');
    expect(screen.queryByText('lift')).toBeNull();
  });

  it('keeps the stored level when the tracks no longer give it, without inventing words', async () => {
    answer({ edges: [{ source: 'song_a', target: 'song_b', scoring: { ...scored, key_level: 'clash', energy_move: 'step_down' } }] });
    render(<EdgeDetailsModal edge={edge} onClose={() => {}} />);
    expect(await screen.findByText('step down')).toBeTruthy();
    expect(badge('Key').dataset.compat).toBe('clash');
    expect(badge('Key').textContent).toBe('clash');
  });

  it('shows unknown inputs as unknown, never as a clash', async () => {
    answer({ edges: [{ source: 'song_a', target: 'song_b', scoring: { ...scored, key_level: 'unknown', bpm_level: 'unknown', energy_move: 'unknown' } }] });
    render(<EdgeDetailsModal edge={edge} onClose={() => {}} />);
    expect(await screen.findByText('key ?')).toBeTruthy();
    expect(screen.getByText('BPM ?')).toBeTruthy();
    expect(badge('Energy').dataset.compat).toBe('unknown');
    expect(badge('Energy').textContent).toBe('energy ?');
  });

  it('shows en dashes for an unscored edge', async () => {
    answer({ edges: [{ source: 'song_a', target: 'song_b', scoring: unscored }] });
    render(<EdgeDetailsModal edge={edge} onClose={() => {}} />);
    expect(await screen.findByText('Not scored yet.')).toBeTruthy();
    for (const term of ['Key', 'BPM', 'Energy']) expect(badge(term).className).toBe('sn-none');
    expect(document.querySelector('.sn-compatibility-badge')).toBeNull();
  });

  it('says when the link is not an observed transition', async () => {
    answer({ edges: [{ source: 'song_b', target: 'song_a', scoring: scored }] });
    render(<EdgeDetailsModal edge={edge} onClose={() => {}} />);
    expect(await screen.findByText('No stored scoring: this link is not an observed transition.')).toBeTruthy();
  });

  it('names the cause when the graph API fails', async () => {
    answer({}, 503);
    render(<EdgeDetailsModal edge={edge} onClose={() => {}} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Stored scoring did not load: The graph API answered 503.');
  });
});
