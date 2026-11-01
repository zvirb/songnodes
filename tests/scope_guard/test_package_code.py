import importlib.util
import os
import subprocess
import tempfile

import pytest

SCRIPT = os.path.abspath('scripts/scope_guard.py')
_spec = importlib.util.spec_from_file_location('scope_guard', SCRIPT)
scope_guard = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(scope_guard)

BRIEFS = ['JOBDATE_jobs_date_span.md', 'JOBSTG_jobs_stage.md', 'DS24C_scrape_window_card.md',
          'U17B_graphql_websocket_route.md', 'SC2B_playlists_found.md', 'M6S_transition_scoring_spec.md',
          'PLAN2_next_wave.md', 'DSQ1A_design_system_1_7_0_answers.md', 'G1_scope_guard.md']


@pytest.fixture
def briefs(tmp_path):
    d = tmp_path / 'agents'
    d.mkdir()
    for name in BRIEFS:
        (d / name).write_text('x\n\n## Owned paths\n- a\n')
    return str(d)


@pytest.mark.parametrize('title, branch, code', [
    ('JOBDATE: GET /api/v1/jobs filters by a created date span', 'jobdate-jobs-date-span', 'JOBDATE'),
    ('JOBSTG: Jobs show their stage', 'jobstg-stage', 'JOBSTG'),
    ('DS24C: Pipeline page card for the scheduled-scrape window', 'ds24c-scrape-window-card', 'DS24C'),
    ('U17B: GraphQL websocket route', 'u17b-graphql-ws', 'U17B'),
    ('SC2B: Playlists found', 'sc2b-playlists-found', 'SC2B'),
    ('M6S: Transition scoring spec', 'm6s-spec', 'M6S'),
    ('PLAN2: Next wave briefs', 'plan2-next-wave', 'PLAN2'),
    ('DSQ1A: Design system 1.7.0 answers', 'dsq1-design-answers', 'DSQ1A'),
    ('G1: Scope guard', 'g1-scope-guard', 'G1'),
    # older fallbacks still work: a code later in the title, or only in the branch
    ('Restore work for G1 scope guard', 'misc', 'G1'),
    ('Scope guard follow-up', 'g1-follow-up', 'G1'),
])
def test_work_package_codes(briefs, title, branch, code):
    got, brief = scope_guard.package_code(title, branch, briefs)
    assert got == code
    assert brief and os.path.basename(brief).startswith(code + '_')


@pytest.mark.parametrize('title, branch', [
    ('fix(deps): bump vite', 'dependabot/npm_and_yarn/vite-7'),  # lower-case conventional commit
    ('PLAN2B: More briefs', 'plan2b-more'),                     # code-shaped but no brief
    ('JOBDATES: no such brief', 'jobdates-x'),                   # JOBDATE brief must not match JOBDATES
    ('WIP: tidy up', 'wip-tidy'),                                 # upper-case prefix, no brief
    ('Fix: something', 'fix-something'),                          # mixed case prefix
    ('fix some stuff', 'fix-branch'),
])
def test_not_a_work_package(briefs, title, branch):
    _, brief = scope_guard.package_code(title, branch, briefs)
    assert brief is None


def test_jobdate_title_runs_the_check_end_to_end():
    """A code without digits is checked: an out-of-scope edit under JOBDATE fails instead of passing silently."""
    with tempfile.TemporaryDirectory() as tmp:
        run = lambda *a: subprocess.run(list(a), cwd=tmp, check=True, capture_output=True, text=True)
        run('git', 'init', '-b', 'main'); run('git', 'config', 'user.name', 't'); run('git', 'config', 'user.email', 't@t')
        os.makedirs(os.path.join(tmp, 'plan/agents')); os.makedirs(os.path.join(tmp, 'src'))
        open(os.path.join(tmp, 'plan/agents/JOBDATE_jobs.md'), 'w').write('JOBDATE\n\n## Owned paths\n- src/jobs.py\n')
        for name in ('jobs.py', 'other.py'):
            open(os.path.join(tmp, 'src', name), 'w').write('old\n')
        run('git', 'add', '.'); run('git', 'commit', '-m', 'base'); base = run('git', 'rev-parse', 'HEAD').stdout.strip()
        open(os.path.join(tmp, 'src/jobs.py'), 'w').write('new\n')
        run('git', 'commit', '-am', 'in scope'); ok = run('git', 'rev-parse', 'HEAD').stdout.strip()
        open(os.path.join(tmp, 'src/other.py'), 'w').write('new\n')
        run('git', 'commit', '-am', 'out of scope'); bad = run('git', 'rev-parse', 'HEAD').stdout.strip()
        guard = lambda head: subprocess.run(['python3', SCRIPT, '--base', base, '--head', head,
                                             '--title', 'JOBDATE: jobs date span', '--branch', 'jobdate-x'],
                                            cwd=tmp, capture_output=True, text=True)
        r = guard(ok)
        assert r.returncode == 0 and 'Scope guard passed.' in r.stdout, r.stdout
        r = guard(bad)
        assert r.returncode == 1 and 'src/other.py' in r.stdout, r.stdout
