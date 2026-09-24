// On-device storage for the web app: IndexedDB, one record per person.
//
// Same shape of history as the native app: people, each with a profile, a baseline and
// their trials; days indexed from a start date; several readings a day folded into a
// mean. Nothing leaves the device except through an export the person makes.

import { makeTrial, plannedDays, analyze, blockCountForOverlaps, conditionFor, phaseOnDay, PAIN_ID, TRIAL_DEFAULTS } from './engine.js';
import { dayKey } from './tracking.js';
import { OUTCOME_RECORDS, USUAL_CARE } from './content.js';

const DB_NAME = 'litmus';
const PAIN = PAIN_ID;

/** Baseline days needed before a trial can be sized to the person's own variability. */
export const BASELINE_MIN_DAYS = 10;
/** What the baseline screen counts towards: "a week or two" of ordinary days. */
export const BASELINE_SUGGESTED_DAYS = 14;
const STORE = 'people';
const ACTIVE_KEY = 'litmus.active';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// ── dates ─────────────────────────────────────────────────────────────────────────

export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function daysBetween(from, to = new Date()) {
  const a = startOfDay(new Date(from));
  const b = startOfDay(to);
  // Rounded rather than floored: a daylight-saving change makes one day 23 or 25 hours.
  return Math.round((b - a) / 86400000);
}

/// ISO 8601 without fractional seconds, which is what Swift's `.iso8601` strategy
/// reads. A millisecond suffix would make every export unreadable by the native app.
export const isoDate = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');

export const emptyProfile = () => ({
  sites: [], qualities: [], diagnosesGiven: [], alreadyTried: [], factors: [], redFlags: [],
  yearsWithPain: null, completedOnboarding: false, baselineStartedOn: null,
});

function entry(day, score, extra = {}) {
  return { day, score, sampleCount: 1, sampleSum: score, adhered: null, isFlare: false, note: null, ...extra };
}

// ── the store ─────────────────────────────────────────────────────────────────────

export class Store {
  constructor() {
    this.people = [];
    this.person = null;
    this.listeners = new Set();
    this.persisted = false;
  }

  async open() {
    this.db = await openDB();
    this.people = ((await tx(this.db, 'readonly', (s) => s.getAll())) || []).map(upgrade);
    this.people.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let active = null;
    try { active = localStorage.getItem(ACTIVE_KEY); } catch {}
    this.person = this.people.find((p) => p.id === active) ?? null;
    // Asks the browser not to evict this origin's data under storage pressure. Safari
    // grants it for an installed web app; elsewhere it may be declined silently.
    try { this.persisted = (await navigator.storage?.persist?.()) ?? false; } catch {}
  }

  onChange(fn) { this.listeners.add(fn); }
  changed() { for (const fn of this.listeners) fn(); }

  async save(person = this.person) {
    if (!person) return;
    person.updatedAt = isoDate(new Date());
    await tx(this.db, 'readwrite', (s) => s.put(structuredClone(person)));
    this.changed();
  }

  // People

  async addPerson(name) {
    const base = name.trim() || 'Me';
    let chosen = base;
    for (let n = 2; this.people.some((p) => p.name.toLowerCase() === chosen.toLowerCase()); n++) {
      chosen = `${base} ${n}`;
    }
    const now = isoDate(new Date());
    const person = {
      id: crypto.randomUUID(), name: chosen, createdAt: now, updatedAt: now,
      profile: emptyProfile(), baselineStartedOn: null, baseline: [], trials: [],
      symptoms: [], symptomScores: {}, medications: [], lastBackupAt: null,
      journal: [], flarePlan: {}, questions: [],
    };
    this.people.push(person);
    this.use(person, false);
    await this.save(person);
    return person;
  }

  use(person, notify = true) {
    this.person = person;
    try { localStorage.setItem(ACTIVE_KEY, person.id); } catch {}
    if (notify) this.changed();
  }

  switchProfile() {
    this.person = null;
    try { localStorage.removeItem(ACTIVE_KEY); } catch {}
    this.changed();
  }

  async deletePerson(person) {
    await tx(this.db, 'readwrite', (s) => s.delete(person.id));
    this.people = this.people.filter((p) => p.id !== person.id);
    if (this.person?.id === person.id) this.switchProfile();
    else this.changed();
  }

  async restartCurrent() {
    const p = this.person;
    if (!p) return;
    p.profile = emptyProfile();
    p.baselineStartedOn = null;
    p.baseline = [];
    p.trials = [];
    p.symptoms = [];
    p.symptomScores = {};
    p.medications = [];
    p.journal = [];
    p.flarePlan = {};
    p.questions = [];
    await this.save();
  }

  // Profile

  get profile() { return this.person?.profile ?? emptyProfile(); }

  async saveProfile(profile) {
    const p = this.person;
    p.profile = profile;
    if (!p.baselineStartedOn && profile.completedOnboarding) {
      p.baselineStartedOn = profile.baselineStartedOn ?? isoDate(startOfDay());
    }
    await this.save();
  }

  // Trials — several can run at once

  get activeRecords() {
    return (this.person?.trials ?? []).filter((t) => !t.finishedOn)
      .sort((x, y) => x.trial.startDate.localeCompare(y.trial.startDate));
  }

  /** The trial the Trial and Result tabs describe: the chosen one, else the oldest. */
  get running() {
    const active = this.activeRecords;
    return active.find((r) => r.id === this.focusedId) ?? active[0] ?? null;
  }

  focus(id) { this.focusedId = id; this.changed(); }

  get trial() { return this.running?.trial ?? null; }
  get entries() { return this.running?.entries ?? []; }
  get completed() { return (this.person?.trials ?? []).filter((t) => t.finishedOn); }

  dayIn(record) {
    const d = daysBetween(record.trial.startDate);
    return d >= 0 && d < plannedDays(record.trial) ? d : null;
  }

  /** Active trials on one of their planned days today. */
  get overlapsForNewTrial() { return this.activeRecords.filter((r) => this.dayIn(r) != null).length; }

  async startTrial({ intervention, comparator = null, outcomeId, note, blockDays = TRIAL_DEFAULTS.blockDays, washoutDays = TRIAL_DEFAULTS.washoutDays }) {
    // Kept below 2^53 so the seed survives a round trip through JSON exactly.
    const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const trial = makeTrial({
      intervention, comparator, outcomeId, blockCount: blockCountForOverlaps(this.overlapsForNewTrial), blockDays, washoutDays, seed,
      startDate: isoDate(startOfDay()), note,
    });
    if (!comparator) trial.conditionA = USUAL_CARE;
    // Swift writes UUIDs in capitals; matching that keeps ids stable across a round trip.
    trial.id = trial.id.toUpperCase();
    this.person.trials.push({ id: trial.id, trial, entries: [], finishedOn: null });
    this.focusedId = trial.id;
    await this.save();
  }

  async archiveCurrent() {
    const r = this.running;
    if (!r) return;
    r.finishedOn = isoDate(new Date());
    this.focusedId = null;
    await this.save();
  }

  get currentDay() { return this.running ? this.dayIn(this.running) : null; }

  /** Nothing to log: every active trial is past its last day. */
  get isFinished() {
    const active = this.activeRecords;
    return active.length > 0 && active.every((r) => this.dayIn(r) == null && daysBetween(r.trial.startDate) >= 0);
  }

  get focusedIsFinished() {
    const t = this.trial;
    return !!t && daysBetween(t.startDate) >= plannedDays(t);
  }

  get elapsedDays() {
    const t = this.trial;
    if (!t) return 0;
    return Math.min(plannedDays(t), Math.max(0, daysBetween(t.startDate) + 1));
  }

  /** Every other trial, positioned against this one; the engine keeps the overlaps. */
  concurrentWith(trial) {
    return (this.person?.trials ?? [])
      .filter((r) => r.trial.id !== trial.id)
      .map((r) => ({
        trial: r.trial,
        dayOffset: daysBetween(r.trial.startDate, new Date(trial.startDate)),
        lastDay: r.finishedOn ? daysBetween(r.trial.startDate, new Date(r.finishedOn)) : null,
      }));
  }

  analysis(record = this.running) {
    if (!record) return null;
    return analyze(record.trial, record.entries, this.concurrentWith(record.trial));
  }

  // Baseline

  get baselineDay() {
    const start = this.person?.baselineStartedOn;
    return start ? Math.max(0, daysBetween(start)) : null;
  }

  get baselineVariability() {
    const s = (this.person?.baseline ?? []).map((e) => e.score);
    if (s.length < BASELINE_MIN_DAYS) return null;
    const m = s.reduce((x, y) => x + y, 0) / s.length;
    return Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / (s.length - 1));
  }

  // Logging — one score a day, shared by every trial running today

  /** Where today's score goes. Shared between trials, but only those measuring the
   *  same thing; `outcomeId` null means every pool. */
  todaysPools(outcomeId = null) {
    const active = this.activeRecords;
    if (active.length) {
      return active.map((r) => ({ list: r.entries, day: this.dayIn(r), record: r }))
        .filter((p) => p.day != null && (!outcomeId || p.record.trial.outcomeId === outcomeId));
    }
    const day = this.baselineDay;
    if (day == null || (outcomeId && outcomeId !== PAIN)) return [];
    return [{ list: this.person.baseline, day, record: null }];
  }

  /** The measures asked about today, in the order their trials started. */
  get todaysOutcomes() {
    if (!this.activeRecords.length) return this.baselineDay == null ? [] : [PAIN];
    return [...new Set(this.todaysPools().map((p) => p.record.trial.outcomeId))];
  }

  todaysEntries(outcomeId = null) {
    return this.todaysPools(outcomeId).map((p) => p.list.find((e) => e.day === p.day)).filter(Boolean);
  }

  todayFor(outcomeId) { return this.todaysEntries(outcomeId)[0] ?? null; }

  get today() { return this.todaysEntries()[0] ?? null; }

  /// Tapping a number sets the day outright; a correction never silently becomes an
  /// average. Further readings come through `addReading`.
  async log(score, outcomeId = this.todaysOutcomes[0]) {
    for (const pool of this.todaysPools(outcomeId)) {
      const existing = pool.list.find((e) => e.day === pool.day);
      if (existing) {
        if (existing.score !== score) Object.assign(existing, { score, sampleCount: 1, sampleSum: score });
      } else {
        pool.list.push(entry(pool.day, score));
        pool.list.sort((a, b) => a.day - b.day);
      }
    }
    await this.save();
  }

  async clearToday(outcomeId = null) {
    for (const pool of this.todaysPools(outcomeId)) {
      const i = pool.list.findIndex((e) => e.day === pool.day);
      if (i >= 0) pool.list.splice(i, 1);
    }
    await this.save();
  }

  async addReading(value, outcomeId = this.todaysOutcomes[0]) {
    for (const e of this.todaysEntries(outcomeId)) {
      e.sampleSum += value;
      e.sampleCount += 1;
      e.score = e.sampleSum / e.sampleCount;
    }
    await this.save();
  }

  async setFlare(on) {
    for (const e of this.todaysEntries()) e.isFlare = on;
    await this.save();
  }

  async setNote(text) {
    for (const e of this.todaysEntries()) e.note = text.trim() || null;
    await this.save();
  }

  /** Active trials on an "on" day today: each asks, separately, whether it was done. */
  get trialsAskingAdherence() {
    return this.todaysPools().filter((p) => p.record && conditionFor(p.record.trial, phaseOnDay(p.record.trial, p.day)?.kind));
  }

  async setAdherence(trialId, done) {
    const pool = this.todaysPools().find((p) => p.record?.id === trialId);
    const e = pool?.list.find((x) => x.day === pool.day);
    if (!e) return;
    e.adhered = done;
    await this.save();
  }

  // Symptoms

  get trackedSymptoms() { return (this.person?.symptoms ?? []).filter((x) => !x.archivedAt); }

  async addSymptom(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = this.person.symptoms.find((x) => x.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) existing.archivedAt = null;
    else this.person.symptoms.push({ id: crypto.randomUUID().toUpperCase(), name: trimmed, createdAt: isoDate(new Date()), archivedAt: null });
    await this.save();
  }

  async stopTracking(id) {
    const x = this.person.symptoms.find((y) => y.id === id);
    if (x) x.archivedAt = isoDate(new Date());
    await this.save();
  }

  symptomScore(id, key = dayKey()) { return this.person?.symptomScores?.[key]?.[id] ?? null; }

  async setSymptomScore(id, value) {
    const key = dayKey();
    (this.person.symptomScores[key] ??= {})[id] = value;
    await this.save();
  }

  symptomSeries(id) {
    const out = {};
    for (const [key, row] of Object.entries(this.person?.symptomScores ?? {})) if (row[id] != null) out[key] = row[id];
    return out;
  }

  /** Pain by calendar day, from the baseline and every pain trial. */
  painByDay() {
    const out = {};
    const p = this.person;
    const at = (start, day) => { const d = startOfDay(new Date(start)); d.setDate(d.getDate() + day); return dayKey(d); };
    if (p?.baselineStartedOn) for (const e of p.baseline) out[at(p.baselineStartedOn, e.day)] = e.score;
    for (const r of p?.trials ?? []) {
      if (r.trial.outcomeId !== PAIN) continue;
      for (const e of r.entries) out[at(r.trial.startDate, e.day)] = e.score;
    }
    return out;
  }

  /** Whole days since anything was last scored, or null if nothing ever has been. */
  get daysSinceLastLog() {
    const p = this.person;
    const at = (start, day) => { const d = startOfDay(new Date(start)); d.setDate(d.getDate() + day); return d; };
    let last = null;
    const see = (start, entries) => {
      for (const e of entries) { const d = at(start, e.day); if (!last || d > last) last = d; }
    };
    if (p?.baselineStartedOn) see(p.baselineStartedOn, p.baseline);
    for (const r of p?.trials ?? []) see(r.trial.startDate, r.entries);
    return last ? daysBetween(last) : null;
  }

  /** Pain over the last `window` days: mean, days logged and flare days. */
  recentPain(window = 28) {
    const p = this.person;
    const cutoff = startOfDay(); cutoff.setDate(cutoff.getDate() - (window - 1));
    const byDay = new Map();
    const at = (start, day) => { const d = startOfDay(new Date(start)); d.setDate(d.getDate() + day); return d; };
    const see = (start, entries) => {
      for (const e of entries) { const d = at(start, e.day); if (d >= cutoff) byDay.set(dayKey(d), e); }
    };
    if (p?.baselineStartedOn) see(p.baselineStartedOn, p.baseline);
    for (const r of p?.trials ?? []) if (r.trial.outcomeId === PAIN) see(r.trial.startDate, r.entries);
    const days = [...byDay.values()];
    return {
      window, days: days.length, flareDays: days.filter((e) => e.isFlare).length,
      mean: days.length ? days.reduce((x, e) => x + e.score, 0) / days.length : null,
    };
  }

  // Journal, flare plan and appointment questions — the person's own words

  get journal() { return (this.person?.journal ?? []).slice().sort((a, b) => b.date.localeCompare(a.date)); }

  async addJournalEntry(text) {
    const t = text.trim();
    if (!t) return;
    this.person.journal.push({ id: crypto.randomUUID().toUpperCase(), date: isoDate(new Date()), text: t });
    await this.save();
  }

  async deleteJournalEntry(id) {
    this.person.journal = this.person.journal.filter((x) => x.id !== id);
    await this.save();
  }

  get flarePlan() { return this.person?.flarePlan ?? {}; }

  async setFlarePlan(field, text) {
    this.person.flarePlan = { ...this.person.flarePlan, [field]: text.trim() || undefined };
    await this.save();
  }

  get questions() { return this.person?.questions ?? []; }

  async addQuestion(text) {
    const t = text.trim();
    if (!t) return;
    this.person.questions.push({ id: crypto.randomUUID().toUpperCase(), text: t });
    await this.save();
  }

  async removeQuestion(id) {
    this.person.questions = this.person.questions.filter((x) => x.id !== id);
    await this.save();
  }

  // Medications — tracked, never tested

  get medications() {
    return (this.person?.medications ?? []).slice().sort((a, b) => b.startedOn.localeCompare(a.startedOn));
  }

  async addMedication({ name, dose, startedOn, note }) {
    this.person.medications.push({
      id: crypto.randomUUID().toUpperCase(), name: name.trim(), dose: dose?.trim() || null,
      startedOn, stoppedOn: null, note: note?.trim() || null, doseChanges: [],
    });
    await this.save();
  }

  async updateMedication(id, change) {
    const m = this.person.medications.find((x) => x.id === id);
    if (!m) return;
    change(m);
    m.doseChanges.sort((a, b) => a.date.localeCompare(b.date));
    await this.save();
  }

  async deleteMedication(id) {
    this.person.medications = this.person.medications.filter((x) => x.id !== id);
    await this.save();
  }

  // Backups

  get daysSinceBackup() {
    const last = this.person?.lastBackupAt;
    return last ? Math.max(0, daysBetween(last)) : null;
  }

  get backupIsDue() {
    if (!this.person || daysBetween(this.person.createdAt) < 7) return false;
    return (this.daysSinceBackup ?? Infinity) >= 14;
  }

  async markBackedUp() {
    this.person.lastBackupAt = isoDate(new Date());
    await this.save();
  }

  // Export — litmus.export.v3, readable by the native app and by `paincheck analyse`

  exportText() {
    const p = this.person;
    const plainEntry = (e) => {
      const out = { day: e.day, score: e.score, isFlare: !!e.isFlare };
      if (e.adhered != null) out.adhered = e.adhered;
      if (e.note) out.note = e.note;
      return out;
    };
    const profile = { ...p.profile, baselineStartedOn: p.baselineStartedOn ?? p.profile.baselineStartedOn };
    for (const k of ['yearsWithPain', 'baselineStartedOn']) if (profile[k] == null) delete profile[k];

    const root = {
      schema: 'litmus.export.v3',
      exportedAt: isoDate(new Date()),
      person: p.name,
      profile,
      baseline: p.baseline.map(plainEntry),
      completedTrials: this.completed.map((r) => ({
        trial: toNativeTrial(r.trial, 'completed'), entries: r.entries.map(plainEntry), finishedOn: r.finishedOn,
      })),
      activeTrials: this.activeRecords.map((r) => ({ trial: toNativeTrial(r.trial, 'running'), entries: r.entries.map(plainEntry) })),
      // Version 2 readers only know one running trial.
      currentEntries: (this.activeRecords[0]?.entries ?? []).map(plainEntry),
      symptoms: p.symptoms.map((x) => {
        const row = { id: x.id, name: x.name, createdAt: x.createdAt };
        if (x.archivedAt) row.archivedAt = x.archivedAt;
        return row;
      }),
      symptomScores: Object.entries(p.symptomScores).sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([date, row]) => Object.entries(row).sort(([a], [b]) => a.localeCompare(b))
          .map(([symptomId, score]) => ({ symptomId, date, score }))),
      medications: p.medications.map((m) => {
        const row = { id: m.id, name: m.name, startedOn: m.startedOn, doseChanges: m.doseChanges };
        for (const k of ['dose', 'stoppedOn', 'note']) if (m[k]) row[k] = m[k];
        return row;
      }),
      // Web-only so far. Readers that don't know these keys ignore them.
      journal: p.journal,
      flarePlan: p.flarePlan,
      appointmentQuestions: p.questions,
    };
    if (this.activeRecords[0]) root.currentTrial = toNativeTrial(this.activeRecords[0].trial, 'running');
    // Seeds are 64-bit. They travel as strings inside JavaScript and are written back
    // out as bare numbers, so no digit is lost to floating point either way.
    return JSON.stringify(root, null, 2).replace(/"seed": "(\d+)"/g, '"seed": $1');
  }

  /// Restores into a new person, always. A restore that could overwrite would turn a
  /// recovery tool into a way to lose data.
  async importText(text) {
    let data;
    try { data = JSON.parse(text.replace(/"seed"\s*:\s*(\d+)/g, '"seed": "$1"')); } catch { throw new Error("That file couldn't be read."); }
    if (!data || typeof data !== 'object' || !('currentEntries' in data || 'baseline' in data || 'currentTrial' in data)) {
      throw new Error("That doesn't look like a Litmus export.");
    }
    // Everything is read before anything is written, so a file that fails halfway
    // leaves no half-restored person behind.
    const readEntry = (e) => entry(e.day, e.score, { adhered: e.adhered ?? null, isFlare: !!e.isFlare, note: e.note ?? null });
    const trials = [];
    for (const c of data.completedTrials ?? []) {
      const trial = fromNativeTrial(c.trial);
      trials.push({ id: trial.id, trial, entries: c.entries.map(readEntry), finishedOn: c.finishedOn });
    }
    if (Array.isArray(data.activeTrials)) {
      for (const a of data.activeTrials) {
        const trial = fromNativeTrial(a.trial);
        trials.push({ id: trial.id, trial, entries: a.entries.map(readEntry), finishedOn: null });
      }
    } else if (data.currentTrial) {
      const trial = fromNativeTrial(data.currentTrial);
      trials.push({ id: trial.id, trial, entries: (data.currentEntries ?? []).map(readEntry), finishedOn: null });
    }
    const baseline = (data.baseline ?? []).map(readEntry);
    const symptomScores = {};
    for (const x of data.symptomScores ?? []) (symptomScores[x.date] ??= {})[x.symptomId.toUpperCase()] = x.score;
    const symptoms = (data.symptoms ?? []).map((x) => ({
      id: x.id.toUpperCase(), name: x.name, createdAt: x.createdAt ?? isoDate(new Date()), archivedAt: x.archivedAt ?? null,
    }));
    const medications = (data.medications ?? []).map((m) => ({
      id: m.id.toUpperCase(), name: m.name, dose: m.dose ?? null, startedOn: m.startedOn,
      stoppedOn: m.stoppedOn ?? null, note: m.note ?? null, doseChanges: m.doseChanges ?? [],
    }));

    const person = await this.addPerson(data.person ? `${data.person} (restored)` : 'Restored');
    if (data.profile) {
      person.profile = { ...emptyProfile(), ...data.profile };
      person.baselineStartedOn = data.profile.baselineStartedOn ?? null;
    }
    person.baseline = baseline;
    person.trials = trials;
    person.symptoms = symptoms;
    person.symptomScores = symptomScores;
    person.medications = medications;
    person.journal = Array.isArray(data.journal) ? data.journal.filter((x) => x?.text && x?.date) : [];
    person.flarePlan = data.flarePlan && typeof data.flarePlan === 'object' ? data.flarePlan : {};
    person.questions = Array.isArray(data.appointmentQuestions) ? data.appointmentQuestions.filter((x) => x?.text) : [];
    await this.save(person);
    return person.name;
  }
}

/// People saved before a field existed get it filled in, so every screen can assume it.
function upgrade(p) {
  p.symptoms ??= [];
  p.symptomScores ??= {};
  p.medications ??= [];
  p.lastBackupAt ??= null;
  p.journal ??= [];
  p.flarePlan ??= {};
  p.questions ??= [];
  return p;
}

// ── conversion to and from the Swift `Trial` encoding ────────────────────────────

export function toNativeTrial(t, status) {
  const out = {
    id: t.id.toUpperCase(),
    design: t.design,
    conditionA: t.conditionA,
    conditionB: t.conditionB,
    outcome: OUTCOME_RECORDS[t.outcomeId],
    phases: t.phases.map((p) => ({
      id: (p.id ?? crypto.randomUUID()).toUpperCase(),
      kind: p.kind === 'washout' ? { washout: {} } : { condition: { _0: p.kind } },
      startDay: p.startDay,
      length: p.length,
    })),
    startDate: isoDate(t.startDate),
    allocation: { randomised: t.allocation.randomised, maximumRun: t.allocation.maximumRun },
    status,
  };
  if (t.allocation.seed != null) out.allocation.seed = String(t.allocation.seed);
  if (t.userNote) out.userNote = t.userNote;
  return out;
}

export function fromNativeTrial(n) {
  if (!OUTCOME_RECORDS[n.outcome?.id]) {
    throw new Error(`This trial measures “${n.outcome?.displayName ?? 'something'}”, which the web version can't record yet.`);
  }
  return {
    id: n.id,
    design: n.design,
    conditionA: n.conditionA,
    conditionB: n.conditionB,
    outcomeId: n.outcome.id,
    phases: n.phases.map((p) => ({
      id: p.id,
      kind: 'washout' in p.kind ? 'washout' : p.kind.condition._0,
      startDay: p.startDay,
      length: p.length,
    })),
    startDate: n.startDate,
    allocation: { ...n.allocation, seed: n.allocation.seed != null ? String(n.allocation.seed) : null },
    userNote: n.userNote ?? null,
  };
}
