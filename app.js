// Litmus — web. The screens, built on the same engine as the native app.

import { OUTCOMES, detectableEffect, plannedDays, phaseOnDay } from './engine.js';
import { Store, daysBetween } from './store.js';
import {
  SITES, QUALITIES, FACTORS, RED_FLAGS, DIAGNOSES, LIBRARY, PRACTICES, PAIN_RAMP,
  suggestedOrder, customIntervention, NERVE_QUALITIES, widespreadFeatureCount,
} from './content.js';
import { headline, rerunSuggestion, describeThreat, clinicianSummary } from './reporting.js';

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

function avatar(person, cls = '') {
  return h(`div.avatar${cls}`, { 'aria-hidden': 'true' }, (person?.name ?? '?').trim().charAt(0).toUpperCase());
}

function header(title, lead) {
  return h('div.stack.tight', {},
    h('div.row', {}, presence(), h('div.grow')),
    h('h1.display', {}, title),
    lead && h('p.reading', {}, lead));
}

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
    trial && h('span', {}, h('i.swatch', { style: { background: 'var(--band-off)' } }), 'Off'),
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
      presence('lg'),
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
      toast(`Restored as “${name}”.`);
    } catch (err) { toast(err.message); }
    e.target.value = '';
  } });
  return h('div', {}, file, h('button.btn.outline', { onclick: () => file.click() }, 'Restore from an export file'));
}

// ── onboarding ───────────────────────────────────────────────────────────────────

const STEPS = ['welcome', 'sites', 'qualities', 'history', 'factors', 'safety', 'picture'];

function onboarding() {
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
        wide >= 2 && card('sage', h('p.body', {}, 'Some of what you described — pain in several places, sleep, fatigue, sensitivity — is often discussed as the nervous system turning up its volume. That’s not a diagnosis. It’s one reason sleep and pacing sit near the top of the list of things you could test.')),
        card('', h('p.label', {}, 'What happens next'),
          h('p.body', {}, 'For the next week or two, just score your pain once a day. That shows how much it moves on its own, which is what a fair test has to be measured against. Then you can choose one thing to test.'))];
    }
  }

  const last = ui.step === STEPS.length - 1;
  return h('div.stack', {},
    h('div.row', {}, ui.step > 0 ? h('button.link', { onclick: () => { ui.step--; render(); } }, '‹ Back') : h('span', { style: { width: '52px' } }),
      h('div.steps', {}, STEPS.map((_, i) => h(`span${i <= ui.step ? '.on' : ''}`)))),
    ui.step === 0 && presence('lg'),
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
  const trial = store.trial;
  if (trial && store.isFinished) {
    return h('div.stack', {}, header('This trial is finished.', 'Every planned day has passed. The result is ready.'),
      h('button.btn.primary', { onclick: () => { ui.tab = 'result'; render(); } }, 'See the result'));
  }
  const outcome = OUTCOMES[trial?.outcomeId ?? 'pain.intensity-nrs-11'];
  const today = store.today;
  const phase = trial && store.currentDay != null ? phaseOnDay(trial, store.currentDay) : null;

  let title, lead;
  if (!trial && store.completed.length > 0) {
    title = 'Between trials';
    lead = 'Scoring still helps: it keeps your picture of an ordinary day current. Set up the next trial from the Trial tab whenever you’re ready.';
  } else if (!trial) {
    title = `Day ${(store.baselineDay ?? 0) + 1} · nothing to change yet`;
    lead = 'Just score how today has been. This baseline shows how much your pain moves on its own.';
  } else if (store.currentDay == null) {
    title = 'Your trial starts soon.';
  } else {
    title = phase.kind === 'washout' ? 'A quiet day between blocks.'
      : phase.kind === 'b' ? `A week on ${trial.conditionB.displayName}.` : 'An off week.';
    lead = phase.kind === 'washout' ? 'Carry on as you were.'
      : phase.kind === 'b' ? (trial.userNote || 'Do the thing you’re testing, as planned.') : 'Nothing to do differently.';
  }

  const kids = [h('div.row', {}, presence(), h('p.label.sage', {}, trial ? `Day ${(store.currentDay ?? 0) + 1} of ${plannedDays(trial)}` : 'Baseline')),
    h('h1.display', {}, title), lead && h('p.reading', {}, lead)];

  if (!today) {
    kids.push(card('', h('p.label', {}, outcome.prompt), scoreScale(null, outcome, (v) => store.log(v))));
  } else {
    let adding = false;
    const more = h('div');
    const drawMore = () => {
      more.replaceChildren(adding
        ? h('div.stack.tight', {}, h('p.label', {}, 'Another reading'),
            scoreScale(null, outcome, async (v) => { await store.addReading(v); toast('Added. Today’s score is the average.'); }),
            h('button.link', { onclick: () => { adding = false; drawMore(); } }, 'Cancel'))
        : h('button.btn.outline', { onclick: () => { adding = true; drawMore(); } }, '+ Add another reading'));
    };
    drawMore();
    kids.push(card('',
      h('div.row.between', {}, h('p.label', {}, 'Logged today'),
        h('button.link', { style: { padding: 0 }, onclick: async () => {
          const pool = store.todaysPool();
          pool.list.splice(pool.list.indexOf(today), 1);
          await store.save();
        } }, 'Change')),
      h('div.row', { style: { alignItems: 'baseline' } }, h('span.number', {}, fmt(today.score, today.sampleCount > 1 ? 1 : 0)), h('span.muted', {}, 'out of 10')),
      h('p.caption', {}, today.sampleCount > 1 ? `Average of ${plural(today.sampleCount, 'reading')} today.` : 'One reading so far. Pain moves through the day — add more whenever you like, and the day’s score becomes their average.'),
      more));
    kids.push(flareToggle(today.isFlare, (on) => store.setFlare(on)));

    if (trial && phase?.kind === 'b') {
      const yes = today.adhered === true, no = today.adhered === false;
      // Named rather than slotted into a sentence: "did you do your heat" reads badly,
      // and custom names can be anything.
      kids.push(card('', h('p.label', {}, 'Did you do it today?'),
        h('p.body', { style: { color: 'var(--ink)' } }, trial.conditionB.displayName),
        trial.userNote && h('p.caption', {}, `Your plan: ${trial.userNote}`),
        h('div.row', {},
          h(`button.btn.outline${yes ? '.solid-on' : ''}`, { onclick: () => store.setAdherence(true) }, 'Yes'),
          h(`button.btn.outline${no ? '.solid-on' : ''}`, { onclick: () => store.setAdherence(false) }, 'Not today')),
        h('p.caption', {}, 'An honest “not today” keeps the result accurate.')));
    }
    const note = h('textarea.field', { placeholder: 'A note for today (optional)', rows: 2 }, today.note ?? '');
    note.addEventListener('change', () => store.setNote(note.value));
    kids.push(note);
  }

  kids.push(h('p.caption.center', {}, 'Some days are too much to log. That’s fine — a missed day is simply left out.'));
  return h('div.stack', {}, kids);
}

// ── trial tab ────────────────────────────────────────────────────────────────────

function trialTab() {
  const trial = store.trial;
  if (!trial) return baselineStatus();
  const a = store.analysis();
  const day = store.currentDay;
  const logged = store.entries.length;
  const elapsed = store.elapsedDays;
  const missed = Math.max(0, elapsed - logged - (store.today ? 0 : day != null ? 1 : 0));
  const blocks = trial.phases.filter((p) => p.kind !== 'washout');
  const doneBlocks = blocks.filter((p) => p.startDay + p.length <= (day ?? plannedDays(trial))).length;

  return h('div.stack', {},
    header(trial.conditionB.displayName, `Testing its effect on ${OUTCOMES[trial.outcomeId].displayName.toLowerCase()}.`),
    card('', h('div.row.between', {},
        h('div', {}, h('div.number', {}, elapsed), h('p.caption', {}, `of ${plannedDays(trial)} days`)),
        h('div', {}, h('div.number', {}, logged), h('p.caption', {}, 'logged')),
        h('div', {}, h('div.number', {}, `${doneBlocks}/${blocks.length}`), h('p.caption', {}, 'weeks done'))),
      missed > 0 && h('p.caption', {}, `${plural(missed, 'day')} missed so far — that’s normal and already accounted for.`)),
    card('', h('p.label', {}, 'Your scores'), trace(store.entries, trial, { today: day }), traceLegend(trial)),
    card('', h('p.label', {}, 'The order'),
      h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${blocks.length}, minmax(0, 1fr))`, gap: '4px' } }, blocks.map((p) => {
        const past = p.startDay + p.length <= (day ?? Infinity);
        const now = day != null && day >= p.startDay && day < p.startDay + p.length;
        return h('span', { style: {
          height: '30px', borderRadius: '8px', display: 'grid', placeItems: 'center', fontSize: '11px', color: 'var(--ink-soft)',
          background: p.kind === 'b' ? 'var(--band-on)' : 'var(--band-off)',
          outline: now ? '2px solid var(--ink)' : 'none', opacity: past || now ? 1 : 0.55,
        } }, p.kind === 'b' ? 'On' : 'Off');
      })),
      h('p.caption', {}, 'Randomised, so a good or bad stretch can’t line up with the thing being tested.')),
    a && a.verdict.reason !== 'insufficientData' && a.verdict.reason !== 'tooFewCompletedBlocks' && Number.isFinite(a.low) && card('sage',
      h('p.label.sage', {}, 'Precision so far'),
      h('p.body', {}, `Right now the estimate is good to within about ±${fmt((a.high - a.low) / 2)} points. It tightens as more weeks finish.`)),
    h('button.link', { onclick: () => openSheet('endTrial') }, 'End this trial early'));
}

function baselineStatus() {
  const base = store.person.baseline;
  const sd = store.baselineVariability;
  const target = 14;
  return h('div.stack', {},
    store.completed.length > 0
      ? header('Ready for the next one', 'Your daily scores carry on from here. Choose something new to test whenever you like.')
      : header('Your baseline', 'Before testing anything, a couple of weeks of ordinary days shows how much your pain moves by itself.'),
    card('', h('div.row', { style: { alignItems: 'baseline' } }, h('span.number', {}, base.length), h('span.muted', {}, `of ${target} days scored`)),
      h('div.row', { style: { gap: '4px', flexWrap: 'wrap' } }, Array.from({ length: Math.max(target, base.length) }, (_, d) => {
        const e = base.find((x) => x.day === d);
        return h('span', { style: { width: '16px', height: '16px', borderRadius: '5px',
          background: e ? painColor(e.score) : 'transparent', border: '1px solid var(--line)' } });
      }))),
    base.length >= 3 && card('', h('p.label', {}, 'So far'), trace(base, null), traceLegend(null)),
    sd != null
      ? card('sage', h('p.label.sage', {}, 'Ready when you are'),
          h('p.body', {}, `Your scores move by about ${fmt(sd)} points from day to day. A standard trial could reliably pick up a change of about ${fmt(detectableEffect(sd, 0.5, 10, 7))} points.`))
      : h('p.body', {}, `Keep scoring. After ${plural(Math.max(0, 10 - base.length), 'more day')} the trial can be sized to your own variability.`),
    h('button.btn.primary', { onclick: () => openSheet('setup') }, 'Set up a trial'),
    h('p.caption', {}, 'Keep logging as long as you like — more baseline only sharpens it.'));
}

function setupSheet() {
  const profile = store.profile;
  const menu = suggestedOrder(profile);
  const hidden = LIBRARY.filter((i) => !menu.includes(i));
  const st = ui.setup ??= { pick: menu[0]?.id ?? LIBRARY[0].id, custom: '', outcomeId: 'pain.intensity-nrs-11', note: '' };
  const sd = store.baselineVariability;
  const chosen = st.pick === 'custom' ? (st.custom.trim() ? customIntervention(st.custom.trim()) : null) : LIBRARY.find((i) => i.id === st.pick);
  const outcome = OUTCOMES[st.outcomeId];
  const detect = detectableEffect(sd ?? 1.5, 0.5, 10, 7, outcome);

  const option = (i) => h(`button.check${st.pick === i.id ? '.on' : ''}`, { onclick: () => { st.pick = i.id; render(); } },
    h('span.box', {}, st.pick === i.id ? '✓' : ''),
    h('div.grow', {}, h('div', { style: { fontSize: '16px' } }, i.displayName),
      st.pick === i.id && h('p.caption', { style: { marginTop: '6px' } }, i.evidenceNote)));

  const customField = h('input.field', { placeholder: 'Name it', value: st.custom, oninput: (e) => { st.custom = e.target.value; start.disabled = !e.target.value.trim(); } });
  const noteField = h('textarea.field', { placeholder: 'What exactly will you do? e.g. “20 minutes of heat, evenings”', rows: 2, oninput: (e) => { st.note = e.target.value; } }, st.note);
  const start = h('button.btn.primary', { disabled: !chosen, onclick: async () => {
    const pick = st.pick === 'custom' ? customIntervention(st.custom.trim()) : chosen;
    await store.startTrial({ intervention: pick, outcomeId: st.outcomeId, note: st.note.trim() || null });
    ui.setup = null; ui.sheet = null; ui.tab = 'today'; render();
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
    h('p.label', {}, 'Measured by'),
    h('div.stack.tight', {}, Object.values(OUTCOMES).map((o) => h(`button.check${st.outcomeId === o.id ? '.on' : ''}`, { onclick: () => { st.outcomeId = o.id; render(); } },
      h('span.box', {}, st.outcomeId === o.id ? '✓' : ''), h('div', { style: { fontSize: '16px' } }, o.displayName)))),
    h('p.label', {}, 'Your plan'), noteField,
    card('sage', h('p.label.sage', {}, 'What this trial can see'),
      h('p.body', {}, `10 alternating weeks, on and off in a random order, with 3 quiet days between each — 97 days in all. ${sd != null ? 'With how much your scores move' : 'For typical day-to-day variation'}, it could reliably detect a change of about ${fmt(detect)} points${outcome.important != null ? `; a change worth caring about is around ${fmt(outcome.important, 0)}` : ''}.${outcome.important != null && detect > outcome.important ? ' A real change smaller than that could be missed — the result will say so if it is.' : ''}`),
      sd == null && h('p.caption', {}, 'Finish at least 10 baseline days and this becomes a number about you.')),
    start,
  ];
}

// ── result tab ───────────────────────────────────────────────────────────────────

function resultBlock(a, record) {
  const trial = a.trial;
  const ready = !(a.verdict.kind === 'inconclusive' && ['insufficientData', 'tooFewCompletedBlocks'].includes(a.verdict.reason));
  const rerun = rerunSuggestion(a);
  const title = {
    meaningful: a.verdict.direction === 'improved' ? 'This seems to help.' : 'This seems to make things worse.',
    probable: 'Something changed.',
    null: 'No meaningful effect.',
    inconclusive: ready ? 'Not settled.' : 'Too early to say.',
  }[a.verdict.kind];
  const span = 5;
  const pos = (v) => `${Math.max(0, Math.min(100, ((v + span) / (2 * span)) * 100))}%`;
  const better = a.outcome.lowerIsBetter ? 'Better' : 'Worse';
  const worse = a.outcome.lowerIsBetter ? 'Worse' : 'Better';

  return h('div.stack', {},
    h('p.label.sage', {}, trial.conditionB.displayName),
    h('h1.display', {}, title),
    h('p.reading', {}, headline(a)),
    ready && Number.isFinite(a.low) && card('',
      h('p.label', {}, 'The likely range of the real effect'),
      h('div', { style: { position: 'relative', height: '40px' } },
        h('div', { style: { position: 'absolute', top: '19px', left: 0, right: 0, height: '2px', background: 'var(--line)' } }),
        h('div', { style: { position: 'absolute', top: '10px', bottom: '10px', left: pos(-a.thresholds.trivial), width: `calc(${pos(a.thresholds.trivial)} - ${pos(-a.thresholds.trivial)})`, background: 'var(--band-wash)', borderRadius: '4px' } }),
        h('div', { style: { position: 'absolute', top: '14px', height: '12px', left: pos(a.low), width: `calc(${pos(a.high)} - ${pos(a.low)})`, background: 'var(--sage)', borderRadius: '6px', opacity: 0.55 } }),
        h('div', { style: { position: 'absolute', top: '10px', height: '20px', width: '3px', left: `calc(${pos(a.effect)} - 1px)`, background: 'var(--ink)', borderRadius: '2px' } })),
      h('div.row.between.caption', {}, h('span', {}, `← ${better}`), h('span', {}, 'No change'), h('span', {}, `${worse} →`)),
      h('p.caption', {}, `Best estimate ${a.effect > 0 ? '+' : ''}${fmt(a.effect)} points; 95% range ${fmt(a.low)} to ${fmt(a.high)}. The shaded middle is too small to matter.`)),
    rerun && card('sage', h('p.label.sage', {}, 'Next'), h('p.body', {}, rerun)),
    card('', h('p.label', {}, 'Scores'), trace(record.entries, trial, { today: record.finishedOn ? null : store.currentDay }), traceLegend(trial)),
    ready && a.threats.length > 0 && card('', h('p.label', {}, 'Worth knowing'), a.threats.map((t) => h('p.body', {}, describeThreat(t)))),
    h('button.btn.outline', { onclick: () => openSheet('clinician', { a }) }, 'Summary for a clinician'));
}

function resultTab() {
  const running = store.running;
  const a = running ? store.analysis(running) : null;
  const history = store.completed.slice().reverse();
  return h('div.stack', {},
    a ? resultBlock(a, running)
      : header('No result yet', running ? 'Keep logging — the first comparison appears once a few weeks have finished.'
        : history.length ? 'Nothing running right now. Your earlier results are below.' : 'Results appear here once a trial is running.'),
    running && store.isFinished && h('button.btn.primary', { onclick: () => openSheet('endTrial') }, 'Close this trial and keep the result'),
    history.length > 0 && h('div.stack.tight', {}, h('p.label', {}, 'Earlier trials'),
      history.map((r) => {
        const ra = store.analysis(r);
        return h('button.check', { onclick: () => openSheet('past', { record: r }) },
          h('div.grow', {}, h('div', { style: { fontSize: '16px' } }, r.trial.conditionB.displayName),
            h('p.caption', {}, `Finished ${new Date(r.finishedOn).toLocaleDateString()} · ${ra ? { meaningful: 'clear change', probable: 'some change', null: 'no meaningful effect', inconclusive: 'not settled' }[ra.verdict.kind] : 'no data'}`)),
          h('span.muted', {}, '›'));
      })));
}

// ── practice ─────────────────────────────────────────────────────────────────────

function practiceTab() {
  return h('div.stack', {},
    header('Practice', 'Short guided pauses. The same every time, for when you need something to do with your attention.'),
    PRACTICES.map((p) => card('',
      h('div.row.between', {}, h('h2', { style: { margin: 0, fontSize: '18px', fontWeight: 600 } }, p.title), h('span.caption', {}, p.subtitle)),
      h('p.body', {}, p.note),
      h('button.btn.primary', { onclick: () => play(p) }, 'Begin'))));
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

function moreTab() {
  const download = () => {
    const blob = new Blob([store.exportText()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `litmus-${store.person.name.toLowerCase().replace(/\W+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return h('div.stack', {},
    header('More'),
    card('clay', h('p.label', {}, 'If you’re struggling right now'),
      h('p.body', {}, 'Pain that doesn’t let up can be exhausting in ways that are hard to explain. If you’re thinking about harming yourself, please reach out now.'),
      h('a.btn.primary', { href: 'tel:988', style: { textDecoration: 'none' } }, 'Call or text 988 (US & Canada)'),
      h('p.caption', {}, 'UK & Ireland: Samaritans on 116 123. Elsewhere: ', h('a', { href: 'https://findahelpline.com', target: '_blank', rel: 'noopener' }, 'findahelpline.com'), '. In an emergency, call your local emergency number.')),
    card('', h('p.label', {}, 'Your data'),
      h('p.body', {}, 'Everything is stored in this browser on this device, and nowhere else. Export a copy now and then — it’s the same file the iPhone app reads, so it also moves you between the two.'),
      !standalone && h('p.caption', {}, 'Tip: in Safari, Share → Add to Home Screen. An installed web app keeps its data more reliably than a browser tab.'),
      !store.persisted && h('p.caption', {}, 'This browser hasn’t promised to keep the data under storage pressure, so a regular export matters more.'),
      h('button.btn.outline', { onclick: download }, 'Export my data'),
      restoreButton()),
    card('', h('p.label', {}, 'How the result is worked out'),
      h('p.body', {}, 'Your trial switches the thing being tested on and off in randomised weeks. Litmus compares each on-week with the off-week beside it, so slow drifts and good or bad stretches mostly cancel out, and it only calls something a real change when the whole plausible range clears the “too small to matter” band.'),
      h('p.caption', {}, 'It can’t control for expectation — you know when you’re doing the thing — and it isn’t medical advice.')),
    card('', h('p.label', {}, 'About'),
      h('p.body', {}, 'Litmus is not a doctor, doesn’t diagnose, and never tells you what to take. It helps you learn about your pain, test options fairly, and bring a clear record to the people who treat you.')));
}

// ── sheets ───────────────────────────────────────────────────────────────────────

function openSheet(kind, data = {}) { ui.sheet = { kind, ...data }; render(); }
function closeSheet() { ui.sheet = null; ui.setup = null; render(); }

function sheet() {
  const sh = ui.sheet;
  let title, body;
  switch (sh.kind) {
    case 'people': title = 'Profile'; body = peopleSheet(); break;
    case 'setup': title = 'Set up a trial'; body = setupSheet(); break;
    case 'clinician': {
      const text = clinicianSummary(sh.a, store.person.name);
      title = 'For a clinician';
      body = [h('p.body', {}, 'One page to show or send. It states the method, the result and its limits, and recommends nothing.'),
        card('', h('pre.pre', {}, text)),
        h('button.btn.primary', { onclick: async () => {
          try { if (navigator.share) await navigator.share({ title: 'Self-experiment summary', text }); else { await navigator.clipboard.writeText(text); toast('Copied.'); } } catch {}
        } }, navigator.share ? 'Share' : 'Copy')];
      break;
    }
    case 'past': {
      const a = store.analysis(sh.record);
      title = 'Earlier trial';
      body = a ? [resultBlock(a, sh.record)] : [h('p.body', {}, 'No days were logged in this trial.')];
      break;
    }
    case 'endTrial':
      title = 'End this trial';
      body = [h('p.reading', {}, store.isFinished
          ? 'This keeps the result in your history and frees you to test something else.'
          : 'Ending early keeps what you’ve logged, but a shorter trial can say much less. The result is saved in your history either way.'),
        h('button.btn.primary', { onclick: async () => { await store.archiveCurrent(); ui.sheet = null; ui.tab = 'result'; render(); } }, store.isFinished ? 'Close and keep the result' : 'End it now'),
        h('button.btn.outline', { onclick: closeSheet }, 'Keep going')];
      break;
    default: return null;
  }
  const panel = h('div.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: (e) => e.stopPropagation() },
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
  await store.startTrial({ intervention: LIBRARY[4], outcomeId: 'pain.intensity-nrs-11', note: 'Heat pad, 20 minutes each evening' });
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

const TABS = [
  ['today', 'Today', 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z'],
  ['trial', 'Trial', 'M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3'],
  ['result', 'Result', 'M4 19V5M4 19h16M8 15l3-4 3 2 5-6'],
  ['practice', 'Practice', 'M12 21c-4-3-8-6-8-11a4 4 0 018-1 4 4 0 018 1c0 5-4 8-8 11z'],
  ['more', 'More', 'M5 12h.01M12 12h.01M19 12h.01'],
];

function tabbar() {
  return h('nav.tabbar', { 'aria-label': 'Sections' }, TABS.map(([id, label, d]) =>
    h(`button.tab${ui.tab === id ? '.on' : ''}`, { 'aria-current': ui.tab === id ? 'page' : null, onclick: () => { ui.tab = id; render(); window.scrollTo(0, 0); } },
      s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': id === 'more' ? 3 : 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s('path', { d })),
      label)));
}

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
  window.scrollTo(0, y);
  const panel = root.querySelector('.sheet');
  if (panel) panel.scrollTop = sheetY;
  if (focusedName) root.querySelector(`[placeholder="${CSS.escape(focusedName)}"]`)?.focus();
}

// A new day can begin while the app sits open.
let lastDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && new Date().toDateString() !== lastDay) { lastDay = new Date().toDateString(); render(); }
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
