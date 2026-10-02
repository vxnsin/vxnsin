const { esc, Glyphs, windowFrame, svgDoc, sparkle } = require('../lib/svg');
const { hitCounter } = require('./stats');

const W = 840;
const H = 112;
const CODING_SINCE = new Date(2018, 0, 1);

async function render(t, data) {
  const g = new Glyphs();
  const now = data.now;
  const innerW = W - 6;
  const days = Math.floor((now - CODING_SINCE) / 86400000);

  const defs = `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/>`
    + `<feFlood flood-color="rgba(255,213,74,.7)"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

  const size = 22;
  g.add('pixel', 'vensin.dev');
  let body = `<g class="px" font-size="${size}">`
    + `<text x="16" y="38" fill="${t.ink}">vensin</text>`
    + `<text x="${16 + 3 * size - 0.03 * size}" y="38" fill="${t.accent}">.</text>`
    + `<text x="${16 + 3.5 * size - 0.31 * size}" y="38" fill="${t.ink}">dev</text></g>`
    + sparkle(150, 22, t.accent2, 'tw')
    + `<text class="mo soft" x="16" y="60" font-size="11">${esc(g.add('mono', `© ${now.getFullYear()} luis. all the bugs are mine. no tracking, just svgs.`))}</text>`
    + `<text class="px soft" x="16" y="76" font-size="10">${esc(g.add('pixel', `last rebuilt ${now.toISOString().slice(0, 10)} · thanks for stopping by ☆`))}</text>`;

  const label = 'days spent coding';
  const hc = hitCounter(g, t, 0, 0, days, 5);
  const cx = innerW - 16 - hc.w;
  body += `<text class="px soft" x="${cx - 10}" y="44" font-size="11" text-anchor="end">${esc(g.add('pixel', label))}</text>`
    + `<g transform="translate(${cx} 26)">${hc.svg}</g>`;

  const frame = windowFrame(g, t, { w: W - 6, h: H - 6, title: 'bye bye', right: '(￣▽￣)ノ', dashed: true, body });
  const css = '.tw{animation:tw 2.4s ease-in-out infinite}@keyframes tw{50%{opacity:.15}}'
    + '.odo{animation:odo .5s cubic-bezier(.2,.8,.2,1) both}@keyframes odo{from{transform:translateY(10px);opacity:0}}';

  return svgDoc(g, t, { w: W, h: H, css, defs, body: frame, label: `vensin.dev footer, ${days} days spent coding` });
}

module.exports = { render, W, alt: 'vensin.dev, thanks for stopping by' };
