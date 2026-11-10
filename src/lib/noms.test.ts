import { describe, expect, it } from 'vitest';
import { normaliserNom, verifierNom } from './noms.ts';

describe('normaliserNom', () => {
  it('majuscules françaises, espaces nettoyés, accents gardés', () => {
    expect(normaliserNom('  livret   été ')).toBe('LIVRET ÉTÉ');
    expect(normaliserNom('cœur')).toBe('CŒUR');
  });
});

describe('verifierNom', () => {
  const existants = [
    { id: 'a', nom: 'LIVRET ÉTÉ' },
    { id: 'b', nom: 'COMPTE FICTIF' },
  ];
  it('accepte un nom nouveau, ou inchangé pour le même élément', () => {
    expect(verifierNom('Nouveau', 'z', existants)).toBeNull();
    expect(verifierNom('livret été', 'a', existants)).toBeNull();
  });
  it('refuse un doublon sans tenir compte des accents ni de la casse', () => {
    expect(verifierNom('livret ete', 'z', existants)).toBe('Ce nom existe déjà.');
    expect(verifierNom(' Compte  Fictif ', 'z', existants)).toBe('Ce nom existe déjà.');
  });
  it('refuse vide et plus de 30 caractères', () => {
    expect(verifierNom('   ', 'z', existants)).toBe('Nom obligatoire.');
    expect(verifierNom('A'.repeat(30), 'z', existants)).toBeNull();
    expect(verifierNom('A'.repeat(31), 'z', existants)).toBe('30 caractères au plus.');
  });
});
