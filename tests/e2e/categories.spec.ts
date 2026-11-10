// Morceau 2 de 1e : catégories. Données FICTIVES uniquement.
import { expect, test, type Page } from '@playwright/test';

import { compte, demarrer, feuille, plus, recharger, taper } from './aides';

async function ouvrirCategories(page: Page) {
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Catégories' }).click();
  await expect(page.getByRole('heading', { name: 'Catégories' })).toBeVisible();
}

async function creer(page: Page, nom: string, sens?: 'Crédit') {
  await page.getByRole('button', { name: 'Nouvelle catégorie' }).click();
  await page.getByLabel('Nom').fill(nom);
  if (sens) await page.getByText(sens, { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
}

/** Utilise la catégorie nommée dans une vraie saisie (sur un compte fictif), puis revient aux catégories. */
async function utiliser(page: Page, nom: string) {
  await compte(page, 'Compte fictif');
  await plus(page).click();
  await taper(page, '100');
  await feuille(page).getByText(nom, { exact: true }).click();
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await recharger(page);
  await ouvrirCategories(page);
}

test('création : majuscules, ordre alphabétique, sens par défaut affiché, conservé', async ({ page }) => {
  await demarrer(page);
  await ouvrirCategories(page);
  await expect(page.getByText('Aucune catégorie.', { exact: false })).toBeVisible();
  await creer(page, 'zéro fictif');
  await creer(page, 'école fictive');
  await creer(page, 'abri fictif', 'Crédit');

  const lignes = page.getByRole('list').first().getByRole('button');
  await expect(lignes).toHaveText(['ABRI FICTIF Crédit', 'ÉCOLE FICTIVE Débit', 'ZÉRO FICTIF Débit']);
  await recharger(page);
  await ouvrirCategories(page);
  await expect(lignes).toHaveCount(3);
});

test('refus clairs : vide et doublon (accents/casse) ; modification', async ({ page }) => {
  await demarrer(page);
  await ouvrirCategories(page);
  await creer(page, 'Été fictif');
  await page.getByRole('button', { name: 'Nouvelle catégorie' }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('alert')).toHaveText('Nom obligatoire.');
  await page.getByLabel('Nom').fill('ete FICTIF');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('alert')).toHaveText('Ce nom existe déjà.');

  await page.getByRole('button', { name: '‹ Catégories' }).click();
  await page.getByRole('button', { name: /^ÉTÉ FICTIF/ }).click();
  await page.getByText('Crédit', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: /^ÉTÉ FICTIF/ })).toContainText('Crédit');
});

test('jamais utilisée : suppression définitive après confirmation', async ({ page }) => {
  await demarrer(page);
  await ouvrirCategories(page);
  await creer(page, 'Temporaire');
  await page.getByRole('button', { name: /^TEMPORAIRE/ }).click();
  await page.getByRole('button', { name: 'Supprimer cette catégorie…' }).click();
  await expect(page.getByText('supprimée définitivement')).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByRole('button', { name: /^TEMPORAIRE/ })).toHaveCount(0);
});

test('déjà utilisée : archivage seulement, historique gardé, réactivation', async ({ page }) => {
  await demarrer(page);
  await ouvrirCategories(page);
  await creer(page, 'Servie');
  await utiliser(page, 'SERVIE');

  await page.getByRole('button', { name: /^SERVIE/ }).click();
  await expect(page.getByRole('button', { name: 'Supprimer cette catégorie…' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Archiver cette catégorie…' }).click();
  await page.getByRole('button', { name: 'Archiver', exact: true }).click();
  await page.getByText('Catégories archivées (1)').click();
  await page.getByRole('button', { name: /^SERVIE/ }).click();
  await page.getByRole('button', { name: 'Réactiver cette catégorie' }).click();
  await expect(page.getByText('Catégories archivées')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^SERVIE/ })).toBeVisible();
});
