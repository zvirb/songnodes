"""Deterministic parsing: structure without losing identity information."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.metadata.parsing import parse_track, remixer_of, split_artists  # noqa: E402


class Parsing(unittest.TestCase):
    def test_simple_track_keeps_original_and_version(self):
        p = parse_track('deadmau5 - Strobe (Extended Mix)')
        self.assertEqual((p.original, p.artist_string, p.artists, p.title, p.versions, p.remixers),
                         ('deadmau5 - Strobe (Extended Mix)', 'deadmau5', ('deadmau5',), 'Strobe', ('extended mix',), ()))
        self.assertFalse(p.unidentified)

    def test_collaboration_separators(self):
        self.assertEqual(parse_track('Eric Prydz vs. Pryda - Opus').artists, ('Eric Prydz', 'Pryda'))
        self.assertEqual(parse_track('Fisher x Chris Lake - Losing It').artists, ('Fisher', 'Chris Lake'))
        self.assertEqual(parse_track('Deadmau5 & Kaskade, Skrillex - Test').artists, ('Deadmau5', 'Kaskade', 'Skrillex'))

    def test_a_bare_x_never_splits_a_name(self):
        for name in ('Alex Xavier', 'Xavier Naidoo', 'Max X', 'Pixx', 'Dexter'):
            self.assertEqual(parse_track(f'{name} - Song').artists, (name,), name)

    def test_known_compounds_are_not_split(self):
        known = lambda text: text.lower() in {'above & beyond', 'simon & garfunkel'}  # noqa: E731
        self.assertEqual(parse_track('Above & Beyond - Sun & Moon', known).artists, ('Above & Beyond',))
        self.assertEqual(parse_track('Above & Beyond & Armin van Buuren - Test', known).artists, ('Above & Beyond', 'Armin van Buuren'))
        self.assertEqual(parse_track('Above & Beyond - Sun & Moon').artists, ('Above', 'Beyond'), 'unknown compounds split')
        self.assertEqual(split_artists('Simon & Garfunkel', known), (['Simon & Garfunkel'], []))

    def test_featured_artists_from_artist_and_title(self):
        p = parse_track('Calvin Harris feat. Rihanna - We Found Love')
        self.assertEqual((p.artists, p.featured), (('Calvin Harris',), ('Rihanna',)))
        q = parse_track('Avicii - Wake Me Up (feat. Aloe Blacc)')
        self.assertEqual((q.artists, q.featured, q.title), (('Avicii',), ('Aloe Blacc',), 'Wake Me Up'))

    def test_remixers_are_extracted_but_generic_versions_are_not(self):
        p = parse_track('Artist - Title (Eric Prydz Remix)')
        self.assertEqual((p.title, p.remixers, p.versions), ('Title', ('Eric Prydz',), ('eric prydz remix',)))
        self.assertEqual(parse_track('Artist - Title - Eric Prydz Remix').remixers, ('Eric Prydz',))
        for phrase in ('Extended Mix', 'Radio Edit', 'Club Mix', 'Original Mix', 'Dub Mix', 'Edit'):
            self.assertIsNone(remixer_of(phrase), phrase)
            self.assertEqual(parse_track(f'Artist - Title ({phrase})').remixers, (), phrase)
        self.assertEqual(remixer_of('Pryda Rework'), 'Pryda')

    def test_unicode_is_preserved_not_ascii_folded(self):
        p = parse_track('Beyoncé – Déjà Vu (Radio Edit)')
        self.assertEqual((p.artists, p.title, p.versions), (('Beyoncé',), 'Déjà Vu', ('radio edit',)))
        self.assertEqual(parse_track('Måneskin - Beggin’').artists, ('Måneskin',))
        self.assertEqual(parse_track('Би-2 - Лето').title, 'Лето')

    def test_unidentified_entries_produce_no_artist(self):
        for raw in ('ID - ID', 'Unknown Artist - Mystery', 'VA - Compilation Cut'):
            p = parse_track(raw)
            self.assertEqual(p.artists, (), raw)
        self.assertTrue(parse_track('ID - ID').unidentified)
        self.assertTrue(parse_track('Unknown Artist - Mystery').unidentified)

    def test_no_separator_is_title_only(self):
        p = parse_track('Just A Title')
        self.assertEqual((p.artists, p.title, p.artist_string), ((), 'Just A Title', ''))

    def test_dashes_inside_titles_survive(self):
        p = parse_track('Artist - Re-Work Part 2 - Radio Edit')
        self.assertEqual((p.artists, p.title, p.versions), (('Artist',), 'Re-Work Part 2', ('radio edit',)))


if __name__ == '__main__':
    unittest.main()
