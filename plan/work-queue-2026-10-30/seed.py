"""Write prompts.md and the tracker seed (seed.json, an ArtifactData batch) from tasks.py."""
import json
from pathlib import Path

from tasks import BASE, HOUSE_RULES, TASKS

HERE = Path(__file__).resolve().parent

md = [f"# Work queue, 30 Oct 2026 (main at {BASE})", "", "## House rules", "", "```text", HOUSE_RULES.rstrip(), "```", ""]
for t in sorted(TASKS, key=lambda t: t["order"]):
    md += [f"## {t['id']}: {t['title']}", "",
           f"- Group: {t['group']} · Area: {t['area']}",
           f"- Depends on: {t['dependsOn'] or '–'}",
           f"- Open question: {t['openQuestion'] or '–'}", "",
           "```text", t["prompt"].rstrip(), "```", ""]
(HERE / "prompts.md").write_text("\n".join(md), encoding="utf-8")

ops = [{"op": "set", "collection": "meta", "doc_id": "rules", "data": {"text": HOUSE_RULES}}]
for t in TASKS:
    ops.append({"op": "set", "collection": "tasks", "doc_id": t["id"], "data": {**t, "note": ""}})
(HERE / "seed.json").write_text(json.dumps(ops, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"{len(TASKS)} tasks, {len(ops)} ops")

# One JSON file per document, so the ArtifactData batch can pass each by file_path.
out = HERE / "seed"
out.mkdir(exist_ok=True)
writes = []
for o in ops:
    p = out / f"{o['collection']}-{o['doc_id']}.json"
    p.write_text(json.dumps(o["data"], ensure_ascii=False), encoding="utf-8")
    writes.append({"op": "set", "collection": o["collection"], "doc_id": o["doc_id"], "file_path": str(p)})
(HERE / "seed-writes.json").write_text(json.dumps(writes, indent=1), encoding="utf-8")
