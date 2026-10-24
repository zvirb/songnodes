"""Consensus, version-aware matching and per-field resolution."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.metadata import consensus as cs, field_resolution as fr, matching as m  # noqa: E402

E = cs.Evidence


class BpmConsensus(unittest.TestCase):
    def test_three_independent_sources_agree_after_justified_fold(self):
        r = cs.bpm_consensus([E('bpm', 128, 'deezer'), E('bpm', 128.4, 'getsongbpm'), E('bpm', 64, 'tidal')],
                             genres=['House'])
        self.assertEqual((r.status, r.review), ('consensus', False))
        self.assertEqual(r.value, 128.0, 'the chosen (most trusted) member supplies the value')
        self.assertEqual(set(r.supporting_groups), {'deezer', 'getsongbpm', 'tidal'})
        self.assertEqual(r.chosen.source, 'tidal', 'trust order breaks the tie inside the winning cluster')

    def test_octave_disagreement_without_genre_is_near_not_folded(self):
        r = cs.bpm_consensus([E('bpm', 128, 'deezer'), E('bpm', 64, 'getsongbpm')])
        self.assertEqual((r.status, r.near_groups, r.review), ('unresolved', ('getsongbpm',), True))
        self.assertEqual(r.value, 128, 'trust order picks deezer over getsongbpm')
        self.assertFalse(r.folded)

    def test_same_upstream_is_not_counted_twice(self):
        r = cs.bpm_consensus([E('bpm', 128, 'deezer'), E('bpm', 128, 'proxy-of-deezer', independent_group='deezer')])
        self.assertEqual((r.status, r.supporting_groups), ('single_source', ('deezer',)))

    def test_conflict_is_preserved_and_flagged(self):
        r = cs.bpm_consensus([E('bpm', 128, 'tidal'), E('bpm', 140, 'deezer')])
        self.assertEqual((r.status, r.value, r.review), ('unresolved', 128, True))
        self.assertEqual([e.source for e in r.conflicting], ['deezer'])

    def test_agreement_beats_trust(self):
        r = cs.bpm_consensus([E('bpm', 126, 'beatport'), E('bpm', 128, 'deezer'), E('bpm', 128.2, 'getsongbpm')])
        self.assertEqual((r.status, r.value), ('consensus', 128))
        self.assertEqual([e.source for e in r.conflicting], ['beatport'])

    def test_zero_and_missing_bpm_are_unknown(self):
        self.assertEqual(cs.bpm_consensus([E('bpm', 0, 'deezer'), E('bpm', None, 'tidal')]).status, 'unknown')
        r = cs.bpm_consensus([E('bpm', 0, 'deezer'), E('bpm', 124, 'tidal')])
        self.assertEqual((r.status, r.value), ('single_source', 124))

    def test_manual_correction_is_final_and_does_not_raise_review(self):
        r = cs.bpm_consensus([E('bpm', 128, 'deezer'), E('bpm', 128.3, 'getsongbpm'), E('bpm', 126, 'manual')])
        self.assertEqual((r.status, r.value, r.review, r.supporting_groups), ('manual', 126.0, False, ('manual',)))
        self.assertEqual({e.source for e in r.conflicting}, {'deezer', 'getsongbpm'}, 'provider readings stay visible')

    def test_fold_is_recorded(self):
        r = cs.bpm_consensus([E('bpm', 87, 'tidal')], genres=['Drum and Bass'])
        self.assertEqual((r.value, r.folded, r.fold_status), (174.0, True, 'folded'))


class KeyConsensus(unittest.TestCase):
    def test_exact_agreement_across_notations_with_near_dissent(self):
        r = cs.key_consensus([E('key', 'A minor', 'tidal'), E('key', '8A', 'getsongbpm'), E('key', '9A', 'deezer')])
        self.assertEqual((r.status, r.value, r.near_groups, r.review), ('consensus', '8A', ('deezer',), True))

    def test_relative_major_is_near_and_unknown_is_dropped(self):
        r = cs.key_consensus([E('key', '8A', 'tidal'), E('key', 'C major', 'deezer'), E('key', 'nonsense', 'beatport')])
        self.assertEqual((r.status, r.value, r.near_groups), ('unresolved', '8A', ('deezer',)))

    def test_wheel_neighbours(self):
        self.assertEqual(cs.key_agreement('12A', '1A'), 'near')
        self.assertEqual(cs.key_agreement('8A', '8B'), 'near')
        self.assertIsNone(cs.key_agreement('8A', '10A'))
        self.assertEqual(cs.key_agreement('5B', '5B'), 'exact')

    def test_no_evidence_is_unknown(self):
        self.assertEqual(cs.key_consensus([]).status, 'unknown')

    def test_manual_key_wins(self):
        r = cs.key_consensus([E('key', '8A', 'tidal'), E('key', '8A', 'deezer'), E('key', '9A', 'manual')])
        self.assertEqual((r.status, r.value, r.review), ('manual', '9A', False))


class Matching(unittest.TestCase):
    def test_title_parsing_keeps_versions_features_and_unicode(self):
        p = m.parse_title('Strobe (Extended Mix)')
        self.assertEqual((p.base, p.versions), ('strobe', ('extended mix',)))
        self.assertEqual(m.parse_title('Strobe - Radio Edit').versions, ('radio edit',))
        self.assertEqual(m.parse_title('Strobe (Original Mix)').versions, (), 'original mix is the default version')
        self.assertEqual(m.parse_title('Sandstorm (feat. Darude)').featured, ('darude',))
        self.assertEqual(m.parse_title('Dream (Something Real)').versions, (), 'non-version brackets stay in the title')
        self.assertEqual(m.normalize_text('Beyoncé – Déjà Vu'), 'beyoncé déjà vu',
                         'accents are identity, not noise')
        self.assertEqual(m.parse_title('Måneskin Beggin').base, 'måneskin beggin')

    def test_artist_with_x_is_not_split(self):
        self.assertEqual(m.artist_key('Alex Xavier'), 'alex xavier')
        self.assertEqual(m.artist_key('Deadmau5 & Kaskade'), 'deadmau5 kaskade')

    def test_isrc_match_within_duration_guard(self):
        t = m.Track('Strobe', 'deadmau5', 'QM6MZ2651268', 304_000)
        d = m.match_candidate(t, m.Track('Strobe (Extended Mix)', 'deadmau5', 'qm6mz2651268', 303_000, 'tidal:1'))
        self.assertEqual((d.outcome, d.score), ('match', 1.0))

    def test_isrc_equal_but_duration_far_is_review_not_silent_accept(self):
        t = m.Track('Strobe', 'deadmau5', 'QM6MZ2651268', 304_000)
        d = m.match_candidate(t, m.Track('Strobe', 'deadmau5', 'QM6MZ2651268', 202_000))
        self.assertEqual((d.outcome, d.reasons), ('review', ('isrc_equal', 'duration_beyond_guard')))

    def test_radio_edit_is_never_substituted_for_extended_mix(self):
        t = m.Track('Strobe (Extended Mix)', 'deadmau5', None, 637_000)
        radio = m.Track('Strobe (Radio Edit)', 'deadmau5', None, 202_000, 'r')
        self.assertEqual(m.match_candidate(t, radio).outcome, 'reject')
        same_title = m.Track('Strobe (Extended Mix)', 'deadmau5', None, 202_000, 'x')
        self.assertEqual(m.match_candidate(t, same_title).reasons[-1], 'duration_beyond_guard')

    def test_fuzzy_match_needs_known_durations_else_review(self):
        t = m.Track('Opus', 'Eric Prydz', None, 540_000)
        self.assertEqual(m.match_candidate(t, m.Track('Opus', 'Eric Prydz', None, 541_000)).outcome, 'match')
        self.assertEqual(m.match_candidate(t, m.Track('Opus', 'Eric Prydz', None, None)).outcome, 'review')
        unknown_target = m.Track('Opus', 'Eric Prydz')
        self.assertEqual(m.match_candidate(unknown_target, m.Track('Opus', 'Eric Prydz', None, 500_000)).outcome, 'review')

    def test_wrong_artist_or_title_is_rejected(self):
        t = m.Track('Opus', 'Eric Prydz', None, 540_000)
        self.assertEqual(m.match_candidate(t, m.Track('Opus', 'Other Person', None, 540_000)).outcome, 'reject')
        self.assertEqual(m.match_candidate(t, m.Track('Call on Me', 'Eric Prydz', None, 540_000)).outcome, 'reject')

    def test_best_match_prefers_isrc_and_flags_ambiguity(self):
        t = m.Track('Opus', 'Eric Prydz', 'SE1234567890', 540_000)
        picked = m.best_match(t, [m.Track('Opus', 'Eric Prydz', None, 540_000, 'fuzzy'),
                                  m.Track('Opus', 'Eric Prydz', 'SE1234567890', 540_500, 'isrc')])
        self.assertEqual((picked.outcome, picked.candidate.ref), ('match', 'isrc'))
        plain = m.Track('Opus', 'Eric Prydz', None, 540_000)
        ambiguous = m.best_match(plain, [m.Track('Opus', 'Eric Prydz', None, 540_000, 'a'),
                                         m.Track('Opus', 'Eric Prydz', None, 541_000, 'b')])
        self.assertEqual((ambiguous.outcome, ambiguous.reasons), ('review', ('ambiguous_multiple_matches',)))
        self.assertEqual(m.best_match(plain, []).outcome, 'reject')

    def test_isrc_format_validation(self):
        self.assertEqual(m.normalize_isrc('qm6-mz26 51268'), 'QM6MZ2651268')
        self.assertIsNone(m.normalize_isrc('12345'))


class FieldResolution(unittest.TestCase):
    C = fr.Candidate

    def test_isrc_priority_tidal_then_deezer_then_musicbrainz(self):
        r = fr.resolve_field('isrc', [self.C('musicbrainz', 'AA1'), self.C('deezer', 'AA2'), self.C('tidal', 'AA3')])
        self.assertEqual((r.action, r.value, r.source, r.review), ('set', 'AA3', 'tidal', True))
        self.assertEqual({c.source for c in r.alternatives}, {'deezer', 'musicbrainz'})
        agree = fr.resolve_field('isrc', [self.C('tidal', 'aa3'), self.C('deezer', 'AA3')])
        self.assertEqual((agree.value, agree.review), ('aa3', False))

    def test_unknown_values_are_skipped_and_none_when_nothing(self):
        r = fr.resolve_field('duration_ms', [self.C('tidal', None), self.C('deezer', 215_000)])
        self.assertEqual((r.value, r.source), (215_000, 'deezer'))
        self.assertEqual(fr.resolve_field('mix_name', [self.C('tidal', ''), self.C('deezer', None)]).action, 'none')

    def test_stronger_existing_value_is_not_overwritten(self):
        manual = fr.resolve_field('genre', [self.C('discogs', ['House'])], fr.Existing(['Techno'], 'manual'))
        self.assertEqual((manual.action, manual.value, manual.review), ('keep_existing', ['Techno'], False))
        stronger = fr.resolve_field('record_label', [self.C('deezer_album', 'Label B')], fr.Existing('Label A', 'discogs'))
        self.assertEqual((stronger.action, stronger.value, stronger.review), ('keep_existing', 'Label A', True))

    def test_weaker_or_legacy_existing_value_is_replaced(self):
        legacy = fr.resolve_field('genre', [self.C('lastfm', ['House'])], fr.Existing(['Disco'], None))
        self.assertEqual((legacy.action, legacy.value), ('set', ['House']))
        weaker = fr.resolve_field('genre', [self.C('discogs', ['Techno'])], fr.Existing(['House'], 'lastfm'))
        self.assertEqual((weaker.action, weaker.source), ('set', 'discogs'))

    def test_equal_value_is_kept_without_review(self):
        r = fr.resolve_field('record_label', [self.C('discogs', 'Anjunabeats')], fr.Existing(' anjunabeats ', 'deezer_album'))
        self.assertEqual((r.action, r.review), ('keep_existing', False))

    def test_durations_within_two_seconds_agree_and_larger_gaps_conflict(self):
        close = fr.resolve_field('duration_ms', [self.C('tidal', 637000), self.C('deezer', 637500)])
        self.assertEqual((close.value, close.source, close.review), (637000, 'tidal', False))
        far = fr.resolve_field('duration_ms', [self.C('tidal', 637000), self.C('deezer', 202000)])
        self.assertTrue(far.review)
        kept = fr.resolve_field('duration_ms', [self.C('deezer', 637400)], fr.Existing(637000, 'tidal'))
        self.assertEqual((kept.action, kept.review), ('keep_existing', False))

    def test_unconfigured_field_is_an_error(self):
        with self.assertRaises(KeyError):
            fr.resolve_field('bpm', [])

    def test_genre_cleaning_drops_personal_and_generic_tags(self):
        tags = [('seen live', 100), ('House', 90), ('2010', 80), ('Progressive House', 70), ('house', 60),
                ('favorites', 60), ('rare', 5), ('Trance', 50)]
        self.assertEqual(fr.clean_genres(tags), ['House', 'Progressive House', 'Trance'])


if __name__ == '__main__':
    unittest.main()
