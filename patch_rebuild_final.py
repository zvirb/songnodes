import re

with open('services/common/datalayer/graph_projection.py', 'r') as f:
    content = f.read()

replacement = """
    # Project edges (transitions)
    offset = 0
    while True:
        tracks = await conn.fetch(
            "SELECT id FROM silver_enriched_tracks ORDER BY id LIMIT $1 OFFSET $2",
            CHUNK_SIZE, offset
        )
        if not tracks:
            break

        for row in tracks:
            await project_transitions(conn, row['id'])
            await project_ref_mb_edges(conn, row['id'])

        offset += CHUNK_SIZE

    # Reconcile additional labels, crates, etc. could follow the UNWIND pattern here
"""

content = re.sub(r'    # Project edges \(transitions\).*?# Reconcile additional labels, crates, etc. could follow the UNWIND pattern here', replacement, content, flags=re.DOTALL)

with open('services/common/datalayer/graph_projection.py', 'w') as f:
    f.write(content)
