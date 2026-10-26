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
