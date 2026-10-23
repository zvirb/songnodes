import httpx

from common.datalayer import backfill, enrichment, jobs, projection, runner
from common.datalayer.handlers import Context, RetryableError
from common.metadata.matching import Track
from common.providers.base import ProviderTrack, ProviderUnavailable

ARTIST = f'Worker Artist {MARKER}'
CLEAN = []
KIND_PREFIX = f'test-{MARKER}'


def name(label):
    return f'{label} {MARKER}'


class Fake:
    """A provider that returns canned candidates. `candidates` may be a list or a function of the target."""

    def __init__(self, provider, candidates, group=None, error=None):
        self.name, self.independent_group = provider, group or provider
        self.candidates, self.error, self.targets = candidates, error, []

    async def lookup(self, target, genres=None):
        self.targets.append(target)
        if self.error:
            raise self.error
        return self.candidates(target) if callable(self.candidates) else list(self.candidates)


def cand(provider, title, artist=ARTIST, isrc=None, duration=None, ref='r1', **fields):
    return ProviderTrack(provider, Track(title, artist, isrc, duration, ref), {**({'isrc': isrc} if isrc else {}),
                         **({'duration_ms': duration} if duration else {}), **fields})


async def track(conn, title, **columns):
    track_id = uuid.uuid4()
    await conn.execute("""INSERT INTO silver_enriched_tracks (id, artist_name, track_title, validation_status, enrichment_metadata)
                          VALUES ($1, $2, $3, 'valid', '{}')""", track_id, ARTIST, name(title))
    for column, value in columns.items():
        await conn.execute(f'UPDATE silver_enriched_tracks SET {column} = $2 WHERE id = $1', track_id, value)
    CLEAN.append(track_id)
    return track_id


async def row(conn, track_id):
    return await conn.fetchrow('SELECT * FROM silver_enriched_tracks WHERE id = $1', track_id)


async def main():
    conn = await connect()
    if await conn.fetchval('SELECT count(*) FROM silver_enriched_tracks') or await conn.fetchval('SELECT count(*) FROM projection_tracks'):
        # The backfill and the projection consumer act on the whole catalog; never run them against real data.
        print('SCENARIO-SKIP catalog is not empty')
        await conn.close()
        return
    owns_backfill = await conn.fetchval("SELECT NOT EXISTS(SELECT 1 FROM backfill_checkpoints WHERE name = 'enrichment_backfill')")
    owns_consumer = await conn.fetchval("SELECT NOT EXISTS(SELECT 1 FROM outbox_consumers WHERE consumer = 'projection_tracks')")
    try:
        # --- waterfall: TIDAL pins ISRC and duration, which then guard Deezer
        t = await track(conn, 'Strobe (Extended Mix)', bpm=120)
        tidal = Fake('tidal', [cand('tidal', name('Strobe (Extended Mix)'), isrc='QM6MZ2651268', duration=637000, ref='t1',
                                    tidal_id='t1', mix_name='Extended Mix', bpm=128.0, key='A minor')])
        wrong = cand('deezer', name('Strobe (Extended Mix)'), duration=202000, ref='d-short', deezer_id='d-short', bpm=99.0)
        right = cand('deezer', name('Strobe (Extended Mix)'), isrc='QM6MZ2651268', duration=637500, ref='d-long', deezer_id='d-long', bpm=128.2)
        deezer = Fake('deezer', [wrong, right])
        mb = Fake('musicbrainz', [cand('musicbrainz', name('Strobe (Extended Mix)'), isrc='QM6MZ2651268', duration=637000, ref='m1', musicbrainz_id='m1')])
        summary = await enrichment.enrich_track(conn, t, [tidal, deezer, mb])
        assert [m['provider'] for m in summary['matched']] == ['tidal', 'deezer', 'musicbrainz'], summary
        assert (deezer.targets[0].duration_ms, deezer.targets[0].isrc) == (637000, 'QM6MZ2651268'), 'first match pins duration and ISRC'
        r = await row(conn, t)
        assert (r['isrc'], r['duration_ms'], r['mix_name'], r['tidal_id'], r['deezer_id'], r['musicbrainz_id']) == \
            ('QM6MZ2651268', 637000, 'Extended Mix', 't1', 'd-long', 'm1'), dict(r)
        assert (int(r['bpm']), r['key'], r['camelot_key']) == (128, 'A minor', '8A'), 'TIDAL and Deezer agree on 128; legacy 120 does not vote'
        legacy = await conn.fetch("SELECT field, value FROM silver_track_metadata_evidence WHERE track_id = $1 AND source = 'legacy'", t)
        assert [(l['field'], l['value']) for l in legacy] == [('bpm', '120.0')], [(l['field'], l['value']) for l in legacy]
        assert not r['metadata_review'] and r['enriched_at'] is not None, r['metadata_review_reasons']
        again = await enrichment.enrich_track(conn, t, [tidal, deezer, mb])
        assert again['evidence'] == 0, 're-enrichment writes no duplicate evidence'
        assert await conn.fetchval("SELECT count(*) FROM silver_track_metadata_evidence WHERE track_id = $1 AND field = 'bpm' AND source <> 'legacy'", t) == 2

        # --- version-aware: a radio-edit target never takes the extended candidate
        radio = await track(conn, 'Opus (Radio Edit)')
        both = Fake('tidal', [cand('tidal', name('Opus (Extended Mix)'), duration=540000, ref='ext', tidal_id='ext'),
                              cand('tidal', name('Opus (Radio Edit)'), duration=200000, ref='rad', tidal_id='rad')])
        await enrichment.enrich_track(conn, radio, [both])
        assert (await row(conn, radio))['tidal_id'] == 'rad'

        # --- ambiguous unknown-duration candidates are review items, not evidence
        amb = await track(conn, 'Ambiguous')
        twin = Fake('deezer', [cand('deezer', name('Ambiguous'), ref='a', deezer_id='a'), cand('deezer', name('Ambiguous'), ref='b', deezer_id='b')])
        out = await enrichment.enrich_track(conn, amb, [twin])
        r = await row(conn, amb)
        assert out['review'][0]['reasons'] == ['ambiguous_multiple_matches'] and r['deezer_id'] is None
        assert r['metadata_review_reasons'] == ['match_review_deezer'] and r['metadata_review']
        out = await enrichment.enrich_track(conn, amb, [Fake('deezer', [cand('deezer', name('Ambiguous'), ref='a', deezer_id='a')])])
        r = await row(conn, amb)
        assert (out['matched'][0]['reasons'][-1], r['deezer_id'], r['metadata_review_reasons']) == ('unique_text_match_duration_unknown', 'a', []), (out, dict(r))

        # --- providers that are down or disabled are reported, never treated as "no match"
        down = await track(conn, 'Down')
        out = await enrichment.enrich_track(conn, down, [Fake('tidal', [], error=ProviderUnavailable('tidal', 'quota'))])
        assert out['unavailable'] and not out['matched'], out
        assert (await row(conn, down))['enriched_at'] is None, 'an outage is not an attempt; the track stays eligible'

        # --- backfill: resumable, stops at throttling without skipping the throttled track, completes idempotently
        batch = [await track(conn, f'Backfill {n}') for n in range(5)]
        batch.sort()
        throttle_at = {'id': None}

        async def flaky(conn_, track_id, providers):
            if str(track_id) == throttle_at['id']:
                return {'unavailable': True, 'matched': [], 'review': [], 'errors': {}}
            await conn_.execute("UPDATE silver_enriched_tracks SET bpm = 125, key = 'A minor', isrc = $2, tidal_id = 'x', deezer_id = 'y', enriched_at = NOW() WHERE id = $1",
                                track_id, f'USAAA{uuid.uuid4().int % 10**7:07d}')
            return {'unavailable': False, 'matched': [{'provider': 'tidal'}], 'review': [], 'errors': {}}

        await backfill.reset(conn, f'bf-{MARKER}')
        mine = set(CLEAN)
        throttle_at['id'] = str(batch[2])
        # the batch covers every missing track in the table; the catalog only contains this scenario's rows
        first = await backfill.run_batch(conn, [], 50, f'bf-{MARKER}', enrich=flaky)
        assert first['status'] == 'throttled' and first['unavailable_for'] == str(batch[2]), first
        cp = await backfill.checkpoint(conn, f'bf-{MARKER}')
        done_before = first['processed']
        assert cp['cursor']['after'] is not None and cp['processed'] == done_before and cp['status'] == 'running'
        throttle_at['id'] = None
        second = await backfill.run_batch(conn, [], 50, f'bf-{MARKER}', enrich=flaky)
        assert second['status'] == 'complete', second
        assert second['total_processed'] == done_before + second['processed']
        assert await conn.fetchval("SELECT count(*) FROM silver_enriched_tracks WHERE track_title LIKE $1 AND track_title LIKE 'Backfill%' AND bpm IS NULL", f'%{MARKER}') == 0
        third = await backfill.run_batch(conn, [], 50, f'bf-{MARKER}', enrich=flaky)
        assert (third['processed'], third['status']) == (0, 'complete'), 'a finished pass processes nothing twice'

        # --- jobs: retry then dead-letter, follow-up chaining with idempotent keys, projection catch-up
        ctx = Context(providers=lambda: [Fake('tidal', [cand('tidal', name('Job Track'), isrc='USAAA0000042', duration=180000, ref='j1', tidal_id='j1', bpm=124.0)])])
        job_track = await track(conn, 'Job Track')
        job, _ = await jobs.enqueue(conn, 'enrich_track', f'{KIND_PREFIX}-ok', {'track_id': str(job_track)})
        outcome = await runner.run_one(conn, ctx, ['enrich_track'])
        assert outcome['status'] == 'succeeded' and outcome['result']['matched'][0]['provider'] == 'tidal', outcome
        assert (await row(conn, job_track))['tidal_id'] == 'j1'

        bad, _ = await jobs.enqueue(conn, 'enrich_track', f'{KIND_PREFIX}-bad', {'track_id': 'not-a-uuid'}, max_attempts=2)
        first_try = await runner.run_one(conn, ctx, ['enrich_track'])
        assert first_try['status'] == 'queued' and 'payload.track_id' in first_try['error'], first_try
        await conn.execute('UPDATE ingestion_jobs SET run_after = NOW() WHERE id = $1', bad['id'])
        assert (await runner.run_one(conn, ctx, ['enrich_track']))['status'] == 'dead'
        assert await runner.run_one(conn, ctx, ['enrich_track']) is None

        # scrape: unreachable scraper is retried (transient), success enqueues ingest exactly once
        def scraper(request):
            body = json.loads(request.content)
            assert body == {'spider_name': 'mixesdb', 'search_params': {'search_query': 'Deadmau5 Strobe', 'limit': 2}}, body
            return httpx.Response(200, json={'status': 'started', 'task_id': 'x'})

        http_ok = Context(http=httpx.AsyncClient(transport=httpx.MockTransport(scraper)), scraper_url='http://scraper.test')
        scrape, _ = await jobs.enqueue(conn, 'scrape', f'{KIND_PREFIX}-scrape', {'source': 'mixesdb', 'search_query': 'Deadmau5 Strobe', 'limit': 2})
        done = await runner.run_one(conn, http_ok, ['scrape'])
        assert done['status'] == 'succeeded' and done['enqueued'] == ['ingest_pending'], done
        follow = await conn.fetchrow("SELECT * FROM ingestion_jobs WHERE idempotency_key = $1", f'ingest-after-scrape:{scrape["id"]}')
        assert follow is not None and follow['kind'] == 'ingest_pending'

        def refuse(request):
            raise httpx.ConnectError('refused')

        http_down = Context(http=httpx.AsyncClient(transport=httpx.MockTransport(refuse)))
        retry, _ = await jobs.enqueue(conn, 'scrape', f'{KIND_PREFIX}-down', {'search_query': 'x y'})
        out = await runner.run_one(conn, http_down, ['scrape'])
        assert out['status'] == 'queued' and out['transient'] and 'unreachable' in out['error'], out
        missing_query, _ = await jobs.enqueue(conn, 'scrape', f'{KIND_PREFIX}-noq', {}, max_attempts=1)
        assert (await runner.run_one(conn, http_ok, ['scrape']))['status'] == 'dead'

        # ingest -> projection chain with a real bronze playlist
        bronze = uuid.uuid4()
        await conn.execute("""INSERT INTO bronze_scraped_playlists (id, source, source_url, source_playlist_id, scraper_version, raw_json, playlist_name, artist_name)
                              VALUES ($1, 'fixture', $2, 'chain', 'test', '{}', $3, $4)""", bronze, f'https://example.invalid/{MARKER}/chain', name('Chain Set'), f'DJ Worker {MARKER}')
        for position, title in ((1, 'Chain One'), (2, 'Chain Two')):
            await conn.execute("""INSERT INTO bronze_scraped_tracks (source, source_url, source_track_id, scraper_version, raw_json, artist_name, track_title, playlist_id, position)
                                  VALUES ('fixture', $1, $2, 'test', '{}', $3, $4, $5, $6)""", f'https://example.invalid/{MARKER}/chain', f'c{position}', ARTIST, name(title), bronze, position)
        await conn.execute("DELETE FROM outbox_consumers WHERE consumer = $1", projection.CONSUMER)
        ingest_job, _ = await jobs.enqueue(conn, 'ingest_pending', f'{KIND_PREFIX}-ingest', {'limit': 25})
        ran = await runner.run_until_idle(conn, Context(providers=lambda: []), ['ingest_pending', 'projection_consume', 'enrichment_backfill'], max_jobs=10)
        kinds = [o['kind'] for o in ran]
        assert kinds[0] == 'ingest_pending' and 'projection_consume' in kinds, kinds
        assert await conn.fetchval("SELECT count(*) FROM projection_tracks WHERE track_title = ANY($1::text[])", [name('Chain One'), name('Chain Two')]) == 2
        replay = await runner.run_one(conn, Context(), ['ingest_pending'])
        assert replay is None, 'no more ingest work is runnable'
        print('SCENARIO-OK')
    finally:
        await conn.execute("DELETE FROM ingestion_jobs WHERE idempotency_key LIKE $1 OR payload::text LIKE $1 OR idempotency_key LIKE ANY($2::text[])", f'%{MARKER}%',
                           ['ingest-after-scrape:%', 'proj-after-%', 'backfill-after-%', 'backfill-next:%', 'ingest-next:%'])
        await conn.execute("DELETE FROM backfill_checkpoints WHERE name = $1", f'bf-{MARKER}')
        await conn.execute("DELETE FROM outbox_events WHERE payload::text LIKE $1 OR aggregate_id IN (SELECT id FROM silver_enriched_tracks WHERE track_title LIKE $1) OR aggregate_id IN (SELECT id FROM silver_enriched_playlists WHERE playlist_name LIKE $1)", f'%{MARKER}%')
        await conn.execute("DELETE FROM projection_tracks WHERE track_title LIKE $1", f'%{MARKER}')
        await conn.execute("DELETE FROM silver_enriched_playlists WHERE playlist_name LIKE $1", f'%{MARKER}')
        await conn.execute("DELETE FROM silver_enriched_tracks WHERE track_title LIKE $1", f'%{MARKER}')
        await conn.execute("DELETE FROM silver_enriched_artists WHERE canonical_name LIKE $1", f'%{MARKER}')
        await conn.execute("DELETE FROM bronze_scraped_tracks WHERE source_url LIKE $1", f'%{MARKER}%')
        await conn.execute("DELETE FROM bronze_scraped_playlists WHERE source_url LIKE $1", f'%{MARKER}%')
        if owns_consumer:
            await conn.execute("DELETE FROM outbox_consumers WHERE consumer = 'projection_tracks'")
        if owns_backfill:
            await conn.execute("DELETE FROM backfill_checkpoints WHERE name = 'enrichment_backfill'")
        await conn.close()

asyncio.run(main())
