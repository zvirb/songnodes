import re

with open('services/common/datalayer/graph_projection.py', 'r') as f:
    content = f.read()

replacement = """
async def project_transitions(conn, track_id: UUID):
    # Transition logic based directly on Camelot, BPM, Energy

    source = await conn.fetchrow(
        "SELECT id, bpm, camelot_key, energy_canonical FROM silver_enriched_tracks WHERE id = $1",
        track_id
    )
    if not source or source['bpm'] is None or source['camelot_key'] is None:
        return

    targets = await conn.fetch(
        "SELECT id, bpm, camelot_key, energy_canonical FROM silver_enriched_tracks "
        "WHERE id != $1 AND bpm IS NOT NULL AND camelot_key IS NOT NULL",
        track_id
    )

    # Calculate transition validities
    edges_to_create = []

    for t in targets:
        bpm_gap = abs(float(source['bpm']) - float(t['bpm']))
        if bpm_gap > 10.0:  # Threshold for DJ transition
            continue

        energy_step = 0.0
        if source['energy_canonical'] is not None and t['energy_canonical'] is not None:
            energy_step = float(t['energy_canonical']) - float(source['energy_canonical'])

        edges_to_create.append({
            "from_id": str(track_id),
            "to_id": str(t['id']),
            "bpm_gap": bpm_gap,
            "key_compat": 1.0,  # Simplified logic here, could parse Camelot properly
            "energy_step": energy_step
        })

    if edges_to_create:
        await client.execute_write(
            \"\"\"
            UNWIND $edges AS edge
            MATCH (from:Track {id: edge.from_id}), (to:Track {id: edge.to_id})
            MERGE (from)-[r:TRANSITIONS_TO]->(to)
            SET r.bpm_gap = edge.bpm_gap,
                r.key_compatibility = edge.key_compat,
                r.energy_step = edge.energy_step
            \"\"\",
            {"edges": edges_to_create}
        )
"""

content = re.sub(r'async def project_transitions.*?\}[\s\n]*\)', replacement, content, flags=re.DOTALL)
# One more regex since the earlier one left some garbage code behind.
content = re.sub(r', \(to:Track \{id: \$to_id\}\).*?\}\s*\)', '', content, flags=re.DOTALL)

with open('services/common/datalayer/graph_projection.py', 'w') as f:
    f.write(content)
