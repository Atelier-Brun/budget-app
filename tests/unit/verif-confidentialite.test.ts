// Tests du filtre de confidentialité, avec des mots FICTIFS uniquement.
import { describe, expect, it } from 'vitest';
import {
  analyser,
  chercherMots,
  cheminInterdit,
  lireListe,
  normaliser,
} from '../../scripts/verif-confidentialite.mjs';

describe('normaliser', () => {
  it('retire accents et casse, remplace la ponctuation par des espaces', () => {
    expect(normaliser('Été-Hôtel_n°12 !')).toBe(' ETE HOTEL N 12 ');
  });
});

describe('lireListe', () => {
  it('ignore lignes vides et commentaires', () => {
    expect(lireListe('# titre\n\nZORGLUB\r\n  BLIP BLOP  \n# fin')).toEqual(['ZORGLUB', 'BLIP BLOP']);
  });
});

describe('chercherMots', () => {
  const mots = ['ZORGLUB', 'CAFÉ-PIXEL', 'QIX', '123,45', '12345'];

  it('trouve un mot entier, quels que soient casse et accents', () => {
    expect(chercherMots('const a = "zorglub";', mots)).toEqual(['ZORGLUB']);
    expect(chercherMots('Cafe Pixel', mots)).toEqual(['CAFÉ-PIXEL']);
    expect(chercherMots('cafe_pixel', mots)).toEqual(['CAFÉ-PIXEL']);
  });

  it('trouve un mot long collé à d’autres caractères', () => {
    expect(chercherMots('const cafePixelTotal = 1;', mots)).toEqual(['CAFÉ-PIXEL']);
    expect(chercherMots('xxzorglubxx', mots)).toEqual(['ZORGLUB']);
  });

  it('ne cherche pas collé un mot court ou numérique (évite les faux positifs)', () => {
    expect(chercherMots('QIXOTE', mots)).toEqual([]);
    expect(chercherMots('9912345', mots)).toEqual([]);
  });

  it('trouve un montant sous ses différentes écritures', () => {
    expect(chercherMots('montant: 123.45', mots)).toEqual(['123,45']);
    expect(chercherMots('centimes = 12345', mots)).toEqual(['12345']);
  });

  it('ne signale rien dans un texte propre', () => {
    expect(chercherMots('Bonjour le monde', mots)).toEqual([]);
  });

  it('ignore une entrée vide après normalisation', () => {
    expect(chercherMots('texte', ['---'])).toEqual([]);
  });
});

describe('cheminInterdit', () => {
  it.each([
    'CLAUDE.md',
    'docs/claude.md',
    '.claude/settings.json',
    'a/.claude/x',
    '.env',
    '.env.local',
    'export/FICHIER.xlsx',
    'data.csv',
    'budget-sauvegarde-2026-11-09.json',
    'donnees-privees.md',
    'mots-interdits.txt',
    'mots-surveilles.txt',
  ])('refuse %s', (chemin) => {
    expect(cheminInterdit(chemin)).toBe(true);
  });

  it.each(['src/App.svelte', 'README.md', 'package-lock.json'])('accepte %s', (chemin) => {
    expect(cheminInterdit(chemin)).toBe(false);
  });
});

describe('analyser', () => {
  it('sépare bloquants et avertissements, y compris dans le nom de fichier', () => {
    const resultat = analyser(
      [
        { nom: 'src/zorglub.ts', contenu: 'rien' },
        { nom: 'src/b.ts', contenu: 'un mot SURVEILLE ici' },
        { nom: 'image.png', contenu: null },
        { nom: 'CLAUDE.md', contenu: '' },
      ],
      ['ZORGLUB'],
      ['SURVEILLE'],
    );
    expect(resultat.bloquants).toEqual(['« ZORGLUB » dans src/zorglub.ts', 'fichier interdit : CLAUDE.md']);
    expect(resultat.avertissements).toEqual(['« SURVEILLE » dans src/b.ts']);
  });

  it('ne bloque rien sur un contenu propre', () => {
    expect(analyser([{ nom: 'a.ts', contenu: 'ok' }], ['ZORGLUB'], [])).toEqual({
      bloquants: [],
      avertissements: [],
    });
  });
});
