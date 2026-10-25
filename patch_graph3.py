import re

with open('services/common/datalayer/graph_projection.py', 'r') as f:
    content = f.read()

# Replace the duplicated sections around lines 231-255 that were likely caused by my earlier clumsy regexes.
duplicate_block = r'''    if edges_to_create:
        await client.execute_write\(
            \"\"\"
            UNWIND \$edges AS edge
            MATCH \(from:Track \{id: edge\.from_id\}\), \(to:Track \{id: edge\.to_id\}\)
            MERGE \(from\)-\[r:TRANSITIONS_TO\]->\(to\)
            SET r\.bpm_gap = edge\.bpm_gap,
                r\.key_compatibility = edge\.key_compat,
                r\.energy_step = edge\.energy_step
            \"\"\",
            \{"edges": edges_to_create\}
        \)


    if edges_to_create:
        await client.execute_write\(
            \"\"\"
            UNWIND \$edges AS edge
            MATCH \(from:Track \{id: edge\.from_id\}\), \(to:Track \{id: edge\.to_id\}\)
            MERGE \(from\)-\[r:TRANSITIONS_TO\]->\(to\)
            SET r\.bpm_gap = edge\.bpm_gap,
                r\.key_compatibility = edge\.key_compat,
                r\.energy_step = edge\.energy_step
            \"\"\",
            \{"edges": edges_to_create\}
        \)'''

fixed_block = '''    if edges_to_create:
        await client.execute_write(
            """
            UNWIND $edges AS edge
            MATCH (from:Track {id: edge.from_id}), (to:Track {id: edge.to_id})
            MERGE (from)-[r:TRANSITIONS_TO]->(to)
            SET r.bpm_gap = edge.bpm_gap,
                r.key_compatibility = edge.key_compat,
                r.energy_step = edge.energy_step
            """,
            {"edges": edges_to_create}
        )'''

content = re.sub(duplicate_block, fixed_block, content, flags=re.DOTALL)
with open('services/common/datalayer/graph_projection.py', 'w') as f:
    f.write(content)
