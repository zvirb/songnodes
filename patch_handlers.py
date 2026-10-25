import re

with open('services/common/datalayer/handlers.py', 'r') as f:
    content = f.read()

# Add import
if 'import graph_projection' not in content:
    content = content.replace('from . import backfill, enrichment, er, evidence, ingest, outbox, projection',
                              'from . import backfill, enrichment, er, evidence, ingest, outbox, projection, graph_projection')

# Add handlers
if 'graph_projection_consume' not in content:
    handlers_code = """
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

"""
    content += handlers_code

with open('services/common/datalayer/handlers.py', 'w') as f:
    f.write(content)
