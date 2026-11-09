import { describe, expect, it } from 'vitest';
import { formaterMontant, lireMontant, MONTANT_MAX } from './montants.ts';

const ok = (saisie: string) => {
  const r = lireMontant(saisie);
  if (!r.ok) throw new Error(`refusé : ${saisie}`);
  return r.centimes;
};
const erreur = (saisie: string) => {
  const r = lireMontant(saisie);
  if (r.ok) throw new Error(`accepté : ${saisie}`);
  return r.erreur;
};

describe('lireMontant', () => {
  it('lit entiers, virgule, point et 1 ou 2 décimales', () => {
    expect(ok('12')).toBe(1200);
    expect(ok('12,5')).toBe(1250);
    expect(ok('12,50')).toBe(1250);
    expect(ok('12.05')).toBe(1205);
    expect(ok('0,01')).toBe(1);
    expect(ok('  7,30 ')).toBe(730);
  });

  it('pas d’erreur d’arrondi (0,1 + 0,2 et compagnie)', () => {
    expect(ok('0,29')).toBe(29);
    expect(ok('1,15')).toBe(115);
    expect(ok('4,35')).toBe(435);
  });

  it('accepte les espaces (normale, insécable, fine) comme séparateur de milliers', () => {
    expect(ok('1 234,56')).toBe(123456);
    expect(ok('1 234,56')).toBe(123456);
    expect(ok('1 234 567')).toBe(123456700);
    expect(ok('1234,56')).toBe(123456);
  });

  it('refuse les espaces mal placés et les formes douteuses', () => {
    for (const s of ['12 34', '1 2345', '1  234', '', ' ', ',50', '12,', '12,345', '-5', '+5', '1e3', '12,5€', 'abc', '1,2,3', '0x10', 'Infinity'])
      expect(erreur(s)).toMatch(/invalide/);
  });

  it('refuse zéro', () => {
    expect(erreur('0')).toMatch(/supérieur à 0/);
    expect(erreur('0,00')).toMatch(/supérieur à 0/);
  });

  it('borne : 9 999 999,99 € accepté, au-delà refusé', () => {
    expect(ok('9 999 999,99')).toBe(MONTANT_MAX);
    expect(ok('0009999999,99')).toBe(MONTANT_MAX);
    expect(erreur('10 000 000')).toMatch(/trop élevé/);
    expect(erreur('99999999')).toMatch(/trop élevé/);
    expect(erreur('9'.repeat(30))).toMatch(/invalide/);
  });
});

describe('formaterMontant', () => {
  // Intl fr-FR : espace fine insécable (U+202F) pour les milliers, insécable (U+00A0) avant €.
  it('format français', () => {
    expect(formaterMontant(123456)).toBe('1 234,56 €');
    expect(formaterMontant(5)).toBe('0,05 €');
    expect(formaterMontant(0)).toBe('0,00 €');
    expect(formaterMontant(MONTANT_MAX)).toBe('9 999 999,99 €');
  });

  it('vrai signe moins pour un négatif, « + » seulement sur demande', () => {
    expect(formaterMontant(-123456)).toBe('−1 234,56 €');
    expect(formaterMontant(1250, true)).toBe('+12,50 €');
    expect(formaterMontant(-1250, true)).toBe('−12,50 €');
    expect(formaterMontant(0, true)).toBe('0,00 €');
  });

  it('refuse un montant non entier', () => {
    expect(() => formaterMontant(12.5)).toThrow(RangeError);
    expect(() => formaterMontant(Number.NaN)).toThrow(RangeError);
  });
});
