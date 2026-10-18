// The shipped app must contain no mock/seed/placeholder data.
// Run from the repo root:  node --test ui/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI = join(dirname(fileURLToPath(import.meta.url)), '..');

// Everything served to users, excluding tests and docs about the app.
function shipped(dir = '') {
  return readdirSync(join(UI, dir)).flatMap((name) => {
    const rel = dir ? `${dir}/${name}` : name;
    if (['tests', 'icons', '__pycache__'].includes(name) || /\.(md|py)$/.test(name)) return [];
    return statSync(join(UI, rel)).isDirectory() ? shipped(rel) : [rel];
  });
}

const MARKERS = [
  [/\bmock(?!up)/i, 'mock'],
  [/\bseed\b|SEED/, 'seed data'],
  [/CP-2026-\d+/, 'fake task IDs'],
  [/Risk-Regime Scorer|D1 Hot-Path Index Review/, 'fake task titles'],
  [/a1b2c3d/, 'fake commit SHA'],
  [/18\/18 passed|6\/6 passed/, 'fake CI results'],
  [/Approve & Send|Authorize & Execute|Save Draft/, 'fake gate actions'],
  [/Not Deployed|Requested \(mock\)/, 'fake deployment state'],
  [/placeholder|lorem ipsum/i, 'placeholder text'],
];

test('no mock, seed or placeholder data in shipped files', () => {
  const files = shipped();
  assert.ok(files.includes('js/app.js') && files.includes('index.html'), 'scan found the app');
  for (const file of files) {
    const src = readFileSync(join(UI, file), 'utf8');
    for (const [re, what] of MARKERS) assert.ok(!re.test(src), `${file} contains ${what} (${re})`);
  }
});

test('removed mock-only modules stay removed', () => {
  assert.equal(existsSync(join(UI, 'js/views/newtask.js')), false);
  const state = readFileSync(join(UI, 'js/state.js'), 'utf8');
  assert.ok(!/tasks:\s*\[/.test(state), 'state.js must not define task arrays');
  assert.ok(!/structuredClone|localStorage/.test(state), 'state.js must not seed or persist data');
});
