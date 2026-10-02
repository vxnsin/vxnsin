const { esc, textWidth, Glyphs, windowFrame, starPattern, sparkle, svgDoc, chip } = require('../lib/svg');

const W = 840;
const H = 262;

const ROLES = [
  'a full-stack developer',
  'an anime enthusiast',
  'a motorcycle rider',
  'a music lover',
  'probably watching something right now'
];

// Deterministic so an unchanged card keeps the same bytes (and camo cache key).
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Builds SMIL keyframes for a typewriter: one clip rect per role, plus the
// cursor x position, all on a shared timeline.
function typewriter(roles, charW) {
  const TYPE = 0.08;
  const HOLD = 1.8;
  const ERASE = 0.035;
  const PAUSE = 0.35;
  const frames = []; // { t, role, chars }
  let t = 0;
  roles.forEach((role, index) => {
    for (let c = 0; c <= role.length; c++) {
      frames.push({ t, role: index, chars: c });
      t += c === role.length ? HOLD : TYPE;
    }
    for (let c = role.length - 1; c >= 0; c--) {
      frames.push({ t, role: index, chars: c });
      t += c === 0 ? PAUSE : ERASE;
    }
  });
  const dur = t;
  const keyTimes = frames.map(f => (f.t / dur).toFixed(5)).join(';');
  const widths = roles.map((_, index) => frames.map(f => (f.role === index ? f.chars * charW : 0)).join(';'));
  const cursor = frames.map(f => f.chars * charW).join(';');
  return { dur: dur.toFixed(2), keyTimes, widths, cursor };
}

async function render(t) {
  const g = new Glyphs();
  const rand = rng(7);
  const bodyH = H - 26 - 6;
  const innerW = W - 6;

  // background: page colour, the three soft glows and the pixel star tile
  const defs = starPattern(t)
    + `<radialGradient id="glow1" cx="8%" cy="-5%" r="70%"><stop offset="0" stop-color="${t.glow1}"/><stop offset="0.65" stop-color="${t.glow1}" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="glow2" cx="100%" cy="12%" r="55%"><stop offset="0" stop-color="${t.glow2}"/><stop offset="0.65" stop-color="${t.glow2}" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="glow3" cx="55%" cy="108%" r="45%"><stop offset="0" stop-color="${t.glow1}"/><stop offset="0.65" stop-color="${t.glow1}" stop-opacity="0"/></radialGradient>`
    + `<clipPath id="bodyClip"><rect x="1.5" y="0" width="${innerW - 3}" height="${bodyH - 1.5}"/></clipPath>`
    + `<path id="petal" d="M0 0C5 0 8 3 8 8C3 8 0 5 0 0Z"/>`;

  const bg = `<rect x="1.5" y="0" width="${innerW - 3}" height="${bodyH - 1.5}" fill="${t.bg}"/>`
    + `<rect x="1.5" y="0" width="${innerW - 3}" height="${bodyH - 1.5}" fill="url(#glow1)"/>`
    + `<rect x="1.5" y="0" width="${innerW - 3}" height="${bodyH - 1.5}" fill="url(#glow2)"/>`
    + `<rect x="1.5" y="0" width="${innerW - 3}" height="${bodyH - 1.5}" fill="url(#glow3)"/>`
    + `<rect x="1.5" y="0" width="${innerW - 3}" height="${bodyH - 1.5}" fill="url(#stars)"/>`;

  // twinkling sparkles, kept away from the text in the middle
  let twinkles = '';
  for (let i = 0; i < 16; i++) {
    let x;
    do { x = Math.round(20 + rand() * (W - 40)); } while (x > 230 && x < 610);
    const y = Math.round(18 + rand() * (bodyH - 36));
    const color = [t.accent, t.accent2, t.star][i % 3];
    const delay = (rand() * 3).toFixed(2);
    const dur = (2 + rand() * 2.5).toFixed(2);
    twinkles += sparkle(x, y, color, 'tw', `animation-duration:${dur}s;animation-delay:-${delay}s`);
  }

  // falling sakura petals
  let petals = '';
  for (let i = 0; i < 12; i++) {
    const x = Math.round(rand() * W);
    const dur = (7 + rand() * 7).toFixed(2);
    const delay = (rand() * 14).toFixed(2);
    const scale = (0.6 + rand() * 0.7).toFixed(2);
    petals += `<g transform="translate(${x} -14)"><g class="fall" style="animation-duration:${dur}s;animation-delay:-${delay}s">`
      + `<g class="sway" style="animation-duration:${(2 + rand() * 2).toFixed(2)}s">`
      + `<use href="#petal" xlink:href="#petal" fill="${t.accent}" fill-opacity="${(0.45 + rand() * 0.35).toFixed(2)}" transform="scale(${scale})"/>`
      + `</g></g></g>`;
  }

  // wordmark: "vensin.dev" with the dot pulled in tight, like on the site
  const size = 50;
  const half = size / 2;
  const wordW = 6 * half + half - 0.31 * size + 3 * half;
  const wx = (W - wordW) / 2;
  const wy = 98;
  g.add('pixel', 'vensin.dev');
  const wordmark = `<g class="px" font-size="${size}">`
    + `<text x="${wx}" y="${wy}" fill="${t.ink}">vensin</text>`
    + `<text x="${wx + 6 * half - 0.03 * size}" y="${wy}" fill="${t.accent}">.</text>`
    + `<text x="${wx + 7 * half - 0.31 * size}" y="${wy}" fill="${t.ink}">dev</text>`
    + `</g>`;

  // "ヴェンシン · " + typewriter
  const lineSize = 15;
  const charW = lineSize / 2;
  const prefix = 'ヴェンシン · ';
  const prefixW = textWidth(prefix, lineSize, 'pixel');
  const average = (ROLES.reduce((sum, r) => sum + r.length, 0) / ROLES.length) * charW;
  const lx = Math.round((W - prefixW - average) / 2);
  const ly = 134;
  const tw = typewriter(ROLES, charW);
  g.add('pixel', prefix + ROLES.join('') + '▌');

  let typed = '';
  ROLES.forEach((role, index) => {
    typed += `<clipPath id="tw${index}"><rect x="${lx + prefixW}" y="${ly - 16}" width="0" height="22">`
      + `<animate attributeName="width" values="${tw.widths[index]}" keyTimes="${tw.keyTimes}" dur="${tw.dur}s" calcMode="discrete" repeatCount="indefinite"/>`
      + `</rect></clipPath>`
      + `<text class="px ink" x="${lx + prefixW}" y="${ly}" font-size="${lineSize}" clip-path="url(#tw${index})">${esc(role)}</text>`;
  });
  const cursor = `<g class="blink"><text class="px acc" x="${lx + prefixW}" y="${ly}" font-size="${lineSize}">▌`
    + `<animate attributeName="x" values="${tw.cursor.split(';').map(v => (lx + prefixW + Number(v)).toFixed(1)).join(';')}" keyTimes="${tw.keyTimes}" dur="${tw.dur}s" calcMode="discrete" repeatCount="indefinite"/>`
    + `</text></g>`;
  const prefixSvg = `<text class="px" x="${lx}" y="${ly}" font-size="${lineSize}"><tspan fill="${t.accent2}">ヴェンシン</tspan><tspan fill="${t.inkSoft}"> · </tspan></text>`;

  // little chips under the typewriter
  const chipTexts = ['hi, i\'m luis', 'coding since 2018', 'based in germany', 'ヽ(>∀<☆)ノ'];
  const chipFonts = ['mono', 'mono', 'mono', 'pixel'];
  const widths = chipTexts.map((text, i) => chip(g, t, { x: 0, y: 0, text, size: 11, font: chipFonts[i] }).w);
  let cx = (W - (widths.reduce((a, b) => a + b, 0) + 10 * (widths.length - 1))) / 2;
  let chips = '';
  chipTexts.forEach((text, i) => {
    const c = chip(g, t, { x: cx, y: 160, text, size: 11, font: chipFonts[i], color: i === 0 ? t.accent : t.ink });
    chips += `<g class="pop" style="animation-delay:${0.6 + i * 0.15}s">${c.svg}</g>`;
    cx += c.w + 10;
  });

  const scroll = `<text class="px soft" x="${W / 2}" y="${bodyH - 8}" font-size="11" text-anchor="middle">${esc(g.add('pixel', 'scroll down, there is more ↓'))}</text>`;

  const body = `<g clip-path="url(#bodyClip)">${bg}${twinkles}${petals}</g>${wordmark}${prefixSvg}${typed}${cursor}${chips}<g class="bob">${scroll}</g>`;

  const frame = windowFrame(g, t, { w: W - 6, h: H - 6, title: 'vensin.dev · welcome', right: '(￣▽￣)ノ', body });

  const css = '.tw{animation:twinkle 3s ease-in-out infinite}'
    + '@keyframes twinkle{0%,100%{opacity:.15}50%{opacity:1}}'
    + `.fall{animation:fall 10s linear infinite}`
    + `@keyframes fall{from{transform:translateY(0) rotate(0deg)}to{transform:translateY(${H + 20}px) rotate(320deg)}}`
    + '.sway{animation:sway 3s ease-in-out infinite alternate}'
    + '@keyframes sway{from{transform:translateX(-14px)}to{transform:translateX(14px)}}'
    + '.pop{animation:pop .5s ease-out both}'
    + '@keyframes pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'
    + '.bob{animation:bob 2.4s ease-in-out infinite}'
    + '@keyframes bob{50%{transform:translateY(3px)}}';

  return svgDoc(g, t, { w: W, h: H, css, defs, body: frame, label: 'vensin.dev: hi, I\'m Luis, a full-stack developer, anime enthusiast and motorcycle rider from Germany' });
}

module.exports = { render, W, H };
