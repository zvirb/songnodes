"""Library ingest job handler."""
import json
from typing import Dict, Any, List
from uuid import UUID
from common.datalayer.handlers import handler, Context
from common.datalayer.ingest import upsert_track
from common.datalayer.evidence import record as record_evidence
from common.datalayer.outbox import append as append_outbox

@handler('library_ingest')
async def library_ingest(conn, ctx: Context, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Ingests library payload into the library schema."""

    # We will use this module to orchestrate the db transactions,
    # but actual parsing of tracks/etc might also happen here or in importer.
    # The payload is assumed to be exactly what /api/v1/library/ingest takes.

    # Delegate to a full logic module if it gets too large, but for now we'll put it here.
    from library.importer.import_library import process_payload
    return await process_payload(conn, payload)
