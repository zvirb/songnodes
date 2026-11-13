"""Import audit observations idempotently, retaining every occurrence as evidence."""
import hashlib
import json
from pathlib import Path
import sys
from queue import Queue


def records(report):
    groups = {}
    for page in report['pages']:
        for finding in page['findings']:
            key = json.dumps([page['path'], finding['rule'], finding['message'], finding.get('targets', [])], sort_keys=True)
            group = groups.setdefault(key, dict(path=page['path'], finding=finding, occurrences=[]))
            group['occurrences'].append({k: page[k] for k in ['theme', 'width', 'size']})
    pages = {'/': 'pages/HomePage.tsx', '/graph': 'pages/GraphPage.tsx', '/harmony': 'features/camelot/CamelotPage.tsx', '/library': 'features/musicLibrary/LibraryPage.tsx', '/library/buy': 'features/musicLibrary/BuyListPage.tsx', '/library/review': 'features/musicLibrary/ReviewQueuePage.tsx', '/login': 'features/auth/LoginPage.tsx', '/paths': 'features/pathfinder/PathfinderPage.tsx', '/pipeline': 'pages/ScraperProgressPage.tsx', '/pipeline/runs': 'pages/ScraperProgressPage.tsx', '/sets': 'features/musicLibrary/SetBuilderPage.tsx', '/settings': 'pages/SettingsPage.tsx', '/sources/import': 'features/aiSetlists/AISetlistsPage.tsx', '/sources': 'pages/ModulePages.tsx', '/sources/targets': 'pages/ModulePages.tsx'}
    output = []
    for key, group in groups.items():
        rule, path = group['finding']['rule'], group['path']
        shell = rule in {'header', 'header-scroll', 'header-position', 'header-edge', 'skip-link', 'connection', 'tools'}
        owned = ['file:frontend/src/shell/AppShell.tsx', 'file:frontend/src/styles/app.css'] if shell else ['file:frontend/src/' + pages.get(path, 'components/OAuthCallback.tsx')]
        output.append(dict(type='deviation', description=f"Reproduce and resolve {rule} on {path}: {group['finding']['message']}", origin='design-audit:' + hashlib.sha256(key.encode()).hexdigest(), resources=owned, priority=1 if shell else 2, criteria=['Confirm observation against authoritative design-system card before editing; report false positives with evidence', 'One deviation only; reproduce and verify every recorded display-matrix occurrence', 'Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states', 'Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed'], source='reports/design-system-audit.json', observation=group))
    for gap in report['coverageGaps']:
        output.append(dict(type='verification', description=gap, origin='design-audit-gap:' + gap, resources=['file:frontend/tests/design-system-route-examples.json'], priority=2, criteria=['Supply a real concrete route without invented records', 'Rerun the audit for this route and retain evidence; record any new observations separately'], source='reports/design-system-audit.json'))
    return output


if __name__ == '__main__':
    queue = Queue()
    source = Path(sys.argv[1]).resolve()
    report = json.loads(source.read_text(encoding='utf8'))
    snapshot = queue.home / 'reports/design-system-audit.json'
    with queue.mutex():
        if snapshot.exists() and snapshot.read_bytes() != source.read_bytes():
            raise ValueError('Existing input evidence differs; use a versioned import instead')
        snapshot.parent.mkdir(exist_ok=True)
        if not snapshot.exists():
            with snapshot.open('xb') as stream:
                stream.write(source.read_bytes())
        state = queue.load()
        added = queue.add(state, records(report))
        queue.validate(state)
        queue.save(state)
        print(json.dumps(dict(added=added, task_count=len(state['tasks']), findings=sum(len(p['findings']) for p in report['pages']))))
