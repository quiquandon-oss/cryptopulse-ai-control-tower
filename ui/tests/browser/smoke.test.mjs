// Browser smoke test (offline, deterministic). Requires Playwright + Chromium.
//
//   npm install --no-save --no-package-lock --ignore-scripts playwright@1.56.1
//   npx --no-install playwright install --with-deps chromium
//   node --test ui/tests/browser/*.test.mjs
//
// Serves the UI with ui/serve.py and BLOCKS every outbound request, so no
// production endpoint is ever contacted. Each attempted request is recorded
// and must be a GET to an allow-listed URL (ui/js/config.js). With all
// sources unreachable the UI must show error notices, never substitute data.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedUrl } from '../../js/lib/http.js';

// createRequire honours NODE_PATH, so a globally installed Playwright also works locally.
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ROUTES = ['workflow', 'dashboard', 'tasks/active', 'tasks/history', 'projects', 'agents', 'prs',
  'knowledge', 'templates', 'instructions', 'settings'];

let server;
let browser;
let base;

const freePort = () => new Promise((resolve, reject) => {
  const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  s.on('error', reject);
});

async function waitForServer(url, timeoutMs = 10_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`serve.py did not start at ${url}`);
}

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}/ui/`;
  server = spawn('python3', [join(ROOT, 'ui/serve.py'), '--port', String(port)], { stdio: 'ignore' });
  await waitForServer(base);
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

/** Open every route in one context; return findings for assertions. */
async function visitAll(contextOptions) {
  const context = await browser.newContext(contextOptions);
  const outbound = [];
  await context.route((url) => !url.href.startsWith('http://127.0.0.1:'), (route) => {
    outbound.push({ method: route.request().method(), url: route.request().url() });
    return route.abort('internetdisconnected');
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // Blocked outbound requests log a resource error by design; anything else is a failure.
    if (m.type() === 'error' && !/Failed to load resource: net::ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(`console: ${m.text()}`);
  });

  const results = [];
  for (const route of ROUTES) {
    await page.goto(`${base}#/${route}`);
    await page.waitForFunction(() => !document.body.innerText.includes('Loading'), null, { timeout: 15_000 }).catch(() => {});
    results.push({
      route,
      h1: (await page.locator('h1').first().textContent({ timeout: 5_000 }).catch(() => '')).trim(),
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      text: await page.locator('main').innerText(),
      errorNotices: await page.locator('.notice--error').count(),
    });
  }
  await context.close();
  return { results, errors, outbound };
}

for (const [label, options] of [
  ['desktop 1440px', { viewport: { width: 1440, height: 900 } }],
  ['phone (Pixel 7)', { ...devices['Pixel 7'] }],
]) {
  test(`all routes render offline without errors — ${label}`, async () => {
    const { results, errors, outbound } = await visitAll(options);

    assert.deepEqual(errors, [], 'no page errors, console errors or CSP violations');
    for (const r of results) {
      assert.ok(r.h1, `${r.route}: has a heading`);
      assert.equal(r.overflow, false, `${r.route}: no horizontal overflow`);
      assert.ok(!/\bmock(?!up)|CP-2026-|a1b2c3d/i.test(r.text), `${r.route}: no mock data`);
    }
    // Data views must report the outage instead of showing substitute data.
    for (const route of ['workflow', 'projects', 'prs']) {
      assert.ok(results.find((r) => r.route === route).errorNotices > 0, `${route}: shows an unavailable notice`);
    }

    // The app tried to reach its sources, and only via allow-listed GETs.
    assert.ok(outbound.length > 0, 'app attempted to load live data');
    for (const req of outbound) {
      assert.equal(req.method, 'GET', `${req.url}: GET only`);
      assert.ok(isAllowedUrl(req.url), `${req.url}: allow-listed`);
    }
  });
}
