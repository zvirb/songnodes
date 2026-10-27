"""Job handlers: each takes (conn, context, payload) and returns a JSON-able result.

A result may carry `enqueue`: [{kind, key, payload}] follow-up jobs. Keys make follow-ups idempotent, so a job that is
retried cannot fan out duplicates. Raise `RetryableError` for transient conditions (throttling, unreachable service);
any other exception also retries until the job's attempt budget is spent, then dead-letters.
"""
import os
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional
from uuid import UUID

import httpx

from . import backfill, enrichment, er, evidence, ingest, outbox, projection, graph_projection
from .errors import CatalogError


class RetryableError(Exception):
    """Transient failure; the runner re-queues with backoff."""


@dataclass
class Context:
    """Per-process dependencies, injected so tests can supply fakes."""
    providers: Callable[[], List[Any]] = lambda: []
    http: Optional[httpx.AsyncClient] = None
    scraper_url: str = field(default_factory=lambda: os.getenv('UNIFIED_SCRAPER_URL', 'http://unified-scraper:8000'))


Handler = Callable[[Any, Context, Dict[str, Any]], Awaitable[Dict[str, Any]]]
HANDLERS: Dict[str, Handler] = {}


def handler(kind: str):
    def register(function: Handler) -> Handler:
        HANDLERS[kind] = function
        return function
    return register


def follow(kind: str, key: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {'kind': kind, 'key': key, 'payload': payload or {}}


def track_id_of(payload: Dict[str, Any]) -> UUID:
    try:
        return UUID(str(payload['track_id']))
    except (KeyError, ValueError):
        raise CatalogError(422, 'payload.track_id must be a UUID')


def after(kind: str, payload: Dict[str, Any], extra: Optional[Dict[str, Any]] = None, tag: str = 'after') -> Dict[str, Any]:
    """Follow-up keyed by the triggering job: a retry of the same job reuses the key, a new job gets a fresh one."""
    return follow(kind, f'{tag}:{payload.get("job_id", "manual")}', extra)


SCRAPE_TIMEOUT_SECONDS = 960   # the unified scraper itself gives a spider up to 900 s


@handler('scrape')
async def scrape(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run one spider through the unified scraper (the only scraper service), then queue ingestion.

    The scraper's API is synchronous: `POST /scrape {source, search_query, limit}` returns when the spider has finished
    and has already written bronze. Spider-side errors (unknown source, invalid request) are permanent; timeouts,
    throttling and 5xx are retried with backoff.
    """
    if not payload.get('search_query') and not payload.get('url'):
        raise CatalogError(422, 'scrape jobs need payload.search_query (artist and title together) or payload.url')
    body = {'source': payload.get('source', '1001tracklists')}
    for key in ('search_query', 'url', 'artist_name', 'max_pages'):
        if payload.get(key) not in (None, ''):
            body[key] = payload[key]
    if payload.get('limit') is not None:
        body['limit'] = int(payload['limit'])
    client = ctx.http or httpx.AsyncClient(timeout=SCRAPE_TIMEOUT_SECONDS)
    try:
        response = await client.post(f'{ctx.scraper_url.rstrip("/")}/scrape', json=body)
    except httpx.TransportError as error:
        raise RetryableError(f'unified scraper unreachable: {error.__class__.__name__}') from error
    finally:
        if ctx.http is None:
            await client.aclose()
    if response.status_code >= 500 or response.status_code == 429:
        raise RetryableError(f'unified scraper returned HTTP {response.status_code}: {response.text[:200]}')
    if response.status_code >= 400:
        raise CatalogError(response.status_code, f'unified scraper rejected the request: {response.text[:200]}')
    result = response.json() if response.content else {}
    persisted = {'bronze_playlists': int(result.get('bronze_playlists_persisted') or 0),
                 'bronze_tracks': int(result.get('bronze_tracks_persisted') or 0)}
    return {'scraper': result, **persisted, 'found_nothing': not any(persisted.values()),
            'enqueue': [after('ingest_pending', payload, tag='ingest-after-scrape')]}


@handler('ingest_pending')
async def ingest_pending(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    limit = int(payload.get('limit', 25))
    summary = await ingest.ingest_pending(conn, limit)
    changed = bool(summary['playlists']['ingested'] or summary['tracks']['created'] or summary['tracks']['updated'])
    follow_ups = []
    if changed:
        follow_ups += [after('projection_consume', payload, tag='proj-after-ingest'),
                       after('graph_projection_consume', payload, tag='graph-proj-after-ingest'),
                       after('enrichment_backfill', payload, tag='backfill-after-ingest')]
    if summary['playlists']['examined'] >= limit:  # more may be waiting
        follow_ups.append(after('ingest_pending', payload, {k: v for k, v in payload.items() if k != 'job_id'}, tag='ingest-next'))
    return {**summary, 'enqueue': follow_ups}


@handler('enrich_track')
async def enrich_one(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    summary = await enrichment.enrich_track(conn, track_id_of(payload), ctx.providers())
    if summary['unavailable'] and not summary['matched']:
        raise RetryableError('providers unavailable or throttled')
    return summary


@handler('enrichment_backfill')
async def enrichment_backfill(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    name = payload.get('name', backfill.NAME)
    if payload.get('restart'):
        await backfill.reset(conn, name)
    elif (await backfill.checkpoint(conn, name))['status'] == 'complete':
        await backfill.reset(conn, name)   # a new pass over whatever is still missing and out of cooldown
    result = await backfill.run_batch(conn, ctx.providers(), int(payload.get('batch_size', 25)), name)
    if result['status'] == 'throttled':
        raise RetryableError(f"providers throttled at track {result['unavailable_for']}")
    carry = {k: v for k, v in payload.items() if k not in ('job_id', 'restart')}
    follow_ups = [after('projection_consume', payload, tag='proj-after-backfill'),
                  after('graph_projection_consume', payload, tag='graph-proj-after-backfill')]
    if result['status'] == 'running':
        follow_ups.append(after('enrichment_backfill', payload, carry, tag='backfill-next'))
    return {**result, 'enqueue': follow_ups}


@handler('camelot_repair')
async def camelot_repair(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    limit = int(payload.get('limit', 500))
    result = await evidence.repair_camelot(conn, limit, UUID(payload['after']) if payload.get('after') else None)
    follow_ups = []
    if result['examined'] >= limit:
        follow_ups.append(after('camelot_repair', payload, {'limit': limit, 'after': result['last_id']}, tag='camelot-next'))
    return {**result, 'enqueue': follow_ups}


@handler('projection_consume')
async def projection_consume(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    return await outbox.drain(conn, projection.CONSUMER, projection.handle_event, int(payload.get('batch', 200)),
                              max_batches=int(payload.get('max_batches', 50)))


@handler('projection_rebuild')
async def projection_rebuild(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    return await projection.rebuild(conn)


@handler('projection_reconcile')
async def projection_reconcile(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    return await projection.reconcile(conn, repair=bool(payload.get('repair')))


@handler('er_shadow')
async def er_shadow(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Score same-artist track pairs in shadow mode (records decisions; merges nothing). Resumable by artist."""
    if payload.get('restart'):
        await conn.execute("DELETE FROM backfill_checkpoints WHERE name = $1", er.CHECKPOINT)
    summary = await er.run_shadow(conn, int(payload.get('max_artists', 25)))
    follow_ups = []
    if summary['status'] == 'running':
        follow_ups.append(after('er_shadow', payload, {k: v for k, v in payload.items() if k not in ('job_id', 'restart')}, tag='er-next'))
    return {**summary, 'enqueue': follow_ups}

@handler('graph_projection_consume')
async def graph_projection_consume(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    return await outbox.drain(conn, graph_projection.CONSUMER, graph_projection.handle_event, int(payload.get('batch', 100)),
                              max_batches=int(payload.get('max_batches', 50)))

@handler('graph_projection_rebuild')
async def graph_projection_rebuild(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    return await graph_projection.rebuild(conn)

@handler('graph_projection_reconcile')
async def graph_projection_reconcile(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    return await graph_projection.reconcile(conn, repair=bool(payload.get('repair')))


from library.ingest.handler import library_ingest  # noqa: F401, E402
