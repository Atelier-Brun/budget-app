// Échéancier : prélèvements et mensualités récurrents. Fonctions pures.
// Une échéance n'entre dans le carnet (et le solde) qu'une fois VALIDÉE, une seule fois : l'opération créée
// porte un identifiant fixe (échéance + date prévue), qu'une seconde validation ne peut pas réécrire.
// Avant validation, elle ne compte que dans le prévisionnel.
import { ajouterJours, estDateValide, joursDansMois } from './dates.ts';
import { MONTANT_MAX } from './montants.ts';
import { NOM_MAX } from './noms.ts';
import type { Sens } from './soldes.ts';

export type Frequence = 'mensuelle' | '28j';
export type Fin = { type: 'aucune' } | { type: 'nombre'; nombre: number } | { type: 'date'; date: string };

export interface Echeance {
  id: string;
  /** Libellé en MAJUSCULES (ex. LOYER), 30 caractères au plus. */
  nom: string;
  compteId: string;
  /** Facultative sur un compte tiers seulement (même règle qu'une opération). */
  categorieId?: string;
  sens: Sens;
  /** Centimes, > 0. */
  montant: number;
  /** « mensuelle » : même jour chaque mois (jour > fin de mois → dernier jour) ; « 28j » : toutes les 4 semaines. */
  frequence: Frequence;
  /** Date de l'échéance n° 0. Le jour du mois des échéances mensuelles est celui de cette date. */
  debut: string;
  fin: Fin;
  /** Montant différent pour la dernière échéance (fin « nombre » ou « date » seulement). */
  dernierMontant?: number;
  /** Numéro de la prochaine échéance à valider ou ignorer (les précédentes sont traitées, dans l'ordre). */
  prochaine: number;
  /** Arrêtée : plus jamais proposée ; historique (opérations validées) conservé. */
  archive: boolean;
}

export interface Occurrence {
  n: number;
  date: string;
  montant: number;
}

/** Date prévue de l'échéance n° n. */
export function dateOccurrence(e: Pick<Echeance, 'frequence' | 'debut'>, n: number): string {
  if (e.frequence === '28j') return ajouterJours(e.debut, 28 * n);
  const [a, m, j] = e.debut.split('-').map(Number) as [number, number, number];
  const mois = m - 1 + n;
  const annee = a + Math.floor(mois / 12);
  const m2 = (mois % 12) + 1;
  const jour = Math.min(j, joursDansMois(annee, m2));
  return `${annee}-${String(m2).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

/** L'échéance n° n existe-t-elle (avant la fin) ? */
export function existe(e: Pick<Echeance, 'frequence' | 'debut' | 'fin'>, n: number): boolean {
  if (e.fin.type === 'nombre') return n < e.fin.nombre;
  if (e.fin.type === 'date') return dateOccurrence(e, n) <= e.fin.date;
  return true;
}

export function occurrence(e: Echeance, n: number): Occurrence | null {
  if (n < 0 || !existe(e, n)) return null;
  const derniere = e.fin.type !== 'aucune' && !existe(e, n + 1);
  return { n, date: dateOccurrence(e, n), montant: derniere && e.dernierMontant ? e.dernierMontant : e.montant };
}

/** Échéances non traitées dont la date prévue est au plus tard `jusqua` (retards compris), dans l'ordre. */
export function occurrencesJusqua(e: Echeance, jusqua: string, max = 400): Occurrence[] {
  const liste: Occurrence[] = [];
  if (e.archive) return liste;
  for (let n = e.prochaine; liste.length < max; n++) {
    const o = occurrence(e, n);
    if (!o || o.date > jusqua) break;
    liste.push(o);
  }
  return liste;
}

/** Prochaine échéance à traiter si elle est due (date ≤ jour), sinon null. */
export const aValider = (e: Echeance, jour: string): Occurrence | null => occurrencesJusqua(e, jour, 1)[0] ?? null;

/** Prochaine échéance à venir (due ou non), ou null si terminée / arrêtée. */
export const prochaine = (e: Echeance): Occurrence | null => (e.archive ? null : occurrence(e, e.prochaine));

/** Identifiant fixe de l'opération créée à la validation : une seconde validation est refusée par la base. */
export const idOperation = (e: Pick<Echeance, 'id'>, o: Pick<Occurrence, 'date'>) => `ech-${e.id}-${o.date}`;

/**
 * Modification du calendrier d'une échéance déjà entamée : la « prochaine » devient la nouvelle échéance n° 0,
 * le nombre restant est conservé. Les opérations déjà validées ne changent jamais.
 */
export function rebaser(e: Echeance, nouveauDebut: string): Echeance {
  if (e.prochaine === 0) return { ...e, debut: nouveauDebut };
  const fin: Fin = e.fin.type === 'nombre' ? { type: 'nombre', nombre: Math.max(1, e.fin.nombre - e.prochaine) } : e.fin;
  return { ...e, debut: nouveauDebut, fin, prochaine: 0 };
}

/** Contrôle d'une échéance avant enregistrement. Message clair, ou null. */
export function verifierEcheance(e: Echeance, typeCompte: string | undefined): string | null {
  if (!e.nom) return 'Libellé obligatoire.';
  if (e.nom.length > NOM_MAX) return `Libellé : ${NOM_MAX} caractères au plus.`;
  if (!typeCompte) return 'Compte obligatoire.';
  if (!e.categorieId && typeCompte !== 'tiers') return 'Catégorie obligatoire.';
  if (!Number.isSafeInteger(e.montant) || e.montant <= 0 || e.montant > MONTANT_MAX) return 'Montant invalide.';
  if (!estDateValide(e.debut)) return 'Date de la prochaine échéance invalide.';
  if (e.fin.type === 'nombre' && (!Number.isSafeInteger(e.fin.nombre) || e.fin.nombre < 1 || e.fin.nombre > 1200))
    return 'Nombre d’échéances invalide (1 à 1 200).';
  if (e.fin.type === 'date' && (!estDateValide(e.fin.date) || e.fin.date < e.debut)) return 'Date de fin invalide : au plus tôt la date de la prochaine échéance.';
  if (e.dernierMontant !== undefined) {
    if (e.fin.type === 'aucune') return 'Dernière échéance différente : une fin (nombre ou date) est nécessaire.';
    if (!Number.isSafeInteger(e.dernierMontant) || e.dernierMontant <= 0 || e.dernierMontant > MONTANT_MAX) return 'Montant de la dernière échéance invalide.';
  }
  return null;
}
