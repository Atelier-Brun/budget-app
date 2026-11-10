// Données FICTIVES uniquement.
import { describe, expect, it } from 'vitest';
import { estInutilisee, nouvelleCategorie, trierCategories } from './categories.ts';

describe('nouvelleCategorie', () => {
  it('débit par défaut, active, identifiant unique', () => {
    const c = nouvelleCategorie();
    expect(c).toMatchObject({ nom: '', sens: 'debit', archive: false });
    expect(c.id).not.toBe(nouvelleCategorie().id);
  });
});

describe('trierCategories', () => {
  it('ordre alphabétique français (accents bien placés)', () => {
    const noms = ['ZOO', 'ÉCOLE', 'ABRI', 'EAU', 'ÉTÉ'].map((nom) => ({ nom }));
    expect(trierCategories(noms).map((c) => c.nom)).toEqual(['ABRI', 'EAU', 'ÉCOLE', 'ÉTÉ', 'ZOO']);
  });
});

describe('estInutilisee', () => {
  const ops = [{ categorieId: 'a' }, { categorieId: 'b' }, {}];
  it('utilisée par au moins une opération : non', () => {
    expect(estInutilisee('a', ops)).toBe(false);
  });
  it('jamais utilisée : oui', () => {
    expect(estInutilisee('z', ops)).toBe(true);
    expect(estInutilisee('z', [])).toBe(true);
  });
});
