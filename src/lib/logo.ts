// Logo « infini vertical », source unique pour l'app (App.svelte) et les icônes (scripts/generer-icones.mjs).
// Courbe x = 50 + 18·sin(2t), y = 50 + 22·sin(t), t de 0 à 2π, repère 100×100.

/** Points de la polyligne fermée, au format de l'attribut SVG `points`. */
export function pointsLogo(n = 360): string {
  return Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n;
    return `${(50 + 18 * Math.sin(2 * t)).toFixed(3)},${(50 + 22 * Math.sin(t)).toFixed(3)}`;
  }).join(' ');
}
