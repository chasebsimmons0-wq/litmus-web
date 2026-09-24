// The service worker caches a hand-kept list of files. A module missing from it would
// fail to load offline, so the list is checked against what's actually there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('the offline shell lists every module and icon', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));
  const modules = readdirSync(new URL('..', import.meta.url)).filter((f) => f.endsWith('.js') && f !== 'sw.js');
  const icons = readdirSync(new URL('../icons', import.meta.url)).map((f) => `icons/${f}`);
  for (const f of [...modules, ...icons, 'index.html', 'styles.css', 'manifest.webmanifest']) {
    assert.ok(listed.has(f), `sw.js SHELL is missing ${f}`);
  }
});
