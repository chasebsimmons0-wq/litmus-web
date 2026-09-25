// Litmus — web. The screens, built on the same engine as the native app.

import { OUTCOMES, detectableEffect, plannedDays, phaseOnDay, blockCountForOverlaps, isComparison, conditionFor, PAIN_ID, TRIAL_DEFAULTS, trialLength } from './engine.js';
import { Store, daysBetween, BASELINE_MIN_DAYS, BASELINE_SUGGESTED_DAYS } from './store.js';
import {
  SITES, QUALITIES, FACTORS, RED_FLAGS, DIAGNOSES, LIBRARY, PRACTICES, PAIN_RAMP,
  suggestedOrder, customIntervention, NERVE_QUALITIES, widespreadFeatureCount, LESSONS, SUPPORT,
} from './content.js';
import { careRecord, shortVerdict } from './record.js';
import { ember } from './mascot.js';
import { anonymisedResult } from './insight.js';
import { LocalCommunity, cardSummary, NOTE_LIMIT } from './community.js';
import { headline, title as resultTitle, rerunSuggestion, describeThreat, clinicianSummary, plan, midSentence } from './reporting.js';
import { COMMON_SYMPTOMS, dayKey, keyToDate, beforeAfter, BEFORE_AFTER_MINIMUM_DAYS } from './tracking.js';
import { reminderCalendar, parseTime } from './reminders.js';
import { mentionsCrisis, crisisLine } from './safety.js';

const store = new Store();
const ui = { tab: 'today', sheet: null, step: 0, draft: null, practice: null };
const root = document.getElementById('app');
const DEBUG = new URLSearchParams(location.search).has('debug');

// ── tiny DOM helper ───────────────────────────────────────────────────────────────

function h(tag, attrs = {}, ...kids) {
  const [name, ...classes] = tag.split('.');
  const el = name === 'svg' || attrs.svg ? document.createElementNS('http://www.w3.org/2000/svg', name) : document.createElement(name || 'div');
  if (classes.length) el.setAttribute('class', classes.join(' '));
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false || k === 'svg') continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.setAttribute('class', [el.getAttribute('class'), v].filter(Boolean).join(' '));
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const s = (tag, attrs = {}, ...kids) => h(tag, { ...attrs, svg: true }, ...kids);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const fmt = (x, p = 1) => (Number.isFinite(x) ? x.toFixed(p) : '—');

function toast(text) {
  const t = h('div.toast', { role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

function haptic() { try { navigator.vibrate?.(8); } catch {} }

// ── shared pieces ─────────────────────────────────────────────────────────────────

function presence(size = '') {
  // A calm horizon in a circle: the same idea as the native presence, simplified.
  return s('svg', { class: `presence ${size}`, viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    s('circle', { cx: 50, cy: 50, r: 46, fill: 'var(--sage-surface)', stroke: 'var(--sage-line)', 'stroke-width': 2 }),
    s('path', { d: 'M14 58 Q50 50 86 58 L86 70 Q50 96 14 70 Z', fill: 'var(--sage)', opacity: 0.35 }),
    s('circle', { cx: 50, cy: 38, r: 9, fill: 'var(--clay)', opacity: 0.75 }),
    s('path', { d: 'M14 58 Q50 50 86 58', stroke: 'var(--sage)', 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }));
}

// Ember, in whichever pose fits the moment.
function guide(pose = 'main', size = '') {
  const el = h(`div.ember${size ? '.' + size : ''}`, { role: 'img', 'aria-label': 'Ember, the Litmus guide' });
  el.innerHTML = ember(pose, { ground: pose !== 'rest' });
  return el;
}

function avatar(person, cls = '') {
  return h(`div.avatar${cls}`, { 'aria-hidden': 'true' }, (person?.name ?? '?').trim().charAt(0).toUpperCase());
}

function header(title, lead) {
  return h('div.stack.tight', {},
    h('div.row', {}, guide(), h('div.grow')),
    h('h1.display', {}, title),
    lead && h('p.reading', {}, lead));
}

/** A trial's name: the option, or both options when it's a comparison. */
const trialName = (t) => (isComparison(t) ? `${t.conditionB.displayName} vs ${t.conditionA.displayName}` : t.conditionB.displayName);

function card(kind, ...kids) { return h(`section.card${kind ? '.' + kind : ''}`, {}, ...kids); }

const isDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

// The same ramp compressed and dimmed at night, as the native app does, so no swatch glows.
function painColor(v) {
  const hex = PAIN_RAMP[Math.max(0, Math.min(10, Math.round(v)))];
  if (!isDark()) return hex;
  const mix = (i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.38 + [0x1B, 0x19, 0x17][(i - 1) / 2] * 0.62);
  return `rgb(${mix(1)}, ${mix(3)}, ${mix(5)})`;
}

function scoreScale(selected, outcome, onPick) {
  const ramp = (v) => (outcome.lowerIsBetter ? v : 10 - v);
  const text = (v) => (isDark() ? '#ECE4D9' : ramp(v) >= 8 ? '#FBF7F0' : ramp(v) >= 4 ? '#5E564E' : '#6B635B');
  const cell = (v, extra) => h(`button.cell${extra ? '.' + extra : ''}${selected === v ? '.selected' : ''}`, {
    style: { background: painColor(ramp(v)), color: text(v) },
    'aria-label': `${v} out of 10`, 'aria-pressed': String(selected === v),
    onclick: () => { haptic(); onPick(v); },
  }, v);
  const zero = cell(0, 'zero');
  zero.style.outline = selected === 0 ? '' : '1px solid var(--line)';
  zero.style.outlineOffset = '-1px';
  return h('div.scale', {},
    h('p.caption', {}, outcome.lowerIsBetter
      ? '0 is none at all · 10 is as bad as it gets'
      : '0 is as bad as it gets · 10 is as good as it gets'),
    zero,
    h('div.grid', {}, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => cell(v))));
}

function flareToggle(on, onChange) {
  return h(`button.btn.outline${on ? '.on' : ''}`, { 'aria-pressed': String(on), onclick: () => onChange(!on) },
    on ? [h('i.dot'), 'Marked as a flare'] : 'Today is a flare');
}

// The trace. Gaps are never bridged: a missed day is shown as missing.
function trace(entries, trial, { today } = {}) {
  const total = trial ? plannedDays(trial) : Math.max(14, ...entries.map((e) => e.day + 1));
  const W = 320, H = 150, top = 8, bottom = 8;
  const x = (d) => ((d + 0.5) / total) * W;
  const y = (v) => top + (1 - v / 10) * (H - top - bottom);
  const svg = s('svg', { class: 'trace', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img',
    'aria-label': `${plural(entries.length, 'logged day')}` });

  if (trial) {
    for (const p of trial.phases) {
      const fill = p.kind === 'b' ? 'var(--band-on)' : p.kind === 'a' ? 'var(--band-off)' : 'var(--band-wash)';
      svg.append(s('rect', { x: (p.startDay / total) * W, y: 0, width: (p.length / total) * W, height: H, fill }));
    }
  }
  for (const v of [0, 5, 10]) {
    svg.append(s('line', { x1: 0, x2: W, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
  }
  const sorted = entries.slice().sort((a, b) => a.day - b.day);
  let run = [];
  const flush = () => {
    if (run.length > 1) {
      svg.append(s('polyline', { points: run.map((e) => `${x(e.day)},${y(e.score)}`).join(' '),
        fill: 'none', stroke: 'var(--ink-soft)', 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }));
    }
    run = [];
  };
  for (const e of sorted) {
    if (run.length && e.day !== run[run.length - 1].day + 1) flush();
    run.push(e);
  }
  flush();
  // Dots are drawn as short lines so they stay round under the non-uniform scaling.
  for (const e of sorted) {
    svg.append(s('line', { x1: x(e.day), x2: x(e.day), y1: y(e.score), y2: y(e.score),
      stroke: e.isFlare ? 'var(--clay)' : 'var(--ink)', 'stroke-width': e.isFlare ? 7 : 4.5,
      'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }));
  }
  if (trial && today != null && today < total - 1) {
    svg.append(s('rect', { x: x(today) + (W / total) / 2, y: 0, width: W, height: H, fill: 'var(--paper)', opacity: 0.55 }));
  }
  return svg;
}

function traceLegend(trial) {
  return h('div.legend', {},
    trial && h('span', {}, h('i.swatch', { style: { background: 'var(--band-on)' } }), trial.conditionB.displayName),
    trial && h('span', {}, h('i.swatch', { style: { background: 'var(--band-off)' } }), isComparison(trial) ? trial.conditionA.displayName : 'Off'),
    trial && h('span', {}, h('i.swatch', { style: { background: 'var(--band-wash)' } }), 'Between'),
    h('span.row', { style: { gap: '5px' } }, h('i.dot'), 'Flare'));
}

// ── profile chooser ──────────────────────────────────────────────────────────────

function chooser() {
  const people = store.people;
  let name = '';
  const input = h('input.field', { placeholder: 'A name, or just “Me”', autocomplete: 'off', oninput: (e) => { name = e.target.value; } });
  return h('div.stack', {},
    h('div.stack.tight', { style: { marginTop: '28px' } },
      guide(people.length ? 'main' : 'welcome', 'lg'),
      h('h1.display.lg', {}, people.length ? 'Who’s here?' : 'Welcome to Litmus'),
      h('p.reading', {}, people.length
        ? 'Each profile keeps its own separate history on this device.'
        : 'Everything stays on this device. A profile just keeps one person’s history apart from anyone else’s.')),
    people.length > 0 && h('div.stack.tight', {},
      people.map((p) => h('button.check', { onclick: () => store.use(p) },
        avatar(p), h('div.grow', {}, h('div', { style: { fontSize: '16px' } }, p.name),
          h('div.caption', {}, p.trials.some((t) => !t.finishedOn) ? 'Trial in progress' : p.profile.completedOnboarding ? 'Baseline' : 'Just started')),
        h('span.muted', {}, '›')))),
    card('', h('p.label', {}, people.length ? 'New profile' : 'Your name'), input,
      h('button.btn.primary', { onclick: async () => { await store.addPerson(name); ui.step = 0; ui.draft = null; ui.tab = 'today'; } }, 'Start')),
    restoreButton());
}

function restoreButton() {
  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', onchange: async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const name = await store.importText(await f.text());
      ui.sheet = null;
      const n = store.restoreSkippedTrials ?? 0;
      toast(`Restored as “${name}”.${n ? ` ${n === 1 ? 'One trial' : `${n} trials`} couldn’t be read and ${n === 1 ? 'was' : 'were'} left out; everything else came back.` : ''}`);
    } catch (err) { toast(err.message); }
    e.target.value = '';
  } });
  return h('div', {}, file, h('button.btn.outline', { onclick: () => file.click() }, 'Restore from an export file'));
}

// ── onboarding ───────────────────────────────────────────────────────────────────

const STEPS = ['welcome', 'sites', 'qualities', 'history', 'factors', 'safety', 'picture'];

function onboarding() {
  // A draft belongs to one person: switching profile mid-onboarding starts theirs afresh.
  if (ui.draftFor !== store.person.id) { ui.draft = null; ui.step = 0; ui.draftFor = store.person.id; }
  ui.draft ??= structuredClone(store.profile);
  const d = ui.draft;
  const step = STEPS[ui.step];
  const toggle = (list, id) => { const i = list.indexOf(id); i >= 0 ? list.splice(i, 1) : list.push(id); render(); };
  const chips = (options, list) => h('div.chips', {}, options.map(([id, label]) =>
    h(`button.chip${list.includes(id) ? '.on' : ''}`, { 'aria-pressed': String(list.includes(id)), onclick: () => toggle(list, id) }, label)));
  const checks = (options, list) => h('div.stack.tight', {}, options.map(([id, label]) =>
    h(`button.check${list.includes(id) ? '.on' : ''}`, { 'aria-pressed': String(list.includes(id)), onclick: () => toggle(list, id) },
      h('span.box', {}, list.includes(id) ? '✓' : ''), h('span.body', { style: { color: 'var(--ink)' } }, label))));

  let body;
  switch (step) {
    case 'welcome':
      body = [
        h('h1.display.lg', {}, 'Find out what actually helps your pain.'),
        h('p.reading', {}, 'Litmus helps you understand long-standing pain, explore the options people use for it, and test them properly — one at a time, switched on and off, so you can see what a thing does for you rather than guessing.'),
        card('sage', h('p.body', {}, 'Litmus is not a doctor and doesn’t diagnose anything. It helps you learn, measure and navigate, and gives you a clear record to take to the people who treat you.')),
        h('p.body', {}, 'A few questions first — about three minutes. Skip anything you’d rather not answer.'),
      ];
      break;
    case 'sites':
      body = [h('h1.display.md', {}, 'Where does it hurt?'), h('p.body', {}, 'Choose everywhere that applies.'), chips(SITES, d.sites)];
      break;
    case 'qualities':
      body = [h('h1.display.md', {}, 'What does it feel like?'),
        h('p.body', {}, 'The words people use for pain carry real information. There are no wrong answers.'),
        chips(QUALITIES, d.qualities),
        d.qualities.filter((q) => NERVE_QUALITIES.has(q)).length >= 2 && card('sage',
          h('p.body', {}, 'Burning, shooting, electric or pins-and-needles sensations are often linked with nerves being involved. Only an examination can say whether that’s the case for you — it’s worth mentioning to a clinician.'))];
      break;
    case 'history': {
      const years = h('input.field', { type: 'number', min: 0, max: 80, inputmode: 'numeric', placeholder: 'Years',
        value: d.yearsWithPain ?? '', oninput: (e) => { d.yearsWithPain = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0); } });
      body = [h('h1.display.md', {}, 'What you’ve been told, and tried'),
        h('p.label', {}, 'Roughly how long has it been?'), years,
        h('p.label', {}, 'Has a clinician given it a name?'),
        h('p.caption', {}, 'Only what you’ve actually been told. Litmus never adds to this.'),
        chips(DIAGNOSES.map((x) => [x, x]), d.diagnosesGiven),
        h('p.label', {}, 'Already tried, properly'),
        h('p.caption', {}, 'These move further down the list of things to test.'),
        chips(LIBRARY.map((i) => [i.id, i.displayName]), d.alreadyTried)];
      break;
    }
    case 'factors':
      body = [h('h1.display.md', {}, 'What else is going on?'),
        h('p.body', {}, 'Pain rarely travels alone. Sleep, stress and activity patterns all feed into it — and some of them can be tested directly.'),
        checks(FACTORS, d.factors)];
      break;
    case 'safety':
      body = [h('h1.display.md', {}, 'A quick safety check'),
        h('p.body', {}, 'Pain can occasionally be a sign of something that needs looking at first. Tick anything that applies.'),
        checks(RED_FLAGS.map(([id, l]) => [id, l]), d.redFlags),
        d.redFlags.length > 0 && card('clay',
          h('p.label', {}, RED_FLAGS.some(([id, , urgent]) => urgent && d.redFlags.includes(id)) ? 'Please get this looked at today' : 'Worth mentioning to a clinician'),
          h('p.body', {}, RED_FLAGS.some(([id, , urgent]) => urgent && d.redFlags.includes(id))
            ? 'New weakness, numbness, or a change in bladder or bowel control should be seen by a doctor today — urgent care or an emergency department if you can’t reach your own.'
            : 'None of these means something is wrong, but each is worth checking before starting anything new. Until then, Litmus keeps exercise and movement-based options off the top of your list.'))];
      break;
    default: {
      const wide = widespreadFeatureCount(d);
      body = [h('h1.display.md', {}, 'Here’s the picture so far'),
        card('', h('p.label', {}, 'How pain works'),
          h('p.body', {}, 'All pain is produced by the nervous system as a protective output — real, and not “in your head”. When pain lasts, the system can become more sensitive, so the amount of pain stops tracking the amount of damage. That’s why sleep, stress and activity move it, and why things that calm the system can help.')),
        wide >= 2 && card('sage', h('p.body', {}, 'Some of what you described — pain in several places, sleep, fatigue, sensitivity — is often discussed as the nervous system turning up its volume. That’s not a diagnosis, and only a clinician can say what’s going on for you. Sleep and pacing are among the things on the list you could test, if you want to.')),
        card('', h('p.label', {}, 'What happens next'),
          h('p.body', {}, 'For the next week or two, just score your pain once a day. That shows how much it moves on its own, which is what a fair test has to be measured against. Then you can choose one thing to test.'))];
    }
  }

  const last = ui.step === STEPS.length - 1;
  return h('div.stack', {},
    h('div.row', {}, ui.step > 0 ? h('button.link', { onclick: () => { ui.step--; render(); } }, '‹ Back') : h('span', { style: { width: '52px' } }),
      h('div.steps', {}, STEPS.map((_, i) => h(`span${i <= ui.step ? '.on' : ''}`)))),
    ui.step === 0 && guide('welcome', 'lg'),
    ...body,
    h('button.btn.primary', { onclick: async () => {
      if (!last) { ui.step++; render(); window.scrollTo(0, 0); return; }
      d.completedOnboarding = true;
      await store.saveProfile(d);
      ui.draft = null; ui.step = 0; ui.tab = 'today';
    } }, last ? 'Start my baseline' : ui.step === 0 ? 'Begin' : 'Continue'));
}

// ── today ─────────────────────────────────────────────────────────────────────────

function todayTab() {
  const active = store.activeRecords;
  if (store.isFinished) {
    return h('div.stack', {}, header(active.length > 1 ? 'Those trials are fully logged.' : 'This trial is finished.',
      'Every planned day has passed. The result is ready.'),
      h('button.btn.primary', { onclick: () => { ui.tab = 'result'; render(); } }, 'See the result'),
      symptomCheckIn());
  }

  const outcomes = store.todaysOutcomes;
  const pools = store.todaysPools();
  const logged = outcomes.some((o) => store.todayFor(o));
  const flareOn = logged ? !!store.today?.isFlare : !!ui.pendingFlare;

  let title, lead;
  if (!active.length && store.completed.length > 0) {
    title = 'Between trials';
    lead = 'Scoring still helps: it keeps your picture of an ordinary day current. Set up the next trial from the Trial tab whenever you’re ready.';
  } else if (!active.length) {
    title = `Day ${(store.baselineDay ?? 0) + 1} · nothing to change yet`;
    lead = 'Just score how today has been. This baseline shows how much your pain moves on its own.';
  } else if (!pools.length) {
    title = 'Your trial starts soon.';
  } else if (pools.length === 1) {
    const { record, day } = pools[0];
    const kind = phaseOnDay(record.trial, day).kind;
    const doing = conditionFor(record.trial, kind);
    const weekly = phaseOnDay(record.trial, day)?.length === 7;
    title = kind === 'washout' ? 'A quiet day between blocks.'
      : doing ? `${weekly ? 'A week' : 'A block'} on ${doing.displayName}.` : `An off ${weekly ? 'week' : 'block'}.`;
    lead = kind === 'washout' ? (isComparison(record.trial) ? 'Neither one today. Carry on as you were.' : 'Carry on as you were.')
      : kind === 'b' ? (record.trial.userNote || 'Do the thing you’re testing, as planned.')
      : doing ? `Do ${midSentence(doing.displayName)} this week, not ${midSentence(record.trial.conditionB.displayName)}.` : 'Nothing to do differently.';
  } else {
    title = `${pools.length} trials running`;
  }

  // Back after a gap: a warm word and nothing to catch up on. Never a count of what
  // was missed.
  const away = store.daysSinceLastLog;
  if (!logged && away != null && away >= 3) {
    title = 'Good to see you.';
    lead = 'The days in between are simply left out — there’s nothing to catch up on. Just today’s number, whenever you’re ready.';
  }

  const kids = [
    h('div.row', {}, guide(flareOn ? 'rest' : (!logged && away != null && away >= 3) ? 'welcome' : 'main'), h('p.label.sage', {}, active.length === 1 && pools.length
      ? `Day ${pools[0].day + 1} of ${plannedDays(pools[0].record.trial)}` : active.length ? 'Today' : 'Baseline')),
    h('h1.display', {}, title),
    lead && h('p.reading', {}, lead),
  ];

  // With several trials, one line each: what today is for that trial.
  if (pools.length > 1) {
    kids.push(card('', pools.map(({ record, day }) => {
      const kind = phaseOnDay(record.trial, day).kind;
      const what = conditionFor(record.trial, kind)?.displayName ?? (kind === 'a' ? 'Off' : 'Between blocks');
      return h('div.row.between', {}, h('span.body', { style: { color: 'var(--ink)' } }, trialName(record.trial)),
        h('span.caption', {}, `${what} · day ${day + 1} of ${plannedDays(record.trial)}`));
    })));
  }

  // Flare mode: a bad day asks for the number and nothing else. The rest waits behind
  // one optional link.
  const minimal = flareOn && !ui.flareMore;
  if (flareOn) {
    kids[1] = h('h1.display', {}, 'A hard day.');
    kids[2] = h('p.reading', {}, logged ? 'That’s all Litmus needs today. Everything else can wait.' : 'Just the number, whenever you can. Everything else can wait.');
  }
  outcomes.forEach((outcomeId, index) => kids.push(outcomeSection(outcomeId, index === 0, outcomes.length > 1, minimal)));

  if (outcomes.length) {
    kids.push(flareToggle(flareOn, async (on) => {
      if (logged) await store.setFlare(on);
      else { ui.pendingFlare = on; render(); }
    }));
    if (flareOn) kids.push(flarePlanCard());
  }

  if (logged && minimal) {
    kids.push(h('button.link', { onclick: () => { ui.flareMore = true; render(); } }, 'Add more for today (optional)'));
  } else if (logged) {
    // One question per trial on an "on" day. Named, rather than slotted into a
    // sentence: "did you do your heat" reads badly, and custom names can be anything.
    for (const pool of store.trialsAskingAdherence) {
      const trial = pool.record.trial;
      const doing = conditionFor(trial, phaseOnDay(trial, pool.day)?.kind);
      const answer = pool.list.find((e) => e.day === pool.day)?.adhered;
      kids.push(card('', h('p.label', {}, 'Did you do it today?'),
        h('p.body', { style: { color: 'var(--ink)' } }, doing.displayName),
        doing === trial.conditionB && trial.userNote && h('p.caption', {}, `Your plan: ${trial.userNote}`),
        h('div.row', {},
          h(`button.btn.outline${answer === true ? '.solid-on' : ''}`, { onclick: () => store.setAdherence(pool.record.id, true) }, 'Yes'),
          h(`button.btn.outline${answer === false ? '.solid-on' : ''}`, { onclick: () => store.setAdherence(pool.record.id, false) }, 'Not today')),
        h('p.caption', {}, 'An honest “not today” keeps the result accurate.')));
    }
    const note = h('textarea.field', { placeholder: 'A note for today (optional)', rows: 2 }, store.today?.note ?? '');
    note.addEventListener('change', () => { checkForCrisis(note.value); store.setNote(note.value); });
    kids.push(note);
    kids.push(symptomCheckIn());
  }

  kids.push(h('p.caption.center', {}, 'Some days are too much to log. That’s fine — a missed day is simply left out.'));
  return h('div.stack', {}, kids);
}

// One measure's question, or what was logged for it and a way to add to it.
function outcomeSection(outcomeId, prominent, named = false, minimal = false) {
  const outcome = OUTCOMES[outcomeId];
  const today = store.todayFor(outcomeId);
  const log = async (v) => {
    await store.log(v, outcomeId);
    if (ui.pendingFlare) { ui.pendingFlare = false; await store.setFlare(true); }
  };
  if (!today) return card('', h('p.label', {}, outcome.prompt), scoreScale(null, outcome, log));
  // Sleep is one night, one score: there is nothing to average.
  const single = outcomeId === 'sleep.quality-nrs-11';

  let adding = false;
  const more = h('div');
  const drawMore = () => {
    more.replaceChildren(adding
      ? h('div.stack.tight', {}, h('p.label', {}, 'Another reading'),
          scoreScale(null, outcome, async (v) => { await store.addReading(v, outcomeId); toast('Added. Today’s score is the average.'); }),
          h('button.link', { onclick: () => { adding = false; drawMore(); } }, 'Cancel'))
      : h('button.btn.outline', { onclick: () => { adding = true; drawMore(); } }, '+ Add another reading'));
  };
  drawMore();
  if (single) {
    return card('',
      h('div.row.between', {}, h('p.label', {}, named ? outcome.displayName : 'Logged today'),
        h('button.link', { style: { padding: 0 }, onclick: () => store.clearToday(outcomeId) }, 'Change')),
      h('div.row', { style: { alignItems: 'baseline' } }, h('span.number', {}, fmt(today.score, 0)), h('span.muted', {}, 'out of 10')));
  }
  return card('',
    h('div.row.between', {}, h('p.label', {}, named ? outcome.displayName : 'Logged today'),
      h('button.link', { style: { padding: 0 }, onclick: () => store.clearToday(outcomeId) }, 'Change')),
    h('div.row', { style: { alignItems: 'baseline' } }, h('span.number', {}, fmt(today.score, today.sampleCount > 1 ? 1 : 0)), h('span.muted', {}, 'out of 10')),
    !minimal && h('p.caption', {}, today.sampleCount > 1
      ? `Average of ${plural(today.sampleCount, 'reading')} today.`
      : 'One reading so far. It moves through the day — add more whenever you like, and the day’s score becomes their average.'),
    !minimal && more);
}

// Optional scores for whatever else someone chose to watch.
function symptomCheckIn() {
  const tracked = store.trackedSymptoms;
  return card('',
    h('div.row.between', {}, h('p.label', {}, 'Symptoms today'),
      h('button.link', { style: { padding: 0 }, onclick: () => openSheet('symptoms') }, tracked.length ? 'Edit' : 'Add')),
    tracked.length === 0
      ? h('p.body', {}, 'Track anything else alongside pain — sleep, fatigue, a side effect you’re watching. Optional, and only if it’s useful.')
      : [tracked.map((x) => {
          const score = store.symptomScore(x.id);
          return h('div.stack', { style: { gap: '8px' } },
            h('div.row.between', {}, h('span', { style: { fontWeight: 500 } }, x.name), score != null && h('span.muted', {}, score)),
            compactScale(score, (v) => store.setSymptomScore(x.id, v), x.name));
        }), h('p.caption', {}, '0 is none, 10 is severe.')]);
}

function compactScale(selected, onPick, name) {
  return h('div', { class: 'compact', role: 'group', 'aria-label': name },
    Array.from({ length: 11 }, (_, v) => h(`button${selected === v ? '.on' : ''}`, {
      style: selected === v ? {} : { background: painColor(v), color: isDark() ? '#ECE4D9' : v >= 8 ? '#FBF7F0' : '#5E564E' },
      'aria-label': `${v} out of 10`, 'aria-pressed': String(selected === v),
      onclick: () => { haptic(); onPick(v); },
    }, v)));
}

// ── trial tab ────────────────────────────────────────────────────────────────────

function trialTab() {
  const trial = store.trial;
  if (!trial) return baselineStatus();
  const a = store.analysis();
  const overlapping = a?.overlappingTrials ?? 0;
  const day = store.currentDay;
  const logged = store.entries.length;
  const elapsed = store.elapsedDays;
  const loggedToday = day != null && store.entries.some((e) => e.day === day);
  const missed = Math.max(0, elapsed - logged - (loggedToday || day == null ? 0 : 1));
  const blocks = trial.phases.filter((p) => p.kind !== 'washout');
  const doneBlocks = blocks.filter((p) => p.startDay + p.length <= (day ?? plannedDays(trial))).length;

  return h('div.stack', {},
    trialSwitcher(),
    header(isComparison(trial) ? `${trial.conditionB.displayName} or ${midSentence(trial.conditionA.displayName)}?` : trial.conditionB.displayName,
      isComparison(trial) ? `Comparing their effect on ${OUTCOMES[trial.outcomeId].displayName.toLowerCase()}.` : `Testing its effect on ${OUTCOMES[trial.outcomeId].displayName.toLowerCase()}.`),
    card('', h('div.row.between', {},
        h('div', {}, h('div.number', {}, elapsed), h('p.caption', {}, `of ${plannedDays(trial)} days`)),
        h('div', {}, h('div.number', {}, logged), h('p.caption', {}, 'logged')),
        h('div', {}, h('div.number', {}, `${doneBlocks}/${blocks.length}`), h('p.caption', {}, blocks[0]?.length === 7 ? 'weeks done' : 'blocks done'))),
      missed > 0 && h('p.caption', {}, 'Some days have been missed — that’s normal and already accounted for.')),
    card('', h('p.label', {}, 'Your scores'), trace(store.entries, trial, { today: day }), traceLegend(trial)),
    card('', h('p.label', {}, 'The order'),
      h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${blocks.length}, minmax(0, 1fr))`, gap: '4px' } }, blocks.map((p) => {
        const past = p.startDay + p.length <= (day ?? Infinity);
        const now = day != null && day >= p.startDay && day < p.startDay + p.length;
        return h('span', { style: {
          height: '30px', borderRadius: '8px', display: 'grid', placeItems: 'center', fontSize: '11px', color: 'var(--ink-soft)',
          background: p.kind === 'b' ? 'var(--band-on)' : 'var(--band-off)',
          outline: now ? '2px solid var(--ink)' : 'none', opacity: past || now ? 1 : 0.55,
        } }, isComparison(trial) ? (p.kind === 'b' ? 'B' : 'A') : p.kind === 'b' ? 'On' : 'Off');
      })),
      isComparison(trial) && h('p.caption', {}, `B is ${midSentence(trial.conditionB.displayName)}, A is ${midSentence(trial.conditionA.displayName)}.`),
      h('p.caption', {}, 'Randomised, so a good or bad stretch can’t line up with the thing being tested.')),
    a && a.verdict.reason !== 'insufficientData' && a.verdict.reason !== 'tooFewCompletedBlocks' && Number.isFinite(a.low) && card('sage',
      h('p.label.sage', {}, 'Precision so far'),
      h('p.body', {}, `Right now the estimate is good to within about ±${fmt((a.high - a.low) / 2)} points. It tightens as more weeks finish.`)),
    overlapping > 0 && card('clay', h('p.label', { style: { color: 'var(--clay)' } }, 'Running alongside others'),
      h('p.body', {}, `${overlapping === 1 ? 'One other trial overlaps' : `${overlapping} other trials overlap`} this one. Each is accounted for in the result, and each costs some precision: with more running at once, a real change is more likely to be missed. Interactions between them can’t be ruled out.`)),
    h('button.btn.outline', { onclick: () => openSheet('setup') }, 'Start another trial alongside'),
    h('button.link', { onclick: () => openSheet('endTrial') }, store.focusedIsFinished ? 'Close this trial' : 'End this trial early'));
}

// Picks which running trial the Trial and Result tabs describe. Hidden with only one.
function trialSwitcher() {
  const active = store.activeRecords;
  if (active.length < 2) return null;
  return h('div.chips', { role: 'tablist', style: { flexWrap: 'nowrap', overflowX: 'auto', marginRight: '-22px', paddingRight: '22px' } },
    active.map((r) => h(`button.chip${r.id === store.running.id ? '.on' : ''}`, {
      role: 'tab', 'aria-selected': String(r.id === store.running.id), style: { whiteSpace: 'nowrap' },
      onclick: () => store.focus(r.id),
    }, trialName(r.trial))));
}

function baselineStatus() {
  const base = store.person.baseline;
  const sd = store.baselineVariability;
  const target = BASELINE_SUGGESTED_DAYS;
  return h('div.stack', {},
    store.completed.length > 0
      ? header('Ready for the next one', 'Your daily scores carry on from here. Choose something new to test whenever you like.')
      : header('Your baseline', 'Before testing anything, a week or two of ordinary days shows how much your pain moves by itself.'),
    card('', h('div.row', { style: { alignItems: 'baseline' } }, h('span.number', {}, base.length), h('span.muted', {}, `of ${target} days scored`)),
      h('div.row', { style: { gap: '4px', flexWrap: 'wrap' } }, Array.from({ length: Math.max(target, base.length) }, (_, d) => {
        const e = base.find((x) => x.day === d);
        return h('span', { style: { width: '16px', height: '16px', borderRadius: '5px',
          background: e ? painColor(e.score) : 'transparent', border: '1px solid var(--line)' } });
      }))),
    base.length >= 3 && card('', h('p.label', {}, 'So far'), trace(base, null), traceLegend(null)),
    sd != null
      ? card('sage', h('p.label.sage', {}, 'Ready when you are'),
          h('p.body', {}, `Your scores move by about ${fmt(sd)} points from day to day. A standard trial could reliably pick up a change of about ${fmt(detectableEffect(sd, 0.5, TRIAL_DEFAULTS.blockCount, TRIAL_DEFAULTS.blockDays))} points.`))
      : h('p.body', {}, `Keep scoring. After ${plural(Math.max(0, BASELINE_MIN_DAYS - base.length), 'more day')} the trial can be sized to your own variability.`),
    h('button.btn.primary', { onclick: () => openSheet('setup') }, 'Set up a trial'),
    h('p.caption', {}, 'Keep logging as long as you like — more baseline only sharpens it.'));
}

function setupSheet() {
  const profile = store.profile;
  // Testing the same thing twice at once would compare it with itself.
  const running = new Set(store.activeRecords.flatMap((r) => (isComparison(r.trial) ? [r.trial.conditionB.id, r.trial.conditionA.id] : [r.trial.conditionB.id])));
  const menu = suggestedOrder(profile).filter((i) => !running.has(i.id));
  const hidden = LIBRARY.filter((i) => !menu.includes(i) && !running.has(i.id));
  const overlaps = store.overlapsForNewTrial;
  const overlapCost = store.overlapCostForNewTrial;
  const blocks = blockCountForOverlaps(overlapCost);
  const shape = { ...TRIAL_DEFAULTS, blockCount: blocks, blockDays: ui.setup?.blockDays ?? TRIAL_DEFAULTS.blockDays, washoutDays: ui.setup?.washoutDays ?? TRIAL_DEFAULTS.washoutDays };
  const total = trialLength(shape);
  const st = ui.setup ??= { pick: menu[0]?.id ?? 'custom', custom: '', outcomeId: PAIN_ID, note: '', against: 'usual' };
  // The baseline only scores pain, so its variability only sizes pain trials.
  const sd = st.outcomeId === PAIN_ID ? store.baselineVariability : null;
  const chosen = st.pick === 'custom' ? (st.custom.trim() ? customIntervention(st.custom.trim()) : null) : LIBRARY.find((i) => i.id === st.pick);
  // Comparing with a second option instead of usual care. Only from the library, and
  // never the same thing twice.
  if (st.against === st.pick) st.against = 'usual';
  const comparator = st.against === 'usual' ? null : menu.find((i) => i.id === st.against) ?? null;
  const outcome = OUTCOMES[st.outcomeId];
  const detect = detectableEffect(sd ?? 1.5, 0.5, blocks, shape.blockDays, outcome, overlapCost);
  // A block length sized to this person's own variability, when there's a baseline to size it from.
  const suggested = sd != null && outcome.important != null ? plan(sd, 0.5, outcome.important, outcome, shape.washoutDays) : null;

  const option = (i) => h(`button.check${st.pick === i.id ? '.on' : ''}`, { onclick: () => { st.pick = i.id; render(); } },
    h('span.box', {}, st.pick === i.id ? '✓' : ''),
    h('div.grow', {}, h('div', { style: { fontSize: '16px' } }, i.displayName),
      st.pick === i.id && h('p.caption', { style: { marginTop: '6px' } }, i.evidenceNote),
      st.pick === i.id && h('p.caption', { style: { marginTop: '4px' } }, `Source: ${i.evidenceSource}.`),
      st.pick === i.id && i.trialTip && h('p.caption', { style: { marginTop: '4px', color: 'var(--ink-soft)' } }, `A fair test: ${i.trialTip}`)));

  const customField = h('input.field', { placeholder: 'Name it', value: st.custom, oninput: (e) => { st.custom = e.target.value; start.disabled = !e.target.value.trim(); } });
  const noteField = h('textarea.field', { placeholder: 'What exactly will you do? e.g. “20 minutes of heat, evenings”', rows: 2, oninput: (e) => { st.note = e.target.value; } }, st.note);
  const start = h('button.btn.primary', { disabled: !chosen, onclick: async () => {
    const pick = st.pick === 'custom' ? customIntervention(st.custom.trim()) : chosen;
    await store.startTrial({ intervention: pick, comparator, outcomeId: st.outcomeId, note: st.note.trim() || null, blockDays: shape.blockDays, washoutDays: shape.washoutDays });
    ui.setup = null; ui.sheet = null; ui.tab = 'today';
    checkForCrisis(`${st.custom} ${st.note}`);
    render();
    toast('Trial started. Today is day 1.');
  } }, 'Start the trial today');

  return [
    h('p.reading', {}, 'Choose one thing to test. The list is the same for everyone; it’s ordered by what you told Litmus, and nothing on it is a recommendation.'),
    profile.redFlags.length > 0 && card('clay', h('p.body', {}, 'Because of your safety answers, exercise and movement-based options are held back until a clinician has had a look.')),
    h('div.stack.tight', {}, menu.map(option),
      hidden.length > 0 && h('p.caption', {}, `Not shown: ${hidden.map((i) => i.displayName).join(', ')}.`),
      h(`button.check${st.pick === 'custom' ? '.on' : ''}`, { onclick: () => { st.pick = 'custom'; render(); } },
        h('span.box', {}, st.pick === 'custom' ? '✓' : ''), h('div', { style: { fontSize: '16px' } }, 'Something else')),
      st.pick === 'custom' && customField),
    h('p.label', {}, 'Compared with'),
    h('div.chips', {}, [['usual', 'Nothing different'], ...menu.filter((i) => i.id !== st.pick).map((i) => [i.id, i.displayName])]
      .map(([id, label]) => h(`button.chip${st.against === id ? '.on' : ''}`, { 'aria-pressed': String(st.against === id), onclick: () => { st.against = id; render(); } }, label))),
    h('p.caption', {}, comparator
      ? `Weeks of ${(chosen ? midSentence(chosen.displayName) : 'your choice')} alternate with weeks of ${midSentence(comparator.displayName)}, in a random order. The result says which did more for you, if either.`
      : 'The usual test: weeks on, weeks off. Choose a second option instead to find out which of two things works better for you.'),
    h('p.label', {}, 'Measured by'),
    h('div.stack.tight', {}, Object.values(OUTCOMES).map((o) => h(`button.check${st.outcomeId === o.id ? '.on' : ''}`, { onclick: () => { st.outcomeId = o.id; render(); } },
      h('span.box', {}, st.outcomeId === o.id ? '✓' : ''), h('div', { style: { fontSize: '16px' } }, o.displayName)))),
    h('p.label', {}, 'Your plan'), noteField,
    overlaps > 0 && card('clay', h('p.label', { style: { color: 'var(--clay)' } }, 'Running alongside other trials'),
      h('p.body', {}, `${overlaps === 1 ? 'One trial is already running. Its' : `${overlaps} trials are already running. Their`} on and off weeks will be accounted for, but every trial running at once makes each answer less precise — this one and ${overlaps === 1 ? 'the one' : 'the ones'} already going. A real change becomes easier to miss, and if two things interact that can’t be untangled.`),
      blocks > 10 && h('p.caption', {}, `To make up for some of that, this trial alternates over ${blocks} weeks instead of the usual 10.`)),
    // One card per trial this one would leave without enough weeks for an answer.
    ...store.trialsStarvedBy(comparator != null).map((r) => {
      const name = isComparison(r.trial) ? `${r.trial.conditionB.displayName} or ${r.trial.conditionA.displayName}` : r.trial.conditionB.displayName;
      return card('clay', h('p.body', {}, `Running this alongside ${name} would leave ${name} too few weeks to reach an answer, because it would have to account for one more trial. Starting this once ${name} has finished avoids that.`));
    }),
    h('p.label', {}, 'Length'),
    h('p.caption', {}, 'Days in each block'),
    h('div.chips', {}, [5, 7, 10, 14].map((d) => h(`button.chip${shape.blockDays === d ? '.on' : ''}`, { 'aria-pressed': String(shape.blockDays === d), onclick: () => { st.blockDays = d; render(); } }, `${d} days`))),
    h('p.caption', {}, 'Quiet days between blocks, so one block’s effect can fade before the next'),
    h('div.chips', {}, [0, 2, 3, 5].map((d) => h(`button.chip${shape.washoutDays === d ? '.on' : ''}`, { 'aria-pressed': String(shape.washoutDays === d), onclick: () => { st.washoutDays = d; render(); } }, d === 0 ? 'None' : `${d} days`))),
    suggested && h('p.caption', {}, `Suggested for your scores: ${suggested.blockDays}-day blocks. `,
      (suggested.blockDays !== shape.blockDays) && h('button.link', { style: { padding: 0 }, onclick: () => { st.blockDays = suggested.blockDays; render(); } }, 'Use that')),
    shape.blockDays < 7 && h('p.caption', {}, 'Blocks shorter than a week can be swayed by one unusual day, and the result will flag it.'),
    card(outcome.important != null && detect > outcome.important ? 'clay' : 'sage', h('p.label.sage', {}, 'What this trial can see'),
      h('p.body', {}, `${blocks} alternating blocks of ${plural(shape.blockDays, 'day')}, ${comparator ? 'one then the other' : 'on and off'} in a random order, with ${plural(shape.washoutDays, 'quiet day')} between each — ${total} days in all. ${sd != null ? 'With how much your scores move' : 'For typical day-to-day variation'}, it could reliably detect a change of about ${fmt(detect)} points${outcome.important != null ? `; a change worth caring about is around ${fmt(outcome.important, 0)}` : ''}.${outcome.important != null && detect > outcome.important ? ' A real change smaller than that could be missed — the result will say so if it is.' : ''}`),
      sd == null && h('p.caption', {}, st.outcomeId === PAIN_ID ? `Finish at least ${BASELINE_MIN_DAYS} baseline days and this becomes a number about you.` : 'Your baseline scores pain only, so this uses typical day-to-day variation for this measure.')),
    start,
  ];
}

// ── result tab ───────────────────────────────────────────────────────────────────

function resultBlock(a, record) {
  const trial = a.trial;
  const ready = !(a.verdict.kind === 'inconclusive' && ['insufficientData', 'tooFewCompletedBlocks'].includes(a.verdict.reason));
  const rerun = rerunSuggestion(a);
  const span = 5;
  const pos = (v) => `${Math.max(0, Math.min(100, ((v + span) / (2 * span)) * 100))}%`;
  // Left of centre is a lower score. In a comparison, name who that favours.
  const [bName, aName] = [trial.conditionB.displayName, trial.conditionA.displayName];
  const better = isComparison(trial) ? `${a.outcome.lowerIsBetter ? bName : aName} better` : a.outcome.lowerIsBetter ? 'Better' : 'Worse';
  const worse = isComparison(trial) ? `${a.outcome.lowerIsBetter ? aName : bName} better` : a.outcome.lowerIsBetter ? 'Worse' : 'Better';

  return h('div.stack', {},
    h('div.row', {}, guide(a.verdict.kind === 'inconclusive' ? 'think' : 'main'),
      h('p.label.sage', {}, trialName(trial))),
    h('h1.display', {}, resultTitle(a)),
    h('p.reading', {}, headline(a)),
    ready && Number.isFinite(a.low) && card('',
      h('p.label', {}, 'The likely range of the real effect'),
      h('div', { style: { position: 'relative', height: '40px' } },
        h('div', { style: { position: 'absolute', top: '19px', left: 0, right: 0, height: '2px', background: 'var(--line)' } }),
        h('div', { style: { position: 'absolute', top: '10px', bottom: '10px', left: pos(-a.thresholds.trivial), width: `calc(${pos(a.thresholds.trivial)} - ${pos(-a.thresholds.trivial)})`, background: 'var(--band-wash)', borderRadius: '4px' } }),
        h('div', { style: { position: 'absolute', top: '14px', height: '12px', left: pos(a.low), width: `calc(${pos(a.high)} - ${pos(a.low)})`, background: 'var(--sage)', borderRadius: '6px', opacity: 0.55 } }),
        h('div', { style: { position: 'absolute', top: '10px', height: '20px', width: '3px', left: `calc(${pos(a.effect)} - 1px)`, background: 'var(--ink)', borderRadius: '2px' } })),
      h('div.row.between.caption', {}, h('span', {}, `← ${better}`), h('span', {}, isComparison(trial) ? 'No difference' : 'No change'), h('span', {}, `${worse} →`)),
      h('p.caption', {}, `Best estimate ${a.effect > 0 ? '+' : ''}${fmt(a.effect)} points; 95% range ${fmt(a.low)} to ${fmt(a.high)}. The shaded middle is too small to matter.`)),
    rerun && card('sage', h('p.label.sage', {}, 'Next'), h('p.body', {}, rerun),
      record.finishedOn && !['insufficientData', 'tooFewCompletedBlocks', 'underpowered'].includes(a.verdict.reason)
        && h('button.btn.outline', { onclick: () => setUpRerun(a) }, 'Set up this rerun')),
    card('', h('p.label', {}, 'Scores'), trace(record.entries, trial, { today: record.finishedOn ? null : store.currentDay }), traceLegend(trial)),
    ready && a.threats.length > 0 && card('', h('p.label', {}, 'Worth knowing'), a.threats.map((t) => h('p.body', {}, describeThreat(t)))),
    h('button.btn.outline', { onclick: () => openSheet('clinician', { a, finishedOn: record.finishedOn }) }, 'Summary for a clinician'));
}

// Opens trial setup filled in with the same question and a length sized to the result.
function setUpRerun(a) {
  const t = a.trial;
  const p = plan(Math.max(a.a.standardDeviation, a.b.standardDeviation), a.rho, a.thresholds.important, a.outcome);
  const known = LIBRARY.some((i) => i.id === t.conditionB.id);
  ui.setup = {
    pick: known ? t.conditionB.id : 'custom', custom: known ? '' : t.conditionB.displayName,
    outcomeId: t.outcomeId, note: t.userNote ?? '',
    against: isComparison(t) ? t.conditionA.id : 'usual',
    blockDays: p.blockDays, washoutDays: p.washoutDays,
  };
  ui.sheet = { kind: 'setup' };
  render();
}

function resultTab() {
  const running = store.running;
  const a = running ? store.analysis(running) : null;
  const history = store.completed.slice().reverse();
  return h('div.stack', {},
    trialSwitcher(),
    a ? resultBlock(a, running)
      : header('No result yet', running ? 'Keep logging — the first comparison appears once a few weeks have finished.'
        : history.length ? 'Nothing running right now. Your earlier results are below.' : 'Results appear here once a trial is running.'),
    running && store.focusedIsFinished && h('button.btn.primary', { onclick: () => openSheet('endTrial') }, 'Close this trial and keep the result'),
    (running || history.length > 0) && h('button.btn.outline', { onclick: () => openSheet('record') }, 'Care record for your next appointment'),
    history.length > 0 && h('div.stack.tight', {}, h('p.label', {}, 'Earlier trials'),
      history.map((r) => {
        const ra = store.analysis(r);
        return h('button.check', { onclick: () => openSheet('past', { record: r }) },
          h('div.grow', {}, h('div', { style: { fontSize: '16px' } }, trialName(r.trial)),
            h('p.caption', {}, `${r.endedEarly ? 'Ended early' : 'Finished'} ${new Date(r.finishedOn).toLocaleDateString()} · ${shortVerdict(ra)}`)),
          h('span.muted', {}, '›'));
      })));
}

// ── practice ─────────────────────────────────────────────────────────────────────

function practiceTab() {
  const planned = Object.values(store.flarePlan).some(Boolean);
  return h('div.stack', {},
    header('Learn', 'How pain works, in short reads. Then a few guided pauses for the harder minutes.'),
    h('div.stack.tight', {}, LESSONS.map((l) => h('button.check', { onclick: () => openSheet('lesson', { id: l.id }) },
      h('div.grow', {}, h('div', { style: { fontSize: '16px' } }, l.title), h('p.caption', {}, `${l.minutes} min read`)),
      h('span.muted', {}, '›')))),
    h('button.check', { onclick: () => openSheet('library') },
      h('div.grow', {}, h('div', { style: { fontSize: '16px' } }, 'Things people test'), h('p.caption', {}, 'What the evidence says about each, and what a fair test looks like')),
      h('span.muted', {}, '›')),
    card('sage', h('p.label', {}, 'Your flare plan'),
      h('p.body', {}, planned ? 'Written and ready. It appears on Today whenever you mark a flare.' : 'A short note to yourself for the hard days, written on an easier one.'),
      h('button.btn.outline', { onclick: () => openSheet('flarePlan') }, planned ? 'Look at it' : 'Write it')),
    h('p.label', {}, 'Practice'),
    PRACTICES.map((p) => card('',
      h('div.row.between', {}, h('h2', { style: { margin: 0, fontSize: '18px', fontWeight: 600 } }, p.title), h('span.caption', {}, p.subtitle)),
      h('p.body', {}, p.note),
      h('button.btn.primary', { onclick: () => play(p) }, 'Begin'))),
    card('', h('p.label', {}, 'People who can help'),
      SUPPORT.map(([name, text, href]) => h('div', {},
        h('div', { style: { fontWeight: 500 } }, href ? h('a', { href, target: '_blank', rel: 'noopener' }, name) : name),
        h('p.caption', {}, text))),
      h('p.caption', {}, 'If things feel unbearable right now:'),
      ...crisisLinks()));
}

function lessonSheet(id) {
  const l = LESSONS.find((x) => x.id === id);
  if (!l) return [];
  return [
    ...l.paras.map((t) => h('p.reading', {}, t)),
    l.action === 'flarePlan' && h('button.btn.primary', { onclick: () => openSheet('flarePlan') }, 'Write my flare plan'),
    l.action === 'record' && h('button.btn.primary', { onclick: () => openSheet('record') }, 'Open my care record'),
    h('p.caption', {}, `Source: ${l.source}. General education, not advice about your own care.`),
  ];
}

const FLARE_FIELDS = [
  ['signs', 'Early signs a flare is starting', 'e.g. stiffer in the morning, sleep slipping'],
  ['helps', 'What usually helps', 'e.g. heat, a short walk, lying on my side'],
  ['drop', 'What I can safely drop for a few days', 'e.g. cooking from scratch, the gym'],
  ['tell', 'Who to tell, and what I need from them', 'e.g. my partner — to take the school run'],
];

function flarePlanSheet() {
  const plan = store.flarePlan;
  return [
    h('p.body', {}, 'Written on a calmer day, for a harder one. Keep it short — you’ll be reading it when thinking is difficult.'),
    ...FLARE_FIELDS.map(([key, label, hint]) => {
      const area = h('textarea.field', { placeholder: hint, rows: 2, 'aria-label': label }, plan[key] ?? '');
      area.addEventListener('change', () => { checkForCrisis(area.value); store.setFlarePlan(key, area.value); });
      return h('div.stack.tight', {}, h('p.label', {}, label), area);
    }),
    h('p.caption', {}, 'Saved as you go, on this device.'),
  ];
}

function flarePlanCard() {
  const plan = store.flarePlan;
  const rows = FLARE_FIELDS.filter(([key]) => plan[key]);
  if (!rows.length) return null;
  return card('sage', h('p.label', {}, 'Your flare plan'),
    rows.map(([key, label]) => h('div', {}, h('p.caption', {}, label), h('p.body', { style: { color: 'var(--ink)' } }, plan[key]))),
    h('p.caption', {}, 'Be gentle with yourself today. A flare is a hard day, not a setback in the trial.'));
}

function play(p) {
  let i = 0, elapsed = 0, timer = null, paused = false;
  const total = p.steps.reduce((x, st) => x + st[1], 0);
  const words = h('p.words', {}, p.steps[0][0]);
  const fill = h('i', { style: { width: '0%' } });
  const pauseBtn = h('button.btn.outline', { onclick: () => { paused = !paused; pauseBtn.textContent = paused ? 'Resume' : 'Pause'; } }, 'Pause');
  const close = () => { clearInterval(timer); overlay.remove(); try { lock?.release(); } catch {} };
  const overlay = h('div.player', { role: 'dialog', 'aria-label': p.title },
    h('div.row.between', {}, h('p.label', {}, p.title), h('button.link', { onclick: close }, 'Done')),
    h('div.grow', { style: { display: 'grid', placeItems: 'center' } }, h('div.stack', { style: { alignItems: 'center' } }, presence('lg'), words)),
    h('div.stack.tight', {}, h('div.bar', {}, fill), pauseBtn));
  document.body.append(overlay);
  let lock = null;
  navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
  let stepLeft = p.steps[0][1];
  timer = setInterval(() => {
    if (paused) return;
    elapsed++; stepLeft--;
    fill.style.width = `${Math.min(100, (elapsed / total) * 100)}%`;
    if (stepLeft <= 0) {
      i++;
      if (i >= p.steps.length) { clearInterval(timer); pauseBtn.remove(); return; }
      stepLeft = p.steps[i][1];
      words.style.opacity = 0;
      setTimeout(() => { words.textContent = p.steps[i][0]; words.style.opacity = 1; }, 450);
    }
  }, 1000);
}

// ── more ─────────────────────────────────────────────────────────────────────────

function crisisLinks() {
  const line = crisisLine();
  return [
    h('a.btn.primary', { href: line.href, style: { textDecoration: 'none' }, ...(line.href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {}) }, line.label),
    h('p.caption', {}, 'US & Canada: call or text 988. UK & Ireland: Samaritans on 116 123. Australia: Lifeline on 13 11 14. Elsewhere: ', h('a', { href: 'https://findahelpline.com', target: '_blank', rel: 'noopener' }, 'findahelpline.com'), '. In an emergency, call your local emergency number.'),
  ];
}

// Shown when something written reads like a crisis. Once per piece of text, so editing
// the same note doesn't bring it back each time.
let lastCrisisText = null;
function checkForCrisis(text) {
  if (!mentionsCrisis(text) || text === lastCrisisText) return;
  lastCrisisText = text;
  ui.sheet = { kind: 'support' };
  ui.crisisAt = Date.now();
  return true;
}

// Reminder times are a setting of this device rather than of a profile.
const REMINDER_KEY = 'litmus.reminders';
function savedReminderTimes() {
  try { const t = JSON.parse(localStorage.getItem(REMINDER_KEY)); if (Array.isArray(t) && t.length) return t; } catch {}
  return null;
}

function remindersSheet() {
  const saved = savedReminderTimes();
  const times = (saved ?? ['20:00']).slice();
  const list = h('div.stack.tight');
  const draw = () => list.replaceChildren(...times.map((t, i) => h('div.row', {},
    h('input.field', { type: 'time', value: t, 'aria-label': `Reminder ${i + 1}`, onchange: (e) => { times[i] = e.target.value; } }),
    times.length > 1 && h('button.link', { onclick: () => { times.splice(i, 1); draw(); } }, 'Remove'))),
    times.length < 3 && h('button.link', { onclick: () => { times.push('12:00'); draw(); } }, 'Add another time'));
  draw();
  const add = async () => {
    const valid = times.filter((t) => parseTime(t));
    if (!valid.length) { toast('Choose a time first.'); return; }
    // ?log opens straight to today's score.
    const url = new URL('./?log', location.href).href;
    const file = new File([reminderCalendar(valid, { url })], 'litmus-reminder.ics', { type: 'text/calendar' });
    const a = h('a', { href: URL.createObjectURL(file), download: file.name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    try { localStorage.setItem(REMINDER_KEY, JSON.stringify(valid)); } catch {}
    toast('Open the file to add it to your calendar.');
  };
  return [
    h('p.body', {}, 'A web app can’t send notifications on iPhone, so Litmus adds a repeating event to your calendar instead. Its alert is the reminder, and the link in it opens Litmus.'),
    list,
    h('button.btn.primary', { onclick: add }, 'Add to calendar'),
    h('p.caption', {}, 'On iPhone, open the downloaded file and choose Add All. To stop the reminders, delete the event in Calendar.'),
    h('p.caption', {}, 'If you added Litmus to your Home Screen, open it from there when the alert comes. The link in the event opens Safari, which keeps its own separate copy of your data.'),
    saved && h('p.caption', {}, `Last added: ${saved.join(', ')}.`),
  ];
}

// Backups go through the share sheet, where iOS offers "Save to Files" and so iCloud
// Drive. Where sharing a file isn't supported, it downloads instead.
async function backUp() {
  const name = `litmus-${store.person.name.toLowerCase().replace(/\W+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
  const text = store.exportText();
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Litmus backup' });
      await store.markBackedUp();
      toast('Backed up.');
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }
  const a = h('a', { href: URL.createObjectURL(file), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  await store.markBackedUp();
}

function backupNudge() {
  const days = store.daysSinceBackup;
  return card('clay', h('p.label', { style: { color: 'var(--clay)' } }, 'Time for a backup'),
    h('p.body', {}, days == null
      ? 'Your history only lives in this browser. Save a copy to iCloud Drive so a lost or reset phone doesn’t take it with it.'
      : `It’s been ${plural(days, 'day')} since your last backup.`),
    h('button.btn.primary', { onclick: backUp }, 'Back up now'));
}

function moreTab() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const days = store.daysSinceBackup;
  const row = (label, sheet, count) => h('button.check', { onclick: () => openSheet(sheet) },
    h('div.grow', {}, h('div', { style: { fontSize: '16px' } }, label), count && h('p.caption', {}, count)),
    h('span.muted', {}, '›'));
  return h('div.stack', {},
    header('More'),
    card('clay', h('p.label', {}, 'If you’re struggling right now'),
      h('p.body', {}, 'Pain that doesn’t let up can be exhausting in ways that are hard to explain. If you’re thinking about harming yourself, please reach out now.'),
      ...crisisLinks()),
    store.backupIsDue && backupNudge(),
    h('div.stack.tight', {},
      h('p.label', {}, 'Tracking'),
      row('Symptoms you track', 'symptoms', store.trackedSymptoms.length ? store.trackedSymptoms.map((x) => x.name).join(', ') : null),
      row('Medications', 'medications', store.medications.length ? plural(store.medications.length, 'medication') : null),
      row('Daily reminder', 'reminders', savedReminderTimes()?.join(', ') ?? null)),
    h('div.stack.tight', {},
      h('p.label', {}, 'Yours'),
      row('Care record for appointments', 'record', 'Everything tried and ruled out, on one page'),
      row('Journal', 'journal', store.journal.length ? plural(store.journal.length, 'entry', 'entries') : 'Private, and never part of a trial'),
      labsOn() && row('Community (preview)', 'community', 'Shared results — only on this device for now')),
    card('', h('p.label', {}, 'Labs'),
      h('p.body', {}, 'The community is designed but has no server yet. Turn on the preview to try it: everything stays on this device and no one else can see it.'),
      h(`button.btn.outline${labsOn() ? '.on' : ''}`, { 'aria-pressed': String(labsOn()), onclick: () => { setLabs(!labsOn()); render(); } },
        labsOn() ? 'Community preview is on' : 'Turn on the community preview')),
    card('', h('p.label', {}, 'Your data'),
      h('p.body', {}, 'Everything is stored in this browser on this device, and nowhere else. Back up regularly: if the phone is reset or lost, a backup is how you get your history back. It’s the same file the iPhone app reads, so it also moves you between the two.'),
      !standalone && h('p.caption', {}, 'Tip: in Safari, Share → Add to Home Screen. An installed web app keeps its data more reliably than a browser tab.'),
      !store.persisted && h('p.caption', {}, 'This browser hasn’t promised to keep the data under storage pressure, so regular backups matter more.'),
      h('button.btn.outline', { onclick: backUp }, 'Back up to Files or iCloud Drive'),
      h('p.caption', {}, days == null ? 'Never backed up.' : days === 0 ? 'Last backed up today.' : `Last backed up ${plural(days, 'day')} ago.`),
      restoreButton(),
      h('p.caption', {}, 'After a reset: install Litmus again, choose “Restore from an export file”, and pick the backup from iCloud Drive. Restoring always creates a new profile, so it never overwrites anything.')),
    card('', h('p.label', {}, 'Our promise about your data'),
      h('p.body', {}, 'Your health data stays on this device. There’s no account, no analytics, no advertising, and nothing is sold or shared. Litmus never sends your data anywhere — a backup only goes where you choose to save it.'),
      h('p.body', {}, 'If syncing or a community is ever added, it will be off unless you turn it on, it will say exactly what leaves the device, and this promise will be updated first.'),
      h('p.caption', {}, 'Your full history can always be exported, as an open JSON file, from “Back up” above.')),
    card('', h('p.label', {}, 'How the result is worked out'),
      h('p.body', {}, 'Your trial switches the thing being tested on and off in randomised weeks. Litmus compares each on-week with the off-week beside it, so slow drifts and good or bad stretches mostly cancel out, and it only calls something a real change when the whole plausible range clears the “too small to matter” band.'),
      h('p.caption', {}, 'It can’t control for expectation — you know when you’re doing the thing — and it isn’t medical advice.')),
    card('', h('p.label', {}, 'About'),
      h('p.body', {}, 'Litmus is not a doctor, doesn’t diagnose, and never tells you what to take. It helps you learn about your pain, test options fairly, and bring a clear record to the people who treat you.')));
}

// ── tracking sheets ──────────────────────────────────────────────────────────────

function symptomsSheet() {
  const tracked = store.trackedSymptoms;
  const names = new Set(tracked.map((x) => x.name.toLowerCase()));
  let custom = '';
  const field = h('input.field', { placeholder: 'Something else', oninput: (e) => { custom = e.target.value; } });
  return [
    h('p.body', {}, 'Scored 0–10 each day, below your pain score. Optional, and only as many as are useful.'),
    tracked.length > 0 && h('div.stack.tight', {}, h('p.label', {}, 'Tracking'),
      tracked.map((x) => h('div.check', {}, h('span.grow', {}, x.name),
        h('button.link', { onclick: () => store.stopTracking(x.id) }, 'Stop')))),
    h('p.caption', {}, 'Stopping keeps the scores you already gave.'),
    h('p.label', {}, 'Add'),
    h('div.chips', {}, COMMON_SYMPTOMS.filter((n) => !names.has(n.toLowerCase()))
      .map((n) => h('button.chip', { onclick: () => store.addSymptom(n) }, `+ ${n}`))),
    h('div.row', {}, field, h('button.btn.outline', { style: { width: 'auto', padding: '0 18px' }, onclick: () => { checkForCrisis(custom); store.addSymptom(custom); } }, 'Add')),
  ];
}

const dateText = (key) => keyToDate(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function medicationsSheet() {
  const meds = store.medications;
  return [
    card('clay', h('p.body', {}, 'Record when you start, change or stop a medication, and Litmus shows how your pain and the symptoms you track moved around those dates. It’s a before-and-after, not a trial — never stop or change a prescribed medication to test it. Talk to your prescriber first.')),
    meds.length === 0 ? h('p.body', {}, 'Nothing tracked yet.')
      : h('div.stack.tight', {}, meds.map((m) => h('button.check', { onclick: () => openSheet('medication', { id: m.id }) },
          h('div.grow', {}, h('div', { style: { fontSize: '16px' } }, m.name),
            h('p.caption', {}, [m.doseChanges.at(-1)?.dose ?? m.dose, `since ${dateText(m.startedOn)}`, m.stoppedOn && `stopped ${dateText(m.stoppedOn)}`].filter(Boolean).join(' · '))),
          h('span.muted', {}, '›')))),
    h('button.btn.primary', { onclick: () => openSheet('addMedication') }, 'Add a medication'),
  ];
}

function addMedicationSheet() {
  const form = { name: '', dose: '', startedOn: dayKey(), note: '' };
  const save = h('button.btn.primary', { disabled: true, onclick: async () => {
    await store.addMedication(form);
    checkForCrisis([form.name, form.dose, form.note].filter(Boolean).join(' '));
    if (ui.sheet?.kind === 'support') render(); else openSheet('medications');
  } }, 'Save');
  return [
    h('input.field', { placeholder: 'Name', 'aria-label': 'Medication name', oninput: (e) => { form.name = e.target.value; save.disabled = !form.name.trim(); } }),
    h('input.field', { placeholder: 'Dose (optional)', 'aria-label': 'Dose', oninput: (e) => { form.dose = e.target.value; } }),
    h('label.caption', {}, 'Started'),
    h('input.field', { type: 'date', 'aria-label': 'Started', value: form.startedOn, max: dayKey(), oninput: (e) => { form.startedOn = e.target.value || dayKey(); } }),
    h('textarea.field', { placeholder: 'Anything to remember (optional)', rows: 2, oninput: (e) => { form.note = e.target.value; } }),
    h('p.caption', {}, 'Written as you’d say it, and kept on this device.'),
    save,
  ];
}

function comparisonRow(label, scores, m) {
  const r = beforeAfter(scores, m.startedOn, m.stoppedOn);
  const side = (mean, days) => (mean == null ? 'no days' : `${fmt(mean)} over ${plural(days, 'day')}`);
  return h('div.stack', { style: { gap: '4px' } },
    h('div.row.between', {}, h('span', { style: { fontWeight: 500 } }, label),
      r.difference != null && h('span', { style: { fontWeight: 500 } }, `${r.difference > 0 ? '+' : ''}${fmt(r.difference)}`)),
    h('p.caption', {}, `Before: ${side(r.beforeMean, r.beforeDays)} · Since: ${side(r.afterMean, r.afterDays)}${r.difference == null ? `. Needs ${BEFORE_AFTER_MINIMUM_DAYS} logged days on each side.` : ''}`));
}

function medicationSheet(id) {
  const m = store.medications.find((x) => x.id === id);
  if (!m) return [h('p.body', {}, 'This record was deleted.')];
  let newDose = '', changeOn = dayKey(), stopOn = dayKey(), confirming = false;
  const danger = h('div');
  const drawDanger = () => danger.replaceChildren(confirming
    ? card('clay', h('p.body', {}, `Delete ${m.name} and its dates?`),
        h('button.btn.primary', { onclick: async () => { await store.deleteMedication(id); openSheet('medications'); } }, 'Delete'),
        h('button.link', { onclick: () => { confirming = false; drawDanger(); } }, 'Cancel'))
    : h('button.link', { onclick: () => { confirming = true; drawDanger(); } }, 'Delete this record'));
  drawDanger();
  const symptomRows = (store.person.symptoms ?? [])
    .map((x) => [x.name, store.symptomSeries(x.id)])
    .filter(([, series]) => Object.keys(series).length > 0);

  return [
    card('',
      h('div.row.between', {}, h('span.muted', {}, 'Started'), h('span', {}, dateText(m.startedOn))),
      m.dose && h('div.row.between', {}, h('span.muted', {}, 'Starting dose'), h('span', {}, m.dose)),
      m.doseChanges.map((c) => h('div.row.between', {}, h('span.muted', {}, dateText(c.date)), h('span', {}, c.dose))),
      m.stoppedOn && h('div.row.between', {}, h('span.muted', {}, 'Stopped'), h('span', {}, dateText(m.stoppedOn))),
      m.note && h('p.body', {}, m.note)),
    card('', h('p.label', {}, 'Before and since'),
      comparisonRow('Pain', store.painByDay(), m),
      symptomRows.map(([name, series]) => comparisonRow(name, series, m)),
      h('p.caption', {}, 'Averages for the 4 weeks before starting and the time since. This can’t show the medication caused a change: anything else that shifted at the same time is mixed in, including simply expecting it to help. Worth bringing to your prescriber, not a verdict.')),
    !m.stoppedOn && card('', h('p.label', {}, 'Dose changed'),
      h('input.field', { placeholder: 'New dose', oninput: (e) => { newDose = e.target.value; } }),
      h('input.field', { type: 'date', 'aria-label': 'Date of the dose change', value: changeOn, max: dayKey(), oninput: (e) => { changeOn = e.target.value || dayKey(); } }),
      h('button.btn.outline', { onclick: async () => {
        if (!newDose.trim()) return;
        await store.updateMedication(id, (x) => { x.doseChanges.push({ date: changeOn, dose: newDose.trim() }); });
      } }, 'Record change')),
    !m.stoppedOn && card('', h('p.label', {}, 'Stopped'),
      h('input.field', { type: 'date', 'aria-label': 'Date stopped', value: stopOn, max: dayKey(), oninput: (e) => { stopOn = e.target.value || dayKey(); } }),
      h('button.btn.outline', { onclick: () => store.updateMedication(id, (x) => { x.stoppedOn = stopOn; }) }, 'Mark as stopped')),
    danger,
  ];
}

// ── journal and care record ──────────────────────────────────────────────────────

function journalSheet() {
  let draft = '';
  const area = h('textarea.field', { placeholder: 'Whatever’s on your mind', rows: 4, oninput: (e) => { draft = e.target.value; } });
  const entries = store.journal;
  return [
    h('p.body', {}, 'For anything the numbers can’t carry. It stays on this device, it’s never used in a trial, and it isn’t part of the care record.'),
    area,
    h('button.btn.primary', { onclick: async () => {
      if (!draft.trim()) return;
      checkForCrisis(draft);
      await store.addJournalEntry(draft);
    } }, 'Save entry'),
    entries.length > 0 && h('div.stack.tight', {}, entries.map((x) => card('',
      h('div.row.between', {}, h('p.caption', {}, new Date(x.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })),
        h('button.link', { onclick: () => store.deleteJournalEntry(x.id) }, 'Delete')),
      h('p.body', { style: { color: 'var(--ink)', whiteSpace: 'pre-wrap' } }, x.text)))),
  ];
}

function recordText() {
  const trials = store.person.trials.map((r) => ({ record: r, analysis: store.analysis(r), dayNow: r.finishedOn ? null : store.dayIn(r) }));
  const pain = store.painByDay();
  const medications = store.medications.map((m) => ({ ...m, comparison: beforeAfter(pain, m.startedOn, m.stoppedOn) }));
  return careRecord({
    name: store.person.name, profile: store.profile, trials, medications,
    recent: store.recentPain(28), ownQuestions: store.questions.map((q) => q.text),
  });
}

// A short editable list kept in the profile, shown in the care record.
function listCard(label, field, placeholder, caption) {
  let draft = '';
  const items = store.profile[field] ?? [];
  const input = h('input.field', { placeholder, oninput: (e) => { draft = e.target.value; } });
  return card('', h('p.label', {}, label),
    items.map((x, i) => h('div.row.between', {}, h('span.body', { style: { color: 'var(--ink)' } }, x),
      h('button.link', { onclick: () => store.removeProfileItem(field, i) }, 'Remove'))),
    h('div.row', {}, input, h('button.btn.outline', { 'aria-label': `Add to ${label.toLowerCase()}`, style: { width: 'auto', padding: '0 18px' }, onclick: () => { checkForCrisis(draft); store.addProfileItem(field, draft); } }, 'Add')),
    h('p.caption', {}, caption));
}

function recordSheet() {
  const text = recordText();
  let draft = '';
  const field = h('input.field', { placeholder: 'A question of your own', oninput: (e) => { draft = e.target.value; } });
  return [
    h('p.body', {}, 'One page for a new specialist, a GP or a physio: what you’ve reported, what you’ve tested and what it showed, your medications, and questions to raise. Journal entries are never included.'),
    listCard('Tried before', 'alsoTried', 'e.g. physio in 2023, a nerve block', 'Treatments from before Litmus, in your words.'),
    listCard('Ruled out by a clinician', 'ruledOut', 'e.g. a disc problem, on an MRI', 'Only what you’ve actually been told.'),
    card('', h('p.label', {}, 'Your questions'),
      store.questions.map((q) => h('div.row.between', {}, h('span.body', { style: { color: 'var(--ink)' } }, q.text),
        h('button.link', { onclick: () => store.removeQuestion(q.id) }, 'Remove'))),
      h('div.row', {}, field, h('button.btn.outline', { style: { width: 'auto', padding: '0 18px' }, onclick: () => { checkForCrisis(draft); store.addQuestion(draft); } }, 'Add')),
      h('p.caption', {}, 'Yours come first. Litmus adds a few more from what you’ve logged — questions for the clinician, never advice.')),
    h('section.card.print-me', {}, h('pre.pre', {}, text)),
    h('button.btn.outline', { onclick: () => window.print() }, 'Print or save as PDF'),
    h('button.btn.primary', { onclick: async () => {
      try { if (navigator.share) await navigator.share({ title: 'Pain record', text }); else { await navigator.clipboard.writeText(text); toast('Copied.'); } } catch {}
    } }, navigator.share ? 'Share' : 'Copy'),
  ];
}

// ── community (preview) ──────────────────────────────────────────────────────────

const LABS_KEY = 'litmus.labs.community';
function labsOn() { try { return localStorage.getItem(LABS_KEY) === 'on'; } catch { return false; } }
function setLabs(on) { try { on ? localStorage.setItem(LABS_KEY, 'on') : localStorage.removeItem(LABS_KEY); } catch {} }

let community = null;
const communityStore = () => (community ??= new LocalCommunity());

function resultCard(result) {
  const c = cardSummary(result);
  return h('div.stack.tight', { style: { gap: '4px' } },
    h('p.label.sage', {}, c.title),
    h('div', { style: { fontSize: '18px', fontFamily: 'var(--serif)' } }, c.verdict),
    c.range && h('p.caption', {}, c.range),
    h('p.caption', {}, c.detail));
}

function communitySheet(sh) {
  const cm = communityStore();
  const view = sh.view ?? 'feed';
  const go = (v, extra = {}) => { ui.sheet = { kind: 'community', view: v, ...extra }; render(); };
  const tabs = h('div.chips', {}, [['feed', 'Shared results'], ['share', 'Share yours'], ['mod', 'Moderator view']]
    .map(([id, label]) => h(`button.chip${view === id ? '.on' : ''}`, { onclick: () => go(id) }, label)));
  const banner = card('clay', h('p.body', {}, 'Preview. Everything here stays on this device — no one else can see it yet. It shows how sharing will work once there’s a server and a moderator.'));
  const after = (res, okText) => {
    if (!res.ok) { toast(res.problem); return false; }
    if (res.held) { ui.sheet = { kind: 'support' }; render(); return false; }
    toast(res.soundsLikeAdvice ? `${okText} A reminder: this space is for what happened to you, not advice for others.` : okText);
    return true;
  };

  let body;
  if (view === 'share') {
    const done = store.completed.slice().reverse();
    const chosen = done.find((r) => r.id === sh.pick) ?? done[0];
    let note = '';
    const count = h('p.caption', {}, `0/${NOTE_LIMIT}`);
    const area = h('textarea.field', { placeholder: 'Anything that would help someone understand what you did (optional)', rows: 3, maxlength: NOTE_LIMIT,
      oninput: (e) => { note = e.target.value; count.textContent = `${note.length}/${NOTE_LIMIT}`; } });
    const result = chosen && anonymisedResult(chosen, store.analysis(chosen), store.profile);
    body = done.length === 0
      ? [h('p.body', {}, 'Sharing starts from a finished trial, so there’s something real to show. Once one is finished, it can be shared here.')]
      : [
          done.length > 1 && h('div.chips', {}, done.map((r) => h(`button.chip${r === chosen ? '.on' : ''}`, { onclick: () => go('share', { pick: r.id }) }, trialName(r.trial)))),
          card('', resultCard(result)),
          h('p.caption', {}, `Shared as ${cm.handle}. Only what’s on the card is shared — no name, no dates, no notes from your log.`),
          area, count,
          h('button.btn.primary', { onclick: () => { if (after(cm.post(result, note), 'Shared.')) go('feed'); } }, 'Share this result'),
        ];
  } else if (view === 'mod') {
    const q = cm.queue();
    body = [
      h('p.body', {}, 'What one moderator would see: anything held by the crisis check, and anything reported. Nothing held is ever shown to other people.'),
      q.length === 0 ? h('p.caption', {}, 'Nothing waiting.') : q.map((item) => card('',
        h('p.label', {}, item.reason === 'crisis' ? 'Held: crisis language' : `Reported ${plural((item.reply ?? item.post).reports.length, 'time')}`),
        h('p.body', { style: { color: 'var(--ink)' } }, item.reply ? item.reply.text : (item.post.note || cardSummary(item.post.result).title)),
        item.reason === 'crisis' && h('p.caption', {}, 'The writer was shown crisis resources when they posted. A real moderator would follow the safety policy here.'),
        h('div.row', {},
          h('button.btn.outline', { onclick: () => { cm.moderate(item.post.id, item.reply?.id ?? null, 'keep'); render(); } }, 'Keep'),
          h('button.btn.outline', { onclick: () => { cm.moderate(item.post.id, item.reply?.id ?? null, 'remove'); render(); } }, 'Remove')))),
    ];
  } else {
    const posts = cm.feed();
    body = [
      h('p.caption', {}, `You appear as ${cm.handle}. There are no profiles and no private messages.`),
      posts.length === 0 && h('p.body', {}, 'Nothing shared yet. Results appear here once people share finished trials.'),
      posts.map((p) => {
        let draft = '';
        const field = h('input.field', { placeholder: 'Reply with your own experience', maxlength: NOTE_LIMIT, oninput: (e) => { draft = e.target.value; } });
        return card('',
          resultCard(p.result),
          p.note && h('p.body', { style: { color: 'var(--ink)' } }, p.note),
          h('div.row.between', {}, h('p.caption', {}, `${p.handle} · ${new Date(p.at).toLocaleDateString()}`),
            p.mine ? h('button.link', { onclick: () => { cm.deleteOwn(p.id); render(); } }, 'Delete')
              : h('button.link', { onclick: () => { toast(cm.report(p.id) ? 'Reported. A moderator will look at it.' : 'Already reported.'); render(); } }, 'Report')),
          p.replies.length > 0 && h('div.stack.tight', { style: { borderLeft: '2px solid var(--line)', paddingLeft: '12px' } },
            p.replies.map((r) => h('div', {},
              h('p.body', { style: { color: 'var(--ink)' } }, r.text),
              h('p.caption', {}, r.status === 'held' ? `${r.handle} · waiting for a moderator` : r.handle)))),
          h('div.row', {}, field, h('button.btn.outline', { style: { width: 'auto', padding: '0 18px' },
            onclick: () => { if (after(cm.reply(p.id, draft), 'Replied.')) render(); } }, 'Reply')));
      }),
      h('p.caption', {}, 'This is a place for what happened to you, not advice. Links can’t be posted.'),
    ];
  }
  return [banner, tabs, ...[body].flat()];
}

// ── sheets ───────────────────────────────────────────────────────────────────────

function openSheet(kind, data = {}) { ui.sheet = { kind, ...data }; render(); }
function closeSheet() {
  // Leaving a text field fires the crisis check just before a "Done" tap lands; the
  // support sheet it raised must not be closed by that same tap.
  if (ui.sheet?.kind === 'support' && Date.now() - (ui.crisisAt ?? 0) < 800) return;
  ui.sheet = null; ui.setup = null; render();
}

function sheet() {
  const sh = ui.sheet;
  let title, body;
  switch (sh.kind) {
    case 'people': title = 'Profile'; body = peopleSheet(); break;
    case 'setup': title = store.activeRecords.length ? 'Start another trial' : 'Set up a trial'; body = setupSheet(); break;
    case 'symptoms': title = 'Symptoms'; body = symptomsSheet(); break;
    case 'medications': title = 'Medications'; body = medicationsSheet(); break;
    case 'reminders': title = 'Daily reminder'; body = remindersSheet(); break;
    case 'library': title = 'Things people test';
      body = [h('p.body', {}, 'The same list for everyone. It’s a menu with the evidence attached, not a recommendation — what suits you is a question for you and the people who treat you.'),
        LIBRARY.map((i) => card('', h('p.label.sage', {}, i.displayName), h('p.body', {}, i.evidenceNote),
          h('p.caption', {}, `Source: ${i.evidenceSource}.`),
          i.trialTip && h('p.caption', { style: { color: 'var(--ink-soft)' } }, `A fair test: ${i.trialTip}`)))];
      break;
    case 'lesson': title = LESSONS.find((x) => x.id === sh.id)?.title ?? 'Learn'; body = lessonSheet(sh.id); break;
    case 'flarePlan': title = 'Flare plan'; body = flarePlanSheet(); break;
    case 'journal': title = 'Journal'; body = journalSheet(); break;
    case 'record': title = 'Care record'; body = recordSheet(); break;
    case 'community': title = 'Community'; body = communitySheet(sh); break;
    case 'support': title = 'You don’t have to carry this alone';
      body = [h('p.reading', {}, 'What you wrote sounds really hard. If you’re thinking about harming yourself or ending your life, please talk to someone now — they’re there for exactly this, any time of day.'),
        ...crisisLinks(),
        h('p.caption', {}, 'Your note is saved as you wrote it. Litmus doesn’t send it anywhere.')];
      break;
    case 'addMedication': title = 'Add a medication'; body = addMedicationSheet(); break;
    case 'medication': title = store.medications.find((x) => x.id === sh.id)?.name ?? 'Medication'; body = medicationSheet(sh.id); break;
    case 'clinician': {
      const text = clinicianSummary(sh.a, store.person.name, sh.finishedOn);
      title = 'For a clinician';
      body = [h('p.body', {}, 'One page to show or send. It states the method, the result and its limits, and recommends nothing.'),
        h('section.card.print-me', {}, h('pre.pre', {}, text)),
        h('button.btn.primary', { onclick: async () => {
          try { if (navigator.share) await navigator.share({ title: 'Self-experiment summary', text }); else { await navigator.clipboard.writeText(text); toast('Copied.'); } } catch {}
        } }, navigator.share ? 'Share' : 'Copy'),
        h('button.btn.outline', { onclick: () => window.print() }, 'Print or save as PDF')];
      break;
    }
    case 'past': {
      const a = store.analysis(sh.record);
      title = 'Earlier trial';
      body = a ? [resultBlock(a, sh.record)] : [h('p.body', {}, 'No days were logged in this trial.')];
      break;
    }
    case 'endTrial': {
      const done = store.focusedIsFinished;
      title = done ? 'Close this trial' : 'End this trial';
      body = [h('p.label.sage', {}, store.trial ? trialName(store.trial) : ''),
        h('p.reading', {}, done
          ? 'This keeps the result in your history and frees you to test something else.'
          : 'Ending early keeps what you’ve logged, but a shorter trial can say much less. The result is saved in your history either way.'),
        h('button.btn.primary', { onclick: async () => { await store.archiveCurrent(); ui.sheet = null; ui.tab = 'result'; render(); } }, done ? 'Close and keep the result' : 'End it now'),
        h('button.btn.outline', { onclick: closeSheet }, 'Keep going')];
      break;
    }
    default: return null;
  }
  const panel = h('div.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1', onclick: (e) => e.stopPropagation() },
    h('div.sheet-head', {}, h('h2', {}, title), h('button.link', { onclick: closeSheet }, 'Done')),
    h('div.stack', {}, body));
  return h('div.sheet-backdrop', { onclick: closeSheet }, panel);
}

function peopleSheet() {
  const p = store.person;
  const others = store.people.filter((x) => x.id !== p.id);
  let confirmRestart = false, confirmDelete = false;
  const danger = h('div.stack.tight');
  const drawDanger = () => danger.replaceChildren(
    confirmRestart
      ? card('clay', h('p.body', {}, `This clears ${p.name}’s answers, baseline and trials on this device. Export first if you might want them.`),
          h('button.btn.primary', { onclick: async () => { await store.restartCurrent(); ui.sheet = null; ui.step = 0; ui.draft = null; render(); } }, 'Clear and start over'),
          h('button.link', { onclick: () => { confirmRestart = false; drawDanger(); } }, 'Cancel'))
      : h('button.btn.outline', { onclick: () => { confirmRestart = true; drawDanger(); } }, 'Start this profile over'),
    confirmDelete
      ? card('clay', h('p.body', {}, `Delete ${p.name} and everything in it from this device? This can’t be undone.`),
          h('button.btn.primary', { onclick: async () => { ui.sheet = null; await store.deletePerson(p); } }, 'Delete profile'),
          h('button.link', { onclick: () => { confirmDelete = false; drawDanger(); } }, 'Cancel'))
      : h('button.link', { onclick: () => { confirmDelete = true; drawDanger(); } }, 'Delete this profile'));
  drawDanger();

  return [
    h('div.row', {}, avatar(p, '.lg'), h('div', {}, h('div', { style: { fontSize: '18px', fontWeight: 600 } }, p.name),
      h('p.caption', {}, `Since ${new Date(p.createdAt).toLocaleDateString()}`))),
    others.length > 0 && h('div.stack.tight', {}, h('p.label', {}, 'Other profiles on this device'),
      others.map((o) => h('button.check', { onclick: () => { ui.sheet = null; ui.tab = 'today'; store.use(o); } }, avatar(o), h('span.grow', {}, o.name), h('span.muted', {}, 'Switch')))),
    h('button.btn.primary', { onclick: () => { ui.sheet = null; ui.tab = 'today'; store.switchProfile(); } }, 'Switch profile'),
    danger,
    DEBUG && card('', h('p.label', {}, 'Development'),
      h('button.btn.outline', { onclick: () => seedDemo() }, 'Fill a finished demo trial')),
  ];
}

async function seedDemo() {
  const p = store.person;
  p.profile.completedOnboarding = true;
  p.baselineStartedOn ??= new Date(Date.now() - 120 * 86400000).toISOString();
  p.trials = p.trials.filter((t) => t.finishedOn);
  await store.startTrial({ intervention: LIBRARY[4], outcomeId: PAIN_ID, note: 'Heat pad, 20 minutes each evening' });
  const r = store.running;
  const start = new Date(); start.setDate(start.getDate() - 96); start.setHours(0, 0, 0, 0);
  r.trial.startDate = start.toISOString();
  let prev = 0;
  for (let d = 0; d < 97; d++) {
    if (Math.random() < 0.1) continue;
    const ph = phaseOnDay(r.trial, d);
    prev = 0.5 * prev + (Math.random() - 0.5) * 2.4;
    const score = Math.max(0, Math.min(10, Math.round(5.5 + prev - (ph.kind === 'b' ? 2.2 : 0))));
    r.entries.push({ day: d, score, sampleCount: 1, sampleSum: score, adhered: ph.kind === 'b' ? Math.random() > 0.1 : null, isFlare: score >= 8, note: null });
  }
  ui.sheet = null;
  await store.save();
}

// ── frame ────────────────────────────────────────────────────────────────────────

// Drawn to match the native SF Symbols set: one outline family, one stroke weight.
const TABS = [
  ['today', 'Today', 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M12 2.75v2 M12 19.25v2 M2.75 12h2 M19.25 12h2 M5.46 5.46l1.41 1.41 M17.13 17.13l1.41 1.41 M5.46 18.54l1.41-1.41 M17.13 6.87l1.41-1.41'],
  ['trial', 'Trial', 'M5.5 3.25h5 M6.75 3.25v13.5a1.25 1.25 0 0 0 2.5 0V3.25 M6.75 10h2.5 M13.5 3.25h5 M14.75 3.25v13.5a1.25 1.25 0 0 0 2.5 0V3.25 M14.75 13h2.5'],
  ['result', 'Result', 'M4 3.5v16.5h16.5 M7.5 15.5l3.5-4.25 3 2.5 5.25-6.5'],
  ['practice', 'Learn', 'M5 19.5c0-8.5 5-14.5 14.5-14.5 0 9.5-6 14.5-14.5 14.5z M5 19.5l8.5-8.5'],
  ['more', 'More', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M7.75 12h.01 M12 12h.01 M16.25 12h.01'],
];

function tabbar() {
  return h('nav.tabbar', { 'aria-label': 'Sections' }, TABS.map(([id, label, d]) =>
    h(`button.tab${ui.tab === id ? '.on' : ''}`, { 'aria-current': ui.tab === id ? 'page' : null, onclick: () => { ui.tab = id; render(); window.scrollTo(0, 0); } },
      s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
        s('path', { d }), id === 'more' && s('path', { d: 'M7.75 12h.01 M12 12h.01 M16.25 12h.01', 'stroke-width': 2.6 })),
      label)));
}

let lastOpened = null;

function render() {
  const y = window.scrollY;
  const sheetY = root.querySelector('.sheet')?.scrollTop ?? 0;
  const focusedName = document.activeElement?.getAttribute?.('placeholder');
  const kids = [];
  if (!store.person) {
    kids.push(chooser());
  } else if (!store.profile.completedOnboarding) {
    kids.push(h('div.topbar', {}, h('button', { 'aria-label': 'Profile', onclick: () => openSheet('people') }, avatar(store.person))), onboarding());
  } else {
    const view = { today: todayTab, trial: trialTab, result: resultTab, practice: practiceTab, more: moreTab }[ui.tab]();
    kids.push(h('div.topbar', {}, h('button', { 'aria-label': `Profile: ${store.person.name}`, onclick: () => openSheet('people') }, avatar(store.person))), view, tabbar());
  }
  if (ui.sheet && store.person) kids.push(sheet());
  root.replaceChildren(...kids);
  document.body.style.overflow = ui.sheet ? 'hidden' : '';
  // With a sheet open, the screen behind it is out of reach for keyboards and screen
  // readers, and focus moves into the sheet when it first opens.
  for (const el of root.children) el.inert = !!ui.sheet && !el.classList.contains('sheet-backdrop');
  const opened = ui.sheet ? `${ui.sheet.kind}:${ui.sheet.view ?? ''}` : null;
  if (opened && opened !== lastOpened && !focusedName) root.querySelector('.sheet')?.focus();
  lastOpened = opened;
  window.scrollTo(0, y);
  const panel = root.querySelector('.sheet');
  if (panel) panel.scrollTop = sheetY;
  if (focusedName) root.querySelector(`[placeholder="${CSS.escape(focusedName)}"]`)?.focus();
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sheet) closeSheet(); });

// A new day can begin while the app sits open: on return to it, and at midnight.
function atMidnight() {
  const next = new Date(); next.setHours(24, 0, 5, 0);
  setTimeout(() => { lastDay = new Date().toDateString(); ui.flareMore = false; render(); atMidnight(); }, next - new Date());
}
let lastDay = new Date().toDateString();
atMidnight();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && new Date().toDateString() !== lastDay) { lastDay = new Date().toDateString(); ui.flareMore = false; render(); }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render());
store.onChange(render);
store.open().then(render).catch((err) => {
  root.replaceChildren(h('div.stack', { style: { marginTop: '40px' } }, h('h1.display', {}, 'Storage isn’t available.'),
    h('p.reading', {}, 'This browser is blocking on-device storage (private browsing does this). Litmus needs it to keep your history.'),
    h('p.caption', {}, String(err))));
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
