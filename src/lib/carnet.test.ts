// Données FICTIVES uniquement.
import { describe, expect, it } from 'vitest';
import { ajouterMois, ecrituresLiees, filtrerCarnet, formaterMois, retrouverVirement, VIREMENTS } from './carnet.ts';
import type { OperationComplete } from './operations.ts';

const op = (id: string, date: string, compteId: string, extra: Partial<OperationComplete> = {}): OperationComplete => ({
  id,
  date,
  compteId,
  sens: 'debit',
  montant: 100,
  ...(extra.virementId ? {} : { categorieId: 'k1' }), // un virement n'a pas de catégorie
  ...extra,
});
const ops = [
  op('a', '2026-11-03', 'c1'),
  op('b', '2026-11-10', 'c2', { categorieId: 'k2' }),
  op('v1', '2026-11-05', 'c1', { virementId: 'v' }),
  op('v2', '2026-11-05', 'c2', { virementId: 'v', sens: 'credit' }),
  op('c', '2026-10-31', 'c1'),
  op('d', '2026-12-01', 'c1'),
];

describe('mois', () => {
  it('décalage, y compris changement d’année', () => {
    expect(ajouterMois('2026-11', 1)).toBe('2026-12');
    expect(ajouterMois('2026-12', 1)).toBe('2027-01');
    expect(ajouterMois('2026-01', -1)).toBe('2025-12');
    expect(ajouterMois('2026-11', -23)).toBe('2024-12');
  });
  it('nom du mois en français', () => {
    expect(formaterMois('2026-11')).toBe('novembre 2026');
    expect(formaterMois('2027-01')).toBe('janvier 2027');
  });
});

describe('filtrerCarnet', () => {
  const ids = (f: Partial<Parameters<typeof filtrerCarnet>[1]>) =>
    filtrerCarnet(ops, { mois: '2026-11', compteId: '', categorieId: '', ...f }).map((o) => o.id);

  it('seulement le mois choisi, la plus récente en premier', () => {
    expect(ids({})).toEqual(['b', 'v1', 'v2', 'a']);
    expect(ids({ mois: '2026-10' })).toEqual(['c']);
    expect(ids({ mois: '2025-11' })).toEqual([]);
  });
  it('par compte, par catégorie, virements seuls, filtres combinés', () => {
    expect(ids({ compteId: 'c1' })).toEqual(['v1', 'a']);
    expect(ids({ categorieId: 'k2' })).toEqual(['b']);
    expect(ids({ categorieId: VIREMENTS })).toEqual(['v1', 'v2']);
    expect(ids({ categorieId: VIREMENTS, compteId: 'c2' })).toEqual(['v2']);
  });
});

describe('ecrituresLiees', () => {
  it('opération seule ; virement : ses deux écritures', () => {
    expect(ecrituresLiees(ops[0]!, ops).map((o) => o.id)).toEqual(['a']);
    expect(ecrituresLiees(ops[3]!, ops).map((o) => o.id)).toEqual(['v1', 'v2']);
  });
});

describe('retrouverVirement', () => {
  const v = (x: [string, 'debit' | 'credit'], y: [string, 'debit' | 'credit']) => [
    op('x', '2026-11-05', x[0], { sens: x[1], virementId: 'v' }),
    op('y', '2026-11-05', y[0], { sens: y[1], virementId: 'v' }),
  ];
  it('départ = écriture Débit, arrivée = écriture Crédit, quel que soit l’ordre', () => {
    expect(retrouverVirement(v(['e1', 'credit'], ['c1', 'debit']))).toEqual({ depuisId: 'c1', versId: 'e1' });
    expect(retrouverVirement(v(['t1', 'debit'], ['t2', 'credit']))).toEqual({ depuisId: 't1', versId: 't2' });
  });
  it('incohérent ou incomplet : null (jamais deviné)', () => {
    expect(retrouverVirement(v(['c1', 'credit'], ['e1', 'credit']))).toBeNull();
    expect(retrouverVirement(v(['c1', 'debit'], ['e1', 'credit']).slice(0, 1))).toBeNull();
  });
});
