import re

with open('STATUS.md', 'r') as f:
    content = f.read()

start_marker = "<!-- SLOT:FE12 BEGIN -->"
end_marker = "<!-- SLOT:FE12 END -->"

entry = """
### FE12: Pipeline telemetry (2025-XX-XX)
- Created `usePipelineTelemetry` polling hook mapping live jobs and outbox endpoints.
- Replaced mock data in `ScraperProgressPage.tsx` with live data mapping.
- Handled empty and error states correctly.
- Added a "Retry" button for dead jobs with error handling.
- Implemented dev seed script `scripts/dev/seed_pipeline_jobs.py` using domain logic.
- Generated docs in `docs/pipeline-telemetry.md`.
- Handback: Page operates at `/pipeline` endpoint. Fixtures created dynamically or available in `fixtures/`. Seed script requires `--yes-local-dev`.
- Checks: `test:unit` and `type-check` pass. `sync-design-system.sh --check` passes. Visual tests and ESLint 9 configuration are omitted.
"""

if start_marker in content and end_marker in content:
    pattern = re.compile(f"{re.escape(start_marker)}.*?{re.escape(end_marker)}", re.DOTALL)
    new_content = pattern.sub(f"{start_marker}\n{entry.strip()}\n{end_marker}", content)
else:
    new_content = content + f"\n{start_marker}\n{entry.strip()}\n{end_marker}\n"

with open('STATUS.md', 'w') as f:
    f.write(new_content)
