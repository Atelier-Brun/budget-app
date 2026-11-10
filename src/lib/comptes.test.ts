// Données FICTIVES uniquement.
import { describe, expect, it } from 'vitest';
import { lireSoldeDepart, normaliserPrincipal, nouveauCompte, trierComptes, type Compte } from './comptes.ts';
import { estDateValide } from './dates.ts';

const c = (id: string, nom: string, type: Compte['type'], autres: Partial<Compte> = {}): Compte => ({
  id,
  nom,
  type,
  soldeDepart: 0,
  dateDepart: '2026-11-10',
  archive: false,
  principal: false,
  ...autres,
});

describe('nouveauCompte', () => {
  it('courant, solde 0, date du jour, identifiant unique', () => {
    const a = nouveauCompte();
    expect(a).toMatchObject({ nom: '', type: 'courant', soldeDepart: 0, archive: false, principal: false });
    expect(estDateValide(a.dateDepart)).toBe(true);
    expect(a.id).not.toBe(nouveauCompte().id);
  });
});

describe('trierComptes', () => {
  it('Courants, Épargne, Tiers, puis alphabétique (accents français)', () => {
    const tries = trierComptes([
      c('1', 'ZÈBRE', 'tiers'),
      c('2', 'ÉCUREUIL', 'epargne'),
      c('3', 'BANQUE B', 'courant'),
      c('4', 'ABEILLE', 'tiers'),
      c('5', 'BANQUE A', 'courant'),
      c('6', 'EAU', 'epargne'),
    ]);
    expect(tries.map((x) => x.nom)).toEqual(['BANQUE A', 'BANQUE B', 'EAU', 'ÉCUREUIL', 'ABEILLE', 'ZÈBRE']);
  });
});

describe('normaliserPrincipal', () => {
  const principal = (l: Compte[]) => l.filter((x) => x.principal).map((x) => x.id);

  it('le premier compte courant devient principal ; jamais un autre type', () => {
    expect(principal(normaliserPrincipal([c('t', 'T', 'tiers'), c('e', 'E', 'epargne')]))).toEqual([]);
    expect(principal(normaliserPrincipal([c('t', 'T', 'tiers'), c('a', 'A', 'courant')]))).toEqual(['a']);
  });
  it('garde le principal actuel', () => {
    expect(principal(normaliserPrincipal([c('a', 'A', 'courant'), c('b', 'B', 'courant', { principal: true })]))).toEqual(['b']);
  });
  it('préféré : remplace l’ancien (un seul principal)', () => {
    const l = [c('a', 'A', 'courant', { principal: true }), c('b', 'B', 'courant')];
    expect(principal(normaliserPrincipal(l, 'b'))).toEqual(['b']);
  });
  it('principal archivé ou passé en épargne : remplacé par le préféré, sinon le premier alphabétique', () => {
    const archive = [c('a', 'A', 'courant', { principal: true, archive: true }), c('c', 'C', 'courant'), c('b', 'B', 'courant')];
    expect(principal(normaliserPrincipal(archive))).toEqual(['b']);
    expect(principal(normaliserPrincipal(archive, 'c'))).toEqual(['c']);
    expect(principal(normaliserPrincipal([c('a', 'A', 'epargne', { principal: true })]))).toEqual([]);
  });
  it('préféré invalide (archivé) : ignoré', () => {
    const l = [c('a', 'A', 'courant', { archive: true }), c('b', 'B', 'courant')];
    expect(principal(normaliserPrincipal(l, 'a'))).toEqual(['b']);
  });
});

describe('lireSoldeDepart', () => {
  it('vide ou zéro : 0', () => {
    for (const s of ['', '  ', '0', '0,00', '00.0']) expect(lireSoldeDepart(s, true)).toEqual({ ok: true, centimes: 0 });
  });
  it('positif ou négatif selon le choix', () => {
    expect(lireSoldeDepart('1 234,56', false)).toEqual({ ok: true, centimes: 123456 });
    expect(lireSoldeDepart('12,5', true)).toEqual({ ok: true, centimes: -1250 });
  });
  it('saisie invalide : message de lireMontant', () => {
    expect(lireSoldeDepart('12,345', false)).toMatchObject({ ok: false });
    expect(lireSoldeDepart('abc', true)).toMatchObject({ ok: false });
  });
});
