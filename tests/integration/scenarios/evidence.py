from decimal import Decimal

from common.datalayer import evidence, projection
from common.metadata import energy

ARTIST = f'Evidence Artist {MARKER}'
CLEAN = []


async def track(conn, title, metadata=None, **columns):
    track_id = uuid.uuid4()
    await conn.execute("""INSERT INTO silver_enriched_tracks (id, artist_name, track_title, validation_status,
                              enrichment_metadata) VALUES ($1, $2, $3, 'valid', $4::jsonb)""",
                       track_id, ARTIST, f'{title} {MARKER}', json.dumps(metadata or {}))
    for column, value in columns.items():
        await conn.execute(f'UPDATE silver_enriched_tracks SET {column} = $2 WHERE id = $1', track_id, value)
    CLEAN.append(track_id)
    return track_id


async def row(conn, track_id):
    return await conn.fetchrow('SELECT * FROM silver_enriched_tracks WHERE id = $1', track_id)


async def main():
    conn = await connect()
    try:
        # --- BPM / key consensus with a genre-justified fold and near-agreement dissent
        t = await track(conn, 'consensus', genre=['House'])
        for field, value, source in (('bpm', 128, 'deezer'), ('bpm', 128.3, 'getsongbpm'), ('bpm', 64, 'tidal'),
                                     ('key', 'A minor', 'tidal'), ('key', '8A', 'getsongbpm'), ('key', '9A', 'deezer')):
            assert await evidence.record(conn, t, field, value, source)
        assert not await evidence.record(conn, t, 'bpm', 128, 'deezer'), 're-recording the same value is not a new row'
        result = await evidence.apply_all(conn, t)
        r = await row(conn, t)
        assert result['consensus']['bpm']['status'] == 'consensus' and not result['consensus']['bpm']['review']
        assert int(r['bpm']) == 128, r['bpm']
        assert (r['key'], r['camelot_key']) == ('A minor', '8A'), (r['key'], r['camelot_key'])
        assert r['metadata_review'] and r['metadata_review_reasons'] == ['key_near'], r['metadata_review_reasons']
        conflicts = await conn.fetch('SELECT field FROM v_metadata_conflicts WHERE track_id = $1', t)
        assert [c['field'] for c in conflicts] == ['key'], conflicts

        # --- a manual correction outranks provider agreement and clears the BPM review reasons
        await evidence.record(conn, t, 'bpm', 126, 'manual', method='rest_api_patch')
        out = await evidence.apply_consensus(conn, t)
        r = await row(conn, t)
        assert (out['bpm']['status'], int(r['bpm'])) == ('manual', 126), out
        assert r['metadata_review_reasons'] == ['key_near'], r['metadata_review_reasons']

        # --- configured field resolution: ISRC priority, conflict review, then resolution clears it
        u = await track(conn, 'isrc')
        await evidence.record(conn, u, 'isrc', 'QM6MZ2651268', 'tidal')
        await evidence.record(conn, u, 'isrc', 'QM6MZ2651269', 'deezer')
        res = await evidence.apply_field(conn, u, 'isrc')
        r = await row(conn, u)
        assert (res.action, res.source, r['isrc']) == ('set', 'tidal', 'QM6MZ2651268')
        assert 'isrc_conflict' in r['metadata_review_reasons'] and r['metadata_review']
        await conn.execute("DELETE FROM silver_track_metadata_evidence WHERE track_id = $1 AND source = 'deezer'", u)
        await evidence.apply_field(conn, u, 'isrc')
        r = await row(conn, u)
        assert not r['metadata_review'] and r['metadata_review_reasons'] == [], dict(r)

        # --- a stronger existing value (manual) is not overwritten by a lower-priority source
        g = await track(conn, 'genre', genre=['Techno'])
        await evidence.record(conn, g, 'genre', ['Techno'], 'manual')
        await evidence.record(conn, g, 'genre', ['House'], 'discogs')
        res = await evidence.apply_field(conn, g, 'genre')
        assert res.action == 'keep_existing' and list((await row(conn, g))['genre']) == ['Techno'], res
        # legacy value of unknown origin is replaced by evidence
        legacy = await track(conn, 'legacy-label', record_label='Old Label')
        await evidence.record(conn, legacy, 'record_label', 'Anjunabeats', 'discogs')
        await evidence.apply_field(conn, legacy, 'record_label')
        assert (await row(conn, legacy))['record_label'] == 'Anjunabeats'
        # provider ids from confirmed matches
        await evidence.record(conn, legacy, 'tidal_id', '123456', 'tidal')
        await evidence.apply_field(conn, legacy, 'tidal_id')
        assert (await row(conn, legacy))['tidal_id'] == '123456'

        # --- canonical energy: manual rating beats provider and legacy; the band comes from the contract
        e = await track(conn, 'energy', energy=Decimal('0.30'))
        readings = [energy.legacy_reading(0.3), energy.reading(9, '1-10', 'provider', 'provider-x'),
                    energy.reading(7.5, '1-10', 'manual_rating', 'library')]
        out = await evidence.apply_energy(conn, e, readings)
        r = await row(conn, e)
        assert (out['value'], out['band'], r['energy_calibrated'], r['energy_source']) == ('7.5', 'peak', True, 'manual_rating'), out
        assert 'energy_conflict' in r['metadata_review_reasons'], 'provider 9.0 disagrees with manual 7.5 by more than 1.0'
        out = await evidence.apply_energy(conn, e, [energy.legacy_reading(None)])
        assert out['value'] is None and (await row(conn, e))['energy_canonical'] is None, 'unknown stays unknown'

        # --- Camelot repair: corrected / derived / unrecoverable / unchanged, idempotent, reversible
        wrong = await track(conn, 'camelot-wrong', {'camelot_key': '1A'}, key='A minor')
        derive = await track(conn, 'camelot-derive', key='C major')
        orphan = await track(conn, 'camelot-orphan', {'camelot_key': '5A'})
        same = await track(conn, 'camelot-same', {'camelot_key': '8A'}, key='A minor')
        first = await evidence.repair_camelot(conn, limit=1000)
        mine = {str(i): await conn.fetchrow('SELECT * FROM silver_camelot_corrections WHERE track_id = $1', i)
                for i in (wrong, derive, orphan, same)}
        assert {k: v['status'] for k, v in mine.items()} == {
            str(wrong): 'corrected', str(derive): 'derived', str(orphan): 'unrecoverable', str(same): 'unchanged'}, mine
        assert (await row(conn, wrong))['camelot_key'] == '8A' and mine[str(wrong)]['original_camelot'] == '1A'
        assert (await row(conn, derive))['camelot_key'] == '8B'
        o = await row(conn, orphan)
        assert o['camelot_key'] == '5A' and 'camelot_unverified' in o['metadata_review_reasons'] and o['metadata_review']
        again = await evidence.repair_camelot(conn, limit=1000)
        assert again['examined'] == 0, again
        assert await evidence.revert_camelot(conn, wrong) and (await row(conn, wrong))['camelot_key'] == '1A'
        assert not await evidence.revert_camelot(conn, wrong), 'already reverted'

        # --- projection sees canonical metadata through the outbox
        from common.datalayer import outbox
        consumer = f'test-{MARKER}'
        await outbox.skip_to_head(conn, consumer)
        await evidence.apply_all(conn, t)
        await outbox.drain(conn, consumer, projection.handle_event)
        p = await conn.fetchrow('SELECT bpm, camelot_key, metadata_review FROM projection_tracks WHERE track_id = $1', t)
        assert p is not None and p['camelot_key'] == '8A', p
        print('SCENARIO-OK')
    finally:
        await conn.execute("DELETE FROM outbox_events WHERE aggregate_id = ANY($1::uuid[])", CLEAN)
        await conn.execute("DELETE FROM outbox_consumers WHERE consumer = $1", f'test-{MARKER}')
        await conn.execute("DELETE FROM projection_tracks WHERE track_id = ANY($1::uuid[])", CLEAN)
        await conn.execute('DELETE FROM silver_enriched_tracks WHERE id = ANY($1::uuid[])', CLEAN)
        await conn.close()

asyncio.run(main())
