const axios = require('axios');

// Baut eine animierte Marquee-SVG aus den Covern.
//
// Warum SVG statt HTML: GitHub strippt <style> und CSS aus dem README, eine
// Animation ist dort unmoeglich. In einer extern eingebundenen SVG laeuft sie
// dagegen - genau so macht es die Snake-SVG, die schon im README steckt.
//
// Warum Base64: eine SVG, die als <img> gerendert wird, darf keine externen
// Ressourcen nachladen. Die Cover muessen also in die Datei hinein.

const COVER_W = 110;
const COVER_H = 165;
const GAP = 26;
const ITEM_W = COVER_W + GAP;
const VIEW_W = 560;
const VIEW_H = 218;
const SECONDS_PER_ITEM = 4;

// Beide Farben sind auf hellem wie dunklem GitHub-Theme lesbar, damit eine
// einzige Datei fuer Light und Dark reicht.
const COLOR_TITLE = '#4275f5';
const COLOR_META = '#8b949e';

const CHARS_PER_LINE = 17;
const MAX_LINES = 2;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// SVG-Text bricht nicht um, also hier per Hand auf MAX_LINES Zeilen verteilen.
function wrapTitle(title) {
  const lines = [];
  let current = '';

  for (const word of title.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= CHARS_PER_LINE) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;

    if (lines.length === MAX_LINES) break;
  }

  if (current && lines.length < MAX_LINES) lines.push(current);

  if (lines.length === MAX_LINES) {
    const last = lines[MAX_LINES - 1];
    const consumed = lines.join(' ').length;
    if (consumed < title.length) {
      lines[MAX_LINES - 1] = `${last.slice(0, CHARS_PER_LINE - 1).trimEnd()}…`;
    }
  }

  return lines.length ? lines : [title];
}

async function toDataUri(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  const type = response.headers['content-type'] || 'image/jpeg';
  return `data:${type};base64,${Buffer.from(response.data).toString('base64')}`;
}

function renderItem(entry, index, dataUri) {
  const x = index * ITEM_W;
  const titleLines = wrapTitle(entry.anime.title);
  const meta = [
    entry.anime.season != null ? `S${entry.anime.season}` : null,
    entry.anime.episode != null ? `E${entry.anime.episode}` : null
  ].filter(Boolean).join(' · ');

  const centerX = x + COVER_W / 2;

  // Der clipPath sitzt im Ursprung, also wird das Bild per <g> verschoben und
  // nicht per x-Attribut - sonst laeuft es aus der abgerundeten Maske heraus.
  const parts = [
    `<g transform="translate(${x} 0)">`
      + `<image width="${COVER_W}" height="${COVER_H}" clip-path="url(#round)" `
      + `preserveAspectRatio="xMidYMid slice" xlink:href="${dataUri}"/>`
      + `</g>`
  ];

  titleLines.forEach((line, lineIndex) => {
    parts.push(
      `<text class="t" x="${centerX}" y="${COVER_H + 18 + lineIndex * 14}" text-anchor="middle">${escapeXml(line)}</text>`
    );
  });

  if (meta) {
    const y = COVER_H + 18 + titleLines.length * 14 + 2;
    parts.push(`<text class="m" x="${centerX}" y="${y}" text-anchor="middle">${escapeXml(meta)}</text>`);
  }

  return parts.join('');
}

async function buildSvg(entries) {
  const withCovers = entries.filter(entry => entry.resolved.cover);
  if (withCovers.length === 0) throw new Error('Keine Cover zum Einbetten vorhanden.');

  const dataUris = [];
  for (const entry of withCovers) {
    dataUris.push(await toDataUri(entry.resolved.cover));
  }

  const trackWidth = withCovers.length * ITEM_W;
  const duration = withCovers.length * SECONDS_PER_ITEM;
  const items = withCovers.map((entry, index) => renderItem(entry, index, dataUris[index])).join('');

  // Die Spur laeuft zweimal nebeneinander und wird um genau eine Spurbreite
  // verschoben - dadurch ist der Sprung am Ende unsichtbar.
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${VIEW_W}" height="${VIEW_H}" viewBox="0 0 ${VIEW_W} ${VIEW_H}" fill="none" role="img">
<style>
.t{font:600 13px 'Segoe UI',Helvetica,Arial,sans-serif;fill:${COLOR_TITLE}}
.m{font:400 11px 'Segoe UI',Helvetica,Arial,sans-serif;fill:${COLOR_META}}
.track{animation:marquee ${duration}s linear infinite}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-${trackWidth}px)}}
@media(prefers-reduced-motion:reduce){.track{animation:none}}
</style>
<defs>
<clipPath id="round"><rect width="${COVER_W}" height="${COVER_H}" rx="8"/></clipPath>
<clipPath id="view"><rect width="${VIEW_W}" height="${VIEW_H}"/></clipPath>
<g id="strip">${items}</g>
<linearGradient id="fadeL" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
<linearGradient id="fadeR" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="edges"><rect width="${VIEW_W}" height="${VIEW_H}" fill="#fff"/><rect width="28" height="${VIEW_H}" fill="url(#fadeL)"/><rect x="${VIEW_W - 28}" width="28" height="${VIEW_H}" fill="url(#fadeR)"/></mask>
</defs>
<g clip-path="url(#view)" mask="url(#edges)">
<g class="track">
<use xlink:href="#strip"/>
<use xlink:href="#strip" x="${trackWidth}"/>
</g>
</g>
</svg>
`;
}

module.exports = { buildSvg, VIEW_W, VIEW_H };
