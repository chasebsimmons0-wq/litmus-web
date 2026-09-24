// Litmus engine — JavaScript port of PainCore.
//
// A second engine is only acceptable if it cannot quietly disagree with the first.
// This file mirrors the Swift engine operation for operation, including the random
// number generator and the standard library's shuffle and bounded-random algorithms,
// and is checked against outputs written by the Swift engine itself
// (`paincheck fixtures`, verified by `node test/engine.test.mjs`). A change to the
// statistics on one side that is not mirrored on the other fails that check.
//
// Where the two can differ at all, it is in the last bits of floating point, so the
// check compares within a tight tolerance rather than for bit equality.

// ── Outcome measures ────────────────────────────────────────────────────────────

export const OUTCOMES = {
  'pain.intensity-nrs-11': {
    id: 'pain.intensity-nrs-11', displayName: 'Average daily pain', unit: 'points',
    prompt: 'How has your pain been today?',
    lowerBound: 0, upperBound: 10, lowerIsBetter: true, important: 2.0, trivial: 1.0,
  },
  'pain.interference-nrs-11': {
    id: 'pain.interference-nrs-11', displayName: 'How much pain interfered with your day', unit: 'points',
    prompt: 'How much did pain get in the way of what you did today?',
    lowerBound: 0, upperBound: 10, lowerIsBetter: true, important: null, trivial: null,
  },
  'sleep.quality-nrs-11': {
    id: 'sleep.quality-nrs-11', displayName: 'Sleep quality', unit: 'points',
    prompt: 'How well did you sleep last night?',
    lowerBound: 0, upperBound: 10, lowerIsBetter: false, important: null, trivial: null,
  },
};

export function thresholds(outcome, baselineSD) {
  if (outcome.important != null) {
    return {
      trivial: outcome.trivial ?? outcome.important / 2,
      important: outcome.important,
      source: 'published',
    };
  }
  const sd = baselineSD != null && baselineSD > 0 ? baselineSD : 1;
  return { trivial: 0.2 * sd, important: 0.5 * sd, source: 'baselineVariability' };
}

// ── Deterministic RNG (SplitMix64), matching SeededGenerator ────────────────────

const MASK = (1n << 64n) - 1n;

export class SeededGenerator {
  constructor(seed) { this.state = BigInt(seed) & MASK; }

  next() {
    this.state = (this.state + 0x9E3779B97F4A7C15n) & MASK;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK;
    return z ^ (z >> 31n);
  }

  // Swift's RandomNumberGenerator.next(upperBound:) — Lemire's method.
  nextBounded(upperBound) {
    const bound = BigInt(upperBound);
    let m = this.next() * bound;
    let low = m & MASK;
    if (low < bound) {
      const t = ((1n << 64n) - bound) % bound;
      while (low < t) {
        m = this.next() * bound;
        low = m & MASK;
      }
    }
    return Number(m >> 64n);
  }

  // Swift's Int.random(in: 0..<n, using:).
  intBelow(n) { return this.nextBounded(n); }
}

// Swift's MutableCollection.shuffle(using:).
function shuffle(array, rng) {
  let amount = array.length;
  let index = 0;
  while (amount > 1) {
    const r = rng.intBelow(amount);
    amount -= 1;
    const other = index + r;
    [array[index], array[other]] = [array[other], array[index]];
    index += 1;
  }
}

// ── Stats ───────────────────────────────────────────────────────────────────────

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const mean = (xs) => (xs.length === 0 ? 0 : sum(xs) / xs.length);

function standardDeviation(xs) {
  if (xs.length <= 1) return 0;
  const m = mean(xs);
  const ss = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0);
  return Math.sqrt(ss / (xs.length - 1));
}

function correlation(x, y) {
  if (x.length !== y.length || x.length <= 1) return 0;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) * (x[i] - mx);
    syy += (y[i] - my) * (y[i] - my);
  }
  if (!(sxx > 1e-12 && syy > 1e-12)) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

function solve(a, b) {
  const m = a.map((row) => row.slice());
  const v = b.slice();
  const n = b.length;
  if (n === 0 || m.length !== n) return null;

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (!(Math.abs(m[pivot][col]) > 1e-10)) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    [v[col], v[pivot]] = [v[pivot], v[col]];

    const denominator = m[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = m[row][col] / denominator;
      if (factor === 0) continue;
      for (let c = col; c < n; c++) m[row][c] -= factor * m[col][c];
      v[row] -= factor * v[col];
    }
  }

  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let s = v[row];
    for (let c = row + 1; c < n; c++) s -= m[row][c] * x[c];
    x[row] = s / m[row][row];
  }
  return x;
}

function ols(design, y) {
  if (design.length === 0 || design.length !== y.length) return null;
  const p = design[0].length;
  if (!(design.length > p)) return null;

  const xtx = Array.from({ length: p }, () => new Array(p).fill(0));
  const xty = new Array(p).fill(0);
  design.forEach((row, i) => {
    for (let a = 0; a < p; a++) {
      xty[a] += row[a] * y[i];
      for (let b = 0; b < p; b++) xtx[a][b] += row[a] * row[b];
    }
  });
  return solve(xtx, xty);
}

const fitted = (design, beta) =>
  design.map((row) => row.reduce((acc, x, i) => acc + x * beta[i], 0));

function crossProduct(design) {
  if (design.length === 0) return [];
  const p = design[0].length;
  const xtx = Array.from({ length: p }, () => new Array(p).fill(0));
  for (const row of design) {
    for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) xtx[a][b] += row[a] * row[b];
  }
  return xtx;
}

function invert(m) {
  const n = m.length;
  const inverse = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let col = 0; col < n; col++) {
    const unit = new Array(n).fill(0);
    unit[col] = 1;
    const column = solve(m, unit);
    if (!column) return null;
    for (let row = 0; row < n; row++) inverse[row][col] = column[row];
  }
  return inverse;
}

function multiply(a, b) {
  if (b.length === 0) return [];
  const n = a.length, mCols = b[0].length, k = b.length;
  const out = Array.from({ length: n }, () => new Array(mCols).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < mCols; j++) {
      let s = 0;
      for (let x = 0; x < k; x++) s += a[i][x] * b[x][j];
      out[i][j] = s;
    }
  }
  return out;
}

function hacCovariance(design, residuals, days, bandwidth) {
  const n = residuals.length;
  if (n === 0 || design.length === 0) return null;
  const p = design[0].length;
  if (!(n > p)) return null;

  const indexForDay = new Map();
  days.forEach((day, i) => indexForDay.set(day, i));

  const meat = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let lag = 0; lag <= Math.max(0, bandwidth); lag++) {
    const weight = bandwidth === 0 ? 1 : 1 - lag / (bandwidth + 1);
    if (!(weight > 0)) continue;
    days.forEach((day, i) => {
      const j = indexForDay.get(day - lag);
      if (j === undefined) return;
      const product = residuals[i] * residuals[j];
      for (let a = 0; a < p; a++) {
        for (let b = 0; b < p; b++) {
          if (lag === 0) {
            meat[a][b] += product * design[i][a] * design[i][b];
          } else {
            meat[a][b] += weight * product
              * (design[i][a] * design[j][b] + design[j][a] * design[i][b]);
          }
        }
      }
    });
  }

  const bread = invert(crossProduct(design));
  if (!bread) return null;
  const correction = n / (n - p);
  const scaled = meat.map((row) => row.map((x) => x * correction));
  return multiply(multiply(bread, scaled), bread);
}

const T_TABLE = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
  2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042,
];

export function tCritical95(df) {
  if (df < 1) return T_TABLE[0];
  if (df <= T_TABLE.length) return T_TABLE[df - 1];
  const z = 1.959964;
  const d = df;
  const z3 = z * z * z, z5 = z3 * z * z, z7 = z5 * z * z;
  return z
    + (z3 + z) / (4 * d)
    + (5 * z5 + 16 * z3 + 3 * z) / (96 * d * d)
    + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * d * d * d);
}

function lag1Autocorrelation(values, days) {
  if (values.length <= 2) return 0;
  const m = mean(values);
  let numerator = 0;
  let pairs = 0;
  for (let i = 1; i < values.length; i++) {
    if (days[i] !== days[i - 1] + 1) continue;
    numerator += (values[i] - m) * (values[i - 1] - m);
    pairs += 1;
  }
  if (pairs <= 1) return 0;
  const variance = values.reduce((acc, x) => acc + (x - m) * (x - m), 0) / values.length;
  if (!(variance > 1e-12)) return 0;
  const rho = (numerator / pairs) / variance;
  return Math.max(-0.99, Math.min(0.99, rho));
}

function biasCorrectedAutocorrelation(rho, n, p) {
  if (!(n > p + 2)) return rho;
  const corrected = rho + (1 + 3 * rho) / (n - p);
  return Math.max(-0.95, Math.min(0.95, corrected));
}

function autocorrelationTime(rho) {
  const r = Math.max(0, Math.min(0.95, rho));
  return (1 + r) / (1 - r);
}

// Swift's Double.rounded() is half-away-from-zero; for the positive values used
// here that is Math.round.
function clampWindow(requested, n) {
  const ceiling = Math.max(2, Math.trunc(n / 3));
  const floorValue = Math.max(2, Math.round(Math.pow(n, 1 / 3)));
  return Math.max(Math.min(floorValue, ceiling), Math.min(ceiling, Math.ceil(requested)));
}

// ── Trial construction ──────────────────────────────────────────────────────────

function longestRun(labels) {
  let longest = 1, current = 1;
  for (let i = 1; i < Math.max(1, labels.length); i++) {
    if (labels[i] === labels[i - 1]) { current += 1; longest = Math.max(longest, current); }
    else current = 1;
  }
  return longest;
}

export function blockOrder(count, allocation) {
  const n = Math.max(2, count - (count % 2));
  const alternating = () => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'a' : 'b'));
  if (!allocation.randomised || allocation.seed == null) return alternating();

  const rng = new SeededGenerator(allocation.seed);
  for (let attempt = 0; attempt < 500; attempt++) {
    const pool = [...new Array(n / 2).fill('a'), ...new Array(n / 2).fill('b')];
    shuffle(pool, rng);
    if (longestRun(pool) <= allocation.maximumRun) return pool;
  }
  return alternating();
}

export function makeTrial({
  intervention, comparator = null, outcomeId = 'pain.intensity-nrs-11', blockCount = 10, blockDays = 7,
  washoutDays = 3, seed, startDate, note,
}) {
  const allocation = { randomised: true, seed: String(seed), maximumRun: 2 };
  const order = blockOrder(blockCount, allocation);
  const phases = [];
  let cursor = 0;
  order.forEach((label, index) => {
    if (index > 0 && washoutDays > 0) {
      phases.push({ kind: 'washout', startDay: cursor, length: washoutDays });
      cursor += washoutDays;
    }
    phases.push({ kind: label, startDay: cursor, length: blockDays });
    cursor += blockDays;
  });
  return {
    id: crypto.randomUUID(),
    // With a comparator, A is a second active option rather than usual care. The
    // analysis is the same contrast either way; only what A means changes.
    design: comparator ? 'alternatingTreatments' : 'withdrawalABAB',
    conditionA: comparator ?? { id: 'control.usual-care', displayName: 'Usual care (no added intervention)' },
    conditionB: intervention,
    outcomeId,
    phases,
    startDate,
    allocation,
    userNote: note || null,
  };
}

/** A trial comparing two active options, rather than one option against usual care. */
export const isComparison = (trial) => trial.design === 'alternatingTreatments';

/** What the person does in a block of this kind, or null for usual care and washouts. */
export function conditionFor(trial, kind) {
  if (kind === 'b') return trial.conditionB;
  if (kind === 'a' && isComparison(trial)) return trial.conditionA;
  return null;
}

export const plannedDays = (trial) =>
  Math.max(0, ...trial.phases.map((p) => p.startDay + p.length));

// ── Overlapping trials (ConcurrentTrial in Model.swift) ────────────────────────
// `other` is { trial, dayOffset }: a day of the analysed trial plus dayOffset is the
// same calendar day in `other.trial`.

// `lastDay`, when set, is the last day (in the other trial's numbering) it actually ran.
function otherPhase(other, day) {
  const own = day + other.dayOffset;
  if (other.lastDay != null && own > other.lastDay) return null;
  return phaseOnDay(other.trial, own);
}

export const isOnAt = (other, day) => (otherPhase(other, day)?.kind === 'b' ? 1 : 0);

export function overlaps(other, base) {
  const n = plannedDays(base);
  for (let d = 0; d < n; d++) if (otherPhase(other, d)) return true;
  return false;
}

export const blockCountForOverlaps = (overlapCount, standard = 10) => Math.max(standard, 2 * (overlapCount + 4));

export function phaseOnDay(trial, day) {
  return trial.phases.find((p) => day >= p.startDay && day < p.startDay + p.length) || null;
}

// ── Analysis ────────────────────────────────────────────────────────────────────

const TUNING = {
  estimator: 'pairedBlocks',
  minimumPairsForBlockEstimator: 3,
  autocorrelationTimeInflation: 2.6,
  hacBandwidthMultiplier: 2,
  blockLengthMultiplier: 3,
};
const BOOTSTRAP_SAMPLES = 2000;
const BOOTSTRAP_SEED = 0x5EED;
const MINIMUM_DAYS_PER_CONDITION = 7;

const condPhases = (trial) => trial.phases.filter((p) => p.kind !== 'washout');

function summarize(label, trial, byDay) {
  let planned = 0;
  const logged = [];
  for (const phase of trial.phases) {
    if (phase.kind !== label) continue;
    planned += phase.length;
    for (let d = phase.startDay; d < phase.startDay + phase.length; d++) {
      if (byDay.has(d)) logged.push(byDay.get(d));
    }
  }
  const scores = logged.map((e) => e.score);
  const answers = logged.filter((e) => e.adhered != null).map((e) => e.adhered);
  return {
    label,
    plannedDays: planned,
    loggedDays: logged.length,
    meanScore: mean(scores),
    standardDeviation: standardDeviation(scores),
    flareDays: logged.filter((e) => e.isFlare).length,
    adherentDays: answers.length === 0 ? null : answers.filter(Boolean).length,
    get missingRate() {
      return this.plannedDays === 0 ? 0 : (this.plannedDays - this.loggedDays) / this.plannedDays;
    },
  };
}

function bootstrapEffects(design, fittedValues, residuals, length) {
  const n = residuals.length;
  const rng = new SeededGenerator(BOOTSTRAP_SEED);
  const draws = [];
  for (let s = 0; s < BOOTSTRAP_SAMPLES; s++) {
    const resampled = [];
    while (resampled.length < n) {
      const start = rng.intBelow(n);
      for (let offset = 0; offset < length; offset++) {
        resampled.push(residuals[(start + offset) % n]);
      }
    }
    resampled.length = n;
    const centre = mean(resampled);
    const y = fittedValues.map((f, i) => f + (resampled[i] - centre));
    const beta = ols(design, y);
    if (beta) draws.push(beta[1]);
  }
  return draws;
}

function pairedBlockEstimate(trial, byDay, otherSchedules = new Map(), otherCount = 0) {
  const blocks = condPhases(trial).slice().sort((a, b) => a.startDay - b.startDay);
  const blockMeans = (phase) => {
    const logged = [];
    for (let d = phase.startDay; d < phase.startDay + phase.length; d++) if (byDay.has(d)) logged.push(d);
    if (logged.length < 3) return null;
    const score = mean(logged.map((d) => byDay.get(d).score));
    const others = [];
    for (let j = 0; j < otherCount; j++) others.push(mean(logged.map((d) => otherSchedules.get(d)?.[j] ?? 0)));
    return { score, others };
  };

  const pendingA = [], pendingB = [], differences = [];
  let otherDifferences = [];
  const pair = (b, a) => {
    differences.push(b.score - a.score);
    otherDifferences.push(b.others.map((x, j) => x - a.others[j]));
  };
  for (const block of blocks) {
    const m = blockMeans(block);
    if (m == null) continue;
    if (block.kind === 'a') {
      if (pendingB.length === 0) pendingA.push(m);
      else pair(pendingB.shift(), m);
    } else {
      if (pendingA.length === 0) pendingB.push(m);
      else pair(m, pendingA.shift());
    }
  }

  const m = differences.length;
  const informative = [];
  for (let j = 0; j < otherCount; j++) {
    if (otherDifferences.some((row) => Math.abs(row[j]) > 1e-9)) informative.push(j);
  }
  otherDifferences = otherDifferences.map((row) => informative.map((j) => row[j]));
  const df = m - 1 - informative.length;
  if (!(m >= 2 && df >= 1)) return null;

  if (informative.length === 0) {
    const se = standardDeviation(differences) / Math.sqrt(m);
    if (!Number.isFinite(se) || !(se > 0)) return null;
    return { se, df };
  }

  const design = differences.map((_, i) => [1, ...otherDifferences[i]]);
  const beta = ols(design, differences);
  const inverse = invert(crossProduct(design));
  if (!beta || !inverse) return null;
  const fit = fitted(design, beta);
  const rss = differences.reduce((acc, d, i) => acc + (d - fit[i]) * (d - fit[i]), 0);
  const variance = rss / df * inverse[0][0];
  if (!Number.isFinite(variance) || !(variance > 0)) return null;
  return { se: Math.sqrt(variance), df };
}

function carryover(trial, byDay) {
  const ordered = trial.phases.slice().sort((a, b) => a.startDay - b.startDay);
  const afterA = [], afterB = [];
  ordered.forEach((phase, index) => {
    if (phase.kind !== 'washout' || index === 0) return;
    const preceding = ordered[index - 1].kind;
    if (preceding === 'washout') return;
    const scores = [];
    for (let d = phase.startDay; d < phase.startDay + phase.length; d++) {
      if (byDay.has(d)) scores.push(byDay.get(d).score);
    }
    if (scores.length === 0) return;
    (preceding === 'a' ? afterA : afterB).push(...scores);
  });
  if (afterA.length < 3 || afterB.length < 3) return null;
  return mean(afterB) - mean(afterA);
}

function decide({ interval, detectable, thr, a, b, outcome }) {
  const { trivial, important } = thr;
  const lowerIsBetter = outcome.lowerIsBetter;
  const scaleSpan = outcome.upperBound - outcome.lowerBound;

  if (!(Number.isFinite(detectable) && detectable < scaleSpan)) {
    return { kind: 'inconclusive', reason: 'tooFewCompletedBlocks' };
  }
  if (Math.abs(a.missingRate - b.missingRate) > 0.25) {
    return { kind: 'inconclusive', reason: 'differentialMissingness' };
  }
  const flareA = a.loggedDays === 0 ? 0 : a.flareDays / a.loggedDays;
  const flareB = b.loggedDays === 0 ? 0 : b.flareDays / b.loggedDays;
  if (Math.abs(flareA - flareB) > 0.35) {
    return { kind: 'inconclusive', reason: 'flareImbalance' };
  }

  const better = lowerIsBetter ? 'improved' : 'worsened';
  const worse = lowerIsBetter ? 'worsened' : 'improved';
  if (interval.high < -trivial) return { kind: 'meaningful', direction: better };
  if (interval.low > trivial) return { kind: 'meaningful', direction: worse };
  if (interval.high < 0) return { kind: 'probable', direction: better };
  if (interval.low > 0) return { kind: 'probable', direction: worse };
  if (interval.low > -trivial && interval.high < trivial) return { kind: 'null' };
  if (detectable > important) return { kind: 'inconclusive', reason: 'underpowered', detectable, important };
  return { kind: 'inconclusive', reason: 'effectSmallerThanNoise' };
}

function threatsFor({ a, b, rho, trendPerWeek, trial, autocorrelationKnown, carry, effect, thr, overlapping = 0 }) {
  const found = [];
  if (overlapping > 0) found.push({ kind: 'overlappingTrials', count: overlapping });
  if (thr.source === 'baselineVariability') found.push({ kind: 'thresholdFromOwnVariability', important: thr.important });

  if (carry != null && effect != null && Math.abs(effect) > 1e-6
      && carry / effect > 0.5 && Math.abs(carry) > thr.trivial / 2) {
    found.push({ kind: 'possibleCarryover', washoutDifference: carry });
  }

  const totalPlanned = a.plannedDays + b.plannedDays;
  const totalLogged = a.loggedDays + b.loggedDays;
  const overallMissing = totalPlanned === 0 ? 0 : (totalPlanned - totalLogged) / totalPlanned;
  if (overallMissing > 0.3) found.push({ kind: 'sparseLogging', rate: overallMissing });

  const missingGap = Math.abs(a.missingRate - b.missingRate);
  if (missingGap > 0.15) found.push({ kind: 'differentialMissingness', difference: missingGap });

  const flareA = a.loggedDays === 0 ? 0 : a.flareDays / a.loggedDays;
  const flareB = b.loggedDays === 0 ? 0 : b.flareDays / b.loggedDays;
  if (Math.abs(flareA - flareB) > 0.2) found.push({ kind: 'flareImbalance', difference: Math.abs(flareA - flareB) });

  if (autocorrelationKnown && rho > 0.5) found.push({ kind: 'strongAutocorrelation', rho });
  if (Math.abs(trendPerWeek) > 0.4) found.push({ kind: 'trendAcrossTrial', perWeek: trendPerWeek });

  if (b.adherentDays != null && b.loggedDays > 0) {
    const rate = b.adherentDays / b.loggedDays;
    if (rate < 0.75) found.push({ kind: 'poorAdherence', rate });
  }

  const lengths = condPhases(trial).map((p) => p.length);
  const shortest = lengths.length ? Math.min(...lengths) : 0;
  if (shortest > 0 && shortest < 7) found.push({ kind: 'shortConditionBlocks', days: shortest });

  return found;
}

export function analyze(trial, entries, concurrent = []) {
  const outcome = OUTCOMES[trial.outcomeId];
  const byDay = new Map();
  for (const e of entries) if (!byDay.has(e.day)) byDay.set(e.day, e);

  const days = [], scores = [], isB = [];
  for (const phase of trial.phases) {
    if (phase.kind === 'washout') continue;
    for (let d = phase.startDay; d < phase.startDay + phase.length; d++) {
      if (!byDay.has(d)) continue;
      days.push(d);
      scores.push(byDay.get(d).score);
      isB.push(phase.kind === 'b' ? 1 : 0);
    }
  }

  const overlapping = concurrent.filter((o) => overlaps(o, trial));
  const covariates = overlapping
    .map((o) => days.map((d) => isOnAt(o, d)))
    .filter((col) => new Set(col).size > 1);

  const a = summarize('a', trial, byDay);
  const b = summarize('b', trial, byDay);
  const thr = thresholds(outcome, Math.max(a.standardDeviation, b.standardDeviation));
  const carry = carryover(trial, byDay);

  if (days.length === 0) return null;

  const hasEnoughData = a.loggedDays >= MINIMUM_DAYS_PER_CONDITION && b.loggedDays >= MINIMUM_DAYS_PER_CONDITION;
  const meanDay = mean(days);
  const design = days.map((day, i) => [1, isB[i], (day - meanDay) / 7, ...covariates.map((col) => col[i])]);
  const entangled = covariates.some((col) => Math.abs(correlation(col, isB)) > 0.8);
  const solved = entangled ? null : ols(design, scores);
  const beta = hasEnoughData ? solved : null;

  if (!beta) {
    return {
      trial, outcome, effect: b.meanScore - a.meanScore,
      low: -Infinity, high: Infinity, standardError: Infinity,
      method: 'withinSeries', degreesOfFreedom: 0, detectable: Infinity,
      sandwichSE: null, bootstrapSE: null,
      verdict: hasEnoughData
        ? { kind: 'inconclusive', reason: 'entangledWithOtherTrial' }
        : { kind: 'inconclusive', reason: 'insufficientData', minimum: MINIMUM_DAYS_PER_CONDITION },
      a, b, rho: 0, trendPerWeek: 0,
      threats: threatsFor({ a, b, rho: 0, trendPerWeek: 0, trial, autocorrelationKnown: false, carry, effect: null, thr, overlapping: overlapping.length }),
      analysedDays: days.length, thresholds: thr, carryover: carry, overlappingTrials: overlapping.length,
    };
  }

  const effect = beta[1];
  const trendPerWeek = beta[2];
  const fittedValues = fitted(design, beta);
  const residuals = scores.map((s, i) => s - fittedValues[i]);
  const rawRho = lag1Autocorrelation(residuals, days);
  const rho = biasCorrectedAutocorrelation(rawRho, days.length, design[0].length);

  const tau = autocorrelationTime(rho) * TUNING.autocorrelationTimeInflation;
  const bandwidth = clampWindow(TUNING.hacBandwidthMultiplier * tau, days.length);
  const hac = hacCovariance(design, residuals, days, bandwidth);
  const hacVar = hac ? hac[1][1] : null;
  const hacSE = hacVar != null && hacVar > 0 ? Math.sqrt(hacVar) : null;

  const draws = bootstrapEffects(design, fittedValues, residuals,
    clampWindow(TUNING.blockLengthMultiplier * tau, days.length));
  const bootstrapSE = standardDeviation(draws);

  const effectiveN = days.length / tau;
  const withinSeriesDF = Math.max(3, Math.round(effectiveN) - design[0].length);
  const withinSeries = { se: Math.max(hacSE ?? 0, bootstrapSE), df: withinSeriesDF };
  const otherSchedules = new Map(days.map((d, i) => [d, covariates.map((col) => col[i])]));
  const paired = pairedBlockEstimate(trial, byDay, otherSchedules, covariates.length);

  const pairsAvailable = (paired?.df ?? 0) + 1;
  const blockUsable = paired != null && pairsAvailable >= TUNING.minimumPairsForBlockEstimator;
  const overlapTooDense = covariates.length > 0 && !blockUsable;
  const candidates = overlapTooDense ? [{ se: Infinity, df: 0 }]
    : blockUsable ? [paired] : [withinSeries, ...(paired ? [paired] : [])];

  // Swift's max(by:) keeps the first of equal maxima.
  let chosen = candidates[0];
  for (const c of candidates.slice(1)) {
    if (tCritical95(chosen.df) * chosen.se < tCritical95(c.df) * c.se) chosen = c;
  }

  const t = tCritical95(chosen.df);
  const method = paired && chosen.df === paired.df && chosen.se === paired.se ? 'pairedBlocks' : 'withinSeries';
  const interval = { low: effect - t * chosen.se, high: effect + t * chosen.se };
  const detectable = t * chosen.se;

  return {
    trial, outcome, effect, low: interval.low, high: interval.high,
    standardError: chosen.se, method, degreesOfFreedom: chosen.df, detectable,
    sandwichSE: hacSE, bootstrapSE,
    verdict: decide({ interval, detectable, thr, a, b, outcome }),
    a, b, rho, trendPerWeek,
    threats: threatsFor({ a, b, rho, trendPerWeek, trial, autocorrelationKnown: true, carry, effect, thr, overlapping: overlapping.length }),
    analysedDays: days.length, thresholds: thr, carryover: carry, overlappingTrials: overlapping.length,
  };
}

export function verdictString(v) {
  switch (v.kind) {
    case 'meaningful': return `meaningful:${v.direction}`;
    case 'probable': return `probable:${v.direction}`;
    case 'null': return 'null';
    default: return `inconclusive:${v.reason}`;
  }
}

// ── Planning ────────────────────────────────────────────────────────────────────

function blockMeanVariance(sd, rho, days) {
  if (days <= 0) return Infinity;
  const r = Math.max(0, Math.min(0.95, rho));
  let weighted = 0;
  for (let lag = 1; lag < Math.max(1, days); lag++) weighted += (days - lag) * Math.pow(r, lag);
  return sd * sd / (days * days) * (days + 2 * weighted);
}

export function detectableEffect(sd, rho, blockCount, blockDays, outcome = OUTCOMES['pain.intensity-nrs-11'], overlapCount = 0) {
  const pairs = Math.trunc(blockCount / 2);
  const df = pairs - 1 - overlapCount;
  if (pairs < 2 || !(df >= 2 || (overlapCount === 0 && df >= 1)) || !(sd > 0)) return Infinity;
  const variance = blockMeanVariance(sd, rho, blockDays);
  const inflation = overlapCount === 0 ? 1 : 1.08 * Math.sqrt(pairs / (pairs - overlapCount));
  const standardError = Math.sqrt(2 * variance / pairs) * inflation;
  return thresholds(outcome, sd).trivial + (tCritical95(df) + 1.15) * standardError;
}
