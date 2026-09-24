// The care record: one running summary, across every trial, that a new clinician can
// take in within a couple of minutes. The single-trial clinician summary answers "did
// this work?"; this answers "what's been going on, what's been tried, and what's been
// ruled out?" It states what was reported and measured, and recommends nothing.

import { SITES, QUALITIES, FACTORS, RED_FLAGS, LIBRARY, NERVE_QUALITIES } from './content.js';
import { plannedDays, isComparison } from './engine.js';

const f = (x, p = 1) => (Number.isFinite(x) ? x.toFixed(p) : '—');
const signed = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + f(Math.abs(x));
const dateText = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const labels = (pairs, ids) => ids.map((id) => pairs.find(([k]) => k === id)?.[1]).filter(Boolean);
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d; };

const label = (t) => (isComparison(t) ? `${t.conditionB.displayName} compared with ${lower(t.conditionA.displayName)}` : t.conditionB.displayName);

/** Plain-language verdict for one analysed trial, in a few words. */
export function shortVerdict(a) {
  if (!a) return 'no days logged';
  const v = a.verdict;
  if (a.trial && isComparison(a.trial)) {
    const [B, A] = [a.trial.conditionB.displayName, a.trial.conditionA.displayName];
    const ahead = v.direction === 'improved' ? B : A;
    if (v.kind === 'meaningful') return `${ahead} clearly better`;
    if (v.kind === 'probable') return `${ahead} somewhat better, size uncertain`;
    if (v.kind === 'null') return 'no meaningful difference';
    return 'not settled';
  }
  if (v.kind === 'meaningful') return v.direction === 'improved' ? 'clear improvement' : 'clear worsening';
  if (v.kind === 'probable') return v.direction === 'improved' ? 'some improvement, size uncertain' : 'some worsening, size uncertain';
  if (v.kind === 'null') return 'no meaningful effect';
  return 'not settled';
}

/**
 * Questions worth raising, drawn from what the person reported and measured. They
 * are questions for the clinician to answer — never advice to the person.
 */
export function suggestedQuestions({ profile, trials = [], medications = [] }) {
  const out = [];
  const flags = labels(RED_FLAGS.map(([id, l]) => [id, l]), profile.redFlags ?? []);
  if (flags.length) out.push(`I noted: ${flags.map(lower).join('; ')}. Does that need looking at before anything else?`);
  if (!(profile.diagnosesGiven ?? []).length || profile.diagnosesGiven.includes('No clear diagnosis yet')) {
    out.push('What do you think is driving my pain, and what would help confirm it?');
  }
  if ((profile.qualities ?? []).filter((q) => NERVE_QUALITIES.has(q)).length >= 2) {
    out.push('Some of my pain is burning, shooting or tingling. Could nerves be involved, and how would we find out?');
  }
  for (const { record, analysis } of trials.filter((t) => t.record.finishedOn)) {
    const name = record.trial.conditionB.displayName;
    const v = analysis?.verdict;
    if (!v) continue;
    if (isComparison(record.trial)) {
      const other = record.trial.conditionA.displayName;
      if (v.kind === 'meaningful') {
        const [win, lose] = v.direction === 'improved' ? [name, other] : [other, name];
        out.push(`${win} worked measurably better for me than ${lower(lose)}. Is there a way to build on that?`);
      } else if (v.kind === 'null') out.push(`${name} and ${lower(other)} made about the same difference for me. Does that change which is worth continuing?`);
      continue;
    }
    if (v.kind === 'meaningful' && v.direction === 'improved') out.push(`${name} measurably helped me. Is there a way to build on that?`);
    else if (v.kind === 'null') out.push(`${name} made no measurable difference for me. Is it still worth continuing?`);
    else if (v.kind === 'meaningful' && v.direction === 'worsened') out.push(`My pain was measurably worse with ${lower(name)}. Should I know anything about why?`);
  }
  for (const m of medications.filter((x) => !x.stoppedOn)) out.push(`How will we know whether ${m.name} is working for me?`);
  const factors = profile.factors ?? [];
  if (factors.includes('brokenSleep')) out.push('My sleep is broken most nights. Could that be looked at alongside the pain?');
  if (factors.includes('lowMood')) out.push('My mood has been low. What support is available?');
  out.push('Is there anything you’d want me to track or test next?');
  return out;
}

/**
 * The record as plain text.
 * @param {object} d
 * @param {string} d.name
 * @param {object} d.profile            onboarding answers
 * @param {Array}  d.trials             [{ record, analysis, dayNow? }]
 * @param {Array}  d.medications        [{ name, dose, doseChanges, startedOn, stoppedOn, comparison }]
 * @param {object} d.recent             { mean, days, flareDays, window }
 * @param {Array}  d.ownQuestions       questions the person added themselves
 * @param {Date}   [d.now]
 */
export function careRecord({ name, profile, trials = [], medications = [], recent = null, ownQuestions = [], now = new Date() }) {
  const out = [];
  out.push('PAIN RECORD');
  if (name) out.push(`Patient: ${name}`);
  out.push(`Prepared ${dateText(now)}. Kept by the patient in Litmus.`, '');

  out.push('THE PAIN');
  const sites = labels(SITES, profile.sites ?? []);
  const qualities = labels(QUALITIES, profile.qualities ?? []);
  if (sites.length) out.push(`Where: ${sites.join(', ')}.`);
  if (qualities.length) out.push(`Described as: ${qualities.map(lower).join(', ')}.`);
  if (profile.yearsWithPain != null) out.push(`For about ${profile.yearsWithPain} year${profile.yearsWithPain === 1 ? '' : 's'}.`);
  const dx = (profile.diagnosesGiven ?? []).filter((x) => x !== 'No clear diagnosis yet');
  out.push(dx.length ? `Diagnoses given by clinicians, as reported: ${dx.join(', ')}.` : 'No diagnosis given yet, as reported.');
  const factors = labels(FACTORS, profile.factors ?? []);
  if (factors.length) out.push(`Also reported: ${factors.map(lower).join('; ')}.`);
  const flags = labels(RED_FLAGS.map(([id, l]) => [id, l]), profile.redFlags ?? []);
  out.push(flags.length ? `Warning signs ticked at intake: ${flags.map(lower).join('; ')}.` : 'None of the listed warning signs were ticked at intake.');
  out.push('');

  if (recent && recent.days > 0) {
    out.push(`LAST ${recent.window} DAYS`);
    out.push(`Average daily pain ${f(recent.mean)}/10 over ${recent.days} logged day${recent.days === 1 ? '' : 's'}${recent.flareDays ? `, ${recent.flareDays} marked as flares` : ''}.`, '');
  }

  const done = trials.filter((t) => t.record.finishedOn);
  const running = trials.filter((t) => !t.record.finishedOn);
  if (done.length || running.length) {
    out.push('TESTED HERE', 'Randomised on/off self-experiments, one outcome scored daily, analysed against the patient’s own variability.');
    for (const { record, analysis: a } of done) {
      const t = record.trial;
      const end = addDays(t.startDate, plannedDays(t) - 1);
      const numbers = a && Number.isFinite(a.low) ? ` (${signed(a.effect)} points, 95% CI ${signed(a.low)} to ${signed(a.high)})` : '';
      out.push(`- ${label(t)}, ${dateText(t.startDate)} to ${dateText(new Date(Math.min(end, new Date(record.finishedOn))))}: ${shortVerdict(a)}${numbers}. Outcome: ${a?.outcome.displayName.toLowerCase() ?? 'pain'}.`);
    }
    for (const { record, dayNow } of running) {
      const t = record.trial;
      out.push(`- ${label(t)}: running now${dayNow != null ? `, day ${dayNow + 1} of ${plannedDays(t)}` : ''}.`);
    }
    out.push('');
  }

  const tried = labels(LIBRARY.map((i) => [i.id, i.displayName]), profile.alreadyTried ?? []);
  if (tried.length) out.push('TRIED BEFORE, AS REPORTED (not tested here)', ...tried.map((x) => `- ${x}`), '');

  if (medications.length) {
    out.push('MEDICATIONS');
    for (const m of medications) {
      const dose = m.doseChanges?.at(-1)?.dose ?? m.dose;
      const when = m.stoppedOn ? `${dateText(m.startedOn)} to ${dateText(m.stoppedOn)}` : `since ${dateText(m.startedOn)}`;
      const c = m.comparison;
      const moved = c && c.difference != null
        ? ` Pain before ${f(c.beforeMean)} (${c.beforeDays} days), since ${f(c.afterMean)} (${c.afterDays} days).`
        : '';
      out.push(`- ${m.name}${dose ? ` ${dose}` : ''}, ${when}.${moved}`);
    }
    out.push('Medication comparisons are before-and-after only, not trials.', '');
  }

  const questions = [...ownQuestions, ...suggestedQuestions({ profile, trials, medications })];
  if (questions.length) {
    out.push('QUESTIONS TO RAISE');
    questions.forEach((q, i) => out.push(`${i + 1}. ${q}`));
    out.push('');
  }

  out.push('Patient-collected data, presented for discussion.', 'It is not a diagnosis and contains no treatment recommendation.');
  return out.join('\n');
}
