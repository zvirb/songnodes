from common.datalayer import errors, evidence, identity, outbox

ARTIST = f'Identity Artist {MARKER}'
CLEAN = []


async def track(conn, title, **columns):
    track_id = uuid.uuid4()
    await conn.execute("""INSERT INTO silver_enriched_tracks (id, artist_name, track_title, validation_status,
                              enrichment_metadata) VALUES ($1, $2, $3, 'valid', '{}')""", track_id, ARTIST, f'{title} {MARKER}')
    for column, value in columns.items():
        await conn.execute(f'UPDATE silver_enriched_tracks SET {column} = $2 WHERE id = $1', track_id, value)
    CLEAN.append(track_id)
    return track_id


async def edge(conn, a, b, count, note):
    await conn.execute("""INSERT INTO silver_track_transitions (from_track_id, to_track_id, occurrence_count, playlist_occurrences)
                          VALUES ($1, $2, $3, $4::jsonb)""", a, b, count, json.dumps([{'note': note}]))


async def state(conn, ids, playlist):
    tracks = [json.loads(r['j']) for r in await conn.fetch(
        "SELECT to_jsonb(t) - 'updated_at' AS j FROM silver_enriched_tracks t WHERE id = ANY($1::uuid[]) ORDER BY id", ids)]
    edges = [(str(r['from_track_id']), str(r['to_track_id']), r['occurrence_count'], r['playlist_occurrences'])
             for r in await conn.fetch('SELECT * FROM silver_track_transitions WHERE from_track_id = ANY($1::uuid[]) OR to_track_id = ANY($1::uuid[]) ORDER BY 1, 2', ids)]
    members = [(r['position'], str(r['track_id'])) for r in await conn.fetch(
        'SELECT position, track_id FROM silver_playlist_tracks WHERE playlist_id = $1 ORDER BY position, track_id', playlist)]
    evid = [(str(r['track_id']), r['field'], r['source'], r['value']) for r in await conn.fetch(
        'SELECT track_id, field, source, value FROM silver_track_metadata_evidence WHERE track_id = ANY($1::uuid[]) ORDER BY 1, 2, 3, 4', ids)]
    return {'tracks': tracks, 'edges': edges, 'members': members, 'evidence': evid}


async def main():
    conn = await connect()
    playlist = uuid.uuid4()
    try:
        survivor = await track(conn, 'survivor', bpm=128)
        duplicate = await track(conn, 'duplicate', isrc='SE1234567890', record_label='Anjuna')
        x = await track(conn, 'x')
        y = await track(conn, 'y')
        await conn.execute("""INSERT INTO silver_enriched_playlists (id, playlist_name, artist_name, validation_status, enrichment_metadata)
                              VALUES ($1, $2, $3, 'valid', '{}')""", playlist, f'Set {MARKER}', ARTIST)
        for position, member in ((1, survivor), (2, duplicate), (3, x)):
            await conn.execute('INSERT INTO silver_playlist_tracks (playlist_id, track_id, position) VALUES ($1, $2, $3)', playlist, member, position)
        await edge(conn, survivor, x, 2, 'S>X')
        await edge(conn, duplicate, x, 3, 'D>X')
        await edge(conn, y, duplicate, 1, 'Y>D')
        await edge(conn, duplicate, survivor, 4, 'D>S')   # becomes a self-loop and must be dropped
        await evidence.record(conn, duplicate, 'isrc', 'SE1234567890', 'tidal')
        await evidence.record(conn, duplicate, 'bpm', 128, 'deezer')
        await evidence.record(conn, survivor, 'bpm', 128, 'deezer')   # identical row already on the survivor
        ids = [survivor, duplicate, x, y]
        before = await state(conn, ids, playlist)

        history = await identity.merge_tracks(conn, survivor, duplicate, 'test merge')

        after = await state(conn, ids, playlist)
        assert await conn.fetchval('SELECT count(*) FROM silver_enriched_tracks WHERE id = $1', duplicate) == 0
        s = (await conn.fetchrow('SELECT isrc, record_label, bpm FROM silver_enriched_tracks WHERE id = $1', survivor))
        assert (s['isrc'], s['record_label'], int(s['bpm'])) == ('SE1234567890', 'Anjuna', 128), 'survivor inherits missing values only'
        edges = {(a, b): (count, occ) for a, b, count, occ in after['edges']}
        key_sx, key_ys = (str(survivor), str(x)), (str(y), str(survivor))
        assert edges[key_sx][0] == 5 and len(json.loads(edges[key_sx][1])) == 2, edges
        assert edges[key_ys][0] == 1 and (str(survivor), str(survivor)) not in edges and len(edges) == 2, edges
        assert after['members'] == [(1, str(survivor)), (2, str(survivor)), (3, str(x))], after['members']
        assert ('isrc' in {e[1] for e in after['evidence'] if e[0] == str(survivor)}), 'evidence follows the survivor'
        assert await identity.resolve_id(conn, 'track', duplicate) == survivor
        assert await identity.resolve_id(conn, 'track', survivor) == survivor
        kinds = [r['event_type'] for r in await conn.fetch(
            "SELECT event_type FROM outbox_events WHERE aggregate_id = ANY($1::uuid[]) ORDER BY id", [survivor, duplicate])]
        assert 'merged' in kinds and 'updated' in kinds, kinds

        # Unmerge restores the exact earlier state.
        await identity.unmerge_tracks(conn, history)
        restored = await state(conn, ids, playlist)
        for name in ('tracks', 'edges', 'members', 'evidence'):
            assert restored[name] == before[name], (name, restored[name], before[name])
        assert await identity.resolve_id(conn, 'track', duplicate) == duplicate
        try:
            await identity.unmerge_tracks(conn, history)
            raise AssertionError('second unmerge must fail')
        except errors.CatalogError as error:
            assert error.status == 409

        # Later activity on a merged edge blocks unmerge instead of silently losing it.
        history = await identity.merge_tracks(conn, survivor, duplicate, 'second merge')
        await conn.execute('UPDATE silver_track_transitions SET occurrence_count = occurrence_count + 1, updated_at = NOW() + interval \'1 second\' WHERE from_track_id = $1 AND to_track_id = $2', survivor, x)
        try:
            await identity.unmerge_tracks(conn, history)
            raise AssertionError('unmerge after later edge activity must be refused')
        except errors.CatalogError as error:
            assert error.status == 409 and 'Transitions changed' in error.detail

        # Redirect chains flatten: merging the survivor onward keeps old ids resolvable.
        target = await track(conn, 'target')
        await identity.merge_tracks(conn, target, survivor, 'chain')
        assert await identity.resolve_id(conn, 'track', duplicate) == target
        assert await identity.resolve_id(conn, 'track', survivor) == target
        assert await conn.fetchval("SELECT count(*) FROM entity_redirects WHERE entity_type = 'track' AND old_id = ANY($1::uuid[])", [duplicate, survivor]) == 2
        assert [(r['position']) for r in await conn.fetch('SELECT position FROM silver_playlist_tracks WHERE playlist_id = $1 ORDER BY position', playlist)] == [1, 2, 3], 'set order survives chained merges'
        try:
            await identity.merge_tracks(conn, target, target)
            raise AssertionError('self merge must fail')
        except errors.CatalogError as error:
            assert error.status == 400
        print('SCENARIO-OK')
    finally:
        await conn.execute("DELETE FROM outbox_events WHERE aggregate_id = ANY($1::uuid[]) OR payload::text LIKE $2", CLEAN, f'%{MARKER}%')
        await conn.execute("DELETE FROM entity_redirects WHERE old_id = ANY($1::uuid[]) OR new_id = ANY($1::uuid[])", CLEAN)
        await conn.execute("DELETE FROM entity_merge_history WHERE survivor_id = ANY($1::uuid[]) OR duplicate_id = ANY($1::uuid[])", CLEAN)
        await conn.execute('DELETE FROM silver_enriched_playlists WHERE id = $1', playlist)
        await conn.execute('DELETE FROM silver_enriched_tracks WHERE id = ANY($1::uuid[])', CLEAN)
        await conn.close()

asyncio.run(main())
