import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalCommunity, checkText, handleFor, cardSummary, NOTE_LIMIT } from '../community.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const result = {
  schema: 'litmus.result.v1',
  trial: { design: 'withdrawalABAB', intervention: { id: 'thermal.heat', category: 'thermal' }, comparator: null,
    outcome: 'pain.intensity-nrs-11', blockCount: 10, blockDays: 7, washoutDays: 3, randomised: true },
  completion: { plannedDays: 97, ranFullLength: true, loggedDays: { a: 31, b: 33 }, flareDays: { a: 2, b: 1 }, adherentDays: 30 },
  result: { verdict: 'meaningful', direction: 'improved', reason: null, effect: -2.4, low: -3.6, high: -1.2, detectable: 1.2, method: 'pairedBlocks', overlappingTrials: 0 },
  presentation: { sites: [], qualities: [], diagnosesGiven: [], factors: [], yearsWithPain: null, anyRedFlag: false },
};

test('text rules: length, links and handles blocked; crisis and advice flagged', () => {
  assert.equal(checkText('x'.repeat(NOTE_LIMIT + 1)).ok, false);
  for (const t of ['see https://cure.example', 'buy at painfree.shop', 'find me @healer_jo', 'www.thing']) assert.equal(checkText(t).ok, false, t);
  assert.equal(checkText('', { required: true }).ok, false);
  assert.equal(checkText('I want to die').crisis, true);
  assert.equal(checkText('You should try magnesium').soundsLikeAdvice, true);
  assert.equal(checkText('Heat helped me more than I expected').soundsLikeAdvice, false);
});

test('handles are stable pseudonyms', () => {
  assert.equal(handleFor('abc'), handleFor('abc'));
  assert.match(handleFor('abc'), /^[A-Z][a-z]+ [A-Z][a-z]+$/);
});

test('a result card reads without any personal detail', () => {
  const c = cardSummary(result);
  assert.equal(c.title, 'Heat');
  assert.equal(c.verdict, 'Clearly helped');
  assert.match(c.range, /-2\.4 points \(likely -3\.6 to -1\.2\)/);
  assert.match(c.detail, /10 alternating weeks · 64 days logged/);
  const custom = cardSummary({ ...result, trial: { ...result.trial, intervention: { id: 'custom', category: 'other' }, comparator: { id: 'manual.massage' } },
    result: { ...result.result, verdict: 'null' } });
  assert.equal(custom.title, 'Something of their own vs Massage');
  assert.equal(custom.verdict, 'No meaningful difference');
});

test('posting, replying, reporting and moderating', () => {
  const store = memory();
  const c = new LocalCommunity(store);
  const posted = c.post(result, 'Evenings only, 20 minutes.');
  assert.equal(posted.ok, true);
  assert.equal(c.feed().length, 1);
  assert.equal(c.reply(posted.id, 'Same for me with heat.').ok, true);
  assert.equal(c.feed()[0].replies.length, 1);

  // Crisis language is held, never shown, and queued for the moderator.
  const held = c.post(result, 'honestly I want to die some days');
  assert.equal(held.held, true);
  assert.equal(c.feed().length, 1);
  assert.equal(c.queue().filter((q) => q.reason === 'crisis').length, 1);

  // Reports go to the queue; the moderator decides.
  assert.equal(c.report(posted.id), true);
  assert.equal(c.report(posted.id), false, 'one report per person');
  assert.equal(c.queue().filter((q) => q.reason === 'reported').length, 1);
  c.moderate(posted.id, null, 'remove');
  assert.equal(c.feed().length, 0);

  // Everything persists.
  assert.equal(new LocalCommunity(store).queue().length, 1);
});
