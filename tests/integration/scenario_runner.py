"""Run a scenario script inside the rest-api container, where Postgres and the shared packages are reachable.

Scenarios live in tests/integration/scenarios/ and finish by printing SCENARIO-OK. They use their own
marker for every row they create and remove those rows in a finally block.
"""
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCENARIOS = Path(__file__).parent / 'scenarios'

PRELUDE = '''
import asyncio, json, os, sys, uuid
sys.path[:0] = ['/app']
import asyncpg
DSN = os.environ['DATABASE_URL']
MARKER = sys.argv[1]
async def connect():
    return await asyncpg.connect(DSN)
'''


def run(name: str, marker: str, timeout: int = 180) -> str:
    source = PRELUDE + (SCENARIOS / f'{name}.py').read_text(encoding='utf-8')
    result = subprocess.run(['docker', 'compose', '-f', 'compose.dev.yaml', 'exec', '-T', 'rest-api', 'python', '-', marker],
                            cwd=ROOT, input=source.encode(), capture_output=True, timeout=timeout)
    output = result.stdout.decode(errors='replace')
    if 'SCENARIO-SKIP' in output:
        raise unittest.SkipTest(output.strip()[-300:])
    if result.returncode != 0 or 'SCENARIO-OK' not in output:
        raise AssertionError(f'scenario {name} failed (exit {result.returncode})\n--- stdout\n{output[-3000:]}\n'
                             f'--- stderr\n{result.stderr.decode(errors="replace")[-3500:]}')
    return output
