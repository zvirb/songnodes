from common.datalayer import er, identity

CLEAN = []


def name(label):
    return f'{label} {MARKER}'


async def track(conn, artist, title, duration=None, isrc=None):
    track_id = uuid.uuid4()
    await conn.execute("""INSERT INTO silver_enriched_tracks (id, artist_name, track_title, duration_ms, isrc, validation_status, enrichment_metadata)
                          VALUES ($1, $2, $3, $4, $5, 'valid', '{}')""", track_id, artist, name(title), duration, isrc)
    CLEAN.append(track_id)
    return track_id


async def decisions(conn):
    rows = await conn.fetch("""SELECT d.*, l.track_title AS lt, r.track_title AS rt FROM er_decisions d
                               JOIN silver_enriched_tracks l ON l.id = d.left_id JOIN silver_enriched_tracks r ON r.id = d.right_id
                               WHERE l.track_title LIKE $1 ORDER BY d.score DESC, d.id""", f'%{MARKER}')
    return rows


async def main():
    conn = await connect()
    if await conn.fetchval('SELECT count(*) FROM silver_enriched_tracks') or await conn.fetchval("SELECT count(*) FROM backfill_checkpoints WHERE name = $1", er.CHECKPOINT):
        print('SCENARIO-SKIP catalog is not empty')
        await conn.close()
        return
    A, B = f'Resolve A {MARKER}', f'Resolve B {MARKER}'
    try:
        a1 = await track(conn, A, 'Strobe', 600000)
        a2 = await track(conn, A, 'strobe', 600100)
        radio = await track(conn, A, 'Strobe (Radio Edit)', 200000)
        c = await track(conn, B, 'Phoebus Apollo', 400000)
        d = await track(conn, B, 'Phoebus Apolo', 400100)
        e = await track(conn, B, 'Different Song', 400100)
        lonely = await track(conn, f'Resolve Solo {MARKER}', 'Only One', 100)

        # --- shadow run is resumable by artist and records pairs without merging anything
        first = await er.run_shadow(conn, max_artists=1)
        assert first['artists'] == 1 and first['status'] == 'running', first
        rest = await er.run_shadow(conn, max_artists=10)
        assert rest['status'] == 'complete', rest
        rows = await decisions(conn)
        by_pair = {frozenset((r['lt'].replace(f' {MARKER}', ''), r['rt'].replace(f' {MARKER}', ''))): r for r in rows}
        assert by_pair[frozenset(('Strobe', 'strobe'))]['decision'] == 'auto_match'
        assert by_pair[frozenset(('Phoebus Apollo', 'Phoebus Apolo'))]['decision'] == 'review', 'one-letter typo is review, never automatic'
        assert frozenset(('Strobe', 'Strobe (Radio Edit)')) not in by_pair, 'a different version is rejected and not recorded'
        assert all(r['mode'] == 'shadow' and r['reviewed_outcome'] is None for r in rows)
        assert await conn.fetchval('SELECT count(*) FROM silver_enriched_tracks WHERE track_title LIKE $1', f'%{MARKER}') == 7, 'shadow mode merges nothing'
        again = await er.run_shadow(conn, max_artists=100)
        assert (await conn.fetchval('SELECT count(*) FROM er_decisions WHERE left_id = ANY($1::uuid[])', CLEAN)) == len(rows), 'rescoring is idempotent'
        assert again['status'] == 'running' or again['status'] == 'complete'

        # --- review queue lists both, most similar first
        queue = await er.pending_review(conn, 50)
        mine = [q for q in queue if q['left_title'] and MARKER in q['left_title']]
        assert [q['decision'] for q in mine][0] == 'auto_match' and len(mine) == 2, [dict(q) for q in mine]

        # --- a human verdict of "same" promotes through the reversible merge; "different" blocks the pair
        typo = by_pair[frozenset(('Phoebus Apollo', 'Phoebus Apolo'))]
        verdict = await er.review(conn, typo['id'], 'same')
        assert verdict['merge_history_id'] is not None
        survivor = await conn.fetchval("SELECT survivor_id FROM entity_merge_history WHERE id = $1", verdict['merge_history_id'])
        assert survivor in (c, d) and await identity.resolve_id(conn, 'track', c if survivor == d else d) == survivor
        assert await conn.fetchval("SELECT mode FROM er_decisions WHERE id = $1", typo['id']) == 'active'
        try:
            await er.review(conn, typo['id'], 'different')
            raise AssertionError('a reviewed decision cannot be reviewed twice')
        except er.CatalogError as error:
            assert error.status == 409
        auto = by_pair[frozenset(('Strobe', 'strobe'))]
        await er.review(conn, auto['id'], 'different')
        assert await conn.fetchval('SELECT count(*) FROM silver_enriched_tracks WHERE id = ANY($1::uuid[])', [a1, a2]) == 2, '"different" never merges'
        # a reviewed verdict survives re-scoring
        await conn.execute("DELETE FROM backfill_checkpoints WHERE name = $1", er.CHECKPOINT)
        await er.run_shadow(conn, max_artists=100)
        assert await conn.fetchval('SELECT reviewed_outcome FROM er_decisions WHERE id = $1', auto['id']) == 'different'
        # and the merge is reversible
        await identity.unmerge_tracks(conn, verdict['merge_history_id'])
        assert await conn.fetchval('SELECT count(*) FROM silver_enriched_tracks WHERE id = ANY($1::uuid[])', [c, d]) == 2
        for bad in ('maybe', ''):
            try:
                await er.review(conn, auto['id'], bad)
                raise AssertionError('invalid outcome')
            except er.CatalogError as error:
                assert error.status == 422
        try:
            await er.review(conn, 999999999, 'same')
            raise AssertionError('unknown decision')
        except er.CatalogError as error:
            assert error.status == 404
        print('SCENARIO-OK')
    finally:
        await conn.execute("DELETE FROM outbox_events WHERE aggregate_id = ANY($1::uuid[]) OR payload::text LIKE $2", CLEAN, f'%{MARKER}%')
        await conn.execute("DELETE FROM entity_redirects WHERE old_id = ANY($1::uuid[]) OR new_id = ANY($1::uuid[])", CLEAN)
        await conn.execute("DELETE FROM entity_merge_history WHERE survivor_id = ANY($1::uuid[]) OR duplicate_id = ANY($1::uuid[])", CLEAN)
        await conn.execute("DELETE FROM er_decisions WHERE left_id = ANY($1::uuid[]) OR right_id = ANY($1::uuid[])", CLEAN)
        await conn.execute("DELETE FROM silver_enriched_tracks WHERE id = ANY($1::uuid[])", CLEAN)
        await conn.execute("DELETE FROM backfill_checkpoints WHERE name = $1", er.CHECKPOINT)
        await conn.close()

asyncio.run(main())
