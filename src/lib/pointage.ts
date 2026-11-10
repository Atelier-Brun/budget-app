// Pointage hebdomadaire : rappel du vendredi au dimanche, écart entre solde bancaire réel et solde de l'app,
// corrigé par une opération de catégorie CORRECTION. Fonctions pures.
import { ajouterJours } from './dates.ts';

export const CORRECTION = 'CORRECTION';

/** Rappel du vendredi au dimanche, si aucun pointage depuis le lundi de la semaine (semaine du lundi au dimanche). */
export function pointageDu(dernier: string | null, jour: string): boolean {
  const [a, m, j] = jour.split('-').map(Number) as [number, number, number];
  const jourSemaine = new Date(Date.UTC(a, m - 1, j)).getUTCDay(); // 0 = dimanche, 5 = vendredi
  if (jourSemaine >= 1 && jourSemaine <= 4) return false;
  return (dernier ?? '') < ajouterJours(jour, -((jourSemaine + 6) % 7));
}
