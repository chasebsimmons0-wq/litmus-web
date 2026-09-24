// Drives the real app in a headless browser: a new profile, a demo trial,
// the result, the calendar reminder, and the crisis sheet.
// CHROMIUM_PATH points at a browser to use instead of Playwright's own download.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

let server, browser, base;

before(async () => {
  server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    try {
      const body = await readFile(join(ROOT, path.endsWith('/') ? path + 'index.html' : path));
      res.writeHead(200, { 'content-type': TYPES[extname(path) || '.html'] ?? 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
});

after(async () => { await browser?.close(); server?.close(); });

async function freshPage() {
  const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + '?debug');
  await page.getByPlaceholder('A name, or just “Me”').fill('Sam');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Fill a finished demo trial' }).click();
  return { page, errors };
}

test('a demo trial shows its result, with no errors on the way', async () => {
  const { page, errors } = await freshPage();
  await page.getByRole('button', { name: 'Result' }).click();
  await page.getByRole('button', { name: 'For a clinician' }).click();
  const summary = await page.getByRole('dialog', { name: 'For a clinician' }).innerText();
  assert.match(summary, /Heat/);
  assert.deepEqual(errors, []);
});

test('the daily reminder downloads a repeating calendar event', async () => {
  const { page, errors } = await freshPage();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: /Daily reminder/ }).click();
  await page.getByLabel('Reminder 1').fill('07:45');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Add to calendar' }).click()]);
  assert.equal(download.suggestedFilename(), 'litmus-reminder.ics');
  const ics = await readFile(await download.path(), 'utf8');
  assert.match(ics, /RRULE:FREQ=DAILY/);
  assert.match(ics, /DTSTART:\d{8}T074500/);
  assert.match(ics, new RegExp(`URL:${base.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`));
  assert.deepEqual(errors, []);
});

test('crisis language in a note brings up where to get help', async () => {
  const { page, errors } = await freshPage();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: /^Medications/ }).click();
  await page.getByRole('button', { name: 'Add a medication' }).click();
  await page.getByPlaceholder('Name').fill('Amitriptyline');
  await page.getByPlaceholder('Anything to remember (optional)').fill('some days I want to die');
  await page.getByRole('button', { name: 'Save' }).click();
  const sheet = page.getByRole('dialog', { name: /carry this alone/ });
  await sheet.waitFor();
  assert.match(await sheet.innerText(), /988/);
  assert.deepEqual(errors, []);
});
