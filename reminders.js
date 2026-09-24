// Daily reminders. A web app on iOS can't schedule a notification without a server,
// so this hands the phone's calendar a repeating event with an alert instead. The
// calendar does the reminding; tapping the event's link opens Litmus.

const pad = (n) => String(n).padStart(2, '0');

// Floating local time: the reminder stays at 8 pm wherever the phone is.
const localStamp = (d, hh, mm) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`;
const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

// RFC 5545 §3.3.11: backslash, semicolon, comma and newline are escaped in text.
export const escapeText = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// RFC 5545 §3.1: lines longer than 75 octets are folded, continuing with a space.
export function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let chunk = '', size = 0, limit = 75;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > limit) { out.push(chunk); chunk = ''; size = 0; limit = 74; }
    chunk += ch; size += n;
  }
  out.push(chunk);
  return out.join('\r\n ');
}

/** "20:00" → [20, 0], or null if it isn't a time. */
export function parseTime(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  return hh < 24 && mm < 60 ? [hh, mm] : null;
}

/** A calendar file with one daily event per time, each with an alert when it starts. */
export function reminderCalendar(times, { url, now = new Date() } = {}) {
  const parsed = [...new Set(times.map(parseTime).filter(Boolean).map(([hh, mm]) => `${pad(hh)}:${pad(mm)}`))].sort();
  if (!parsed.length) throw new Error('No valid reminder time');
  const summary = 'Litmus: how is today?';
  const description = ['One number, a few seconds. A missed day is simply left out.', url].filter(Boolean).join('\n\n');
  // Ids scoped to wherever the app is served from, a domain the project controls.
  let host = 'localhost';
  try { host = new URL(url).host || host; } catch {}
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Litmus//Daily reminder//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const time of parsed) {
    const [hh, mm] = parseTime(time);
    lines.push(
      'BEGIN:VEVENT',
      // Stable per time, so importing the same reminder again updates it rather than
      // adding a second one, where the calendar honours that.
      `UID:litmus-daily-${pad(hh)}${pad(mm)}@${host}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${localStamp(now, hh, mm)}`,
      'DURATION:PT5M',
      'RRULE:FREQ=DAILY',
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      ...(url ? [`URL:${url}`] : []),
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(summary)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
