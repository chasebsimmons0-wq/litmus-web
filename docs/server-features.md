# The two features that need a server

Everything else in the brief runs on the phone. These two can't, and the brief says to
build them last. This note sets out what each would take so the decision can be made
deliberately rather than by drift.

## Aggregate insight (brief §10.7)

**Built so far:** `insight.js` defines `litmus.result.v1`, the anonymised shape of one
finished trial: taxonomy ids, design, completion, adherence, the result and its interval,
and the person's presentation from fixed lists. No names, dates, notes, custom names or
journal text. Tests check that nothing identifying leaks. Nothing calls it yet.

**Still needed before anything is sent:**

1. Explicit, per-result consent: a screen that shows exactly the JSON being shared.
   Off by default, and withdrawable.
2. A place to receive it: a single write-only table. No account needed to contribute.
   A random contribution id kept on the phone would allow later withdrawal.
3. A privacy review under PIPEDA/PHIPA (and HIPAA if US users are targeted), and the
   privacy commitment in the app updated to say so, in plain language.
4. A minimum group size before any pooled figure is shown (for example, no statement
   about a presentation with fewer than 20 completed trials), so no one can be singled out.
5. The wording of pooled results reviewed against §7: "for people like you, this helped
   roughly N% of the time" is information. It must never become "you should try X".

It only becomes useful at scale, likely a year or more away, as the brief says.

## Peer connection (brief §10.8)

The brief calls this the piece with the worst risk-to-effort ratio. Below is the
smallest version that keeps to its design constraints.

**Shape:** a small, invite-only space for one condition. People share a *completed trial
result* (the anonymised card above, plus an optional short note) and others can reply
underneath. Everything is asynchronous and topic-scoped. There are no direct messages
and no live chat.

**What it requires:**

- **Accounts:** pseudonymous handles only, with no real names or profile fields that
  accumulate detail. Sign-in by email magic link.
- **A backend:** a hosted Postgres with row-level security (Supabase would do) holding
  posts, replies and reports. The rest of the app stays local-first; only what is
  posted leaves the phone.
- **Crisis interception before human eyes:** every post and reply goes through the same
  check as `safety.js`, on the server as well as the phone. A match holds the post,
  shows the person crisis resources, and sends it to the moderator instead of the room.
- **Moderation by one person:** a queue of held and reported posts, the ability to
  remove posts and suspend accounts, and a hard cap on membership (for example, 100)
  so one person can realistically keep up.
- **Norms enforced by structure:** posts start from a result card, not a blank box.
  Replies are short. There are no links, so no selling supplements or protocols.
- **Legal review** before launch: the brief's §7 on therapy and companion positioning,
  plus terms of use and a moderation policy.

**Decisions only you can make:** which condition to start with, who moderates and how
many hours a week, whether to use Supabase or something else, and when. The brief's own
test is to build it only once there are completed trials worth sharing.
