#!/usr/bin/env python3
"""Rebuild the four data files behind the SongNodes Queue Monitor dashboard.

Run from the repo root (E:\\songnodes), read-only on the queue:
    python3 -X utf8 plan/agent-queue/tools/monitor_refresh.py [--out plan/agent-queue/monitor]

Reads the branch's local runtime state (.runtime/<branch-hash>/state.json, the only authoritative
live state, rule Q011) and writes queue_tasks.csv, events.csv, runs.csv and locks.csv with the
columns the dashboard reads. Never writes the queue or its runtime. Publishing the files to the
dashboard is a separate step: see RUN-GUIDE.md "Queue Monitor refresh".

Two methods for the headline numbers (open, complete): (a) counting task states from state.json,
(b) counting terminal events (completed) and non-terminal tasks from the event log. A mismatch is
printed and returned as exit code 3; the files are still written.
"""
import argparse, csv, datetime as dt, json, re, sys
from pathlib import Path
from zoneinfo import ZoneInfo

MEL = ZoneInfo('Australia/Melbourne')
HOME = Path(__file__).resolve().parent.parent          # plan/agent-queue
BATCH_PREFIX = ('wave-',)                                # tasks imported by a chat session in one batch


def runtime_state():
    states = [p for p in (HOME / '.runtime').glob('*/state.json')]
    if not states:
        sys.exit('no .runtime/*/state.json: run the queue tool once (status --json) to create it')
    return max(states, key=lambda p: p.stat().st_mtime)


def parse(ts):
    return dt.datetime.fromisoformat(ts).astimezone(MEL) if ts else None


def day(d):
    return f'{d:%a} {d.day} {d:%b}' if d else ''


def short(i):
    return i.split('-')[0]


def origin_kind(o):
    if o.startswith('design-audit:'):
        return 'original', 'Original plan (first import)'
    if o.startswith(('gap:', 'design-audit-gap')):
        return 'followup', 'Follow-up added by a run'
    if o.startswith('planner'):
        return 'planner', 'Added by the nightly planner'
    if o.startswith('split'):
        return 'split', 'Needed another run (split)'
    return 'chat', 'Added by a chat session'


def folder_of(t):
    m = re.search(r' on (/\S*?)(?::|\s|$)', t['description'])
    if m:
        return '/ (home)' if m.group(1) == '/' else m.group(1)
    for r in t.get('resources', []):
        p = r.split(':', 1)[-1]
        parts = p.split('/')
        if len(parts) > 1:
            return '/'.join(parts[:-1][:4]) if parts[0] != 'frontend' else '/'.join(parts[:-1][:3])
    return 'other'


def agent_of(t):
    return {'human': 'markus'}.get(t['role'], t['role'])


def group_of(t):
    return {'Done': 'complete', 'Ready': 'incomplete', 'Waiting': 'incomplete', 'In progress': 'incomplete'}.get(t['state'], 'parked')


def run_state(outcome):
    return {'started': 'In progress', 'completed': 'Completed', 'partial': 'Partial', 'waiting': 'Partial'}.get(outcome, 'Other')


def write(path, header, rows):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(header)
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(HOME / 'monitor'))
    a = ap.parse_args()
    src = runtime_state()
    s = json.loads(src.read_text(encoding='utf-8'))
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    built = dt.datetime.now(MEL)
    tasks = s['tasks']

    rows = []
    for t in tasks:
        k, label = origin_kind(t['origin'])
        added = parse(t.get('added'))
        rows.append([short(t['id']), t['description'], t['type'], folder_of(t), '; '.join(t.get('resources', [])), t['state'],
                     group_of(t), agent_of(t), t['priority'], k, label, day(added) if k != 'original' else '', '', ''])
    write(out / 'queue_tasks.csv', ['id', 'title', 'type', 'folder', 'folders', 'state', 'group', 'agent', 'priority', 'origin', 'origin_label', 'added_day', 'parent', 'added_est'], rows)

    ev = [['_generated', built.isoformat(), '', '']]
    for t in tasks:
        batch = 'B' if t['origin'].startswith(BATCH_PREFIX) else ''
        done = parse(t.get('completed')) if t['state'] == 'Done' else None
        ev.append([short(t['id']), parse(t['added']).isoformat(), done.isoformat() if done else '', batch])
    write(out / 'events.csv', ['id', 'added', 'done', 'added_kind'], ev)

    runs = []
    for e in s['events']:
        w = parse(e['timestamp'])
        runs.append([f'{w:%a} {w.day} {w:%b %Y %H:%M}', day(w), e['run'], short(e['tasks'][0]) if e['tasks'] else '', run_state(e['outcome'])])
    write(out / 'runs.csv', ['when', 'day', 'run', 'item_id', 'state'], runs)

    locks = []
    for c in s['claims']:
        if c.get('released'):
            continue
        res = c.get('resources', [])
        locks.append([res[0] if res else '', 'held', parse(c['started']).isoformat(), c['agent'], f"for {', '.join(short(i) for i in c['tasks'])}", '; '.join(res)])
    write(out / 'locks.csv', ['folder', 'state', 'since', 'holder', 'note', 'folders'], locks)

    # method (a): task states; method (b): terminal events plus tasks never completed
    done_a = sum(t['state'] == 'Done' for t in tasks)
    done_b = len({short(i) for e in s['events'] if e['outcome'] == 'completed' for i in e['tasks']})
    open_a = sum(group_of(t) == 'incomplete' for t in tasks)
    live = sum(group_of(t) != 'parked' for t in tasks)
    print(f'source {src}')
    print(f'tasks {len(tasks)}  complete (a: states) {done_a}  complete (b: completed events) {done_b}  open {open_a}  live {live}  held claims {len(locks)}')
    print(f'built {built:%a %d %b %Y %H:%M} Melbourne; wrote 4 files to {out}')
    if done_a != done_b:
        print('METHODS DISAGREE: complete differs between state and event log; state.json (a) is what the files use', file=sys.stderr)
        return 3
    return 0


if __name__ == '__main__':
    sys.exit(main())
