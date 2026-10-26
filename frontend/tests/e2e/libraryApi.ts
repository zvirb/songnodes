import type { Page } from '@playwright/test';
import { readFileSync } from 'fs';

const fixturePath = new URL('./data/library.fixture.json', import.meta.url);
const fixtureData = JSON.parse(readFileSync(fixturePath, 'utf-8'));

export async function useLibraryFixture(page: Page) {
  let sets: any[] = [];
  let nextSetId = 1;

  await page.route('**/api/v1/library/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === 'GET' && path === '/api/v1/library/search') {
      const q = url.searchParams.get('q');
      const limitStr = url.searchParams.get('limit');
      const limit = limitStr ? parseInt(limitStr, 10) : 50;

      let results = fixtureData.tracks;
      if (q) {
        const query = q.toLowerCase();
        results = results.filter((t: any) =>
          t.a.toLowerCase().includes(query) ||
          t.t.toLowerCase().includes(query) ||
          (t.m && t.m.toLowerCase().includes(query))
        );
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(results.slice(0, limit)),
      });
    }

    if (method === 'GET' && path === '/api/v1/library/sets') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sets),
      });
    }

    const setMatch = path.match(/^\/api\/v1\/library\/sets\/(\d+)$/);
    if (setMatch) {
      const setId = parseInt(setMatch[1], 10);

      if (method === 'PUT') {
        const body = request.postDataJSON();
        const existingIdx = sets.findIndex(s => s.id === setId);
        if (existingIdx >= 0) {
          sets[existingIdx] = { ...sets[existingIdx], ...body, id: setId };
        } else {
          sets.push({ ...body, id: setId });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: setId }),
        });
      }

      if (method === 'DELETE') {
        sets = sets.filter(s => s.id !== setId);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    }

    // 404 for any other /api/v1/library/* paths
    return route.fulfill({ status: 404, body: 'Not Found' });
  });
}
