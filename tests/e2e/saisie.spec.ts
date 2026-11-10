// Saisie rapide (pavé numérique intégré), soldes, démo remplie. Données FICTIVES uniquement.
import { expect, test, type Page } from '@playwright/test';
import { APP, categorie, compte, DEMO, feuille, nav, plus, taper } from './aides';

const pave = (page: Page) => feuille(page).getByRole('group', { name: 'Pavé numérique' });

/** Saisie rapide : montant au pavé → catégorie → Valider (compte principal et date du jour déjà remplis). */
async function saisir(page: Page, touches: string, cat: string, opts: { compte?: string; sens?: 'Débit' | 'Crédit' } = {}) {
  await plus(page).click();
  await taper(page, touches);
  await feuille(page).getByText(cat, { exact: true }).click();
  if (opts.compte) await feuille(page).getByLabel('Compte').selectOption({ label: opts.compte });
  if (opts.sens) await feuille(page).getByText(opts.sens, { exact: true }).click();
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
}

test('sans compte puis sans catégorie : la saisie oriente vers leur création', async ({ page }) => {
  await page.goto(APP);
  await plus(page).click();
  await expect(feuille(page)).toContainText('Aucun compte actif.');
  await feuille(page).getByRole('button', { name: 'Créer un compte' }).click();
  await expect(page.getByRole('heading', { name: 'Nouveau compte' })).toBeVisible();
  await page.getByLabel('Nom').fill('Compte fictif');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await plus(page).click();
  await expect(feuille(page)).toContainText('Aucune catégorie active.');
  await feuille(page).getByRole('button', { name: 'Créer une catégorie' }).click();
  await expect(page.getByRole('heading', { name: 'Nouvelle catégorie' })).toBeVisible();
});

test('pavé numérique : rempli de droite à gauche en centimes, effacer, aucun clavier iOS', async ({ page }) => {
  await page.goto(APP);
  await compte(page, 'Compte fictif');
  await categorie(page, 'Courses fictives');
  await plus(page).click();

  const montant = feuille(page).getByLabel('Montant');
  await expect(montant).toHaveText('0,00 €');
  await taper(page, '2340');
  await expect(montant).toHaveText('23,40 €');
  await taper(page, '⌫');
  await expect(montant).toHaveText('2,34 €');
  await expect(feuille(page).locator('input[inputmode="decimal"], input[type="number"]')).toHaveCount(0);

  // Toutes les touches du pavé offrent une zone tactile d'au moins 44 × 44 px.
  for (const touche of await pave(page).getByRole('button').all()) {
    const boite = (await touche.boundingBox())!;
    expect(boite.width).toBeGreaterThanOrEqual(44);
    expect(boite.height).toBeGreaterThanOrEqual(44);
  }
});

test('saisie en 3 étapes : solde mis à jour, message, données conservées', async ({ page }) => {
  await page.goto(APP);
  await compte(page, 'Compte fictif', { solde: '100' });
  await categorie(page, 'Courses fictives');
  await categorie(page, 'Revenu fictif', true);

  await plus(page).click();
  await expect(feuille(page).getByLabel('Compte')).toHaveValue(/.+/); // compte principal déjà choisi
  await feuille(page).getByRole('button', { name: 'Annuler' }).click();
  await expect(feuille(page)).toHaveCount(0);

  await saisir(page, '1250', 'COURSES FICTIVES');
  await expect(page.getByRole('status').filter({ hasText: 'Opération enregistrée' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^COMPTE FICTIF/ })).toContainText('87,50 €');
  await page.getByRole('button', { name: /^COMPTE FICTIF/ }).click(); // le message disparaît en changeant d'écran
  await expect(page.getByText('Opération enregistrée')).toHaveCount(0);
  await page.getByRole('button', { name: '‹ Accueil' }).click();

  await saisir(page, '2000', 'REVENU FICTIF'); // le sens suit la catégorie (crédit)
  await expect(page.getByRole('button', { name: /^COMPTE FICTIF/ })).toContainText('107,50 €');

  await page.reload();
  await expect(page.getByRole('button', { name: /^COMPTE FICTIF/ })).toContainText('107,50 €');
});

test('refus clairs : catégorie et montant obligatoires, date avant le départ du compte', async ({ page }) => {
  await page.goto(APP);
  await compte(page, 'Compte fictif');
  await categorie(page, 'Courses fictives');
  await plus(page).click();
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await expect(feuille(page).getByRole('alert')).toHaveText('Catégorie obligatoire.');
  await feuille(page).getByText('COURSES FICTIVES', { exact: true }).click();
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await expect(feuille(page).getByRole('alert')).toHaveText('Montant obligatoire.');
  await taper(page, '500');
  await feuille(page).getByLabel('Date').fill('2000-01-01');
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await expect(feuille(page).getByRole('alert')).toContainText('antérieure au départ du compte');
});

test('compte tiers (option A) : libellés Débit/Crédit, débit de 40 → −40 (somme due par le tiers)', async ({ page }) => {
  await page.goto(APP);
  await compte(page, 'Compte fictif', { solde: '100' });
  await compte(page, 'Ami fictif', { type: 'Tiers' });
  await categorie(page, 'Prêt fictif');

  await plus(page).click();
  await feuille(page).getByLabel('Compte').selectOption({ label: 'AMI FICTIF' });
  await expect(feuille(page).getByRole('group', { name: 'Sens' })).toHaveText(/^\s*Sens\s*Débit\s*Crédit\s*$/);
  await feuille(page).getByRole('button', { name: 'Annuler' }).click();

  await saisir(page, '4000', 'PRÊT FICTIF', { compte: 'AMI FICTIF', sens: 'Débit' });
  const tiers = page.getByRole('region', { name: 'Tiers' });
  await expect(tiers.getByRole('button')).toContainText('−40,00 €');
  await expect(tiers).toContainText('Solde positif : somme due au tiers · Solde négatif : somme due par le tiers');
  await expect(page.getByRole('button', { name: /^COMPTE FICTIF/ })).toContainText('100,00 €'); // autre compte inchangé
});

test('démo : remplie au premier lancement, réinitialisable ; app réelle jamais remplie', async ({ page }) => {
  await page.goto(DEMO);
  await expect(page.getByRole('button', { name: /^COMPTE COURANT.*Principal/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tiers' }).getByRole('button')).toContainText('−15,00 €');

  await page.getByRole('button', { name: /^AMI EXEMPLE/ }).click();
  await page.getByLabel('Nom').fill('Ami renommé');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Réinitialiser les données fictives…' }).click();
  await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click();
  await expect(page.getByText('Données fictives réinitialisées.')).toBeVisible();
  await nav(page).getByRole('button', { name: 'Accueil' }).click();
  await expect(page.getByRole('button', { name: /^AMI EXEMPLE/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^AMI RENOMMÉ/ })).toHaveCount(0);

  await page.goto(APP);
  await expect(page.getByRole('button', { name: 'Créer un compte' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await expect(page.getByText(/Réinitialiser/)).toHaveCount(0);
});
