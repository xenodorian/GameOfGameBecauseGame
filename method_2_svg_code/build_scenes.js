// Method 2: procedural SVG/code generation, rasterized to PNG with @resvg/resvg-js.
// Produces four 512x512 scenes in ./output/:
//   pixel_dungeon.png, pixel_field.png, hq_dungeon.png, hq_field.png
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });

// ---------- helpers ----------
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function render(svg, name) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
  fs.writeFileSync(path.join(OUT, name + '.png'), png);
  fs.writeFileSync(path.join(OUT, name + '.svg'), svg);
  console.log('wrote', name + '.png');
}

// ---------- pixel art (cell grid, 8px cells, 64x64) ----------
const CELL = 8;
const PAL = {
  '.': null,
  k: '#1b1b2a', // outline
  h: '#c8ccd6', // helmet light
  H: '#8a90a0', // helmet shade
  e: '#222230', // visor slit
  s: '#f0c39a', // skin
  b: '#3d5fbf', // tunic
  B: '#2b3f86', // tunic shade
  g: '#e8b730', // gold trim
  w: '#5a3a22', // boots
};

// 12 cols x 17 rows knight sprite
const KNIGHT = [
  '....kkkk....',
  '...kHHHHk...',
  '...kHhhHk...',
  '...keeeek...',
  '...kkkkkk...',
  '..kbbbbbbk..',
  '.kbbggggbbk.',
  '.kbbggggbbk.',
  'kHkbbbbbbkHk',
  'kHkBBBBBBkHk',
  'kHkBBBBBBkHk',
  '..kBBBBBBk..',
  '..kBBk.kBBk.',
  '..kBBk.kBBk.',
  '..kwwk.kwwk.',
  '..kwwk.kwwk.',
  '.kkkkk.kkkkk',
];

// Adventurer = same silhouette, recolored (green cloak, brown hood, tan skin)
const ADVENTURER_PAL = { ...PAL, h: '#6b4a2f', H: '#4a3220', e: '#222230', b: '#3f7a4a', B: '#2d5a36', g: '#c69a5b' };

function spriteRects(grid, x0, y0, palette) {
  let out = '';
  grid.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const col = palette[ch];
      if (!col) return;
      out += `<rect x="${(x0 + c) * CELL}" y="${(y0 + r) * CELL}" width="${CELL}" height="${CELL}" fill="${col}"/>`;
    });
  });
  return out;
}

function pixelDungeon() {
  let body = '';
  // brick walls, 4-row courses, offset every other course
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 64; x++) {
      const course = Math.floor(y / 4);
      const off = (course % 2) * 4;
      const mortar = y % 4 === 0 || (x + off) % 8 === 0;
      let c;
      if (mortar) c = '#14131c';
      else {
        const t = hash(x, y);
        c = t < 0.33 ? '#4a4f5e' : t < 0.66 ? '#555b6b' : '#3f4352';
      }
      body += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="${c}"/>`;
    }
  }
  // floor, rows 50-63, checkered flagstones
  for (let y = 50; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const alt = ((x >> 2) + (y >> 2)) % 2 === 0;
      const c = alt ? '#2c2f3b' : '#25282f';
      body += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="${c}"/>`;
    }
  }
  // wall torch at cell (12, 18)
  body += `<rect x="${12 * CELL}" y="${20 * CELL}" width="${CELL}" height="${3 * CELL}" fill="#6b4a2f"/>`;
  body += `<rect x="${11 * CELL}" y="${18 * CELL}" width="${3 * CELL}" height="${2 * CELL}" fill="#ff9d2e"/>`;
  body += `<rect x="${12 * CELL}" y="${17 * CELL}" width="${CELL}" height="${CELL}" fill="#ffe27a"/>`;
  // shadow under knight
  body += `<rect x="${24 * CELL}" y="${57 * CELL}" width="${14 * CELL}" height="${CELL}" fill="#0e0d14"/>`;
  body += spriteRects(KNIGHT, 26, 41, PAL);
  return svgWrap(body, 512);
}

function pixelField() {
  let body = '';
  // sky bands
  const sky = ['#a8e0ff', '#8fd1fa', '#74bff0', '#5aaee8'];
  for (let y = 0; y < 32; y++) {
    const band = sky[Math.min(3, Math.floor(y / 8))];
    body += `<rect x="0" y="${y * CELL}" width="512" height="${CELL}" fill="${band}"/>`;
  }
  // sun
  for (let y = 4; y <= 10; y++)
    for (let x = 48; x <= 56; x++) {
      const d = Math.hypot(x - 52, y - 7);
      if (d <= 4.2) body += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="#ffe36b"/>`;
    }
  // distant hills
  for (let x = 0; x < 64; x++) {
    const top = 30 + Math.round(3 * Math.sin(x / 6));
    for (let y = top; y < 40; y++)
      body += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="${y === top ? '#8fcf7e' : '#6fb36a'}"/>`;
  }
  // grass with dithering
  for (let y = 40; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const t = hash(x, y);
      const c = t < 0.2 ? '#3f8a48' : t < 0.6 ? '#4ea356' : '#5cb862';
      body += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="${c}"/>`;
    }
  // trees: trunk + stepped round canopy
  const trees = [[4, 30, 1.0], [20, 28, 0.85], [45, 27, 0.9], [57, 31, 1.1]];
  for (const [tx, ty, s] of trees) {
    const r = Math.round(5 * s);
    // trunk
    for (let y = ty + r - 1; y < ty + r + 6; y++) {
      body += `<rect x="${tx * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="#6b4a2f"/>`;
    }
    // canopy
    for (let y = ty - r; y <= ty + r; y++)
      for (let x = tx - r; x <= tx + r; x++) {
        const d = Math.hypot(x - tx, y - ty);
        if (d <= r + 0.4) {
          const light = (x < tx && y < ty) ? '#4fa650' : '#2f7d3c';
          const edge = d > r - 0.6 ? '#1e5a2b' : light;
          body += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="${edge}"/>`;
        }
      }
  }
  // character
  body += `<rect x="${24 * CELL}" y="${57 * CELL}" width="${14 * CELL}" height="${CELL}" fill="#2d6b38"/>`;
  body += spriteRects(KNIGHT, 26, 41, ADVENTURER_PAL);
  return svgWrap(body, 512);
}

function svgWrap(inner, size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`;
}

// ---------- high quality vector art (gradients, layered shapes) ----------
const STEEL = `<linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1f7"/><stop offset="0.5" stop-color="#9aa3b5"/><stop offset="1" stop-color="#4b5263"/></linearGradient>`;
const ARMOR = `<linearGradient id="armor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b6ad6"/><stop offset="1" stop-color="#1f3a7d"/></linearGradient>`;

function hqKnight(cx, feet) {
  const x = cx;
  const f = feet;
  return `
  <ellipse cx="${x}" cy="${f + 2}" rx="78" ry="14" fill="#000" opacity="0.35"/>
  <rect x="${x - 36}" y="${f - 80}" width="28" height="82" rx="8" fill="url(#steel)" stroke="#1a1d26" stroke-width="3"/>
  <rect x="${x + 8}" y="${f - 80}" width="28" height="82" rx="8" fill="url(#steel)" stroke="#1a1d26" stroke-width="3"/>
  <rect x="${x - 42}" y="${f - 20}" width="36" height="18" rx="5" fill="#3b2a1e" stroke="#1a1d26" stroke-width="2"/>
  <rect x="${x + 6}" y="${f - 20}" width="36" height="18" rx="5" fill="#3b2a1e" stroke="#1a1d26" stroke-width="2"/>
  <path d="M${x - 52} ${f - 190} Q${x} ${f - 210} ${x + 52} ${f - 190} L${x + 46} ${f - 70} Q${x} ${f - 56} ${x - 46} ${f - 70} Z" fill="url(#armor)" stroke="#1a1d26" stroke-width="3"/>
  <circle cx="${x}" cy="${f - 130}" r="14" fill="#e8b730" stroke="#8a6410" stroke-width="2"/>
  <rect x="${x - 70}" y="${f - 186}" width="26" height="118" rx="13" fill="url(#steel)" stroke="#1a1d26" stroke-width="3" transform="rotate(10 ${x - 57} ${f - 127})"/>
  <rect x="${x + 44}" y="${f - 186}" width="26" height="118" rx="13" fill="url(#steel)" stroke="#1a1d26" stroke-width="3" transform="rotate(-6 ${x + 57} ${f - 127})"/>
  <path d="M${x - 118} ${f - 150} L${x - 60} ${f - 176} L${x - 46} ${f - 88} Q${x - 84} ${f - 60} ${x - 112} ${f - 100} Z" fill="#2b4fb3" stroke="#e8b730" stroke-width="5"/>
  <path d="M${x - 92} ${f - 150} L${x - 76} ${f - 110}" stroke="#e8b730" stroke-width="4"/>
  <polygon points="${x + 80},${f - 90} ${x + 92},${f - 90} ${x + 150},${f - 330} ${x + 140},${f - 336}" fill="url(#steel)" stroke="#1a1d26" stroke-width="2"/>
  <rect x="${x + 62}" y="${f - 96}" width="48" height="8" rx="3" fill="#e8b730" stroke="#8a6410" stroke-width="2"/>
  <rect x="${x + 80}" y="${f - 74}" width="10" height="28" rx="3" fill="#5a3a22"/>
  <rect x="${x - 40}" y="${f - 226}" width="80" height="50" rx="16" fill="url(#steel)" stroke="#1a1d26" stroke-width="3"/>
  <path d="M${x - 40} ${f - 214} Q${x} ${f - 240} ${x + 40} ${f - 214}" fill="none" stroke="#1a1d26" stroke-width="2" opacity="0.5"/>
  <rect x="${x - 26}" y="${f - 205}" width="52" height="8" rx="3" fill="#111"/>
  <path d="M${x} ${f - 272} Q${x + 30} ${f - 258} ${x + 22} ${f - 236} Q${x + 8} ${f - 250} ${x} ${f - 272} Z" fill="#c2362b" stroke="#6b1511" stroke-width="2"/>`;
}

function hqAdventurer(cx, feet) {
  const x = cx;
  const f = feet;
  return `
  <ellipse cx="${x}" cy="${f + 2}" rx="90" ry="14" fill="#000" opacity="0.35"/>
  <path d="M${x - 46} ${f - 140} L${x - 60} ${f - 4} L${x - 10} ${f - 4} L${x} ${f - 140} Z" fill="#4a3620"/>
  <path d="M${x + 4} ${f - 140} L${x + 14} ${f - 4} L${x + 58} ${f - 4} L${x + 46} ${f - 140} Z" fill="#4a3620"/>
  <rect x="${x - 60}" y="${f - 14}" width="50" height="14" rx="5" fill="#2a1e14"/>
  <rect x="${x + 10}" y="${f - 14}" width="50" height="14" rx="5" fill="#2a1e14"/>
  <rect x="${x + 42}" y="${f - 270}" width="70" height="120" rx="16" fill="#6b4a2f" stroke="#2e1f12" stroke-width="3"/>
  <rect x="${x + 44}" y="${f - 252}" width="66" height="10" fill="#4a3220"/>
  <path d="M${x - 52} ${f - 250} Q${x} ${f - 282} ${x + 52} ${f - 250} L${x + 70} ${f - 110} Q${x} ${f - 80} ${x - 70} ${f - 110} Z" fill="url(#cloak)" stroke="#1d3a25" stroke-width="3"/>
  <path d="M${x - 40} ${f - 250} L${x - 50} ${f - 130} M${x + 40} ${f - 250} L${x + 52} ${f - 130}" stroke="#2d5a36" stroke-width="4" fill="none"/>
  <path d="M${x - 40} ${f - 240} Q${x} ${f - 226} ${x + 40} ${f - 240} L${x + 38} ${f - 200} Q${x} ${f - 190} ${x - 38} ${f - 200} Z" fill="#c69a5b" stroke="#6b4a2f" stroke-width="2"/>
  <rect x="${x - 40}" y="${f - 180}" width="80" height="12" rx="4" fill="#3a2716"/>
  <rect x="${x - 6}" y="${f - 182}" width="12" height="16" rx="2" fill="#e8b730" stroke="#8a6410" stroke-width="1.5"/>
  <rect x="${x - 46}" y="${f - 236}" width="22" height="90" rx="11" fill="#3f7a4a" stroke="#1d3a25" stroke-width="2" transform="rotate(12 ${x - 35} ${f - 236})"/>
  <rect x="${x + 26}" y="${f - 236}" width="22" height="90" rx="11" fill="#3f7a4a" stroke="#1d3a25" stroke-width="2" transform="rotate(-8 ${x + 37} ${f - 236})"/>
  <line x1="${x + 74}" y1="${f - 290}" x2="${x + 86}" y2="${f - 8}" stroke="#7a5230" stroke-width="7" stroke-linecap="round"/>
  <circle cx="${x + 74}" cy="${f - 292}" r="11" fill="#7fd6ff" opacity="0.9" stroke="#2a6e99" stroke-width="2"/>
  <ellipse cx="${x}" cy="${f - 280}" rx="44" ry="50" fill="#3f7a4a" stroke="#1d3a25" stroke-width="3"/>
  <path d="M${x - 46} ${f - 290} Q${x} ${f - 346} ${x + 46} ${f - 290} Q${x + 44} ${f - 258} ${x} ${f - 250} Q${x - 44} ${f - 258} ${x - 46} ${f - 290} Z" fill="#2d5a36" stroke="#1d3a25" stroke-width="3"/>
  <ellipse cx="${x + 2}" cy="${f - 270}" rx="26" ry="28" fill="#c69a5b"/>
  <circle cx="${x - 8}" cy="${f - 272}" r="3.5" fill="#222"/>
  <circle cx="${x + 12}" cy="${f - 272}" r="3.5" fill="#222"/>
  <path d="M${x - 6} ${f - 254} Q${x + 2} ${f - 250} ${x + 10} ${f - 254}" stroke="#6b3b22" stroke-width="2.5" fill="none"/>`;
}

function hqDungeon() {
  const defs = `
  <defs>
    ${STEEL}${ARMOR}
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f3d"/><stop offset="1" stop-color="#141722"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2a3a"/><stop offset="1" stop-color="#0f0d15"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb347" stop-opacity="0.75"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <pattern id="brick" width="64" height="32" patternUnits="userSpaceOnUse"><path d="M0 0 H64 M0 16 H64 M0 0 V16 M32 16 V32" stroke="#0b0d13" stroke-width="2" fill="none" opacity="0.6"/></pattern>
  </defs>`;
  const arch = (x) => `<path d="M${x} 470 V250 Q${x} 150 ${x + 60} 150 Q${x + 120} 150 ${x + 120} 250 V470 Z" fill="#0c0e15" stroke="#3a4152" stroke-width="6"/>`;
  return svgWrap(`
  ${defs}
  <rect width="512" height="512" fill="url(#wall)"/>
  <rect width="512" height="512" fill="url(#brick)"/>
  ${arch(40)}${arch(352)}
  <rect x="200" y="120" width="112" height="350" fill="#1a1e2a" opacity="0.6"/>
  <circle cx="100" cy="200" r="120" fill="url(#glow)"/>
  <circle cx="412" cy="200" r="120" fill="url(#glow)"/>
  <rect x="92" y="236" width="16" height="36" rx="3" fill="#4a3220"/>
  <rect x="404" y="236" width="16" height="36" rx="3" fill="#4a3220"/>
  <path d="M100 178 Q90 200 100 218 Q112 200 100 178 Z" fill="#ffb347"/>
  <path d="M412 178 Q402 200 412 218 Q424 200 412 178 Z" fill="#ffb347"/>
  <rect y="380" width="512" height="132" fill="url(#floor)"/>
  <path d="M0 380 L512 380" stroke="#4a4358" stroke-width="3"/>
  ${hqKnight(256, 440)}
  `, 512);
}

function hqField() {
  const defs = `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa8ee"/><stop offset="0.7" stop-color="#bfe6ff"/><stop offset="1" stop-color="#f4fbff"/></linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff6c2"/><stop offset="0.4" stop-color="#ffe27a" stop-opacity="0.8"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></radialGradient>
    <linearGradient id="farHill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fbf7f"/><stop offset="1" stop-color="#5e9a5e"/></linearGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc46a"/><stop offset="1" stop-color="#3c7a3a"/></linearGradient>
    <linearGradient id="trunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a3220"/><stop offset="0.5" stop-color="#8a5f3a"/><stop offset="1" stop-color="#4a3220"/></linearGradient>
    <radialGradient id="canopy" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#9be08a"/><stop offset="0.6" stop-color="#4fa650"/><stop offset="1" stop-color="#1e5a2b"/></radialGradient>
    <linearGradient id="cloak" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2d5a36"/><stop offset="0.5" stop-color="#4f9a5e"/><stop offset="1" stop-color="#2d5a36"/></linearGradient>
  </defs>`;
  const tree = (x, y, s) => `
    <rect x="${x - 7 * s}" y="${y}" width="${14 * s}" height="${90 * s}" rx="${4 * s}" fill="url(#trunk)"/>
    <ellipse cx="${x}" cy="${y - 20 * s}" rx="${62 * s}" ry="${70 * s}" fill="url(#canopy)"/>
    <ellipse cx="${x - 16 * s}" cy="${y - 52 * s}" rx="${24 * s}" ry="${20 * s}" fill="#b6f0a0" opacity="0.35"/>`;
  return svgWrap(`
  ${defs}
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="400" cy="110" r="110" fill="url(#sun)"/>
  <circle cx="400" cy="110" r="34" fill="#fff6c2"/>
  <ellipse cx="120" cy="90" rx="60" ry="18" fill="#fff" opacity="0.8"/>
  <ellipse cx="150" cy="78" rx="40" ry="16" fill="#fff" opacity="0.8"/>
  <path d="M0 300 Q90 240 180 290 T380 280 T512 270 V360 H0 Z" fill="url(#farHill)"/>
  ${tree(60, 300, 0.8)}
  ${tree(440, 296, 0.9)}
  <rect y="350" width="512" height="162" fill="url(#grass)"/>
  <path d="M0 360 Q256 340 512 362" stroke="#9be08a" stroke-width="4" fill="none" opacity="0.6"/>
  ${tree(372, 358, 1.25)}
  ${tree(150, 380, 1.1)}
  ${hqAdventurer(256, 450)}
  `, 512);
}

// ---------- build ----------
render(pixelDungeon(), 'pixel_dungeon');
render(pixelField(), 'pixel_field');
render(hqDungeon(), 'hq_dungeon');
render(hqField(), 'hq_field');
