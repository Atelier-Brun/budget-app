// Données FICTIVES uniquement.
import { describe, expect, it } from 'vitest';
import type { Categorie } from './categories.ts';
import type { Compte } from './comptes.ts';
import { calculerSolde } from './soldes.ts';
import { preparerOperation, type Saisie } from './operations.ts';

const compte: Compte = { id: 'c1', nom: 'COMPTE FICTIF', type: 'courant', soldeDepart: 10_000, dateDepart: '2026-11-01', archive: false, principal: true };
const tiers: Compte = { ...compte, id: 't1', nom: 'AMI FICTIF', type: 'tiers', soldeDepart: 0, principal: false };
const categorie: Categorie = { id: 'k1', nom: 'CATÉGORIE FICTIVE', sens: 'debit', archive: false };
const saisie = (s: Partial<Saisie> = {}): Saisie => ({ compte, categorie, montant: 1250, sens: 'debit', date: '2026-11-10', note: '', ...s });

describe('preparerOperation', () => {
  it('opération complète, montant en centimes, sans note vide', () => {
    const r = preparerOperation(saisie());
    expect(r.ok && r.operation).toMatchObject({ compteId: 'c1', categorieId: 'k1', date: '2026-11-10', sens: 'debit', montant: 1250 });
    expect(r.ok && 'note' in r.operation).toBe(false);
  });
  it('note nettoyée ; refus au-delà de 140 caractères', () => {
    const r = preparerOperation(saisie({ note: '  café   du   matin ' }));
    expect(r.ok && r.operation.note).toBe('café du matin');
    expect(preparerOperation(saisie({ note: 'x'.repeat(141) }))).toEqual({ ok: false, erreur: 'Note : 140 caractères au plus.' });
  });
  it('refus clairs : compte, catégorie, montant nul ou invalide, date avant le départ', () => {
    expect(preparerOperation(saisie({ compte: undefined }))).toEqual({ ok: false, erreur: 'Compte obligatoire.' });
    expect(preparerOperation(saisie({ categorie: undefined }))).toEqual({ ok: false, erreur: 'Catégorie obligatoire.' });
    expect(preparerOperation(saisie({ montant: 0 }))).toEqual({ ok: false, erreur: 'Montant obligatoire.' });
    expect(preparerOperation(saisie({ montant: 12.5 }))).toEqual({ ok: false, erreur: 'Montant invalide.' });
    expect(preparerOperation(saisie({ montant: 1_000_000_000 }))).toEqual({ ok: false, erreur: 'Montant invalide.' });
    expect(preparerOperation(saisie({ date: '2026-10-31' }))).toMatchObject({ ok: false, erreur: expect.stringContaining('antérieure') });
  });
  it('identifiants uniques', () => {
    const a = preparerOperation(saisie());
    const b = preparerOperation(saisie());
    expect(a.ok && b.ok && a.operation.id !== b.operation.id).toBe(true);
  });
});

describe('compte tiers (option A : + = je lui dois, − = il me doit)', () => {
  it('débit de 40 → −40 (il me doit) ; crédit de 15 → −25', () => {
    const debit = preparerOperation(saisie({ compte: tiers, montant: 4000, sens: 'debit' }));
    const credit = preparerOperation(saisie({ compte: tiers, montant: 1500, sens: 'credit' }));
    if (!debit.ok || !credit.ok) throw new Error('refusé');
    expect(calculerSolde(tiers, [debit.operation], '2026-11-30')).toBe(-4_000);
    expect(calculerSolde(tiers, [debit.operation, credit.operation], '2026-11-30')).toBe(-2_500);
  });
});
