import { describe, expect, it } from 'vitest';
import { normaliserPrincipal } from './comptes.ts';
import { genererDemo } from './demo.ts';
import { verifierNom } from './noms.ts';
import { calculerSolde, verifierOperation } from './soldes.ts';

describe('genererDemo', () => {
  const jour = '2026-11-10';
  const d = genererDemo(jour);

  it('4 comptes (un de chaque type au moins), 8 catégories, 20 opérations', () => {
    expect(d.comptes).toHaveLength(4);
    expect(new Set(d.comptes.map((c) => c.type))).toEqual(new Set(['courant', 'epargne', 'tiers']));
    expect(d.categories).toHaveLength(8);
    expect(d.operations).toHaveLength(20);
  });

  it('toutes les données passent les mêmes contrôles qu’une saisie réelle', () => {
    for (const c of [...d.comptes, ...d.categories]) {
      expect(verifierNom(c.nom, c.id, [...d.comptes, ...d.categories].filter((x) => x !== c))).toBeNull();
    }
    for (const op of d.operations) {
      const compte = d.comptes.find((c) => c.id === op.compteId)!;
      expect(verifierOperation(op, compte)).toBeNull();
      expect(d.categories.some((c) => c.id === op.categorieId)).toBe(true);
      expect(op.date <= jour).toBe(true);
    }
    expect(normaliserPrincipal(d.comptes)).toEqual(d.comptes); // un seul principal, déjà correct
  });

  it('identifiants tous différents ; soldes cohérents (tiers : il me doit 25 €)', () => {
    const ids = [...d.comptes, ...d.categories, ...d.operations].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tiers = d.comptes.find((c) => c.type === 'tiers')!;
    expect(calculerSolde(tiers, d.operations, jour)).toBe(-2_500);
    for (const c of d.comptes) expect(Number.isSafeInteger(calculerSolde(c, d.operations, jour))).toBe(true);
  });
});
