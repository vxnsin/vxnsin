const { esc, truncate, Glyphs, windowFrame, svgDoc } = require('../lib/svg');
const { counter } = require('../lib/theme');

const W = 840;

// Glowing yellow digits in a dark bezel, the vensin.dev visitor counter look.
function hitCounter(g, t, x, y, value, digits = 6) {
  const text = String(value).padStart(digits, '0').slice(-digits);
  const cellW = 14;
  const cellH = 20;
  const w = digits * (cellW + 2) + 4;
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${cellH + 6}" rx="2" fill="${t.line}"/>`;
  [...text].forEach((digit, i) => {
    const cx = x + 3 + i * (cellW + 2);
    out += `<rect x="${cx}" y="${y + 3}" width="${cellW}" height="${cellH}" fill="${counter.bg}"/>`
      + `<g class="odo" style="animation-delay:${(0.15 + i * 0.12).toFixed(2)}s">`
      + `<text class="px" x="${cx + cellW / 2}" y="${y + 3 + cellH - 5}" font-size="15" text-anchor="middle" fill="${counter.digit}" filter="url(#glow)">${g.add('pixel', digit)}</text></g>`;
  });
  return { w, svg: out };
}

async function render(t, data) {
  const g = new Glyphs();
  const gh = data.github;
  const innerW = W - 6;
  const pad = 16;

  const defs = `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/>`
    + `<feFlood flood-color="${counter.glow}"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

  let body = '';
  let H;

  if (!gh) {
    H = 120;
    body = `<text class="px soft" x="${innerW / 2}" y="54" font-size="14" text-anchor="middle">${esc(g.add('pixel', 'the stats are napping right now (￣o￣) zzZ'))}</text>`;
  } else {
    // row 1: stat boxes
    const stats = [
      [gh.contributions, 'contributions this year'],
      [gh.commits, 'commits'],
      [gh.repos, 'public repos'],
      [gh.stars, 'stars collected']
    ];
    const boxGap = 10;
    const boxW = (innerW - pad * 2 - boxGap * (stats.length - 1)) / stats.length;
    stats.forEach(([value, label], i) => {
      const x = pad + i * (boxW + boxGap);
      body += `<rect x="${x + 0.5}" y="${pad + 0.5}" width="${boxW - 1}" height="55" fill="${t.paper2}" stroke="${t.line}" stroke-dasharray="4 3"/>`
        + `<g class="odo" style="animation-delay:${(i * 0.1).toFixed(1)}s"><text class="px acc2" x="${x + 12}" y="${pad + 30}" font-size="24">${esc(g.add('pixel', value.toLocaleString('en-US')))}</text></g>`
        + `<text class="px soft" x="${x + 12}" y="${pad + 46}" font-size="11">${esc(g.add('pixel', label))}</text>`;
    });

    // row 2 left: weekly contribution bars with a counter
    const top = pad + 55 + 18;
    const chartW = 500;
    const chartH = 74;
    const chartTop = top + 34;
    body += `<text class="px ink" x="${pad}" y="${top + 16}" font-size="13">${esc(g.add('pixel', 'commit log · last 52 weeks'))}</text>`;
    const hc = hitCounter(g, t, 0, 0, gh.contributions);
    body += `<g transform="translate(${pad + chartW - hc.w} ${top})">${hc.svg}</g>`;

    const weeks = gh.weeks;
    const max = Math.max(1, ...weeks);
    const barStep = chartW / weeks.length;
    const barW = Math.max(2, barStep - 2);
    weeks.forEach((count, i) => {
      const x = pad + i * barStep;
      const current = i === weeks.length - 1;
      if (count === 0) {
        body += `<rect x="${x.toFixed(1)}" y="${chartTop + chartH - 2}" width="${barW.toFixed(1)}" height="2" fill="${t.line}"/>`;
        return;
      }
      // sqrt scale so one busy week does not flatten the rest
      const h = Math.max(3, Math.round(Math.sqrt(count / max) * chartH));
      body += `<rect class="bar" style="animation-delay:${(0.4 + i * 0.018).toFixed(3)}s" x="${x.toFixed(1)}" y="${chartTop + chartH - h}" width="${barW.toFixed(1)}" height="${h}" fill="${current ? t.accent : t.accent2}"/>`;
    });
    body += `<line x1="${pad}" y1="${chartTop + chartH + 1}" x2="${pad + chartW}" y2="${chartTop + chartH + 1}" stroke="${t.line}" stroke-dasharray="3 3"/>`
      + `<text class="px soft" x="${pad}" y="${chartTop + chartH + 16}" font-size="10">${esc(g.add('pixel', 'a year ago'))}</text>`
      + `<text class="px acc" x="${pad + chartW}" y="${chartTop + chartH + 16}" font-size="10" text-anchor="end">${esc(g.add('pixel', 'this week ▲'))}</text>`;

    // row 2 right: top languages
    const lx = pad + chartW + 28;
    const lw = innerW - lx - pad;
    body += `<text class="px ink" x="${lx}" y="${top + 16}" font-size="13">${esc(g.add('pixel', 'top languages'))}</text>`;
    const langs = gh.topLanguages;
    let bx = lx;
    const barY = top + 30;
    langs.forEach((lang, i) => {
      const w = i === langs.length - 1 ? lx + lw - bx : Math.round(lw * lang.share / langs.reduce((s, l) => s + l.share, 0));
      body += `<rect class="seg" style="animation-delay:${(0.3 + i * 0.12).toFixed(2)}s" x="${bx}" y="${barY}" width="${Math.max(1, w)}" height="8" fill="${lang.color}"/>`;
      bx += w;
    });
    body += `<rect x="${lx + 0.5}" y="${barY + 0.5}" width="${lw - 1}" height="7" stroke="${t.line}"/>`;
    langs.forEach((lang, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = lx + col * (lw / 2);
      const y = barY + 30 + row * 22;
      body += `<rect x="${x}" y="${y - 8}" width="9" height="9" fill="${lang.color}" stroke="${t.line}"/>`
        + `<text class="mo ink" x="${x + 15}" y="${y}" font-size="11">${esc(g.add('mono', truncate(lang.name.toLowerCase(), lw / 2 - 60, 11)))}</text>`
        + `<text class="px soft" x="${x + lw / 2 - 10}" y="${y}" font-size="11" text-anchor="end">${esc(g.add('pixel', `${(lang.share * 100).toFixed(1)}%`))}</text>`;
    });

    H = 26 + chartTop + chartH + 30 + 6;
  }

  const frame = windowFrame(g, t, { w: W - 6, h: H - 6, title: 'github stats', right: '@vxnsin · updates daily', body });
  const css = '.bar{transform-box:fill-box;transform-origin:bottom;animation:rise .7s cubic-bezier(.2,.8,.2,1) both}'
    + '@keyframes rise{from{transform:scaleY(0)}}'
    + '.seg{transform-box:fill-box;transform-origin:left;animation:grow .6s ease-out both}'
    + '@keyframes grow{from{transform:scaleX(0)}}'
    + '.odo{animation:odo .5s cubic-bezier(.2,.8,.2,1) both}'
    + '@keyframes odo{from{transform:translateY(10px);opacity:0}}';

  const label = gh
    ? `github stats: ${gh.contributions} contributions this year, ${gh.commits} commits, ${gh.repos} public repos, ${gh.stars} stars. top languages: ${gh.topLanguages.map(l => l.name).join(', ')}`
    : 'github stats';
  return svgDoc(g, t, { w: W, h: H, css, defs, body: frame, label });
}

module.exports = { render, W, alt: 'github stats: contributions, commits, repos, stars and top languages', hitCounter };
