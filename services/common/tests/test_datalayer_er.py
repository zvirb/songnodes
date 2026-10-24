"""Entity-resolution scoring and the labelled-pair evaluation harness (pure; no database)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.datalayer import er  # noqa: E402


def t(artist, title, isrc=None, duration=None):
    return {'artist_name': artist, 'track_title': title, 'isrc': isrc, 'duration_ms': duration}


class TrackScoring(unittest.TestCase):
    def test_equal_isrc_is_an_automatic_match_even_when_titles_are_styled_differently(self):
        d = er.score_tracks(t('deadmau5', 'Strobe', 'QM6MZ2651268', 600000), t('deadmau5', 'STROBE', 'qm6mz2651268', 600500))
        self.assertEqual((d.decision, d.score, d.reasons), ('auto_match', 1.0, ('isrc_equal',)))

    def test_text_match_needs_a_duration_anchor_to_be_automatic(self):
        a, b = t('Eric Prydz', 'Opus', None, 540000), t('Eric Prydz', 'Opus', None, 541000)
        self.assertEqual(er.score_tracks(a, b).decision, 'auto_match')
        unknown = er.score_tracks(t('Eric Prydz', 'Opus'), t('Eric Prydz', 'Opus', None, 541000))
        self.assertEqual((unknown.decision, unknown.reasons), ('review', ('no_duration_anchor',)))
        far = er.score_tracks(a, t('Eric Prydz', 'Opus', None, 200000))
        self.assertEqual((far.decision, far.reasons), ('reject', ('duration_beyond_guard',)))

    def test_versions_are_distinct_recordings(self):
        for left, right in (('Strobe (Radio Edit)', 'Strobe (Extended Mix)'), ('Opus', 'Opus (Eric Prydz Remix)'),
                            ('Song (Club Edit)', 'Song (Radio Edit)')):
            d = er.score_tracks(t('A', left, None, 200000), t('A', right, None, 200000))
            self.assertEqual((d.decision, d.reasons), ('reject', ('version_differs',)), (left, right))
        self.assertEqual(er.score_tracks(t('A', 'Song (Original Mix)', None, 1000), t('A', 'Song', None, 1000)).decision, 'auto_match',
                         'original mix is the default version')

    def test_conflicting_isrc_with_identical_text_goes_to_review_not_auto(self):
        d = er.score_tracks(t('A', 'Song', 'USAAA0000001', 200000), t('A', 'Song', 'USAAA0000002', 200100))
        self.assertEqual(d.decision, 'review')
        self.assertIn('isrc_conflict', d.reasons)

    def test_different_songs_and_placeholder_artists_are_rejected(self):
        self.assertEqual(er.score_tracks(t('A', 'Opus', None, 1000), t('A', 'Call on Me', None, 1000)).decision, 'reject')
        self.assertEqual(er.score_tracks(t('Unknown Artist', 'X'), t('Unknown Artist', 'X')).reasons, ('placeholder_artist',))

    def test_featured_artist_decoration_does_not_change_identity(self):
        d = er.score_tracks(t('Avicii', 'Wake Me Up', None, 247000), t('Avicii', 'Wake Me Up (feat. Aloe Blacc)', None, 247500))
        self.assertEqual(d.decision, 'auto_match')

    def test_thresholds_are_configurable(self):
        a, b = t('Carl Cox', 'Phoebus Apollo', None, 400000), t('Carl Cox', 'Phoebus Apolo', None, 400100)
        self.assertEqual(er.score_tracks(a, b).decision, 'review')
        self.assertEqual(er.score_tracks(a, b, er.Thresholds(auto=0.9, review=0.8)).decision, 'auto_match')
        self.assertEqual(er.score_tracks(a, b, er.Thresholds(auto=0.999, review=0.999)).decision, 'reject')


class ArtistScoring(unittest.TestCase):
    def test_variants_only_reach_review(self):
        d = er.score_artists('Carl Cox (UK)', 'carl cox')
        self.assertEqual((d.decision, d.reasons), ('review', ('same_name_after_normalising',)))
        self.assertEqual(er.score_artists('Eric Prydz', 'Pryda').decision, 'reject')
        self.assertEqual(er.score_artists('Unknown', 'Unknown').decision, 'reject')
        self.assertEqual(er.score_artists('Dead Mau5', 'Deadmau5').decision, 'review')


class Evaluation(unittest.TestCase):
    PAIRS = [
        (t('A', 'Strobe', 'QM6MZ2651268', 600000), t('A', 'Strobe', 'QM6MZ2651268', 600200), True),
        (t('A', 'Opus', None, 540000), t('A', 'Opus', None, 540300), True),
        (t('A', 'Opus (Original Mix)', None, 540000), t('A', 'Opus', None, 540100), True),
        (t('A', 'Wake Me Up', None, 247000), t('A', 'Wake Me Up (feat. Aloe Blacc)', None, 247200), True),
        (t('A', 'Phoebus Apollo', None, 400000), t('A', 'Phoebus Apolo', None, 400100), True),    # typo -> review, not auto
        (t('A', 'Opus', None, 540000), t('A', 'Opus (Eric Prydz Remix)', None, 540000), False),
        (t('A', 'Strobe (Radio Edit)', None, 200000), t('A', 'Strobe (Extended Mix)', None, 200000), False),
        (t('A', 'Song', 'USAAA0000001', 200000), t('A', 'Song', 'USAAA0000002', 200000), False),  # two recordings of one title
        (t('A', 'Opus', None, 540000), t('A', 'Call on Me', None, 540000), False),
        (t('A', 'Song', None, 200000), t('A', 'Song', None, 300000), False),
    ]

    def test_report_separates_automatic_from_review_and_lists_false_merges(self):
        report = er.evaluate(self.PAIRS)
        self.assertEqual((report['auto_tp'], report['auto_fp'], report['positives'], report['negatives']), (4, 0, 5, 5), report)
        self.assertEqual((report['auto_precision'], report['review_tp'], report['reject_fn']), (1.0, 1, 0))
        self.assertEqual(report['candidate_recall'], 1.0)
        self.assertEqual(report['false_merges'], [])

    def test_a_false_merge_is_reported_and_blocks_the_precision_gate(self):
        bad = self.PAIRS + [(t('A', 'Intro', None, 100000), t('A', 'Intro', None, 100200), False)]   # same text, different songs
        report = er.evaluate(bad)
        self.assertEqual((report['auto_fp'], report['auto_precision']), (1, 0.8))
        self.assertEqual(report['false_merges'][0]['a'], 'Intro')
        self.assertFalse(er.meets_precision(report, 0.99, minimum_pairs=2))

    def test_precision_gate_needs_enough_labelled_evidence(self):
        report = er.evaluate(self.PAIRS)
        self.assertFalse(er.meets_precision(report), 'only 4 automatic judgements: not enough to enable auto-merge')
        self.assertTrue(er.meets_precision(report, 0.99, minimum_pairs=4))


if __name__ == '__main__':
    unittest.main()
