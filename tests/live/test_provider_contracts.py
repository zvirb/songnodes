"""Live provider contract checks. SKIPPED unless RUN_LIVE_PROVIDER_TESTS=1 (and the provider's credentials).

Run: RUN_LIVE_PROVIDER_TESTS=1 TIDAL_CLIENT_ID=... TIDAL_CLIENT_SECRET=... python -m unittest discover -s tests/live -v

These assert the SHAPE of real responses (so a contract change fails loudly) and REPORT the dated
observations from the specification (ISRC QM6MZ2651268; extended version 304 s; TIDAL search returning both
the 202 s and 304 s versions) without turning them into pass/fail values: providers change their data.
Results are printed as `LIVE-REPORT ...` lines; paste them, with the date, into docs/METADATA_BASELINE.md.
Missing credentials are reported as skips, never as passes.
"""
import asyncio
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'services'))
from common.metadata.matching import Track  # noqa: E402
from common.providers import base, deezer, lastfm, musicbrainz, tidal  # noqa: E402

LIVE = os.getenv('RUN_LIVE_PROVIDER_TESTS') == '1'
ISRC = 'QM6MZ2651268'
OBSERVED_SECONDS = {'extended': 304, 'short': 202}


def report(provider, key, value):
    print(f'LIVE-REPORT provider={provider} {key}={value}')


@unittest.skipUnless(LIVE, 'set RUN_LIVE_PROVIDER_TESTS=1 to call real providers')
class LiveContracts(unittest.IsolatedAsyncioTestCase):
    @unittest.skipUnless(os.getenv('TIDAL_CLIENT_ID') and os.getenv('TIDAL_CLIENT_SECRET'), 'TIDAL credentials not set')
    async def test_tidal_isrc_lookup_search_and_array_style(self):
        client = tidal.TidalClient(os.environ['TIDAL_CLIENT_ID'], os.environ['TIDAL_CLIENT_SECRET'],
                                   os.getenv('TIDAL_COUNTRY_CODE', 'AU'))
        try:
            found = await client.by_isrc([ISRC])
            self.assertTrue(found, 'known-good ISRC returned nothing: treat as a contract failure, not an empty match')
            for item in found:
                self.assertEqual(item.track.isrc, ISRC)
                self.assertTrue(item.track.title and item.track.artist and item.track.duration_ms)
                report('tidal', 'isrc_versions_seconds', sorted({round(i.track.duration_ms / 1000) for i in found}))
                report('tidal', 'bpm_populated', 'bpm' in item.fields)
                report('tidal', 'key_populated', 'key' in item.fields)
            searched = await client.search('deadmau5 Strobe')
            durations = sorted({round(i.track.duration_ms / 1000) for i in searched if i.track.duration_ms})
            report('tidal', 'search_durations_seconds', durations)
            for label, seconds in OBSERVED_SECONDS.items():
                if not any(abs(d - seconds) <= 2 for d in durations):
                    report('tidal', f'DRIFT_{label}_{seconds}s_not_seen', True)
            # Which array encoding does the API accept? Both are tried and reported.
            for style in ('comma', 'repeat'):
                probe = tidal.TidalClient(os.environ['TIDAL_CLIENT_ID'], os.environ['TIDAL_CLIENT_SECRET'],
                                          os.getenv('TIDAL_COUNTRY_CODE', 'AU'), array_style=style)
                try:
                    two = await probe.by_isrc([ISRC, found[0].track.isrc])
                    report('tidal', f'array_style_{style}_results', len(two))
                except base.ProviderError as error:
                    report('tidal', f'array_style_{style}_error', error)
                finally:
                    await probe.aclose()
        finally:
            await client.aclose()

    async def test_deezer_isrc_and_detail_shape(self):
        client = deezer.DeezerClient()
        try:
            found = await client.by_isrc(ISRC)
            self.assertTrue(found, 'known-good ISRC returned nothing')
            item = found[0]
            self.assertEqual(item.track.isrc, ISRC)
            self.assertTrue(item.track.duration_ms)
            report('deezer', 'duration_seconds', round(item.track.duration_ms / 1000))
            report('deezer', 'bpm_populated', 'bpm' in item.fields)
            hydrated = await client.hydrate(item)
            report('deezer', 'album_genres', hydrated.fields.get('genre'))
            report('deezer', 'album_label', hydrated.fields.get('record_label'))
        finally:
            await client.aclose()

    async def test_musicbrainz_isrc_search_returns_isrc_list(self):
        client = musicbrainz.MusicBrainzClient(contact=os.getenv('MUSICBRAINZ_CONTACT'))
        try:
            found = await client.by_isrc(ISRC)
            self.assertTrue(found, 'no recording for the known-good ISRC')
            report('musicbrainz', 'recordings', len(found))
            report('musicbrainz', 'isrc_captured', any(i.fields.get('isrc') == ISRC for i in found))
        finally:
            await client.aclose()

    @unittest.skipUnless(os.getenv('LASTFM_API_KEY'), 'LASTFM_API_KEY not set')
    async def test_lastfm_https_toptags_shape(self):
        client = lastfm.LastFmClient(os.environ['LASTFM_API_KEY'])
        try:
            found = await client.lookup(Track('Strobe', 'deadmau5'))
            report('lastfm', 'genres', found[0].fields['genre'] if found else None)
            self.assertTrue(found, 'no tags returned for a popular track')
        finally:
            await client.aclose()


if __name__ == '__main__':
    unittest.main()
