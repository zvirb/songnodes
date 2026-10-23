#!/usr/bin/env python3
"""Read-only metadata coverage snapshots for the minimal Compose catalog.

Only stable IDs and field-presence flags are persisted, never credentials or
provider payloads. A non-null value is availability, not correctness/calibration.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'services'))
from common.track_metadata import stored_metadata

FIELDS = ('bpm', 'key', 'camelot_key', 'energy', 'energy_canonical', 'isrc', 'tidal_id', 'deezer_id',
          'genre', 'record_label', 'mix_name', 'duration_ms', 'danceability', 'valence')
VERSION = 1
SQL = """
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
 'tracks', COALESCE((SELECT json_agg(t) FROM silver_enriched_tracks t), '[]'::json),
 'inventory', json_build_object(
   'bronze_tracks', (SELECT count(*) FROM bronze_scraped_tracks),
   'silver_tracks', (SELECT count(*) FROM silver_enriched_tracks),
   'silver_artists', (SELECT count(*) FROM silver_enriched_artists),
   'silver_playlists', (SELECT count(*) FROM silver_enriched_playlists),
   'ordered_set_entries', (SELECT count(*) FROM silver_playlist_tracks),
   'transitions', (SELECT count(*) FROM silver_track_transitions),
   'bronze_track_sources', COALESCE((SELECT json_object_agg(source, n) FROM
     (SELECT source, count(*) AS n FROM bronze_scraped_tracks GROUP BY source) s), '{}'::json),
   'track_columns', (SELECT json_agg(column_name ORDER BY ordinal_position)
      FROM information_schema.columns WHERE table_schema='public' AND table_name='silver_enriched_tracks')
 ));
COMMIT;
"""


def read_catalog():
    result = subprocess.run([
        'docker', 'compose', '-f', 'compose.dev.yaml', 'exec', '-T', 'postgres',
        'psql', '-X', '-qAt', '-U', 'songnodes', '-d', 'songnodes',
        '-v', 'ON_ERROR_STOP=1',
    ], cwd=ROOT, input=SQL, text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def populated(value):
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return any(populated(item) for item in value)
    return value is not None


def track_presence(row):
    metadata = stored_metadata(row)
    metadata['genre'] = row.get('genre')
    return {field: {'non_null': metadata.get(field) is not None,
                    'populated': populated(metadata.get(field))} for field in FIELDS}


def write_new(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Evidence files are immutable: accidental reruns must not erase a baseline.
    with path.open('x') as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write('\n')


def read_json(path):
    with path.open() as handle:
        return json.load(handle)


def manifest_for(ids, dataset, seed, size):
    ranked = sorted(ids, key=lambda value: (hashlib.sha256(f'{seed}:{value}'.encode()).hexdigest(), value))
    return {'version': VERSION, 'dataset': dataset, 'seed': seed, 'requested_size': size,
            'ids': ranked[:size], 'selection': 'sha256(seed:id), ascending'}


def validate_manifest(manifest, dataset, seed, size):
    if (manifest.get('version'), manifest.get('dataset'), manifest.get('seed'), manifest.get('requested_size')) != (VERSION, dataset, seed, size):
        raise ValueError('Sample version/dataset/seed/size differs; use a separate manifest for a new baseline')
    ids = manifest.get('ids')
    if not isinstance(ids, list) or any(not isinstance(i, str) for i in ids) or len(ids) != len(set(ids)) or len(ids) > size:
        raise ValueError('Invalid sample IDs')


def summarize(tracks, ids):
    ids = list(ids)
    present = [tracks[i] for i in ids if i in tracks]
    denominator = len(ids)
    fields = {}
    for field in FIELDS:
        counts = {kind: sum(row[field][kind] for row in present) for kind in ('non_null', 'populated')}
        fields[field] = {**counts, **{kind + '_percent': round(count / denominator * 100, 2) if denominator else None
                                    for kind, count in counts.items()}}
    return {'cohort_size': denominator, 'records_present': len(present),
            'records_missing': denominator - len(present), 'fields': fields}


def snapshot(args):
    catalog = read_catalog()
    tracks = {str(row['id']): track_presence(row) for row in catalog['tracks']}
    if args.sample.exists():
        manifest = read_json(args.sample)
        validate_manifest(manifest, args.dataset, args.seed, args.sample_size)
    else:
        manifest = manifest_for(tracks, args.dataset, args.seed, args.sample_size)
        write_new(args.sample, manifest)
    result = {'version': VERSION, 'dataset': args.dataset,
              'captured_at': datetime.now(timezone.utc).isoformat(),
              'semantics': 'stored availability, not validity, independent consensus or calibrated energy',
              'inventory': catalog['inventory'], 'sample_manifest': manifest, 'tracks': tracks,
              'all': summarize(tracks, tracks), 'sample': summarize(tracks, manifest['ids']),
              'independent_method_agreement': {'status': 'not_assessed',
                 'reason': 'Independent-method evidence and scoring contract have not been validated; single values cannot prove agreement.'}}
    write_new(args.output, result)
    print(json.dumps({'snapshot': str(args.output), 'dataset': args.dataset,
                      'tracks': len(tracks), 'fixed_sample_size': len(manifest['ids']),
                      'requested_sample_size': args.sample_size,
                      'warning': 'Empty catalog; no real-data coverage baseline established' if not tracks else
                          'Availability only; dataset origin and measurement accuracy require verification'}, indent=2))


def compare(before, after):
    if before.get('version') != VERSION or after.get('version') != VERSION:
        raise ValueError('Unsupported snapshot version')
    if before['dataset'] != after['dataset'] or before['sample_manifest'] != after['sample_manifest']:
        raise ValueError('Comparisons require the same dataset and fixed sample manifest')
    bt, at = before['tracks'], after['tracks']
    cohorts = {}
    for label, ids in [('baseline_all', list(bt)), ('fixed_sample', before['sample_manifest']['ids'])]:
        old, new = summarize(bt, ids), summarize(at, ids)
        transitions = {}
        for field in FIELDS:
            # Gains/losses only among surviving records; deletion is reported separately.
            surviving = set(ids) & set(bt) & set(at)
            transitions[field] = {
                'populated_gains': sum(not bt[i][field]['populated'] and at[i][field]['populated'] for i in surviving),
                'populated_losses': sum(bt[i][field]['populated'] and not at[i][field]['populated'] for i in surviving),
            }
        cohorts[label] = {'before': old, 'after': new, 'changes': transitions}
    return {'version': VERSION, 'dataset': before['dataset'], 'cohorts': cohorts,
            'current_all': {'before': summarize(bt, bt), 'after': summarize(at, at)},
            'added_records': len(set(at) - set(bt)), 'removed_records': len(set(bt) - set(at)),
            'interpretation': 'Availability changes do not establish provider enrichment, correctness, or calibration. Attribute causes using run evidence.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    capture = commands.add_parser('snapshot')
    capture.add_argument('--dataset', required=True, help='Explicit stable dataset label; use separate labels for synthetic runs')
    capture.add_argument('--sample', required=True, type=Path)
    capture.add_argument('--output', required=True, type=Path)
    capture.add_argument('--seed', default='songnodes-metadata-v1')
    capture.add_argument('--sample-size', default=50, type=int, choices=range(1, 51))
    diff = commands.add_parser('compare')
    diff.add_argument('before', type=Path)
    diff.add_argument('after', type=Path)
    diff.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        if args.command == 'snapshot':
            if args.output.exists():
                raise ValueError('Output already exists; choose a new evidence file')
            snapshot(args)
        else:
            write_new(args.output, compare(read_json(args.before), read_json(args.after)))
            print(f'Comparison saved to {args.output}')
            result = read_json(args.output)
            print('Field | Baseline cohort before → after | Fixed sample before → after')
            for field in FIELDS:
                cells = []
                for cohort in ('baseline_all', 'fixed_sample'):
                    cells.append(' → '.join(
                        f"{result['cohorts'][cohort][phase]['fields'][field]['non_null']}/{result['cohorts'][cohort][phase]['cohort_size']}"
                        for phase in ('before', 'after')))
                print(f"{field} | {' | '.join(cells)}")
            print('Counts are exposed non-null values. 0/0 means no baseline; see JSON for percentages, populated counts and attrition.')
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as exc:
        # Do not echo subprocess arguments/environment or database output.
        parser.exit(1, f'Coverage command failed ({type(exc).__name__}); check paths, manifest compatibility and development database health.\n')


if __name__ == '__main__':
    main()
