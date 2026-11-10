// Montants en centimes entiers : jamais de nombre à virgule en stockage ni en calcul.

/** Plus grand montant accepté : 9 999 999,99 €. */
export const MONTANT_MAX = 999_999_999;

export type Lecture = { ok: true; centimes: number } | { ok: false; erreur: string };

// Espaces acceptés comme séparateur de milliers : normale, insécable, fine insécable (iOS).
const ESPACES = /[   ]/g;
const FORME = /^(\d{1,3}(?: \d{3})+|\d+)(?:[.,](\d{1,2}))?$/;

/** Lit une saisie (« 12 », « 12,5 », « 1 234,56 », « 12.50 ») en centimes. Texte, jamais parseFloat. */
export function lireMontant(saisie: string): Lecture {
  const texte = saisie.trim().replace(ESPACES, ' ');
  const m = texte.length <= 20 ? FORME.exec(texte) : null;
  if (!m) return { ok: false, erreur: 'Montant invalide : chiffres uniquement, 2 décimales au plus (ex. 12,50).' };
  const entier = m[1]!.replace(/ /g, '');
  // Au plus 7 chiffres significatifs avant la virgule : c'est exactement la limite MONTANT_MAX.
  if (entier.replace(/^0+/, '').length > 7) return { ok: false, erreur: 'Montant trop élevé (maximum 9 999 999,99 €).' };
  const centimes = Number(entier) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  if (centimes === 0) return { ok: false, erreur: 'Le montant doit être supérieur à 0.' };
  return { ok: true, centimes };
}

/**
 * Pavé numérique de la saisie : chaque chiffre s'ajoute à droite, en centimes (2-3-4-0 → 2 340 = 23,40 €).
 * « effacer » retire le dernier chiffre. Une touche qui dépasserait le maximum est ignorée.
 */
export function taper(centimes: number, touche: string): number {
  if (touche === 'effacer') return Math.floor(centimes / 10);
  if (!/^[0-9]$/.test(touche)) return centimes;
  const suivant = centimes * 10 + Number(touche);
  return suivant > MONTANT_MAX ? centimes : suivant;
}

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/**
 * Affiche des centimes : « 1 234,56 € ». Négatif : « −1 234,56 € » (vrai signe moins).
 * avecPlus (opérations) : « +1 234,56 € » pour un crédit ; un débit est passé en négatif.
 */
export function formaterMontant(centimes: number, avecPlus = false): string {
  if (!Number.isSafeInteger(centimes)) throw new RangeError('Montant non entier');
  const signe = centimes < 0 ? '−' : centimes > 0 && avecPlus ? '+' : '';
  return signe + EUROS.format(Math.abs(centimes) / 100);
}
