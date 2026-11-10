// Carnet d'archives : mois affiché, filtres, tri, écritures liées. Fonctions pures.
import type { OperationComplete } from './operations.ts';

/** Filtre « catégorie » spécial : seulement les virements. */
export const VIREMENTS = 'virements';

export interface Filtre {
  /** AAAA-MM */
  mois: string;
  /** '' = tous les comptes */
  compteId: string;
  /** '' = toutes ; VIREMENTS = seulement les virements ; sinon l'identifiant d'une catégorie */
  categorieId: string;
}

/** Mois AAAA-MM décalé de n mois (n négatif : vers le passé). */
export function ajouterMois(mois: string, n: number): string {
  const total = Number(mois.slice(0, 4)) * 12 + Number(mois.slice(5, 7)) - 1 + n;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** « novembre 2026 » (calcul en UTC : indépendant du fuseau horaire). */
export const formaterMois = (mois: string) => MOIS.format(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)) - 1, 1));

/** Opérations du filtre, la plus récente en premier (à date égale : ordre stable par identifiant). */
export function filtrerCarnet(operations: readonly OperationComplete[], f: Filtre): OperationComplete[] {
  return operations
    .filter(
      (op) =>
        op.date.startsWith(f.mois + '-') &&
        (!f.compteId || op.compteId === f.compteId) &&
        (!f.categorieId || (f.categorieId === VIREMENTS ? !!op.virementId : op.categorieId === f.categorieId)),
    )
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? 1 : -1));
}

/** L'opération et, pour un virement, son autre écriture : on les modifie et supprime toujours ensemble. */
export function ecrituresLiees(op: OperationComplete, operations: readonly OperationComplete[]): OperationComplete[] {
  return op.virementId ? operations.filter((o) => o.virementId === op.virementId) : [op];
}

/** Comptes de départ (écriture Débit) et d'arrivée (écriture Crédit) d'un virement ; null si incohérent. */
export function retrouverVirement(ecritures: readonly OperationComplete[]): { depuisId: string; versId: string } | null {
  const depuis = ecritures.filter((o) => o.sens === 'debit');
  const vers = ecritures.filter((o) => o.sens === 'credit');
  return ecritures.length === 2 && depuis.length === 1 && vers.length === 1 ? { depuisId: depuis[0]!.compteId, versId: vers[0]!.compteId } : null;
}
