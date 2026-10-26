import argparse
import re
import os
import sys
import subprocess

def run_cmd(cmd):
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(f"Error running {' '.join(cmd)}:\n{result.stderr}")
        sys.exit(result.returncode)
    return result.stdout.strip()

def match_glob(path, glob_pattern):
    parts = glob_pattern.split('/')
    regex_parts = []
    for part in parts:
        if part == '**':
            regex_parts.append('.*')
        else:
            p = part.replace('.', '\\.')
            p = p.replace('*', '[^/]*')
            p = p.replace('?', '[^/]')
            regex_parts.append(p)

    regex = '^' + '/'.join(regex_parts) + '$'
    return re.match(regex, path) is not None

PENDING = 'frontend/design-system-pending.txt'


def pending_edit_ok(base, head, changed_paths):
    """A package may edit the design-system pending list only to comment out (or remove) the lines of files it
    also changes in this PR. Adding a path, or touching another file's line, is still out of scope."""
    try:
        merge_base = run_cmd(['git', 'merge-base', base, head])
    except SystemExit:
        merge_base = base
    def read(rev):
        try:
            return subprocess.check_output(['git', 'show', f'{rev}:{PENDING}'], text=True, stderr=subprocess.PIPE).splitlines()
        except subprocess.CalledProcessError:
            return []
    old = [l.strip() for l in read(merge_base)]
    new = [l.strip() for l in read(head)]
    active = lambda ls: {l for l in ls if l and not l.startswith('#')}
    removed = active(old) - active(new)
    if active(new) - active(old):
        return False  # a path was added
    if not removed <= changed_paths:
        return False  # a line for a file this PR does not change was taken out
    comments_old = [l for l in old if l.startswith('#')]
    new_comments = [l for l in new if l.startswith('#') and l not in comments_old]
    # new comment lines must each name a path this PR took out of the list
    return all(any(path in c for path in removed) for c in new_comments)


TEST_FILE = re.compile(r'\.(test|spec)\.[cm]?[jt]sx?$')
TESTS_ALLOWED = 'Test files may be updated'


def sibling_test_ok(path, status, changed_owned):
    """An existing test file may be modified (not added or deleted) when the brief allows test updates
    and the PR also changes an owned file in the same folder, e.g. a copy fix that the test asserts."""
    if not status.startswith('M') or not TEST_FILE.search(path):
        return False
    folder = os.path.dirname(path)
    return any(os.path.dirname(p) == folder for p in changed_owned)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', required=True)
    parser.add_argument('--head', required=True)
    parser.add_argument('--title', required=True)
    parser.add_argument('--branch', required=True)
    args = parser.parse_args()

    code = None
    m = re.search(r'\b([A-Z]{1,4}\d{1,2}[A-Z]?)\b', args.title)
    if m:
        code = m.group(1).upper()
    else:
        m = re.match(r'^([A-Za-z]{1,4}\d{1,2}[A-Za-z]?)', args.branch)
        if m:
            code = m.group(1).upper()

    if not code:
        print("not a work package")
        sys.exit(0)

    brief_file = None
    if os.path.exists('plan/agents'):
        for f in os.listdir('plan/agents'):
            if f.upper().startswith(code + '_') and f.endswith('.md'):
                brief_file = os.path.join('plan/agents', f)
                break

    if not brief_file:
        print("not a work package")
        sys.exit(0)

    owned_paths = []
    with open(brief_file, 'r', encoding='utf-8') as f:
        content = f.read()

    m = re.search(r'## Owned paths\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
    if m:
        lines = m.group(1).strip().split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('- ') or line.startswith('* '):
                path = line[2:].strip()
                path = path.replace('`', '')
                idx = path.find(' [')
                if idx != -1:
                    path = path[:idx].strip()
                else:
                    idx = path.find(' ')
                    if idx != -1:
                        path = path[:idx].strip()
                owned_paths.append(path)

    owned_paths.append('STATUS.md')
    owned_paths.append(f'docs/integration/{code}/**')

    diff_output = run_cmd(['git', 'diff', '--name-status', f'{args.base}...{args.head}'])
    if not diff_output:
        sys.exit(0)

    lines = diff_output.split('\n')
    changed_paths = {l.split('\t')[-1] for l in lines if l.strip()}

    errors = []
    deleted_errors = []
    tests_allowed = TESTS_ALLOWED in content
    changed_owned = {p for p in changed_paths if any(match_glob(p, g) for g in owned_paths)}

    for line in lines:
        if not line.strip(): continue
        parts = line.split('\t')
        if len(parts) == 2:
            status, path = parts
        elif len(parts) == 3:
            status, old_path, path = parts

        matched = False
        for glob_pat in owned_paths:
            if match_glob(path, glob_pat):
                matched = True
                break

        if not matched and path == PENDING and pending_edit_ok(args.base, args.head, changed_paths):
            matched = True

        if not matched and tests_allowed and sibling_test_ok(path, status, changed_owned):
            matched = True

        if not matched:
            if status.startswith('D'):
                deleted_errors.append(path)
            else:
                errors.append(f"{status} {path}")

        if path == 'STATUS.md':
            try:
                merge_base = run_cmd(['git', 'merge-base', args.base, args.head])
            except SystemExit:
                merge_base = args.base

            try:
                base_status = subprocess.check_output(['git', 'show', f'{merge_base}:STATUS.md'], text=True, stderr=subprocess.PIPE)
            except subprocess.CalledProcessError:
                base_status = ""

            try:
                head_status = subprocess.check_output(['git', 'show', f'{args.head}:STATUS.md'], text=True, stderr=subprocess.PIPE)
            except subprocess.CalledProcessError:
                head_status = ""

            slot_begin = f'<!-- SLOT:{code} BEGIN -->'
            slot_end = f'<!-- SLOT:{code} END -->'

            def split_status(s):
                idx1 = s.find(slot_begin)
                idx2 = s.find(slot_end)
                if idx1 == -1 or idx2 == -1:
                    return None
                return s[:idx1], s[idx1:idx2+len(slot_end)], s[idx2+len(slot_end):]

            base_parts = split_status(base_status)
            head_parts = split_status(head_status)

            if base_parts and head_parts:
                if base_parts[0] != head_parts[0] or base_parts[2] != head_parts[2]:
                    errors.append("M STATUS.md (changes outside slot)")
            elif not base_parts and head_parts:
                pass

    summary = []

    if deleted_errors:
        print("LOUD FAILURE: The following files were deleted but are not owned:")
        summary.append("### 🚨 LOUD FAILURE: Deleted out-of-scope files")
        summary.append("| Path |")
        summary.append("|------|")
        for f in deleted_errors:
            print(f"  - {f}")
            summary.append(f"| `{f}` |")

    if errors:
        print("FAILURE: Out of scope edits detected:")
        if not deleted_errors:
            summary.append("### ❌ Out-of-scope edits detected")
            summary.append("| Status | Path |")
            summary.append("|--------|------|")
        for f in errors:
            print(f"  - {f}")
            if not deleted_errors:
                summary.append(f"| {f.split(' ')[0]} | `{f.split(' ', 1)[1]}` |")

    if summary and 'GITHUB_STEP_SUMMARY' in os.environ:
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as f:
            f.write('\n'.join(summary) + '\n')

    if deleted_errors or errors:
        sys.exit(1)

    print("Scope guard passed.")

if __name__ == '__main__':
    main()
