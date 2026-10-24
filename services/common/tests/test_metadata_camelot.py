"""Golden tests for the shared Camelot/Open Key specification."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.metadata import camelot as c  # noqa: E402

# (key name, camelot) for all 24 keys, standard Camelot wheel.
MAJOR = {'B': '1B', 'F#': '2B', 'Db': '3B', 'Ab': '4B', 'Eb': '5B', 'Bb': '6B',
         'F': '7B', 'C': '8B', 'G': '9B', 'D': '10B', 'A': '11B', 'E': '12B'}
MINOR = {'Ab': '1A', 'Eb': '2A', 'Bb': '3A', 'F': '4A', 'C': '5A', 'G': '6A',
         'D': '7A', 'A': '8A', 'E': '9A', 'B': '10A', 'F#': '11A', 'Db': '12A'}


class CamelotSpec(unittest.TestCase):
    def test_all_24_keys_from_names(self):
        for tonic, code in MAJOR.items():
            self.assertEqual(c.to_camelot(f'{tonic} major'), code, tonic)
        for tonic, code in MINOR.items():
            self.assertEqual(c.to_camelot(f'{tonic} minor'), code, tonic)

    def test_enharmonic_spellings_agree(self):
        for a, b in [('C# minor', 'Db minor'), ('G# minor', 'Ab minor'), ('D# minor', 'Eb minor'),
                     ('A# minor', 'Bb minor'), ('F# major', 'Gb major'), ('C# major', 'Db major')]:
            self.assertEqual(c.to_camelot(a), c.to_camelot(b), (a, b))

    def test_name_forms(self):
        for text, code in [('Am', '8A'), ('A minor', '8A'), ('A min', '8A'), ('a minor', '8A'), ('am', '8A'),
                           ('F#m', '11A'), ('F♯ minor', '11A'), ('Bb', '6B'), ('B♭ major', '6B'),
                           ('Abmaj', '4B'), ('C', '8B'), ('Cmaj', '8B'), ('A sharp minor', '3A'),
                           ('E flat major', '5B'), ('C#min', '12A')]:
            self.assertEqual(c.to_camelot(text), code, text)

    def test_existing_camelot_codes_normalise(self):
        for text, code in [('8A', '8A'), ('08a', '8A'), (' 12b ', '12B'), ('1A', '1A')]:
            self.assertEqual(c.to_camelot(text), code, text)

    def test_open_key(self):
        self.assertEqual(c.to_camelot('1m'), '8A')
        self.assertEqual(c.to_camelot('1d'), '8B')
        self.assertEqual(c.to_camelot('6m'), '1A')
        self.assertEqual(c.to_camelot('12d'), '7B')
        for number in range(1, 13):
            for letter, mode in (('m', 'minor'), ('d', 'major')):
                camelot = c.to_camelot(f'{number}{letter}')
                self.assertEqual(c.to_open_key(camelot), f'{number}{letter}')
                self.assertEqual(c.from_camelot(camelot)[1], mode)

    def test_unparseable_and_empty_input_is_none_not_a_guess(self):
        for text in (None, '', ' ', 'H minor', '13A', '0A', 'X', 'major', 'A lydian', 5, 'Am7'):
            self.assertIsNone(c.to_camelot(text), text)

    def test_round_trip_through_pitch_class(self):
        for number in range(1, 13):
            for letter in 'AB':
                code = f'{number}{letter}'
                pitch_class, mode = c.from_camelot(code)
                self.assertEqual(c.camelot_from_pitch_class(pitch_class, mode), code)

    def test_relative_keys_share_numbers(self):
        self.assertEqual(c.relative_camelot('8A'), '8B')
        self.assertEqual(c.relative_camelot('11B'), '11A')
        self.assertEqual(c.to_camelot('A minor'), c.relative_camelot(c.to_camelot('C major')))

    def test_legacy_minor_tables_were_shifted_by_seven_and_are_correctable(self):
        # The retired tables put A minor at 1A, E minor at 2A ... D minor at 12A.
        legacy = {'A minor': '1A', 'E minor': '2A', 'B minor': '3A', 'F# minor': '4A', 'C# minor': '5A',
                  'G# minor': '6A', 'D# minor': '7A', 'A# minor': '8A', 'F minor': '9A', 'C minor': '10A',
                  'G minor': '11A', 'D minor': '12A'}
        for name, wrong in legacy.items():
            self.assertEqual(c.legacy_minor_to_correct(wrong), c.to_camelot(name), name)
        self.assertIsNone(c.legacy_minor_to_correct('8B'), 'majors were never shifted')

    def test_recompute_statuses_prefer_original_key_over_stored_code(self):
        self.assertEqual(c.recompute('A minor', '1A'), ('8A', 'corrected'))
        self.assertEqual(c.recompute('A minor', '8A'), ('8A', 'unchanged'))
        self.assertEqual(c.recompute('A minor', None), ('8A', 'derived'))
        self.assertEqual(c.recompute(None, '5A'), (None, 'unrecoverable'))
        self.assertEqual(c.recompute(None, None), (None, 'unknown'))
        self.assertEqual(c.recompute('???', '5A'), (None, 'unrecoverable'))


if __name__ == '__main__':
    unittest.main()
