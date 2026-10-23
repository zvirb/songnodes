"""Data-layer domain tests that need real Postgres (outbox, projection, identity, evidence).

Run: python -m unittest discover -s tests/integration -p test_dev_datalayer.py -v
Each scenario runs inside the rest-api container with its own marker and cleans up after itself.
"""
import unittest
from uuid import uuid4

from scenario_runner import run


class DataLayer(unittest.TestCase):
    def scenario(self, name):
        self.assertIn('SCENARIO-OK', run(name, uuid4().hex[:12]))

    def test_outbox_ordering_visibility_retries_and_dead_letters(self):
        self.scenario('outbox')

    def test_projection_events_energy_bands_rebuild_and_reconcile(self):
        self.scenario('projection')

    def test_track_merge_preserves_sets_edges_evidence_and_is_reversible(self):
        self.scenario('identity')

    def test_evidence_consensus_resolution_energy_and_camelot_repair(self):
        self.scenario('evidence')

    def test_bronze_ingestion_is_complete_idempotent_and_concurrency_safe(self):
        self.scenario('ingest')

    def test_enrichment_waterfall_backfill_and_job_runner(self):
        self.scenario('worker')


if __name__ == '__main__':
    unittest.main()
