import re

with open('services/common/datalayer/graph_projection.py', 'r') as f:
    content = f.read()

# Fix reconcile
reconcile_replacement = """
async def reconcile(conn, repair: bool = False) -> Dict[str, Any]:
    \"\"\"Compare PostgreSQL data with Memgraph and report differences.\"\"\"
    pg_count = await conn.fetchval("SELECT count(*) FROM silver_enriched_tracks")

    mg_res = await client.execute_query("MATCH (t:Track) RETURN count(t) as cnt")
    mg_count = mg_res[0]['cnt'] if mg_res else 0

    diff = pg_count - mg_count

    # We do not count edges directly from PG because they are generated dynamically in this module now.

    if repair and (diff != 0):
        await rebuild(conn)

    return {
        "pg_tracks": pg_count,
        "mg_tracks": mg_count,
        "diff_tracks": diff,
        "repaired": repair and (diff != 0)
    }
"""

content = re.sub(r'async def reconcile\(conn, repair: bool = False\) -> Dict\[str, Any\]:.*', reconcile_replacement, content, flags=re.DOTALL)

with open('services/common/datalayer/graph_projection.py', 'w') as f:
    f.write(content)
