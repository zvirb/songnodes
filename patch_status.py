import re

with open('STATUS.md', 'r') as f:
    content = f.read()

replacement = """<!-- SLOT:WP8 BEGIN -->
### WP8: Graph projection as an outbox consumer
- Start: 2026-10-25 - Initiated graph projection module creation.
- End: 2026-10-25 - Completed implementation of Memgraph consumer, runners, SQL migrations, and tests. Tests were created but skipped locally due to testcontainer/docker restrictions.
<!-- SLOT:WP8 END -->"""

content = re.sub(r'<!-- SLOT:WP8 BEGIN -->.*?<!-- SLOT:WP8 END -->', replacement, content, flags=re.DOTALL)

with open('STATUS.md', 'w') as f:
    f.write(content)
