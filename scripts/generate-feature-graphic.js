#!/usr/bin/env node
// Generates a 1024x500 Google Play feature graphic: assets/feature-graphic.png
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

// Vulcan logo paths (white, viewBox 50.09 17.56 94.57 94.6)
const logoPathsD = [
  "M99.0084 68.3983L102.924 52.4297L83.4102 59.9654L99.0084 68.3983Z",
  "M101.248 32.7773L92.0586 32.377L75.2148 36.6793L79.3945 55.4044L101.248 32.7773Z",
  "M105.498 47.184L104.105 35.5234L85.3203 54.9725L105.498 47.184Z",
  "M128.467 49.6729L120.27 40.1357L107.945 34.2471L109.374 46.166L128.467 49.6729Z",
  "M71.7196 39.2275L61.2383 49.905L75.4777 56.0673L71.7196 39.2275Z",
  "M127.41 53.5135L107.637 49.875L103.352 67.3377L127.41 53.5135Z",
  "M79.2908 62.2441L75.6133 71.7403L82.3001 82.4835L96.6619 71.6393L79.2908 62.2441Z",
  "M107.105 69.751L132.855 71.1646L134.841 68.0226L132.045 55.4248L107.105 69.751Z",
  "M97.3791 17.5645C71.2641 17.5645 50.0938 38.7416 50.0938 64.8652C50.0938 90.9893 71.2641 112.166 97.3791 112.166C123.495 112.166 144.665 90.9893 144.665 64.8652C144.665 38.7416 123.495 17.5645 97.3791 17.5645ZM129.456 83.971C129.051 84.6195 128.311 84.9794 127.536 84.8779L113.574 83.1447L111.492 88.339L111.821 99.2853C111.847 100.116 111.355 100.871 110.59 101.18C110.347 101.282 110.094 101.327 109.846 101.327C109.298 101.327 108.771 101.104 108.386 100.689L96.1014 87.3563H81.7648H81.7546C81.5972 87.3515 81.4452 87.3311 81.2932 87.2956C81.2379 87.2806 81.1922 87.2601 81.1364 87.2397C81.0402 87.2096 80.9441 87.1742 80.8474 87.1231C80.7921 87.093 80.7411 87.0522 80.6906 87.0221C80.6095 86.9711 80.5338 86.9157 80.4575 86.8497C80.407 86.804 80.3614 86.7481 80.3109 86.6976C80.27 86.6519 80.2244 86.6165 80.1841 86.566C80.1637 86.5407 80.1487 86.5053 80.1283 86.4746C80.1132 86.4542 80.0976 86.4392 80.0826 86.4188L72.0837 73.5625L58.6736 68.4542C57.9694 68.1909 57.478 67.5473 57.4071 66.7972L55.8318 50.7729C55.827 50.7425 55.8318 50.7172 55.8318 50.6868C55.827 50.6006 55.827 50.5145 55.8367 50.4283C55.842 50.3776 55.8469 50.3219 55.8522 50.2661C55.8673 50.1851 55.8823 50.104 55.9076 50.028C55.9231 49.9722 55.9382 49.9165 55.9586 49.8608C55.9688 49.8354 55.9736 49.81 55.9838 49.7847C56.0091 49.729 56.0397 49.6834 56.0649 49.6327C56.0902 49.5871 56.1154 49.5364 56.146 49.4908C56.2019 49.4097 56.2626 49.3388 56.3233 49.2678C56.3485 49.2425 56.3635 49.2121 56.3893 49.1868L71.4446 33.8474C71.4548 33.8322 71.4698 33.8272 71.48 33.817C71.5815 33.7207 71.6927 33.6346 71.8194 33.5586C71.8549 33.5332 71.8957 33.513 71.9312 33.4927C72.0472 33.4319 72.1691 33.3812 72.2958 33.3457C72.3211 33.3356 72.3415 33.3204 72.3667 33.3154L91.3594 28.4606C91.5468 28.4149 91.7391 28.3896 91.9368 28.3997L105.812 29.0079C105.847 29.0079 105.888 29.0231 105.929 29.0231C105.999 29.0332 106.07 29.0383 106.147 29.0535C106.202 29.0687 106.258 29.0839 106.314 29.0991C106.385 29.1193 106.451 29.1447 106.517 29.1751C106.537 29.1852 106.557 29.1903 106.582 29.2004L122.352 36.7359C122.6 36.8525 122.823 37.0248 123.001 37.2326L134.87 51.0462C134.875 51.0462 134.875 51.0462 134.875 51.0513L134.891 51.0716C134.906 51.0919 134.916 51.1071 134.926 51.1273C134.992 51.2084 135.052 51.2844 135.108 51.3756C135.118 51.3959 135.129 51.4162 135.133 51.4365C135.159 51.4821 135.174 51.5277 135.195 51.5733C135.235 51.6696 135.275 51.7659 135.296 51.8672C135.306 51.8925 135.316 51.9128 135.321 51.9382L138.882 67.9663C138.999 68.4784 138.903 69.0151 138.624 69.4562L129.456 83.971Z",
  "M99.4834 77.2809L98.6224 75.127L87.6797 83.3874H96.9655C97.5181 83.3874 98.0499 83.6201 98.4199 84.0257L104.352 90.4665L99.4785 77.2809H99.4834Z",
  "M60.1016 53.7373L61.2262 65.1897L72.2748 69.396L75.7197 60.4924L60.1016 53.7373Z",
  "M103.553 76.7689L103.523 76.784L107.545 87.6593C107.571 87.5175 107.606 87.3805 107.661 87.2489L110.468 80.2553C110.808 79.4193 111.658 78.9126 112.551 79.0292L126.781 80.7877L130.434 75.0056L102.227 73.4551L103.553 76.7689Z",
];

const logoPaths = logoPathsD.map(d => `<path d="${d}" fill="#ffffff"/>`).join('\n    ');

// NDVI-style grid: 12 cols x 7 rows of coloured cells with slight gaps
// Colors inspired by NDVI palette: deep red → yellow → light green → dark green
const ndviColors = [
  '#7f1d1d','#991b1b','#b45309','#d97706','#fbbf24',
  '#a3e635','#65a30d','#4ade80','#22c55e','#16a34a',
  '#15803d','#166534','#14532d','#052e16',
];

function ndviColor(row, col) {
  // Simulate a vegetation gradient – edges drier, centre lusher
  const cx = 5.5, cy = 3;
  const dist = Math.sqrt((col - cx) ** 2 + (row - cy) ** 2);
  const idx = Math.min(ndviColors.length - 1,
    Math.floor((dist / 8) * ndviColors.length));
  // Add some noise per cell
  const noise = ((row * 7 + col * 3) % 3) - 1;
  return ndviColors[Math.max(0, Math.min(ndviColors.length - 1, idx + noise))];
}

const COLS = 12, ROWS = 7;
const CELL_W = 44, CELL_H = 44, GAP = 3;
const GRID_X = 530, GRID_Y = 50;

let gridCells = '';
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x = GRID_X + c * (CELL_W + GAP);
    const y = GRID_Y + r * (CELL_H + GAP);
    const color = ndviColor(r, c);
    const opacity = 0.55 + Math.random() * 0.3;
    gridCells += `<rect x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" rx="4" fill="${color}" opacity="${opacity.toFixed(2)}"/>\n    `;
  }
}

// Grid overlay: thin white lines suggesting lat/lon grid
let gridLines = '';
for (let c = 0; c <= COLS; c++) {
  const x = GRID_X + c * (CELL_W + GAP) - GAP / 2;
  gridLines += `<line x1="${x}" y1="${GRID_Y - 6}" x2="${x}" y2="${GRID_Y + ROWS * (CELL_H + GAP)}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>\n    `;
}
for (let r = 0; r <= ROWS; r++) {
  const y = GRID_Y + r * (CELL_H + GAP) - GAP / 2;
  gridLines += `<line x1="${GRID_X - 6}" y1="${y}" x2="${GRID_X + COLS * (CELL_W + GAP)}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>\n    `;
}

// Pill badges for indices
const badges = [
  { label: 'NDVI', color: '#16a34a' },
  { label: 'NDRE', color: '#0e7490' },
  { label: 'NDMI', color: '#1d4ed8' },
  { label: 'GNDVI', color: '#7e22ce' },
];
let badgeSvg = '';
let bx = 80;
const by = 380;
for (const b of badges) {
  const w = b.label.length * 11 + 24;
  badgeSvg += `
  <rect x="${bx}" y="${by}" width="${w}" height="28" rx="14" fill="${b.color}" opacity="0.85"/>
  <text x="${bx + w / 2}" y="${by + 19}" font-family="'Helvetica Neue',Arial,sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${b.label}</text>`;
  bx += w + 12;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1a2e1a"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0"/>
      <stop offset="40%" stop-color="#0f172a" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="gridClip">
      <rect x="520" y="0" width="504" height="500"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="1024" height="500" fill="url(#bg)"/>

  <!-- NDVI grid (right side) -->
  <g clip-path="url(#gridClip)" opacity="0.9">
    ${gridCells}
    ${gridLines}
  </g>

  <!-- Fade overlay blending grid into left panel -->
  <rect width="1024" height="500" fill="url(#fade)"/>

  <!-- Subtle top accent line -->
  <rect x="80" y="72" width="3" height="52" rx="2" fill="#22c55e" opacity="0.9"/>

  <!-- Vulcan logo (scaled ~72px, centred at 130,108) -->
  <g transform="translate(93, 72) scale(0.76)" opacity="0.95">
    <svg viewBox="50.09 17.56 94.57 94.6" width="95" height="95">
      ${logoPaths}
    </svg>
  </g>

  <!-- "by Vulcan AI" label -->
  <text x="165" y="105" font-family="'Helvetica Neue',Arial,sans-serif" font-size="13" fill="rgba(255,255,255,0.45)" letter-spacing="1.5" font-weight="500">BY VULCAN AI</text>

  <!-- App name -->
  <text x="80" y="200" font-family="'Helvetica Neue',Arial,sans-serif" font-size="72" font-weight="800" fill="#ffffff" letter-spacing="-1">CeresPeng</text>

  <!-- Divider -->
  <rect x="80" y="218" width="340" height="2" rx="1" fill="rgba(34,197,94,0.5)"/>

  <!-- Tagline -->
  <text x="80" y="263" font-family="'Helvetica Neue',Arial,sans-serif" font-size="22" fill="rgba(255,255,255,0.75)" letter-spacing="0.2">Satellite crop intelligence,</text>
  <text x="80" y="295" font-family="'Helvetica Neue',Arial,sans-serif" font-size="22" fill="rgba(255,255,255,0.75)" letter-spacing="0.2">in the palm of your hand.</text>

  <!-- Index badges -->
  ${badgeSvg}

  <!-- Bottom tagline -->
  <text x="80" y="460" font-family="'Helvetica Neue',Arial,sans-serif" font-size="13" fill="rgba(255,255,255,0.3)" letter-spacing="1">PRECISION AGRICULTURE · REMOTE SENSING · FIELD ANALYTICS</text>
</svg>`;

const resvg = new Resvg(svg, {
  font: {
    loadSystemFonts: false,
    fontDirs: ['C:\\Windows\\Fonts'],
    defaultFontFamily: 'Arial',
  },
});
const pngData = resvg.render();
const pngBuffer = pngData.asPng();

const outPath = path.join(__dirname, '../assets/feature-graphic.png');
fs.writeFileSync(outPath, pngBuffer);
console.log(`✓ Feature graphic written to ${outPath} (${pngBuffer.length} bytes)`);
