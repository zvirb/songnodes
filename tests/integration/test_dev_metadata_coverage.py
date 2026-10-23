"""Coverage evidence invariants plus one real read-only Compose snapshot workflow."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from uuid import uuid4

from test_dev_workflows import ROOT, sql

spec = importlib.util.spec_from_file_location('metadata_coverage', ROOT / 'scripts/metadata_coverage.py')
coverage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coverage)


class CoverageContracts(unittest.TestCase):
    def test_seeded_selection_ignores_input_order_and_rejects_changed_identity(self):
        ids = [str(uuid4()) for _ in range(80)]
        manifest = coverage.manifest_for(ids, 'synthetic', 'seed', 50)
        self.assertEqual(len(manifest['ids']), 50)
        self.assertEqual(manifest, coverage.manifest_for(reversed(ids), 'synthetic', 'seed', 50))
        for dataset, seed, size in [('other', 'seed', 50), ('synthetic', 'other', 50), ('synthetic', 'seed', 20)]:
            with self.assertRaises(ValueError):
                coverage.validate_manifest(manifest, dataset, seed, size)

    def test_zero_unknown_blank_and_jsonb_authority(self):
        fields = coverage.track_presence({'bpm': None, 'energy': 0, 'key': ' ', 'genre': [],
            'enrichment_metadata': {'bpm': 128, 'tidal_id': 123, 'label': 'Example'}})
        self.assertFalse(fields['bpm']['non_null'])
        self.assertTrue(fields['energy']['populated'])
        self.assertTrue(fields['key']['non_null'])
        self.assertFalse(fields['key']['populated'])
        self.assertFalse(fields['genre']['populated'])
        self.assertTrue(fields['tidal_id']['populated'])
        self.assertTrue(fields['record_label']['populated'])

    def test_empty_denominator_is_unknown_percentage(self):
        report = coverage.summarize({}, [])
        self.assertEqual(report['cohort_size'], 0)
        self.assertIsNone(report['fields']['bpm']['non_null_percent'])

    def test_fixed_cohort_distinguishes_enrichment_from_additions_and_deletions(self):
        missing = coverage.track_presence({'bpm': None})
        known = coverage.track_presence({'bpm': 128})
        manifest = coverage.manifest_for(['kept', 'deleted'], 'synthetic', 'seed', 50)
        before = {'version': 1, 'dataset': 'synthetic', 'sample_manifest': manifest,
                  'tracks': {'kept': missing, 'deleted': known}}
        after = {**before, 'tracks': {'kept': known, 'new': known}}
        result = coverage.compare(before, after)
        cohort = result['cohorts']['fixed_sample']
        self.assertEqual(result['added_records'], 1)
        self.assertEqual(result['removed_records'], 1)
        self.assertEqual(cohort['after']['records_missing'], 1)
        self.assertEqual(cohort['after']['fields']['bpm']['populated_percent'], 50)
        self.assertEqual(cohort['changes']['bpm'], {'populated_gains': 1, 'populated_losses': 0})
        self.assertEqual(result['current_all']['after']['fields']['bpm']['populated_percent'], 100)
        with self.assertRaises(ValueError):
            coverage.compare(before, {**after, 'dataset': 'other'})

    def test_evidence_files_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'evidence.json'
            coverage.write_new(path, {'original': True})
            with self.assertRaises(FileExistsError):
                coverage.write_new(path, {})
            self.assertEqual(coverage.read_json(path), {'original': True})

    def test_real_snapshot_cli_preserves_sample_across_update_and_insert(self):
        if len(coverage.read_catalog()['tracks']) > 48:
            self.skipTest('CLI fixture test requires at most 48 existing tracks to guarantee fixture inclusion in the fixed sample')
        a, b = str(uuid4()), str(uuid4())
        try:
            sql(f"INSERT INTO silver_enriched_tracks (id, artist_name, track_title, validation_status, enrichment_metadata) VALUES ('{a}', 'Coverage Synthetic', 'Temporary', 'valid', '{{}}')")
            with tempfile.TemporaryDirectory() as folder:
                folder = Path(folder)
                sample, before, after, report = [folder / name for name in ['sample.json', 'before.json', 'after.json', 'compare.json']]
                cmd = [sys.executable, str(ROOT / 'scripts/metadata_coverage.py')]
                flags = ['snapshot', '--dataset', 'synthetic-test', '--sample', str(sample)]
                subprocess.run(cmd + flags + ['--output', str(before)], cwd=ROOT, check=True, capture_output=True)
                initial_sample = coverage.read_json(sample)
                self.assertIn(a, initial_sample['ids'])
                sql(f"UPDATE silver_enriched_tracks SET bpm=128, energy=0 WHERE id='{a}'")
                sql(f"INSERT INTO silver_enriched_tracks (id, artist_name, track_title, bpm, validation_status, enrichment_metadata) VALUES ('{b}', 'Coverage Synthetic', 'New', 130, 'valid', '{{}}')")
                subprocess.run(cmd + flags + ['--output', str(after)], cwd=ROOT, check=True, capture_output=True)
                self.assertEqual(initial_sample, coverage.read_json(sample))
                self.assertNotIn(b, initial_sample['ids'])
                subprocess.run(cmd + ['compare', str(before), str(after), '--output', str(report)], cwd=ROOT, check=True, capture_output=True)
                data = coverage.read_json(report)
                self.assertEqual(data['added_records'], 1)
                self.assertEqual(data['cohorts']['fixed_sample']['changes']['bpm']['populated_gains'], 1)
                self.assertEqual(coverage.read_json(after)['independent_method_agreement']['status'], 'not_assessed')
                rerun = subprocess.run(cmd + flags + ['--output', str(before)], cwd=ROOT, capture_output=True)
                self.assertNotEqual(rerun.returncode, 0)
        finally:
            sql(f"DELETE FROM silver_enriched_tracks WHERE id IN ('{a}', '{b}')")
