const { esc, truncate, wrap, Glyphs, windowFrame, svgDoc } = require('../lib/svg');

const W = 840;
const LEFT_W = 536;
const RIGHT_W = 286;
const GAP = 12;
const CODING_SINCE = 2018;

const MOODS = ['(￣▽￣)ノ', 'ヽ(>∀<☆)ノ', '(￣o￣) zzZ', '(=^･ω･^=)', 'ヾ(＾∇＾)'];

function ago(date, now) {
  const days = Math.floor((now - new Date(date)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function paragraphs(now) {
  const years = now.getFullYear() - CODING_SINCE;
  return [
    `hi, i'm luis (online: vensin). i'm a developer from germany and i've been coding for over ${years} years: web stuff, minecraft servers, discord bots and whatever idea pops up next.`,
    'when i\'m not at the keyboard i\'m probably watching anime, listening to music or out on my motorcycle.',
    'this profile is drawn to match my site vensin.dev, so come say hi over there too. enjoy your stay!'
  ];
}

async function render(t, data) {
  const g = new Glyphs();
  const now = data.now;

  // left: about.txt
  const textSize = 12.5;
  const lineH = 20;
  let y = 30;
  let left = `<text class="px acc" x="16" y="${y}" font-size="18">${esc(g.add('pixel', 'welcome to my github _(:з)∠)_'))}</text>`;
  y += 26;
  for (const para of paragraphs(now)) {
    for (const line of wrap(para, LEFT_W - 34, textSize)) {
      left += `<text class="mo ink" x="16" y="${y}" font-size="${textSize}">${esc(g.add('mono', line))}</text>`;
      y += lineH;
    }
    y += 6;
  }
  left += `<text class="px" x="16" y="${y + 4}" font-size="13"><tspan fill="${t.inkSoft}">${esc(g.add('pixel', 'love, luis. '))}</tspan>`
    + `<tspan fill="${t.accent2}">${esc(g.add('pixel', '(｡･ω･｡)'))}</tspan></text>`;
  const leftH = y + 22 + 26;

  // right: status
  const latest = data.anime[0];
  const watching = latest
    ? [latest.anime.title, latest.anime.season != null ? `S${latest.anime.season}` : null, latest.anime.episode != null ? `E${latest.anime.episode}` : null].filter(Boolean)
    : null;
  const push = data.github && data.github.lastPush;
  const rows = [
    ['location', 'germany'],
    ['coding', `since ${CODING_SINCE}`],
    ['watching', watching ? watching.join(' ') : 'nothing, for once'],
    ['last push', push ? `${push.name} · ${ago(push.at, now)}` : 'somewhere'],
    ['mood', null]
  ];
  let right = '';
  let ry = 30;
  const valueX = 96;
  for (const [label, value] of rows) {
    right += `<text class="px soft" x="14" y="${ry}" font-size="12">${esc(g.add('pixel', label))}</text>`;
    if (value) {
      const shown = truncate(value, RIGHT_W - valueX - 14, 12);
      right += `<text class="mo ink" x="${valueX}" y="${ry}" font-size="12">${esc(g.add('mono', shown))}</text>`;
    } else {
      // the mood cycles through a few kaomoji
      const step = 2.2;
      const dur = MOODS.length * step;
      MOODS.forEach((mood, i) => {
        right += `<text class="px acc2 mood m${i}" x="${valueX}" y="${ry}" font-size="13" style="animation-delay:${(i * step - dur).toFixed(1)}s;animation-duration:${dur}s">${esc(g.add('pixel', mood))}</text>`;
      });
    }
    ry += 26;
  }
  right += `<line x1="14" y1="${ry - 10}" x2="${RIGHT_W - 14}" y2="${ry - 10}" stroke="${t.line}" stroke-width="1.5" stroke-dasharray="5 3"/>`;

  // year progress bar
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  const share = (now - start) / (end - start);
  const barW = RIGHT_W - 28;
  ry += 10;
  right += `<text class="px soft" x="14" y="${ry}" font-size="12">${esc(g.add('pixel', `${now.getFullYear()} progress`))}</text>`
    + `<text class="px acc" x="${RIGHT_W - 14}" y="${ry}" font-size="12" text-anchor="end">${esc(g.add('pixel', `${Math.floor(share * 100)}%`))}</text>`;
  ry += 9;
  right += `<rect x="14.5" y="${ry + 0.5}" width="${barW - 1}" height="7" fill="${t.paper2}" stroke="${t.line}"/>`
    + `<rect class="grow" x="15" y="${ry + 1}" width="${Math.max(1, (barW - 2) * share).toFixed(1)}" height="6" fill="${t.accent}"/>`;
  const rightH = ry + 26 + 26;

  const H = Math.max(leftH, rightH) + 6;
  const frameH = H - 6;
  const body = windowFrame(g, t, { w: LEFT_W, h: frameH, title: 'about.txt', right: 'lowercase only', body: left })
    + windowFrame(g, t, { x: LEFT_W + GAP, w: RIGHT_W, h: frameH, title: 'status', right: 'live-ish', body: right });

  const css = '.mood{opacity:0;animation:mood 11s steps(1,end) infinite}'
    + `@keyframes mood{0%{opacity:1}${(100 / MOODS.length).toFixed(2)}%{opacity:0}}`
    + '.grow{transform-box:fill-box;transform-origin:left;animation:grow 1.6s cubic-bezier(.2,.8,.2,1) both .3s}'
    + '@keyframes grow{from{transform:scaleX(0)}}'
    + '@media (prefers-reduced-motion:reduce){.mood{opacity:0}.m0{opacity:1}}';

  return svgDoc(g, t, { w: W, h: H, css, body, label: `about me: ${paragraphs(now).join(' ')}` });
}

module.exports = { render, W, alt: 'about me: developer from germany, coding since 2018, anime, music and motorcycles' };
