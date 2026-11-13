"""Persistent, proposal-only queue. QUEUE.md is authoritative; other views replay it."""
import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import uuid
import copy
import shutil
import subprocess
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parents[1]
MARK = '\n<!-- AUTHORITATIVE STATE -->\n'
STATES = {'Ready', 'In progress', 'Waiting', 'Done', 'Retired', 'Split'}


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def atomic(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    previous_mode = path.stat().st_mode if path.exists() else None
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.write-')
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(text.encode('utf8') if isinstance(text, str) else text)
            stream.flush()
            os.fsync(stream.fileno())
        if previous_mode is not None:
            os.chmod(name, previous_mode)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


class Queue:
    def __init__(self, directory=HERE):
        self.home = Path(directory).resolve()
        self.config = json.loads((self.home / 'config.json').read_text(encoding='utf8'))
        self.root = (self.home / self.config['project_root']).resolve()
        branch = subprocess.run(['git', '-C', str(self.root), 'symbolic-ref', '--short', 'HEAD'], capture_output=True, text=True)
        detached = subprocess.run(['git', '-C', str(self.root), 'rev-parse', 'HEAD'], capture_output=True, text=True)
        self.branch = branch.stdout.strip() or detached.stdout.strip() or 'local'
        self.runtime = self.home / '.runtime' / hashlib.sha256(self.branch.encode()).hexdigest()[:20]
        self.runtime.mkdir(parents=True, exist_ok=True)

    @contextlib.contextmanager
    def mutex(self):
        with open(self.home / '.mutex', 'a+b') as stream:
            try:
                stream.seek(0)
                if os.name == 'nt':
                    import msvcrt
                    msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as error:
                raise ValueError('BUSY: queue metadata') from error
            try:
                yield
            finally:
                stream.seek(0)
                if os.name == 'nt':
                    msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(stream, fcntl.LOCK_UN)

    def load(self):
        text = (self.home / 'QUEUE.md').read_text(encoding='utf8')
        state = json.loads(text.split(MARK, 1)[1].removeprefix('```json\n').rsplit('\n```', 1)[0])
        catalog = state
        if (self.runtime / 'state.json').exists():
            state = json.loads((self.runtime / 'state.json').read_text(encoding='utf8'))
            by_id = {t['id']: t for t in state['tasks']}
            for task in catalog['tasks']:
                if task['id'] not in by_id:
                    state['tasks'].append(task)
                elif by_id[task['id']]['origin'] != task['origin']:
                    raise ValueError('Catalog ID collision; reconcile branch imports before continuing')
            state['next_id'] = max(state['next_id'], catalog['next_id'])
        tasks = state['tasks']
        if len({t['id'] for t in tasks}) != len(tasks) or any(t['state'] not in STATES for t in tasks):
            raise ValueError('Malformed task records or duplicate IDs')
        return state

    def save(self, state):
        self.validate(state)
        atomic(self.runtime / 'state.json', json.dumps(state, indent=2))
        # Git transports task definitions and terminal results, never active leases.
        catalog = copy.deepcopy(state)
        catalog['claims'] = []
        catalog['events'] = [e for e in catalog['events'] if e['outcome'] in {'added', 'completed', 'retired', 'split', 'owner-map-corrected'}]
        for task in catalog['tasks']:
            if task['state'] not in {'Done', 'Retired', 'Split'}:
                task['state'] = 'Ready'
            task.update(owner=None, claim=None, started=None)
        state_for_view = state
        state = catalog
        rules = (self.home / 'GOVERNANCE.md').read_text(encoding='utf8')
        table = '\n| ID | State | Priority | Task |\n| --- | --- | --- | --- |\n'
        for task in state['tasks']:
            table += f"| {task['id']} | {task['state']} | {task['priority']} | {task['description'].replace('|', '/').replace(chr(10), ' ')} |\n"
        atomic(self.home / 'QUEUE.md', rules + table + MARK + '```json\n' + json.dumps(state, indent=2) + '\n```\n')
        self.views(state_for_view)

    def views(self, state):
        # Crash recovery replays these views; no task state lives in a view.
        for folder in ['locks', 'reports', 'done', 'batch', 'retired-register']:
            (self.runtime / folder).mkdir(exist_ok=True)
        atomic(self.runtime / 'STATUS.md', '# Branch-local run history\n' + ''.join(json.dumps(e) + '\n' for e in state['events']))
        for claim in state['claims']:
            atomic(self.runtime / 'locks' / (claim['token'] + '.claim'), json.dumps(claim, indent=2))
            if claim.get('released'):
                atomic(self.runtime / 'locks' / (claim['token'] + '.release'), json.dumps({'released': claim['released'], 'reason': claim.get('reason')}))
        for task in state['tasks']:
            if task['state'] in {'Done', 'Retired'}:
                folder = 'done' if task['state'] == 'Done' else 'retired-register'
                atomic(self.runtime / folder / (task['id'] + '.json'), json.dumps(task, indent=2))
                if task['state'] == 'Done':
                    atomic(self.home / 'reports/completed' / (task['id'] + '.json'), json.dumps(task['completion'], indent=2))
        for batch in state.get('batches', []):
            atomic(self.runtime / 'batch' / (batch['id'] + '.json'), json.dumps(batch, indent=2))

    def resource(self, value):
        if value in {'_folder', '_shared', '_apply'}:
            return value
        kind, separator, value = value.partition(':')
        if not separator or kind not in {'file', 'folder'}:
            raise ValueError('Use file:path, folder:path, or a special resource')
        path = (self.root / value).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError('Path escapes project')
        for item in self.config['read_only'] + self.config['forbidden']:
            boundary = (self.root / item).resolve()
            if path.is_relative_to(boundary) or (kind == 'folder' and boundary.is_relative_to(path)):
                raise ValueError(f'Protected boundary: {item}')
        if not any(path.is_relative_to((self.root / item).resolve()) for item in self.config['writable']):
            raise ValueError('Path is outside writable boundaries')
        return kind + ':' + path.relative_to(self.root).as_posix()

    def resolve(self, values):
        resources = []
        for value in values:
            resources.extend(self.config['build_units'].get(value, [value]))
        return sorted({self.resource(value) for value in resources})

    def conflict(self, left, right):
        if left == '_folder' or right == '_folder' or left == right:
            return True
        if left.startswith('_') or right.startswith('_'):
            return False
        lk, lp = left.split(':', 1)
        rk, rp = right.split(':', 1)
        a, b = (self.root / lp).resolve(), (self.root / rp).resolve()
        return a == b or (lk == 'folder' and b.is_relative_to(a)) or (rk == 'folder' and a.is_relative_to(b))

    def event(self, state, agent, tasks, outcome, note, resources=(), evidence=None):
        state['events'].append(dict(timestamp=now(), timezone=self.config['timezone'], run=agent,
                                    tasks=tasks, resources=list(resources), outcome=outcome,
                                    changed=note, verification=evidence, rollback=None, remaining=note))

    def add(self, state, records):
        added = []
        origins = {t['origin']: t['id'] for t in state['tasks']}
        for record in records:
            if record['origin'] in origins:
                continue
            resources = self.resolve(record['resources'])
            if any(d not in {t['id'] for t in state['tasks']} for d in record.get('dependencies', [])):
                raise ValueError('Dependency does not exist')
            task = dict(type='deviation', dependencies=[], priority=2, role='frontend', notes=[], evidence=[], rollback=None)
            task.update(record)
            if task['role'] not in self.config['roles']:
                raise ValueError('Unknown role')
            task.update(id=f"WQ{state['next_id']:05d}-{uuid.uuid4().hex}", state='Ready', owner=None, claim=None,
                        resources=resources, added=now(), started=None, updated=now(), completed=None)
            state['next_id'] += 1
            state['tasks'].append(task)
            origins[task['origin']] = task['id']
            added.append(task['id'])
        self.event(state, 'planner', added, 'added', 'Imported task records')
        return added

    def owner(self, state, token, agent):
        claim = next((c for c in state['claims'] if c['token'] == token), None)
        if not claim or claim.get('released') or claim['agent'] != agent:
            raise ValueError('Not current owner; token released, recovered or unknown')
        return claim

    def claim(self, state, agent, ids, role):
        tasks = [next(t for t in state['tasks'] if t['id'] == ident) for ident in ids]
        done = {t['id'] for t in state['tasks'] if t['state'] == 'Done'}
        integration = 'apply' in self.config['roles'].get(role, [])
        if not tasks or len(set(ids)) != len(ids) or any(t['state'] not in ({'Ready', 'Waiting'} if integration else {'Ready'}) or (t['role'] != role and not integration) or not set(t['dependencies']) <= done for t in tasks):
            raise ValueError('Task is not eligible for this role')
        resources = self.resolve([r for t in tasks for r in t['resources']])
        if any(self.conflict(r, 'file:' + p) for r in resources for p in self.config['shared_sources']):
            resources = sorted(set(resources + ['_shared']))
        if any(self.conflict(r, retired) for r in resources for retired in state.get('retired_resources', [])):
            raise ValueError('Retired resource cannot be claimed')
        for claim in state['claims']:
            if not claim.get('released') and any(self.conflict(a, b) for a in resources for b in claim['resources']):
                raise ValueError('BUSY: conflicting resources')
        claim = dict(token=uuid.uuid4().hex, agent=agent, tasks=ids, resources=resources, started=now(), heartbeat=time.time())
        claim['baseline'] = {r[5:]: digest(self.root / r[5:]) for r in resources if r.startswith('file:')}
        for resource in resources:
            if resource.startswith('folder:'):
                for path in (self.root / resource[7:]).rglob('*'):
                    if path.is_file():
                        rel = path.relative_to(self.root).as_posix()
                        self.resource('file:' + rel)
                        claim['baseline'][rel] = digest(path)
        claim['shared'] = {p: digest(self.root / p) for p in self.config['shared_sources']}
        claim['role'] = role
        for path, expected in claim['baseline'].items():
            if expected is not None:
                target = self.runtime / 'reports' / claim['token'] / 'baseline' / path
                atomic(target, (self.root / path).read_bytes())
                if digest(target) != expected:
                    raise ValueError('Baseline changed during snapshot')
        state['claims'].append(claim)
        for task in tasks:
            task.update(state='In progress', owner=agent, claim=claim['token'], started=now(), updated=now())
        self.event(state, agent, ids, 'started', 'All resources acquired', resources)
        return claim

    def release(self, state, token, agent, note, waiting=False):
        claim = self.owner(state, token, agent)
        claim.update(released=now(), reason=note)
        for task in state['tasks']:
            if task['claim'] == token:
                task.update(state='Waiting' if waiting else 'Ready', owner=None, claim=None, updated=now())
                task['notes'].append(note)
        self.event(state, agent, claim['tasks'], 'waiting' if waiting else 'partial', note, claim['resources'])

    def stage(self, state, token, agent, directory):
        claim = self.owner(state, token, agent)
        if any('stage' not in self.config['roles'][t['role']] for t in state['tasks'] if t['claim'] == token):
            raise ValueError('Worker role cannot stage')
        source = Path(directory).resolve()
        if not source.is_relative_to((self.home / 'reports').resolve()):
            raise ValueError('Proposal must be isolated under reports/')
        outputs = [p for p in source.rglob('*') if p.is_file()]
        if not outputs:
            raise ValueError('Empty proposal')
        manifest = []
        for proposal in outputs:
            if not proposal.resolve().is_relative_to(source):
                raise ValueError('Proposal symlink escapes staging')
            rel = proposal.relative_to(source).as_posix()
            resource = self.resource('file:' + rel)
            if not any(self.conflict(resource, owned) for owned in claim['resources'] if not owned.startswith('_')):
                raise ValueError('Undeclared proposal output')
            expected = claim['baseline'].get(rel)
            if (rel not in claim['baseline'] and not any(r.startswith('folder:') and self.conflict(resource, r) for r in claim['resources'])) or digest(self.root / rel) != expected:
                raise ValueError('Baseline changed or not snapshotted; reclaim exact file outputs')
            manifest.append(dict(path=rel, proposed=digest(proposal), baseline=expected))
        if claim['shared'] != {p: digest(self.root / p) for p in self.config['shared_sources']}:
            raise ValueError('Shared source changed; rebuild under a fresh claim')
        for item in manifest:
            target = self.runtime / 'reports' / token / 'proposal' / item['path']
            atomic(target, (source / item['path']).read_bytes())
            if digest(target) != item['proposed']:
                raise ValueError('Proposal changed during snapshot')
        report = dict(claim=token, agent=agent, tasks=claim['tasks'], outputs=manifest, verification='Pending; not applied', shared=claim['shared'])
        atomic(self.runtime / 'reports' / (token + '.json'), json.dumps(report, indent=2))
        for task in state['tasks']:
            if task['claim'] == token:
                task['evidence'].append(str((self.runtime / 'reports' / (token + '.json')).relative_to(self.home)))
        self.release(state, token, agent, 'Proposal staged; verification and integration required', waiting=True)
        return report

    def proposal(self, state, token, agent, proposal):
        claim = self.owner(state, token, agent)
        original = next((c for c in state['claims'] if c['token'] == proposal), None)
        if not original or set(original['tasks']) != set(claim['tasks']):
            raise ValueError('Proposal does not belong to claimed tasks')
        report = json.loads((self.runtime / 'reports' / (proposal + '.json')).read_text(encoding='utf8'))
        for output in report['outputs']:
            resource = self.resource('file:' + output['path'])
            if not any(self.conflict(resource, r) for r in claim['resources'] if not r.startswith('_')):
                raise ValueError('Output is outside current claim')
            if digest(self.runtime / 'reports' / proposal / 'proposal' / output['path']) != output['proposed']:
                raise ValueError('Staged output changed')
            if digest(self.root / output['path']) != output['baseline']:
                raise ValueError('Baseline changed; rebuild proposal')
        if report['shared'] != {p: digest(self.root / p) for p in self.config['shared_sources']}:
            raise ValueError('Shared source changed; rebuild proposal')
        return claim, report

    def verify(self, token, agent, proposal):
        # Expensive checks run outside the metadata mutex. Ownership is rechecked below.
        with self.mutex():
            state = self.load()
            claim, report = self.proposal(state, token, agent, proposal)
            if 'verify' not in self.config['roles'][claim['role']]:
                raise ValueError('Role cannot verify')
        commands = self.config.get('verification_commands', [])
        if not commands:
            raise ValueError('No verification gates configured')
        sandbox = self.runtime / 'reports' / token / ('verify-' + uuid.uuid4().hex)
        results = []
        try:
            sandbox.mkdir(parents=True)
            for item in self.config['verification_inputs']:
                source = (self.root / item).resolve()
                if not source.is_relative_to(self.root):
                    raise ValueError('Verification input escapes project')
                for path in ([source] if source.is_file() else source.rglob('*')):
                    if not path.is_file() or any(part in {'node_modules', '.git', '.runtime', 'test-results', 'playwright-report', 'dist', '__pycache__'} for part in path.relative_to(self.root).parts):
                        continue
                    if not path.resolve().is_relative_to(self.root):
                        raise ValueError('Verification input symlink escapes project')
                    atomic(sandbox / path.relative_to(self.root), path.read_bytes())
            for output in report['outputs']:
                atomic(sandbox / output['path'], (self.runtime / 'reports' / proposal / 'proposal' / output['path']).read_bytes())
            for argv in [['git', '-c', 'core.longpaths=true', 'init', '--quiet'], ['git', '-c', 'core.longpaths=true', 'add', '--all']]:
                subprocess.run(argv, cwd=sandbox, check=True, capture_output=True)
            dependencies = self.root / 'frontend/node_modules'
            link = sandbox / 'frontend/node_modules'
            if dependencies.is_dir() and link.parent.is_dir():
                try:
                    os.symlink(dependencies, link, target_is_directory=True)
                except OSError:
                    if os.name != 'nt':
                        raise
                    subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(dependencies)], check=True, capture_output=True)
            for command in commands:
                argv = [part.replace('{python}', sys.executable) for part in command]
                try:
                    run = subprocess.run(argv, cwd=sandbox, capture_output=True, text=True, encoding='utf8', errors='replace', timeout=self.config.get('verification_timeout', 300))
                    results.append(dict(command=argv, exit=run.returncode, stdout=run.stdout, stderr=run.stderr))
                except (OSError, subprocess.TimeoutExpired) as error:
                    results.append(dict(command=argv, exit=-1, stderr=str(error)))
            if any(digest(sandbox / item['path']) != item['proposed'] for item in report['outputs']):
                results.append(dict(command=['snapshot-integrity'], exit=1, stderr='Tests changed proposed outputs'))
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            details = getattr(error, "stderr", None) or str(error)
            if isinstance(details, bytes):
                details = details.decode("utf8", errors="replace")
            results.append(dict(command=["verification-setup"], exit=-1, stderr=details))
        verification = dict(proposal=proposal, agent=agent, claim=token, tested=now(), sandbox=str(sandbox), results=results, passed=all(r['exit'] == 0 for r in results), outputs=report['outputs'], shared=report['shared'])
        atomic(self.runtime / 'reports' / (token + '.verification.json'), json.dumps(verification, indent=2))
        with self.mutex():
            state = self.load()
            self.owner(state, token, agent)
            try:
                self.proposal(state, token, agent, proposal)
            except ValueError as error:
                verification['passed'] = False
                verification['results'].append(dict(command=['baseline-recheck'], exit=1, stderr=str(error)))
            atomic(self.runtime / 'reports' / (token + '.verification.json'), json.dumps(verification, indent=2))
            self.event(state, agent, claim['tasks'], 'verified' if verification['passed'] else 'verification-failed', 'Isolated proposal checks; no source applied', claim['resources'], verification)
            if not verification['passed']:
                self.release(state, token, agent, 'Verification failed; staged outputs and exact command results retained', waiting=True)
            self.save(state)
        return verification

    def transition(self, state, ids, target, note, children=()):
        if target not in {'Ready', 'Waiting', 'Retired', 'Split'} or not note:
            raise ValueError('Supported planner state and exact reason required')
        for ident in ids:
            task = next(t for t in state['tasks'] if t['id'] == ident)
            if task['claim'] or task['state'] in {'Done', 'Retired', 'Split'}:
                raise ValueError('Claimed or terminal task cannot be reopened')
            if target == 'Ready' and any(b['state'] == 'Pending' and ident in b['tasks'] for b in state.get('batches', [])):
                raise ValueError('Deferred verification is pending')
            if target == 'Ready' and not set(task['dependencies']) <= {t['id'] for t in state['tasks'] if t['state'] == 'Done'}:
                raise ValueError('Dependencies are not Done')
            if target == 'Split' and (not children or ident in children or not set(children) <= {t['id'] for t in state['tasks']}):
                raise ValueError('Split requires existing linked child tasks')
            task.update(state=target, updated=now())
            task['notes'].append(note)
            if target == 'Split':
                task['children'] = list(children)
            if target == 'Retired':
                if any(not c.get('released') and any(self.conflict(a, b) for a in task['resources'] for b in c['resources']) for c in state['claims']):
                    raise ValueError('BUSY: cannot retire a resource held by another task')
                state.setdefault('retired_resources', []).extend(task['resources'])
        self.event(state, 'planner', ids, target.lower(), note)

    def complete(self, state, claim, report, journal):
        record = json.loads(journal.read_text(encoding='utf8'))
        verification = json.loads((self.runtime / 'reports' / (claim['token'] + '.verification.json')).read_text(encoding='utf8'))
        for task in state['tasks']:
            if task['id'] in claim['tasks']:
                task.update(state='Done', owner=None, claim=None, updated=now(), completed=now(), rollback=str(journal))
                task['completion'] = dict(outputs=record['outputs'], review=record['review'], reviewer=claim['agent'], verification=verification, applied=now(), deployed=False)
                if str(journal) not in task['evidence']:
                    task['evidence'].append(str(journal))
        claim.update(released=now(), reason='Verified outputs applied')
        for batch in state.get('batches', []):
            if batch['owner'] in claim['tasks']:
                batch.update(state='Verified', evidence=str(journal))
        self.event(state, claim['agent'], claim['tasks'], 'completed', 'Verified outputs applied; not deployed', claim['resources'], str(journal))

    def apply(self, state, token, agent, proposal, review):
        if self.config['mode'] != 'apply-verified':
            raise ValueError('Source application is disabled: proposal-only configuration')
        claim, report = self.proposal(state, token, agent, proposal)
        if 'apply' not in self.config['roles'][claim['role']] or agent == report['agent'] or not review:
            raise ValueError('Independent integrator and explicit criteria review required')
        verification = json.loads((self.runtime / 'reports' / (token + '.verification.json')).read_text(encoding='utf8'))
        if not verification['passed'] or verification['outputs'] != report['outputs'] or verification['shared'] != report['shared'] or verification['proposal'] != proposal:
            raise ValueError('Current proposal has not passed verification')
        for other in state['claims']:
            if not other.get('released') and other['token'] != token and any(self.conflict(resource, r) for resource in ['_apply', '_shared'] for r in other['resources']):
                raise ValueError('BUSY: integration/shared source window')
        directory = self.runtime / 'reports' / token / 'apply'
        journal = directory / 'journal.json'
        if journal.exists():
            raise ValueError('Interrupted apply exists; use recover-apply')
        for item in report['outputs']:
            if item['baseline'] is not None:
                atomic(directory / 'baseline' / item['path'], (self.root / item['path']).read_bytes())
        record = dict(claim=token, proposal=proposal, tasks=claim['tasks'], outputs=report['outputs'], review=review, state='Applying', applied=[])
        atomic(journal, json.dumps(record, indent=2))
        for item in report['outputs']:
            atomic(self.root / item['path'], (self.runtime / 'reports' / proposal / 'proposal' / item['path']).read_bytes())
            record['applied'].append(item['path'])
            atomic(journal, json.dumps(record, indent=2))
        record.update(state='Applied', completed=now())
        atomic(journal, json.dumps(record, indent=2))
        self.complete(state, claim, report, journal)
        return record

    def recover_apply(self, state, token, agent):
        # Recovered owners cannot call this: recovery requires the current token.
        previous = next((c for c in state['claims'] if c['token'] == token and c['agent'] == agent), None)
        if previous and previous.get('reason') == 'Verified outputs applied' and all(t['state'] == 'Done' for t in state['tasks'] if t['id'] in previous['tasks']):
            return {'state': 'Already finalized', 'tasks': previous['tasks']}
        claim = self.owner(state, token, agent)
        journal = self.runtime / 'reports' / token / 'apply/journal.json'
        record = json.loads(journal.read_text(encoding='utf8'))
        for item in record['outputs']:
            self.resource('file:' + item['path'])
            if digest(self.root / item['path']) != item['proposed']:
                raise ValueError('Apply incomplete; rollback under current ownership before retrying')
        self.complete(state, claim, record, journal)
        record['state'] = 'Applied'
        atomic(journal, json.dumps(record, indent=2))
        return record

    def rollback(self, state, token, agent, applied_token):
        claim = self.owner(state, token, agent)
        if self.config['mode'] != 'apply-verified' or 'apply' not in self.config['roles'][claim['role']]:
            raise ValueError('Rollback needs authorized integrator')
        if any(not c.get('released') and c['token'] != token and any(self.conflict(r, owned) for r in ['_apply', '_shared'] for owned in c['resources']) for c in state['claims']):
            raise ValueError('BUSY: integration/shared source window')
        if not any(c['token'] == applied_token for c in state['claims']):
            raise ValueError('Unknown apply record')
        journal = self.runtime / 'reports' / applied_token / 'apply/journal.json'
        record = json.loads(journal.read_text(encoding='utf8'))
        for item in record['outputs']:
            resource = self.resource('file:' + item['path'])
            if not any(self.conflict(resource, r) for r in claim['resources'] if not r.startswith('_')):
                raise ValueError('Rollback output is not owned')
            if digest(self.root / item['path']) not in {item['proposed'], item['baseline']}:
                raise ValueError('Output changed since apply; cannot overwrite')
            if item['baseline'] is not None and digest(journal.parent / 'baseline' / item['path']) != item['baseline']:
                raise ValueError('Rollback backup is corrupt')
        for item in record['outputs']:
            target = self.root / item['path']
            if item['baseline'] is None:
                target.unlink(missing_ok=True)
            else:
                backup = journal.parent / 'baseline' / item['path']
                if digest(backup) != item['baseline']:
                    raise ValueError('Rollback backup is corrupt')
                atomic(target, backup.read_bytes())
        record['state'] = 'Rolled back'
        atomic(journal, json.dumps(record, indent=2))
        self.release(state, token, agent, 'Rolled back outputs; original Done records retained; follow-up required', waiting=True)
        return record

    def git_check(self):
        prefix = self.home.relative_to(self.root).as_posix() + '/'
        tracked = subprocess.run(['git', 'ls-files', '-z'], cwd=self.root, check=True, capture_output=True).stdout.decode().split('\0')
        forbidden = [p for p in tracked if p.startswith(prefix) and any(part.startswith('.write-') or part in {'.runtime', '.mutex', 'locks', 'done', 'batch', 'retired-register'} for part in p[len(prefix):].split('/'))]
        if forbidden:
            raise ValueError('Local ownership artifacts are staged/tracked: ' + ', '.join(forbidden))
        catalog = subprocess.run(['git', 'show', ':' + prefix + 'QUEUE.md'], cwd=self.root, capture_output=True, text=True, encoding='utf8')
        if catalog.returncode == 0:
            state = json.loads(catalog.stdout.split(MARK, 1)[1].removeprefix('```json\n').rsplit('\n```', 1)[0])
            if state['claims'] or any(t['owner'] or t['claim'] or t['state'] == 'In progress' for t in state['tasks']):
                raise ValueError('Staged catalog contains active ownership')
        return dict(safe=True, branch=self.branch)

    def validate(self, state):
        tasks = {t['id']: t for t in state['tasks']}
        if len({c['token'] for c in state['claims']}) != len(state['claims']):
            raise ValueError('Duplicate claim tokens')
        active = [c for c in state['claims'] if not c.get('released')]
        if state['next_id'] <= max([int(t[2:].split('-')[0]) for t in tasks] or [0]):
            raise ValueError('ID allocator regressed')
        for index, claim in enumerate(active):
            for ident in claim['tasks']:
                if tasks[ident]['claim'] != claim['token'] or tasks[ident]['owner'] != claim['agent'] or tasks[ident]['state'] != 'In progress':
                    raise ValueError('Ownership mismatch')
            for other in active[index + 1:]:
                if any(self.conflict(a, b) for a in claim['resources'] for b in other['resources']):
                    raise ValueError('Conflicting active claims')
        for task in tasks.values():
            self.resolve(task['resources'])
            if task['state'] == 'In progress' and not any(c['token'] == task['claim'] for c in active):
                raise ValueError('Missing active claim')
            if not set(task['dependencies']) <= tasks.keys():
                raise ValueError('Missing dependency')
            if task['state'] == 'Done' and (not task.get('completion', {}).get('verification', {}).get('passed') or not task.get('completion', {}).get('review')):
                raise ValueError('Done lacks verified output evidence and independent review')
        return dict(valid=True, tasks=len(tasks), active_claims=len(active))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--queue', default=str(HERE))
    parser.add_argument('command', choices=['init', 'status', 'resolve', 'add', 'claim', 'heartbeat', 'held', 'release', 'break-stale', 'stage', 'validate', 'repair', 'verify', 'apply', 'recover-apply', 'rollback', 'transition', 'defer', 'git-check'])
    parser.add_argument('items', nargs='*')
    parser.add_argument('--agent', default='operator')
    parser.add_argument('--role', default='frontend')
    parser.add_argument('--claim')
    parser.add_argument('--tasks', nargs='+')
    parser.add_argument('--note')
    parser.add_argument('--abandoned')
    parser.add_argument('--proposal')
    parser.add_argument('--state')
    parser.add_argument('--children', nargs='*', default=[])
    parser.add_argument('--batch')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    queue = Queue(args.queue)
    if args.command == 'verify':
        result = queue.verify(args.claim, args.agent, args.proposal)
        print(json.dumps(result, indent=2))
        return 0 if result['passed'] else 1
    with queue.mutex():
        if args.command == 'init':
            if (queue.home / 'QUEUE.md').exists():
                raise ValueError('Already initialized')
            queue.save(dict(next_id=1, tasks=[], claims=[], events=[]))
            return
        state = queue.load()
        result = None
        if args.command == 'status':
            result = dict(refreshed=now(), branch=queue.branch, runtime=str(queue.runtime), counts={s: sum(t['state'] == s for t in state['tasks']) for s in sorted(STATES)}, priorities={str(p): sum(t['priority'] == p for t in state['tasks']) for p in sorted({t['priority'] for t in state['tasks']})}, tasks=state['tasks'], active_claims=[dict(c, stale=time.time() - c['heartbeat'] > queue.config['stale_seconds']) for c in state['claims'] if not c.get('released')], recent=state['events'][-10:], batches=state.get('batches', []))
        elif args.command == 'resolve':
            result = queue.resolve(args.items)
        elif args.command == 'git-check':
            result = queue.git_check()
        elif args.command == 'add':
            result = queue.add(state, json.loads(Path(args.items[0]).read_text(encoding='utf8')))
        elif args.command == 'claim':
            result = queue.claim(state, args.agent, args.tasks, args.role)
        elif args.command == 'heartbeat':
            queue.owner(state, args.claim, args.agent)['heartbeat'] = time.time()
        elif args.command == 'held':
            result = [c for c in state['claims'] if c['agent'] == args.agent and not c.get('released')]
        elif args.command == 'release':
            if not args.note:
                raise ValueError('Exact remainder required in --note')
            queue.release(state, args.claim, args.agent, args.note)
        elif args.command == 'stage':
            result = queue.stage(state, args.claim, args.agent, args.items[0])
        elif args.command == 'apply':
            result = queue.apply(state, args.claim, args.agent, args.proposal, args.note)
        elif args.command == 'recover-apply':
            result = queue.recover_apply(state, args.claim, args.agent)
        elif args.command == 'rollback':
            result = queue.rollback(state, args.claim, args.agent, args.proposal)
        elif args.command == 'transition':
            queue.transition(state, args.tasks, args.state, args.note, args.children)
        elif args.command == 'defer':
            owner = next(t for t in state['tasks'] if t['id'] == args.batch)
            if owner['type'] != 'verification' or owner['state'] in {'Done', 'Retired', 'Split'}:
                raise ValueError('A pending verification task must own the batch')
            queue.transition(state, args.tasks, 'Waiting', args.note)
            state.setdefault('batches', []).append(dict(id=uuid.uuid4().hex, owner=args.batch, tasks=args.tasks, state='Pending', reason=args.note))
        elif args.command == 'break-stale':
            for claim in state['claims']:
                if not claim.get('released') and claim['agent'] == args.abandoned and time.time() - claim['heartbeat'] > queue.config['stale_seconds']:
                    queue.release(state, claim['token'], claim['agent'], f'Recovered by {args.agent}; operator attested abandoned run; inspect staged outputs')
        elif args.command in {'validate', 'repair'}:
            result = queue.validate(state)
        queue.validate(state)
        if args.command not in {'status', 'resolve', 'held', 'validate', 'git-check'}:
            queue.save(state)
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        sys.exit(main() or 0)
    except (ValueError, KeyError, IndexError, StopIteration, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
