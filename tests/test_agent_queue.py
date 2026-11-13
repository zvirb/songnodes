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


@pytest.fixture
def queue(tmp_path):
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
    report = change(queue, 'stage', claim['token'], 'worker', str(proposal.parent))
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
    with pytest.raises(ValueError, match='duplicate IDs'):
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
    change(queue, 'stage', worker['token'], 'builder', str(proposal.parent))
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
    report = change(queue, 'stage', claim['token'], 'builder', str(proposal.parent))
    assert report['outputs'][0]['baseline'] is None


def test_retired_resources_and_invalid_splits_are_blocked(queue):
    ids = change(queue, 'add', [task('retire')])
    change(queue, 'transition', ids, 'Retired', 'Replaced by another module')
    new = change(queue, 'add', [task('new')])
    with pytest.raises(ValueError, match='Retired resource'):
        change(queue, 'claim', 'worker', new, 'frontend')
    with pytest.raises(ValueError, match='Split requires'):
        change(queue, 'transition', new, 'Split', 'Too large')


def test_active_leases_never_enter_catalog_or_follow_new_branch(queue):
    (queue.home / '.gitignore').write_text('.runtime/\n.mutex\n', encoding='utf8')
    for command in [['git', 'init', '--quiet'], ['git', 'symbolic-ref', 'HEAD', 'refs/heads/main'], ['git', 'add', '.'], ['git', '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Fixture']]:
        subprocess.run(command, cwd=queue.root, check=True, capture_output=True)
    original = module.Queue(queue.home)
    ids = change(original, 'add', [task('branch-local')])
    lease = change(original, 'claim', 'main-worker', ids, 'frontend')
    assert lease['token'] not in (queue.home / 'QUEUE.md').read_text()
    assert subprocess.run(['git', 'check-ignore', str(original.runtime / 'state.json')], cwd=queue.root, capture_output=True).returncode == 0
    subprocess.run(['git', 'checkout', '-qb', 'new-from-main'], cwd=queue.root, check=True, capture_output=True)
    fresh = module.Queue(queue.home)
    assert fresh.load()['claims'] == []
    assert fresh.load()['tasks'][0]['owner'] is None
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
