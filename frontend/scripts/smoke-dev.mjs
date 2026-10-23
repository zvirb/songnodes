// Exercises the real development database, API, Vite proxy, and browser.
// Temporary synthetic records are removed even when an assertion fails.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const ids = [randomUUID(), randomUUID()];
const targetTitle = `Smoke Target ${randomUUID()}`;
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
      ('${ids[1]}', 'Smoke Test Artist', 'Smoke Track Two', 'valid', '{}', NULL);
    UPDATE silver_enriched_tracks SET duration_ms=210500, energy=0,
      enrichment_metadata='{"camelot_key":"8A","record_label":"Fixture Records","tidal_id":123,"energy_scale":"legacy_0_1"}'
      WHERE id='${ids[0]}';
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

  const details = await page.evaluate(async id => {
    const { api } = await import('/src/services/api.ts');
    return await api.tracks.getTrackDetails(`song_${id}`);
  }, ids[0]);
  assert.equal(details.status, 'success');
  assert.equal(details.data.id, ids[0]);
  assert.equal(details.data.name, 'Smoke Track One');
  assert.equal(details.data.artist, 'Smoke Test Artist');
  assert.equal(details.data.bpm, 128);
  console.log('PASS: Browser track-detail client reads the silver catalog through Vite');

  const checkTransport = async (reload = false) => page.evaluate(async ({ ids, reload }) => {
    // Vite can timestamp imports after edits; use the exact module loaded by React.
    const storeUrl = performance.getEntriesByType('resource').map(entry => entry.name)
      .find(url => url.includes('/src/store/useStore.ts'));
    if (!storeUrl) throw new Error('React store module was not loaded');
    const { default: useStore } = await import(storeUrl);
    const { api } = await import('/src/services/api.ts');
    const { transformNodeToTrack: desktop } = await import('/src/utils/djInterfaceUtils.ts');
    const { transformNodesToTracks: mobile } = await import('/src/utils/mobileExplorerUtils.ts');
    if (reload) {
      const response = await api.graph.getGraphData();
      useStore.getState().graph.setGraphData(response.data);
    }
    const nodes = useStore.getState().graphData.nodes;
    return ids.map(id => {
      const node = nodes.find(node => node.id === `song_${id}`);
      if (!node) throw new Error(`Missing browser graph node ${id}; reload=${reload}; available=${nodes.map(n => n.id).join(",")}`);
      return { loaded: node.track, desktop: desktop(node), mobile: mobile([node])[0] };
    });
  }, { ids, reload });
  for (const reload of [false, true]) {
    const [known, unknown] = await checkTransport(reload);
    for (const path of ['loaded', 'desktop', 'mobile']) {
      assert.equal(known[path].duration, 210.5);
      assert.equal(known[path].energy, 0);
      assert.equal(known[path].camelot_key, '8A');
      assert.equal(known[path].record_label, 'Fixture Records');
      assert.equal(known[path].tidal_id, '123');
      for (const field of ['bpm', 'energy', 'key', 'duration']) assert.equal(unknown[path][field], undefined);
    }
  }
  console.log('PASS: Initial and API reload mappings preserve stored metadata and unknowns in desktop/mobile adapters');

  const created = await page.evaluate(async title => {
    const { api } = await import('/src/services/api.ts');
    return (await api.post('/target-tracks', {
      title, artist: 'Smoke Test Artist', priority: 'high', genres: ['House'], is_active: true,
    })).data;
  }, targetTitle);
  assert(created.track_id, 'Target client must expose the created record in data');
  const welcome = page.getByRole('button', { name: 'Start exploring', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  await page.getByRole('button', { name: 'Switch to PLAN mode' }).click();
  await page.getByRole('button', { name: '🎯 Targets', exact: true }).click();
  await page.getByText(targetTitle, { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  console.log('PASS: Targets management UI displays the database-backed target');
  const listed = await page.evaluate(async () => {
    const { api } = await import('/src/services/api.ts');
    return (await api.get('/target-tracks')).data;
  });
  assert(listed.some(target => target.track_id === created.track_id));
  const updated = await page.evaluate(async id => {
    const { api } = await import('/src/services/api.ts');
    return (await api.put(`/target-tracks/${id}`, { completion_percentage: 75, archived: true })).data;
  }, created.track_id);
  assert.equal(updated.completion_percentage, 75);
  const deleted = await page.evaluate(async id => {
    const { api } = await import('/src/services/api.ts');
    return await api.delete(`/target-tracks/${id}`);
  }, created.track_id);
  assert.equal(deleted.data, null);
  assert.deepEqual(errors, [], 'Unexpected browser exceptions during target management');
  console.log('PASS: Browser API client creates, lists, updates, and deletes targets through Vite');
} finally {
  try {
    await browser?.close();
  } finally {
    sql(`DELETE FROM silver_enriched_tracks WHERE id IN ('${ids[0]}', '${ids[1]}');`);
    sql(`DELETE FROM target_tracks WHERE title = '${targetTitle}' AND artist = 'Smoke Test Artist';`);
  }
}
