from common.datalayer import outbox

TYPE = f'test-{MARKER}'
CONSUMER = f'test-{MARKER}'


async def main():
    a, b = await connect(), await connect()
    seen = []

    async def collect(conn, event):
        if event['aggregate_type'] == TYPE:
            seen.append(event['event_type'])

    try:
        await outbox.skip_to_head(a, CONSUMER)
        for kind in ('one', 'two', 'three'):
            await outbox.append(a, TYPE, uuid.uuid4(), kind)
        stats = await outbox.drain(a, CONSUMER, collect)
        assert seen == ['one', 'two', 'three'] and stats['processed'] >= 3, (seen, stats)
        assert (await outbox.drain(a, CONSUMER, collect))['processed'] == 0, 'consumed events are not redelivered'

        # A transaction that is still open hides every newer event, so nothing can be skipped.
        seen.clear()
        tx_b = b.transaction()
        await tx_b.start()
        await outbox.append(b, TYPE, uuid.uuid4(), 'older-tx-late-id')
        tx_a = a.transaction()
        await tx_a.start()
        await outbox.append(a, TYPE, uuid.uuid4(), 'newer-tx-early-id')
        await outbox.append(b, TYPE, uuid.uuid4(), 'older-tx-later-still')
        await tx_a.commit()
        probe = await connect()
        assert await outbox.pending(probe, CONSUMER) == [], 'open older transaction hides newer committed events'
        assert await outbox.backlog(probe, CONSUMER) == 1, 'backlog counts committed events the cutoff still hides'
        await tx_b.commit()
        await outbox.drain(probe, CONSUMER, collect)
        assert seen == ['older-tx-late-id', 'older-tx-later-still', 'newer-tx-early-id'], seen  # (txid, id) order, none skipped
        assert len(seen) == 3, 'every event exactly once'
        await probe.close()

        # Handler failure rolls back its writes and is retried; the offset moves only with success.
        seen.clear()
        attempts = {'n': 0}

        async def flaky(conn, event):
            if event['aggregate_type'] != TYPE:
                return
            attempts['n'] += 1
            await conn.execute("INSERT INTO backfill_checkpoints (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET processed = backfill_checkpoints.processed + 1", f'flaky-{MARKER}')
            if attempts['n'] == 1:
                raise RuntimeError('transient')

        await outbox.append(a, TYPE, uuid.uuid4(), 'flaky')
        await outbox.drain(a, CONSUMER, flaky)
        row = await a.fetchrow('SELECT processed FROM backfill_checkpoints WHERE name = $1', f'flaky-{MARKER}')
        assert attempts['n'] == 2 and row['processed'] == 0, (attempts, dict(row)) # first attempt rolled back

        # A permanently failing event is dead-lettered without blocking later events, then replayable.
        seen.clear()
        fail_for = {'bad'}

        async def picky(conn, event):
            if event['aggregate_type'] != TYPE:
                return
            if event['event_type'] in fail_for:
                raise ValueError('cannot process')
            seen.append(event['event_type'])

        await outbox.append(a, TYPE, uuid.uuid4(), 'bad')
        await outbox.append(a, TYPE, uuid.uuid4(), 'good-after-bad')
        stats = await outbox.drain(a, CONSUMER, picky, max_attempts=2)
        assert stats['dead_lettered'] == 1 and seen == ['good-after-bad'], (stats, seen)
        dead = await outbox.dead_letters(a, CONSUMER)
        assert len(dead) == 1 and dead[0]['attempts'] == 2 and 'cannot process' in dead[0]['error']
        fail_for.clear()
        assert await outbox.replay_dead_letters(a, CONSUMER) == 1
        await outbox.drain(a, CONSUMER, picky)
        assert 'bad' in seen and await outbox.dead_letters(a, CONSUMER) == [], seen
        print('SCENARIO-OK')
    finally:
        await a.execute("DELETE FROM outbox_events WHERE aggregate_type = $1", TYPE)
        await a.execute("DELETE FROM outbox_dead_letters WHERE consumer = $1", CONSUMER)
        await a.execute("DELETE FROM outbox_consumers WHERE consumer = $1", CONSUMER)
        await a.execute("DELETE FROM backfill_checkpoints WHERE name = $1", f'flaky-{MARKER}')
        await a.close()
        await b.close()

asyncio.run(main())
