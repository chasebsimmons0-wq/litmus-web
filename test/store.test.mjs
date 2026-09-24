import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store.js';

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
const entry = (day) => ({ day, score: 5, sampleCount: 1, sampleSum: 5, adhered: null, isFlare: false, note: null });

test('days since the last score counts the baseline and every trial', () => {
  const store = new Store();
  store.person = { baselineStartedOn: daysAgo(30), baseline: [], trials: [] };
  assert.equal(store.daysSinceLastLog, null, 'nothing logged yet');

  store.person.baseline = [entry(0), entry(20)];
  assert.equal(store.daysSinceLastLog, 10);

  store.person.trials = [{ trial: { startDate: daysAgo(8) }, entries: [entry(0), entry(4)] }];
  assert.equal(store.daysSinceLastLog, 4);

  store.person.trials[0].entries.push(entry(8));
  assert.equal(store.daysSinceLastLog, 0);
});
