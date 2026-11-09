// Génère les icônes PNG (app et démo) à partir d'un SVG, avec le WebKit déjà installé par Playwright.
// Usage : node scripts/generer-icones.mjs  → icones/{app,demo}-{180,192,512}.png (versionnés).
import { mkdirSync } from 'node:fs';
import { webkit } from '@playwright/test';

/** @param {boolean} demo */
function svg(demo) {
  const mention = demo
    ? '<text x="256" y="452" font-size="58" font-weight="700" letter-spacing="10" fill="#C8A97E" text-anchor="middle" font-family="sans-serif">DÉMO</text>'
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3A2E24"/><stop offset="1" stop-color="#1A1410"/>
    </linearGradient>
    <linearGradient id="lettre" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#D9BE95"/><stop offset="1" stop-color="#A9875A"/>
    </linearGradient>
    <filter id="relief" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.55"/>
      <feDropShadow dx="0" dy="-1.5" stdDeviation="0.5" flood-color="#F2E8DA" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#fond)"/>
  <text x="256" y="${demo ? 352 : 372}" font-size="${demo ? 300 : 340}" font-weight="700" fill="url(#lettre)"
        text-anchor="middle" font-family="serif" filter="url(#relief)">B</text>
  ${mention}
</svg>`;
}

mkdirSync('icones', { recursive: true });
const navigateur = await webkit.launch();
const page = await navigateur.newPage();
for (const demo of [false, true]) {
  for (const taille of [180, 192, 512]) {
    await page.setViewportSize({ width: taille, height: taille });
    await page.setContent(
      `<style>html,body{margin:0}svg{display:block;width:${taille}px;height:${taille}px}</style>${svg(demo)}`,
    );
    await page.screenshot({ path: `icones/${demo ? 'demo' : 'app'}-${taille}.png` });
  }
}
await navigateur.close();
