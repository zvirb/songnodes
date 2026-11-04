"""Library ingest job handler."""
from typing import Dict, Any
from common.datalayer import handlers


@handlers.handler('library_ingest')
async def library_ingest(conn, ctx, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Ingests library payload into the library schema and enqueues projections and backfill."""
    from library.importer.import_library import process_payload

    stats = await process_payload(conn, payload)
    follow_ups = [
        handlers.after('projection_consume', payload, tag='proj-after-lib-ingest'),
        handlers.after('graph_projection_consume', payload, tag='graph-proj-after-lib-ingest'),
        handlers.after('enrichment_backfill', payload, tag='backfill-after-lib-ingest'),
    ]
    return {**stats, 'enqueue': follow_ups}
