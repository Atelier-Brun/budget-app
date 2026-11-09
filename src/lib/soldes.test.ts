// Données FICTIVES uniquement.
import { describe, expect, it } from 'vitest';
import { calculerSolde, verifierDepart, verifierOperation, type Compte, type Operation } from './soldes.ts';

const compte: Compte = { id: 'c1', soldeDepart: 10_000, dateDepart: '2026-11-10' };
const ops: Operation[] = [
  { compteId: 'c1', date: '2026-11-10', sens: 'debit', montant: 2_550 },
  { compteId: 'c1', date: '2026-11-12', sens: 'credit', montant: 150_000 },
  { compteId: 'c1', date: '2026-11-20', sens: 'debit', montant: 99 },
  { compteId: 'c2', date: '2026-11-11', sens: 'credit', montant: 777 },
];

describe('calculerSolde', () => {
  it('solde de départ seul quand il n’y a pas d’opération', () => {
    expect(calculerSolde(compte, [], '2026-11-30')).toBe(10_000);
  });
  it('les opérations du jour de départ comptent ; débits retirés, crédits ajoutés', () => {
    expect(calculerSolde(compte, ops, '2026-11-10')).toBe(7_450);
    expect(calculerSolde(compte, ops, '2026-11-12')).toBe(157_450);
  });
  it('opérations futures exclues, autres comptes ignorés', () => {
    expect(calculerSolde(compte, ops, '2026-11-19')).toBe(157_450);
    expect(calculerSolde(compte, ops, '2026-11-20')).toBe(157_351);
  });
  it('peut devenir négatif ; solde de départ négatif accepté', () => {
    expect(calculerSolde({ ...compte, soldeDepart: -5_000 }, ops.slice(0, 1), '2026-11-30')).toBe(-7_550);
  });
  it('modifier le départ recalcule sans rien perdre', () => {
    const modifie = { ...compte, soldeDepart: 20_000, dateDepart: '2026-11-01' };
    expect(calculerSolde(modifie, ops, '2026-11-30')).toBe(167_351);
    expect(ops).toHaveLength(4);
  });
});

describe('verifierOperation', () => {
  const op: Operation = { compteId: 'c1', date: '2026-11-15', sens: 'debit', montant: 1_000 };
  it('accepte une opération correcte, y compris le jour de départ', () => {
    expect(verifierOperation(op, compte)).toBeNull();
    expect(verifierOperation({ ...op, date: '2026-11-10' }, compte)).toBeNull();
  });
  it('refuse une date antérieure au départ, avec la date dans le message', () => {
    expect(verifierOperation({ ...op, date: '2026-11-09' }, compte)).toBe(
      'Date antérieure au départ du compte (10/11/2026) : choisis une date à partir de ce jour.',
    );
  });
  it('refuse date, montant ou sens invalides', () => {
    expect(verifierOperation({ ...op, date: '2026-02-30' }, compte)).toBe('Date invalide.');
    for (const montant of [0, -1, 12.5, 1_000_000_000, Number.NaN])
      expect(verifierOperation({ ...op, montant }, compte)).toBe('Montant invalide.');
    expect(verifierOperation({ ...op, sens: 'autre' as never }, compte)).toBe('Choisis débit ou crédit.');
  });
});

describe('verifierDepart', () => {
  it('accepte une date de départ avancée ou égale à la première opération', () => {
    expect(verifierDepart('c1', 0, '2026-11-01', ops)).toBeNull();
    expect(verifierDepart('c1', -5_000, '2026-11-10', ops)).toBeNull();
  });
  it('refuse une date de départ qui laisserait des opérations avant elle', () => {
    expect(verifierDepart('c1', 0, '2026-11-15', ops)).toBe(
      '2 opération(s) datée(s) avant le 15/11/2026 : choisis une date de départ au plus tard le 10/11/2026.',
    );
  });
  it('ignore les opérations des autres comptes', () => {
    expect(verifierDepart('c2', 0, '2026-11-01', ops)).toBeNull();
    expect(verifierDepart('c3', 0, '2026-12-31', ops)).toBeNull();
  });
  it('refuse date ou solde invalides', () => {
    expect(verifierDepart('c1', 0, '2026-11-31', ops)).toBe('Date de départ invalide.');
    expect(verifierDepart('c1', 1.5, '2026-11-01', ops)).toBe('Solde de départ invalide.');
    expect(verifierDepart('c1', -1_000_000_000, '2026-11-01', ops)).toBe('Solde de départ invalide.');
  });
});
