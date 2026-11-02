from common.datalayer import outbox

TYPE = f'test-{MARKER}'
CONSUMER = f'test-{MARKER}'
AHEAD = 10_000_000  # txids from the old cluster, beyond anything this cluster has assigned


async def main():
    conn = await connect()
    seen = []

    async def collect(c, event):
        if event['aggregate_type'] == TYPE:
            seen.append(event['event_type'])

    async def old_event(kind, txid):
        return await conn.fetchval("""
            INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, txid) VALUES ($1, $2, $3, $4)
            RETURNING id""", TYPE, uuid.uuid4(), kind, txid)

    try:
        # A dump and restore into a new cluster keeps the rows but restarts the txid counter: the history and the
        # consumer offset carry txids the new cluster has not reached yet.
        far = await conn.fetchval(f'SELECT {outbox.NEXT_TXID}') + AHEAD
        consumed = await old_event('old-consumed', far)
        await conn.execute("""
            INSERT INTO outbox_consumers (consumer, last_txid, last_id) VALUES ($1, $2, $3)""", CONSUMER, far, consumed)
        await old_event('old-unconsumed', far + 1)
        for kind in ('after-restore-1', 'after-restore-2'):
            await outbox.append(conn, TYPE, uuid.uuid4(), kind)

        # The 2 Nov 2026 failure: every new event sorts below the offset, so nothing is ever pending.
        assert [e for e in await outbox.pending(conn, CONSUMER, 1000) if e['aggregate_type'] == TYPE] == [] or \
            (await conn.fetchval('SELECT last_txid FROM outbox_consumers WHERE consumer = $1', CONSUMER)) == 0, \
            'new events hidden behind an offset from the old cluster'

        stats = await outbox.drain(conn, CONSUMER, collect)
        assert seen == ['old-unconsumed', 'after-restore-1', 'after-restore-2'], (seen, stats)
        offset = await conn.fetchrow('SELECT last_txid, last_id FROM outbox_consumers WHERE consumer = $1', CONSUMER)
        assert offset['last_txid'] < far, dict(offset)
        assert await conn.fetchval(f'SELECT count(*) FROM outbox_events WHERE txid >= {outbox.NEXT_TXID}') == 0, \
            'no event keeps a txid from the old cluster'
        assert await outbox.rebase_after_restore(conn) == 0, 'a healthy outbox is left alone'

        seen.clear()
        await outbox.append(conn, TYPE, uuid.uuid4(), 'later')
        await outbox.drain(conn, CONSUMER, collect)
        await outbox.drain(conn, CONSUMER, collect)
        assert seen == ['later'], 'each event exactly once after the rebase'
        print('SCENARIO-OK')
    finally:
        await conn.execute("DELETE FROM outbox_consumers WHERE consumer = $1", CONSUMER)
        await conn.execute("DELETE FROM outbox_events WHERE aggregate_type = $1", TYPE)
        await conn.close()

asyncio.run(main())
