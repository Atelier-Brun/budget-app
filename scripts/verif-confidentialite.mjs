#!/usr/bin/env node
// Vérification « aucune donnée personnelle » avant tout envoi vers le dépôt public.
//
// Les listes de mots sont lues HORS du dépôt (~/budget-app-prive/) et ne sont jamais versionnées :
//   - mots-interdits.txt  : bloquant (le commit / l'envoi est refusé)
//   - mots-surveilles.txt : signalé seulement
//
// Usage :
//   node scripts/verif-confidentialite.mjs --index              (hook pre-commit : fichiers indexés)
//   node scripts/verif-confidentialite.mjs --message <fichier>  (hook commit-msg : message du commit)
//   node scripts/verif-confidentialite.mjs --tout               (hook pre-push : tout le dépôt + historique des messages)
//
// Par sécurité, le script échoue (bloque) si la liste des mots interdits est absente ou vide.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Longueur minimale (sans espaces) pour chercher aussi un mot « collé » à d'autres lettres. */
export const LONGUEUR_MIN_SOUS_CHAINE = 6;

/**
 * Met un texte sous forme comparable : sans accents, en majuscules, chaque suite de caractères
 * autres que lettres/chiffres remplacée par une espace, entouré d'espaces.
 * @param {string} texte
 * @returns {string}
 */
export function normaliser(texte) {
  const simple = texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  return ` ${simple} `;
}

/**
 * Lit une liste de mots (une entrée par ligne, lignes vides et commentaires « # » ignorés).
 * @param {string} contenu
 * @returns {string[]}
 */
export function lireListe(contenu) {
  return contenu
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== '' && !ligne.startsWith('#'));
}

/**
 * Renvoie les entrées de la liste présentes dans le texte.
 * - Recherche en mot entier, sans tenir compte de la casse ni des accents.
 * - Les entrées longues contenant au moins une lettre sont aussi cherchées collées
 *   (ex. « cafePixel » ou « cafe_pixel » pour « CAFÉ-PIXEL »).
 * @param {string} texte
 * @param {readonly string[]} mots
 * @returns {string[]}
 */
export function chercherMots(texte, mots) {
  const normal = normaliser(texte);
  const colle = normal.replace(/ /g, '');
  /** @type {Set<string>} */
  const trouves = new Set();
  for (const mot of mots) {
    const motNormal = normaliser(mot).trim();
    if (motNormal === '') continue;
    if (normal.includes(` ${motNormal} `)) {
      trouves.add(mot);
      continue;
    }
    const motColle = motNormal.replace(/ /g, '');
    if (motColle.length >= LONGUEUR_MIN_SOUS_CHAINE && /[A-Z]/.test(motColle) && colle.includes(motColle)) {
      trouves.add(mot);
    }
  }
  return [...trouves];
}

/**
 * Indique si un chemin de fichier ne doit jamais entrer dans le dépôt.
 * @param {string} chemin
 * @returns {boolean}
 */
export function cheminInterdit(chemin) {
  const nom = basename(chemin).toLowerCase();
  const cheminMin = chemin.toLowerCase();
  return (
    nom === 'claude.md' ||
    cheminMin.startsWith('.claude/') ||
    cheminMin.includes('/.claude/') ||
    nom === '.env' ||
    nom.startsWith('.env.') ||
    /\.(xlsx|xls|csv)$/.test(nom) ||
    /^budget-sauvegarde-.*\.json$/.test(nom) ||
    nom.startsWith('donnees-privees') ||
    nom.startsWith('mots-interdits') ||
    nom.startsWith('mots-surveilles')
  );
}

/**
 * Analyse un ensemble de textes. Un « élément » est un fichier ou un message de commit.
 * @param {ReadonlyArray<{ nom: string, contenu: string | null }>} elements  contenu null = fichier binaire
 * @param {readonly string[]} interdits
 * @param {readonly string[]} surveilles
 * @returns {{ bloquants: string[], avertissements: string[] }}
 */
export function analyser(elements, interdits, surveilles) {
  /** @type {string[]} */
  const bloquants = [];
  /** @type {string[]} */
  const avertissements = [];
  for (const { nom, contenu } of elements) {
    if (cheminInterdit(nom)) bloquants.push(`fichier interdit : ${nom}`);
    const texte = `${nom}\n${contenu ?? ''}`;
    for (const mot of chercherMots(texte, interdits)) bloquants.push(`« ${mot} » dans ${nom}`);
    for (const mot of chercherMots(texte, surveilles)) avertissements.push(`« ${mot} » dans ${nom}`);
  }
  return { bloquants, avertissements };
}

// ---------------------------------------------------------------------------
// Partie « ligne de commande » (non testée unitairement : dépend de git et du disque)
// ---------------------------------------------------------------------------

/* v8 ignore start */

/**
 * @param {string[]} args
 * @returns {Buffer}
 */
function git(args) {
  return execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024 });
}

/**
 * @param {Buffer} brut
 * @returns {string | null}
 */
function enTexte(brut) {
  return brut.includes(0) ? null : brut.toString('utf8');
}

/** @returns {Array<{ nom: string, contenu: string | null }>} */
function fichiersIndexes() {
  const noms = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  return noms.map((nom) => ({ nom, contenu: enTexte(git(['show', `:${nom}`])) }));
}

/** @returns {Array<{ nom: string, contenu: string | null }>} */
function toutLeDepot() {
  const noms = git(['ls-files', '-z']).toString('utf8').split('\0').filter(Boolean);
  const elements = noms.map((nom) => ({ nom, contenu: enTexte(git(['show', `:${nom}`])) }));
  let messages = '';
  try {
    messages = git(['log', '--all', '--format=%an%n%ae%n%B']).toString('utf8');
  } catch {
    messages = ''; // dépôt sans commit
  }
  elements.push({ nom: '(messages de commit)', contenu: messages });
  return elements;
}

function principal() {
  const dossierPrive = process.env['BUDGET_PRIVE_DIR'] ?? join(homedir(), 'budget-app-prive');
  const fichierInterdits = join(dossierPrive, 'mots-interdits.txt');
  const fichierSurveilles = join(dossierPrive, 'mots-surveilles.txt');

  if (!existsSync(fichierInterdits)) {
    console.error(`✘ Liste des mots interdits introuvable (${fichierInterdits}). Envoi bloqué par sécurité.`);
    process.exit(1);
  }
  const interdits = lireListe(readFileSync(fichierInterdits, 'utf8'));
  if (interdits.length === 0) {
    console.error('✘ Liste des mots interdits vide. Envoi bloqué par sécurité.');
    process.exit(1);
  }
  const surveilles = existsSync(fichierSurveilles) ? lireListe(readFileSync(fichierSurveilles, 'utf8')) : [];

  const [mode, argument] = process.argv.slice(2);
  /** @type {Array<{ nom: string, contenu: string | null }>} */
  let elements;
  if (mode === '--index') elements = fichiersIndexes();
  else if (mode === '--message' && argument) {
    const message = readFileSync(argument, 'utf8')
      .split(/\r?\n/)
      .filter((ligne) => !ligne.startsWith('#'))
      .join('\n');
    elements = [{ nom: '(message du commit)', contenu: message }];
  } else if (mode === '--tout') elements = toutLeDepot();
  else {
    console.error('Usage : verif-confidentialite.mjs --index | --message <fichier> | --tout');
    process.exit(2);
  }

  const { bloquants, avertissements } = analyser(elements, interdits, surveilles);

  if (avertissements.length > 0) {
    console.warn('⚠ Mots surveillés (non bloquant, à vérifier) :');
    for (const ligne of avertissements) console.warn(`   ${ligne}`);
  }
  if (bloquants.length > 0) {
    console.error('✘ DONNÉE PERSONNELLE DÉTECTÉE — opération bloquée :');
    for (const ligne of bloquants) console.error(`   ${ligne}`);
    process.exit(1);
  }
  console.log(`✔ Confidentialité : ${elements.length} élément(s) vérifié(s), aucune donnée personnelle.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();

/* v8 ignore stop */
