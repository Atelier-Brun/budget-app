// Dates au format texte AAAA-MM-JJ : comparables directement (ordre alphabétique = ordre chronologique),
// sans objet Date stocké, donc sans effet du fuseau horaire ni de l'heure d'été.

const FORME = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Nombre de jours d'un mois (mois de 1 à 12), années bissextiles comprises. */
export function joursDansMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/** Vrai si la date est au format AAAA-MM-JJ et existe dans le calendrier. */
export function estDateValide(date: string): boolean {
  const m = FORME.exec(date);
  if (!m) return false;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return annee >= 2000 && mois >= 1 && mois <= 12 && jour >= 1 && jour <= joursDansMois(annee, mois);
}

/** Date du jour selon l'horloge locale de l'iPhone. */
export function aujourdHui(maintenant = new Date()): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
}

/** « 2026-11-09 » → « 09/11/2026 », pour les messages. */
export function formaterDate(date: string): string {
  return date.split('-').reverse().join('/');
}
