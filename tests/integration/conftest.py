"""
Pytest configuration for integration tests.

The test_dev_* modules run against the development Compose stack (scripts/start-dev.sh:
REST 8082, graph 8084, worker) and need no fixtures from here.
"""
import sys
from pathlib import Path

# The test_dev_* modules import their siblings by bare name (hygiene, scenario_runner,
# test_dev_workflows), as they do under `unittest discover -s tests/integration`.
_INTEGRATION_DIR = str(Path(__file__).resolve().parent)
if _INTEGRATION_DIR not in sys.path:
    sys.path.insert(0, _INTEGRATION_DIR)
