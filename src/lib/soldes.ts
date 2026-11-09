// Soldes : calculés à partir des opérations, jamais stockés. Modifier le solde ou la date de départ
// d'un compte ne touche donc à aucune opération : le solde est simplement recalculé.
import { estDateValide, formaterDate } from './dates.ts';
import { MONTANT_MAX } from './montants.ts';

export type Sens = 'debit' | 'credit';

export interface Compte {
  id: string;
  /** Solde au début de dateDepart, avant les opérations de ce jour-là (centimes, peut être négatif). */
  soldeDepart: number;
  dateDepart: string;
}

export interface Operation {
  compteId: string;
  date: string;
  sens: Sens;
  /** Toujours positif, en centimes ; le sens dit s'il s'ajoute ou se retire. */
  montant: number;
}

/** Solde d'un compte à la fin du jour `jusquA` (opérations futures exclues). */
export function calculerSolde(compte: Compte, operations: readonly Operation[], jusquA: string): number {
  let solde = compte.soldeDepart;
  for (const op of operations) {
    if (op.compteId !== compte.id || op.date < compte.dateDepart || op.date > jusquA) continue;
    solde += op.sens === 'credit' ? op.montant : -op.montant;
  }
  return solde;
}

/** Contrôle une opération avant enregistrement. Renvoie un message clair, ou null si tout va bien. */
export function verifierOperation(op: Operation, compte: Compte): string | null {
  if (!estDateValide(op.date)) return 'Date invalide.';
  if (!Number.isSafeInteger(op.montant) || op.montant <= 0 || op.montant > MONTANT_MAX) return 'Montant invalide.';
  if (op.sens !== 'debit' && op.sens !== 'credit') return 'Choisis débit ou crédit.';
  if (op.date < compte.dateDepart)
    return `Date antérieure au départ du compte (${formaterDate(compte.dateDepart)}) : choisis une date à partir de ce jour.`;
  return null;
}

/** Contrôle un nouveau départ (solde, date) d'un compte : aucune opération existante ne doit en sortir. */
export function verifierDepart(compteId: string, soldeDepart: number, dateDepart: string, operations: readonly Operation[]): string | null {
  if (!estDateValide(dateDepart)) return 'Date de départ invalide.';
  if (!Number.isSafeInteger(soldeDepart) || Math.abs(soldeDepart) > MONTANT_MAX) return 'Solde de départ invalide.';
  const avant = operations.filter((op) => op.compteId === compteId && op.date < dateDepart);
  if (avant.length === 0) return null;
  const premiere = avant.reduce((min, op) => (op.date < min ? op.date : min), dateDepart);
  return `${avant.length} opération(s) datée(s) avant le ${formaterDate(dateDepart)} : choisis une date de départ au plus tard le ${formaterDate(premiere)}.`;
}
