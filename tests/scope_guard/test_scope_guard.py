import subprocess
import os
import tempfile
import pytest

def test_scope_guard():
    # We will just setup a temporary git repository, copy scope_guard.py there,
    # and run the commands to test various scenarios.

    with tempfile.TemporaryDirectory() as temp_dir:
        # copy script
        script_src = os.path.abspath('scripts/scope_guard.py')

        # init git repo
        subprocess.run(['git', 'init'], cwd=temp_dir, check=True)
        subprocess.run(['git', 'config', 'user.name', 'test'], cwd=temp_dir, check=True)
        subprocess.run(['git', 'config', 'user.email', 'test@test.com'], cwd=temp_dir, check=True)

        # create plan/agents/T1_test.md
        os.makedirs(os.path.join(temp_dir, 'plan/agents'))
        with open(os.path.join(temp_dir, 'plan/agents', 'T1_test.md'), 'w', encoding='utf-8') as f:
            f.write('''T1: Test

## Owned paths
- src/app/**
- README.md
''')

        # create STATUS.md
        with open(os.path.join(temp_dir, 'STATUS.md'), 'w', encoding='utf-8') as f:
            f.write('''
<!-- SLOT:T1 BEGIN -->
- Start: no
<!-- SLOT:T1 END -->
''')

        # create other files
        os.makedirs(os.path.join(temp_dir, 'src/app'))
        with open(os.path.join(temp_dir, 'src/app/main.py'), 'w') as f:
            f.write('print("main")')

        with open(os.path.join(temp_dir, 'src/other.py'), 'w') as f:
            f.write('print("other")')

        subprocess.run(['git', 'add', '.'], cwd=temp_dir, check=True)
        subprocess.run(['git', 'commit', '-m', 'Initial commit'], cwd=temp_dir, check=True)

        # get base sha
        base_sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=temp_dir, text=True).strip()

        # Scenario 1: in-scope edit
        with open(os.path.join(temp_dir, 'src/app/main.py'), 'a') as f:
            f.write('\nprint("updated")')
        with open(os.path.join(temp_dir, 'STATUS.md'), 'w', encoding='utf-8') as f:
            f.write('''
<!-- SLOT:T1 BEGIN -->
- Start: yes
<!-- SLOT:T1 END -->
''')

        subprocess.run(['git', 'add', '.'], cwd=temp_dir, check=True)
        subprocess.run(['git', 'commit', '-m', 'in-scope'], cwd=temp_dir, check=True)
        head_sha1 = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=temp_dir, text=True).strip()

        result1 = subprocess.run(
            ['python', script_src, '--base', base_sha, '--head', head_sha1, '--title', 'T1: valid edit', '--branch', 't1-branch'],
            cwd=temp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        assert result1.returncode == 0
        assert "Scope guard passed." in result1.stdout

        # Scenario 2: out-of-scope edit
        with open(os.path.join(temp_dir, 'src/other.py'), 'a') as f:
            f.write('\nprint("updated")')
        subprocess.run(['git', 'add', '.'], cwd=temp_dir, check=True)
        subprocess.run(['git', 'commit', '-m', 'out-of-scope edit'], cwd=temp_dir, check=True)
        head_sha2 = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=temp_dir, text=True).strip()

        result2 = subprocess.run(
            ['python', script_src, '--base', head_sha1, '--head', head_sha2, '--title', 'T1: invalid edit', '--branch', 't1-branch'],
            cwd=temp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        assert result2.returncode != 0
        assert "src/other.py" in result2.stdout

        # Scenario 3: out-of-scope delete
        subprocess.run(['git', 'reset', '--hard', head_sha1], cwd=temp_dir, check=True)
        os.remove(os.path.join(temp_dir, 'src/other.py'))
        subprocess.run(['git', 'add', '-u'], cwd=temp_dir, check=True)
        subprocess.run(['git', 'commit', '-m', 'out-of-scope delete'], cwd=temp_dir, check=True)
        head_sha3 = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=temp_dir, text=True).strip()

        result3 = subprocess.run(
            ['python', script_src, '--base', head_sha1, '--head', head_sha3, '--title', 'T1: invalid delete', '--branch', 't1-branch'],
            cwd=temp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        assert result3.returncode != 0
        assert "LOUD FAILURE" in result3.stdout
        assert "src/other.py" in result3.stdout

        # Scenario 4: STATUS edit outside slot
        subprocess.run(['git', 'reset', '--hard', head_sha1], cwd=temp_dir, check=True)
        with open(os.path.join(temp_dir, 'STATUS.md'), 'w', encoding='utf-8') as f:
            f.write('''
Outside slot modified
<!-- SLOT:T1 BEGIN -->
- Start: yes
<!-- SLOT:T1 END -->
''')
        subprocess.run(['git', 'add', '.'], cwd=temp_dir, check=True)
        subprocess.run(['git', 'commit', '-m', 'status invalid'], cwd=temp_dir, check=True)
        head_sha4 = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=temp_dir, text=True).strip()

        result4 = subprocess.run(
            ['python', script_src, '--base', head_sha1, '--head', head_sha4, '--title', 'T1: status invalid', '--branch', 't1-branch'],
            cwd=temp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        assert result4.returncode != 0
        assert "M STATUS.md (changes outside slot)" in result4.stdout

        # Scenario 5: no code passes
        result5 = subprocess.run(
            ['python', script_src, '--base', head_sha1, '--head', head_sha4, '--title', 'fix some stuff', '--branch', 'fix-branch'],
            cwd=temp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        assert result5.returncode == 0
        assert "not a work package" in result5.stdout


def _pending_repo(tmp, pending_after, touched):
    """Repo where package T1 owns src/app/** only; returns the guard's exit code for a PR that changes
    `touched` files and rewrites the design-system pending list to `pending_after`."""
    script = os.path.abspath('scripts/scope_guard.py')
    run = lambda *a: subprocess.run(list(a), cwd=tmp, check=True, capture_output=True)
    run('git', 'init', '-b', 'main'); run('git', 'config', 'user.name', 't'); run('git', 'config', 'user.email', 't@t')
    os.makedirs(os.path.join(tmp, 'plan/agents')); os.makedirs(os.path.join(tmp, 'src/app')); os.makedirs(os.path.join(tmp, 'frontend'))
    open(os.path.join(tmp, 'plan/agents/T1_t.md'), 'w').write('T1: t\n\n## Owned paths\n- src/app/**\n')
    for name in ('a.tsx', 'b.tsx'):
        open(os.path.join(tmp, 'src/app', name), 'w').write('old\n')
    pending = os.path.join(tmp, 'frontend/design-system-pending.txt')
    open(pending, 'w').write('# header\nsrc/app/a.tsx\nsrc/app/b.tsx\n')
    run('git', 'add', '.'); run('git', 'commit', '-m', 'base'); base = run('git', 'rev-parse', 'HEAD').stdout.decode().strip()
    run('git', 'checkout', '-b', 't1-x')
    for name in touched:
        open(os.path.join(tmp, 'src/app', name), 'w').write('new\n')
    open(pending, 'w').write(pending_after)
    run('git', 'commit', '-am', 'change'); head = run('git', 'rev-parse', 'HEAD').stdout.decode().strip()
    r = subprocess.run(['python3', script, '--base', base, '--head', head, '--title', 'T1: t', '--branch', 't1-x'], cwd=tmp, capture_output=True, text=True)
    return r.returncode, r.stdout


def test_pending_comment_out_for_changed_file_passes():
    with tempfile.TemporaryDirectory() as tmp:
        code, out = _pending_repo(tmp, '# header\n# migrated T1: src/app/a.tsx\nsrc/app/b.tsx\n', ['a.tsx'])
        assert code == 0, out


def test_pending_comment_out_for_unchanged_file_fails():
    with tempfile.TemporaryDirectory() as tmp:
        code, out = _pending_repo(tmp, '# header\nsrc/app/a.tsx\n# migrated T1: src/app/b.tsx\n', ['a.tsx'])
        assert code == 1 and 'design-system-pending' in out


def test_pending_adding_a_path_fails():
    with tempfile.TemporaryDirectory() as tmp:
        code, out = _pending_repo(tmp, '# header\nsrc/app/a.tsx\nsrc/app/b.tsx\nsrc/app/c.tsx\n', ['a.tsx'])
        assert code == 1 and 'design-system-pending' in out


def _test_file_repo(tmp, brief_extra, change_page, test_action):
    """Repo where T1 owns src/feat/Page.tsx; the PR may change Page.tsx and does `test_action`
    ('modify' or 'add') to a test file in the same folder. Returns the guard's exit code and output."""
    script = os.path.abspath('scripts/scope_guard.py')
    run = lambda *a: subprocess.run(list(a), cwd=tmp, check=True, capture_output=True)
    run('git', 'init', '-b', 'main'); run('git', 'config', 'user.name', 't'); run('git', 'config', 'user.email', 't@t')
    os.makedirs(os.path.join(tmp, 'plan/agents')); os.makedirs(os.path.join(tmp, 'src/feat'))
    open(os.path.join(tmp, 'plan/agents/T1_t.md'), 'w').write('T1: t\n\n## Owned paths\n- src/feat/Page.tsx\n\n' + brief_extra + '\n')
    open(os.path.join(tmp, 'src/feat/Page.tsx'), 'w').write('old\n')
    open(os.path.join(tmp, 'src/feat/Page.test.tsx'), 'w').write('old\n')
    run('git', 'add', '.'); run('git', 'commit', '-m', 'base'); base = run('git', 'rev-parse', 'HEAD').stdout.decode().strip()
    run('git', 'checkout', '-b', 't1-x')
    if change_page:
        open(os.path.join(tmp, 'src/feat/Page.tsx'), 'w').write('new\n')
    name = 'Page.test.tsx' if test_action == 'modify' else 'Other.test.tsx'
    open(os.path.join(tmp, 'src/feat', name), 'w').write('new\n')
    run('git', 'add', '.'); run('git', 'commit', '-m', 'change'); head = run('git', 'rev-parse', 'HEAD').stdout.decode().strip()
    r = subprocess.run(['python3', script, '--base', base, '--head', head, '--title', 'T1: t', '--branch', 't1-x'], cwd=tmp, capture_output=True, text=True)
    return r.returncode, r.stdout


ALLOW = '(Files listed are the complete set. Test files may be updated only to keep them passing after your fixes.)'


def test_sibling_test_update_allowed_when_brief_permits():
    with tempfile.TemporaryDirectory() as tmp:
        code, out = _test_file_repo(tmp, ALLOW, True, 'modify')
        assert code == 0, out


def test_sibling_test_update_fails_without_brief_permission():
    with tempfile.TemporaryDirectory() as tmp:
        code, out = _test_file_repo(tmp, '', True, 'modify')
        assert code == 1 and 'Page.test.tsx' in out


def test_test_update_fails_when_owned_sibling_unchanged():
    with tempfile.TemporaryDirectory() as tmp:
        code, out = _test_file_repo(tmp, ALLOW, False, 'modify')
        assert code == 1 and 'Page.test.tsx' in out


def test_new_test_file_is_not_covered():
    with tempfile.TemporaryDirectory() as tmp:
        code, out = _test_file_repo(tmp, ALLOW, True, 'add')
        assert code == 1 and 'Other.test.tsx' in out
