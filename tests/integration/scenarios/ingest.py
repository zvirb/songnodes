from common.datalayer import ingest, outbox

CLEAN_PLAYLISTS = []
DJ = f'DJ Ingest {MARKER}'


def name(label):
    return f'{label} {MARKER}'


async def bronze_playlist(conn, label, entries, *, dj=DJ, declared=None, raw_tracks=False, source='fixture'):
    """Insert a synthetic bronze playlist. entries: (position, artist, title[, raw]). `raw_tracks` stores them in raw_json only."""
    playlist = uuid.uuid4()
    raw = {'total_tracks': declared} if declared is not None else {}
    if raw_tracks:
        raw['tracks'] = [{'position': e[0], 'artist': e[1], 'title': e[2]} for e in entries]
    await conn.execute("""INSERT INTO bronze_scraped_playlists (id, source, source_url, source_playlist_id, scraper_version, raw_json,
                              playlist_name, artist_name, event_date)
                          VALUES ($1, $2, $3, $4, 'test', $5::jsonb, $6, $7, '2026-01-02')""",
                       playlist, source, f'https://example.invalid/{MARKER}/{label}', label, json.dumps(raw), name(label), dj)
    CLEAN_PLAYLISTS.append(playlist)
    if not raw_tracks:
        for entry in entries:
            position, artist, title = entry[:3]
            payload = entry[3] if len(entry) > 3 else {}
            await conn.execute("""INSERT INTO bronze_scraped_tracks (source, source_url, source_track_id, scraper_version, raw_json,
                                      artist_name, track_title, playlist_id, position)
                                  VALUES ($1, $2, $3, 'test', $4::jsonb, $5, $6, $7, $8)""",
                               source, f'https://example.invalid/{MARKER}/{label}', f'{label}-{position}', json.dumps(payload),
                               artist, title, playlist, position)
    return playlist


async def edges(conn):
    rows = await conn.fetch("""SELECT a.track_title AS a, b.track_title AS b, x.occurrence_count AS n FROM silver_track_transitions x
                               JOIN silver_enriched_tracks a ON a.id = x.from_track_id JOIN silver_enriched_tracks b ON b.id = x.to_track_id
                               WHERE a.track_title LIKE $1 ORDER BY 1, 2""", f'%{MARKER}')
    return [(r['a'].replace(f' {MARKER}', ''), r['b'].replace(f' {MARKER}', ''), r['n']) for r in rows]


async def count(conn, table, column, pattern):
    return await conn.fetchval(f'SELECT count(*) FROM {table} WHERE {column} LIKE $1', pattern)


async def main():
    conn = await connect()
    A = f'Artist A {MARKER}'
    B = f'Artist B {MARKER}'
    try:
        # --- a complete playlist: invalid artist at position 3 breaks the chain, the rest links up
        p1 = await bronze_playlist(conn, 'p1', [(1, A, name('one')), (2, A, name('two')), (3, 'Unknown Artist', name('hidden')),
                                                (4, B, name('four')), (5, B, name('five'))])
        out = await ingest.ingest_playlist(conn, p1)
        assert (out['status'], out['created'], out['failed'], out['transitions']) == ('ingested', 4, 1, 2), out
        assert [e['status'] for e in out['entries']] == ['created', 'created', 'failed', 'created', 'created']
        assert await edges(conn) == [('four', 'five', 1), ('one', 'two', 1)], await edges(conn)
        members = await conn.fetch('SELECT position FROM silver_playlist_tracks WHERE playlist_id = $1 ORDER BY position', uuid.UUID(out['silver_playlist_id']))
        assert [m['position'] for m in members] == [1, 2, 4, 5]
        playlist = await conn.fetchrow('SELECT * FROM silver_enriched_playlists WHERE bronze_id = $1', p1)
        assert (playlist['validation_status'], playlist['artist_name'], playlist['track_count']) == ('valid', DJ, 5)
        assert await count(conn, 'silver_enriched_artists', 'canonical_name', f'%{MARKER}') == 3, 'one canonical artist per name (A, B and the DJ)'

        # --- replay is a no-op
        again = await ingest.ingest_playlist(conn, p1)
        assert again['status'] == 'already_ingested'
        assert await edges(conn) == [('four', 'five', 1), ('one', 'two', 1)]

        # --- the same transition seen in another set increases the observation count
        p2 = await bronze_playlist(conn, 'p2', [(1, A, name('one')), (2, A, name('two')), (3, A, name('three'))])
        out = await ingest.ingest_playlist(conn, p2)
        assert (out['created'], out['updated'], out['transitions']) == (1, 2, 2), out
        assert await edges(conn) == [('four', 'five', 1), ('one', 'two', 2), ('two', 'three', 1)], await edges(conn)
        t1 = await conn.fetchrow("SELECT additional_bronze_ids FROM silver_enriched_tracks WHERE track_title = $1", name('one'))
        assert t1['additional_bronze_ids'], 'second source is kept as lineage'

        # --- incomplete playlists are recorded as failed and create nothing else
        gap = await bronze_playlist(conn, 'gap', [(1, A, name('g1')), (3, A, name('g3'))])
        out = await ingest.ingest_playlist(conn, gap)
        assert out['status'] == 'rejected' and out['errors']['reason'] == 'position_gap' and out['errors']['missing'] == [2], out
        assert await count(conn, 'silver_enriched_tracks', 'track_title', name('g%')) == 0
        failed = await conn.fetchrow('SELECT validation_status, enrichment_metadata FROM silver_enriched_playlists WHERE bronze_id = $1', gap)
        assert failed['validation_status'] == 'failed' and 'position_gap' in str(failed['enrichment_metadata'])
        assert (await ingest.ingest_playlist(conn, gap))['status'] == 'already_ingested', 'a rejected playlist is not retried forever'
        short = await bronze_playlist(conn, 'short', [(1, A, name('s1')), (2, A, name('s2'))], declared=10)
        assert (await ingest.ingest_playlist(conn, short))['errors']['reason'] == 'declared_count_exceeds_loaded'
        late = await bronze_playlist(conn, 'late', [(2, A, name('l2')), (3, A, name('l3'))])
        assert (await ingest.ingest_playlist(conn, late))['errors']['reason'] == 'position_gap', 'positions must start at 1'

        # --- raw_json fallback when only the playlist payload carries the tracks
        raw = await bronze_playlist(conn, 'raw', [(1, B, name('r1')), (2, B, name('r2'))], raw_tracks=True)
        out = await ingest.ingest_playlist(conn, raw)
        assert (out['status'], out['created'], out['transitions']) == ('ingested', 2, 1), out

        # --- provider-supplied metadata becomes evidence and flows to the track
        meta = await bronze_playlist(conn, 'meta', [
            (1, B, name('meta1'), {'bpm': 128, 'key': 'A minor', 'isrc': 'qm6mz2651268', 'genre': 'House', 'duration_ms': 300000}),
            (2, B, name('meta2'), {'bpm': 0, 'key': '???', 'energy': 0.9, 'valence': 0.4})], source='beatport')
        await ingest.ingest_playlist(conn, meta)
        m1 = await conn.fetchrow('SELECT bpm, key, camelot_key, isrc, genre, duration_ms FROM silver_enriched_tracks WHERE track_title = $1', name('meta1'))
        assert (int(m1['bpm']), m1['key'], m1['camelot_key'], m1['isrc'], list(m1['genre']), m1['duration_ms']) == (128, 'A minor', '8A', 'QM6MZ2651268', ['House'], 300000), dict(m1)
        m2 = await conn.fetchrow('SELECT bpm, key, camelot_key, energy, valence FROM silver_enriched_tracks WHERE track_title = $1', name('meta2'))
        assert (m2['bpm'], m2['key'], m2['camelot_key'], m2['energy'], m2['valence']) == (None, None, None, None, None), 'zero BPM, junk key and Spotify-style audio fields are not stored'
        sources = {r['source'] for r in await conn.fetch("SELECT DISTINCT e.source FROM silver_track_metadata_evidence e JOIN silver_enriched_tracks t ON t.id = e.track_id WHERE t.track_title = $1", name('meta1'))}
        assert sources == {'beatport'}, sources

        # --- adoption: a silver playlist the legacy pipeline already wrote is adopted without duplicating edges
        adopt = await bronze_playlist(conn, 'adopt', [(1, A, name('one')), (2, A, name('two'))])
        legacy = uuid.uuid4()
        await conn.execute("""INSERT INTO silver_enriched_playlists (id, bronze_id, playlist_name, artist_name, validation_status, enrichment_metadata)
                              VALUES ($1, $2, $3, $4, 'valid', '{}')""", legacy, adopt, name('adopt'), DJ)
        before = await edges(conn)
        out = await ingest.ingest_playlist(conn, adopt)
        assert out['status'] == 'ingested' and out['silver_playlist_id'] == str(legacy), out
        assert out['transitions'] == 1 and await edges(conn) != before, 'no edge references the adopted playlist yet, so it is created once'
        assert (await ingest.ingest_playlist(conn, adopt))['status'] == 'already_ingested'
        assert await conn.fetchval('SELECT count(*) FROM silver_enriched_playlists WHERE bronze_id = $1', adopt) == 1

        # --- pending ingestion handles only what is left, standalone tracks included
        solo = uuid.uuid4()
        await conn.execute("""INSERT INTO bronze_scraped_tracks (id, source, source_url, source_track_id, scraper_version, raw_json, artist_name, track_title)
                              VALUES ($1, 'chart', $2, 'solo', 'test', '{"bpm": 124}', $3, $4)""", solo, f'https://example.invalid/{MARKER}/solo', B, name('solo'))
        fresh = await bronze_playlist(conn, 'fresh', [(1, B, name('f1')), (2, B, name('f2'))])
        summary = await ingest.ingest_pending(conn, limit=500)
        assert summary['playlists']['rejected'] == 0 and summary['playlists']['ingested'] >= 1, summary
        assert await conn.fetchval('SELECT count(*) FROM silver_enriched_tracks WHERE bronze_id = $1', solo) == 1
        quiet = await ingest.ingest_pending(conn, limit=500)
        assert (quiet['playlists']['examined'], quiet['tracks']['examined']) == (0, 0), quiet

        # --- concurrent workers never create the same track twice
        c1, c2 = await connect(), await connect()
        shared = name('shared')
        x1 = await bronze_playlist(conn, 'x1', [(1, A, shared), (2, A, name('x1b'))])
        x2 = await bronze_playlist(conn, 'x2', [(1, A, shared), (2, A, name('x2b'))])
        await asyncio.gather(ingest.ingest_playlist(c1, x1), ingest.ingest_playlist(c2, x2))
        assert await conn.fetchval('SELECT count(*) FROM silver_enriched_tracks WHERE track_title = $1', shared) == 1
        await c1.close()
        await c2.close()
        print('SCENARIO-OK')
    finally:
        await conn.execute("DELETE FROM outbox_events WHERE payload::text LIKE $1 OR aggregate_id IN (SELECT id FROM silver_enriched_tracks WHERE track_title LIKE $1) OR aggregate_id IN (SELECT id FROM silver_enriched_playlists WHERE playlist_name LIKE $1)", f'%{MARKER}%')
        await conn.execute("DELETE FROM silver_enriched_playlists WHERE playlist_name LIKE $1 OR bronze_id = ANY($2::uuid[])", f'%{MARKER}', CLEAN_PLAYLISTS)
        await conn.execute("DELETE FROM silver_enriched_tracks WHERE track_title LIKE $1", f'%{MARKER}')
        await conn.execute("DELETE FROM silver_enriched_artists WHERE canonical_name LIKE $1", f'%{MARKER}')
        await conn.execute("DELETE FROM bronze_scraped_tracks WHERE source_url LIKE $1", f'%{MARKER}%')
        await conn.execute("DELETE FROM bronze_scraped_playlists WHERE source_url LIKE $1", f'%{MARKER}%')
        await conn.close()

asyncio.run(main())
