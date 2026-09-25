// Plain-language and clinician text. A port of PainCore/Reporting.swift; the wording
// is the same so the two apps never describe one result differently.

import { detectableEffect, PAIN_ID, TRIAL_DEFAULTS, trialLength, isComparison } from './engine.js';

/** A display name as it reads mid-sentence: first letter lowercased, unless the name
 *  leads with an acronym ("TENS" must not become "tENS" or "tens"). The same rule as
 *  PlainLanguage.midSentence on the Swift side. */
export const midSentence = (s) => {
  const head = s.match(/^\p{L}*/u)[0];
  if (head.length >= 2 && head === head.toUpperCase() && head !== head.toLowerCase()) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
};

const f = (x, places = 1) => (Number.isFinite(x) ? x.toFixed(places) : '—');
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');
const signed = (x) => (Number.isFinite(x) ? (x > 0 ? '+' : '') + f(x) : '—');

export function plan(sd, rho, target, outcome, washoutDays = 3, maximumDays = 140) {
  let best = null;
  for (const blockDays of [5, 7, 10, 14]) {
    for (let blockCount = 6; blockCount <= 20; blockCount += 2) {
      const total = blockCount * blockDays + (blockCount - 1) * washoutDays;
      if (total > maximumDays) continue;
      const detectable = detectableEffect(sd, rho, blockCount, blockDays, outcome);
      const c = { blockCount, blockDays, washoutDays, detectable, totalDays: total };
      if (!best) best = c;
      else if (best.detectable > target) { if (detectable < best.detectable) best = c; }
      else if (detectable <= target && total < best.totalDays) best = c;
    }
  }
  return best ?? { ...TRIAL_DEFAULTS, washoutDays, detectable: Infinity, totalDays: trialLength({ ...TRIAL_DEFAULTS, washoutDays }) };
}

function comparisonHeadline(a) {
  const B = a.trial.conditionB.displayName, A = a.trial.conditionA.displayName;
  const magnitude = f(Math.abs(a.effect));
  const [low, high] = bounds(a);
  const v = a.verdict;
  const lower = a.effect < 0 ? 'lower' : 'higher';
  if (v.kind === 'meaningful') {
    const winner = v.direction === 'improved' ? B : A;
    return `Your scores were about ${magnitude} points ${lower} in ${B} weeks than in ${A} weeks. Taking the day-to-day noise into account, the real difference is somewhere between roughly ${low} and ${high} points — so ${winner} looks genuinely better for you, not by chance.`;
  }
  if (v.kind === 'probable') {
    return `Your scores were about ${magnitude} points ${lower} in ${B} weeks than in ${A} weeks, and the comparison points the same way throughout. How big the difference is remains uncertain — anywhere from ${low} to ${high} points — so it may be one you’d clearly notice, or one too small to feel.`;
  }
  if (v.kind === 'null') {
    return `There’s no meaningful difference between ${B} and ${A} for you. The trial was long enough to have picked up a difference worth noticing, and it didn’t — on this measure, they look about the same.`;
  }
  return "This comparison can't answer the question yet. " + explain(a);
}

/** The result screen's headline, a few words. Worded identically to
 *  PlainLanguage.title; the parity fixtures hold the two to it. */
export function title(a) {
  const v = a.verdict;
  // "Too early" only where the trial has not yet done its job.
  const unsettled = () => (v.reason === 'insufficientData' || v.reason === 'tooFewCompletedBlocks'
    ? 'Too early to say.' : 'Not settled.');
  if ((v.kind === 'meaningful' || v.kind === 'probable') && v.direction === 'noMeaningfulChange') return 'Too close to call.';
  if (isComparison(a.trial)) {
    const ahead = v.direction === 'improved' ? a.trial.conditionB.displayName : a.trial.conditionA.displayName;
    if (v.kind === 'meaningful') return `${ahead} came out ahead.`;
    if (v.kind === 'probable') return `${ahead} edged ahead.`;
    if (v.kind === 'null') return 'No meaningful difference.';
    return unsettled();
  }
  if (v.kind === 'meaningful') return v.direction === 'improved' ? 'This one looks like it\u2019s working.' : 'This one looks like it\u2019s making things worse.';
  if (v.kind === 'probable') return v.direction === 'improved' ? 'Something changed for the better.' : 'Something changed for the worse.';
  if (v.kind === 'null') return 'This one isn\u2019t doing much for you.';
  return unsettled();
}

// The interval's two ends as sizes, smaller first, whichever way the effect points.
function bounds(a) {
  const [x, y] = [Math.abs(a.low), Math.abs(a.high)];
  return [f(Math.min(x, y)), f(Math.max(x, y))];
}

// For measures other than pain (sleep, where higher is better; interference), the
// wording names the measure and takes its direction from the sign of the effect.
function otherOutcomeHeadline(a) {
  const name = a.outcome.displayName.toLowerCase();
  const magnitude = f(Math.abs(a.effect));
  const [low, high] = bounds(a);
  const word = a.effect < 0 ? 'lower' : 'higher';
  const v = a.verdict;
  if (v.kind === 'meaningful') {
    return `Your ${name} scores were about ${magnitude} points ${word} while you were doing this. Taking the day-to-day noise into account, the real effect is somewhere between roughly ${low} and ${high} points — so this looks like a genuine ${v.direction === 'improved' ? 'improvement' : 'worsening'}, not chance.`;
  }
  if (v.kind === 'probable') {
    return `Something did change: your ${name} scores were about ${magnitude} points ${word} while you were doing this, and the comparison points the same way throughout. What's less settled is how much — the real effect could be anywhere from ${low} to ${high} points.`;
  }
  if (v.kind === 'null') {
    return `This one doesn't appear to be changing your ${name}. The trial was long enough and your logging complete enough to have picked up a change worth noticing, and it didn't find one. That's a real result — it rules something out.`;
  }
  return "This trial can't answer the question. " + explain(a);
}

export function headline(a) {
  if (isComparison(a.trial)) return comparisonHeadline(a);
  if (a.outcome.id && a.outcome.id !== PAIN_ID) return otherOutcomeHeadline(a);
  const magnitude = f(Math.abs(a.effect));
  const low = f(Math.abs(a.high));
  const high = f(Math.abs(a.low));
  const v = a.verdict;
  if (v.kind === 'meaningful' && v.direction === 'improved') {
    return `Your pain was about ${magnitude} points lower while you were doing this. Taking the day-to-day noise into account, the real effect is somewhere between roughly ${low} and ${high} points — so this looks like a genuine improvement, not chance.`;
  }
  if (v.kind === 'meaningful' && v.direction === 'worsened') {
    return `Your pain was about ${magnitude} points higher while you were doing this. That difference is larger than the day-to-day noise in your scores, so it appears to be real rather than a bad stretch.`;
  }
  if (v.kind === 'probable') {
    const word = v.direction === 'improved' ? 'lower' : 'higher';
    return `Something did change: your scores were about ${magnitude} points ${word} while you were doing this, and the comparison points the same way throughout. What's less settled is how much — the real effect could be anywhere from ${low} to ${high} points, so it may be a change you'd clearly notice, or one too small to feel.`;
  }
  if (v.kind === 'null') {
    return "This one doesn't appear to be doing much for you. The trial was long enough and your logging complete enough to have picked up a change worth noticing, and it didn't find one. That's a real result — it rules something out.";
  }
  return "This trial can't answer the question. " + explain(a);
}

export function explain(a) {
  const v = a.verdict;
  switch (v.reason) {
    case 'insufficientData':
      return `There aren't enough logged days yet — at least ${v.minimum} in each period are needed before a comparison means anything. You have ${a.a.loggedDays} and ${a.b.loggedDays}.`;
    case 'tooFewCompletedBlocks':
      if (a.overlappingTrials > 0) {
        return 'Not enough on and off weeks have finished yet for the number of trials running alongside this one. Each overlapping trial has to be accounted for using the same weeks, so more of them are needed before this one can say anything.';
      }
      return 'There are plenty of logged days, but not enough of the on and off weeks have finished yet. The comparison is made between whole weeks, so it needs several of each before it can say anything — keep going and this will fill in.';
    case 'underpowered':
      return `Your scores vary enough day to day that this trial could only have detected a change of about ${f(v.detectable)} points or larger. A change worth caring about is around ${f(v.important)}. A longer run would be needed to see something that size.`;
    case 'entangledWithOtherTrial':
      return "Another trial you ran at the same time switched on and off almost in step with this one, so their effects can't be told apart. Nothing you did wrong — it's the luck of two random orders lining up. Rerunning one of them on its own would settle it.";
    case 'differentialMissingness':
      return `You logged ${pct(1 - a.a.missingRate)} of days in one period and ${pct(1 - a.b.missingRate)} in the other. That gap matters: missed days tend to cluster on hard days, so comparing these two periods is partly comparing how much got logged, not how you felt.`;
    case 'flareImbalance': {
      const ra = a.a.loggedDays ? a.a.flareDays / a.a.loggedDays : 0;
      const rb = a.b.loggedDays ? a.b.flareDays / a.b.loggedDays : 0;
      return `Flares landed unevenly — ${pct(ra)} of days in one period versus ${pct(rb)} in the other. A flare moves your scores far more than most interventions do, so it's swamping the comparison.`;
    }
    default:
      return "The trial ran properly and the result still sits in the grey zone: the change, if there is one, is small enough that it can't be separated from ordinary variation.";
  }
}

export function rerunSuggestion(a) {
  if (a.verdict.kind !== 'inconclusive') return null;
  const sd = Math.max(a.a.standardDeviation, a.b.standardDeviation);
  const p = plan(sd, a.rho, a.thresholds.important, a.outcome);
  const suggested = `${p.blockCount} blocks of ${p.blockDays} days (about ${p.totalDays} days in total)`;
  switch (a.verdict.reason) {
    case 'insufficientData':
    case 'tooFewCompletedBlocks':
      return 'Keep logging — the trial can still finish as planned.';
    case 'underpowered':
      if (!(p.detectable <= a.thresholds.important)) {
        return `Your scores move enough day to day that no trial of a reasonable length would settle this one. That isn't a failure on your part — it means this question can't be answered by measuring ${a.outcome.displayName.toLowerCase()} alone. A different measure, or a different question to test, would be the way in.`;
      }
      return `Based on how much your scores moved, ${suggested} would give this a fair chance of showing an effect of the size that would matter.`;
    case 'entangledWithOtherTrial':
      return 'Rerun this one on its own, or at least not alongside the trial it lined up with.';
    case 'differentialMissingness':
    case 'flareImbalance':
      return "A rerun with the same design would likely work — the design wasn't the problem, the period was. Flare mode is there so a bad stretch still gets logged.";
    default:
      return `If this still feels worth knowing about, ${suggested} would narrow the estimate. If it doesn't, this is a reasonable place to stop and test something else.`;
  }
}

export function describeThreat(t) {
  switch (t.kind) {
    case 'sparseLogging': return `Missing data overall: ${pct(t.rate)} of planned days not logged.`;
    case 'differentialMissingness': return `Logging completeness differed between conditions by ${pct(t.difference)}.`;
    case 'flareImbalance': return `Flare-day rate differed between conditions by ${pct(t.difference)}.`;
    case 'strongAutocorrelation': return `Strong day-to-day dependence (lag-1 ${f(t.rho, 2)}); effective sample size well below day count.`;
    case 'trendAcrossTrial': return `Marked trend across the trial (${signed(t.perWeek)} points/week) independent of condition.`;
    case 'poorAdherence': return `Self-reported adherence only ${pct(t.rate)} during intervention blocks.`;
    case 'shortConditionBlocks': return `Shortest condition block was ${t.days} days, below the 7-day minimum for a stable block mean.`;
    case 'possibleCarryover': return `Effect still present during washout (${signed(t.washoutDifference)} points); washout may be too short and the estimate biased toward the null.`;
    case 'overlappingTrials':
      return `${t.count === 1 ? 'Another trial' : `${t.count} other trials`} ran over some of the same days; ${t.count === 1 ? 'its' : 'their'} on/off schedule was included in the model, which widens the interval, and interactions between interventions cannot be excluded.`;
    case 'thresholdFromOwnVariability': return `No established minimal important difference for this measure; threshold set at ${f(t.important)} from the patient's own variability (0.5 SD).`;
    default: return t.kind;
  }
}

// What the interval excludes, stated against the minimal important difference.
function ruledOut(a) {
  if (!Number.isFinite(a.low) || !Number.isFinite(a.high) || isComparison(a.trial)) return [];
  const mid = a.thresholds.important;
  const lower = a.outcome.lowerIsBetter;
  const out = [];
  const benefitExcluded = lower ? a.low > -mid : a.high < mid;
  const harmExcluded = lower ? a.high < mid : a.low > -mid;
  if (benefitExcluded) out.push(`an improvement of ${f(mid)} points or more`);
  if (harmExcluded) out.push(`a worsening of ${f(mid)} points or more`);
  return out;
}

function verdictLine(a) {
  const v = a.verdict;
  if (v.kind === 'meaningful') {
    return v.direction === 'improved'
      ? 'Change consistent with a real improvement of a magnitude patients typically notice.'
      : 'Change consistent with a real worsening of a magnitude patients typically notice.';
  }
  if (v.kind === 'probable') {
    const word = v.direction === 'improved' ? 'improvement' : 'worsening';
    return `Interval excludes the null and is consistent with ${word}, but spans the minimal important difference; magnitude not established.`;
  }
  if (v.kind === 'null') return 'No effect of a clinically meaningful size; the trial was adequately powered to detect one.';
  const short = {
    insufficientData: `fewer than ${v.minimum} logged days in at least one condition.`,
    tooFewCompletedBlocks: 'too few completed condition blocks for a between-block comparison.',
    underpowered: `trial could only detect ${f(v.detectable)} points; minimal important difference is ${f(v.important, 0)}.`,
    differentialMissingness: 'logging completeness differed substantially between conditions.',
    flareImbalance: 'flare days distributed unevenly between conditions.',
    effectSmallerThanNoise: 'estimate not separable from day-to-day variation.',
    entangledWithOtherTrial: 'block schedule too closely aligned with a concurrent trial to separate the two.',
  }[v.reason];
  return 'Inconclusive — ' + short;
}

const dateText = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function clinicianSummary(a, patientLabel, finishedOn = null) {
  const trial = a.trial;
  const planned = Math.max(...trial.phases.map((p) => p.startDay + p.length));
  const start = new Date(trial.startDate);
  let end = new Date(start); end.setDate(end.getDate() + planned - 1);
  // A trial ended early is described by the days it actually ran.
  if (finishedOn && new Date(finishedOn) < end) end = new Date(finishedOn);
  const ran = Math.round((end - start) / 86400000) + 1;
  const outcomeName = a.outcome.displayName.toLowerCase();
  const out = [];
  const name = (s) => (s === 'a' ? trial.conditionA.displayName : trial.conditionB.displayName);

  out.push('SELF-EXPERIMENT SUMMARY');
  if (patientLabel) out.push(`Patient: ${patientLabel}`);
  out.push(`Prepared ${dateText(new Date())}`, '');

  const comparison = isComparison(trial);
  out.push('QUESTION', comparison
    ? `Do ${trial.conditionB.displayName} and ${trial.conditionA.displayName} differ in their effect on ${outcomeName}?`
    : `Does ${trial.conditionB.displayName} change ${outcomeName}?`);
  if (trial.userNote) out.push(`Patient description of what was done: ${trial.userNote}`);
  out.push('');

  const ordered = trial.phases.slice().sort((x, y) => x.startDay - y.startDay);
  const blocks = ordered.filter((p) => p.kind !== 'washout').map((p) => p.length);
  const washouts = ordered.filter((p) => p.kind === 'washout').map((p) => p.length);
  const sequence = ordered.filter((p) => p.kind !== 'washout').map((p) => p.kind.toUpperCase()).join('-');
  const uniform = new Set(blocks).size === 1;
  out.push('METHOD', comparison
    ? 'Design: Alternating treatments, two active conditions in alternating blocks, single patient (n-of-1).'
    : 'Design: Withdrawal, alternating on/off blocks, single patient (n-of-1).');
  out.push(`${uniform ? `${blocks.length} blocks of ${blocks[0]} days` : `${blocks.length} blocks of ${blocks.join('/')} days`}. Washout between blocks: ${washouts[0] ?? 0} days, excluded from analysis.`);
  if (trial.allocation?.randomised && trial.allocation.seed != null) {
    out.push(`Block order randomised (balanced, maximum run of ${trial.allocation.maximumRun} consecutive same-condition blocks;`);
    out.push(`allocation seed ${trial.allocation.seed}, sequence reproducible on request): ${sequence}.`);
  } else {
    out.push(`Block order strictly alternating, not randomised: ${sequence}.`);
  }
  out.push(`Period: ${dateText(start)} to ${dateText(end)} (${ran < planned ? `${ran} of ${planned} planned days; ended early` : `${planned} days`}).`);
  out.push(`Outcome: ${a.outcome.displayName}, self-reported once daily.`);
  out.push('Point estimate: least-squares contrast of condition means adjusted for linear time trend.');
  if (a.method === 'pairedBlocks') {
    out.push(`95% interval: from the between-block variation of ${a.degreesOfFreedom + 1} paired block`);
    out.push(`differences, on ${a.degreesOfFreedom} degrees of freedom. This treats each block, not each day,`);
    out.push('as the unit of analysis, so within-block serial correlation does not inflate precision');
    out.push('and slow drift largely cancels within pairs.');
    if (a.overlappingTrials > 0) {
      out.push(`${a.overlappingTrials} concurrent trial(s) overlapped: block differences were regressed on the`);
      out.push("difference in each concurrent trial's on-time, with one degree of freedom spent on each.");
    }
  } else {
    out.push('95% interval: widest of a Newey–West autocorrelation-consistent standard error and a');
    out.push(`moving-block bootstrap, on ${a.degreesOfFreedom} degrees of freedom reduced for serial correlation.`);
    out.push('(Too few completed blocks for the between-block estimator.)');
  }
  out.push(`Missing days excluded, not imputed. ${trial.allocation?.randomised ? 'Block order randomised; not blinded.' : 'Not blinded, not randomised.'}`, '');

  const row = (s) => `${name(s.label)}: ${s.loggedDays}/${s.plannedDays} days logged (${pct(1 - s.missingRate)}), mean ${f(s.meanScore)}, SD ${f(s.standardDeviation)}, flare days ${s.flareDays}.`;
  out.push('DATA COMPLETENESS', row(a.a), row(a.b), `Days used in analysis: ${a.analysedDays}.`);
  if (a.b.adherentDays != null) out.push(`Self-reported adherence during ${trial.conditionB.displayName} blocks: ${a.b.adherentDays}/${a.b.loggedDays} days.`);
  if (comparison && a.a.adherentDays != null) out.push(`Self-reported adherence during ${trial.conditionA.displayName} blocks: ${a.a.adherentDays}/${a.a.loggedDays} days.`);
  out.push('');

  out.push('RESULT');
  if (Number.isFinite(a.effect) && Number.isFinite(a.low)) {
    out.push(`Mean score under ${trial.conditionB.displayName} was ${f(Math.abs(a.effect))} points ${a.effect < 0 ? 'lower' : 'higher'}`);
    out.push(`than under ${trial.conditionA.displayName} (95% CI ${signed(a.low)} to ${signed(a.high)}).`);
    out.push(`Smallest change this trial could distinguish from zero: ${f(a.detectable)} points.`);
    out.push(a.thresholds.source === 'published'
      ? `Reference: ~${f(a.thresholds.important, 0)}-point change on an 11-point NRS is the commonly cited minimal important difference.`
      : `Reference: threshold of ${f(a.thresholds.important)} points set from the patient's own variability (0.5 SD).`);
  } else {
    out.push('No estimate produced — insufficient data.');
  }
  out.push('', `INTERPRETATION: ${verdictLine(a)}`);
  const ruled = ruledOut(a);
  if (ruled.length) out.push(`RULED OUT (95% interval): ${ruled.join('; ')}.`);
  out.push('');

  out.push('LIMITATIONS AND THREATS TO VALIDITY');
  out.push('- Unblinded single-patient design; expectancy effects are not controlled.');
  if (Math.abs(a.trendPerWeek) > 0.05) out.push(`- Underlying trend across the trial of ${signed(a.trendPerWeek)} points/week, adjusted for in the model.`);
  if (a.rho > 0.05) {
    out.push(`- Residual lag-1 autocorrelation ${f(a.rho, 2)}; ${a.method === 'pairedBlocks'
      ? 'day-to-day dependence does not inflate precision under the block-level estimator used here'
      : 'the interval was widened accordingly'}.`);
  }
  for (const t of a.threats) out.push('- ' + describeThreat(t));
  if (a.threats.length === 0 && Math.abs(a.trendPerWeek) <= 0.05) out.push('- No additional threats flagged by the analysis.');
  out.push('', 'This is patient-collected data, presented for discussion.', 'It is not a diagnosis and contains no treatment recommendation.');
  return out.join('\n');
}
