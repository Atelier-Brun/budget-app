// Anti-iframe (clickjacking). GitHub Pages ne permet pas l'en-tête `frame-ancestors`, et cette
// directive est ignorée dans une CSP en <meta>. Limite : protection uniquement par JavaScript ;
// si le script ne s'exécute pas (iframe sandbox sans scripts), l'app n'affiche de toute façon rien.
export function estDansUnCadre(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true; // accès à window.top refusé : forcément dans un cadre d'une autre origine
  }
}
