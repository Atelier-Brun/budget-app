// Morceau 1 de 1e : comptes, Réglages, bandeaux. Données FICTIVES uniquement.
import { expect, test, type Page } from '@playwright/test';

import { capture, demarrer, feuille, plus, recharger, taper } from './aides';
import { DEMO } from './aides';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });

/** Remplit et enregistre la fiche ouverte. */
async function remplir(page: Page, nom: string, opts: { type?: string; solde?: string; negatif?: boolean } = {}) {
  await page.getByLabel('Nom').fill(nom);
  if (opts.type) await page.getByText(opts.type, { exact: true }).click();
  if (opts.negatif) await page.getByLabel('Négatif').check({ force: true });
  if (opts.solde) await page.getByLabel('Montant du solde de départ').fill(opts.solde);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
}

async function nouveauCompte(page: Page, nom: string, opts: Parameters<typeof remplir>[2] = {}) {
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Comptes' }).click();
  await page.getByRole('button', { name: 'Nouveau compte' }).click();
  await remplir(page, nom, opts);
  await expect(page.getByRole('heading', { name: 'Comptes' })).toBeVisible();
}

test('premier compte depuis l’accueil : majuscules, principal, solde affiché', async ({ page }) => {
  await demarrer(page);
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await remplir(page, '  compte   fictif ', { solde: '1 234,5' });

  const carte = page.getByRole('button', { name: /COMPTE FICTIF/ });
  await expect(carte).toContainText('Principal');
  await expect(carte).toContainText('1 234,50 €');
  await expect(page.getByRole('heading', { name: 'Courants' })).toBeVisible();

  await recharger(page); // conservé dans la base
  await expect(page.getByRole('button', { name: /COMPTE FICTIF/ })).toBeVisible();
});

test('solde de départ : modifiable sans opération, puis en lecture seule (correction par CORRECTION)', async ({ page }) => {
  await demarrer(page);
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await remplir(page, 'Compte fictif', { solde: '100' });
  const fiche = () => page.getByRole('button', { name: /^COMPTE FICTIF/ }).click();
  await fiche();
  await page.getByLabel('Montant du solde de départ').fill('150'); // aucune opération : encore corrigeable
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: /^COMPTE FICTIF/ })).toContainText('150,00 €');

  await plus(page).click();
  await taper(page, '1000');
  await feuille(page).getByText('CORRECTION', { exact: true }).click();
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByRole('button', { name: /^COMPTE FICTIF/ })).toContainText('140,00 €');

  await fiche();
  await expect(page.getByLabel('Montant du solde de départ')).toHaveCount(0);
  await expect(page.getByLabel('Date de départ')).toHaveCount(0);
  await expect(page.getByText(/^Solde de départ :/)).toHaveText(/^Solde de départ : 150,00\s€, le \d{2}\/\d{2}\/\d{4}$/);
  await page.waitForTimeout(1500); // capture : laisser la feuille de saisie finir de se fermer
  await capture(page, '041-1-solde-depart-fige');
  await page.getByLabel('Nom').fill('Compte renommé fictif'); // le reste de la fiche reste modifiable
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await recharger(page);
  await expect(page.getByRole('button', { name: /^COMPTE RENOMMÉ FICTIF/ })).toContainText('140,00 €');
});

test('refus clairs : nom vide, doublon (accents/casse), montant invalide', async ({ page }) => {
  await demarrer(page);
  await nouveauCompte(page, 'Livret Été', { type: 'Épargne' });
  await page.getByRole('button', { name: 'Nouveau compte' }).click();

  await remplir(page, '   ');
  await expect(page.getByRole('alert')).toHaveText('Nom obligatoire.');
  await remplir(page, 'livret ete');
  await expect(page.getByRole('alert')).toHaveText('Ce nom existe déjà.');
  await remplir(page, 'Autre', { solde: '12,345' });
  await expect(page.getByRole('alert')).toContainText('Montant invalide');
});

test('sections par type, sous-totaux, tiers avec signe et légende', async ({ page }) => {
  await demarrer(page);
  await nouveauCompte(page, 'Banque B', { solde: '100' });
  await nouveauCompte(page, 'Banque A', { solde: '30', negatif: true });
  await nouveauCompte(page, 'Ami fictif', { type: 'Tiers', solde: '20', negatif: true });
  await nav(page).getByRole('button', { name: 'Accueil' }).click();

  const titres = page.getByRole('heading', { level: 2 });
  await expect(titres).toHaveText(['Courants', 'Tiers']);
  const courants = page.getByRole('region', { name: 'Courants' });
  await expect(courants.getByRole('button')).toHaveText([/^BANQUE A.*−30,00/, /^BANQUE B.*100,00/]);
  await expect(courants).toContainText('70,00 €'); // sous-total 100 − 30
  const tiers = page.getByRole('region', { name: 'Tiers' });
  await expect(tiers.getByRole('button')).toContainText('−20,00');
  await expect(tiers).toContainText('Solde positif : somme due au tiers · Solde négatif : somme due par le tiers');
  await expect(page.getByText('Total', { exact: false })).toHaveCount(0);
});

test('archiver le principal : choix du remplaçant, historique gardé, réactivation', async ({ page }) => {
  await demarrer(page);
  await nouveauCompte(page, 'Banque A');
  await nouveauCompte(page, 'Banque B');
  await nouveauCompte(page, 'Banque C');

  await page.getByRole('button', { name: /^BANQUE A/ }).click();
  await page.getByRole('button', { name: 'Archiver ce compte…' }).click();
  await page.getByLabel('Nouveau compte principal').selectOption({ label: 'BANQUE C' });
  await page.getByRole('button', { name: 'Archiver', exact: true }).click();

  await expect(page.getByRole('button', { name: /^BANQUE C.*Principal/ })).toBeVisible();
  await page.getByText('Comptes archivés (1)').click();
  await page.getByRole('button', { name: /^BANQUE A/ }).click();
  await page.getByRole('button', { name: 'Réactiver ce compte' }).click();
  await expect(page.getByText('Comptes archivés')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^BANQUE C.*Principal/ })).toBeVisible();
});

test('Réglages : version et stockage ; bandeau « Version de travail » retiré (étape 3)', async ({ page }) => {
  await demarrer(page);
  await expect(page.getByText(/Version de travail/)).toHaveCount(0);
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await expect(page.getByText('Stockage persistant')).toBeVisible();
  await expect(page.getByText(/^(Activé|Non accordé par Safari)/)).toBeVisible();

  await demarrer(page, DEMO);
  await expect(page.getByText('DÉMO – données fictives')).toBeVisible();
  await expect(page.getByText(/Version de travail/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^COMPTE COURANT/ })).toBeVisible(); // base démo séparée, remplie
});
