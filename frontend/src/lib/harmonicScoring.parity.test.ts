/** @vitest-environment jsdom */
/**
 * Parity (spec M6-F2, docs/specs/HARMONIC_SCORING.md section 4): the design-system helpers the frontend shows
 * (SN.compat, SN.bpmStep, SN.energyStep, SN.energyMove) give the same verdict as the Python classifier
 * (services/common/metadata/transition_scoring.py) for every row of the shared fixture both are tested against.
 * No expected differences: design system 1.8.0 carries every owner answer (Q-E1..Q-E3, Q-B1, Q-B2).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SN } from './songnodes';

type Side = { key: string | null; bpm: number | null; energy: number | null };
type Example = {
  row: number;
  from: Side;
  to: Side;
  expect: {
    key_level: string; key_label: string;
    bpm_relation: string | null; bpm_gap: number | null; bpm_level: string; bpm_label: string;
    energy_move: string;
  };
};

const FIXTURE = resolve(__dirname, '../../../tests/fixtures/harmonic_scoring/examples.json');
const fixture: { scoring_version: string; examples: Example[] } = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const rows = fixture.examples;

describe('harmonic scoring parity with the shared fixture', () => {
  it('reads the harmonic-1 fixture with all 24 worked examples', () => {
    expect(fixture.scoring_version).toBe('harmonic-1');
    expect(rows.map((r) => r.row)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  describe.each(rows)('row $row', (r) => {
    it('key verdict matches SN.compat', () => {
      expect(SN.compat(r.from.key, r.to.key)).toEqual({ level: r.expect.key_level, label: r.expect.key_label });
    });

    it('tempo verdict matches SN.bpmStep', () => {
      expect(SN.bpmStep(r.from.bpm, r.to.bpm)).toEqual({
        level: r.expect.bpm_level, label: r.expect.bpm_label, relation: r.expect.bpm_relation, gap: r.expect.bpm_gap,
      });
    });

    it('energy move matches SN.energyStep and SN.energyMove', () => {
      expect(SN.energyStep(r.from.energy, r.to.energy).move).toBe(r.expect.energy_move);
      const stored = SN.energyMove(r.expect.energy_move);
      expect(stored.move).toBe(r.expect.energy_move);
      expect(stored.level === 'unknown').toBe(r.expect.energy_move === 'unknown');
    });
  });
});
