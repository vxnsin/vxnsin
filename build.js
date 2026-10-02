const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { themes } = require('./lib/theme');
const { loadRecentAnime } = require('./lib/anime');
const { loadGithub } = require('./lib/github');

const OUT_DIR = 'dist';
const RAW_BASE = 'https://raw.githubusercontent.com/vxnsin/vxnsin/output';
const TEMPLATE = 'README.template.md';
const README = 'README.md';

const cards = {
  header: require('./cards/header'),
  about: require('./cards/about'),
  stack: require('./cards/stack'),
  anime: require('./cards/anime'),
  stats: require('./cards/stats'),
  snake: require('./cards/snake'),
  marquee: require('./cards/marquee'),
  footer: require('./cards/footer'),
  ...require('./cards/buttons').cards
};

async function settle(label, promise) {
  try {
    return await promise;
  } catch (error) {
    console.warn(`${label} nicht verfuegbar:`, error.message);
    return null;
  }
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function picture(name, hash, card, data) {
  const alt = escapeAttr(typeof card.alt === 'function' ? card.alt(data) : (card.alt || name));
  const src = theme => `${RAW_BASE}/${name}-${theme}.svg?v=${hash}`;
  const width = card.displayW || card.W;
  return `<picture>`
    + `<source media="(prefers-color-scheme: dark)" srcset="${src('dark')}">`
    + `<img src="${src('light')}" width="${width}" alt="${alt}">`
    + `</picture>`;
}

async function main() {
  const [anime, github] = await Promise.all([
    settle('aniworld', loadRecentAnime()),
    settle('GitHub', loadGithub())
  ]);
  const data = { anime: anime || [], github, now: new Date() };

  await fs.mkdir(OUT_DIR, { recursive: true });
  const hashes = {};

  for (const [name, card] of Object.entries(cards)) {
    const hash = crypto.createHash('sha1');
    for (const theme of Object.values(themes)) {
      const svg = await card.render(theme, data);
      if (!svg) continue;
      hash.update(svg);
      await fs.writeFile(path.join(OUT_DIR, `${name}-${theme.name}.svg`), svg, 'utf8');
    }
    hashes[name] = hash.digest('hex').slice(0, 10);
    console.log(`${name} gerendert`);
  }

  const template = await fs.readFile(TEMPLATE, 'utf8');
  const readme = template.replace(/\{\{card:([\w-]+)\}\}/g, (match, name) => {
    if (!cards[name]) throw new Error(`Unbekannte Karte im Template: ${name}`);
    return picture(name, hashes[name], cards[name], data);
  });

  const previous = await fs.readFile(README, 'utf8').catch(() => null);
  if (readme !== previous) {
    await fs.writeFile(README, readme, 'utf8');
    console.log('README.md wurde aktualisiert.');
  }
}

main().catch(error => {
  console.error('Build fehlgeschlagen:', error);
  process.exitCode = 1;
});
