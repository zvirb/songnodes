"""Golden tests for the `harmonic-1` transition classifier (docs/specs/HARMONIC_SCORING.md sections 2-3)."""
import json
import math
import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.metadata import transition_scoring as ts  # noqa: E402

FIXTURE = Path(__file__).resolve().parents[3] / 'tests' / 'fixtures' / 'harmonic_scoring' / 'examples.json'
EXAMPLES = json.loads(FIXTURE.read_text(encoding='utf-8'))['examples']


def cost_of(from_track, to_track, n):
    fields = ts.score_transition(from_track, to_track, n)
    return ts.path_cost(ts.compat_score(fields['key_score'], fields['bpm_score']), n)


class WorkedExamples(unittest.TestCase):
    def test_fixture_holds_every_section_3_row(self):
        self.assertEqual([e['row'] for e in EXAMPLES], list(range(1, 25)))

    def test_every_worked_example(self):
        for ex in EXAMPLES:
            with self.subTest(row=ex['row']):
                got = ts.score_transition(ex['from'], ex['to'], ex['occurrence_count'])
                want = ex['expect']
                for field in ('key_relation', 'key_level', 'key_label', 'bpm_relation', 'bpm_gap', 'bpm_level',
                              'bpm_label', 'energy_move', 'display_score', 'compat_coverage'):
                    self.assertEqual(got[field], want[field], field)
                delta = got['energy_delta']
                self.assertEqual(None if delta is None else float(delta), want['energy_delta'])
                self.assertEqual(got['scoring_version'], 'harmonic-1')
                self.assertEqual(got['move_version'], 'energy-move-1')
                cost = cost_of(ex['from'], ex['to'], ex['occurrence_count'])
                self.assertAlmostEqual(cost, want['cost'], delta=0.0005)


class KeyVerdict(unittest.TestCase):
    def test_all_576_pairs_follow_the_same_letter_table(self):
        codes = [f'{n}{letter}' for n in range(1, 13) for letter in 'AB']
        for a in codes:
            for b in codes:
                v = ts.key_verdict(a, b)
                d = (int(b[:-1]) - int(a[:-1])) % 12
                if a[-1] == b[-1]:
                    want = {0: 'perfect', 1: 'compatible', 11: 'compatible', 2: 'possible', 10: 'possible',
                            7: 'possible'}.get(d, 'clash')
                else:
                    want = 'perfect' if d == 0 else 'clash'
                self.assertEqual(v.level, want, (a, b))
                self.assertEqual(v.score, ts.LEVEL_SCORE[want])

    def test_key_names_parse_through_to_camelot(self):
        self.assertEqual(ts.key_verdict('A minor', 'C major').relation, 'relative')
        self.assertEqual(ts.key_verdict('Am', 'Em').relation, 'plus_one')

    def test_unknown_key_is_never_a_clash(self):
        for a, b in ((None, '8A'), ('8A', ''), ('H minor', '8A')):
            v = ts.key_verdict(a, b)
            self.assertEqual((v.level, v.label, v.score), ('unknown', 'key ?', None))

    def test_direction_matters(self):
        self.assertEqual(ts.key_verdict('6A', '1A').relation, 'plus_seven')
        self.assertEqual(ts.key_verdict('1A', '6A').level, 'clash')


class BpmVerdict(unittest.TestCase):
    def test_thresholds(self):
        for gap, level in ((0, 'perfect'), (2, 'perfect'), (3, 'compatible'), (4, 'compatible'),
                           (5, 'possible'), (8, 'possible'), (9, 'clash')):
            self.assertEqual(ts.bpm_verdict(120, 120 + gap).level, level, gap)

    def test_rounding_is_symmetric(self):
        self.assertEqual(ts.bpm_verdict(123, 125.5).gap, 3)
        self.assertEqual(ts.bpm_verdict(125.5, 123).gap, 3)
        self.assertEqual(ts.bpm_verdict(125.5, 123).label, '−3 BPM')

    def test_octave_is_capped_at_compatible(self):
        self.assertEqual(ts.bpm_verdict(87, 174).level, 'compatible')
        self.assertEqual(ts.bpm_verdict(87, 174).label, 'double time')
        v = ts.bpm_verdict(140, 75)  # 2 x 75 = 150: gap 10, beyond 8, stays direct
        self.assertEqual((v.relation, v.level), ('direct', 'clash'))
        v = ts.bpm_verdict(128, 67)  # half time gap 6: possible, not raised
        self.assertEqual((v.relation, v.gap, v.level), ('half_time', 6, 'possible'))

    def test_unknown_bpm(self):
        for a, b in ((None, 128), (0, 128), (128, float('nan')), (128, float('inf')), (128, 'fast')):
            v = ts.bpm_verdict(a, b)
            self.assertEqual((v.level, v.label, v.score, v.gap), ('unknown', 'BPM ?', None, None))


class EnergyMove(unittest.TestCase):
    def test_labels_by_rounded_step(self):
        cases = {0: 'hold', 1: 'step_up', 2: 'lift', 3: 'lift', 4: 'jarring', 9: 'jarring', -1: 'step_down',
                 -2: 'reset_drop', -4: 'reset_drop', -5: 'jarring', -9: 'jarring'}
        for step, move in cases.items():
            start = 1 if step >= 0 else 10
            self.assertEqual(ts.energy_move(start, start + step).move, move, step)

    def test_fractions_round_half_away_from_zero(self):
        self.assertEqual(ts.energy_move(6.0, 5.5).step, -1)
        self.assertEqual(ts.energy_move(6.4, 7.9).delta, Decimal('1.5'))
        self.assertEqual(ts.energy_move(6.0, 6.4).move, 'hold')

    def test_unknown_or_off_scale_energy(self):
        for a, b in ((None, 5), (5, 0), (5, 11), (5, 'loud'), (0.7, 5)):
            self.assertEqual(ts.energy_move(a, b), ts.EnergyMove('unknown', None, None), (a, b))


class CompatAndCost(unittest.TestCase):
    def test_geometric_mean(self):
        self.assertAlmostEqual(ts.compat_score(1.0, 0.8).score, 0.8 ** 0.4)
        self.assertEqual(ts.compat_score(0.0, 1.0).score, 0.0)
        partial = ts.compat_score(None, 0.8)
        self.assertEqual((partial.score, partial.coverage, partial.partial), (None, 0.4, 0.8))
        self.assertEqual(ts.compat_score(None, None), ts.Compat(None, 0.0, None))

    def test_display_rounds_half_up(self):
        self.assertEqual(ts.display_score(ts.Compat(0.875, 1.0, 0.875)), 88)
        self.assertEqual(ts.display_score(ts.Compat(0.9146, 1.0, 0.9146)), 91)
        self.assertIsNone(ts.display_score(ts.Compat(None, 0.6, 1.0)))

    def test_cost_properties(self):
        levels = [None, 0.0, 0.5, 0.8, 1.0]
        for key in levels:
            for bpm in levels:
                compat = ts.compat_score(key, bpm)
                costs = [ts.path_cost(compat, n) for n in (0, 1, 2, 5, 50)]
                self.assertTrue(all(c > 0 for c in costs))
                self.assertEqual(costs, sorted(costs, reverse=True))
                self.assertGreater(costs[0], costs[1])  # inferred costs more than observed once
                self.assertTrue(all(a > b for a, b in zip(costs[1:], costs[2:])))
        for n in (0, 1, 10):
            scores = [ts.path_cost(ts.Compat(s, 1.0, s), n) for s in (0.0, 0.3, 0.66, 0.91, 1.0)]
            self.assertTrue(all(a > b for a, b in zip(scores, scores[1:])))
            perfect = ts.path_cost(ts.compat_score(1.0, 1.0), n)
            self.assertGreater(ts.path_cost(ts.compat_score(None, 1.0), n), perfect)
            self.assertGreater(ts.path_cost(ts.compat_score(1.0, None), n), perfect)
            self.assertGreater(ts.path_cost(ts.compat_score(None, None), n), perfect)

    def test_cost_formula(self):
        self.assertAlmostEqual(ts.path_cost(ts.Compat(1.0, 1.0, 1.0), 3), 0.05 + 1 / (1 + math.log2(4)))
        self.assertAlmostEqual(ts.path_cost(ts.Compat(None, 0.0, None), 0), 0.05 + 0.5 + 1.0)

    def test_each_direction_costed_separately(self):
        a, b = {'key': '6A', 'bpm': 124, 'energy': 6}, {'key': '1A', 'bpm': 124, 'energy': 6}
        self.assertLess(cost_of(a, b, 1), cost_of(b, a, 1))


if __name__ == '__main__':
    unittest.main()
