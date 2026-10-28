import re
with open('STATUS.md', 'r') as f:
    content = f.read()

start_date = "2023-11-15"
end_date = "2023-11-15"
status_text = f"""<!-- SLOT:SC2 BEGIN -->
Started: 2024-11-20
Ended: 2024-11-20
Built: Added scrape_targets handler and recurring celery job to automatically search target tracks on a schedule. Tested via test_target_scrape.py.
Checks run: cd services && python -m unittest common/tests/test_target_scrape.py, python scripts/scope_guard.py.
Checks not run: UI checks (not applicable).
Reviewer check: With stack running, add target track on /sources/targets; set SCRAPE_TARGETS_INTERVAL_SECONDS=60, GET /api/v1/jobs?kind=scrape lists 2 jobs, target's last_searched is set.
Follow-ups: Updating playlists_found after a scrape.
PR: https://github.com/zvirb/songnodes/pull/NEW_PR
<!-- SLOT:SC2 END -->"""

content = re.sub(r'<!-- SLOT:SC2 BEGIN -->.*?<!-- SLOT:SC2 END -->', status_text, content, flags=re.DOTALL)

with open('STATUS.md', 'w') as f:
    f.write(content)
