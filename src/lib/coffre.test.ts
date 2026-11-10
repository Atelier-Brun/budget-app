// Coffre : clés, codes, chiffrement. Données FICTIVES ; itérations réduites (sauf contrôle de la valeur par défaut).
import { describe, expect, it } from 'vitest';
import {
  changerCode,
  chiffrer,
  codeValide,
  creerCoffre,
  dechiffrer,
  delaiApres,
  depuisB64,
  ErreurCoffre,
  formaterSecours,
  genererSecours,
  ITERATIONS,
  normaliserSecours,
  ouvrirAvecCode,
  ouvrirAvecSecours,
  solidite,
  versB64,
} from './coffre.ts';

const IT = 1000;

describe('codes', () => {
  it('code : 6 à 12 chiffres seulement', () => {
    expect(codeValide('123456')).toBe(true);
    expect(codeValide('123456789012')).toBe(true);
    expect(codeValide('12345')).toBe(false);
    expect(codeValide('1234567890123')).toBe(false);
    expect(codeValide('12345a')).toBe(false);
  });

  it('solidité : < 8 chiffres ou suite/répétition = faible, 8-9 correct, ≥ 10 solide', () => {
    expect(solidite('480215')).toBe('faible');
    expect(solidite('11111111')).toBe('faible');
    expect(solidite('12345678')).toBe('faible');
    expect(solidite('98765432')).toBe('faible');
    expect(solidite('48021573')).toBe('correct');
    expect(solidite('4802157396')).toBe('solide');
  });

  it('code de secours : 24 signes sans ambiguïté, affiché par 4, saisie tolérante', () => {
    const s = genererSecours();
    expect(s).toMatch(/^[2-9A-HJ-NP-Z]{24}$/);
    expect(genererSecours()).not.toBe(s);
    expect(formaterSecours(s)).toMatch(/^(\w{4}-){5}\w{4}$/);
    expect(normaliserSecours(` ${formaterSecours(s).toLowerCase()} `)).toBe(s);
  });

  it('délais croissants après erreurs, jamais d’effacement', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 20].map(delaiApres)).toEqual(
      [0, 0, 0, 0, 30, 60, 300, 900, 3600, 3600].map((s) => s * 1000),
    );
  });
});

describe('coffre', () => {
  it('par défaut : 600 000 itérations, clé de données non exportable', async () => {
    const { coffre, cle } = await creerCoffre('48021573');
    expect(coffre.iterations).toBe(ITERATIONS);
    expect(ITERATIONS).toBeGreaterThanOrEqual(600_000);
    expect(cle.extractable).toBe(false);
    expect(coffre.code.sel).toHaveLength(16);
    expect(coffre.code.cle).toHaveLength(40);
  });

  it('ouverture par le code ou le code de secours ; mauvais code refusé avec un message fixe', async () => {
    const { coffre, cle, secours } = await creerCoffre('48021573', IT);
    const c = await chiffrer(cle, 'comptes', 'a', { nom: 'FICTIF' });
    for (const k of [await ouvrirAvecCode(coffre, '48021573'), await ouvrirAvecSecours(coffre, formaterSecours(secours).toLowerCase())]) {
      expect(k.extractable).toBe(false);
      expect(await dechiffrer(k, 'comptes', 'a', c)).toEqual({ nom: 'FICTIF' });
    }
    await expect(ouvrirAvecCode(coffre, '48021574')).rejects.toThrow(new ErreurCoffre('Code incorrect.'));
    await expect(ouvrirAvecSecours(coffre, genererSecours())).rejects.toThrow('Code incorrect.');
  });

  it('changer le code (par le code actuel ou le secours) : ancien refusé, données toujours lisibles, secours inchangé', async () => {
    const { coffre, cle, secours } = await creerCoffre('48021573', IT);
    const c = await chiffrer(cle, 'operations', 'x', { montant: 100 });
    const c2 = await changerCode(coffre, { code: '48021573' }, '99887766');
    await expect(ouvrirAvecCode(c2, '48021573')).rejects.toThrow('Code incorrect.');
    expect(await dechiffrer(await ouvrirAvecCode(c2, '99887766'), 'operations', 'x', c)).toEqual({ montant: 100 });
    const c3 = await changerCode(c2, { secours }, '55443322');
    expect(await dechiffrer(await ouvrirAvecCode(c3, '55443322'), 'operations', 'x', c)).toEqual({ montant: 100 });
    expect(c3.secours).toEqual(coffre.secours);
    await expect(changerCode(c3, { code: '00000000' }, '11223344')).rejects.toThrow('Code incorrect.');
  });

  it('chiffrement : IV neuf à chaque écriture, rien en clair, lié au magasin et à la clé', async () => {
    const { cle } = await creerCoffre('48021573', IT);
    const a = await chiffrer(cle, 'comptes', 'a', { nom: 'COMPTE FICTIF' });
    const b = await chiffrer(cle, 'comptes', 'a', { nom: 'COMPTE FICTIF' });
    expect(a.iv).toHaveLength(12);
    expect(versB64(a.iv)).not.toBe(versB64(b.iv));
    expect(new TextDecoder().decode(a.d)).not.toContain('FICTIF');
    await expect(dechiffrer(cle, 'categories', 'a', a)).rejects.toThrow('Données illisibles ou modifiées.');
    await expect(dechiffrer(cle, 'comptes', 'b', a)).rejects.toThrow('Données illisibles ou modifiées.');
    const abime = { iv: a.iv, d: a.d.slice() };
    abime.d[0]! ^= 1;
    await expect(dechiffrer(cle, 'comptes', 'a', abime)).rejects.toThrow('Données illisibles ou modifiées.');
  });

  it('base64 aller-retour', () => {
    const o = crypto.getRandomValues(new Uint8Array(300));
    expect(depuisB64(versB64(o))).toEqual(o);
  });
});
