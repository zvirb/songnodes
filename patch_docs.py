import re

with open('docs/integration/WP8/decisions/2026-10-25-WP8-graph.md', 'r') as f:
    content = f.read()

replacement = """
3. **Data Mapping**:
   - `silver_enriched_tracks` maps to `Track` nodes, combined with metadata edges linking to `Artist`, `Label`, `Crate`, `Source`, and `Set` when data is present in the `library` overlay.
   - `silver_track_transitions` maps to `TRANSITIONS_TO` relationships, carrying the pre-computed metadata gaps (e.g. `avg_bpm_difference`, `avg_key_compatibility`).
   - `ref_mb` (MusicBrainz reference data) is queried through `library.track_xref` to generate `REF_MB` edges (with types like `REMIX_OF`, `SAME_RELEASE`, `SAME_LABEL`) connecting `Track` nodes.
4. **Rebuild / Reconcile Mechanism**: Similar to the existing `projection_tracks` read model, `graph_projection` supports a total wipe-and-reload (`rebuild`) and statistical comparison (`reconcile`). For Memgraph, constraints/indices are first ensured, then `MATCH (n) DETACH DELETE n` is utilized to clear all data. This makes disaster recovery or schema change updates deterministic.
   - `rebuild` relies on `UNWIND $rows` batching logic, reading chunks of ~10k from PostgreSQL and batch-inserting into Memgraph to circumvent severe N+1 bottlenecks.
"""

content = re.sub(r'3\. \*\*Data Mapping\*\*.*?(?=5\. \*\*No Independent)', replacement, content, flags=re.DOTALL)

with open('docs/integration/WP8/decisions/2026-10-25-WP8-graph.md', 'w') as f:
    f.write(content)
