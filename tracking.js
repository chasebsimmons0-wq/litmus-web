// Symptoms and medications. A port of PainCore/Tracking.swift.
//
// Medications are tracked, never tested: switching a prescribed medication on and off
// can cause withdrawal or rebound, so the comparison offered is a before-and-after,
// described for what it is.

export const COMMON_SYMPTOMS = [
  'Fatigue', 'Sleep quality', 'Mood', 'Anxiety', 'Brain fog', 'Stiffness',
  'Headache', 'Nausea', 'Dizziness', 'Drowsiness', 'Stomach upset', 'Appetite',
];

// Calendar days as YYYY-MM-DD, in the person's own time zone. Arithmetic is done on
// the date parts in UTC so a daylight-saving change never makes a day 23 hours long.
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const utc = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export const dayDistance = (from, to) => Math.round((utc(to) - utc(from)) / 86400000);

export function addDays(key, days) {
  const d = new Date(utc(key) + days * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export const keyToDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const BEFORE_AFTER_MINIMUM_DAYS = 7;
export const BEFORE_WINDOW_DAYS = 28;

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** `scores` maps day keys to scores. Mirrors BeforeAfter.compute. */
export function beforeAfter(scores, start, end = null) {
  const before = [], after = [];
  for (const [key, value] of Object.entries(scores)) {
    const offset = dayDistance(start, key);
    if (offset < 0 && offset >= -BEFORE_WINDOW_DAYS) before.push(value);
    else if (offset >= 0) {
      if (end && dayDistance(end, key) > 0) continue;
      after.push(value);
    }
  }
  // Sorted so the sum runs in the same order as the Swift side.
  before.sort((a, b) => a - b);
  after.sort((a, b) => a - b);
  const beforeMean = mean(before), afterMean = mean(after);
  const enough = before.length >= BEFORE_AFTER_MINIMUM_DAYS && after.length >= BEFORE_AFTER_MINIMUM_DAYS;
  return {
    beforeMean, afterMean, beforeDays: before.length, afterDays: after.length,
    difference: enough && beforeMean != null && afterMean != null ? afterMean - beforeMean : null,
  };
}
