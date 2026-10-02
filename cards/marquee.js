const { esc, textWidth, Glyphs, svgDoc } = require('../lib/svg');

const W = 840;
const H = 40;

const LINES = [
  'welcome to github.com/vxnsin',
  'every window here is a hand-drawn svg',
  'ヽ(>∀<☆)ノ',
  'go watch more anime',
  'minecraft servers are my love language',
  'this readme rebuilds itself every night',
  '(=^･ω･^=)',
  'say hi on vensin.dev',
  'if something looks weird, blame me'
];

async function render(t) {
  const g = new Glyphs();
  const size = 12;
  const sep = '   ★   ';
  const text = LINES.join(sep) + sep;
  g.add('pixel', text);
  const trackW = textWidth(text, size, 'pixel');
  const innerW = W - 6;
  const boxH = H - 6;

  const defs = `<clipPath id="clip"><rect x="2" y="2" width="${innerW - 4}" height="${boxH - 4}"/></clipPath>`
    + `<linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".05" stop-color="#fff"/><stop offset=".95" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
    + `<mask id="m"><rect width="${innerW}" height="${boxH}" fill="url(#fade)"/></mask>`;

  const runs = Math.ceil(innerW / trackW) + 1;
  let track = '';
  for (let i = 0; i < runs; i++) {
    track += `<text class="px soft" x="${i * trackW}" y="${boxH / 2 + 4.5}" font-size="${size}">${esc(text)}</text>`;
  }

  const body = `<rect x="4" y="4" width="${innerW}" height="${boxH}" fill="${t.line}"/>`
    + `<rect x="0.75" y="0.75" width="${innerW - 1.5}" height="${boxH - 1.5}" fill="${t.paper}" stroke="${t.line}" stroke-width="1.5"/>`
    + `<g clip-path="url(#clip)" mask="url(#m)"><g class="track">${track}</g></g>`;

  const css = `.track{animation:marquee ${(trackW / 38).toFixed(1)}s linear infinite}`
    + `@keyframes marquee{to{transform:translateX(-${trackW.toFixed(1)}px)}}`;

  return svgDoc(g, t, { w: W, h: H, css, defs, body, label: LINES.join(' / ') });
}

module.exports = { render, W, alt: 'welcome to github.com/vxnsin, go watch more anime' };
