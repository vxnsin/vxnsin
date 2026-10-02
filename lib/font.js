const axios = require('axios');

// SVGs shown through <img> cannot load external files, so the fonts are
// embedded as base64. Google Fonts subsets on the fly via the text parameter,
// which keeps every card at a few KB of font data.
const FAMILIES = {
  pixel: { family: 'DotGothic16', weight: 400, css: "'DotGothic16','MS Gothic',monospace" },
  mono: { family: 'IBM Plex Mono', weight: 400, css: "'IBM Plex Mono',ui-monospace,Consolas,monospace" },
  monoBold: { family: 'IBM Plex Mono', weight: 600, css: "'IBM Plex Mono',ui-monospace,Consolas,monospace" }
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const cache = new Map();

async function fetchFace(key, text) {
  const { family, weight } = FAMILIES[key];
  const chars = [...new Set([...text])].sort().join('');
  const cacheKey = `${key}|${chars}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(chars)}`;
  const css = (await axios.get(cssUrl, { headers: { 'User-Agent': UA }, timeout: 15000 })).data;
  const fileUrl = (css.match(/url\((https:[^)]+)\)/) || [])[1];
  if (!fileUrl) throw new Error(`No font file in Google Fonts response for ${family}`);

  const file = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 15000 });
  const face = `@font-face{font-family:'${family}';font-weight:${weight};`
    + `src:url(data:font/woff2;base64,${Buffer.from(file.data).toString('base64')}) format('woff2')}`;
  cache.set(cacheKey, face);
  return face;
}

// usage: { pixel: 'all text set in the pixel font', mono: '...', monoBold: '...' }
async function fontCss(usage) {
  const faces = [];
  for (const [key, text] of Object.entries(usage)) {
    if (!text) continue;
    try {
      faces.push(await fetchFace(key, text));
    } catch (error) {
      console.warn(`Font ${key} could not be embedded, falling back to system fonts:`, error.message);
    }
  }
  return faces.join('');
}

module.exports = { fontCss, FAMILIES };
