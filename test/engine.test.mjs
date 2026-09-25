// Checks the statistics behave sensibly on simulated data. That confirms the analysis
// is wired up correctly; it says nothing about whether the answers are true for real
// pain, which only real data can show. Parity with the Swift engine is tested in the
// native app's repository, against fixtures it generates.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTrial, plannedDays, phaseOnDay, analyze } from '../engine.js';

const intervention = { id: 'thermal.heat', category: 'thermal', displayName: 'Heat' };

// Small seeded generator so every run sees the same data.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate(trial, { effect, seed = 1, keep = 1 }) {
  const r = rng(seed);
  const entries = [];
  let drift = 0;
  for (let d = 0; d < plannedDays(trial); d++) {
    drift = 0.5 * drift + (r() - 0.5) * 2;
    if (r() > keep) continue;
    const on = phaseOnDay(trial, d).kind === 'b';
    const score = Math.max(0, Math.min(10, Math.round(5.5 + drift + (on ? effect : 0))));
    entries.push({ day: d, score, sampleCount: 1, sampleSum: score, adhered: on ? true : null, isFlare: false, note: null });
  }
  return entries;
}

const trial = makeTrial({ intervention, seed: 7, startDate: '2026-01-01T00:00:00Z' });

test('a standard trial is ten weeks of blocks with washouts between them', () => {
  assert.equal(trial.phases.filter((p) => p.kind !== 'washout').length, 10);
  assert.equal(trial.phases.filter((p) => p.kind === 'washout').length, 9);
  assert.equal(plannedDays(trial), 10 * 7 + 9 * 3);
});

test('a large, consistent improvement is called meaningful', () => {
  const a = analyze(trial, simulate(trial, { effect: -3 }));
  assert.equal(a.verdict.kind, 'meaningful');
  assert.equal(a.verdict.direction, 'improved');
  assert.ok(a.low < -3 + 1.5 && a.high > -3 - 1.5, `interval ${a.low}..${a.high} should sit near -3`);
});

test('no effect is never called a meaningful improvement', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const a = analyze(trial, simulate(trial, { effect: 0, seed }));
    assert.ok(!(a.verdict.kind === 'meaningful' && a.verdict.direction === 'improved'), `seed ${seed}: ${JSON.stringify(a.verdict)}`);
  }
});

test('a few logged days is inconclusive, not a verdict', () => {
  const a = analyze(trial, simulate(trial, { effect: -3 }).slice(0, 10));
  assert.equal(a.verdict.kind, 'inconclusive');
  assert.equal(a.verdict.reason, 'insufficientData');
});

test('nothing logged gives no analysis', () => {
  assert.equal(analyze(trial, []), null);
});

test('a comparison puts a second option in the A weeks, and the contrast is B against A', async () => {
  const { isComparison, conditionFor } = await import('../engine.js');
  const tens = { id: 'electrotherapy.tens-conventional', displayName: 'TENS' };
  const cmp = makeTrial({ intervention, comparator: tens, seed: 11, startDate: '2026-01-01T00:00:00Z' });
  assert.equal(cmp.design, 'alternatingTreatment');
  assert.equal(isComparison(cmp), true);
  assert.equal(isComparison(trial), false);
  assert.equal(conditionFor(cmp, 'a'), tens);
  assert.equal(conditionFor(trial, 'a'), null);
  assert.equal(conditionFor(cmp, 'washout'), null);
  const a = analyze(cmp, simulate(cmp, { effect: -3 }));
  assert.equal(a.verdict.kind, 'meaningful');
  assert.equal(a.verdict.direction, 'improved');
});
