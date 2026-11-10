// Comptes : types, tri, compte principal, solde de départ. Fonctions pures.
import { aujourdHui } from './dates.ts';
import { lireMontant, type Lecture } from './montants.ts';
import type { Compte as CompteSolde } from './soldes.ts';

export type TypeCompte = 'courant' | 'epargne' | 'tiers';

/** Ordre d'affichage des sections. */
export const TYPES: readonly TypeCompte[] = ['courant', 'epargne', 'tiers'];
export const LIBELLES: Record<TypeCompte, { un: string; section: string }> = {
  courant: { un: 'Courant', section: 'Courants' },
  epargne: { un: 'Épargne', section: 'Épargne' },
  tiers: { un: 'Tiers', section: 'Tiers' },
};

export interface Compte extends CompteSolde {
  nom: string;
  type: TypeCompte;
  /** Archivé : masqué partout, historique conservé. */
  archive: boolean;
  principal: boolean;
}

export function nouveauCompte(): Compte {
  return {
    id: crypto.randomUUID(),
    nom: '',
    type: 'courant',
    soldeDepart: 0,
    dateDepart: aujourdHui(),
    archive: false,
    principal: false,
  };
}

/** Par type (Courants, Épargne, Tiers), puis par ordre alphabétique français. */
export function trierComptes<T extends Pick<Compte, 'type' | 'nom'>>(comptes: readonly T[]): T[] {
  return [...comptes].sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.nom.localeCompare(b.nom, 'fr'));
}

/**
 * Garantit exactement un compte principal parmi les comptes courants actifs (aucun s'il n'y en a pas).
 * Priorité : `prefere`, puis le principal actuel, puis le premier par ordre alphabétique.
 */
export function normaliserPrincipal(comptes: readonly Compte[], prefere?: string): Compte[] {
  const valides = comptes.filter((c) => c.type === 'courant' && !c.archive);
  const choisi = valides.find((c) => c.id === prefere) ?? valides.find((c) => c.principal) ?? trierComptes(valides)[0];
  return comptes.map((c) => ({ ...c, principal: c.id === choisi?.id }));
}

/** Solde de départ : vide ou zéro acceptés (0), sinon montant strict ; `negatif` applique le signe −. */
export function lireSoldeDepart(saisie: string, negatif: boolean): Lecture {
  if (/^0*(?:[.,]0{1,2})?$/.test(saisie.trim())) return { ok: true, centimes: 0 };
  const lecture = lireMontant(saisie);
  return lecture.ok && negatif ? { ok: true, centimes: -lecture.centimes } : lecture;
}
