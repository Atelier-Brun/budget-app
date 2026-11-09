// Génère les icônes PNG (app et démo) à partir d'un SVG, avec le WebKit déjà installé par Playwright.
// Usage : node scripts/generer-icones.mjs  → icones/{app,demo}-{180,192,512}.png (versionnés).
// Logo « infini vertical » : courbe x = 50 + 18·sin(2t), y = 50 + 22·sin(t), repère 100×100, aucune police.
// La 180 (apple-touch-icon) est pleine page : iOS arrondit lui-même les coins. La 192 et la 512 sont arrondies.
import { mkdirSync } from 'node:fs';
import { webkit } from '@playwright/test';
import { pointsLogo } from '../src/lib/logo.ts';

const points = pointsLogo();

// « DÉMO » dessiné en traits (lettres de 7×10), centré en bas, sur bandeau caramel.
const DEMO = `<rect y="80" width="100" height="20" fill="#C8A97E"/>
  <g fill="none" stroke="#1C0F09" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path transform="translate(31.5 86)" d="M0 0 V10 H2 A5 5 0 0 0 2 0 Z"/>
    <path transform="translate(41.5 86)" d="M7 0 H0 V10 H7 M0 5 H5 M2.5 -1.8 L5 -3.8"/>
    <path transform="translate(51.5 86)" d="M0 10 V0 L3.5 6 L7 0 V10"/>
    <ellipse cx="65" cy="91" rx="3.5" ry="5"/>
  </g>`;

/** @param {boolean} demo @param {boolean} arrondi */
function svg(demo, arrondi) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2E1B11"/><stop offset="1" stop-color="#1C0F09"/>
    </linearGradient>
    <radialGradient id="lueur" gradientUnits="userSpaceOnUse" cx="50" cy="0" r="60">
      <stop offset="0" stop-color="#5A3A24" stop-opacity="0.55"/><stop offset="1" stop-color="#5A3A24" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="trait" gradientUnits="userSpaceOnUse" x1="25" y1="10" x2="75" y2="90">
      <stop offset="0" stop-color="#E9CFA3"/><stop offset="0.55" stop-color="#C8A97E"/><stop offset="1" stop-color="#8F6E45"/>
    </linearGradient>
    <clipPath id="forme"><rect width="100" height="100" rx="${arrondi ? 22 : 0}"/></clipPath>
  </defs>
  <g clip-path="url(#forme)">
    <rect width="100" height="100" fill="url(#fond)"/>
    <rect width="100" height="100" fill="url(#lueur)"/>
    <polygon points="${points}" fill="none" stroke="url(#trait)" stroke-width="9" stroke-linejoin="round"/>
    ${demo ? DEMO : ''}
  </g>
</svg>`;
}

mkdirSync('icones', { recursive: true });
const navigateur = await webkit.launch();
const page = await navigateur.newPage();
for (const demo of [false, true]) {
  for (const taille of [180, 192, 512]) {
    await page.setViewportSize({ width: taille, height: taille });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${taille}px;height:${taille}px}</style>${svg(demo, taille !== 180)}`,
    );
    // omitBackground : coins vraiment transparents pour les icônes arrondies.
    await page.screenshot({ path: `icones/${demo ? 'demo' : 'app'}-${taille}.png`, omitBackground: true });
  }
}
await navigateur.close();
