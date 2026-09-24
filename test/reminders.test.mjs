import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderCalendar, parseTime, escapeText, fold } from '../reminders.js';

const now = new Date(2026, 8, 24, 9, 30);

test('parses times and rejects everything else', () => {
  assert.deepEqual(parseTime('20:00'), [20, 0]);
  assert.deepEqual(parseTime('7:05'), [7, 5]);
  for (const bad of ['', '24:00', '12:60', 'noon', null]) assert.equal(parseTime(bad), null);
});

test('one daily event with an alert per distinct time, in order', () => {
  const ics = reminderCalendar(['20:00', '08:15', '20:00', 'nonsense'], { url: 'https://example.org/litmus/', now });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'every line ends in CRLF');
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
  assert.equal(ics.match(/RRULE:FREQ=DAILY/g).length, 2);
  assert.equal(ics.match(/BEGIN:VALARM/g).length, 2);
  const starts = [...ics.matchAll(/DTSTART:(\S+)/g)].map((m) => m[1]);
  assert.deepEqual(starts, ['20260924T081500', '20260924T200000'], 'floating local times, earliest first');
  assert.match(ics, /UID:litmus-daily-2000@litmus\.app/);
  assert.match(ics, /URL:https:\/\/example\.org\/litmus\//);
});

test('needs at least one valid time', () => {
  assert.throws(() => reminderCalendar(['later'], { now }));
});

test('escapes text and folds long lines', () => {
  assert.equal(escapeText('a, b; c\\d\ne'), 'a\\, b\\; c\\\\d\\ne');
  const long = 'DESCRIPTION:' + 'é'.repeat(80);
  const folded = fold(long).split('\r\n ');
  assert.ok(folded.length > 1);
  for (const part of folded) assert.ok(new TextEncoder().encode(part).length <= 75);
  assert.equal(folded.join(''), long);
});
