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

test('journal, flare plan and questions travel in the export', () => {
  const store = new Store();
  store.person = {
    name: 'Sam', profile: { sites: [] }, baselineStartedOn: null, baseline: [], trials: [], symptoms: [], symptomScores: {}, medications: [],
    journal: [{ id: 'A', date: '2026-09-24T10:00:00Z', text: 'Better morning' }],
    flarePlan: { helps: 'Heat' }, questions: [{ id: 'B', text: 'Referral?' }],
  };
  const data = JSON.parse(store.exportText());
  assert.equal(data.schema, 'litmus.export.v3');
  assert.deepEqual(data.journal, store.person.journal);
  assert.deepEqual(data.flarePlan, { helps: 'Heat' });
  assert.deepEqual(data.appointmentQuestions, [{ id: 'B', text: 'Referral?' }]);
});

test('a trial started after another ended is not counted as overlapping it', async () => {
  const { makeTrial } = await import('../engine.js');
  const heat = { id: 'thermal.heat', displayName: 'Heat' };
  const tens = { id: 'electrotherapy.tens-conventional', displayName: 'TENS' };
  const x = makeTrial({ intervention: heat, seed: 1, startDate: daysAgo(80) });
  const y = makeTrial({ intervention: tens, seed: 2, startDate: daysAgo(30) });
  const store = new Store();
  store.person = { trials: [
    { id: x.id, trial: x, entries: [], finishedOn: daysAgo(40) },
    { id: y.id, trial: y, entries: [], finishedOn: null },
  ] };
  assert.equal(store.concurrentWith(x, daysAgo(40)).length, 0);
  assert.equal(store.concurrentWith(y).length, 1, 'the later trial still sees the earlier one');
});

test('averaged days keep their reading count through a backup', () => {
  const store = new Store();
  store.person = {
    name: 'Sam', profile: { sites: [] }, baselineStartedOn: daysAgo(3), trials: [], symptoms: [], symptomScores: {}, medications: [],
    baseline: [{ day: 0, score: 4, sampleCount: 3, sampleSum: 12, adhered: null, isFlare: false, note: null }],
    journal: [], flarePlan: {}, questions: [],
  };
  const row = JSON.parse(store.exportText()).baseline[0];
  assert.equal(row.sampleCount, 3);
  assert.equal(row.sampleSum, 12);
});

test('a trial archived after its last day is not marked ended early; one archived before it is', async () => {
  for (const [daysIn, early] of [[200, false], [3, true]]) {
    const store = new Store();
    store.save = async () => {};
    const trial = { id: 'T', startDate: daysAgo(daysIn), phases: [{ kind: 'b', startDay: 0, length: 10 }] };
    store.person = { trials: [{ id: 'T', trial, entries: [], finishedOn: null }] };
    await store.archiveCurrent();
    assert.equal(store.person.trials[0].endedEarly, early, `archived ${daysIn} days in`);
    assert.ok(store.person.trials[0].finishedOn);
  }
});

test('a new trial warns about the running trials it would leave without an answer', async () => {
  const { makeTrial } = await import('../engine.js');
  const heat = { id: 'thermal.heat', displayName: 'Heat' };
  const tens = { id: 'electrotherapy.tens-conventional', displayName: 'TENS' };
  const running = (blockCount, i = 1) => {
    const t = makeTrial({ intervention: i % 2 ? heat : tens, seed: i, blockCount, startDate: daysAgo(2) });
    return { id: t.id, trial: t, entries: [], finishedOn: null };
  };
  const store = new Store();
  const withTrials = (...records) => { store.person = { trials: records }; return store; };

  assert.deepEqual(withTrials().trialsStarvedBy(false), [], 'nothing running, nothing to warn about');

  // Already short of pairs on its own: the new trial is not what costs it the answer.
  assert.deepEqual(withTrials(running(4)).trialsStarvedBy(false), []);

  // Six blocks leave exactly two degrees of freedom; any overlap takes it below.
  const six = running(6);
  assert.deepEqual(withTrials(six).trialsStarvedBy(false), [six]);
  assert.deepEqual(withTrials(six).trialsStarvedBy(true), [six]);

  // Ten blocks can absorb a comparison (cost 2) and still reach an answer.
  assert.deepEqual(withTrials(running(10)).trialsStarvedBy(true), []);

  // Two eight-block trials overlapping each other are each one overlap from the edge.
  const a = running(8, 1), b = running(8, 2);
  assert.deepEqual(withTrials(a, b).trialsStarvedBy(false), [a, b]);

  // A trial past its last day is not running today, so it cannot be starved.
  const past = running(6);
  past.trial.startDate = daysAgo(400);
  assert.deepEqual(withTrials(past).trialsStarvedBy(false), []);
});
