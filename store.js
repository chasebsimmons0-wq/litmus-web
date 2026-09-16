// On-device storage for the web app: IndexedDB, one record per person.
//
// Same shape of history as the native app: people, each with a profile, a baseline and
// their trials; days indexed from a start date; several readings a day folded into a
// mean. Nothing leaves the device except through an export the person makes.

import { makeTrial, plannedDays, analyze } from './engine.js';
import { OUTCOME_RECORDS, USUAL_CARE } from './content.js';

const DB_NAME = 'litmus';
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
    this.people = (await tx(this.db, 'readonly', (s) => s.getAll())) || [];
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

  // Trials

  get running() { return this.person?.trials.find((t) => !t.finishedOn) ?? null; }
  get trial() { return this.running?.trial ?? null; }
  get entries() { return this.running?.entries ?? []; }
  get completed() { return (this.person?.trials ?? []).filter((t) => t.finishedOn); }

  async startTrial({ intervention, outcomeId, note, blockCount = 10, blockDays = 7, washoutDays = 3 }) {
    // Kept below 2^53 so the seed survives a round trip through JSON exactly.
    const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const trial = makeTrial({
      intervention, outcomeId, blockCount, blockDays, washoutDays, seed,
      startDate: isoDate(startOfDay()), note,
    });
    trial.conditionA = USUAL_CARE;
    this.person.trials.push({ id: trial.id, trial, entries: [], finishedOn: null });
    await this.save();
  }

  async archiveCurrent() {
    const r = this.running;
    if (!r) return;
    r.finishedOn = isoDate(new Date());
    await this.save();
  }

  get currentDay() {
    const t = this.trial;
    if (!t) return null;
    const d = daysBetween(t.startDate);
    return d >= 0 && d < plannedDays(t) ? d : null;
  }

  get isFinished() {
    const t = this.trial;
    return !!t && daysBetween(t.startDate) >= plannedDays(t);
  }

  get elapsedDays() {
    const t = this.trial;
    if (!t) return 0;
    return Math.min(plannedDays(t), Math.max(0, daysBetween(t.startDate) + 1));
  }

  analysis(record = this.running) {
    if (!record) return null;
    return analyze(record.trial, record.entries);
  }

  // Baseline

  get baselineDay() {
    const start = this.person?.baselineStartedOn;
    return start ? Math.max(0, daysBetween(start)) : null;
  }

  get baselineVariability() {
    const s = (this.person?.baseline ?? []).map((e) => e.score);
    if (s.length < 10) return null;
    const m = s.reduce((x, y) => x + y, 0) / s.length;
    return Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / (s.length - 1));
  }

  // Logging — today's entry, wherever today belongs

  todaysPool() {
    if (this.trial) return this.currentDay == null ? null : { list: this.running.entries, day: this.currentDay };
    const day = this.baselineDay;
    return day == null ? null : { list: this.person.baseline, day };
  }

  get today() {
    const pool = this.todaysPool();
    return pool ? pool.list.find((e) => e.day === pool.day) ?? null : null;
  }

  /// Tapping a number sets the day outright; a correction never silently becomes an
  /// average. Further readings come through `addReading`.
  async log(score) {
    const pool = this.todaysPool();
    if (!pool) return;
    const existing = pool.list.find((e) => e.day === pool.day);
    if (existing) {
      if (existing.score !== score) Object.assign(existing, { score, sampleCount: 1, sampleSum: score });
    } else {
      pool.list.push(entry(pool.day, score));
      pool.list.sort((a, b) => a.day - b.day);
    }
    await this.save();
  }

  async addReading(value) {
    const e = this.today;
    if (!e) return;
    e.sampleSum += value;
    e.sampleCount += 1;
    e.score = e.sampleSum / e.sampleCount;
    await this.save();
  }

  async setFlare(on) {
    const e = this.today;
    if (!e) return;
    e.isFlare = on;
    await this.save();
  }

  async setAdherence(done) {
    const e = this.today;
    if (!e) return;
    e.adhered = done;
    await this.save();
  }

  async setNote(text) {
    const e = this.today;
    if (!e) return;
    e.note = text.trim() || null;
    await this.save();
  }

  // Export — litmus.export.v2, readable by the native app and by `paincheck analyse`

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
      schema: 'litmus.export.v2',
      exportedAt: isoDate(new Date()),
      person: p.name,
      profile,
      baseline: p.baseline.map(plainEntry),
      completedTrials: this.completed.map((r) => ({
        trial: toNativeTrial(r.trial, 'completed'), entries: r.entries.map(plainEntry), finishedOn: r.finishedOn,
      })),
      currentEntries: this.entries.map(plainEntry),
    };
    if (this.trial) root.currentTrial = toNativeTrial(this.trial, 'running');
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
    if (data.currentTrial) {
      const trial = fromNativeTrial(data.currentTrial);
      trials.push({ id: trial.id, trial, entries: (data.currentEntries ?? []).map(readEntry), finishedOn: null });
    }
    const baseline = (data.baseline ?? []).map(readEntry);

    const person = await this.addPerson(data.person ? `${data.person} (restored)` : 'Restored');
    if (data.profile) {
      person.profile = { ...emptyProfile(), ...data.profile };
      person.baselineStartedOn = data.profile.baselineStartedOn ?? null;
    }
    person.baseline = baseline;
    person.trials = trials;
    await this.save(person);
    return person.name;
  }
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
