import { describe, expect, it } from 'vitest';
import { aujourdHui, estDateValide, formaterDate, joursDansMois } from './dates.ts';

describe('joursDansMois', () => {
  it('mois courts, longs, février bissextile ou non', () => {
    expect(joursDansMois(2026, 1)).toBe(31);
    expect(joursDansMois(2026, 4)).toBe(30);
    expect(joursDansMois(2026, 2)).toBe(28);
    expect(joursDansMois(2028, 2)).toBe(29);
    expect(joursDansMois(2100, 2)).toBe(28);
    expect(joursDansMois(2000, 2)).toBe(29);
  });
});

describe('estDateValide', () => {
  it('accepte les vraies dates', () => {
    for (const d of ['2026-11-09', '2028-02-29', '2026-12-31', '2000-01-01']) expect(estDateValide(d)).toBe(true);
  });
  it('refuse les dates inexistantes ou mal formées', () => {
    for (const d of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-00', '1999-12-31', '2026-1-9', '09/11/2026', '2026-11-09T00:00', ''])
      expect(estDateValide(d)).toBe(false);
  });
});

describe('aujourdHui', () => {
  it('utilise la date locale, zéros compris', () => {
    expect(aujourdHui(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(aujourdHui(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
  it('sans argument : date du jour au bon format', () => {
    expect(estDateValide(aujourdHui())).toBe(true);
  });
});

describe('formaterDate', () => {
  it('JJ/MM/AAAA', () => {
    expect(formaterDate('2026-11-09')).toBe('09/11/2026');
  });
});
