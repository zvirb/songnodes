"""Tempo folding/agreement and the versioned energy contract."""
import sys
import unittest
from datetime import datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.metadata import energy as e, tempo as t  # noqa: E402


class Tempo(unittest.TestCase):
    def test_fold_only_with_genre_justification(self):
        self.assertEqual(t.fold_tempo(64, ['House']), (128.0, 'folded'))
        self.assertEqual(t.fold_tempo(256, ['Tech House']), (128.0, 'folded'))
        self.assertEqual(t.fold_tempo(87, ['Drum and Bass']), (174.0, 'folded'))
        self.assertEqual(t.fold_tempo(174, ['Drum & Bass']), (174.0, 'in_range'))
        self.assertEqual(t.fold_tempo(128, ['Drum and Bass']), (128.0, 'out_of_range'))

    def test_unknown_genre_and_unknown_bpm_are_not_guessed(self):
        self.assertEqual(t.fold_tempo(64, None), (64.0, 'unknown_genre'))
        self.assertEqual(t.fold_tempo(64, ['Polka']), (64.0, 'unknown_genre'))
        for bad in (0, -5, None, '', 'abc', True, float('nan')):
            self.assertEqual(t.fold_tempo(bad, ['House']), (None, 'unknown'), bad)

    def test_multiple_genres_with_conflicting_octaves_are_ambiguous(self):
        self.assertEqual(t.fold_tempo(87, ['House', 'Drum and Bass']), (87.0, 'ambiguous'))
        self.assertEqual(t.fold_tempo(128, ['House', 'Drum and Bass']), (128.0, 'in_range'))
        self.assertEqual(t.fold_tempo(64, ['House', 'Techno']), (128.0, 'folded'), 'overlapping ranges form one family')

    def test_longest_keyword_wins(self):
        self.assertEqual(t.genre_range('Tech House'), (120.0, 132.0))
        self.assertEqual(t.genre_range('Progressive House'), (120.0, 132.0))

    def test_agreement(self):
        self.assertEqual(t.tempo_agreement(128, 128.4), 'exact')
        self.assertEqual(t.tempo_agreement(64, 128), 'octave')
        self.assertEqual(t.tempo_agreement(174, 87), 'octave')
        self.assertEqual(t.tempo_agreement(128, 140), 'none')
        self.assertIsNone(t.tempo_agreement(0, 128), 'zero is unknown, not a tempo')
        self.assertIsNone(t.tempo_agreement(None, 128))


class EnergyContract(unittest.TestCase):
    def test_bands_cover_the_scale_without_gaps_or_overlap(self):
        self.assertEqual([b.key for b in e.BANDS], ['warm', 'building', 'peak'])
        for left, right in zip(e.BANDS, e.BANDS[1:]):
            self.assertEqual(right.low - left.high, e.PRECISION)
        for tenth in range(10, 101):
            value = Decimal(tenth) / 10
            self.assertIsNotNone(e.classify_band(value, True), value)
        self.assertEqual([e.classify_band(Decimal(v), True) for v in ('3.9', '4.0', '6.9', '7.0')],
                         ['warm', 'building', 'building', 'peak'])

    def test_uncalibrated_unknown_and_out_of_range_get_no_band(self):
        self.assertIsNone(e.classify_band(Decimal('5'), False))
        self.assertIsNone(e.classify_band(None, True))
        self.assertIsNone(e.classify_band(Decimal('0.5'), True))
        self.assertIsNone(e.classify_band(Decimal('10.5'), True))

    def test_conversion_and_rounding(self):
        self.assertEqual(e.convert(0, '0-1'), Decimal('1.0'))
        self.assertEqual(e.convert(1, '0-1'), Decimal('10.0'))
        self.assertEqual(e.convert(0.5, '0-1'), Decimal('5.5'))
        self.assertEqual(e.convert(50, '0-100'), Decimal('5.5'))
        self.assertEqual(e.convert(7.26, '1-10'), Decimal('7.3'))
        for bad in (None, True, 'x', 1.5, -0.1):
            self.assertIsNone(e.convert(bad, '0-1'), bad)
        self.assertIsNone(e.convert(5, 'nonsense'))

    def test_legacy_reading_keeps_raw_value_and_stays_uncalibrated(self):
        r = e.legacy_reading(0.8)
        self.assertEqual((r.value, r.raw_value, r.raw_scale, r.calibrated, r.contract_version),
                         (Decimal('8.2'), Decimal('0.8'), '0-1', False, 'energy-1'))
        self.assertEqual(e.reconcile([r]).band, None, 'legacy values never receive a band')
        self.assertEqual(e.legacy_reading(0).value, Decimal('1.0'), 'a real zero converts to the scale minimum')
        self.assertIsNone(e.legacy_reading(None).value)

    def test_reconcile_prefers_manual_then_calibrated_then_provider_then_legacy(self):
        old, new = datetime(2026, 1, 1), datetime(2026, 6, 1)
        legacy = e.legacy_reading(0.2)
        provider = e.reading(9, '1-10', 'provider', 'provider-x')
        extractor = e.reading(4, '1-10', 'calibrated_extractor', 'model', confidence=0.9)
        manual_old = e.reading(8.5, '1-10', 'manual_rating', 'library', measured_at=old)
        manual_new = e.reading(8, '1-10', 'manual_rating', 'library', measured_at=new)
        self.assertEqual(e.reconcile([legacy, provider]).chosen, provider)
        self.assertEqual(e.reconcile([legacy, provider, extractor]).chosen, extractor)
        result = e.reconcile([extractor, manual_old, provider, manual_new])
        self.assertEqual((result.chosen, result.band), (manual_new, 'peak'))
        self.assertIn(extractor, result.conflicts)
        self.assertNotIn(manual_old, result.conflicts, 'within 1.0 of the chosen value is not a conflict')

    def test_missing_energy_stays_unknown(self):
        self.assertEqual(e.reconcile([]).chosen, None)
        self.assertEqual(e.reconcile([e.legacy_reading(None)]).band, None)

    def test_unknown_source_is_rejected(self):
        with self.assertRaises(ValueError):
            e.reading(5, '1-10', 'guess', 'x')

    def test_summary_is_versioned_and_marked_provisional(self):
        s = e.contract_summary()
        self.assertEqual((s['version'], s['provisional'], len(s['bands'])), ('energy-1', True, 3))


if __name__ == '__main__':
    unittest.main()
