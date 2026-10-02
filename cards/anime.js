const { esc, truncate, Glyphs, windowFrame, chip, svgDoc } = require('../lib/svg');

const W = 840;
const COVER_W = 104;
const COVER_H = 156;
const GAP = 18;
const ITEM_W = COVER_W + GAP;
const SECONDS_PER_ITEM = 3.6;

function label(anime) {
  return [anime.season != null ? `S${anime.season}` : null, anime.episode != null ? `E${anime.episode}` : null]
    .filter(Boolean).join(' ');
}

function renderItem(g, t, entry, index) {
  const x = index * ITEM_W;
  const meta = label(entry.anime);
  let out = `<g transform="translate(${x} 0)">`
    + `<rect x="2" y="2" width="${COVER_W}" height="${COVER_H}" fill="${t.line}"/>`
    + `<image width="${COVER_W}" height="${COVER_H}" preserveAspectRatio="xMidYMid slice" href="${entry.dataUri}" xlink:href="${entry.dataUri}"/>`
    + `<rect x="0.5" y="0.5" width="${COVER_W - 1}" height="${COVER_H - 1}" stroke="${t.line}" stroke-width="1"/>`;

  if (meta) out += chip(g, t, { x: 5, y: COVER_H - 21, text: meta, size: 10, h: 16, font: 'pixel' }).svg;
  if (index === 0) {
    const c = chip(g, t, { x: 0, y: 0, text: '● new', size: 10, h: 16, font: 'pixel' });
    out += `<g class="blink">${chip(g, t, { x: COVER_W - c.w - 5, y: 5, text: '● new', size: 10, h: 16, font: 'pixel', color: t.accent }).svg}</g>`;
  }

  const title = truncate(entry.anime.title, COVER_W + 4, 11);
  out += `<text class="mb ink" x="0" y="${COVER_H + 18}" font-size="11">${esc(g.add('monoBold', title))}</text>`;
  return `${out}</g>`;
}

async function render(t, data) {
  const g = new Glyphs();
  const entries = data.anime;
  const innerW = W - 6;
  const pad = 16;
  const stripH = COVER_H + 26;
  const H = 26 + pad + stripH + 10 + 6;

  let body;
  let defs = '';
  let css = '';
  if (entries.length === 0) {
    body = `<text class="px soft" x="${innerW / 2}" y="${(H - 26) / 2}" font-size="14" text-anchor="middle">${esc(g.add('pixel', 'aniworld is quiet right now (￣o￣) zzZ'))}</text>`;
  } else {
    const trackWidth = entries.length * ITEM_W;
    const items = entries.map((entry, index) => renderItem(g, t, entry, index)).join('');
    const viewW = innerW - pad * 2 + 6;
    defs = `<clipPath id="view"><rect x="0" y="-2" width="${viewW}" height="${stripH + 4}"/></clipPath>`
      + `<linearGradient id="fadeL" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>`
      + `<linearGradient id="fadeR" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
      + `<mask id="edges"><rect x="0" y="-2" width="${viewW}" height="${stripH + 4}" fill="#fff"/><rect width="34" y="-2" height="${stripH + 4}" fill="url(#fadeL)"/><rect x="${viewW - 34}" y="-2" width="34" height="${stripH + 4}" fill="url(#fadeR)"/></mask>`
      + `<g id="strip">${items}</g>`;
    css = `.track{animation:marquee ${(entries.length * SECONDS_PER_ITEM).toFixed(1)}s linear infinite}`
      + `@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-${trackWidth}px)}}`;
    body = `<g transform="translate(${pad - 3} ${pad})"><g clip-path="url(#view)" mask="url(#edges)"><g class="track">`
      + `<use href="#strip" xlink:href="#strip"/><use href="#strip" xlink:href="#strip" x="${trackWidth}"/>`
      + `</g></g></g>`;
  }

  const frame = windowFrame(g, t, {
    w: W - 6, h: H - 6, title: 'recently watched', dashed: true,
    right: entries.length ? `${entries.length} series · synced from aniworld` : 'synced from aniworld', body
  });

  const names = entries.map(e => [e.anime.title, label(e.anime)].filter(Boolean).join(' ')).join(', ');
  return svgDoc(g, t, { w: W, h: H, css, defs, body: frame, label: `recently watched anime: ${names || 'nothing right now'}` });
}

function alt(data) {
  const names = data.anime.map(e => [e.anime.title, label(e.anime)].filter(Boolean).join(' ')).join(', ');
  return names ? `recently watched: ${names}` : 'recently watched anime';
}

module.exports = { render, W, alt };
