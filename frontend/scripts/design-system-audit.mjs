/** Read-only audit of the real app; no API fixtures or data writes. */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function discoverRoutes(repo = root) {
  const features = resolve(repo, 'frontend/src/features');
  const files = ['frontend/src/routes/registry.tsx', 'frontend/src/App.tsx'];
  for (const entry of readdirSync(features, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const path = `frontend/src/features/${entry.name}/route.tsx`;
      try { readFileSync(resolve(repo, path)); files.push(path); } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
  }
  const routes = new Set();
  for (const file of files) {
    const source = readFileSync(resolve(repo, file), 'utf8');
    // Current route declarations use literal path: or JSX path= strings.
    for (const match of source.matchAll(/\bpath\s*[:=]\s*['"]([^'"]+)['"]/g)) routes.add(match[1]);
  }
  if (!routes.size) throw new Error('No literal routes discovered');
  return [...routes].sort();
}

export function planRoutes(routes, examples = {}) {
  return routes.map(pattern => {
    const dynamic = /[:*]/.test(pattern);
    const path = dynamic ? examples[pattern] : pattern;
    if (path && (!path.startsWith('/') || path.startsWith('//') || /[:*]/.test(path))) {
      throw new Error(`Expected a concrete same-origin path for ${pattern}`);
    }
    return { pattern, path, shell: !pattern.startsWith('/callback/') && !pattern.startsWith('/oauth/callback') };
  });
}

/** Runs inside the browser, also used by regression tests with synthetic HTML. */
export function inspectPage({ shell }) {
  const findings = [];
  const add = (rule, message) => findings.push({ rule, message });
  const visible = el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const all = selector => [...document.querySelectorAll(selector)].filter(visible);
  const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (document.documentElement.lang !== 'en-AU') add('locale', 'Document must declare en-AU');
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth) add('overflow', 'Page overflows horizontally');
  if (all('main#main').length !== 1) add('landmark', 'Expected one visible main#main');
  if (all('main h1').length !== 1) add('heading', 'Expected one visible page h1');
  const primaries = all('.sn-btn--primary').filter(el => !el.closest('.sn-date-range'));
  if (primaries.length > 1) add('primary', `Found ${primaries.length} primary actions`);
  if (shell) {
    const headers = all('header.sn-app-header');
    if (headers.length !== 1) add('header', 'Expected one visible AppHeader');
    const header = headers[0];
    if (header) {
      const cs = getComputedStyle(header), box = header.getBoundingClientRect();
      if (cs.position !== 'sticky' || parseFloat(cs.top) !== 0) add('header-position', 'AppHeader must be sticky at top:0');
      if (Math.abs(box.top) > 1 || Math.abs(box.left) > 1 || Math.abs(box.right - document.documentElement.clientWidth) > 1) add('header-edge', 'AppHeader must touch viewport top and side edges');
      // Resolve rem-based height through an element rather than assuming a root font size.
      const probe = document.createElement('div');
      probe.style.height = 'var(--header-h)'; probe.style.position = 'absolute';
      document.body.append(probe);
      const height = probe.getBoundingClientRect().height; probe.remove();
      if (!height || Math.abs(box.height - height) > 1) add('header-height', 'AppHeader height differs from --header-h');
      if (cs.zIndex !== token('--z-header')) add('header-layer', 'AppHeader must use z-header');
      if (cs.boxShadow !== 'none' || parseFloat(cs.borderRadius) > 0) add('header-surface', 'AppHeader must not be a raised rounded floating panel');
      if (!header.querySelector('[aria-label="Open navigation"][aria-controls][aria-expanded]')) add('navigation', 'Missing accessible drawer trigger');
      if (!header.querySelector('.sn-app-header__conn')) add('connection', 'Missing connection status');
      if (!header.querySelector('[aria-label="More actions"]')) add('tools', 'Missing More actions menu');
      if (!header.querySelector('.sn-app-header__search')) add('search', 'Missing search trigger');
    }
    const skip = document.querySelector('a.sn-skip[href="#main"]');
    if (!skip) add('skip-link', 'Missing skip link to main');
  }
  return findings;
}

async function run() {
  const args = process.argv.slice(2);
  const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  const allowed = new Set(['--base-url', '--examples', '--output', '--list', '--source-only']);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error(`Unknown argument ${args[i]}`);
    if (['--base-url', '--examples', '--output'].includes(args[i])) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${args[i]}`);
      i++;
    }
  }
  const examples = value('--examples') ? JSON.parse(readFileSync(resolve(value('--examples')), 'utf8')) : {};
  const routes = planRoutes(discoverRoutes(), examples);
  if (args.includes('--list')) { console.log(JSON.stringify(routes, null, 2)); return; }
  const report = { routes, source: null, pages: [], coverageGaps: [], manualReview: [
    'Copy meaning, action wording and editorial correctness',
    'Truth of displayed data, provider provenance and freshness',
    'All loading, empty, error, offline and interactive states not reached in this run',
    'Visual comparison with component previews; keyboard/focus, reduced motion and print checks',
    'Route discovery supports literal declarations; computed route declarations need review',
  ] };
  const output = resolve(value('--output') ?? resolve(root, 'frontend/test-results/design-system-audit.json'));
  const save = () => {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  };
  const source = spawnSync(process.env.PYTHON ?? 'python', ['scripts/check_design_system.py', '--check', '--strict', '--json'], { cwd: root, encoding: 'utf8' });
  if (source.error || ![0, 1].includes(source.status)) throw new Error(source.error?.message ?? source.stderr);
  report.source = JSON.parse(source.stdout);
  save();
  let failed = source.status !== 0;
  if (!args.includes('--source-only')) {
    const baseURL = value('--base-url') ?? process.env.PLAYWRIGHT_BASE_URL;
    if (!baseURL) throw new Error('Supply --base-url for the running frontend, or use --source-only');
    const { chromium } = await import('playwright');
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      for (const route of routes) {
        if (!route.path) { report.coverageGaps.push(`No concrete example for ${route.pattern}`); failed = true; continue; }
        for (const theme of ['dark', 'light', 'booth']) {
          const matrix = [390, 1440].flatMap(width => ['m', 'xl'].map(size => ({ width, size })));
          await Promise.all(matrix.map(async ({ width, size }) => {
          const result = { route: route.pattern, path: route.path, theme, width, size, findings: [] };
          report.pages.push(result);
          const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-AU', timezoneId: 'Australia/Melbourne' });
          const page = await context.newPage();
          page.setDefaultTimeout(10000);
          page.on('pageerror', error => result.findings.push({ rule: 'runtime', message: error.message }));
          page.on('console', msg => { if (msg.type() === 'error') result.findings.push({ rule: 'console', message: msg.text() }); });
          try {
            await page.addInitScript(({ theme, size }) => { localStorage.setItem('sn-theme', theme); localStorage.setItem('sn-text-size', size); }, { theme, size });
            const response = await page.goto(new URL(route.path, baseURL).href, { waitUntil: 'load' });
            result.finalURL = page.url();
            if (new URL(page.url()).pathname !== new URL(route.path, baseURL).pathname) {
              result.findings.push({ rule: 'route-redirect', message: `Requested ${route.path}, reached ${page.url()}; review route coverage` });
            }
            if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
            await page.locator('main#main').waitFor({ state: 'visible' });
            await page.waitForFunction(() => !document.querySelector('main#main[aria-busy="true"]'));
            await page.evaluate(() => document.fonts.ready);
            const actual = await page.locator('html').evaluate(el => ({ theme: el.dataset.theme, size: el.dataset.textSize }));
            if (actual.theme !== theme || (actual.size ?? 'm') !== size) result.findings.push({ rule: 'preferences', message: `Requested ${theme}/${size}, rendered ${JSON.stringify(actual)}` });
            result.findings.push(...await page.evaluate(inspectPage, route));
            const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
            for (const v of accessibility.violations) result.findings.push({ rule: `axe:${v.id}`, message: `${v.impact}: ${v.help}`, targets: v.nodes.map(n => n.target) });
            // Scroll the real document; a short page is explicitly recorded as untested.
            const scroll = await page.evaluate(() => {
              const el = document.scrollingElement;
              const before = el.scrollTop; el.scrollTop = Math.min(500, el.scrollHeight - el.clientHeight);
              return el.scrollTop - before;
            });
            if (route.shell && scroll > 0) {
              await page.evaluate(() => new Promise(requestAnimationFrame));
              const top = await page.locator('header.sn-app-header').evaluate(el => el.getBoundingClientRect().top);
              if (Math.abs(top) > 1) result.findings.push({ rule: 'header-scroll', message: `Header moved to ${top} after scrolling` });
            } else if (route.shell) result.scrollCheck = 'not exercised: document has no scroll range';
          } catch (error) { result.findings.push({ rule: 'audit-error', message: error.message }); }
          finally { await context.close(); }
          if (result.findings.length) failed = true;
          save();
          console.log(`${route.path} ${theme} ${width} ${size}: ${result.findings.length} findings`);
          }));
        }
      }
    } finally { await browser.close(); }
  } else report.coverageGaps.push('Browser checks not run (--source-only)');
  save();
  console.log(`Source: ${report.source.findings.length} findings; rendered cases: ${report.pages.length}; report: ${output}`);
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(error => { console.error(error); process.exitCode = 2; });
}
