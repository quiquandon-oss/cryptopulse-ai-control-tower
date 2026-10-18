// TASK-GOV-002 Partition 2 acceptance criteria, one test per directive bullet.
// Exercises the real UI config (ui/js/config.js) and network gateway (ui/js/lib/http.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as config from '../../ui/js/config.js';
import { isAllowedUrl } from '../../ui/js/lib/http.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const allowed = [...config.allowedBackendUrls()];
const paths = (v) => Object.values(v.backend.paths).map((p) => new URL(v.backend.base + p).pathname);

test('V1: sentiment-ff75 host, read-only status route only (no /risk-regime, which writes)', () => {
  assert.equal(new URL(config.V1.backend.base).host, 'sentiment-ff75.quiquandon.workers.dev');
  assert.deepEqual(paths(config.V1), ['/technical-eval']);
  assert.equal(isAllowedUrl(`${config.V1.backend.base}/risk-regime`), false);
  assert.equal(isAllowedUrl(`${config.V1.backend.base}/history`), false);
});

test('V2: /prediction-freshness; /run-analysis, /recalibrate-refresh and backfills refused', () => {
  const base = config.V2.backend.base;
  assert.equal(new URL(base).host, 'pulseworker-v2.quiquandon.workers.dev');
  assert.deepEqual(paths(config.V2), ['/prediction-freshness']);
  for (const p of ['/run-analysis', '/recalibrate-refresh', '/recalibrate-refresh-challenger', '/btc-backfill', '/btc-backfill-hourly', '/eth-backfill-history']) {
    assert.equal(isAllowedUrl(base + p), false, p);
  }
});

test('V3: consumer of the V2 backend, labelled "via V2"', () => {
  assert.equal(config.V3.via, 'V2');
  assert.equal(config.V3.backend.base, config.V2.backend.base);
});

test('V4: /api/health, /api/signals, /api/market-pulse only; /api/portfolio* never', () => {
  const base = config.V4.backend.base;
  assert.equal(new URL(base).host, 'cryptopulse-v4.quiquandon.workers.dev');
  assert.deepEqual(paths(config.V4).sort(), ['/api/health', '/api/market-pulse', '/api/signals']);
  for (const p of ['/api/portfolio', '/api/portfolio/holdings', '/api/portfolio/import', '/api/ingest']) assert.equal(isAllowedUrl(base + p), false, p);
});

test('config rejects unapproved endpoints: unknown hosts, unknown paths, query tampering, http', () => {
  for (const url of [
    'https://example.com/api/health',
    `${config.V2.backend.base}/unknown-route`,
    `${config.V2.backend.base}/prediction-freshness?force=1`,
    config.V2.backend.base.replace('https:', 'http:') + '/prediction-freshness',
  ]) assert.equal(isAllowedUrl(url), false, url);
  for (const url of allowed) assert.equal(isAllowedUrl(url), true, url);
});

test('no allow-listed route is write-capable or private', () => {
  for (const url of allowed) assert.ok(!/portfolio|ingest|run-analysis|recalibrate|backfill|risk-regime|\/predict$/.test(url), url);
});

test('CSP connect-src = api.github.com, raw task files host, and the approved worker hosts only', () => {
  const html = readFileSync(join(ROOT, 'ui/index.html'), 'utf8');
  const connect = new Set(html.match(/connect-src ([^;]+);/)[1].trim().split(/\s+/));
  assert.deepEqual(connect, new Set(["'self'", 'https://api.github.com', 'https://raw.githubusercontent.com',
    'https://sentiment-ff75.quiquandon.workers.dev', 'https://pulseworker-v2.quiquandon.workers.dev', 'https://cryptopulse-v4.quiquandon.workers.dev']));
  assert.match(html, /default-src 'self'/);
  assert.match(html, /object-src 'none'/);
});

test('no secrets in client code or governance files', () => {
  const files = [];
  const walk = (dir) => readdirSync(join(ROOT, dir)).forEach((n) => {
    const rel = `${dir}/${n}`;
    if (statSync(join(ROOT, rel)).isDirectory()) { if (n !== 'tests') walk(rel); } else if (/\.(js|mjs|json|html)$/.test(n)) files.push(rel);
  });
  walk('ui'); walk('governance');
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    assert.ok(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY/.test(src), f);
    assert.ok(!/(api[_-]?key|token|secret|password)\s*[:=]\s*['"`][^'"`]{6,}/i.test(src), f);
  }
});
