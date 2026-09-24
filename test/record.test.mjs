import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careRecord, suggestedQuestions, shortVerdict } from '../record.js';
import { makeTrial } from '../engine.js';

const profile = {
  sites: ['lowerBack', 'hips'], qualities: ['aching', 'burning', 'shooting'], diagnosesGiven: [],
  alreadyTried: ['manual.massage'], factors: ['brokenSleep'], redFlags: [], yearsWithPain: 6,
};
const trial = makeTrial({ intervention: { id: 'thermal.heat', displayName: 'Heat' }, seed: 3, startDate: '2026-01-05T00:00:00Z' });
const analysis = (verdict) => ({ verdict, effect: -0.2, low: -0.9, high: 0.5, outcome: { displayName: 'Average daily pain' } });
const done = { record: { trial, finishedOn: '2026-04-20T00:00:00Z' }, analysis: analysis({ kind: 'null' }) };

test('the record covers the pain, what was tested, what was tried, medications and questions', () => {
  const text = careRecord({
    name: 'Sam', profile, trials: [done],
    medications: [{ name: 'Amitriptyline', dose: '10 mg', doseChanges: [], startedOn: '2026-03-01', stoppedOn: null,
      comparison: { beforeMean: 6.1, beforeDays: 20, afterMean: 5.2, afterDays: 30, difference: -0.9 } }],
    recent: { window: 28, days: 22, flareDays: 3, mean: 5.43 },
    ownQuestions: ['Can I be referred to a pain clinic?'],
    now: new Date('2026-09-24T12:00:00Z'),
  });
  for (const bit of [
    'Patient: Sam', 'Where: Lower back, Hips.', 'For about 6 years.', 'No diagnosis given yet',
    'None of the listed warning signs', 'Average daily pain 5.4/10 over 22 logged days, 3 marked as flares',
    '- Heat, 5 Jan 2026', 'no meaningful effect (−0.2 points, 95% CI −0.9 to +0.5)', '- Massage',
    '- Amitriptyline 10 mg, since 1 Mar 2026. Pain before 6.1 (20 days), since 5.2 (30 days).',
    '1. Can I be referred to a pain clinic?', 'contains no treatment recommendation',
  ]) assert.ok(text.includes(bit), `missing: ${bit}\n\n${text}`);
});

test('questions follow what was logged and never tell the person what to do', () => {
  const qs = suggestedQuestions({ profile: { ...profile, redFlags: ['historyOfCancer'] }, trials: [done], medications: [{ name: 'Amitriptyline' }] });
  assert.match(qs[0], /history of cancer/);
  assert.ok(qs.some((q) => /nerves/.test(q)));
  assert.ok(qs.some((q) => /Heat made no measurable difference/.test(q)));
  assert.ok(qs.some((q) => /Amitriptyline is working/.test(q)));
  assert.ok(qs.some((q) => /sleep/.test(q)));
  for (const q of qs) {
    assert.ok(q.endsWith('?'), q);
    assert.doesNotMatch(q, /\byou should\b|\btry\b|\bstop taking\b/i, q);
  }
});

test('short verdicts', () => {
  assert.equal(shortVerdict(null), 'no days logged');
  assert.equal(shortVerdict(analysis({ kind: 'meaningful', direction: 'improved' })), 'clear improvement');
  assert.equal(shortVerdict(analysis({ kind: 'inconclusive', reason: 'insufficientData' })), 'not settled');
});
