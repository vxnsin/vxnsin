const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const fs = require('fs/promises');
const { buildSvg, VIEW_W, VIEW_H } = require('./anime-svg');

const baseUrl = 'https://aniworld.to';
const watchedUrl = `${baseUrl}/user/profil/vensin/watched`;

const MAX_ITEMS = 10;
const DEDUPE = true;
const CACHE_FILE = 'anime-covers.json';
const README_FILE = 'README.md';
const SVG_FILE = 'anime-covers.svg';
const SVG_RAW_URL = 'https://raw.githubusercontent.com/vxnsin/vxnsin/output/anime-covers.svg';

const START_MARKER = '<!--START_SECTION:recent_anime-->';
const END_MARKER = '<!--END_SECTION:recent_anime-->';

const KITSU_API = 'https://kitsu.io/api/edge/anime';
const KITSU_SITE = 'https://kitsu.app/anime';
const KITSU_DELAY_MS = 300;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchWatched() {
  const response = await axios.get(watchedUrl, {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    }
  });

  const $ = cheerio.load(response.data);
  const animes = [];

  $('.coverListItem').each((index, element) => {
    const title = $(element).find('h3').text().trim();
    const cover = $(element).find('.seriesListHorizontalCover img').attr('data-src');
    const link = $(element).find('a').attr('href');

    if (!link) return;

    const slugMatch = link.match(/\/anime\/stream\/([^/]+)/);
    const seasonMatch = link.match(/staffel-(\d+)/);
    const episodeMatch = link.match(/episode-(\d+)/);

    animes.push({
      title,
      slug: slugMatch ? slugMatch[1] : null,
      link: new URL(link, baseUrl).href,
      aniworldCover: cover ? new URL(cover, baseUrl).href : null,
      season: seasonMatch ? Number(seasonMatch[1]) : null,
      episode: episodeMatch ? Number(episodeMatch[1]) : null
    });
  });

  return animes;
}

function dedupe(animes) {
  const groups = new Map();

  for (const anime of animes) {
    const key = `${anime.slug || anime.title}|${anime.season ?? ''}`;
    const existing = groups.get(key);

    if (!existing || (anime.episode ?? 0) > (existing.episode ?? 0)) {
      groups.set(key, anime);
    }
  }

  return [...groups.values()];
}

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`${CACHE_FILE} konnte nicht gelesen werden, starte mit leerem Cache:`, error.message);
    }
    return {};
  }
}

function namesSeason(title, season) {
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][season];
  const alternatives = [
    `season\\s*${season}`,
    `${season}(?:st|nd|rd|th)\\s*season`,
    `part\\s*${season}`,
    `${season}`
  ];
  if (roman) alternatives.push(roman);

  return new RegExp(`(^|[^a-z0-9])(${alternatives.join('|')})([^a-z0-9]|$)`, 'i').test(title);
}

async function queryKitsu(query) {
  const params = {
    'filter[text]': query,
    'page[limit]': 1,
    'fields[anime]': 'canonicalTitle,slug,posterImage'
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.get(KITSU_API, {
        params,
        timeout: 10000,
        headers: { Accept: 'application/vnd.api+json' }
      });

      const hit = response.data && response.data.data && response.data.data[0];
      if (!hit) return null;

      const poster = hit.attributes && hit.attributes.posterImage;
      const cover = poster && (poster.small || poster.medium || poster.original);
      if (!cover) return null;

      return {
        title: hit.attributes.canonicalTitle,
        cover,
        url: `${KITSU_SITE}/${hit.attributes.slug}`,
        source: 'kitsu'
      };
    } catch (error) {
      if (attempt === 3) {
        console.warn(`Kitsu-Abfrage "${query}" fehlgeschlagen:`, error.message);
        return null;
      }
      await sleep(500 * attempt);
    }
  }

  return null;
}

async function resolveCover(anime, cache) {
  const key = `${anime.slug || anime.title}|${anime.season ?? ''}`;
  if (cache[key]) return cache[key];

  const queries = [];
  if (anime.title && anime.season > 1) {
    queries.push({ text: `${anime.title} Season ${anime.season}`, requireSeason: true });
  }
  if (anime.title) queries.push({ text: anime.title, requireSeason: false });
  if (anime.slug) queries.push({ text: anime.slug.replace(/-/g, ' '), requireSeason: false });

  for (const query of queries) {
    await sleep(KITSU_DELAY_MS);
    const hit = await queryKitsu(query.text);
    if (!hit) continue;

    if (query.requireSeason && !namesSeason(hit.title, anime.season)) {
      console.warn(`Kitsu-Treffer "${hit.title}" passt nicht zu Staffel ${anime.season} von "${anime.title}".`);
      continue;
    }

    cache[key] = { ...hit, fetchedAt: new Date().toISOString() };
    return cache[key];
  }

  if (anime.aniworldCover) {
    console.warn(`Kein Kitsu-Treffer fuer "${anime.title}", nutze aniworld-Cover.`);
    return { title: anime.title, cover: anime.aniworldCover, url: anime.link, source: 'aniworld' };
  }

  console.warn(`Kein Cover fuer "${anime.title}" gefunden.`);
  return { title: anime.title, cover: null, url: anime.link, source: 'none' };
}

function renderSvgEmbed(entries, svg) {
  const hash = crypto.createHash('sha1').update(svg).digest('hex').slice(0, 10);
  const alt = entries
    .map(({ anime }) => [
      anime.title,
      anime.season != null ? `S${anime.season}` : null,
      anime.episode != null ? `E${anime.episode}` : null
    ].filter(Boolean).join(' '))
    .join(', ');

  return `<div align="center">\n`
    + `  <img src="${SVG_RAW_URL}?v=${hash}" width="${VIEW_W}" height="${VIEW_H}" alt="${escapeHtml(alt)}">\n`
    + `</div>`;
}

async function updateReadme(section) {
  const data = await fs.readFile(README_FILE, 'utf8');
  const startIndex = data.indexOf(START_MARKER);
  const endIndex = data.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    console.log(`Die Tags ${START_MARKER} und ${END_MARKER} wurden nicht gefunden!`);
    return;
  }

  const before = data.substring(0, startIndex + START_MARKER.length);
  const after = data.substring(endIndex);
  const updated = `${before}\n${section}\n${after}`;

  if (updated === data) {
    console.log('README.md ist bereits aktuell.');
    return;
  }

  await fs.writeFile(README_FILE, updated, 'utf8');
  console.log('README.md wurde erfolgreich aktualisiert!');
}

async function main() {
  const animes = await fetchWatched();

  if (animes.length === 0) {
    console.warn('Keine Eintraege gefunden - README.md bleibt unveraendert.');
    return;
  }

  const selected = (DEDUPE ? dedupe(animes) : animes).slice(0, MAX_ITEMS);

  const cache = await readCache();
  const cacheBefore = JSON.stringify(cache);

  const entries = [];
  for (const anime of selected) {
    entries.push({ anime, resolved: await resolveCover(anime, cache) });
  }

  let svg;
  try {
    svg = await buildSvg(entries);
  } catch (error) {
    console.error('SVG konnte nicht gebaut werden, README.md bleibt unveraendert:', error.message);
    return;
  }

  const previousSvg = await fs.readFile(SVG_FILE, 'utf8').catch(() => null);
  if (svg !== previousSvg) {
    await fs.writeFile(SVG_FILE, svg, 'utf8');
    console.log(`${SVG_FILE} wurde geschrieben (${Math.round(svg.length / 1024)} KB).`);
  }

  await updateReadme(renderSvgEmbed(entries, svg));

  if (cacheBefore !== JSON.stringify(cache)) {
    await fs.writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
    console.log(`${CACHE_FILE} wurde aktualisiert.`);
  }
}

main().catch(error => {
  console.error('Fehler beim Aktualisieren der Anime-Liste:', error.message);
  process.exitCode = 1;
});
