import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { discoverRoutes, planRoutes, inspectPage } from './design-system-audit.mjs';

test('discovers feature, static, parameterised and callback routes', () => {
  const routes = discoverRoutes();
  for (const route of ['/library/buy', '/pipeline/runs', '/settings', '/tracks/:id', '/callback/:service', '*']) {
    assert.ok(routes.includes(route), route);
  }
});

test('parameterised routes require explicit concrete examples', () => {
  const plan = planRoutes(['/tracks/:id', '/library', '/callback/:service'], { '/tracks/:id': '/tracks/real-id' });
  assert.equal(plan[0].path, '/tracks/real-id');
  assert.equal(plan[1].path, '/library');
  assert.equal(plan[2].path, undefined);
  assert.equal(plan[2].shell, false);
  for (const path of ['//example.com', 'https://example.com', '/tracks/:id']) {
    assert.throws(() => planRoutes(['/tracks/:id'], { '/tracks/:id': path }));
  }
});

test('rendered rules catch a detached header and pass canonical geometry', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<html lang="en-AU"><style>
      :root { --header-h: 56px; --z-header: 20 } body { margin:0 } .sn-skip { position:absolute; top:-100px }
      header { position:sticky; top:0; height:var(--header-h); z-index:20 }
    </style><a class="sn-skip" href="#main">Skip</a>
    <header class="sn-app-header"><button aria-label="Open navigation" aria-controls="nav" aria-expanded="false">Menu</button>
    <span class="sn-app-header__conn">Offline</span><button aria-label="More actions">More</button>
    <button class="sn-app-header__search">Search</button></header>
    <main id="main"><h1>Library</h1></main></html>`);
    assert.deepEqual(await page.evaluate(inspectPage, { shell: true }), []);
    await page.addStyleTag({ content: 'header { margin:12px; border-radius:12px; position:relative; box-shadow:0 2px 8px black }' });
    const broken = await page.evaluate(inspectPage, { shell: true });
    for (const rule of ['header-position', 'header-edge', 'header-surface']) assert.ok(broken.some(f => f.rule === rule), rule);
    await page.locator('main').evaluate(el => { el.innerHTML += '<button class="sn-btn--primary">One</button><button class="sn-btn--primary">Two</button>'; });
    assert.ok((await page.evaluate(inspectPage, { shell: false })).some(f => f.rule === 'primary'));
  } finally { await browser.close(); }
});
