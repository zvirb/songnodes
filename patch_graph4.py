import re

with open('services/common/datalayer/graph_projection.py', 'r') as f:
    content = f.read()

replacement = """
    for edge in mb_edges:
        await client.execute_write(
            \"\"\"
            MATCH (from:Track {id: $from_id}), (to:Track {id: $to_id})
            MERGE (from)-[r:REF_MB {type: $type}]->(to)
            \"\"\",
            {
                "from_id": str(edge['from_id']),
                "to_id": str(edge['to_id']),
                "type": edge['link_type'].upper()
            }
        )
"""
content = re.sub(r'    for edge in mb_edges:.*?MATCH \(from:Track \{id: \$from_id\}\)\s*', replacement, content, flags=re.DOTALL)
with open('services/common/datalayer/graph_projection.py', 'w') as f:
    f.write(content)
