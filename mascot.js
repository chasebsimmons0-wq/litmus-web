// Ember, the Litmus guide: a red panda drawn as inline SVG. The same shapes as the
// concept sheet, so the app and the design stay one drawing. A guide who notices,
// never a companion who needs you: no streaks, no disappointment.

let uid = 0;
const nid = (p) => `${p}${++uid}`;
const INK = '#2A2522';
const r1 = (n) => Math.round(n * 10) / 10;

function eye(cx, cy, r, o = {}) {
  const st = o.state || 'open';
  const line = o.line || INK;
  if (st === 'happy')
    return `<path d="M${r1(cx - r * .72)},${r1(cy + r * .28)} Q${cx},${r1(cy - r * .9)} ${r1(cx + r * .72)},${r1(cy + r * .28)}" fill="none" stroke="${line}" stroke-width="${r1(r * .32)}" stroke-linecap="round"/>`;
  if (st === 'closed')
    return `<path d="M${r1(cx - r * .7)},${cy} Q${cx},${r1(cy + r * .7)} ${r1(cx + r * .7)},${cy}" fill="none" stroke="${line}" stroke-width="${r1(r * .3)}" stroke-linecap="round"/>`;
  const [lx, ly] = o.look || [0, 0.15];
  let s = '';
  const sclera = o.sclera !== false;
  if (sclera) s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFDF9"/>`;
  const pr = sclera ? r * (o.pupilRatio || .64) : r;
  const px = r1(cx + lx * (r - pr) * .95), py = r1(cy + ly * (r - pr) * .95);
  s += `<circle cx="${px}" cy="${py}" r="${r1(pr)}" fill="${o.pupil || INK}"/>`;
  s += `<circle cx="${r1(px - pr * .3)}" cy="${r1(py - pr * .34)}" r="${r1(pr * .36)}" fill="#fff"/>`;
  if (!o.singleHighlight) s += `<circle cx="${r1(px + pr * .36)}" cy="${r1(py + pr * .34)}" r="${r1(pr * .15)}" fill="#fff" opacity=".9"/>`;
  return s;
}

function mouth(cx, cy, w, type, col = INK) {
  const h = w / 2;
  switch (type) {
    case 'big': {
      const c = nid('m');
      const d = `M${cx - h},${cy} Q${cx},${r1(cy + w * 1.05)} ${cx + h},${cy} Z`;
      return `<clipPath id="${c}"><path d="${d}"/></clipPath><path d="${d}" fill="${col}" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>` +
        `<ellipse clip-path="url(#${c})" cx="${cx}" cy="${r1(cy + w * .55)}" rx="${r1(w * .3)}" ry="${r1(w * .2)}" fill="#E8837B"/>`;
    }
    case 'o':
      return `<ellipse cx="${cx}" cy="${cy + 2}" rx="${r1(w * .16)}" ry="${r1(w * .2)}" fill="${col}"/>`;
    case 'soft':
      return `<path d="M${r1(cx - h * .6)},${cy} Q${cx},${r1(cy + w * .3)} ${r1(cx + h * .6)},${cy}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round"/>`;
    case 'w':
      return `<path d="M${cx - h},${cy} Q${r1(cx - h / 2)},${r1(cy + w * .38)} ${cx},${cy} Q${r1(cx + h / 2)},${r1(cy + w * .38)} ${cx + h},${cy}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'wsoft':
      return `<path d="M${r1(cx - h * .7)},${cy} Q${r1(cx - h * .35)},${r1(cy + w * .22)} ${cx},${cy} Q${r1(cx + h * .35)},${r1(cy + w * .22)} ${r1(cx + h * .7)},${cy}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    default:
      return `<path d="M${cx - h},${cy} Q${cx},${r1(cy + w * .6)} ${cx + h},${cy}" fill="none" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`;
  }
}

const ell = (cx, cy, rx, ry, fill, rot = 0, extra = '') =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}${extra}/>`;
const circ = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`;
const blush = (x1, x2, y, col = '#E88C7C', rx = 9, ry = 5.5, op = .55) =>
  ell(x1, y, rx, ry, col, 0, ` opacity="${op}"`) + ell(x2, y, rx, ry, col, 0, ` opacity="${op}"`);

// limb with optional claws, drawn in local coords then rotated
function limb(cx, cy, rx, ry, rot, fill, claws) {
  let s = `<g transform="translate(${cx} ${cy}) rotate(${rot})">`;
  s += `<ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  if (claws) s += [-5, 0, 5].map((x, i) => `<ellipse cx="${x}" cy="${ry - (i === 1 ? 0 : 2)}" rx="2.4" ry="5" fill="${claws}"/>`).join('');
  return s + '</g>';
}

const shadow = (cx = 100, cy = 191, rx = 58) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="6" fill="var(--line)"/>`;

function zzz(x, y) {
  const z = (x, y, s, sw) => `<path d="M${x},${y} h${s} l-${s},${s} h${s}" fill="none" stroke="var(--ink-soft)" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return z(x, y, 11, 3) + z(x + 15, y - 14, 8, 2.6) + z(x + 26, y - 25, 6, 2.2);
}
function bubble(x, y) {
  return `<g><circle cx="${x - 16}" cy="${y + 26}" r="3.5" fill="var(--raised)"/><circle cx="${x - 9}" cy="${y + 17}" r="5" fill="var(--raised)"/>` +
    `<rect x="${x - 10}" y="${y - 14}" width="40" height="24" rx="12" fill="var(--raised)"/>` +
    [0, 1, 2].map(i => `<circle cx="${x + i * 10}" cy="${y - 2}" r="3" fill="var(--ink-soft)" opacity="${.45 + i * .2}"/>`).join('') + '</g>';
}
function blanket(main = '#7D9A7E', hem = '#94B095', stripe = '#E9DCC8') {
  return `<path d="M20,152 Q60,140 100,148 Q140,156 180,144 L184,184 Q184,194 172,194 L28,194 Q16,194 16,184 Z" fill="${main}"/>` +
    `<path d="M20,152 Q60,140 100,148 Q140,156 180,144 L181,158 Q140,170 100,162 Q60,154 19,166 Z" fill="${hem}"/>` +
    `<path d="M40,176 L40,194 M100,172 L100,194 M160,172 L160,194" stroke="${stripe}" stroke-width="3" opacity=".55" stroke-linecap="round"/>`;
}

function tallEye(cx, cy, inward, o) {
  const st = o.state || 'open';
  if (st !== 'open') return eye(cx, cy + 4, 17, o);
  const w = 32, hgt = 38;
  const [lx, ly] = o.look || [0, 0.15];
  const prx = 11.5, pry = 13.5;
  const px = r1(cx + (lx * 0.5 + inward * 0.7) * (w / 2 - prx)), py = r1(cy + (ly * 0.7 + 0.35) * (hgt / 2 - pry));
  return `<rect x="${cx - w / 2}" y="${cy - hgt / 2}" width="${w}" height="${hgt}" rx="${w / 2 - 2.5}" fill="#FFFDF9" stroke="#A8522B" stroke-opacity=".35" stroke-width="1.5"/>` +
    `<ellipse cx="${px}" cy="${py}" rx="${prx}" ry="${pry}" fill="${INK}"/>` +
    `<ellipse cx="${r1(px - 3.3)}" cy="${r1(py - 5.8)}" rx="4.2" ry="4.8" fill="#fff"/>`;
}
function panda(o) {
  const R1 = '#CB6B3C', R2 = '#A8522B', W = '#FFF3E6', DK = '#5A3325', DK2 = '#43251B';
  const clip = nid('rp');
  let s = '';
  // striped tail
  const tail = 'M126,176 C174,188 198,146 174,108';
  s += `<path d="${tail}" fill="none" stroke="${R1}" stroke-width="28" stroke-linecap="round"/>`;
  s += `<path d="${tail}" fill="none" stroke="${R2}" stroke-width="28" stroke-dasharray="10 12" stroke-dashoffset="-14"/>`;
  if (o.arms === 'wave') s += limb(166, 112, 10, 17, 30, DK2);
  // ears
  const ear = `<polygon points="42,76 46,26 88,46" fill="${R1}" stroke="${R1}" stroke-width="12" stroke-linejoin="round"/>` +
    `<polygon points="53,62 55,38 75,49" fill="${W}" stroke="${W}" stroke-width="6" stroke-linejoin="round"/>`;
  s += ear + `<g transform="translate(200 0) scale(-1 1)">${ear}</g>`;
  // body
  s += `<rect x="62" y="118" width="76" height="70" rx="34" fill="${DK}"/>`;
  // head
  s += `<clipPath id="${clip}"><ellipse cx="100" cy="90" rx="66" ry="52"/></clipPath>`;
  s += ell(100, 90, 66, 52, R1);
  s += `<g clip-path="url(#${clip})">${ell(100, 150, 90, 20, R2)}</g>`;
  s += ell(100, 114, 26, 18, W);
  // Tall rounded-rectangle eyes, set apart; pupils lean inward, one strong highlight.
  s += tallEye(73, 86, 1, o) + tallEye(127, 86, -1, o);
  s += `<path d="M92,103 Q100,99 108,103 Q106,110 100,111 Q94,110 92,103 Z" fill="${INK}"/>`;
  s += mouth(100, 116, o.mouth === 'big' ? 18 : 14, o.mouth === 'smile' ? 'w' : o.mouth === 'soft' ? 'wsoft' : o.mouth, INK);
  if (o.arms === 'down' || o.arms === 'wave') s += limb(64, 152, 10, 17, 22, DK2);
  if (o.arms === 'down') s += limb(136, 152, 10, 17, -22, DK2);
  if (o.arms === 'chin') s += limb(64, 152, 10, 17, 22, DK2) + ell(126, 134, 11, 9, DK2, -20);
  s += ell(82, 186, 13, 7, DK2) + ell(118, 186, 13, 7, DK2);
  return s;
}

const POSES = {
  main: { state: 'open', mouth: 'smile', arms: 'down' },
  welcome: { state: 'happy', mouth: 'big', arms: 'wave' },
  think: { state: 'open', look: [.75, -.6], mouth: 'o', arms: 'chin', bubble: true },
  rest: { state: 'closed', mouth: 'soft', arms: 'none', blanket: true, zzz: true, tilt: -5 },
};

function scene(fn, pose, { withGround = true } = {}) {
  const o = POSES[pose];
  let s = withGround && !o.blanket ? shadow() : '';
  let body = fn(o);
  if (o.tilt) body = `<g transform="rotate(${o.tilt} 100 150)">${body}</g>`;
  s += body;
  if (o.blanket) s += blanket();
  if (o.bubble) s += bubble(164, 20);
  if (o.zzz) s += zzz(150, 38);
  return s;
}

/** Ember as an SVG string. `pose`: main, welcome, think or rest. */
export function ember(pose = 'main', { ground = true } = {}) {
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${scene(panda, pose, { withGround: ground })}</svg>`;
}
