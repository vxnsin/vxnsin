const fs = require('fs');
const path = require('path');
const { esc, Glyphs, windowFrame, chip, svgDoc } = require('../lib/svg');

const W = 840;

// icon: file in icons/, dot: colour square for tools without an icon
const GROUPS = [
  ['languages', [
    { name: 'java', icon: 'java' }, { name: 'javascript', icon: 'javascript' }, { name: 'typescript', icon: 'typescript' },
    { name: 'python', dot: '#3776ab' }, { name: 'rust', dot: '#dea584' }, { name: 'lua', dot: '#000080' },
    { name: 'dart', dot: '#00b4ab' }, { name: 'html', icon: 'html' }, { name: 'css', icon: 'css' }
  ]],
  ['frameworks', [
    { name: 'react', icon: 'react' }, { name: 'next.js', icon: 'nextjs' }, { name: 'node.js', icon: 'nodejs' },
    { name: 'express', dot: '#8b7fd6' }, { name: 'tailwind', icon: 'tailwind' }, { name: 'flutter', dot: '#02569b' }
  ]],
  ['data & build', [
    { name: 'mongodb', icon: 'mongodb' }, { name: 'mariadb', icon: 'mysql' }, { name: 'gradle', icon: 'gradle' },
    { name: 'maven', icon: 'maven' }, { name: 'git', icon: 'git' }, { name: 'vercel', icon: 'vercel' }
  ]],
  ['setup', [
    { name: 'linux', icon: 'linux' }, { name: 'debian', icon: 'debian' }, { name: 'raspberry pi', icon: 'raspberrypi' },
    { name: 'intellij idea', dot: '#fe315d' }, { name: 'vs code', dot: '#2f80ed' }, { name: 'termius', dot: '#e2789b' }
  ]]
];

// Inlines an icon file as a nested <svg>, recolouring black/white marks to
// the theme ink so they stay visible in both themes.
function icon(name, size, ink) {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'icons', `${name}.svg`), 'utf8')
    .replace(/<\?xml[^>]*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '');
  const open = raw.match(/<svg[^>]*>/)[0];
  const viewBox = (open.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 24 24';
  let fill = (open.match(/\sfill="([^"]+)"/) || [])[1] || '#000';
  if (/^#(fff|ffffff|000|000000)$/i.test(fill)) fill = ink;
  const inner = raw.slice(raw.indexOf(open) + open.length, raw.lastIndexOf('</svg>'));
  return `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="${fill}">${inner}</svg>`;
}

async function render(t) {
  const g = new Glyphs();
  const labelW = 128;
  const rowH = 32;
  const innerW = W - 6;
  let y = 16;
  let body = '';
  let index = 0;

  for (const [label, items] of GROUPS) {
    body += `<text class="px soft" x="16" y="${y + 15}" font-size="13">${esc(g.add('pixel', label))}</text>`
      + `<text class="px acc" x="${labelW - 16}" y="${y + 15}" font-size="13">${esc(g.add('pixel', '›'))}</text>`;
    let x = labelW;
    for (const item of items) {
      const iconSvg = item.icon
        ? icon(item.icon, 13, t.ink)
        : `<rect x="2" y="2" width="9" height="9" fill="${item.dot}" stroke="${t.line}"/>`;
      const c = chip(g, t, { x: 0, y: 0, text: item.name, size: 11.5, h: 22, iconSvg, iconSize: 13 });
      if (x + c.w > innerW - 14) { x = labelW; y += rowH - 4; }
      body += `<g class="pop" style="animation-delay:${(0.08 * index).toFixed(2)}s">`
        + `<g transform="translate(${x} ${y})">${c.svg}</g></g>`;
      x += c.w + 7;
      index++;
    }
    y += rowH;
    if (label !== GROUPS[GROUPS.length - 1][0]) {
      body += `<line x1="16" y1="${y - 5}" x2="${innerW - 16}" y2="${y - 5}" stroke="${t.line}" stroke-width="1" stroke-dasharray="2 4"/>`;
      y += 6;
    }
  }

  const H = y + 26 + 10 + 6;
  const frame = windowFrame(g, t, { w: W - 6, h: H - 6, title: 'tech stack', right: `${index} things i use`, dashed: true, body });
  const css = '.pop{animation:pop .45s cubic-bezier(.2,.9,.3,1.3) both}'
    + '@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}';

  const names = GROUPS.map(([label, items]) => `${label}: ${items.map(i => i.name).join(', ')}`).join('; ');
  return svgDoc(g, t, { w: W, h: H, css, body: frame, label: `tech stack. ${names}` });
}

module.exports = { render, W, alt: 'tech stack: java, javascript, typescript, python, rust, react, next.js, node.js and more' };
