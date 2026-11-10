// Coffre : chiffrement des données au repos (WebCrypto natif).
// Clé de données AES-GCM 256 aléatoire, jamais stockée en clair, enfermée (AES-KW) deux fois :
// par une clé dérivée du code et par une clé dérivée du code de secours (PBKDF2-SHA256).
// Aucun code, aucune clé, aucune donnée dans les messages d'erreur ni la console.

export const ITERATIONS = 600_000;
export const CODE_MIN = 6;
export const CODE_MAX = 12;
/** 32 signes sans ambiguïté (ni 0/O, ni 1/I) : 24 signes = 120 bits de hasard. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const LONGUEUR_SECOURS = 24;

export type Octets = Uint8Array<ArrayBuffer>;
export interface Enveloppe {
  sel: Octets;
  cle: Octets;
}
export interface Coffre {
  cle: 'coffre';
  version: 1;
  iterations: number;
  code: Enveloppe;
  secours: Enveloppe;
}
export interface Chiffre {
  iv: Octets;
  d: Octets;
}

/** Erreur au message fixe, montrable tel quel. */
export class ErreurCoffre extends Error {}
const MAUVAIS = 'Code incorrect.';

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = () => crypto.subtle;

async function cleEnveloppe(secret: string, sel: Octets, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations },
    base,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

async function envelopper(brute: CryptoKey, secret: string, iterations: number): Promise<Enveloppe> {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const kek = await cleEnveloppe(secret, sel, iterations);
  return { sel, cle: new Uint8Array(await subtle().wrapKey('raw', brute, kek, 'AES-KW')) };
}

/** AES-KW vérifie l'intégrité : un mauvais code fait échouer l'ouverture. */
async function ouvrir(env: Enveloppe, secret: string, iterations: number, extractable: boolean): Promise<CryptoKey> {
  const kek = await cleEnveloppe(secret, env.sel, iterations);
  try {
    return await subtle().unwrapKey('raw', env.cle, kek, 'AES-KW', 'AES-GCM', extractable, ['encrypt', 'decrypt']);
  } catch {
    throw new ErreurCoffre(MAUVAIS);
  }
}

export function genererSecours(): string {
  return [...crypto.getRandomValues(new Uint8Array(LONGUEUR_SECOURS))].map((o) => ALPHABET[o % 32]).join('');
}

/** Affichage par groupes de 4 : « ABCD-EFGH-… ». */
export const formaterSecours = (s: string) => s.match(/.{1,4}/g)!.join('-');
/** Saisie tolérante : minuscules, espaces et tirets acceptés. */
export const normaliserSecours = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '');

export const codeValide = (code: string) => /^\d+$/.test(code) && code.length >= CODE_MIN && code.length <= CODE_MAX;

/** Indicateur de solidité (sans bloquer) : 8 chiffres ou plus conseillés, suites et répétitions = faible. */
export function solidite(code: string): 'faible' | 'correct' | 'solide' {
  const pas = [...code].slice(1).map((c, i) => (Number(c) - Number(code[i]) + 10) % 10);
  const simple = pas.length > 0 && pas.every((p) => p === pas[0] && (p === 0 || p === 1 || p === 9));
  if (simple || code.length < 8) return 'faible';
  return code.length >= 10 ? 'solide' : 'correct';
}

/** Délai imposé après `echecs` erreurs consécutives (ms). Jamais d'effacement. */
export function delaiApres(echecs: number): number {
  const PALIERS = [0, 0, 0, 30, 60, 300, 900];
  return echecs < 1 ? 0 : (PALIERS[echecs - 1] ?? 3600) * 1000;
}

/** Création : nouvelle clé de données, enfermée par le code et par un code de secours neuf. */
export async function creerCoffre(code: string, iterations = ITERATIONS): Promise<{ coffre: Coffre; cle: CryptoKey; secours: string }> {
  const brute = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const secours = genererSecours();
  const [envCode, envSecours, octets] = await Promise.all([
    envelopper(brute, code, iterations),
    envelopper(brute, secours, iterations),
    subtle().exportKey('raw', brute),
  ]);
  // La clé utilisée ensuite n'est pas exportable.
  const cle = await subtle().importKey('raw', octets, 'AES-GCM', false, ['encrypt', 'decrypt']);
  new Uint8Array(octets).fill(0);
  return { coffre: { cle: 'coffre', version: 1, iterations, code: envCode, secours: envSecours }, cle, secours };
}

export const ouvrirAvecCode = (c: Coffre, code: string) => ouvrir(c.code, code, c.iterations, false);
export const ouvrirAvecSecours = (c: Coffre, secours: string) => ouvrir(c.secours, normaliserSecours(secours), c.iterations, false);

/** Nouveau code, prouvé par le code actuel ou le code de secours. La clé de données ne change pas : rien à rechiffrer. */
export async function changerCode(c: Coffre, preuve: { code: string } | { secours: string }, nouveau: string): Promise<Coffre> {
  const brute =
    'code' in preuve
      ? await ouvrir(c.code, preuve.code, c.iterations, true)
      : await ouvrir(c.secours, normaliserSecours(preuve.secours), c.iterations, true);
  return { ...c, code: await envelopper(brute, nouveau, c.iterations) };
}

/** Données additionnelles : un enregistrement chiffré est lié à son magasin et à sa clé (pas d'échange possible). */
const lien = (magasin: string, cle: string) => te.encode(`${magasin}/${cle}`);

export async function chiffrer(cle: CryptoKey, magasin: string, id: string, valeur: unknown): Promise<Chiffre> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // IV neuf à chaque écriture
  const d = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: lien(magasin, id) }, cle, te.encode(JSON.stringify(valeur)));
  return { iv, d: new Uint8Array(d) };
}

export async function dechiffrer<T>(cle: CryptoKey, magasin: string, id: string, c: Chiffre): Promise<T> {
  try {
    const clair = await subtle().decrypt({ name: 'AES-GCM', iv: c.iv, additionalData: lien(magasin, id) }, cle, c.d);
    return JSON.parse(td.decode(clair)) as T;
  } catch {
    throw new ErreurCoffre('Données illisibles ou modifiées.');
  }
}

export function versB64(o: Uint8Array): string {
  let s = '';
  for (const b of o) s += String.fromCharCode(b);
  return btoa(s);
}

export const depuisB64 = (t: string): Octets => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
