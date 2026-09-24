// The shape of a result that could, one day and only with explicit consent, be pooled
// with other people's: "for people with a presentation like yours, this worked roughly
// N% of the time." Nothing reads, stores or sends this yet. It exists so the data model
// is right from the start, because it can't be retrofitted (brief §9, §10.7).
//
// What it deliberately leaves out: names, dates, notes, the person's own description of
// what they did, custom intervention names (free text can identify someone), the
// journal, and anything else typed rather than chosen from a fixed list.

import { plannedDays, isComparison } from './engine.js';

export const RESULT_SCHEMA = 'litmus.result.v1';

// Only taxonomy ids leave; a custom option is reduced to its category.
const option = (c) => (c.id.startsWith('custom.') ? { id: 'custom', category: c.category ?? 'other' } : { id: c.id, category: c.category ?? null });

const yearsBand = (y) => (y == null ? null : y < 1 ? '<1' : y <= 2 ? '1-2' : y <= 5 ? '3-5' : y <= 10 ? '6-10' : '>10');

const round = (x, p = 2) => (Number.isFinite(x) ? Math.round(x * 10 ** p) / 10 ** p : null);

/** One finished trial, reduced to what's needed to learn across people. */
export function anonymisedResult(record, analysis, profile) {
  const t = record.trial;
  const conditions = t.phases.filter((p) => p.kind !== 'washout');
  const washout = t.phases.find((p) => p.kind === 'washout');
  const lastLoggedDay = Math.max(-1, ...record.entries.map((e) => e.day));
  const a = analysis;
  return {
    schema: RESULT_SCHEMA,
    trial: {
      design: t.design,
      intervention: option(t.conditionB),
      comparator: isComparison(t) ? option(t.conditionA) : null,
      outcome: t.outcomeId,
      blockCount: conditions.length,
      blockDays: conditions[0]?.length ?? null,
      washoutDays: washout?.length ?? 0,
      randomised: !!t.allocation?.randomised,
    },
    completion: {
      plannedDays: plannedDays(t),
      // Recorded when the trial was closed; older records fall back to the last logged day.
      ranFullLength: record.endedEarly != null ? !record.endedEarly : lastLoggedDay >= plannedDays(t) - 1,
      loggedDays: { a: a?.a.loggedDays ?? 0, b: a?.b.loggedDays ?? 0 },
      flareDays: { a: a?.a.flareDays ?? 0, b: a?.b.flareDays ?? 0 },
      adherentDays: a?.b.adherentDays ?? null,
    },
    result: a ? {
      verdict: a.verdict.kind,
      direction: a.verdict.direction ?? null,
      reason: a.verdict.reason ?? null,
      effect: round(a.effect), low: round(a.low), high: round(a.high),
      detectable: round(a.detectable), method: a.method, overlappingTrials: a.overlappingTrials,
    } : null,
    presentation: {
      sites: [...(profile.sites ?? [])].sort(),
      qualities: [...(profile.qualities ?? [])].sort(),
      diagnosesGiven: [...(profile.diagnosesGiven ?? [])].sort(),
      factors: [...(profile.factors ?? [])].sort(),
      yearsWithPain: yearsBand(profile.yearsWithPain),
      anyRedFlag: (profile.redFlags ?? []).length > 0,
    },
  };
}
