const { FAMILIES, fontCss } = require('./font');

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Both fonts are monospace, which makes measuring text trivial:
// DotGothic16 is 0.5em for latin and 1em for CJK / symbols, Plex Mono is 0.6em.
function isWide(ch) {
  const cp = ch.codePointAt(0);
  if (cp < 0x2000) return false;
  if (cp >= 0xff61 && cp <= 0xff9f) return false; // half-width katakana
  return true;
}

function textWidth(text, size, font = 'mono') {
  let em = 0;
  for (const ch of String(text)) {
    if (font === 'pixel') em += isWide(ch) ? 1 : 0.5;
    else em += isWide(ch) ? 1 : 0.6;
  }
  return em * size;
}

function truncate(text, maxWidth, size, font = 'mono') {
  if (textWidth(text, size, font) <= maxWidth) return text;
  let out = '';
  for (const ch of String(text)) {
    if (textWidth(`${out}${ch}…`, size, font) > maxWidth) break;
    out += ch;
  }
  return `${out.trimEnd()}…`;
}

function wrap(text, maxWidth, size, font = 'mono') {
  const lines = [];
  let current = '';
  for (const word of String(text).split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size, font) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Collects every string drawn per font so the embedded font subset contains
// exactly the glyphs the card needs.
class Glyphs {
  constructor() {
    this.used = { pixel: '', mono: '', monoBold: '' };
  }

  add(font, text) {
    this.used[font] += String(text);
    return text;
  }
}

function baseCss(t) {
  return [
    `.px{font-family:${FAMILIES.pixel.css};font-weight:400}`,
    `.mo{font-family:${FAMILIES.mono.css};font-weight:400}`,
    `.mb{font-family:${FAMILIES.monoBold.css};font-weight:600}`,
    `.ink{fill:${t.ink}}.soft{fill:${t.inkSoft}}.acc{fill:${t.accent}}.acc2{fill:${t.accent2}}`,
    '.blink{animation:blink 1.2s steps(2,jump-none) infinite}',
    '@keyframes blink{50%{opacity:0}}',
    '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'
  ].join('');
}

// The window chrome from vensin.dev: flat 1.5px border, hard 4px offset
// shadow, a title bar with three dots (the first one pink) and a lowercase title.
function windowFrame(g, t, { x = 0, y = 0, w, h, title, right = '', dashed = false, body = '', titleClass = '' }) {
  const titleH = 26;
  const dash = dashed ? ' stroke-dasharray="5 3"' : '';
  const dots = [0, 1, 2].map(i => `<circle cx="${x + 15 + i * 12}" cy="${y + titleH / 2}" r="4" `
    + `fill="${i === 0 ? t.accent : t.paper}" stroke="${t.line}" stroke-width="1"/>`).join('');

  return `<g>`
    + `<rect x="${x + 4}" y="${y + 4}" width="${w}" height="${h}" fill="${t.line}"/>`
    + `<rect x="${x + 0.75}" y="${y + 0.75}" width="${w - 1.5}" height="${h - 1.5}" fill="${t.paper}" stroke="${t.line}" stroke-width="1.5"${dash}/>`
    + `<rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${titleH - 1.5}" fill="${t.paper2}"/>`
    + `<line x1="${x}" y1="${y + titleH}" x2="${x + w}" y2="${y + titleH}" stroke="${t.line}" stroke-width="1.5"${dash}/>`
    + dots
    + `<text class="px ink ${titleClass}" x="${x + 52}" y="${y + 17.5}" font-size="13">${esc(g.add('pixel', title))}</text>`
    + (right ? `<text class="px soft" x="${x + w - 10}" y="${y + 17}" font-size="11" text-anchor="end">${esc(g.add('pixel', right))}</text>` : '')
    + `<g transform="translate(${x} ${y + titleH})">${body}</g>`
    + `</g>`;
}

function chip(g, t, { x, y, text, h = 20, size = 12, fill, color, font = 'mono', iconSvg = '', iconSize = 0 }) {
  const pad = 8;
  const gap = iconSvg ? 5 : 0;
  const w = Math.round(pad * 2 + iconSize + gap + textWidth(text, size, font));
  const cls = font === 'pixel' ? 'px' : 'mo';
  g.add(font, text);
  return {
    w,
    svg: `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" fill="${fill || t.paper2}" stroke="${t.line}" stroke-width="1"/>`
      + (iconSvg ? `<g transform="translate(${x + pad} ${y + (h - iconSize) / 2})">${iconSvg}</g>` : '')
      + `<text class="${cls}" x="${x + pad + iconSize + gap}" y="${y + h / 2 + size * 0.36}" font-size="${size}" fill="${color || t.ink}">${esc(text)}</text>`
  };
}

// The 160px pixel-star tile used as the vensin.dev page background.
function starPattern(t, id = 'stars') {
  const dots = [
    [12, 20, 1, 'star', 0.5], [45, 8, 2, 'star', 0.3], [78, 52, 1, 'star', 0.45], [120, 30, 1, 'starPink', 0.8],
    [150, 90, 2, 'star', 0.25], [30, 110, 1, 'star', 0.4], [66, 140, 1, 'starLav', 0.8], [100, 100, 1, 'star', 0.45],
    [140, 150, 1, 'star', 0.35], [8, 70, 2, 'starPink', 0.55], [90, 10, 1, 'star', 0.3], [130, 120, 1, 'star', 0.5],
    [50, 80, 1, 'star', 0.25], [20, 150, 2, 'star', 0.25], [155, 55, 1, 'star', 0.3], [105, 65, 1, 'starLav', 0.6]
  ];
  const rects = dots.map(([x, y, s, c, o]) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${t[c]}" fill-opacity="${o}"/>`).join('');
  const sparkle = [[110, 70], [108, 70], [112, 70], [110, 68], [110, 72]]
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join('');
  return `<pattern id="${id}" width="160" height="160" patternUnits="userSpaceOnUse">${rects}<g fill="${t.starPink}" fill-opacity="0.7">${sparkle}</g></pattern>`;
}

// A "+" shaped pixel sparkle.
function sparkle(x, y, color, cls = '', style = '') {
  return `<g class="${cls}" style="${style}" fill="${color}">`
    + `<rect x="${x}" y="${y - 2}" width="2" height="6"/><rect x="${x - 2}" y="${y}" width="6" height="2"/></g>`;
}

async function svgDoc(g, t, { w, h, css = '', defs = '', body, label }) {
  const fonts = await fontCss(g.used);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-label="${esc(label)}">`
    + `<title>${esc(label)}</title>`
    + `<style>${fonts}${baseCss(t)}${css}</style>`
    + (defs ? `<defs>${defs}</defs>` : '')
    + body
    + `</svg>\n`;
}

module.exports = { esc, textWidth, truncate, wrap, Glyphs, windowFrame, chip, starPattern, sparkle, svgDoc };
