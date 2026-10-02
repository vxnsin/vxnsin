const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs/promises');

const baseUrl = 'https://aniworld.to';
const watchedUrl = `${baseUrl}/user/profil/vensin/watched`;

const MAX_ITEMS = 10;
const CACHE_FILE = 'anime-covers.json';

const KITSU_API = 'https://kitsu.io/api/edge/anime';
const KITSU_SITE = 'https://kitsu.app/anime';
const KITSU_DELAY_MS = 300;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

async function toDataUri(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  const type = response.headers['content-type'] || 'image/jpeg';
  return `data:${type};base64,${Buffer.from(response.data).toString('base64')}`;
}

// Returns [{ anime, resolved, dataUri }] for the most recently watched series,
// with the cover artwork already inlined.
async function loadRecentAnime() {
  const animes = await fetchWatched();
  if (animes.length === 0) throw new Error('Keine Eintraege auf aniworld gefunden.');

  const selected = dedupe(animes).slice(0, MAX_ITEMS);
  const cache = await readCache();
  const cacheBefore = JSON.stringify(cache);

  const entries = [];
  for (const anime of selected) {
    const resolved = await resolveCover(anime, cache);
    if (!resolved.cover) continue;
    try {
      entries.push({ anime, resolved, dataUri: await toDataUri(resolved.cover) });
    } catch (error) {
      console.warn(`Cover fuer "${anime.title}" konnte nicht geladen werden:`, error.message);
    }
  }

  if (cacheBefore !== JSON.stringify(cache)) {
    await fs.writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
    console.log(`${CACHE_FILE} wurde aktualisiert.`);
  }

  return entries;
}

module.exports = { loadRecentAnime };
