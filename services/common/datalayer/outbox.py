"""Transactional outbox: events are written in the same transaction as the change they describe.

Consumers read in (txid, id) order and only events from transactions older than every in-flight
transaction (`pg_snapshot_xmin`), so a slow writer that commits late can never be skipped.
Delivery is at-least-once; handlers must be idempotent. A handler and its offset advance share one
transaction, and an event that keeps failing is dead-lettered after `max_attempts` so it cannot block
the stream. Replays are safe because projections are keyed upserts/deletes.
"""
import json
from typing import Any, Awaitable, Callable, Dict, List, Optional
from uuid import UUID

CUTOFF = "pg_snapshot_xmin(pg_current_snapshot())::text::bigint"


async def append(conn, aggregate_type: str, aggregate_id: UUID, event_type: str,
                 payload: Optional[Dict[str, Any]] = None) -> int:
    """Record an event. Call inside the transaction that makes the change."""
    return await conn.fetchval("""
        INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
        VALUES ($1, $2, $3, $4::jsonb) RETURNING id
    """, aggregate_type, aggregate_id, event_type, json.dumps(payload or {}, default=str))


async def pending(conn, consumer: str, limit: int = 100) -> List[Any]:
    return await conn.fetch(f"""
        SELECT e.id, e.txid, e.aggregate_type, e.aggregate_id, e.event_type, e.payload, e.created_at
        FROM outbox_events e
        LEFT JOIN outbox_consumers c ON c.consumer = $1
        WHERE (e.txid, e.id) > (COALESCE(c.last_txid, 0), COALESCE(c.last_id, 0))
          AND e.txid < {CUTOFF}
        ORDER BY e.txid, e.id LIMIT $2
    """, consumer, limit)


async def advance(conn, consumer: str, event) -> None:
    await conn.execute("""
        INSERT INTO outbox_consumers (consumer, last_txid, last_id) VALUES ($1, $2, $3)
        ON CONFLICT (consumer) DO UPDATE SET last_txid = EXCLUDED.last_txid, last_id = EXCLUDED.last_id,
                                             updated_at = NOW()
    """, consumer, event['txid'], event['id'])


def event_dict(event) -> Dict[str, Any]:
    payload = event['payload']
    return {'id': event['id'], 'aggregate_type': event['aggregate_type'], 'aggregate_id': str(event['aggregate_id']),
            'event_type': event['event_type'], 'payload': json.loads(payload) if isinstance(payload, str) else payload}


async def consume(conn, consumer: str, handler: Callable[[Any, Any], Awaitable[None]], batch: int = 100,
                  max_attempts: int = 3) -> Dict[str, int]:
    """Process one batch. Returns counts: processed, dead_lettered, remaining_visible."""
    stats = {'processed': 0, 'dead_lettered': 0}
    for event in await pending(conn, consumer, batch):
        for attempt in range(1, max_attempts + 1):
            try:
                async with conn.transaction():
                    await handler(conn, event)
                    await advance(conn, consumer, event)
                stats['processed'] += 1
                break
            except Exception as error:  # noqa: BLE001 - any handler failure is retried then dead-lettered
                if attempt < max_attempts:
                    continue
                async with conn.transaction():
                    await conn.execute("""
                        INSERT INTO outbox_dead_letters (consumer, event_id, event, error, attempts)
                        VALUES ($1, $2, $3::jsonb, $4, $5)
                        ON CONFLICT (consumer, event_id) DO UPDATE SET error = EXCLUDED.error,
                                                                      attempts = EXCLUDED.attempts
                    """, consumer, event['id'], json.dumps(event_dict(event), default=str), str(error)[:2000], attempt)
                    await advance(conn, consumer, event)
                stats['dead_lettered'] += 1
    stats['remaining_visible'] = len(await pending(conn, consumer, 1))
    return stats


async def drain(conn, consumer: str, handler, batch: int = 100, max_attempts: int = 3, max_batches: int = 1000):
    """Consume until no visible events remain (for rebuilds and tests)."""
    total = {'processed': 0, 'dead_lettered': 0}
    for _ in range(max_batches):
        stats = await consume(conn, consumer, handler, batch, max_attempts)
        total['processed'] += stats['processed']
        total['dead_lettered'] += stats['dead_lettered']
        if not stats['processed'] and not stats['dead_lettered']:
            break
    return total


async def backlog(conn, consumer: str) -> int:
    """Committed events not yet consumed, including those the cutoff hides behind an older open transaction."""
    return await conn.fetchval("""
        SELECT count(*) FROM outbox_events e
        LEFT JOIN outbox_consumers c ON c.consumer = $1
        WHERE (e.txid, e.id) > (COALESCE(c.last_txid, 0), COALESCE(c.last_id, 0))
    """, consumer)


async def skip_to_head(conn, consumer: str) -> None:
    """Move a consumer past every visible event (used right after a full rebuild)."""
    head = await conn.fetchrow(f"""
        SELECT txid, id FROM outbox_events WHERE txid < {CUTOFF} ORDER BY txid DESC, id DESC LIMIT 1""")
    if head:
        await advance(conn, consumer, head)


async def dead_letters(conn, consumer: Optional[str] = None) -> List[Any]:
    return await conn.fetch("SELECT * FROM outbox_dead_letters WHERE $1::text IS NULL OR consumer = $1 ORDER BY id", consumer)


async def replay_dead_letters(conn, consumer: str) -> int:
    """Rewind the consumer to the earliest dead-lettered event and clear them so they are retried."""
    first = await conn.fetchrow("""
        SELECT e.txid, e.id FROM outbox_dead_letters d JOIN outbox_events e ON e.id = d.event_id
        WHERE d.consumer = $1 ORDER BY e.txid, e.id LIMIT 1""", consumer)
    if first is None:
        return 0
    async with conn.transaction():
        await conn.execute("""
            INSERT INTO outbox_consumers (consumer, last_txid, last_id) VALUES ($1, $2, $3)
            ON CONFLICT (consumer) DO UPDATE SET last_txid = EXCLUDED.last_txid, last_id = EXCLUDED.last_id
        """, consumer, first['txid'], first['id'] - 1)
        return int((await conn.execute('DELETE FROM outbox_dead_letters WHERE consumer = $1', consumer)).split()[-1])
