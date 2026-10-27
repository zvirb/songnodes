import pytest
from pathlib import Path
import re
from tests.enrichment_local.replay.run import replay_enrichment

@pytest.mark.asyncio
async def test_replay_coverage_does_not_drop():
    out_path = Path("docs/integration/WP4/replay.md")
    if out_path.exists():
        out_path.unlink()

    items_path = Path("nonexistent.json")
    await replay_enrichment(items_path, False, out_path)

    assert out_path.exists()
    content = out_path.read_text()

    coverage_section = False

    for line in content.splitlines():
        if line.startswith("## Field Coverage"):
            coverage_section = True
            continue
        if line.startswith("## Web Calls"):
            coverage_section = False
            continue

        if coverage_section and line.startswith("| ") and "fixture" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 3:
                m_old = re.search(r'fixture.*:\s*(\d+)', parts[1])
                m_new = re.search(r'fixture.*:\s*(\d+)', parts[2])
                if m_old and m_new:
                    old_val = int(m_old.group(1))
                    new_val = int(m_new.group(1))
                    assert new_val >= old_val, f"Coverage dropped for {parts[0]}: {old_val} -> {new_val}"
