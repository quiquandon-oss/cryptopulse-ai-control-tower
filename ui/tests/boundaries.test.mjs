// Version boundaries, allow-list and credential safety.
// Run from the repo root:  node --test ui/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as config from '../js/config.js';
import { isAllowedUrl } from '../js/lib/http.js';

const UI = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(UI, rel), 'utf8');
const jsFiles = (dir = 'js') => readdirSync(join(UI, dir)).flatMap((name) => {
  const rel = `${dir}/${name}`;
  return statSync(join(UI, rel)).isDirectory() ? jsFiles(rel) : rel.endsWith('.js') ? [rel] : [];
});

const VERSION_IDS = ['V1', 'V2', 'V3', 'V4'];

test('each version module imports only its own config entry and shared libs', () => {
  for (const id of VERSION_IDS) {
    const src = read(`js/sources/${id.toLowerCase()}.js`);
    const imports = [...src.matchAll(/^import\s+(.+?)\s+from\s+'([^']+)';/gm)].map((m) => [m[1], m[2]]);
    for (const [names, from] of imports) {
      assert.ok(['../config.js', '../lib/http.js', '../lib/status.js'].includes(from), `${id} imports ${from}`);
      if (from === '../config.js') assert.equal(names, `{ ${id} }`, `${id} must import only { ${id} } from config`);
    }
    for (const other of VERSION_IDS.filter((x) => x !== id)) {
      assert.ok(!new RegExp(`\\b${other}\\.`).test(src), `${id} module references ${other} config`);
      assert.ok(!src.includes(`./${other.toLowerCase()}.js`), `${id} module imports ${other} module`);
    }
    assert.ok(!/\bfetch\(/.test(src), `${id} must use fetchData(), not fetch()`);
  }
});

test('version modules only request their own allow-listed URLs', async (t) => {
  const requested = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = realFetch; });

  for (const id of VERSION_IDS) {
    requested.length = 0;
    const mod = await import(`../js/sources/${id.toLowerCase()}.js`);
    await mod[`load${id}`]().catch(() => {});
    const own = config[id];
    const allowed = Object.values(own.backend.paths).map((p) => own.backend.base + p);
    assert.ok(requested.length > 0, `${id} made no request`);
    for (const url of requested) assert.ok(allowed.includes(url), `${id} requested ${url}`);
  }
});

test('allow-list contains no forbidden or private routes', () => {
  const urls = [...config.allowedBackendUrls()];
  for (const url of urls) {
    const path = new URL(url).pathname;
    assert.ok(!config.FORBIDDEN_PATHS.some((f) => path === f || path.startsWith(`${f}/`)), `forbidden ${url}`);
    assert.ok(!/portfolio|ingest|run-analysis|recalibrate|backfill/i.test(url), `unsafe ${url}`);
  }
});

test('isAllowedUrl refuses forbidden, foreign and malformed URLs', () => {
  const v2 = config.V2.backend.base;
  const v4 = config.V4.backend.base;
  const refused = [
    `${v2}/run-analysis`, `${v2}/recalibrate-refresh`, `${v2}/btc-backfill`, `${v2}/predict`,
    `${v4}/api/portfolio`, `${v4}/api/portfolio/holdings`, `${v4}/api/ingest`,
    `${config.V1.backend.base}/risk-regime`,
    `${v2}/prediction-freshness?x=1`, // exact match only for backends
    'https://evil.example.com/api/health',
    'http://pulseworker-v2.quiquandon.workers.dev/prediction-freshness',
    'https://user:pw@pulseworker-v2.quiquandon.workers.dev/prediction-freshness',
    'https://api.github.com/repos/someone-else/repo/pulls',
    'https://api.github.com/repos/quiquandon-oss/Photoduel/pulls',
    'https://api.github.com/repos/quiquandon-oss/cryptopulse-ai-control-tower/../../user',
    'not a url',
  ];
  for (const url of refused) assert.equal(isAllowedUrl(url), false, url);

  const accepted = [
    `${config.V1.backend.base}/technical-eval`,
    `${v2}/prediction-freshness`,
    `${v2}/challenger-recent?limit=5`,
    `${v4}/api/health`,
    'https://api.github.com/repos/quiquandon-oss/cryptopulse-ai-control-tower/pulls?state=all',
    'https://api.github.com/repos/quiquandon-oss/CryptoPulseV4/actions/runs?per_page=1',
    'https://raw.githubusercontent.com/quiquandon-oss/cryptopulse-ai-control-tower/main/tasks/active/TASK-UI-001.md',
  ];
  for (const url of accepted) assert.equal(isAllowedUrl(url), true, url);
});

test('CSP connect-src lists exactly the configured hosts', () => {
  const html = read('index.html');
  const connect = html.match(/connect-src ([^;]+);/)[1].split(/\s+/).filter(Boolean);
  const expected = new Set(["'self'", config.GITHUB.api, config.GITHUB.raw,
    ...config.VERSIONS.map((v) => new URL(v.backend.base).origin)]);
  assert.deepEqual(new Set(connect), expected);
});

test('no credentials, auth headers or dynamic code execution in client code', () => {
  for (const file of jsFiles()) {
    const src = read(file);
    assert.ok(!/(api[_-]?key|token|secret|password)\s*[:=]\s*['"`][^'"`]{6,}/i.test(src), `${file}: credential-like literal`);
    assert.ok(!/['"]?Authorization['"]?\s*:/.test(src), `${file}: Authorization header`);
    assert.ok(!/\beval\(|new Function\(|\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(src), `${file}: unsafe DOM/eval`);
    assert.ok(!/setInterval\(/.test(src), `${file}: polling loop`);
  }
});
