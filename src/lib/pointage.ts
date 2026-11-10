// Pointage hebdomadaire : rappel chaque vendredi, écart entre solde bancaire réel et solde de l'app,
// corrigé par une opération de catégorie CORRECTION. Fonctions pures.
import { ajouterJours } from './dates.ts';

export const CORRECTION = 'CORRECTION';

/** Vendredi le plus récent (aujourd'hui compris). */
export function vendrediCourant(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number) as [number, number, number];
  const jourSemaine = new Date(Date.UTC(a, m - 1, j)).getUTCDay(); // 5 = vendredi
  return ajouterJours(jour, -((jourSemaine - 5 + 7) % 7));
}

/** Rappel affiché si aucun pointage depuis le dernier vendredi. */
export const pointageDu = (dernier: string | null, jour: string) => (dernier ?? '') < vendrediCourant(jour);
