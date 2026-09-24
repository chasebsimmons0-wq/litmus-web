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
