// Noms de comptes et de catégories : MAJUSCULES, 30 caractères au plus, sans doublon (accents et casse ignorés).

export const NOM_MAX = 30;

/** « livret  été » → « LIVRET ÉTÉ » (espaces superflus retirés, accents gardés). */
export function normaliserNom(saisie: string): string {
  return saisie.trim().replace(/\s+/g, ' ').toLocaleUpperCase('fr-FR');
}

const cle = (nom: string) => normaliserNom(nom).normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Message clair, ou null si le nom est acceptable. `id` : l'élément modifié (ignoré dans la recherche de doublon). */
export function verifierNom(saisie: string, id: string, existants: readonly { id: string; nom: string }[]): string | null {
  const nom = normaliserNom(saisie);
  if (!nom) return 'Nom obligatoire.';
  if (nom.length > NOM_MAX) return `${NOM_MAX} caractères au plus.`;
  if (existants.some((e) => e.id !== id && cle(e.nom) === cle(nom))) return 'Ce nom existe déjà.';
  return null;
}
