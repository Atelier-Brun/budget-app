// Plugin Vite local (compilation uniquement) : CSP, balises iOS, manifest, icônes et service worker.
// Une instance par mode : app (/budget-app/) ou démo (/budget-app/demo/), sans rien de partagé.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

// GitHub Pages n'envoie pas d'en-têtes HTTP personnalisés : CSP en <meta>.
// frame-ancestors y est ignoré par les navigateurs → protection anti-iframe en JS (src/anti-iframe.ts).
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const FOND = '#1A1410';
const TAILLES = [180, 192, 512] as const;

export function pwa(demo: boolean, base: string): Plugin {
  const nom = demo ? 'BAARA DÉMO' : 'BAARA';
  const prefixe = demo ? 'budget-demo-' : 'budget-app-';
  return {
    name: 'budget-pwa',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      if (!html.includes('<meta charset="utf-8" />')) throw new Error('index.html : balise charset introuvable, CSP non insérée');
      return {
        // CSP juste après le charset, avant tout script.
        html: html
          .replace('<meta charset="utf-8" />', `$&\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
          .replace('<title>BAARA</title>', `<title>${nom}</title>`),
        tags: [
          { tag: 'meta', attrs: { name: 'theme-color', content: FOND }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: nom }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'manifest', href: `${base}manifest.webmanifest` }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}icone-180.png` }, injectTo: 'head' },
        ],
      };
    },
    generateBundle(_options, bundle) {
      for (const taille of TAILLES) {
        this.emitFile({
          type: 'asset',
          fileName: `icone-${taille}.png`,
          source: readFileSync(`icones/${demo ? 'demo' : 'app'}-${taille}.png`),
        });
      }
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify({
          id: base,
          name: nom,
          short_name: nom,
          lang: 'fr',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: FOND,
          theme_color: FOND,
          icons: [192, 512].map((t) => ({ src: `icone-${t}.png`, sizes: `${t}x${t}`, type: 'image/png' })),
        }),
      });
      // Tout le build est précaché (les fichiers émis ci-dessus n'apparaissent pas dans `bundle`).
      const emis = [...TAILLES.map((t) => `icone-${t}.png`), 'manifest.webmanifest'];
      const fichiers = [...Object.keys(bundle), ...emis].sort();
      // Le nom du cache change dès que le code change (icônes et manifest dérivent de la version du code).
      const empreinte = createHash('sha256');
      for (const sortie of Object.values(bundle)) {
        empreinte.update(sortie.fileName).update(sortie.type === 'chunk' ? sortie.code : sortie.source);
      }
      const config = {
        cache: prefixe + empreinte.digest('hex').slice(0, 12),
        prefixe,
        base,
        fichiers: fichiers.map((f) => base + f),
        // L'app ne doit jamais servir les pages de la démo (même origine, portée englobante).
        exclu: demo ? null : `${base}demo/`,
      };
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const CONFIG = ${JSON.stringify(config)};\n${readFileSync('sw/sw.js', 'utf8')}`,
      });
    },
  };
}
