// Catégories : ordre alphabétique, sens proposé par défaut, suppression seulement si jamais utilisée. Fonctions pures.
import type { Sens } from './soldes.ts';

export interface Categorie {
  id: string;
  nom: string;
  /** Sens proposé à la saisie ; l'opération peut toujours choisir l'autre. */
  sens: Sens;
  /** Archivée : masquée à la saisie, historique conservé. */
  archive: boolean;
}

export function nouvelleCategorie(): Categorie {
  return { id: crypto.randomUUID(), nom: '', sens: 'debit', archive: false };
}

export function trierCategories<T extends Pick<Categorie, 'nom'>>(categories: readonly T[]): T[] {
  return [...categories].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Vrai si aucune opération n'utilise la catégorie : on peut alors la supprimer, sinon seulement l'archiver. */
export function estInutilisee(id: string, operations: readonly { categorieId?: string }[]): boolean {
  return !operations.some((op) => op.categorieId === id);
}
