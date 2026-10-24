"""Guards the removal of Spotify's audio-features API (BPM/key/energy/etc.) from code and config."""
import os
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SKIP_DIRS = {'node_modules', 'sample_data_env', '.git', 'dist', '__pycache__', '.local-dev', 'sql', 'docs'}
EXTENSIONS = {'.py', '.ts', '.tsx', '.js', '.yaml', '.yml', '.json', '.sh'}
FORBIDDEN = [
    re.compile(r'api\.spotify\.com/v1/audio-features'),
    re.compile(r'/audio-features[/?{]'),
    re.compile(r'spotify_audio_features'),
    re.compile(r'spotify\W+audio_features|audio_features\W+spotify', re.IGNORECASE),
    re.compile(r"\('spotify',\s*'(bpm|key|energy|danceability|valence)'\)"),
    re.compile(r'(?<!acousticbrainz_client\.)\bspotify_client\.get_audio_features'),
]


def source_files():
    for folder, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            path = Path(folder) / name
            if path.suffix in EXTENSIONS and name != 'package-lock.json' and 'test_no_spotify' not in name:
                yield path


class SpotifyAudioFeaturesRemoved(unittest.TestCase):
    def test_no_calls_routes_or_config_remain(self):
        hits = []
        for path in source_files():
            text = path.read_text(encoding='utf-8', errors='ignore')
            for pattern in FORBIDDEN:
                for match in pattern.finditer(text):
                    line = text.count('\n', 0, match.start()) + 1
                    hits.append(f'{path.relative_to(ROOT)}:{line}: {match.group(0)}')
        self.assertEqual(hits, [])

    def test_waterfall_seed_has_no_spotify_audio_fields(self):
        seed = (ROOT / 'sql/migrations/medallion/004_waterfall_configuration_up.sql').read_text(encoding='utf-8')
        for field in ('bpm', 'key', 'energy', 'danceability', 'valence'):
            row = re.search(rf"\('{field}',[^\n]*", seed)
            self.assertTrue(row is None or 'spotify' not in row.group(0), field)
        provider = re.search(r"\('spotify', 'api', ARRAY\[([^\]]*)\]", seed).group(1)
        for field in ('bpm', 'key', 'energy', 'danceability', 'valence'):
            self.assertNotIn(f"'{field}'", provider)


if __name__ == '__main__':
    unittest.main()
