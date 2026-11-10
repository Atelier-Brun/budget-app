// Données FICTIVES de la version démo uniquement (jamais dans la base réelle) : 4 comptes, 8 catégories,
// 20 opérations et 3 virements sur les 30 derniers jours. Noms génériques ; montants inventés.
import type { Categorie } from './categories.ts';
import type { Compte, TypeCompte } from './comptes.ts';
import { ajouterJours } from './dates.ts';
import type { Echeance } from './echeances.ts';
import type { OperationComplete } from './operations.ts';
import type { Sens } from './soldes.ts';

export interface DonneesDemo {
  comptes: Compte[];
  categories: Categorie[];
  operations: OperationComplete[];
  echeances: Echeance[];
}

const COMPTES: [string, TypeCompte, number][] = [
  ['COMPTE COURANT', 'courant', 125_000],
  ['COMPTE SECONDAIRE', 'courant', 18_000],
  ['LIVRET ÉPARGNE', 'epargne', 300_000],
  ['AMI EXEMPLE', 'tiers', 0],
];

const CATEGORIES: [string, Sens][] = [
  ['ÉPICERIE', 'debit'],
  ['HABITAT', 'debit'],
  ['TRANSPORT', 'debit'],
  ['LOISIRS', 'debit'],
  ['PHARMACIE', 'debit'],
  ['AUTRES', 'debit'],
  ['REVENU', 'credit'],
  ['CADEAU', 'credit'],
];

// [jours avant aujourd'hui, compte, catégorie (−1 : aucune), sens, centimes, note]
const OPERATIONS: [number, number, number, Sens, number, string?][] = [
  [29, 0, 6, 'credit', 185_000],
  [28, 0, 1, 'debit', 72_000],
  [27, 0, 0, 'debit', 6_430, 'Courses de la semaine'],
  [25, 0, 2, 'debit', 4_500],
  [24, 1, 0, 'debit', 2_315],
  [22, 0, 3, 'debit', 3_990],
  [21, 0, 4, 'debit', 2_500],
  [20, 2, 5, 'credit', 10_000, 'Versement mensuel'],
  [18, 0, 0, 'debit', 8_812],
  [17, 3, -1, 'debit', 4_000, 'Retrait (exemple)'],
  [15, 0, 2, 'debit', 6_000],
  [14, 1, 3, 'debit', 1_850],
  [12, 0, 0, 'debit', 5_267],
  [10, 0, 7, 'credit', 3_200],
  [9, 3, -1, 'credit', 1_500, 'Dépôt (exemple)'],
  [7, 0, 5, 'debit', 1_299],
  [5, 0, 0, 'debit', 7_145],
  [3, 1, 2, 'debit', 2_000],
  [2, 0, 3, 'debit', 2_490],
  [0, 0, 0, 'debit', 1_860],
];

// [jours avant aujourd'hui, compte de départ, compte d'arrivée, centimes, note]
const VIREMENTS: [number, number, number, number, string?][] = [
  [19, 0, 2, 20_000, 'Épargne du mois'],
  [6, 0, 1, 6_000],
  [4, 0, 3, 1_000],
];

export function genererDemo(jour: string): DonneesDemo {
  const depart = ajouterJours(jour, -30);
  const comptes: Compte[] = COMPTES.map(([nom, type, soldeDepart], i) => ({
    id: crypto.randomUUID(),
    nom,
    type,
    soldeDepart,
    dateDepart: depart,
    archive: false,
    principal: i === 0,
  }));
  const categories: Categorie[] = CATEGORIES.map(([nom, sens]) => ({ id: crypto.randomUUID(), nom, sens, archive: false }));
  const operations: OperationComplete[] = OPERATIONS.map(([avant, c, cat, sens, montant, note]) => ({
    id: crypto.randomUUID(),
    compteId: comptes[c]!.id,
    ...(cat >= 0 ? { categorieId: categories[cat]!.id } : {}), // −1 : dépôt/retrait sur un tiers, sans catégorie
    date: ajouterJours(jour, -avant),
    sens,
    montant,
    ...(note ? { note } : {}),
  }));
  for (const [avant, de, vers, montant, note] of VIREMENTS) {
    const virementId = crypto.randomUUID();
    for (const [i, c] of [de, vers].entries()) {
      operations.push({ id: crypto.randomUUID(), compteId: comptes[c]!.id, date: ajouterJours(jour, -avant), sens: i === 0 ? 'debit' : 'credit', montant, virementId, ...(note ? { note } : {}) });
    }
  }
  // Échéancier : une échéance due aujourd'hui (à valider), une dans 5 jours (prévisionnel seulement).
  const echeance = (nom: string, cat: number, montant: number, avant: number): Echeance => ({
    id: crypto.randomUUID(),
    nom,
    compteId: comptes[0]!.id,
    categorieId: categories[cat]!.id,
    sens: 'debit',
    montant,
    frequence: 'mensuelle',
    debut: ajouterJours(jour, avant),
    fin: { type: 'aucune' },
    prochaine: 0,
    archive: false,
  });
  const echeances = [echeance('LOYER EXEMPLE', 1, 65_000, 0), echeance('ABONNEMENT EXEMPLE', 2, 7_500, 5)];
  return { comptes, categories, operations, echeances };
}
