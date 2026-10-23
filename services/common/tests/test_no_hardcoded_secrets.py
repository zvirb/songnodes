"""Fails if a service falls back to a committed password, token or encryption secret when its environment is empty."""
import os
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SKIP = {'node_modules', 'sample_data_env', '.git', 'dist', '__pycache__', '.local-dev', 'tests'}
SECRET_NAME = r'[A-Z_]*(?:PASSWORD|PASSWD|PASS|SECRET|SECRET_KEY|TOKEN|API_KEY)[A-Z_]*'
DEFAULTED = re.compile(r"""os\.(?:getenv|environ\.get)\(\s*['"]""" + SECRET_NAME + r"""['"]\s*,\s*['"][^'"\s]{4,}['"]""")
KNOWN_LEAK = '7D82_xqNs55tGyk'


def sources():
    for folder, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP]
        for name in files:
            if name.endswith('.py') and not name.startswith('test_') and name != 'conftest.py':
                yield Path(folder) / name


class NoCommittedSecrets(unittest.TestCase):
    def test_no_environment_lookup_falls_back_to_a_literal_secret(self):
        hits = []
        for path in sources():
            text = path.read_text(encoding='utf-8', errors='ignore')
            for match in DEFAULTED.finditer(text):
                hits.append(f'{path.relative_to(ROOT)}:{text.count(chr(10), 0, match.start()) + 1}: {match.group(0)[:90]}')
        self.assertEqual(hits, [])

    def test_the_credential_that_was_committed_is_gone_from_the_tree(self):
        leaked = [str(p.relative_to(ROOT)) for p in sources() if KNOWN_LEAK in p.read_text(encoding='utf-8', errors='ignore')]
        self.assertEqual(leaked, [])


if __name__ == '__main__':
    unittest.main()
