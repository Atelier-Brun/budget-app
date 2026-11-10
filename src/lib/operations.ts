// Opérations : préparation et contrôle d'une saisie avant enregistrement. Fonction pure.
// Le sens est toujours celui de l'utilisateur : débit = l'argent sort de chez moi, crédit = il m'arrive.
// Sur un compte tiers (option A : + = je lui dois, − = il me doit), un débit fait donc baisser son solde.
import type { Categorie } from './categories.ts';
import type { Compte } from './comptes.ts';
import { verifierOperation, type Operation, type Sens } from './soldes.ts';

export const NOTE_MAX = 140;

export interface OperationComplete extends Operation {
  id: string;
  note?: string;
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
  if (!s.categorie) return { ok: false, erreur: 'Catégorie obligatoire.' };
  if (s.montant === 0) return { ok: false, erreur: 'Montant obligatoire.' };
  const note = s.note.trim().replace(/\s+/g, ' ');
  if (note.length > NOTE_MAX) return { ok: false, erreur: `Note : ${NOTE_MAX} caractères au plus.` };
  const operation: OperationComplete = {
    id: crypto.randomUUID(),
    compteId: s.compte.id,
    categorieId: s.categorie.id,
    date: s.date,
    sens: s.sens,
    montant: s.montant,
    ...(note ? { note } : {}),
  };
  const erreur = verifierOperation(operation, s.compte); // montant entier, positif, ≤ maximum ; date valide
  return erreur ? { ok: false, erreur } : { ok: true, operation };
}
