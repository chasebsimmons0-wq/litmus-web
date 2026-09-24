// Crisis interception. Free text someone writes is checked for language that suggests
// they might harm themselves, and if it matches, they're shown where to get help right
// away. Nothing is blocked, sent or stored differently — the note saves as written.
// Deliberately broad: showing the help links when they weren't needed costs a tap;
// missing someone who needed them costs far more.

const PHRASES = [
  'kill myself', 'killing myself', 'end my life', 'ending my life', 'end it all', 'take my own life',
  'suicide', 'suicidal', 'want to die', 'wanna die', 'wish i was dead', 'wish i were dead',
  'better off dead', 'better off without me', 'no reason to live', 'nothing to live for',
  'can\'t go on', 'cannot go on', 'can\'t do this anymore', 'can\'t do this any more',
  'don\'t want to be here', 'do not want to be here', 'don\'t want to wake up',
  'hurt myself', 'hurting myself', 'harm myself', 'harming myself', 'self harm', 'self-harm',
  'overdose', 'not worth living',
];

const normalise = (text) => String(text ?? '').toLowerCase()
  .replace(/[‘’ʼ]/g, '\'')
  .replace(/\bcant\b/g, 'can\'t').replace(/\bdont\b/g, 'don\'t')
  .replace(/\s+/g, ' ');

export function mentionsCrisis(text) {
  const t = normalise(text);
  return t.length > 0 && PHRASES.some((p) => t.includes(p));
}

// The crisis line to put first, from the device's region. Everyone also sees the
// others, and findahelpline.com covers every country.
const LINES = {
  US: { label: 'Call or text 988', href: 'tel:988' },
  CA: { label: 'Call or text 988', href: 'tel:988' },
  GB: { label: 'Call Samaritans on 116 123', href: 'tel:116123' },
  IE: { label: 'Call Samaritans on 116 123', href: 'tel:116123' },
  AU: { label: 'Call Lifeline on 13 11 14', href: 'tel:131114' },
  NZ: { label: 'Call or text 1737', href: 'tel:1737' },
};

export function regionFrom(languages = []) {
  for (const tag of languages) {
    const region = String(tag).split(/[-_]/)[1]?.toUpperCase();
    if (region && region.length === 2) return region;
  }
  return null;
}

export function crisisLine(languages = globalThis.navigator?.languages ?? []) {
  return LINES[regionFrom(languages)] ?? { label: 'Find a helpline near you', href: 'https://findahelpline.com' };
}
