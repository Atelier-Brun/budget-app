// Sauvegarde externe et restauration. Le fichier contient les données DÉJÀ chiffrées et les clés enfermées
// (code et code de secours en vigueur au moment de la sauvegarde) : il est illisible sans l'un de ces codes.
// Tout fichier importé est vérifié strictement (format, version, chiffrement, contenu) avant d'être proposé.
import type { Categorie } from './categories.ts';
import { chiffrer, dechiffrer, depuisB64, ITERATIONS, versB64, type Chiffre, type Coffre, type Enveloppe } from './coffre.ts';
import { TYPES, type Compte } from './comptes.ts';
import { estDateValide } from './dates.ts';
import { MONTANT_MAX } from './montants.ts';
import { NOM_MAX } from './noms.ts';
import { verifierEcheance, type Echeance } from './echeances.ts';
import { NOTE_MAX, type OperationComplete } from './operations.ts';
import { verifierOperation } from './soldes.ts';
import { DONNEES, type Brut, type Clair, type Magasin, type Scelle } from './stockage.ts';

export const FORMAT = 'budget-sauvegarde';
export const VERSION_FORMAT = 1;
export const TAILLE_MAX = 50 * 1024 * 1024;

export interface Donnees {
  comptes: Compte[];
  categories: Categorie[];
  operations: OperationComplete[];
  meta: { cle: string }[];
  echeances: Echeance[];
}
export interface Fichier {
  demo: boolean;
  date: string;
  coffre: Coffre;
  donnees: Brut;
  resume: Chiffre;
}
type Resume = { date: string; nb: Record<Magasin, number> };

/** Erreur au message fixe, montrable tel quel (jamais de donnée ni de détail technique). */
export class ErreurSauvegarde extends Error {}
const NON_RECONNU = 'Fichier non reconnu : ce n’est pas une sauvegarde BUDGET valide.';
const INVALIDE = 'Contenu de la sauvegarde invalide : rien n’a été modifié.';

export const nomFichier = (date: string, demo: boolean) => `budget-${demo ? 'demo-' : ''}sauvegarde-${date}.json`;

const compter = (d: Brut | Clair) => Object.fromEntries(DONNEES.map((m) => [m, d[m].length])) as Record<Magasin, number>;
const b64 = (c: Chiffre) => ({ iv: versB64(c.iv), d: versB64(c.d) });
const env64 = (e: Enveloppe) => ({ sel: versB64(e.sel), cle: versB64(e.cle) });
const champ = (m: string) => (m === 'meta' ? 'cle' : 'id');
/** Magasins apparus après la 0.3.0 : absents des sauvegardes et copies plus anciennes (lus comme vides). */
const FACULTATIFS: readonly string[] = ['echeances'];

export async function creerFichier(cle: CryptoKey, coffre: Coffre, donnees: Brut, date: string, demo: boolean): Promise<string> {
  const resume = await chiffrer(cle, 'resume', date, { date, nb: compter(donnees) } satisfies Resume);
  return JSON.stringify({
    format: FORMAT,
    version: VERSION_FORMAT,
    demo,
    date,
    coffre: { iterations: coffre.iterations, code: env64(coffre.code), secours: env64(coffre.secours) },
    resume: b64(resume),
    donnees: Object.fromEntries(DONNEES.map((m) => [m, donnees[m].map((r) => ({ [champ(m)]: r[champ(m)], ...b64(r) }))])),
  });
}

type Brute = Record<string, unknown>;
const estObjet = (v: unknown): v is Brute => typeof v === 'object' && v !== null && !Array.isArray(v);
const texte = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

function octets(v: unknown, taille?: number) {
  if (typeof v !== 'string') throw new ErreurSauvegarde(NON_RECONNU);
  const o = depuisB64(v); // lève une erreur si le texte n'est pas du base64
  if (taille !== undefined && o.length !== taille) throw new ErreurSauvegarde(NON_RECONNU);
  return o;
}
const chiffre = (v: unknown): Chiffre => {
  if (!estObjet(v)) throw new ErreurSauvegarde(NON_RECONNU);
  return { iv: octets(v['iv'], 12), d: octets(v['d']) };
};
const enveloppe = (v: unknown): Enveloppe => {
  if (!estObjet(v)) throw new ErreurSauvegarde(NON_RECONNU);
  return { sel: octets(v['sel'], 16), cle: octets(v['cle'], 40) };
};

/** Lecture stricte du fichier (sans code) : structure, format, version. */
export function lireFichier(contenu: string): Fichier {
  try {
    if (contenu.length > TAILLE_MAX) throw new ErreurSauvegarde(NON_RECONNU);
    const f: unknown = JSON.parse(contenu);
    if (!estObjet(f) || f['format'] !== FORMAT) throw new ErreurSauvegarde(NON_RECONNU);
    if (typeof f['version'] === 'number' && f['version'] > VERSION_FORMAT)
      throw new ErreurSauvegarde('Sauvegarde créée par une version plus récente de BUDGET : mettez l’app à jour. Rien n’a été modifié.');
    const { version, demo, date, coffre, resume, donnees } = f;
    if (version !== VERSION_FORMAT || typeof demo !== 'boolean' || typeof date !== 'string' || !estDateValide(date))
      throw new ErreurSauvegarde(NON_RECONNU);
    if (!estObjet(coffre) || !estObjet(donnees)) throw new ErreurSauvegarde(NON_RECONNU);
    const it = coffre['iterations'];
    if (!Number.isSafeInteger(it) || (it as number) < 1 || (it as number) > 10 * ITERATIONS) throw new ErreurSauvegarde(NON_RECONNU);
    const brut = {} as Brut;
    for (const m of DONNEES) {
      const liste = donnees[m] === undefined && FACULTATIFS.includes(m) ? [] : donnees[m];
      if (!Array.isArray(liste)) throw new ErreurSauvegarde(NON_RECONNU);
      brut[m] = liste.map((r: unknown): Scelle => {
        if (!estObjet(r) || !texte(r[champ(m)], 100)) throw new ErreurSauvegarde(NON_RECONNU);
        return { [champ(m)]: r[champ(m)] as string, ...chiffre(r) };
      });
    }
    return {
      demo,
      date,
      coffre: { cle: 'coffre', version: 1, iterations: it as number, code: enveloppe(coffre['code']), secours: enveloppe(coffre['secours']) },
      donnees: brut,
      resume: chiffre(resume),
    };
  } catch (e) {
    throw e instanceof ErreurSauvegarde ? e : new ErreurSauvegarde(NON_RECONNU);
  }
}

/** Déchiffre et contrôle des données brutes (fichier ou copie interne). Le résumé, s'il est fourni, doit correspondre. */
export async function dechiffrerTout(cle: CryptoKey, brut: Brut, resume?: { date: string; chiffre: Chiffre }): Promise<Donnees> {
  let clair: Clair;
  try {
    const listes = await Promise.all(DONNEES.map((m) => Promise.all((brut[m] ?? []).map((r) => dechiffrer<object>(cle, m, r[champ(m)]!, r)))));
    clair = Object.fromEntries(DONNEES.map((m, i) => [m, listes[i]])) as Clair;
    if (resume) {
      const r = await dechiffrer<Resume>(cle, 'resume', resume.date, resume.chiffre);
      if (DONNEES.some((m) => (r.nb[m] ?? 0) !== clair[m].length)) throw new Error();
    }
  } catch {
    throw new ErreurSauvegarde(INVALIDE);
  }
  return valider(clair);
}

/** Contrôle strict du contenu déchiffré : types, bornes, liens entre comptes, catégories et opérations. */
export function valider(c: Clair): Donnees {
  try {
    const d = c as unknown as Donnees;
    const uniques = (l: { id: string }[]) => new Set(l.map((x) => x.id)).size === l.length;
    const comptes = new Map(d.comptes.map((x) => [x.id, x]));
    const categories = new Set(d.categories.map((x) => x.id));
    const ok =
      uniques(d.comptes) &&
      uniques(d.categories) &&
      uniques(d.operations) &&
      d.comptes.every(
        (x) =>
          texte(x.id, 100) &&
          texte(x.nom, NOM_MAX) &&
          TYPES.includes(x.type) &&
          Number.isSafeInteger(x.soldeDepart) &&
          Math.abs(x.soldeDepart) <= MONTANT_MAX &&
          estDateValide(x.dateDepart) &&
          typeof x.archive === 'boolean' &&
          typeof x.principal === 'boolean',
      ) &&
      d.categories.every(
        (x) => texte(x.id, 100) && texte(x.nom, NOM_MAX) && (x.sens === 'debit' || x.sens === 'credit') && typeof x.archive === 'boolean',
      ) &&
      d.operations.every((x) => {
        const compte = comptes.get(x.compteId);
        return (
          texte(x.id, 100) &&
          compte !== undefined &&
          verifierOperation(x, compte) === null &&
          (x.categorieId === undefined || categories.has(x.categorieId)) &&
          (x.virementId === undefined || texte(x.virementId, 100)) &&
          (x.note === undefined || (typeof x.note === 'string' && x.note.length <= NOTE_MAX))
        );
      }) &&
      d.meta.every((x) => estObjet(x) && texte(x.cle, 100)) &&
      uniques(d.echeances) &&
      d.echeances.every(
        (x) =>
          texte(x.id, 100) &&
          verifierEcheance(x, comptes.get(x.compteId)?.type) === null &&
          (x.categorieId === undefined || categories.has(x.categorieId)) &&
          (x.sens === 'debit' || x.sens === 'credit') &&
          (x.frequence === 'mensuelle' || x.frequence === '28j') &&
          ['aucune', 'nombre', 'date'].includes(x.fin.type) &&
          Number.isSafeInteger(x.prochaine) &&
          x.prochaine >= 0 &&
          typeof x.archive === 'boolean',
      );
    if (ok) return d;
  } catch {
    // contenu de forme inattendue : traité comme invalide ci-dessous
  }
  throw new ErreurSauvegarde(INVALIDE);
}
