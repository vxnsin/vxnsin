const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs/promises');

const baseUrl = 'https://aniworld.to';
const watchedUrl = `${baseUrl}/user/profil/vensin/watched`;

const MAX_ITEMS = 5;
const DEDUPE = true;              // nach Serie + Staffel gruppieren
const LINK_TARGET = 'kitsu';      // 'kitsu' | 'aniworld' | 'none'
const IMG_W = 110;
const IMG_H = 165;                // 2:3 - passt zu Kitsu (284x402) und aniworld (150x225)
const MAX_TITLE_LEN = 24;         // laengere Titel sprengen sonst die Reihe
const CACHE_FILE = 'anime-covers.json';
const README_FILE = 'README.md';

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

// Gruppiert nach Serie + Staffel und behaelt je Gruppe die hoechste Folge.
// Die Reihenfolge der Seite (neueste zuerst) bleibt erhalten.
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

function shortenTitle(title) {
  if (title.length <= MAX_TITLE_LEN) return title;
  return `${title.slice(0, MAX_TITLE_LEN - 1).trimEnd()}…`;
}

// Kitsu findet bei "<Serie> Season 2" gerne einen falschen Ableger
// (z.B. "Hunter x Hunter" S2 -> "Hunter x Hunter: Greed Island").
// Der Treffer zaehlt nur, wenn er die Staffel auch wirklich benennt.
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
      console.warn(`Kitsu-Treffer "${hit.title}" passt nicht zu Staffel ${anime.season} von "${anime.title}" - nutze die Serie selbst.`);
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

function linkFor(anime, resolved) {
  if (LINK_TARGET === 'none') return null;
  if (LINK_TARGET === 'aniworld') return anime.link;
  return resolved.url || anime.link;
}

// Eine horizontale Reihe als HTML-Tabelle. GitHub strippt style-Attribute,
// laesst width/align aber durch - und innerhalb von HTML wird kein Markdown geparst.
function renderRow(entries) {
  const cells = entries.map(({ anime, resolved }) => {
    const fullTitle = escapeHtml(anime.title);
    const shortTitle = escapeHtml(shortenTitle(anime.title));
    const parts = [];

    if (resolved.cover) {
      const img = `<img src="${escapeHtml(resolved.cover)}" width="${IMG_W}" height="${IMG_H}" alt="${fullTitle}">`;
      const href = linkFor(anime, resolved);
      parts.push(href ? `<a href="${escapeHtml(href)}" title="${fullTitle}">${img}</a><br>` : `${img}<br>`);
    }

    parts.push(`<b>${shortTitle}</b>`);

    const meta = [
      anime.season != null ? `S${anime.season}` : null,
      anime.episode != null ? `E${anime.episode}` : null
    ].filter(Boolean).join(' &middot; ');

    if (meta) parts.push(`<br><sub>${meta}</sub>`);

    return `<td align="center" width="${IMG_W + 18}">${parts.join('')}</td>`;
  });

  return ['<div align="center"><table><tr>', ...cells, '</tr></table></div>'].join('\n');
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

  // Leerer Scrape (Cloudflare-Block, Markup-Aenderung) darf die README nicht leeren.
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

  await updateReadme(renderRow(entries));

  if (cacheBefore !== JSON.stringify(cache)) {
    await fs.writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
    console.log(`${CACHE_FILE} wurde aktualisiert.`);
  }
}

main().catch(error => {
  console.error('Fehler beim Aktualisieren der Anime-Liste:', error.message);
  process.exitCode = 1;
});
