// Données FICTIVES uniquement.
import { describe, expect, it } from 'vitest';
import type { Categorie } from './categories.ts';
import type { Compte } from './comptes.ts';
import { calculerSolde, type Operation } from './soldes.ts';
import { apercuSolde, preparerOperation, preparerVirement, type OperationComplete, type Saisie, type SaisieVirement } from './operations.ts';

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

describe('règle unique (tiers compris) et virements', () => {
  const epargne: Compte = { ...compte, id: 'e1', nom: 'LIVRET FICTIF', type: 'epargne', soldeDepart: 50_000, principal: false };
  const tiers2: Compte = { ...tiers, id: 't2', nom: 'AUTRE FICTIF' };
  const virement = (s: Partial<SaisieVirement> = {}): SaisieVirement => ({ depuis: compte, vers: epargne, montant: 10_000, date: '2026-11-10', note: '', ...s });
  /** Variation de solde de chaque compte. */
  const effet = (ops: Operation[], ...comptes: Compte[]) => comptes.map((c) => calculerSolde(c, ops, '2026-11-30') - c.soldeDepart);
  const ecritures = (r: ReturnType<typeof preparerVirement>) => {
    if (!r.ok) throw new Error(r.erreur);
    return r.operations;
  };

  it('courant → épargne : −100 / +100, deux écritures liées (Débit, Crédit), sans catégorie, même note', () => {
    const [a, b] = ecritures(preparerVirement(virement({ note: '  mise   de côté ' })));
    expect(effet([a, b], compte, epargne)).toEqual([-10_000, 10_000]);
    expect([a.sens, b.sens]).toEqual(['debit', 'credit']);
    expect(b.virementId).toBe(a.virementId);
    expect(a.virementId).toBeTruthy();
    expect(a.id).not.toBe(b.id);
    expect('categorieId' in a || 'categorieId' in b).toBe(false);
    expect([a.note, b.note]).toEqual(['mise de côté', 'mise de côté']);
  });

  it('test obligatoire : 100 € courant → tiers = courant −100, tiers +100', () => {
    expect(effet(ecritures(preparerVirement(virement({ vers: tiers }))), compte, tiers)).toEqual([-10_000, 10_000]);
  });
  it('test obligatoire : 100 € tiers → courant = tiers −100, courant +100', () => {
    expect(effet(ecritures(preparerVirement(virement({ depuis: tiers, vers: compte }))), tiers, compte)).toEqual([-10_000, 10_000]);
  });
  it('tiers → tiers autorisé : départ −100, arrivée +100', () => {
    expect(effet(ecritures(preparerVirement(virement({ depuis: tiers, vers: tiers2 }))), tiers, tiers2)).toEqual([-10_000, 10_000]);
  });
  it('test obligatoire : dépôt extérieur +100 et retrait extérieur −100 sur le tiers, sans catégorie, autres comptes intacts', () => {
    const depot = preparerOperation(saisie({ compte: tiers, categorie: undefined, sens: 'credit', montant: 10_000 }));
    const retrait = preparerOperation(saisie({ compte: tiers, categorie: undefined, sens: 'debit', montant: 10_000 }));
    if (!depot.ok || !retrait.ok) throw new Error('refusé');
    expect('categorieId' in depot.operation).toBe(false);
    expect(effet([depot.operation], tiers, compte)).toEqual([10_000, 0]);
    expect(effet([retrait.operation], tiers, compte)).toEqual([-10_000, 0]);
  });
  it('catégorie toujours obligatoire sur un compte courant ou épargne', () => {
    expect(preparerOperation(saisie({ compte: epargne, categorie: undefined }))).toEqual({ ok: false, erreur: 'Catégorie obligatoire.' });
  });

  it('refus clairs : comptes manquants ou identiques, montant, note, date avant le départ d’un des deux', () => {
    expect(preparerVirement(virement({ depuis: undefined }))).toEqual({ ok: false, erreur: 'Compte de départ obligatoire.' });
    expect(preparerVirement(virement({ vers: undefined }))).toEqual({ ok: false, erreur: 'Compte d’arrivée obligatoire.' });
    expect(preparerVirement(virement({ vers: compte }))).toEqual({ ok: false, erreur: 'Choisissez deux comptes différents.' });
    expect(preparerVirement(virement({ montant: 0 }))).toEqual({ ok: false, erreur: 'Montant obligatoire.' });
    expect(preparerVirement(virement({ montant: -5 }))).toEqual({ ok: false, erreur: 'Montant invalide.' });
    expect(preparerVirement(virement({ note: 'x'.repeat(141) }))).toEqual({ ok: false, erreur: 'Note : 140 caractères au plus.' });
    const tardif: Compte = { ...epargne, dateDepart: '2026-11-15' };
    expect(preparerVirement(virement({ vers: tardif }))).toMatchObject({ ok: false, erreur: expect.stringContaining('antérieure') });
  });

  it('aperçu avant/après : nouvelle saisie, modification (ancienne écriture retirée), date future comptée', () => {
    const ancienne: OperationComplete = { id: 'o1', compteId: 'c1', categorieId: 'k1', date: '2026-11-05', sens: 'debit', montant: 2_000 };
    const ajout = { compteId: 'c1', date: '2026-11-10', sens: 'debit' as const, montant: 500 };
    expect(apercuSolde(compte, [ancienne], [], [ajout], '2026-11-10')).toEqual({ avant: 8_000, apres: 7_500 });
    expect(apercuSolde(compte, [ancienne], [ancienne], [ajout], '2026-11-10')).toEqual({ avant: 8_000, apres: 9_500 });
    expect(apercuSolde(compte, [ancienne], [], [{ ...ajout, date: '2026-12-01' }], '2026-11-10')).toEqual({ avant: 8_000, apres: 7_500 });
  });
});
