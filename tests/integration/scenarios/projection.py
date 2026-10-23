from decimal import Decimal

from common.datalayer import outbox, projection

CONSUMER = f'test-{MARKER}'
CREATED = []
ARTIST = f'Projection Artist {MARKER}'


async def track(conn, title, **columns):
    track_id = uuid.uuid4()
    await conn.execute("""INSERT INTO silver_enriched_tracks (id, artist_name, track_title, validation_status,
                              enrichment_metadata) VALUES ($1, $2, $3, 'valid', '{}')""", track_id, ARTIST, f'{title} {MARKER}')
    for column, value in columns.items():
        await conn.execute(f'UPDATE silver_enriched_tracks SET {column} = $2 WHERE id = $1', track_id, value)
    await outbox.append(conn, 'track', track_id, 'created')
    CREATED.append(track_id)
    return track_id


async def proj(conn, track_id):
    return await conn.fetchrow('SELECT * FROM projection_tracks WHERE track_id = $1', track_id)


async def main():
    conn = await connect()
    created = []
    owns_consumer = False
    if await conn.fetchval('SELECT count(*) FROM silver_enriched_tracks') or await conn.fetchval('SELECT count(*) FROM projection_tracks'):
        # rebuild() and reconcile() act on the whole table; never run them against a populated catalog.
        print('SCENARIO-SKIP catalog is not empty')
        await conn.close()
        return
    owns_consumer = await conn.fetchval("SELECT NOT EXISTS(SELECT 1 FROM outbox_consumers WHERE consumer = 'projection_tracks')")
    try:
        await outbox.skip_to_head(conn, CONSUMER)
        legacy = await track(conn, 'legacy', energy=Decimal('0.80'), bpm=Decimal('128'))
        manual = await track(conn, 'manual', energy_canonical=Decimal('8.5'), energy_source='manual_rating',
                             energy_calibrated=True, energy_contract_version='energy-1')
        unknown = await track(conn, 'unknown')
        await outbox.drain(conn, CONSUMER, projection.handle_event)

        p = await proj(conn, legacy)
        assert (p['energy_canonical'], p['energy_band'], p['energy_calibrated']) == (Decimal('8.2'), None, False), dict(p)
        assert p['bpm'] == Decimal('128.00') and p['energy_contract_version'] == 'energy-1'
        p = await proj(conn, manual)
        assert (p['energy_canonical'], p['energy_band'], p['energy_calibrated']) == (Decimal('8.5'), 'peak', True), dict(p)
        p = await proj(conn, unknown)
        assert (p['energy_canonical'], p['energy_band'], p['energy_calibrated'], p['energy_contract_version']) == (None, None, None, None)

        # Updates and replays are idempotent.
        await conn.execute("UPDATE silver_enriched_tracks SET bpm = 124, updated_at = NOW() WHERE id = $1", unknown)
        await outbox.append(conn, 'track', unknown, 'updated')
        await outbox.append(conn, 'track', unknown, 'updated')
        await outbox.drain(conn, CONSUMER, projection.handle_event)
        assert (await proj(conn, unknown))['bpm'] == Decimal('124.00')
        assert await conn.fetchval('SELECT count(*) FROM projection_tracks WHERE artist_name = $1', ARTIST) == 3

        # Deletion removes the row.
        await conn.execute('DELETE FROM silver_enriched_tracks WHERE id = $1', unknown)
        await outbox.append(conn, 'track', unknown, 'deleted')
        await outbox.drain(conn, CONSUMER, projection.handle_event)
        assert await proj(conn, unknown) is None

        # Artist rename re-projects that artist's tracks by name.
        renamed = f'Renamed {MARKER}'
        await conn.execute('UPDATE silver_enriched_tracks SET artist_name = $2, updated_at = NOW() WHERE artist_name = $1', ARTIST, renamed)
        await outbox.append(conn, 'artist', uuid.uuid4(), 'renamed', {'old_name': ARTIST, 'new_name': renamed})
        await outbox.drain(conn, CONSUMER, projection.handle_event)
        assert (await proj(conn, manual))['artist_name'] == renamed

        # Reconcile finds missing, extra and stale rows, and repairs them.
        await conn.execute('DELETE FROM projection_tracks WHERE track_id = $1', manual)
        extra = uuid.uuid4()
        await conn.execute("INSERT INTO projection_tracks (track_id, artist_name, track_title) VALUES ($1, 'ghost', 'ghost')", extra)
        await conn.execute("UPDATE silver_enriched_tracks SET bpm = 130, updated_at = NOW() WHERE id = $1", legacy)
        report = await projection.reconcile(conn)
        assert (report['missing'], report['extra'], report['stale']) == (1, 1, 1), report
        repaired = await projection.reconcile(conn, repair=True)
        assert repaired['repaired'] == 3
        clean = await projection.reconcile(conn)
        assert (clean['missing'], clean['extra'], clean['stale']) == (0, 0, 0), clean
        assert (await proj(conn, legacy))['bpm'] == Decimal('130.00')

        # A contract-version change is detected and a rebuild reprojects under the current contract.
        await conn.execute("UPDATE projection_tracks SET energy_contract_version = 'energy-0' WHERE energy_canonical IS NOT NULL")
        assert (await projection.reconcile(conn))['stale'] == 2
        rebuilt = await projection.rebuild(conn)
        assert rebuilt['contract_version'] == 'energy-1'
        assert (await projection.reconcile(conn))['stale'] == 0
        assert (await proj(conn, manual))['energy_band'] == 'peak'
        print('SCENARIO-OK')
    finally:
        await conn.execute('DELETE FROM outbox_events WHERE aggregate_id = ANY($1::uuid[]) OR payload::text LIKE $2', CREATED, f'%{MARKER}%')
        if owns_consumer:
            await conn.execute("DELETE FROM outbox_consumers WHERE consumer = 'projection_tracks'")
        await conn.execute('DELETE FROM silver_enriched_tracks WHERE track_title LIKE $1', f'%{MARKER}')
        await conn.execute("DELETE FROM projection_tracks WHERE artist_name IN ($1, $2, 'ghost') OR track_title LIKE $3", ARTIST, f'Renamed {MARKER}', f'%{MARKER}')
        await conn.execute("DELETE FROM outbox_consumers WHERE consumer = $1", CONSUMER)
        await conn.close()

asyncio.run(main())
