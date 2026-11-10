<script lang="ts">
  // Logo dessiné en SVG (mêmes formes et couleurs que l'icône), aucune police.
  import { pointsLogo } from '../lib/logo';

  let { taille }: { taille: number } = $props();
  const points = pointsLogo();
</script>

<svg class="logo" width={taille} height={taille} viewBox="0 0 100 100" aria-hidden="true">
  <defs>
    <linearGradient id="logo-fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2E1B11" /><stop offset="1" stop-color="#1C0F09" />
    </linearGradient>
    <radialGradient id="logo-lueur" gradientUnits="userSpaceOnUse" cx="50" cy="0" r="60">
      <stop offset="0" stop-color="#5A3A24" stop-opacity="0.55" /><stop offset="1" stop-color="#5A3A24" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="logo-trait" gradientUnits="userSpaceOnUse" x1="25" y1="10" x2="75" y2="90">
      <stop offset="0" stop-color="#E9CFA3" /><stop offset="0.55" stop-color="#C8A97E" /><stop offset="1" stop-color="#8F6E45" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#logo-fond)" />
  <rect width="100" height="100" rx="22" fill="url(#logo-lueur)" />
  <polygon {points} fill="none" stroke="url(#logo-trait)" stroke-width="9" stroke-linejoin="round" />
</svg>

<style>
  .logo {
    display: block;
    flex: none;
    border-radius: 22%; /* même arrondi que le rx 22 du dessin, pour que l'ombre suive la forme */
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.45);
  }
</style>
