import os
import sys
import glob
import subprocess
import yaml

def main():
    migrations_dir = 'sql/migrations/'
    ownership_file = 'contracts/ownership.yaml'

    with open(ownership_file, 'r') as f:
        ownership = yaml.safe_load(f)

    # Determine current branch WP
    branch_name = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode('utf-8').strip()
    wp_id = None
    if branch_name.startswith('wp'):
        parts = branch_name.split('-')
        wp_id = parts[0]

    migration_files = glob.glob(os.path.join(migrations_dir, '*.sql'))
    migration_files = [f for f in migration_files if os.path.dirname(f) == migrations_dir.rstrip('/')]

    number_to_files = {}
    for f in migration_files:
        basename = os.path.basename(f)
        parts = basename.split('_')
        if len(parts) > 0 and parts[0].isdigit():
            num = int(parts[0])
            if num >= 100:
                if num not in number_to_files:
                    number_to_files[num] = []
                number_to_files[num].append(basename)

    for num, files in number_to_files.items():
        if len(files) > 2:
            print(f"Error: Migration number {num} is used by more than 2 files: {files}", file=sys.stderr)
            sys.exit(1)
        up_files = [f for f in files if f.endswith('_up.sql')]
        down_files = [f for f in files if f.endswith('_down.sql')]
        if len(up_files) > 1 or len(down_files) > 1:
            print(f"Error: Migration number {num} has duplicate up/down scripts: {files}", file=sys.stderr)
            sys.exit(1)

    # Check if newly added migrations are in the WP's range
    if wp_id and wp_id in ownership:
        range_str = ownership[wp_id].get('migrations')
        if range_str:
            min_num, max_num = map(int, range_str.split('-'))

            # Get new migrations added in this branch
            changed_files = subprocess.check_output(['git', 'diff', '--name-only', 'main']).decode('utf-8').splitlines()
            new_migrations = [f for f in changed_files if f.startswith(migrations_dir)]

            for f in new_migrations:
                basename = os.path.basename(f)
                parts = basename.split('_')
                if len(parts) > 0 and parts[0].isdigit():
                    num = int(parts[0])
                    if not (min_num <= num <= max_num):
                        print(f"Error: Migration {basename} (number {num}) is outside WP{wp_id} allowed range {range_str}.", file=sys.stderr)
                        sys.exit(1)

    print("Migrations check passed.")
    sys.exit(0)

if __name__ == '__main__':
    main()
