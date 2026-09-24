# Litmus for the web

An installable web app with the same engine, flows and export format as the iPhone
app. It exists so the app can be used on a phone without the paid Apple developer
account. It is a stopgap, not a second product.

## What it does

- Separate profiles on the device, each with its own history
- Onboarding: where it hurts, what it feels like, history, contributing factors, and a safety check
- A baseline, with several readings a day averaged and flare days marked
- Randomised 10 × 7-day trials, with the adherence question on "on" days
- Several trials at once: the engine adjusts for the overlap, trials are lengthened
  to compensate, and the loss of precision is shown before a trial starts
- Symptom tracking alongside pain, and medication tracking (a before-and-after
  comparison, never an on/off trial)
- Backups through the share sheet to Files or iCloud Drive, with a reminder
- The result, the likely range, the next step, and a one-page clinician summary
- Three guided practices, crisis links, and export and restore
- A daily reminder, added to the phone's calendar as a repeating event with an alert
- A warm welcome back after a gap, with nothing to catch up on
- Crisis interception: a note that reads like a crisis brings up where to get help
- A care record: one page for any clinician covering the pain, everything tested and
  what it showed, what was tried before, medications, and questions to raise
- Learn: eight short lessons on how pain works, a flare plan shown on flare days, and
  routes to human support
- A private journal, kept out of trials and out of the care record

It doesn't have HealthKit step counts or push notifications. A web app can't read
Health, and on iOS it can't schedule a notification without a server, which is why the
reminder lives in the calendar instead.

## Files

| file | what |
|---|---|
| `engine.js` | the analysis, ported operation for operation from `Sources/PainCore` |
| `reporting.js` | the result wording and the clinician summary, ported from `Reporting.swift` |
| `tracking.js` | symptoms, medications and the before-and-after comparison, ported from `Tracking.swift` |
| `content.js` | the intervention library, practices and onboarding options |
| `store.js` | IndexedDB storage and export/import (`litmus.export.v3`) |
| `reminders.js` | the calendar (`.ics`) file behind the daily reminder |
| `safety.js` | the crisis-language check on free text |
| `record.js` | the care record and its questions for the clinician |
| `app.js` | the screens |
| `sw.js` | offline shell, network first |

No build step and no dependencies.

## Tests

```bash
npm install
npm test                  # engine, reminders, crisis check, store — no browser needed
npm run test:browser      # drives the real app in headless Chromium
```

`npm run test:browser` uses Playwright's own Chromium (`npx playwright install chromium`),
or any Chromium you point `CHROMIUM_PATH` at.

The engine tests here check the statistics behave sensibly on simulated data. Parity with
the Swift engine — the JS port matching `Sources/PainCore` to within 1e-9 — is tested in
the native app's repository, against fixtures it generates.

## Running it

Locally:

```bash
python3 -m http.server 8765
```

To install it on a phone, it has to be served over HTTPS. Every push to `main` runs the
tests and deploys to GitHub Pages (`.github/workflows/pages.yml`). Turn it on once under
Settings → Pages → Source: **GitHub Actions**; the site is then at
`https://<owner>.github.io/litmus-web/`. Open it in Safari, then choose Share → Add to
Home Screen.

## Data

Backups use the same `litmus.export.v3` file as the iPhone app. The journal, flare plan
and appointment questions are extra keys (`journal`, `flarePlan`,
`appointmentQuestions`) that only the web app reads so far.

Data lives in IndexedDB for the site's origin, on that device only. An app installed to
the home screen keeps its data more reliably than a Safari tab, but browsers can still
clear site data, so export regularly. The export is the same file the iPhone app
restores from, so you can also use it to move between the two apps.

Add `?debug` to the URL to get a "fill a finished demo trial" button in the profile
sheet.
