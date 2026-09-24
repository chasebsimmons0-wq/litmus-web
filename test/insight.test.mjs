import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonymisedResult, RESULT_SCHEMA } from '../insight.js';
import { makeTrial, analyze } from '../engine.js';
import { customIntervention } from '../content.js';

const profile = { sites: ['lowerBack'], qualities: ['aching'], diagnosesGiven: ['Sciatica'], factors: ['brokenSleep'],
  yearsWithPain: 7, redFlags: ['historyOfCancer'], alreadyTried: [] };
const entries = (n) => Array.from({ length: n }, (_, day) => ({ day, score: 5 + (day % 3), isFlare: false, adhered: true }));

test('a result keeps the taxonomy and the numbers, and nothing that could identify someone', () => {
  const trial = makeTrial({ intervention: customIntervention('Grandma’s rosehip tea'), seed: 987654321,
    startDate: '2026-02-03T00:00:00Z', note: 'Two cups at 7pm at Mum’s house' });
  const record = { trial, entries: entries(107), finishedOn: '2026-05-20T00:00:00Z' };
  const out = anonymisedResult(record, analyze(trial, record.entries), profile);
  assert.equal(out.schema, RESULT_SCHEMA);
  assert.deepEqual(out.trial.intervention, { id: 'custom', category: 'other' });
  assert.equal(out.trial.blockCount, 10);
  assert.equal(out.completion.ranFullLength, true);
  assert.equal(out.presentation.yearsWithPain, '6-10');
  assert.equal(out.presentation.anyRedFlag, true);
  assert.ok(out.result.verdict);
  const text = JSON.stringify(out);
  for (const leak of ['rosehip', 'Mum', '2026', 'historyOfCancer', trial.id, trial.allocation.seed]) {
    assert.ok(!text.includes(leak), `leaked ${leak}`);
  }
});

test('a comparison records both options', () => {
  const trial = makeTrial({ intervention: { id: 'thermal.heat', category: 'thermal', displayName: 'Heat' },
    comparator: { id: 'manual.massage', category: 'manualTherapy', displayName: 'Massage' }, seed: 4, startDate: '2026-01-01T00:00:00Z' });
  const out = anonymisedResult({ trial, entries: [], finishedOn: '2026-02-01T00:00:00Z' }, null, profile);
  assert.deepEqual(out.trial.comparator, { id: 'manual.massage', category: 'manualTherapy' });
  assert.equal(out.result, null);
  assert.equal(out.completion.ranFullLength, false);
});
