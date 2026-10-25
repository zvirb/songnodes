import yaml
import sys
import os
import subprocess

def main():
    ownership_file = 'contracts/ownership.yaml'
    if not os.path.exists(ownership_file):
        print(f"Ownership YAML {ownership_file} not found.", file=sys.stderr)
        sys.exit(1)

    with open(ownership_file, 'r') as f:
        ownership = yaml.safe_load(f)

    # Determine current branch
    branch_name = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode('utf-8').strip()

    # Simple mapping of branch name to WP (e.g., wp0-contracts -> wp0)
    wp_id = None
    if branch_name.startswith('wp'):
        parts = branch_name.split('-')
        wp_id = parts[0]

    if not wp_id or wp_id not in ownership:
        print(f"Branch {branch_name} does not map to a recognized WP in ownership.yaml.")
        # If not on a wp branch, maybe bypass in real CI, but fail here to be strict if desired.
        sys.exit(0) # For now, allow it to pass if not a wp branch to avoid breaking local dev on main.

    allowed_dirs = ownership[wp_id].get('directories', [])

    # Get changed files against main
    try:
        changed_files = subprocess.check_output(['git', 'diff', '--name-only', 'main']).decode('utf-8').splitlines()
    except subprocess.CalledProcessError:
        print("Failed to get git diff against main.")
        sys.exit(1)

    violations = []
    for file in changed_files:
        # Check if file is within allowed directories
        allowed = False
        for d in allowed_dirs:
            if file.startswith(d):
                allowed = True
                break

        if file in ['STATUS.md', 'contracts/ownership.yaml']:
            allowed = True # Allow shared updates

        if not allowed:
            violations.append(file)

    if violations:
        print(f"Error: WP{wp_id} branch changed files outside its ownership boundaries:", file=sys.stderr)
        for v in violations:
            print(f"  - {v}", file=sys.stderr)
        sys.exit(1)

    print("Ownership check passed.")
    sys.exit(0)

if __name__ == '__main__':
    main()
