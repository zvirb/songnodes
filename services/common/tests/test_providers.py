"""Provider client contract tests against mocked HTTP (no network, no credentials)."""
import base64
import json
import sys
import unittest
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.metadata.matching import Track  # noqa: E402
from common.providers import base, deezer, discogs, getsongbpm, lastfm, musicbrainz, registry, tidal  # noqa: E402


def mock_client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), headers={'User-Agent': 'test'})


def query(request):
    return parse_qs(urlsplit(str(request.url)).query)


def isrc(n):
    return f'USAAA{n:07d}'


async def no_sleep(_):
    return None


class Helpers(unittest.TestCase):
    def test_iso_durations(self):
        parse = base.parse_iso_duration_ms
        self.assertEqual(parse('PT3M22S'), 202000)
        self.assertEqual(parse('PT5M4S'), 304000)
        self.assertEqual(parse('PT1H2M3.5S'), 3723500)
        for bad in (None, '', 'PT0S', '3:22', 'garbage', 202):
            self.assertIsNone(parse(bad), bad)


class TidalFixtures:
    TOKEN = {'access_token': 'tok-1', 'token_type': 'Bearer', 'expires_in': 86400}

    @staticmethod
    def track(track_id, title, version=None, isrc_code='USAAA0000001', duration='PT3M22S', **extra):
        attributes = {'title': title, 'isrc': isrc_code, 'duration': duration, 'explicit': False, **extra}
        if version:
            attributes['version'] = version
        return {'id': track_id, 'type': 'tracks', 'attributes': attributes,
                'relationships': {'artists': {'data': [{'id': 'a1', 'type': 'artists'}]}}}

    ARTIST = {'id': 'a1', 'type': 'artists', 'attributes': {'name': 'deadmau5'}}


class Tidal(unittest.IsolatedAsyncioTestCase):
    def client(self, routes):
        self.calls = []

        def handler(request):
            self.calls.append(request)
            return routes(request)

        return tidal.TidalClient('the-id', 'the-secret', 'AU', client=mock_client(handler), sleep=no_sleep)

    def routes(self, tracks_body=None, status=200, headers=None):
        def handle(request):
            if request.url.path.endswith('/oauth2/token'):
                return httpx.Response(200, json=TidalFixtures.TOKEN)
            return httpx.Response(status, json=tracks_body or {'data': []}, headers=headers or {})
        return handle

    async def test_auth_uses_basic_header_and_never_puts_secrets_in_urls(self):
        doc = {'data': [TidalFixtures.track('t1', 'Strobe')], 'included': [TidalFixtures.ARTIST]}
        client = self.client(self.routes(doc))
        await client.by_isrc([isrc(1)])
        await client.by_isrc([isrc(2)])
        token_calls = [c for c in self.calls if c.url.path.endswith('/token')]
        self.assertEqual(len(token_calls), 1, 'token is cached between calls')
        expected = base64.b64encode(b'the-id:the-secret').decode()
        self.assertEqual(token_calls[0].headers['Authorization'], f'Basic {expected}')
        self.assertIn(b'grant_type=client_credentials', token_calls[0].content)
        for call in self.calls:
            self.assertNotIn('the-secret', str(call.url))
        data_call = self.calls[1]
        self.assertEqual(data_call.headers['Authorization'], 'Bearer tok-1')
        self.assertEqual(data_call.headers['Accept'], 'application/vnd.api+json')
        self.assertEqual(data_call.url.host, 'openapi.tidal.com')
        self.assertEqual(data_call.url.path, '/v2/tracks')
        self.assertEqual(query(data_call), {'filter[isrc]': [isrc(1)], 'countryCode': ['AU'], 'include': ['artists,albums']})

    async def test_parse_title_version_duration_isrc_bpm_and_key(self):
        doc = {'data': [TidalFixtures.track('t1', 'Strobe', 'Extended Mix', 'qm6mz2651268', 'PT10M37S', bpm=128.0,
                                            key='A', keyScale='MINOR')], 'included': [TidalFixtures.ARTIST]}
        found = (await self.client(self.routes(doc)).by_isrc(['QM6MZ2651268']))[0]
        self.assertEqual((found.track.title, found.track.artist, found.track.isrc, found.track.duration_ms, found.track.ref),
                         ('Strobe (Extended Mix)', 'deadmau5', 'QM6MZ2651268', 637000, 't1'))
        self.assertEqual(found.fields, {'tidal_id': 't1', 'isrc': 'QM6MZ2651268', 'duration_ms': 637000,
                                        'mix_name': 'Extended Mix', 'bpm': 128.0, 'key': 'A minor'})

    async def test_unknown_or_ambiguous_bpm_and_key_are_omitted(self):
        for extra in ({'bpm': 0, 'key': 'UNKNOWN', 'keyScale': 'UNKNOWN'}, {'bpm': None, 'key': 'D', 'keyScale': 'DORIAN'}, {}):
            doc = {'data': [TidalFixtures.track('t1', 'X', **extra)], 'included': [TidalFixtures.ARTIST]}
            fields = (await self.client(self.routes(doc)).by_isrc([isrc(1)]))[0].fields
            self.assertNotIn('bpm', fields)
            self.assertNotIn('key', fields)
        self.assertEqual(tidal.key_name('FSharp', 'MAJOR'), 'F# major')
        self.assertEqual(tidal.key_name('Eb', 'AEOLIAN'), 'Eb minor')

    async def test_isrc_requests_are_batched_in_twenties(self):
        client = self.client(self.routes({'data': []}))
        await client.by_isrc([isrc(n) for n in range(45)] + ['not-an-isrc'])
        repeat = tidal.TidalClient('i', 's', array_style='repeat', client=mock_client(lambda r: httpx.Response(200, json=TidalFixtures.TOKEN)
                                                                       if r.url.path.endswith('/token') else (self.calls.append(r), httpx.Response(200, json={'data': []}))[1]),
                                   sleep=no_sleep)
        data_calls = [c for c in self.calls if c.url.path == '/v2/tracks']
        sizes = [len(query(c)['filter[isrc]'][0].split(',')) for c in data_calls]
        self.assertEqual(len(data_calls), 3)
        self.assertEqual(sorted(sizes), [5, 20, 20])
        self.calls.clear()
        await repeat.by_isrc([isrc(1), isrc(2)])
        self.assertEqual(query(self.calls[0])['filter[isrc]'], [isrc(1), isrc(2)], 'repeat style sends one key per value')

    async def test_single_isrc_follows_cursor_pagination(self):
        pages = {'/v2/tracks': {'data': [TidalFixtures.track('t1', 'A')], 'included': [TidalFixtures.ARTIST],
                                'links': {'next': '/tracks?page[cursor]=abc'}}}

        def handle(request):
            if request.url.path.endswith('/token'):
                return httpx.Response(200, json=TidalFixtures.TOKEN)
            if 'page[cursor]' in str(request.url) or 'page%5Bcursor%5D' in str(request.url):
                return httpx.Response(200, json={'data': [TidalFixtures.track('t2', 'B')], 'included': [TidalFixtures.ARTIST]})
            return httpx.Response(200, json=pages['/v2/tracks'])

        client = tidal.TidalClient('i', 's', client=mock_client(handle), sleep=no_sleep)
        self.assertEqual([t.track.ref for t in await client.by_isrc([isrc(1)])], ['t1', 't2'])

    async def test_unexpected_404_is_a_failure_not_an_empty_match(self):
        with self.assertRaises(base.ProviderError) as caught:
            await self.client(self.routes(status=404)).by_isrc([isrc(1)])
        self.assertEqual(caught.exception.status, 404)

    async def test_429_retries_with_retry_after_then_succeeds_and_exhaustion_is_unavailable(self):
        sleeps, attempts = [], {'n': 0}

        async def record(delay):
            sleeps.append(delay)

        def handle(request):
            if request.url.path.endswith('/token'):
                return httpx.Response(200, json=TidalFixtures.TOKEN)
            attempts['n'] += 1
            if attempts['n'] < 3:
                return httpx.Response(429, json={'errors': [{'status': '429', 'detail': 'Rate limit exceeded'}]},
                                      headers={'Retry-After': '7'})
            return httpx.Response(200, json={'data': []})

        client = tidal.TidalClient('i', 's', client=mock_client(handle), sleep=record)
        self.assertEqual(await client.by_isrc([isrc(1)]), [])
        self.assertEqual((attempts['n'], sleeps), (3, [7.0, 7.0]))
        always = tidal.TidalClient('i', 's', client=mock_client(lambda r: httpx.Response(200, json=TidalFixtures.TOKEN)
                                                                  if r.url.path.endswith('/token') else httpx.Response(503)),
                                   sleep=no_sleep)
        with self.assertRaises(base.ProviderUnavailable):
            await always.by_isrc([isrc(1)])

    async def test_search_encodes_the_query_and_hydrates_found_ids(self):
        def handle(request):
            path = request.url.raw_path.decode()
            if request.url.path.endswith('/token'):
                return httpx.Response(200, json=TidalFixtures.TOKEN)
            if '/searchResults' in path:
                return httpx.Response(200, json={'data': [{'relationships': {'tracks': {'data': [{'id': 't9', 'type': 'tracks'}, {'id': 'v1', 'type': 'videos'}]}}}]})
            return httpx.Response(200, json={'data': [TidalFixtures.track('t9', 'Opus')], 'included': [TidalFixtures.ARTIST]})

        self.calls = []
        client = tidal.TidalClient('i', 's', client=mock_client(lambda r: (self.calls.append(r), handle(r))[1]), sleep=no_sleep)
        found = await client.search('Eric Prydz/Opus & More')
        search_call = next(c for c in self.calls if '/searchResults' in c.url.raw_path.decode())
        self.assertIn('filter%5Bquery%5D=Eric+Prydz%2FOpus+%26+More', search_call.url.raw_path.decode())
        self.assertEqual([t.track.ref for t in found], ['t9'])
        hydrate = next(c for c in self.calls if c.url.path == '/v2/tracks')
        self.assertEqual(query(hydrate)['filter[id]'], ['t9'])

    async def test_missing_credentials_disable_the_client(self):
        with self.assertRaises(base.ProviderDisabled):
            await tidal.TidalClient(None, None, client=mock_client(lambda r: httpx.Response(500))).token()

    async def test_lookup_uses_isrc_then_falls_back_to_text_search(self):
        def handle(request):
            if request.url.path.endswith('/token'):
                return httpx.Response(200, json=TidalFixtures.TOKEN)
            if '/searchResults' in request.url.raw_path.decode():
                return httpx.Response(200, json={'data': [{'relationships': {'tracks': {'data': [{'id': 't1', 'type': 'tracks'}]}}}]})
            if 'filter[isrc]' in unquote(str(request.url)):
                return httpx.Response(200, json={'data': []})
            return httpx.Response(200, json={'data': [TidalFixtures.track('t1', 'Strobe')], 'included': [TidalFixtures.ARTIST]})

        client = tidal.TidalClient('i', 's', client=mock_client(handle), sleep=no_sleep)
        found = await client.lookup(Track('Strobe', 'deadmau5', isrc(5)))
        self.assertEqual([t.track.ref for t in found], ['t1'])


class Deezer(unittest.IsolatedAsyncioTestCase):
    TRACK = {'id': 3135556, 'title': 'Strobe', 'title_version': '(Extended Mix)', 'isrc': 'QM6MZ2651268', 'duration': 637,
             'bpm': 0, 'gain': -9.5, 'preview': 'https://cdn.example/p.mp3', 'artist': {'name': 'deadmau5'},
             'album': {'id': 99, 'title': 'For Lack of a Better Name'}}

    def client(self, handle):
        self.calls = []
        return deezer.DeezerClient(client=mock_client(lambda r: (self.calls.append(r), handle(r))[1]), sleep=no_sleep, rate_interval=0)

    async def test_isrc_lookup_parses_seconds_version_and_treats_zero_bpm_as_unknown(self):
        client = self.client(lambda r: httpx.Response(200, json=self.TRACK))
        found = (await client.lookup(Track('Strobe', 'deadmau5', 'QM6MZ2651268')))[0]
        self.assertEqual(self.calls[0].url.path, '/track/isrc:QM6MZ2651268')
        self.assertEqual((found.track.title, found.track.duration_ms), ('Strobe (Extended Mix)', 637000))
        self.assertEqual(found.fields, {'deezer_id': '3135556', 'isrc': 'QM6MZ2651268', 'duration_ms': 637000, 'mix_name': 'Extended Mix'})
        self.assertNotIn('bpm', found.fields)
        self.assertEqual(found.raw['preview'], 'https://cdn.example/p.mp3', 'preview URL is carried, not analysed')

    async def test_positive_bpm_is_kept(self):
        client = self.client(lambda r: httpx.Response(200, json={**self.TRACK, 'bpm': 128.4}))
        self.assertEqual((await client.by_isrc('QM6MZ2651268'))[0].fields['bpm'], 128.4)

    async def test_no_data_error_is_an_empty_result_and_other_errors_raise(self):
        none = self.client(lambda r: httpx.Response(200, json={'error': {'type': 'DataException', 'message': 'no data', 'code': 800}}))
        self.assertEqual(await none.by_isrc('QM6MZ2651268'), [])
        bad = self.client(lambda r: httpx.Response(200, json={'error': {'type': 'OAuthException', 'message': 'invalid', 'code': 300}}))
        with self.assertRaises(base.ProviderError):
            await bad.by_isrc('QM6MZ2651268')

    async def test_quota_code_4_is_retried_with_backoff(self):
        sleeps, state = [], {'n': 0}

        async def record(delay):
            sleeps.append(delay)

        def handle(request):
            state['n'] += 1
            if state['n'] == 1:
                return httpx.Response(200, json={'error': {'type': 'Exception', 'message': 'Quota limit exceeded', 'code': 4}})
            return httpx.Response(200, json=self.TRACK)

        client = deezer.DeezerClient(client=mock_client(handle), sleep=record, rate_interval=0)
        self.assertEqual(len(await client.by_isrc('QM6MZ2651268')), 1)
        self.assertEqual((state['n'], len(sleeps)), (2, 1))

    async def test_text_search_hydrates_candidates_and_adds_an_extended_query(self):
        def handle(request):
            if request.url.path == '/search/track':
                ids = [{'id': 11}] if 'extended' not in query(request)['q'][0] else [{'id': 11}, {'id': 12}]
                return httpx.Response(200, json={'data': ids})
            number = int(request.url.path.rsplit('/', 1)[1])
            return httpx.Response(200, json={**self.TRACK, 'id': number, 'bpm': 124})

        client = self.client(handle)
        found = await client.lookup(Track('Strobe (Extended Mix)', 'deadmau5'))
        searches = [query(c)['q'][0] for c in self.calls if c.url.path == '/search/track']
        self.assertEqual(len(searches), 2)
        self.assertIn('deadmau5 strobe', searches[0])
        self.assertTrue(searches[1].endswith('extended'))
        self.assertEqual(sorted(p.track.ref for p in found), ['11', '12'], 'candidates are de-duplicated across queries')

    async def test_album_hydration_labels_genre_and_label_as_deezer_album(self):
        client = self.client(lambda r: httpx.Response(200, json={'genres': {'data': [{'name': 'Electro'}, {'name': 'Dance'}]},
                                                                  'label': 'mau5trap'}))
        found = deezer.DeezerClient.parse(client, self.TRACK)
        hydrated = await client.hydrate(found)
        self.assertEqual((hydrated.fields['genre'], hydrated.fields['record_label']), (['Electro', 'Dance'], 'mau5trap'))
        self.assertEqual(hydrated.field_sources, {'genre': 'deezer_album', 'record_label': 'deezer_album'})


class MusicBrainz(unittest.IsolatedAsyncioTestCase):
    async def test_isrc_capture_handles_search_and_lookup_shapes(self):
        search_shape = {'id': 'm1', 'title': 'Strobe', 'length': 637000, 'isrcs': [{'id': 'QM6MZ2651268'}],
                        'artist-credit': [{'name': 'deadmau5', 'joinphrase': ''}]}
        lookup_shape = {'id': 'm1', 'isrcs': ['QM6MZ2651268', 'bad']}
        self.assertEqual(musicbrainz.isrcs_of(search_shape), ['QM6MZ2651268'])
        self.assertEqual(musicbrainz.isrcs_of(lookup_shape), ['QM6MZ2651268'])
        client = musicbrainz.MusicBrainzClient(contact='me@example.org', client=mock_client(lambda r: httpx.Response(200, json={'recordings': [search_shape]})),
                                               sleep=no_sleep, rate_interval=0)
        found = (await client.by_isrc('QM6MZ2651268'))[0]
        self.assertEqual((found.fields['isrc'], found.fields['duration_ms'], found.track.artist), ('QM6MZ2651268', 637000, 'deadmau5'))
        self.assertIn('me@example.org', client.client.headers['User-Agent'])
        self.assertEqual(client.limiter.interval, 0, 'tests disable spacing; the production default is below')
        self.assertEqual(musicbrainz.MusicBrainzClient(client=Registry.SHARED).limiter.interval, 1.1)

    async def test_text_search_escapes_quotes(self):
        seen = []
        client = musicbrainz.MusicBrainzClient(client=mock_client(lambda r: (seen.append(r), httpx.Response(200, json={'recordings': []}))[1]),
                                               sleep=no_sleep, rate_interval=0)
        await client.lookup(Track('Say "Hello"', 'A\\B'))
        self.assertIn('recording:"Say \\"Hello\\""', query(seen[0])['query'][0])
        self.assertEqual(query(seen[0])['fmt'], ['json'])


class GetSongBpm(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_until_terms_are_verified(self):
        for kwargs in ({'api_key': 'k', 'enabled': False}, {'api_key': None, 'enabled': True}):
            client = getsongbpm.GetSongBpmClient(client=mock_client(lambda r: httpx.Response(500)), **kwargs)
            with self.assertRaises(base.ProviderDisabled):
                await client.lookup(Track('Opus', 'Eric Prydz'))

    async def test_enabled_parses_tempo_and_key_and_keeps_the_api_key_out_of_the_url(self):
        seen = []
        body = {'search': [{'song_id': 'g1', 'song_title': 'Opus', 'tempo': '126', 'key_of': 'Am', 'artist': {'name': 'Eric Prydz'}},
                           {'song_id': 'g2', 'song_title': 'Opus', 'tempo': '0', 'key_of': '?', 'artist': {'name': 'Eric Prydz'}}]}
        client = getsongbpm.GetSongBpmClient('SECRET', enabled=True, client=mock_client(lambda r: (seen.append(r), httpx.Response(200, json=body))[1]),
                                             sleep=no_sleep, rate_interval=0)
        found = await client.lookup(Track('Opus (Original Mix)', 'Eric Prydz'))
        self.assertEqual(found[0].fields, {'bpm': 126.0, 'key': 'Am'})
        self.assertEqual(found[1].fields, {}, 'zero tempo and unparseable key are unknown')
        self.assertNotIn('SECRET', str(seen[0].url))
        self.assertEqual(seen[0].headers['x-api-key'], 'SECRET')
        self.assertEqual(query(seen[0])['type'], ['both'])
        self.assertIn('song:opus', query(seen[0])['lookup'][0])
        self.assertEqual((getsongbpm.ATTRIBUTION['url'], 'GetSongBPM' in getsongbpm.ATTRIBUTION['text']), ('https://getsongbpm.com', True))


class Discogs(unittest.IsolatedAsyncioTestCase):
    async def test_release_search_yields_genres_styles_and_label_only(self):
        seen = []
        body = {'results': [{'id': 1, 'title': 'Eric Prydz - Opus', 'genre': ['Electronic'], 'style': ['Progressive House', 'Electronic'],
                             'label': ['Pryda Recordings', 'Not On Label'], 'year': '2016'}, {'id': 2, 'title': 'Untitled'}]}
        client = discogs.DiscogsClient('TOKEN', client=mock_client(lambda r: (seen.append(r), httpx.Response(200, json=body))[1]),
                                       sleep=no_sleep, rate_interval=0)
        found = await client.lookup(Track('Opus (Extended Mix)', 'Eric Prydz'))
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0].fields, {'genre': ['Electronic', 'Progressive House'], 'record_label': 'Pryda Recordings'})
        self.assertEqual(found[0].confidence, 0.6)
        self.assertEqual(seen[0].headers['Authorization'], 'Discogs token=TOKEN')
        self.assertNotIn('TOKEN', str(seen[0].url))
        self.assertEqual((query(seen[0])['artist'], query(seen[0])['track'], query(seen[0])['type']),
                         (['Eric Prydz'], ['opus'], ['release']), 'the version suffix is dropped from the track filter')
        with self.assertRaises(base.ProviderDisabled):
            await discogs.DiscogsClient(None, client=mock_client(lambda r: httpx.Response(500))).lookup(Track('x', 'y'))


class LastFm(unittest.IsolatedAsyncioTestCase):
    def client(self, body, **kwargs):
        self.seen = []
        return lastfm.LastFmClient('KEY', client=mock_client(lambda r: (self.seen.append(r), httpx.Response(200, json=body))[1]),
                                   sleep=no_sleep, rate_interval=0, **kwargs)

    async def test_https_base_and_genre_cleaning(self):
        tags = {'toptags': {'tag': [{'name': 'seen live', 'count': 100}, {'name': 'House', 'count': 90}, {'name': 'Trance', 'count': 40}]}}
        found = await self.client(tags).lookup(Track('Opus', 'Eric Prydz'))
        self.assertEqual(found[0].fields, {'genre': ['House', 'Trance']})
        self.assertEqual((self.seen[0].url.scheme, self.seen[0].url.host), ('https', 'ws.audioscrobbler.com'))
        self.assertEqual(query(self.seen[0])['method'], ['track.gettoptags'])
        self.assertEqual(found[0].confidence, 0.5)

    async def test_single_tag_dict_not_found_and_errors(self):
        single = {'toptags': {'tag': {'name': 'Techno', 'count': 70}}}
        self.assertEqual((await self.client(single).lookup(Track('x', 'y')))[0].fields['genre'], ['Techno'])
        self.assertEqual(await self.client({'error': 6, 'message': 'Track not found'}).lookup(Track('x', 'y')), [])
        with self.assertRaises(base.ProviderError):
            await self.client({'error': 10, 'message': 'Invalid API key'}).lookup(Track('x', 'y'))
        with self.assertRaises(base.ProviderDisabled):
            await lastfm.LastFmClient(None, client=mock_client(lambda r: httpx.Response(500))).lookup(Track('x', 'y'))

    async def test_rate_limit_error_29_is_retried(self):
        state = {'n': 0}

        def handle(request):
            state['n'] += 1
            return httpx.Response(200, json={'error': 29, 'message': 'Rate limit exceeded'} if state['n'] == 1
                                  else {'toptags': {'tag': [{'name': 'House', 'count': 50}]}})

        client = lastfm.LastFmClient('K', client=mock_client(handle), sleep=no_sleep, rate_interval=0)
        self.assertEqual(len(await client.lookup(Track('x', 'y'))), 1)
        self.assertEqual(state['n'], 2)


class Registry(unittest.TestCase):
    SHARED = mock_client(lambda request: httpx.Response(500))

    def build(self, env):
        return registry.build_providers(env, client=self.SHARED)

    def test_only_configured_providers_are_built_in_priority_order(self):
        self.assertEqual([p.name for p in self.build({})], ['deezer', 'musicbrainz'])
        full = self.build({'TIDAL_CLIENT_ID': 'i', 'TIDAL_CLIENT_SECRET': 's', 'DISCOGS_TOKEN': 'd',
                           'LASTFM_API_KEY': 'l', 'GETSONGBPM_API_KEY': 'g', 'GETSONGBPM_ENABLED': 'true'})
        self.assertEqual([p.name for p in full], ['tidal', 'deezer', 'musicbrainz', 'discogs', 'lastfm', 'getsongbpm'])
        self.assertEqual(full[0].country_code, 'AU', 'TIDAL_COUNTRY_CODE defaults to AU')
        configured = self.build({'TIDAL_CLIENT_ID': 'i', 'TIDAL_CLIENT_SECRET': 's', 'TIDAL_COUNTRY_CODE': 'US'})
        self.assertEqual(configured[0].country_code, 'US')

    def test_helm_placeholder_credentials_do_not_enable_a_provider(self):
        env = {'TIDAL_CLIENT_ID': 'CHANGE_ME', 'TIDAL_CLIENT_SECRET': 'CHANGE_ME', 'LASTFM_API_KEY': 'CHANGE_ME_lastfm',
               'DISCOGS_API_TOKEN': 'change_me', 'GETSONGBPM_API_KEY': 'CHANGE_ME', 'GETSONGBPM_ENABLED': 'true'}
        self.assertEqual([p.name for p in self.build(env)], ['deezer', 'musicbrainz'])

    def test_discogs_accepts_the_helm_secret_name(self):
        self.assertEqual([p.name for p in self.build({'DISCOGS_API_TOKEN': 't'})], ['deezer', 'musicbrainz', 'discogs'])
        self.assertEqual([p.name for p in self.build({'DISCOGS_TOKEN': 't'})], ['deezer', 'musicbrainz', 'discogs'])

    def test_getsongbpm_needs_both_key_and_explicit_enablement(self):
        names = lambda env: [p.name for p in self.build(env)]  # noqa: E731
        self.assertNotIn('getsongbpm', names({'GETSONGBPM_API_KEY': 'g'}))
        self.assertNotIn('getsongbpm', names({'GETSONGBPM_ENABLED': 'true'}))
        self.assertIn('getsongbpm', names({'GETSONGBPM_API_KEY': 'g', 'GETSONGBPM_ENABLED': '1'}))

    def test_enrichment_providers_switch_restricts_or_disables_outbound_calls(self):
        env = {'TIDAL_CLIENT_ID': 'i', 'TIDAL_CLIENT_SECRET': 's', 'LASTFM_API_KEY': 'l'}
        names = lambda extra: [p.name for p in self.build({**env, **extra})]  # noqa: E731
        self.assertEqual(names({}), ['tidal', 'deezer', 'musicbrainz', 'lastfm'])
        self.assertEqual(names({'ENRICHMENT_PROVIDERS': 'tidal, lastfm'}), ['tidal', 'lastfm'])
        self.assertEqual(names({'ENRICHMENT_PROVIDERS': 'none'}), [], 'none disables every provider')
        self.assertEqual(names({'ENRICHMENT_PROVIDERS': 'discogs'}), [], 'a listed but unconfigured provider is not built')

    def test_shared_upstreams_can_be_grouped(self):
        providers = self.build({'PROVIDER_GROUPS': 'musicbrainz=deezer', 'LASTFM_API_KEY': 'l'})
        groups = {p.name: p.independent_group for p in providers}
        self.assertEqual((groups['musicbrainz'], groups['deezer'], groups['lastfm']), ('deezer', 'deezer', 'lastfm'))


class RateLimiter(unittest.IsolatedAsyncioTestCase):
    async def test_spacing_is_enforced(self):
        now, waits = [0.0], []

        async def sleep(delay):
            waits.append(round(delay, 3))
            now[0] += delay

        limiter = base.RateLimiter(1.0, clock=lambda: now[0], sleep=sleep)
        for _ in range(3):
            await limiter.wait()
        self.assertEqual(waits, [1.0, 1.0])

    async def test_cache_expires(self):
        now = [0.0]
        cache = base.MemoryCache(clock=lambda: now[0])
        await cache.set('k', 'v', 10)
        self.assertEqual(await cache.get('k'), 'v')
        now[0] = 11
        self.assertIsNone(await cache.get('k'))


if __name__ == '__main__':
    unittest.main()
