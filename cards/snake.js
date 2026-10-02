const axios = require('axios');
const fs = require('fs/promises');
const { esc, Glyphs, windowFrame, svgDoc } = require('../lib/svg');

const W = 840;
const LOCAL_SNAKE = 'snk/snake.svg';
const FALLBACK_URL = 'https://raw.githubusercontent.com/vxnsin/vxnsin/output/github-contribution-grid-snake-dark.svg';

let source;

// The workflow generates the snake with Platane/snk right before the build;
// locally the last published one is used.
async function loadSnake() {
  if (source !== undefined) return source;
  source = await fs.readFile(LOCAL_SNAKE, 'utf8').catch(() => null);
  if (!source) {
    source = await axios.get(FALLBACK_URL, { timeout: 15000, responseType: 'text' })
      .then(r => r.data)
      .catch(() => null);
  }
  return source;
}

// snk drives all its colours through CSS variables on :root, so swapping that
// block re-themes the snake to the vensin.dev palette.
function recolour(svg, t) {
  const levels = t.name === 'dark'
    ? ['#3a2a4a', '#5a4290', '#8b7fd6', '#ff8fb4']
    : ['#e9dcf4', '#c6b8ef', '#a596e3', '#e2789b'];
  const vars = `:root{--cb:${t.line}55;--cs:${t.accent};--ce:${t.paper2};--c0:${t.paper2};`
    + levels.map((c, i) => `--c${i + 1}:${c}`).join(';') + '}';
  return svg.replace(/:root\{[^}]*\}/, vars);
}

async function render(t) {
  const g = new Glyphs();
  const snake = await loadSnake();
  const innerW = W - 6;
  let body;
  let H;

  if (snake) {
    const viewBox = (snake.match(/viewBox="([^"]+)"/) || [])[1] || '-16 -32 880 192';
    // snk leaves a lot of room under the grid, trim it
    const [vx, vy, vw, fullH] = viewBox.split(/\s+/).map(Number);
    const vh = fullH - 44;
    const w = innerW - 20;
    const h = Math.round(w * vh / vw);
    const inner = recolour(snake, t)
      .replace(/<svg[^>]*>/, `<svg x="10" y="6" width="${w}" height="${h}" viewBox="${vx} ${vy} ${vw} ${vh}">`)
      .replace(/<desc>[\s\S]*?<\/desc>/, '');
    body = inner;
    H = 26 + h + 10 + 6;
  } else {
    H = 110;
    body = `<text class="px soft" x="${innerW / 2}" y="50" font-size="14" text-anchor="middle">${esc(g.add('pixel', 'the snake is sleeping (￣o￣) zzZ'))}</text>`;
  }

  const frame = windowFrame(g, t, { w: W - 6, h: H - 6, title: 'snake.exe', right: 'eating my contributions', body });
  return svgDoc(g, t, { w: W, h: H, body: frame, label: 'a snake eating my github contribution graph' });
}

module.exports = { render, W, alt: 'a snake eating my github contribution graph' };
