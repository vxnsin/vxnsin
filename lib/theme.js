// Palettes mirror the "spring" theme of vensin.dev (vensin-portfolio-v2/app/globals.css).
const themes = {
  light: {
    name: 'light',
    bg: '#f4ecf2',
    paper: '#fffaf9',
    paper2: '#f9eef4',
    ink: '#3b2c3a',
    inkSoft: '#7a6478',
    line: '#c9a9bf',
    accent: '#e2789b',
    accent2: '#8b7fd6',
    accentSoft: '#fbe3ec',
    glow1: 'rgba(226,120,155,.30)',
    glow2: 'rgba(139,127,214,.26)',
    star: '#3b2c3a',
    starPink: '#e2789b',
    starLav: '#8b7fd6',
    starAlpha: 0.45
  },
  dark: {
    name: 'dark',
    bg: '#17121c',
    paper: '#1f1826',
    paper2: '#291f32',
    ink: '#f1e7f0',
    inkSoft: '#b39fb0',
    line: '#5c4a62',
    accent: '#ff8fb4',
    accent2: '#b0a4ff',
    accentSoft: '#3a2a3f',
    glow1: 'rgba(255,143,180,.16)',
    glow2: 'rgba(176,164,255,.18)',
    star: '#ffffff',
    starPink: '#ffd6e6',
    starLav: '#b0a4ff',
    starAlpha: 0.55
  }
};

// The hit-counter digits look the same in both themes, like on the site.
const counter = { bg: '#14101a', digit: '#ffd54a', glow: 'rgba(255,213,74,.7)' };

module.exports = { themes, counter };
