import concurrent.futures
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import time

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / 'plan/agent-queue/tools/queue.py'
spec = importlib.util.spec_from_file_location('agent_queue', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@pytest.fixture(params=['shadow', 'authoritative'])
def queue(tmp_path, request):
    root = tmp_path / 'project'
    home = root / 'queue'
    home.mkdir(parents=True)
    (root / 'src').mkdir()
    (root / 'reference').mkdir()
    for name in ['a', 'b', 'shared']:
        (root / 'src' / name).write_text('original', encoding='utf8')
    config = dict(project_root='..', timezone='Australia/Sydney', stale_seconds=1,
                  writable=['src'], read_only=['reference'], forbidden=['.git'],
                  roles={'frontend': ['stage', 'verify'], 'integrator': ['verify', 'apply']}, shared_sources=['src/shared'],
                  mode='proposal-only', verification_inputs=['src'], verification_commands=[['{python}', '-c', 'from pathlib import Path; assert Path("src/a").read_text()=="proposal"']],
                  build_units={'both': ['file:src/a', 'file:src/b']})
    (home / 'config.json').write_text(json.dumps(config), encoding='utf8')
    (home / 'GOVERNANCE.md').write_text('# Rules\n', encoding='utf8')
    queue = module.Queue(home)
    if request.param == 'authoritative':
        # WQ00203: every test also runs with qdb/queue.db as the store.
        (home / 'qdb').mkdir()
        (home / 'qdb/queue-db.json').write_text(json.dumps(dict(mode='authoritative', branch=queue.branch)), encoding='utf8')
    queue.save(dict(next_id=1, tasks=[], claims=[], events=[]))
    return queue


def task(origin, resource='file:src/a'):
    return dict(origin=origin, description='Repair one deviation', criteria=['Verify it'], resources=[resource])


def change(queue, operation, *args):
    with queue.mutex():
        state = queue.load()
        result = getattr(queue, operation)(state, *args)
        queue.validate(state)
        queue.save(state)
        return result


def checked_stage(queue, token, agent, directory):
    assert queue.precheck(token, agent, directory)['passed']
    return change(queue, 'stage', token, agent, directory)


def test_stage_refuses_unchecked_failing_and_changed_proposals(queue):
    ids = change(queue, 'add', [task('a')])
    claim = change(queue, 'claim', 'worker', ids, 'frontend')
    proposal = queue.home / 'reports/run/proposal/src'
    proposal.mkdir(parents=True)
    (proposal / 'a').write_text('proposal', encoding='utf8')
    with pytest.raises(ValueError, match='Run precheck'):
        change(queue, 'stage', claim['token'], 'worker', str(proposal.parent))
    (proposal / 'a').write_text('wrong', encoding='utf8')
    assert not queue.precheck(claim['token'], 'worker', str(proposal.parent))['passed']
    with pytest.raises(ValueError, match='Precheck failed'):
        change(queue, 'stage', claim['token'], 'worker', str(proposal.parent))
    (proposal / 'a').write_text('proposal', encoding='utf8')
    with pytest.raises(ValueError, match='changed since precheck'):
        change(queue, 'stage', claim['token'], 'worker', str(proposal.parent))
    assert queue.load()['tasks'][0]['state'] == 'In progress'
    checked_stage(queue, claim['token'], 'worker', str(proposal.parent))
    assert queue.load()['tasks'][0]['state'] == 'Waiting'


def test_claim_conflicts_and_independent_files(queue):
    ids = change(queue, 'add', [task('a'), task('b', 'file:src/b'), task('again')])
    first = change(queue, 'claim', 'one', [ids[0]], 'frontend')
    with pytest.raises(ValueError):
        change(queue, 'claim', 'two', [ids[0]], 'frontend')
    with pytest.raises(ValueError, match='BUSY'):
        change(queue, 'claim', 'two', [ids[2]], 'frontend')
    second = change(queue, 'claim', 'two', [ids[1]], 'frontend')
    assert first['token'] != second['token']
    assert queue.validate(queue.load())['active_claims'] == 2


@pytest.mark.parametrize('a,b,conflict', [
    ('folder:src', 'file:src/a', True), ('file:src/a', 'folder:src', True),
    ('file:src/a', 'file:src/b', False), ('folder:src/a', 'folder:src/ab', False),
    ('_folder', 'file:src/a', True), ('_apply', '_apply', True),
    ('_shared', '_shared', True), ('_shared', 'file:src/a', False),
    ('_apply', '_shared', False), ('_folder', '_apply', True),
])
def test_conflict_matrix(queue, a, b, conflict):
    assert queue.conflict(a, b) is conflict
    assert queue.conflict(b, a) is conflict


def test_multi_resource_claim_is_all_or_nothing(queue):
    ids = change(queue, 'add', [task('held', 'file:src/b'), task('multi', 'both')])
    change(queue, 'claim', 'one', [ids[0]], 'frontend')
    before = queue.load()
    with pytest.raises(ValueError, match='BUSY'):
        change(queue, 'claim', 'two', [ids[1]], 'frontend')
    assert queue.load() == before


def test_non_owner_and_recovered_tokens_are_rejected(queue):
    ids = change(queue, 'add', [task('a')])
    claim = change(queue, 'claim', 'owner', ids, 'frontend')
    for method, tail in [('release', ('remainder',)), ('stage', (str(queue.home / 'reports'),))]:
        with pytest.raises(ValueError, match='Not current owner'):
            change(queue, method, claim['token'], 'intruder', *tail)
    with queue.mutex():
        state = queue.load()
        state['claims'][0]['heartbeat'] = time.time() - 10
        queue.save(state)
    subprocess.run([sys.executable, str(SCRIPT), '--queue', str(queue.home), 'break-stale', '--agent', 'operator', '--abandoned', 'owner'], check=True, capture_output=True)
    with pytest.raises(ValueError, match='Not current owner'):
        queue.owner(queue.load(), claim['token'], 'owner')
    assert queue.load()['tasks'][0]['state'] == 'Ready'
    new = change(queue, 'claim', 'new', ids, 'frontend')
    assert new['token'] != claim['token']


def test_live_claim_is_not_recovered_merely_on_operator_request(queue):
    ids = change(queue, 'add', [task('a')])
    change(queue, 'claim', 'live', ids, 'frontend')
    subprocess.run([sys.executable, str(SCRIPT), '--queue', str(queue.home), 'break-stale', '--abandoned', 'live'], check=True, capture_output=True)
    assert queue.load()['tasks'][0]['state'] == 'In progress'


@pytest.mark.parametrize('path', ['file:../escape', 'file:reference/book', 'file:.git/config', 'folder:reference', 'file:src-other/nope'])
def test_boundaries(queue, path):
    with pytest.raises(ValueError):
        queue.resource(path)


def test_shared_version_and_baseline_changes_invalidate_proposal(queue):
    ids = change(queue, 'add', [task('a')])
    claim = change(queue, 'claim', 'worker', ids, 'frontend')
    proposal = queue.home / 'reports/run/proposal/src'
    proposal.mkdir(parents=True)
    (proposal / 'a').write_text('proposed', encoding='utf8')
    (queue.root / 'src/shared').write_text('changed', encoding='utf8')
    with pytest.raises(ValueError, match='Shared source changed'):
        change(queue, 'stage', claim['token'], 'worker', str(proposal.parent))
    assert (proposal / 'a').read_text() == 'proposed'
    assert queue.load()['tasks'][0]['state'] == 'In progress'
    (queue.root / 'src/shared').write_text('original', encoding='utf8')
    (queue.root / 'src/a').write_text('changed', encoding='utf8')
    with pytest.raises(ValueError, match='Baseline changed'):
        change(queue, 'stage', claim['token'], 'worker', str(proposal.parent))


def test_staging_preserves_source_and_records_waiting(queue):
    ids = change(queue, 'add', [task('a')])
    claim = change(queue, 'claim', 'worker', ids, 'frontend')
    proposal = queue.home / 'reports/run/proposal/src'
    proposal.mkdir(parents=True)
    (proposal / 'a').write_text('proposal', encoding='utf8')
    report = checked_stage(queue, claim['token'], 'worker', str(proposal.parent))
    assert report['verification'] == 'Pending; not applied'
    assert (queue.root / 'src/a').read_text() == 'original'
    assert queue.load()['tasks'][0]['state'] == 'Waiting'
    assert not list((queue.runtime / 'done').iterdir())


def test_interrupted_views_are_recoverable(queue, monkeypatch):
    ids = change(queue, 'add', [task('a')])
    with monkeypatch.context() as patch:
        patch.setattr(queue, 'views', lambda state: (_ for _ in ()).throw(OSError('interrupted view write')))
        with pytest.raises(OSError):
            change(queue, 'claim', 'worker', ids, 'frontend')
    state = queue.load()
    assert state['tasks'][0]['state'] == 'In progress'
    queue.views(state)
    assert len(list((queue.runtime / 'locks').glob('*.claim'))) == 1
    assert queue.validate(state)['valid']


def test_concurrent_allocations_preserve_every_task(queue):
    def add(index):
        path = queue.home / f'input-{index}.json'
        path.write_text(json.dumps([task(f'unique-{index}')]), encoding='utf8')
        for _ in range(100):
            result = subprocess.run([sys.executable, str(SCRIPT), '--queue', str(queue.home), 'add', str(path)], capture_output=True, text=True)
            if result.returncode == 0:
                return
            assert 'BUSY' in result.stderr
            time.sleep(0.01)
        pytest.fail('Queue stayed busy')
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(add, range(8)))
    state = queue.load()
    assert len(state['tasks']) == len({t['id'] for t in state['tasks']}) == 8
    assert len(state['events']) == 8


def test_import_idempotent_and_corruption_detected(queue):
    assert len(change(queue, 'add', [task('same')])) == 1
    assert change(queue, 'add', [task('same')]) == []
    state = queue.load()
    state['tasks'].append(state['tasks'][0])
    (queue.runtime / 'state.json').write_text(json.dumps(state), encoding='utf8')
    with pytest.raises(ValueError, match='duplicate IDs' if not queue.authoritative() else 'outside the queue database'):
        queue.load()


def test_two_processes_cannot_claim_the_same_task(queue):
    ids = change(queue, 'add', [task('contended')])
    def claim(agent):
        return subprocess.run([sys.executable, str(SCRIPT), '--queue', str(queue.home), 'claim', '--agent', agent, '--tasks', ids[0]], capture_output=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(claim, ['worker-one', 'worker-two']))
    assert sorted(r.returncode for r in results) == [0, 1]
    assert queue.validate(queue.load())['active_claims'] == 1


def test_status_totals_and_ownership_are_separate(queue):
    ids = change(queue, 'add', [task('one'), task('two', 'file:src/b')])
    change(queue, 'claim', 'worker', ids[:1], 'frontend')
    result = subprocess.run([sys.executable, str(SCRIPT), '--queue', str(queue.home), 'status', '--json'], check=True, capture_output=True, text=True)
    status = json.loads(result.stdout)
    assert sum(status['counts'].values()) == 2
    assert status['counts']['Ready'] == status['counts']['In progress'] == 1
    assert len(status['active_claims']) == 1


def staged(queue):
    ids = change(queue, 'add', [task('proposal')])
    worker = change(queue, 'claim', 'builder', ids, 'frontend')
    proposal = queue.home / 'reports/run/proposal/src'
    proposal.mkdir(parents=True)
    (proposal / 'a').write_text('proposal', encoding='utf8')
    checked_stage(queue, worker['token'], 'builder', str(proposal.parent))
    integrator = change(queue, 'claim', 'reviewer', ids, 'integrator')
    return ids, worker, integrator


def test_verification_tests_staged_outputs_and_apply_requires_authorization(queue):
    ids, worker, integrator = staged(queue)
    result = queue.verify(integrator['token'], 'reviewer', worker['token'])
    assert result['passed']
    assert (queue.root / 'src/a').read_text() == 'original'
    with pytest.raises(ValueError, match='disabled'):
        change(queue, 'apply', integrator['token'], 'reviewer', worker['token'], 'Reviewed all criteria')
    queue.config['mode'] = 'apply-verified'
    change(queue, 'apply', integrator['token'], 'reviewer', worker['token'], 'Reviewed all criteria')
    assert (queue.root / 'src/a').read_text() == 'proposal'
    state = queue.load()
    assert state['tasks'][0]['state'] == 'Done'
    assert (queue.runtime / 'done' / (ids[0] + '.json')).exists()
    with pytest.raises(ValueError, match='terminal'):
        change(queue, 'transition', ids, 'Ready', 'Reopen')


def test_failed_verification_retains_proposal_and_exact_evidence(queue):
    ids, worker, integrator = staged(queue)
    queue.config['verification_commands'] = [['{python}', '-c', 'raise SystemExit(3)']]
    result = queue.verify(integrator['token'], 'reviewer', worker['token'])
    assert not result['passed']
    assert result['results'][0]['exit'] == 3
    assert queue.load()['tasks'][0]['state'] == 'Waiting'
    assert (queue.runtime / 'reports' / worker['token'] / 'proposal/src/a').read_text() == 'proposal'


def test_shared_source_change_after_verification_prevents_apply(queue):
    ids, worker, integrator = staged(queue)
    assert queue.verify(integrator['token'], 'reviewer', worker['token'])['passed']
    queue.config['mode'] = 'apply-verified'
    (queue.root / 'src/shared').write_text('changed', encoding='utf8')
    with pytest.raises(ValueError, match='Shared source changed'):
        change(queue, 'apply', integrator['token'], 'reviewer', worker['token'], 'Reviewed')


def test_interrupted_finalization_resumes_idempotently(queue, monkeypatch):
    ids, worker, integrator = staged(queue)
    queue.verify(integrator['token'], 'reviewer', worker['token'])
    queue.config['mode'] = 'apply-verified'
    with monkeypatch.context() as patch:
        patch.setattr(queue, 'complete', lambda *args: (_ for _ in ()).throw(OSError('interrupted finalization')))
        with pytest.raises(OSError):
            change(queue, 'apply', integrator['token'], 'reviewer', worker['token'], 'Reviewed')
    assert (queue.root / 'src/a').read_text() == 'proposal'
    assert queue.load()['tasks'][0]['state'] == 'In progress'
    change(queue, 'recover_apply', integrator['token'], 'reviewer')
    assert change(queue, 'recover_apply', integrator['token'], 'reviewer')['state'] == 'Already finalized'
    assert sum(e['outcome'] == 'completed' for e in queue.load()['events']) == 1


def test_rollback_needs_current_ownership_and_keeps_terminal_history(queue):
    ids, worker, integrator = staged(queue)
    queue.verify(integrator['token'], 'reviewer', worker['token'])
    queue.config['mode'] = 'apply-verified'
    change(queue, 'apply', integrator['token'], 'reviewer', worker['token'], 'Reviewed')
    followup = change(queue, 'add', [task('rollback-follow-up')])
    owner = change(queue, 'claim', 'reviewer-rollback', followup, 'integrator')
    with pytest.raises(ValueError, match='Not current owner'):
        change(queue, 'rollback', owner['token'], 'intruder', integrator['token'])
    change(queue, 'rollback', owner['token'], 'reviewer-rollback', integrator['token'])
    assert (queue.root / 'src/a').read_text() == 'original'
    assert queue.load()['tasks'][0]['state'] == 'Done'
    assert queue.load()['tasks'][1]['state'] == 'Waiting'


def test_folder_snapshots_support_existing_and_new_outputs(queue):
    ids = change(queue, 'add', [task('folder', 'folder:src')])
    claim = change(queue, 'claim', 'builder', ids, 'frontend')
    proposal = queue.home / 'reports/folder/proposal/src'
    proposal.mkdir(parents=True)
    (proposal / 'new').write_text('new output', encoding='utf8')
    (proposal / 'a').write_text('proposal', encoding='utf8')
    report = checked_stage(queue, claim['token'], 'builder', str(proposal.parent))
    assert next(o for o in report['outputs'] if o['path'] == 'src/new')['baseline'] is None


def test_retired_resources_and_invalid_splits_are_blocked(queue):
    ids = change(queue, 'add', [task('retire')])
    change(queue, 'transition', ids, 'Retired', 'Replaced by another module')
    new = change(queue, 'add', [task('new')])
    with pytest.raises(ValueError, match='Retired resource'):
        change(queue, 'claim', 'worker', new, 'frontend')
    with pytest.raises(ValueError, match='Split requires'):
        change(queue, 'transition', new, 'Split', 'Too large')


def test_active_leases_never_enter_catalog_or_follow_new_branch(queue):
    (queue.home / '.gitignore').write_text('.runtime/\n.mutex\nqdb/\n', encoding='utf8')
    for command in [['git', 'init', '--quiet'], ['git', 'symbolic-ref', 'HEAD', 'refs/heads/main'], ['git', 'add', '.'], ['git', '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Fixture']]:
        subprocess.run(command, cwd=queue.root, check=True, capture_output=True)
    if queue.authoritative():
        # The database belongs to main only; the new branch below keeps the branch-local store (Q011, Q026).
        (queue.home / 'qdb/queue-db.json').write_text(json.dumps(dict(mode='authoritative', branch='main')), encoding='utf8')
    original = module.Queue(queue.home)
    ids = change(original, 'add', [task('branch-local')])
    lease = change(original, 'claim', 'main-worker', ids, 'frontend')
    assert lease['token'] not in (queue.home / 'QUEUE.md').read_text()
    assert subprocess.run(['git', 'check-ignore', str(original.runtime / 'state.json')], cwd=queue.root, capture_output=True).returncode == 0
    subprocess.run(['git', 'checkout', '-qb', 'new-from-main'], cwd=queue.root, check=True, capture_output=True)
    fresh = module.Queue(queue.home)
    assert fresh.load()['claims'] == []
    assert fresh.load()['tasks'][0]['owner'] is None
    assert not fresh.authoritative()
    change(fresh, 'claim', 'fresh-worker', ids, 'frontend')
    subprocess.run(['git', 'checkout', '-q', 'main'], cwd=queue.root, check=True, capture_output=True)
    assert module.Queue(queue.home).load()['tasks'][0]['owner'] == 'main-worker'


def test_integration_mutex_conflict_leaves_outputs_unmodified(queue):
    ids, worker, integrator = staged(queue)
    queue.verify(integrator['token'], 'reviewer', worker['token'])
    queue.config['mode'] = 'apply-verified'
    busy = change(queue, 'add', [task('integration-window', '_apply')])
    change(queue, 'claim', 'another-integrator', busy, 'frontend')
    with pytest.raises(ValueError, match='BUSY'):
        change(queue, 'apply', integrator['token'], 'reviewer', worker['token'], 'Reviewed')
    assert (queue.root / 'src/a').read_text() == 'original'
    assert not (queue.runtime / 'reports' / integrator['token'] / 'apply/journal.json').exists()


def test_setup_failure_records_evidence_and_waiting(queue, monkeypatch):
    ids, worker, integrator = staged(queue)
    actual = module.subprocess.run
    def fail_setup(argv, **kwargs):
        if argv[:2] == ['git', '-c']:
            raise subprocess.CalledProcessError(1, argv, stderr=b'Git setup failed')
        return actual(argv, **kwargs)
    monkeypatch.setattr(module.subprocess, 'run', fail_setup)
    result = queue.verify(integrator['token'], 'reviewer', worker['token'])
    assert not result['passed']
    assert result['results'][0]['stderr'] == 'Git setup failed'
    assert queue.load()['tasks'][0]['state'] == 'Waiting'


def test_deferred_batch_blocks_ready_transition(queue):
    records = [task('waiting')]
    batch = task('batch', 'file:src/b')
    batch['type'] = 'verification'
    ids = change(queue, 'add', records + [batch])
    result = subprocess.run([sys.executable, str(SCRIPT), '--queue', str(queue.home), 'defer', '--tasks', ids[0], '--batch', ids[1], '--note', 'Browser verification pending'], capture_output=True)
    assert result.returncode == 0, result.stderr
    with pytest.raises(ValueError, match='Deferred verification'):
        change(queue, 'transition', ids[:1], 'Ready', 'Premature')
    assert queue.load()['batches'][0]['owner'] == ids[1]


def test_ignored_runtime_force_added_to_index_is_rejected(queue):
    (queue.home / '.gitignore').write_text('.runtime/\n.mutex\n', encoding='utf8')
    subprocess.run(['git', 'init', '-q'], cwd=queue.root, check=True, capture_output=True)
    path = queue.runtime / 'state.json'
    subprocess.run(['git', 'add', '-f', str(path)], cwd=queue.root, check=True, capture_output=True)
    with pytest.raises(ValueError, match='ownership artifacts'):
        queue.git_check()


def test_amend_sets_dependencies_criteria_and_refuses_cycles_and_terminal(queue):
    a, b = change(queue, 'add', [task('amend-a'), task('amend-b', 'file:src/b')])
    change(queue, 'amend', [b], 'order', [a], ['Run after a'])
    state = queue.load()
    tb = next(t for t in state['tasks'] if t['id'] == b)
    assert tb['dependencies'] == [a] and tb['criteria'][-1] == 'Run after a' and tb['notes'][-1].startswith('Amended: order')
    with pytest.raises(ValueError, match='cycle'):
        change(queue, 'amend', [a], 'cycle', [b])
    with pytest.raises(ValueError, match='Nothing to amend'):
        change(queue, 'amend', [a], 'noop')
    change(queue, 'transition', [a], 'Retired', 'gone')
    with pytest.raises(ValueError, match='Only an unclaimed Ready'):
        change(queue, 'amend', [a], 'x', None, ['late'])
    with pytest.raises(ValueError, match='never becomes Done'):
        change(queue, 'amend', [b], 'x', [a])


def test_amend_refuses_claimed_task(queue):
    ids = change(queue, 'add', [task('amend-c')])
    change(queue, 'claim', 'worker', ids, 'frontend')
    with pytest.raises(ValueError, match='Only an unclaimed Ready'):
        change(queue, 'amend', ids, 'x', None, ['late'])


# ---------------------------------------------------------------- WQ00203: queue database store (rule Q026)
def cli(queue, *args):
    return subprocess.run([sys.executable, str(SCRIPT), '--queue', str(queue.home), *args], capture_output=True, text=True)


def views(queue):
    return {path.name: path.read_bytes() for path in [queue.runtime / 'state.json', queue.home / 'QUEUE.md']}


def test_import_then_regenerate_gives_identical_files(queue):
    if queue.authoritative():
        assert cli(queue, 'qdb-import', '--state', 'shadow').returncode == 0
    assert not module.Queue(queue.home).authoritative()
    ids, worker, integrator = staged(queue)
    change(queue, 'add', [task('second', 'file:src/b')])
    before = views(queue)
    result = cli(queue, 'qdb-import', '--state', 'authoritative')
    assert result.returncode == 0, result.stderr
    report = json.loads(result.stdout)
    assert report['identical'] == {'state.json': True, 'QUEUE.md': True} and report['mode'] == 'authoritative'
    assert module.Queue(queue.home).authoritative()
    assert cli(queue, 'repair').returncode == 0
    assert views(queue) == before
    assert module.Queue(queue.home).load() == json.loads(before['state.json'])
    # The Queue Monitor's qdb.py reads meta, tasks and status: they must be current.
    import sqlite3
    connection = sqlite3.connect(queue.home / 'qdb/queue.db')
    meta = dict(connection.execute('SELECT k, v FROM meta'))
    assert meta['mode'] == 'authoritative' and meta['writer'] == 'tools/queue.py'
    assert connection.execute('SELECT COUNT(*) FROM tasks').fetchone()[0] == 2
    assert connection.execute("SELECT COUNT(*) FROM tasks WHERE state='Ready'").fetchone()[0] == 1
    assert connection.execute('SELECT COUNT(*) FROM status').fetchone()[0] == len(json.loads(before['state.json'])['events'])
    connection.close()


def test_import_refuses_flip_when_views_differ(queue):
    if queue.authoritative():
        assert cli(queue, 'qdb-import', '--state', 'shadow').returncode == 0
    change(module.Queue(queue.home), 'add', [task('one')])
    (queue.home / 'GOVERNANCE.md').write_text('# Rules changed after the last save\n', encoding='utf8')
    result = cli(queue, 'qdb-import', '--state', 'authoritative')
    assert result.returncode == 1 and 'mode left unchanged' in result.stderr
    assert not module.Queue(queue.home).authoritative()


def test_two_writers_in_parallel_lose_no_task(queue):
    def writer(name):
        for index in range(6):
            path = queue.home / f'input-{name}-{index}.json'
            path.write_text(json.dumps([task(f'{name}-{index}', 'file:src/' + ('a' if name == 'one' else 'b'))]), encoding='utf8')
            for _ in range(200):
                result = cli(queue, 'add', str(path))
                if result.returncode == 0:
                    break
                assert 'BUSY' in result.stderr, result.stderr
                time.sleep(0.01)
            else:
                pytest.fail('Queue stayed busy')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(writer, ['one', 'two']))
    state = queue.load()
    assert sorted(t['origin'] for t in state['tasks']) == sorted(f'{n}-{i}' for n in ['one', 'two'] for i in range(6))
    assert len({t['id'] for t in state['tasks']}) == 12 and state['next_id'] == 13
    assert queue.validate(state)['valid']


def test_writer_holding_an_old_database_copy_is_refused(queue):
    if not queue.authoritative():
        pytest.skip('generation check guards the database store only')
    change(queue, 'add', [task('one')])
    first, second = module.Queue(queue.home), module.Queue(queue.home)
    a, b = first.load(), second.load()
    first.add(a, [task('two')])
    first.save(a)
    second.add(b, [task('three')])
    with pytest.raises(ValueError, match='BUSY'):
        second.save(b)
    assert sorted(t['origin'] for t in queue.load()['tasks']) == ['one', 'two']


def test_verify_by_the_agent_that_staged_is_refused(queue):
    ids = change(queue, 'add', [task('self-check')])
    worker = change(queue, 'claim', 'builder', ids, 'frontend')
    proposal = queue.home / 'reports/self/proposal/src'
    proposal.mkdir(parents=True)
    (proposal / 'a').write_text('proposal', encoding='utf8')
    checked_stage(queue, worker['token'], 'builder', str(proposal.parent))
    own = change(queue, 'claim', 'builder', ids, 'integrator')
    with pytest.raises(ValueError, match='Independent verification'):
        queue.verify(own['token'], 'builder', worker['token'])
    assert not (queue.runtime / 'reports' / (own['token'] + '.verification.json')).exists()


def test_state_json_written_outside_the_tool_is_refused_then_adopted(queue):
    if not queue.authoritative():
        pytest.skip('database store only')
    change(queue, 'add', [task('one')])
    path = queue.runtime / 'state.json'
    state = json.loads(path.read_text(encoding='utf8'))
    state['tasks'][0]['notes'].append('written by another tool')
    path.write_text(json.dumps(state, indent=2), encoding='utf8')
    with pytest.raises(ValueError, match='outside the queue database'):
        queue.load()
    assert cli(queue, 'status', '--json').returncode == 1
    assert cli(queue, 'qdb-import').returncode == 0
    assert queue.load()['tasks'][0]['notes'] == ['written by another tool']
    assert cli(queue, 'validate').returncode == 0


def test_interrupted_view_write_after_database_write_recovers(queue, monkeypatch):
    if not queue.authoritative():
        pytest.skip('database store only')
    ids = change(queue, 'add', [task('one')])
    real = module.atomic
    def failing(path, text):
        if Path(path).name == 'state.json':
            raise OSError('interrupted before the view')
        return real(path, text)
    with monkeypatch.context() as patch:
        patch.setattr(module, 'atomic', failing)
        with pytest.raises(OSError):
            change(queue, 'claim', 'worker', ids, 'frontend')
    assert queue.load()['tasks'][0]['state'] == 'In progress'
    assert cli(queue, 'repair').returncode == 0
    assert json.loads((queue.runtime / 'state.json').read_text(encoding='utf8'))['tasks'][0]['state'] == 'In progress'


def test_shadow_build_over_the_database_falls_back_to_the_mirror(queue):
    if not queue.authoritative():
        pytest.skip('database store only')
    import os
    import sqlite3
    change(queue, 'add', [task('one')])
    target = queue.home / 'qdb/queue.db'
    other = queue.home / 'shadow.db'
    connection = sqlite3.connect(other)
    connection.execute('CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT)')
    connection.execute("INSERT INTO meta VALUES('mode', 'shadow')")
    connection.commit()
    connection.close()
    os.replace(other, target)
    assert [t['origin'] for t in queue.load()['tasks']] == ['one']
    change(queue, 'add', [task('two', 'file:src/b')])
    connection = sqlite3.connect(target)
    assert dict(connection.execute('SELECT k, v FROM meta'))['writer'] == 'tools/queue.py'
    connection.close()
    assert sorted(t['origin'] for t in queue.load()['tasks']) == ['one', 'two']


def test_mode_back_to_shadow_keeps_every_record(queue):
    if not queue.authoritative():
        pytest.skip('database store only')
    ids = change(queue, 'add', [task('one')])
    change(queue, 'claim', 'worker', ids, 'frontend')
    before = queue.load()
    assert cli(queue, 'qdb-import', '--state', 'shadow').returncode == 0
    legacy = module.Queue(queue.home)
    assert not legacy.authoritative()
    assert legacy.load() == before
    database = (queue.home / 'qdb/queue.db').read_bytes()
    change(legacy, 'add', [task('two', 'file:src/b')])
    assert (queue.home / 'qdb/queue.db').read_bytes() == database
    assert len(legacy.load()['tasks']) == 2


def test_database_is_for_its_branch_only(queue):
    if not queue.authoritative():
        pytest.skip('database store only')
    (queue.home / 'qdb/queue-db.json').write_text(json.dumps(dict(mode='authoritative', branch='some-other-branch')), encoding='utf8')
    database = (queue.home / 'qdb/queue.db').read_bytes()
    other = module.Queue(queue.home)
    assert not other.authoritative()
    change(other, 'add', [task('one')])
    assert (queue.home / 'qdb/queue.db').read_bytes() == database
    assert len(other.load()['tasks']) == 1
