// Opérations : préparation et contrôle d'une saisie avant enregistrement. Fonctions pures.
// Règle unique pour tous les comptes, tiers compris : Crédit = le solde monte, Débit = le solde baisse.
// Tiers : + = il a de l'argent chez moi (je lui dois), − = il me doit.
import type { Categorie } from './categories.ts';
import type { Compte } from './comptes.ts';
import { calculerSolde, verifierOperation, type Operation, type Sens } from './soldes.ts';

export const NOTE_MAX = 140;

const nettoyerNote = (note: string) => note.trim().replace(/\s+/g, ' ');

export interface OperationComplete extends Operation {
  id: string;
  note?: string;
  /** Virement : identifiant commun à ses deux écritures (sans catégorie), toujours écrites et supprimées ensemble. */
  virementId?: string;
}

export interface Saisie {
  compte: Compte | undefined;
  categorie: Categorie | undefined;
  /** En centimes, tel que rempli par le pavé numérique. */
  montant: number;
  sens: Sens;
  date: string;
  note: string;
}

export type Preparation = { ok: true; operation: OperationComplete } | { ok: false; erreur: string };

export function preparerOperation(s: Saisie): Preparation {
  if (!s.compte) return { ok: false, erreur: 'Compte obligatoire.' };
  // Tiers : dépôt (Crédit) ou retrait (Débit) avec l'extérieur, catégorie facultative.
  if (!s.categorie && s.compte.type !== 'tiers') return { ok: false, erreur: 'Catégorie obligatoire.' };
  if (s.montant === 0) return { ok: false, erreur: 'Montant obligatoire.' };
  const note = nettoyerNote(s.note);
  if (note.length > NOTE_MAX) return { ok: false, erreur: `Note : ${NOTE_MAX} caractères au plus.` };
  const operation: OperationComplete = {
    id: crypto.randomUUID(),
    compteId: s.compte.id,
    ...(s.categorie ? { categorieId: s.categorie.id } : {}),
    date: s.date,
    sens: s.sens,
    montant: s.montant,
    ...(note ? { note } : {}),
  };
  const erreur = verifierOperation(operation, s.compte); // montant entier, positif, ≤ maximum ; date valide
  return erreur ? { ok: false, erreur } : { ok: true, operation };
}

export interface SaisieVirement {
  depuis: Compte | undefined;
  vers: Compte | undefined;
  montant: number;
  date: string;
  note: string;
}

export type PreparationVirement = { ok: true; operations: [OperationComplete, OperationComplete] } | { ok: false; erreur: string };

export function preparerVirement(s: SaisieVirement): PreparationVirement {
  if (!s.depuis) return { ok: false, erreur: 'Compte de départ obligatoire.' };
  if (!s.vers) return { ok: false, erreur: 'Compte d’arrivée obligatoire.' };
  if (s.depuis.id === s.vers.id) return { ok: false, erreur: 'Choisissez deux comptes différents.' };
  if (s.montant === 0) return { ok: false, erreur: 'Montant obligatoire.' };
  const note = nettoyerNote(s.note);
  if (note.length > NOTE_MAX) return { ok: false, erreur: `Note : ${NOTE_MAX} caractères au plus.` };
  const virementId = crypto.randomUUID();
  const ecriture = (compte: Compte, sensEcriture: Sens): OperationComplete => ({
    id: crypto.randomUUID(),
    compteId: compte.id,
    date: s.date,
    sens: sensEcriture,
    montant: s.montant,
    virementId,
    ...(note ? { note } : {}),
  });
  // Sans aucun cas particulier : départ Débit, arrivée Crédit (tiers compris).
  const operations: [OperationComplete, OperationComplete] = [ecriture(s.depuis, 'debit'), ecriture(s.vers, 'credit')];
  // Les deux comptes : date après leur départ, montant entier, positif, ≤ maximum.
  const erreur = verifierOperation(operations[0], s.depuis) ?? verifierOperation(operations[1], s.vers);
  return erreur ? { ok: false, erreur } : { ok: true, operations };
}

/**
 * Aperçu avant validation : solde du compte avant et après la saisie, au plus tard de (aujourd'hui, date saisie).
 * En modification, les écritures remplacées sont retirées du calcul « après ».
 */
export function apercuSolde(
  compte: Compte,
  operations: readonly OperationComplete[],
  remplacees: readonly OperationComplete[],
  ajouts: readonly Operation[],
  jour: string,
): { avant: number; apres: number } {
  const jusquA = ajouts.reduce((max, o) => (o.date > max ? o.date : max), jour);
  const restantes = operations.filter((o) => !remplacees.some((r) => r.id === o.id));
  return { avant: calculerSolde(compte, operations, jusquA), apres: calculerSolde(compte, [...restantes, ...ajouts], jusquA) };
}
