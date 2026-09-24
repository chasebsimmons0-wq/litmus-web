// The community, as the brief describes it (§10.8): small, slow, asynchronous, and built
// around shared results rather than advice. This module holds the rules; where posts are
// kept is a backend behind one small interface. `LocalCommunity` keeps everything in this
// browser, so the whole experience can be tried before any server exists. Nothing in it
// is sent anywhere.
//
// The rules, enforced here so a server can enforce the same ones:
// - A post starts from a finished trial's anonymised result card. The note is optional.
// - Short text only, and no links: no selling, no protocols, no "DM me".
// - Crisis language never reaches other people. The post is held for a moderator and
//   the writer is shown where to get help.
// - No direct messages, no profiles: a pseudonymous handle, nothing else.

import { mentionsCrisis } from './safety.js';
import { LIBRARY, OUTCOME_RECORDS } from './content.js';

export const NOTE_LIMIT = 280;
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ca|uk|app|shop|store)\b|@[a-z0-9_]{3,})/i;
const ADVICE = /\byou (should|must|need to|have to)\b|\b(buy|dm me|message me)\b/i;

/** Checks a note or reply before it goes anywhere. */
export function checkText(text, { required = false } = {}) {
  const t = String(text ?? '').trim();
  if (required && !t) return { ok: false, problem: 'Write something first.' };
  if (t.length > NOTE_LIMIT) return { ok: false, problem: `Keep it under ${NOTE_LIMIT} characters.` };
  if (LINK.test(t)) return { ok: false, problem: 'Links and handles can’t be posted here. Share what happened, in your own words.' };
  return {
    ok: true, text: t,
    crisis: mentionsCrisis(t),
    // Not blocked, just a nudge back toward the room's one norm.
    soundsLikeAdvice: ADVICE.test(t),
  };
}

const ADJECTIVES = ['Quiet', 'Steady', 'Gentle', 'Patient', 'Curious', 'Kind', 'Calm', 'Hopeful', 'Slow', 'Warm'];
const ANIMALS = ['Otter', 'Heron', 'Badger', 'Wren', 'Hare', 'Seal', 'Moth', 'Fox', 'Newt', 'Lark'];

/** A pseudonymous handle, stable for a given seed, and never derived from a name. */
export function handleFor(seed) {
  let x = 0;
  for (const ch of String(seed)) x = (x * 31 + ch.codePointAt(0)) >>> 0;
  return `${ADJECTIVES[x % ADJECTIVES.length]} ${ANIMALS[Math.floor(x / ADJECTIVES.length) % ANIMALS.length]}`;
}

const nameFor = (option) => (option?.id === 'custom' ? 'Something of their own'
  : LIBRARY.find((i) => i.id === option?.id)?.displayName ?? 'Another option');

/** The headline of a result card, from an anonymised result alone. */
export function cardSummary(r) {
  const B = nameFor(r.trial.intervention);
  const A = r.trial.comparator ? nameFor(r.trial.comparator) : null;
  const res = r.result;
  const ahead = res?.direction === 'improved' ? B : A;
  let verdict;
  if (!res) verdict = 'No days logged';
  else if (A) {
    verdict = { meaningful: `${ahead} clearly did more`, probable: `${ahead} did a bit more, size uncertain`,
      null: 'No meaningful difference', inconclusive: 'Not settled' }[res.verdict];
  } else {
    verdict = {
      meaningful: res.direction === 'improved' ? 'Clearly helped' : 'Clearly made things worse',
      probable: res.direction === 'improved' ? 'Seemed to help, size uncertain' : 'Seemed to make things worse, size uncertain',
      null: 'No meaningful effect', inconclusive: 'Not settled',
    }[res.verdict];
  }
  const range = res && Number.isFinite(res.low) && Number.isFinite(res.high)
    ? `${(OUTCOME_RECORDS[r.trial.outcome]?.displayName ?? 'Score')}: ${res.effect > 0 ? '+' : ''}${res.effect.toFixed(1)} points (likely ${res.low.toFixed(1)} to ${res.high.toFixed(1)})` : null;
  const weeks = r.trial.blockCount * r.trial.blockDays / 7;
  return {
    title: A ? `${B} vs ${A}` : B,
    verdict,
    range,
    detail: `${Math.round(weeks)} alternating weeks · ${r.completion.loggedDays.a + r.completion.loggedDays.b} days logged${r.completion.ranFullLength ? '' : ' · ended early'}`,
  };
}

const uid = () => crypto.randomUUID().toUpperCase();
const now = () => new Date().toISOString();

/**
 * The backend interface, kept on this device. A server version would offer the same
 * methods and apply the same `checkText` rules on its side too.
 */
export class LocalCommunity {
  constructor(storage = globalThis.localStorage, key = 'litmus.community.preview') {
    this.storage = storage;
    this.key = key;
    this.state = this.load();
  }

  load() {
    try {
      const s = JSON.parse(this.storage?.getItem(this.key));
      if (s && Array.isArray(s.posts)) return s;
    } catch {}
    return { me: uid(), posts: [] };
  }

  save() { try { this.storage?.setItem(this.key, JSON.stringify(this.state)); } catch {} }

  get handle() { return handleFor(this.state.me); }

  /** What everyone can see: visible posts, newest first, with visible replies. */
  feed() {
    return this.state.posts.filter((p) => p.status === 'visible')
      .map((p) => ({ ...p, mine: p.author === this.state.me, replies: p.replies.filter((r) => r.status === 'visible' || r.author === this.state.me) }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  /** Posts and replies waiting for the moderator: held by the crisis check, or reported. */
  queue() {
    const out = [];
    for (const p of this.state.posts) {
      if (p.status === 'held' || p.reports.length) out.push({ kind: 'post', post: p, reason: p.status === 'held' ? 'crisis' : 'reported' });
      for (const r of p.replies) {
        if (r.status === 'held' || r.reports.length) out.push({ kind: 'reply', post: p, reply: r, reason: r.status === 'held' ? 'crisis' : 'reported' });
      }
    }
    return out;
  }

  /** Shares a finished trial. Returns { ok, held } or { ok: false, problem }. */
  post(result, note = '') {
    const check = checkText(note);
    if (!check.ok) return check;
    const p = {
      id: uid(), author: this.state.me, handle: this.handle, at: now(), result, note: check.text,
      status: check.crisis ? 'held' : 'visible', reports: [], replies: [],
    };
    this.state.posts.push(p);
    this.save();
    return { ok: true, held: check.crisis, soundsLikeAdvice: check.soundsLikeAdvice, id: p.id };
  }

  reply(postId, text) {
    const check = checkText(text, { required: true });
    if (!check.ok) return check;
    const p = this.state.posts.find((x) => x.id === postId);
    if (!p) return { ok: false, problem: 'That post is gone.' };
    p.replies.push({ id: uid(), author: this.state.me, handle: this.handle, at: now(), text: check.text,
      status: check.crisis ? 'held' : 'visible', reports: [] });
    this.save();
    return { ok: true, held: check.crisis, soundsLikeAdvice: check.soundsLikeAdvice };
  }

  report(postId, replyId = null, reason = 'other') {
    const p = this.state.posts.find((x) => x.id === postId);
    const target = replyId ? p?.replies.find((r) => r.id === replyId) : p;
    if (!target || target.reports.some((r) => r.by === this.state.me)) return false;
    target.reports.push({ by: this.state.me, reason, at: now() });
    this.save();
    return true;
  }

  /** Moderator decisions. `keep` clears reports and makes it visible; `remove` takes it down. */
  moderate(postId, replyId, decision) {
    const p = this.state.posts.find((x) => x.id === postId);
    const target = replyId ? p?.replies.find((r) => r.id === replyId) : p;
    if (!target) return false;
    target.reports = [];
    target.status = decision === 'keep' ? 'visible' : 'removed';
    this.save();
    return true;
  }

  /** Your own posts can always be deleted. */
  deleteOwn(postId, replyId = null) {
    const p = this.state.posts.find((x) => x.id === postId);
    if (!p) return false;
    if (replyId) {
      const before = p.replies.length;
      p.replies = p.replies.filter((r) => !(r.id === replyId && r.author === this.state.me));
      this.save();
      return p.replies.length < before;
    }
    if (p.author !== this.state.me) return false;
    this.state.posts = this.state.posts.filter((x) => x.id !== postId);
    this.save();
    return true;
  }
}
