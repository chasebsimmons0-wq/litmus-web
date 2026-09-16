# Litmus for the web

An installable web app with the same engine, flows and export format as the iPhone
app. It exists so the app can be used on a phone without the paid Apple developer
account. It is a stopgap, not a second product.

## What it does

- Separate profiles on the device, each with its own history
- Onboarding: where it hurts, what it feels like, history, contributing factors, and a safety check
- A baseline, with several readings a day averaged and flare days marked
- Randomised 10 × 7-day trials, with the adherence question on "on" days
- The result, the likely range, the next step, and a one-page clinician summary
- Three guided practices, crisis links, and export and restore

It doesn't have HealthKit step counts or reminders. A web app can't read Health, and on
iOS it can't schedule a notification without a server.

## Files

| file | what |
|---|---|
| `engine.js` | the analysis, ported operation for operation from `Sources/PainCore` |
| `reporting.js` | the result wording and the clinician summary, ported from `Reporting.swift` |
| `content.js` | the intervention library, practices and onboarding options |
| `store.js` | IndexedDB storage and export/import (`litmus.export.v2`) |
| `app.js` | the screens |
| `sw.js` | offline shell, network first |

No build step and no dependencies.

## Tests

```bash
swift build -c release
./.build/release/paincheck fixtures pwa/test/fixtures.json
node pwa/test/engine.test.mjs     # the JS engine matches the Swift engine
node pwa/test/export.test.mjs     # exports round-trip, and the Swift side can read them
```

`engine.test.mjs` fails on any disagreement with the Swift engine beyond 1e-9. Change
the Swift engine, regenerate the fixtures, and this test says whether the port needs
the same change.

## Running it

Locally:

```bash
python3 -m http.server 8765 --directory pwa
```

To install it on a phone, it has to be served over HTTPS (GitHub Pages, Netlify and
Cloudflare Pages all work). Open it in Safari, then choose Share → Add to Home Screen.

## Data

Data lives in IndexedDB for the site's origin, on that device only. An app installed to
the home screen keeps its data more reliably than a Safari tab, but browsers can still
clear site data, so export regularly. The export is the same file the iPhone app
restores from, so you can also use it to move between the two apps.

Add `?debug` to the URL to get a "fill a finished demo trial" button in the profile
sheet.
