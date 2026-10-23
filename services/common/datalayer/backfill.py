"""Resumable, idempotent enrichment backfill (WP5).

Selects tracks missing BPM, key, ISRC, TIDAL id or Deezer id in id order, enriches each with bounded batches, and
checkpoints after every track so a crash or throttle resumes exactly where it stopped. Provider throttling stops the
batch (status `throttled`) without advancing past the track, and enrichment itself never overwrites stronger values.
Nothing here deletes or rewrites existing data destructively: before-state is kept as `legacy` evidence.
"""
import json
from typing import Any, Awaitable, Callable, Dict, Optional, Sequence
from uuid import UUID

from . import enrichment

NAME = 'enrichment_backfill'
MISSING = "(bpm IS NULL OR key IS NULL OR isrc IS NULL OR tidal_id IS NULL OR deezer_id IS NULL)"
COOLDOWN = "(enriched_at IS NULL OR enriched_at < NOW() - make_interval(days => $3))"


async def checkpoint(conn, name: str = NAME) -> Dict[str, Any]:
    await conn.execute("INSERT INTO backfill_checkpoints (name) VALUES ($1) ON CONFLICT DO NOTHING", name)
    row = await conn.fetchrow('SELECT * FROM backfill_checkpoints WHERE name = $1', name)
    cursor = row['cursor']
    return {'cursor': json.loads(cursor) if isinstance(cursor, str) else cursor, 'processed': row['processed'], 'status': row['status']}


async def reset(conn, name: str = NAME) -> None:
    await conn.execute("""INSERT INTO backfill_checkpoints (name) VALUES ($1)
                          ON CONFLICT (name) DO UPDATE SET cursor = '{}'::jsonb, processed = 0, status = 'running', updated_at = NOW()""", name)


async def remaining(conn, after: Optional[str] = None) -> int:
    return await conn.fetchval(f"SELECT count(*) FROM silver_enriched_tracks WHERE {MISSING} AND ($1::uuid IS NULL OR id > $1)",
                               UUID(after) if after else None)


async def run_batch(conn, providers: Sequence[Any], batch_size: int = 25, name: str = NAME, cooldown_days: int = 7,
                    enrich: Callable[..., Awaitable[Dict[str, Any]]] = enrichment.enrich_track) -> Dict[str, Any]:
    state = await checkpoint(conn, name)
    after = state['cursor'].get('after')
    rows = await conn.fetch(f"""
        SELECT id FROM silver_enriched_tracks WHERE {MISSING} AND {COOLDOWN} AND ($2::uuid IS NULL OR id > $2)
        ORDER BY id LIMIT $1
    """, batch_size, UUID(after) if after else None, cooldown_days)
    outcome = {'processed': 0, 'matched': 0, 'review': 0, 'unavailable_for': None, 'status': 'running'}
    for row in rows:
        summary = await enrich(conn, row['id'], providers)
        if summary['unavailable'] and not summary['matched']:
            outcome.update(status='throttled', unavailable_for=str(row['id']))
            break  # leave the cursor before this track so it is retried
        outcome['processed'] += 1
        outcome['matched'] += int(bool(summary['matched']))
        outcome['review'] += int(bool(summary['review']))
        await conn.execute("""UPDATE backfill_checkpoints SET cursor = jsonb_build_object('after', $2::text),
                                    processed = processed + 1, updated_at = NOW() WHERE name = $1""", name, str(row['id']))
    if outcome['status'] == 'running' and len(rows) < batch_size:
        outcome['status'] = 'complete'
        await conn.execute("UPDATE backfill_checkpoints SET status = 'complete', updated_at = NOW() WHERE name = $1", name)
    cp = await checkpoint(conn, name)
    outcome.update(total_processed=cp['processed'], cursor=cp['cursor'].get('after'))
    return outcome
