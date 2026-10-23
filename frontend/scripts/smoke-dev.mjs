// Exercises the real development database, API, Vite proxy, and browser.
// Temporary synthetic records are removed even when an assertion fails.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const ids = [randomUUID(), randomUUID()];
const sql = input => execFileSync('docker', [
  'compose', '-f', 'compose.dev.yaml', 'exec', '-T', 'postgres',
  'psql', '-U', 'songnodes', '-d', 'songnodes', '-v', 'ON_ERROR_STOP=1',
], { cwd: repo, input, stdio: ['pipe', 'pipe', 'pipe'] });
let browser;
try {
  sql(`BEGIN;
    INSERT INTO silver_enriched_tracks
      (id, artist_name, track_title, validation_status, enrichment_metadata, bpm)
    VALUES
      ('${ids[0]}', 'Smoke Test Artist', 'Smoke Track One', 'valid', '{}', 128),
      ('${ids[1]}', 'Smoke Test Artist', 'Smoke Track Two', 'valid', '{}', 129);
    INSERT INTO silver_track_transitions (from_track_id, to_track_id, occurrence_count)
    VALUES ('${ids[0]}', '${ids[1]}', 3);
    COMMIT;`);

  const response = await fetch('http://127.0.0.1:3006/api/graph/data');
  assert.equal(response.status, 200);
  const graph = await response.json();
  for (const id of ids) assert(graph.nodes.some(node => node.id === `song_${id}`));
  assert(graph.edges.some(edge => edge.source === `song_${ids[0]}` &&
    edge.target === `song_${ids[1]}` && edge.weight === 3));
  console.log('PASS: PostgreSQL transition is returned through the Vite graph proxy');

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:3006/', { waitUntil: 'networkidle' });
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
  assert.equal(await page.getByText('Error Loading SongNodes', { exact: true }).count(), 0);
  assert.deepEqual(errors, [], 'Unexpected browser exceptions');
  console.log('PASS: React graph canvas renders without browser exceptions');
} finally {
  try {
    await browser?.close();
  } finally {
    sql(`DELETE FROM silver_enriched_tracks WHERE id IN ('${ids[0]}', '${ids[1]}');`);
  }
}
