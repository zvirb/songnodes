"""AA2: the 'audio_analysis' job with a fake Deezer and a fake analyser (no network, no database)."""
import json
import os
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx

from common.datalayer import audio, handlers
from common.datalayer.handlers import Context, RetryableError
from common.metadata.matching import Track
from common.providers.base import ProviderTrack, ProviderUnavailable

AA1_RESULT = {'bpm': 124.0, 'raw_bpm': 62.0, 'bpm_confidence': 3.99, 'key_camelot': None, 'key_name': 'A minor',
              'key_confidence': 0.81, 'method': 'essentia_edma_rhythm2013', 'method_version': '1.0'}


class FakeDeezer:
    name = 'deezer'

    def __init__(self, previews):
        self.previews, self.calls = previews, []

    async def detail(self, track_id):
        self.calls.append(track_id)
        preview = self.previews.get(track_id)
        if isinstance(preview, Exception):
            raise preview
        return ProviderTrack('deezer', Track('t', 'a', None, None, track_id), {'deezer_id': track_id},
                             {'preview': preview, 'album_id': 1})

    async def aclose(self):
        pass


def analyser(result=AA1_RESULT, status=200):
    seen = []

    def handle(request):
        seen.append(json.loads(request.content))
        return httpx.Response(status, json=result)
    return httpx.AsyncClient(transport=httpx.MockTransport(handle)), seen


def row(deezer_id, bpm=None, key=None):
    return {'id': uuid4(), 'deezer_id': deezer_id, 'bpm': bpm, 'key': key}


def connection(rows):
    conn = AsyncMock()
    conn.fetch.return_value = rows
    conn.transaction = lambda: _Tx()
    return conn


class _Tx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


@patch.dict(os.environ, {'AUDIO_ANALYSIS_ENABLED': 'true'})
class AudioAnalysisJobTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.record = patch('common.datalayer.evidence.record', new_callable=AsyncMock).start()
        self.apply_all = patch('common.datalayer.evidence.apply_all', new_callable=AsyncMock).start()
        self.snapshot = patch('common.datalayer.evidence.snapshot_legacy', new_callable=AsyncMock).start()
        self.addCleanup(patch.stopall)

    async def test_records_bpm_and_camelot_key_as_audio_evidence(self):
        track = row('111')
        conn = connection([track])
        http, seen = analyser()
        result = await audio.run(conn, http=http, deezer=FakeDeezer({'111': 'https://cdnt-preview.dzcdn.net/x.mp3'}))
        self.assertEqual(result, {'enabled': True, 'selected': 1, 'analysed': 1, 'no_preview': 0, 'failed': 0})
        self.assertEqual(seen, [{'url': 'https://cdnt-preview.dzcdn.net/x.mp3'}])
        calls = {c.args[2]: c for c in self.record.await_args_list}
        self.assertEqual(calls['bpm'].args[3], 124.0)
        self.assertEqual(calls['key'].args[3], '8A')   # derived from the key name when key_camelot is empty
        for call in calls.values():
            self.assertEqual(call.args[1], track['id'])
            self.assertEqual(call.args[4], 'audio_analysis')
            self.assertEqual(call.kwargs['method'], 'audio')
            self.assertEqual(call.kwargs['method_version'], 'essentia_edma_rhythm2013/1.0')
            self.assertEqual(call.kwargs['independent_group'], 'audio_analysis')
            self.assertTrue(0 <= call.kwargs['confidence'] <= 1)
        self.assertEqual(calls['key'].kwargs['confidence'], 0.81)
        self.apply_all.assert_awaited_once_with(conn, track['id'])   # consensus writes the columns, not this job

    async def test_only_missing_fields_are_recorded(self):
        conn = connection([row('111', bpm=128.0)])
        http, _ = analyser()
        await audio.run(conn, http=http, deezer=FakeDeezer({'111': 'https://cdnt-preview.dzcdn.net/x.mp3'}))
        self.assertEqual([c.args[2] for c in self.record.await_args_list], ['key'])

    async def test_track_without_preview_is_skipped_and_counted(self):
        conn = connection([row('111'), row('222')])
        http, seen = analyser()
        result = await audio.run(conn, http=http, deezer=FakeDeezer({'111': None, '222': 'https://cdnt-preview.dzcdn.net/y.mp3'}))
        self.assertEqual((result['analysed'], result['no_preview'], result['failed']), (1, 1, 0))
        self.assertEqual(len(seen), 1)
        outcomes = [c.args[2] for c in conn.execute.await_args_list if 'audio_analysis' in c.args[0]]
        self.assertEqual(outcomes, ['no_preview', 'analysed'])

    async def test_clip_the_analyser_rejects_counts_as_failed(self):
        conn = connection([row('111')])
        http, _ = analyser({'detail': 'expired'}, status=502)
        result = await audio.run(conn, http=http, deezer=FakeDeezer({'111': 'https://cdnt-preview.dzcdn.net/x.mp3'}))
        self.assertEqual(result['failed'], 1)
        self.record.assert_not_awaited()
        self.apply_all.assert_not_awaited()

    async def test_disabled_flag_does_nothing(self):
        conn = connection([row('111')])
        deezer = FakeDeezer({'111': 'https://cdnt-preview.dzcdn.net/x.mp3'})
        with patch.dict(os.environ, {'AUDIO_ANALYSIS_ENABLED': 'false'}):
            result = await audio.run(conn, deezer=deezer)
        self.assertEqual(result['selected'], 0)
        conn.fetch.assert_not_awaited()
        self.assertEqual(deezer.calls, [])

    async def test_selection_puts_library_tracks_first_and_honours_limits(self):
        conn = connection([])
        with patch.dict(os.environ, {'AUDIO_ANALYSIS_PER_RUN': '7'}):
            await audio.run(conn, deezer=FakeDeezer({}))
        query, limit, days = conn.fetch.await_args.args
        order_by = query[query.index('ORDER BY'):]
        self.assertTrue(order_by.startswith('ORDER BY EXISTS (SELECT 1 FROM library.tracks'))
        self.assertIn('DESC, t.created_at', order_by)
        self.assertIn('t.bpm IS NULL OR t.key IS NULL', query)
        self.assertIn("e.source = 'audio_analysis'", query)
        self.assertEqual((limit, days), (7, 30))

    async def test_deezer_quota_before_any_work_is_retryable(self):
        conn = connection([row('111')])
        deezer = FakeDeezer({'111': ProviderUnavailable('deezer', 'gave up after 4 attempts')})
        ctx = Context(providers=lambda: [deezer], http=analyser()[0])
        with self.assertRaises(RetryableError):
            await handlers.HANDLERS['audio_analysis'](conn, ctx, {})

    async def test_handler_is_registered_and_returns_the_summary(self):
        conn = connection([row('111')])
        deezer = FakeDeezer({'111': 'https://cdnt-preview.dzcdn.net/x.mp3'})
        ctx = Context(providers=lambda: [deezer], http=analyser()[0])
        result = await handlers.HANDLERS['audio_analysis'](conn, ctx, {'job_id': 'x'})
        self.assertEqual(result['analysed'], 1)

    def test_confidence_is_scaled_into_0_to_1(self):
        self.assertEqual(audio.unit_confidence(5.32), 1.0)
        self.assertEqual(audio.unit_confidence(0.5), 0.5)
        self.assertIsNone(audio.unit_confidence(None))


if __name__ == '__main__':
    unittest.main()
