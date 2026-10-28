import asyncio
import logging
import unittest
from unittest.mock import patch, MagicMock

from common.providers.registry import build_providers
from common.providers.saved_keys import load_sync

# A dummy mock class for the DB connection
class MockConnection:
    def __init__(self, fetch_responses):
        self.fetch_responses = fetch_responses

    async def fetchval(self, query, service, key_name, secret):
        return self.fetch_responses.get((service, key_name), None)

    async def close(self):
        pass


class TestProviderSavedKeys(unittest.TestCase):
    @patch('common.providers.saved_keys.asyncpg.connect')
    def test_saved_keys_load_successfully(self, mock_connect):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        # We need to simulate DB fetch for the keys.
        responses = {
            ('discogs', 'token'): 'saved_discogs',
            ('lastfm', 'api_key'): 'CHANGE_ME_LASTFM',
            ('getsongbpm', 'api_key'): 'saved_getsongbpm',
            ('tidal', 'client_id'): 'saved_tidal_id',
            ('tidal', 'client_secret'): 'saved_tidal_sec',
        }

        async def dummy_connect(dsn, timeout):
            return MockConnection(responses)

        mock_connect.side_effect = dummy_connect

        # Run inside an event loop to mimic what would happen when async context runs load_sync,
        # but load_sync spans its own isolated event loop via ThreadPoolExecutor.
        async def main():
            return load_sync('dummy_dsn', 'dummy_secret')

        result = loop.run_until_complete(main())
        loop.close()

        # Check what got extracted
        self.assertEqual(result.get('DISCOGS_TOKEN'), 'saved_discogs')
        self.assertNotIn('LASTFM_API_KEY', result) # It was CHANGE_ME_LASTFM
        self.assertEqual(result.get('GETSONGBPM_API_KEY'), 'saved_getsongbpm')
        self.assertEqual(result.get('TIDAL_CLIENT_ID'), 'saved_tidal_id')
        self.assertEqual(result.get('TIDAL_CLIENT_SECRET'), 'saved_tidal_sec')


    def test_registry_build_uses_saved_keys(self):
        with self.assertLogs('common.providers.registry', level='INFO') as cm:
            env = {
                'ENRICHMENT_PROVIDERS': 'discogs,lastfm',
                'DISCOGS_TOKEN': 'env_discogs',
                'LASTFM_API_KEY': 'env_lastfm',
            }
            saved = {
                'DISCOGS_TOKEN': 'saved_discogs',
                # LASTFM_API_KEY is not in saved, so it should fallback to env
            }
            # Provide both so it doesn't query DB
            providers = build_providers(env=env, saved=saved)

            self.assertEqual(len(providers), 2)
            names = [p.name for p in providers]
            self.assertIn('discogs', names)
            self.assertIn('lastfm', names)

            # Check properties on created providers
            discogs_p = next(p for p in providers if p.name == 'discogs')
            self.assertEqual(discogs_p.token, 'saved_discogs')

            lastfm_p = next(p for p in providers if p.name == 'lastfm')
            self.assertEqual(lastfm_p.api_key, 'env_lastfm')

            # Verify that logging has correct origin details and no sensitive keys
            logged_line = cm.output[0]
            self.assertIn("providers built", logged_line)
            self.assertIn("discogs from saved", logged_line)
            self.assertIn("lastfm from env", logged_line)
            self.assertNotIn("saved_discogs", logged_line)
            self.assertNotIn("env_lastfm", logged_line)

    def test_explicit_env_skips_db(self):
        # We explicitly pass env, we should skip calling load_sync inside build_providers.
        with patch('common.providers.registry.load_sync') as mock_load_sync:
            providers = build_providers(env={'ENRICHMENT_PROVIDERS': 'none'})
            self.assertEqual(len(providers), 0)
            mock_load_sync.assert_not_called()

    @patch('common.providers.saved_keys.asyncpg.connect')
    def test_db_error_falls_back_to_env(self, mock_connect):
        async def err_connect(*args, **kwargs):
            raise Exception("DB is down")
        mock_connect.side_effect = err_connect

        env = {
            'DATABASE_URL': 'dummy_url',
            'ENRICHMENT_PROVIDERS': 'lastfm',
            'LASTFM_API_KEY': 'env_lastfm'
        }
        # Not providing 'env', so it forces loading from env internally, using 'env' variable as actual os.environ mock.
        with patch('common.providers.registry.os.environ', env):
            providers = build_providers(env=None) # this triggers DB fetch
            self.assertEqual(len(providers), 1)
            self.assertEqual(providers[0].name, 'lastfm')
            self.assertEqual(providers[0].api_key, 'env_lastfm')

if __name__ == '__main__':
    unittest.main()
