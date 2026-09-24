import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headline, clinicianSummary } from '../reporting.js';
import { shortVerdict } from '../record.js';
import { makeTrial } from '../engine.js';

const heat = { id: 'thermal.heat', displayName: 'Heat' };
const tens = { id: 'electrotherapy.tens-conventional', displayName: 'TENS' };
const cmp = makeTrial({ intervention: heat, comparator: tens, seed: 5, startDate: '2026-01-01T00:00:00Z' });
const side = (label) => ({ label, loggedDays: 30, plannedDays: 35, missingRate: 0.14, meanScore: 5, standardDeviation: 1.2, flareDays: 1 });
const result = (verdict, effect = -2.4) => ({
  trial: cmp, outcome: { displayName: 'Average daily pain', lowerIsBetter: true }, effect, low: effect - 1, high: effect + 1,
  detectable: 1, method: 'pairedBlocks', degreesOfFreedom: 4, verdict, a: side('a'), b: side('b'), rho: 0, trendPerWeek: 0,
  threats: [], analysedDays: 60, thresholds: { trivial: 1, important: 2, source: 'published' }, overlappingTrials: 0,
});

test('a comparison names which option came out ahead', () => {
  assert.match(headline(result({ kind: 'meaningful', direction: 'improved' })), /in Heat weeks than in TENS weeks.*Heat looks genuinely better/);
  assert.match(headline(result({ kind: 'meaningful', direction: 'worsened' }, 2.4)), /TENS looks genuinely better/);
  assert.match(headline(result({ kind: 'null' }, 0.1)), /no meaningful difference between Heat and TENS/);
  assert.equal(shortVerdict(result({ kind: 'meaningful', direction: 'worsened' }, 2.4)), 'TENS clearly better');
});

test('the clinician summary describes the comparison design', () => {
  const text = clinicianSummary(result({ kind: 'meaningful', direction: 'improved' }), 'Sam');
  assert.match(text, /Do Heat and TENS differ in their effect on average daily pain\?/);
  assert.match(text, /Alternating treatments, two active conditions/);
});

test('a trial ended early is described by the days it ran, and adherence names each option', () => {
  const r = result({ kind: 'null' }, 0.1);
  r.a.adherentDays = 20; r.b.adherentDays = 25;
  const start = new Date(cmp.startDate);
  const ended = new Date(start); ended.setDate(ended.getDate() + 39);
  const text = clinicianSummary(r, 'Sam', ended.toISOString());
  assert.match(text, /\(40 of 97 planned days; ended early\)/);
  assert.match(text, /adherence during Heat blocks: 25\/30/);
  assert.match(text, /adherence during TENS blocks: 20\/30/);
});
