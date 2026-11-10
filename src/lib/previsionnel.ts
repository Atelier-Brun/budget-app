// Prévisionnel : solde attendu en fin de mois et solde le plus bas du mois, par compte. Fonction pure.
// Compte : solde du jour + opérations déjà saisies à une date future du mois + échéances non validées
// (en retard comptées aujourd'hui). Alerte : courant ou épargne qui passe sous zéro un jour du mois.
import type { Compte } from './comptes.ts';
import { joursDansMois } from './dates.ts';
import { occurrencesJusqua, type Echeance } from './echeances.ts';
import { calculerSolde, type Operation } from './soldes.ts';

export interface Prevision {
  fin: number;
  min: number;
  dateMin: string;
  alerte: boolean;
}

export function finDeMois(jour: string): string {
  const [a, m] = jour.split('-').map(Number) as [number, number];
  return `${jour.slice(0, 8)}${String(joursDansMois(a, m)).padStart(2, '0')}`;
}

export function prevoir(comptes: readonly Compte[], operations: readonly Operation[], echeances: readonly Echeance[], jour: string): Map<string, Prevision> {
  const fin = finDeMois(jour);
  const resultat = new Map<string, Prevision>();
  for (const c of comptes) {
    if (c.archive) continue;
    const evenements: { date: string; delta: number }[] = [];
    for (const op of operations)
      if (op.compteId === c.id && op.date > jour && op.date <= fin && op.date >= c.dateDepart)
        evenements.push({ date: op.date, delta: op.sens === 'credit' ? op.montant : -op.montant });
    for (const e of echeances)
      if (e.compteId === c.id)
        for (const o of occurrencesJusqua(e, fin))
          evenements.push({ date: o.date < jour ? jour : o.date, delta: e.sens === 'credit' ? o.montant : -o.montant });
    // Le même jour, débits avant crédits : estimation prudente du point bas.
    evenements.sort((x, y) => (x.date === y.date ? x.delta - y.delta : x.date < y.date ? -1 : 1));
    let solde = calculerSolde(c, operations, jour);
    let min = solde;
    let dateMin = jour;
    for (const ev of evenements) {
      solde += ev.delta;
      if (solde < min) [min, dateMin] = [solde, ev.date];
    }
    resultat.set(c.id, { fin: solde, min, dateMin, alerte: c.type !== 'tiers' && min < 0 });
  }
  return resultat;
}
