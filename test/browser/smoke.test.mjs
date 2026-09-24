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
  await page.getByRole('button', { name: 'More', exact: true }).click();
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
  await page.getByRole('button', { name: 'More', exact: true }).click();
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

test('the care record gathers the trial, and questions can be added', async () => {
  const { page, errors } = await freshPage();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /Care record for appointments/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Care record' });
  await sheet.getByPlaceholder('A question of your own').fill('Could I see a pain specialist?');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await sheet.getByText('Could I see a pain specialist?', { exact: true }).waitFor();
  const text = await page.getByRole('dialog', { name: 'Care record' }).locator('pre').innerText();
  assert.match(text, /PAIN RECORD/);
  assert.match(text, /- Heat: running now/);
  assert.match(text, /1\. Could I see a pain specialist\?/);
  assert.deepEqual(errors, []);
});

test('lessons, the flare plan and the journal', async () => {
  const { page, errors } = await freshPage();
  await page.getByRole('button', { name: 'Learn' }).click();
  await page.getByRole('button', { name: /Planning for a flare/ }).click();
  await page.getByRole('button', { name: 'Write my flare plan' }).click();
  const helps = page.getByLabel('What usually helps');
  await helps.fill('Heat and lying on my side');
  await helps.blur();
  await page.getByRole('button', { name: 'Done' }).click();
  assert.match(await page.locator('main').innerText(), /Written and ready/);

  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^Journal/ }).click();
  await page.getByPlaceholder('Whatever’s on your mind').fill('A slow start, then a decent afternoon.');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await page.getByText('A slow start, then a decent afternoon.', { exact: true }).waitFor();
  assert.match(await page.getByRole('dialog', { name: 'Journal' }).innerText(), /decent afternoon/);
  assert.deepEqual(errors, []);
});

test('a second trial can compare two options', async () => {
  const { page, errors } = await freshPage();
  await page.getByRole('button', { name: 'Trial', exact: true }).click();
  await page.getByRole('button', { name: 'Start another trial alongside' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.locator('button.chip', { hasText: 'Massage' }).click();
  assert.match(await sheet.innerText(), /alternate with weeks of massage/);
  await sheet.getByRole('button', { name: 'Start the trial today' }).click();
  await page.getByRole('button', { name: 'Trial', exact: true }).click();
  assert.match(await page.locator('main').innerText(), / or massage\?/);
  assert.deepEqual(errors, []);
});

test('community preview: share a finished trial, reply, and crisis replies are held', async () => {
  const { page, errors } = await freshPage();
  await page.getByRole('button', { name: 'Trial', exact: true }).click();
  await page.getByRole('button', { name: /End this trial early|Close this trial/ }).click();
  await page.getByRole('button', { name: /End it now|Close and keep the result/ }).click();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Turn on the community preview' }).click();
  await page.getByRole('button', { name: /Community \(preview\)/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Community' });
  await sheet.getByRole('button', { name: 'Share yours' }).click();
  await sheet.getByPlaceholder(/Anything that would help/).fill('Heat pad, 20 minutes each evening.');
  await sheet.getByRole('button', { name: 'Share this result' }).click();
  await sheet.getByText('Heat pad, 20 minutes each evening.').waitFor();
  assert.doesNotMatch(await sheet.innerText(), /Sam/);

  await sheet.getByPlaceholder('Reply with your own experience').fill('some days I want to die');
  await sheet.getByRole('button', { name: 'Reply' }).click();
  await page.getByRole('dialog', { name: /carry this alone/ }).waitFor();
  assert.deepEqual(errors, []);
});
