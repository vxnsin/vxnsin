const { esc, textWidth, Glyphs, svgDoc } = require('../lib/svg');

// Each button is its own image so it can be wrapped in a link in the README.

// .btn from vensin.dev: pixel label, 1.5px border, 2px hard shadow
function navButton(label) {
  const size = 13;
  const w = Math.round(textWidth(label, size, 'pixel') + 28);
  const h = 30;
  const card = {
    W: w + 2,
    alt: label,
    async render(t) {
      const g = new Glyphs();
      g.add('pixel', label);
      const body = `<rect x="2" y="2" width="${w}" height="${h - 2}" fill="${t.line}"/>`
        + `<g class="press"><rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 3.5}" fill="${t.paper2}" stroke="${t.line}" stroke-width="1.5"/>`
        + `<text class="px ink" x="${w / 2}" y="${h / 2 + 3.5}" font-size="${size}" text-anchor="middle">${esc(label)}</text></g>`;
      return svgDoc(g, t, { w: w + 2, h, body, label });
    }
  };
  return card;
}

// Classic 88x31 web buttons, drawn crisp with a dashed inner border and a
// shine that sweeps across every few seconds.
function badge({ top, bottom, mark, color, delay }) {
  return {
    W: 88,
    alt: `${top} ${bottom}`,
    async render(t) {
      const g = new Glyphs();
      const dark = { bg: '#1f1826', line: '#5c4a62', ink: '#f1e7f0', soft: '#b39fb0' };
      const c = t.name === 'dark' ? dark : { bg: '#fffaf9', line: '#c9a9bf', ink: '#3b2c3a', soft: '#7a6478' };
      g.add('pixel', top + bottom + mark);
      const defs = `<linearGradient id="shine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/>`
        + `<stop offset=".5" stop-color="#fff" stop-opacity="${t.name === 'dark' ? 0.22 : 0.6}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
        + `<clipPath id="c"><rect width="88" height="31"/></clipPath>`;
      const body = `<g shape-rendering="crispEdges">`
        + `<rect width="88" height="31" fill="${c.bg}"/>`
        + `<rect x="0.5" y="0.5" width="87" height="30" stroke="${c.line}"/>`
        + `<rect x="2.5" y="2.5" width="83" height="26" stroke="${c.line}" stroke-dasharray="2 1"/>`
        + `<rect x="5" y="5" width="21" height="21" fill="${color}"/>`
        + `</g>`
        + `<text class="px" x="15.5" y="20" font-size="14" text-anchor="middle" fill="#fff">${esc(mark)}</text>`
        + `<text class="px" x="31" y="14" font-size="10" fill="${c.ink}">${esc(top)}</text>`
        + `<text class="px" x="31" y="25" font-size="9" fill="${color}">${esc(bottom)}</text>`
        + `<g clip-path="url(#c)"><rect class="shine" x="-30" y="-10" width="24" height="51" fill="url(#shine)" transform="skewX(-20)" style="animation-delay:${delay}s"/></g>`;
      const css = '.shine{animation:shine 5s ease-in-out infinite}'
        + '@keyframes shine{0%,70%{transform:translateX(0) skewX(-20deg)}100%{transform:translateX(150px) skewX(-20deg)}}';
      return svgDoc(g, t, { w: 88, h: 31, css, defs, body, label: `${top} ${bottom}` });
    }
  };
}

const nav = {
  'nav-home': navButton('vensin.dev →'),
  'nav-about': navButton('about'),
  'nav-projects': navButton('projects'),
  'nav-anime': navButton('anime'),
  'nav-music': navButton('music'),
  'nav-guestbook': navButton('guestbook')
};

const badges = {
  'badge-site': badge({ top: 'vensin', bottom: '.dev', mark: 'ヴ', color: '#e2789b', delay: 0 }),
  'badge-github': badge({ top: 'github', bottom: '@vxnsin', mark: 'G', color: '#8b7fd6', delay: 0.6 }),
  'badge-discord': badge({ top: 'discord', bottom: 'velane', mark: 'D', color: '#5865f2', delay: 1.2 }),
  'badge-instagram': badge({ top: 'insta', bottom: '@vxn_sin', mark: 'I', color: '#d6629a', delay: 1.8 }),
  'badge-steam': badge({ top: 'steam', bottom: 'vxnsin', mark: 'S', color: '#4a6b8c', delay: 2.4 }),
  'badge-tiktok': badge({ top: 'tiktok', bottom: '@vxnsin', mark: 'T', color: '#3fbfb8', delay: 3.0 }),
  'badge-anime': badge({ top: 'anime', bottom: 'enjoyer', mark: '♡', color: '#ff8fb4', delay: 3.6 })
};

module.exports = { cards: { ...nav, ...badges } };
