// Carnet d'archives (étape 2b) : filtres, modification, suppression avec confirmation. Données FICTIVES uniquement.
import { expect, test, type Page } from '@playwright/test';
import { demarrer, recharger, categorie, compte, feuille, nav, plus, solde, taper, virer } from './aides';

const lignes = (page: Page) => page.getByRole('list', { name: 'Opérations' }).getByRole('button');
const filtre = (page: Page, nom: 'Compte' | 'Catégorie', label: string) => page.getByLabel(nom).selectOption({ label });
const nbEcritures = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((ok) => {
        const r = indexedDB.open('budget');
        r.onsuccess = () => {
          const g = r.result.transaction('operations').objectStore('operations').count();
          g.onsuccess = () => ok(g.result);
        };
      }),
  );

async function preparer(page: Page) {
  await demarrer(page);
  await compte(page, 'Compte fictif', { solde: '500' });
  await compte(page, 'Livret fictif', { type: 'Épargne' });
  await categorie(page, 'Courses fictives');
  await plus(page).click();
  await taper(page, '1250');
  await feuille(page).getByText('COURSES FICTIVES', { exact: true }).click();
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await virer(page, '20000', 'COMPTE FICTIF', 'LIVRET FICTIF');
  await nav(page).getByRole('button', { name: 'Carnet' }).click();
}

test('mois en cours, toutes les écritures ; filtres compte, virements, catégorie ; mois précédent vide', async ({ page }) => {
  await preparer(page);
  await expect(page.getByRole('heading', { name: 'Carnet' })).toBeVisible();
  await expect(lignes(page)).toHaveCount(3);
  await expect(page.getByText('VIREMENT vers LIVRET FICTIF')).toBeVisible();
  await expect(page.getByText('VIREMENT depuis COMPTE FICTIF')).toBeVisible();

  await filtre(page, 'Catégorie', 'Virements');
  await expect(lignes(page)).toHaveCount(2);
  await filtre(page, 'Compte', 'LIVRET FICTIF');
  await expect(lignes(page)).toHaveCount(1);
  await expect(lignes(page)).toContainText('200,00 €');
  await expect(lignes(page)).toContainText('Crédit');
  await filtre(page, 'Catégorie', 'COURSES FICTIVES');
  await expect(page.getByText('Aucune opération pour ce choix.')).toBeVisible();
  await filtre(page, 'Compte', 'Tous');
  await expect(lignes(page)).toHaveCount(1);
  await expect(lignes(page)).toContainText('12,50 €');

  await filtre(page, 'Catégorie', 'Toutes');
  await page.getByRole('button', { name: 'Mois précédent' }).click();
  await expect(page.getByText('Aucune opération pour ce choix.')).toBeVisible();
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(lignes(page)).toHaveCount(3);
});

test('modifier une opération puis un virement (ses deux écritures ensemble) : soldes justes, rien en double', async ({ page }) => {
  await preparer(page);
  await lignes(page).filter({ hasText: 'COURSES FICTIVES' }).click();
  await expect(page.getByRole('heading', { name: 'Modifier l’opération' })).toBeVisible();
  await taper(page, '⌫⌫⌫⌫2000');
  await feuille(page).getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toHaveText('Modification enregistrée');
  await expect(page.getByRole('heading', { name: 'Carnet' })).toBeVisible(); // on reste dans le carnet
  await expect(lignes(page).filter({ hasText: 'COURSES FICTIVES' })).toContainText('20,00 €');

  await page.getByText('VIREMENT depuis COMPTE FICTIF').click();
  await expect(page.getByRole('heading', { name: 'Modifier le virement' })).toBeVisible();
  await expect(feuille(page).getByLabel('Depuis (Débit)').locator('option:checked')).toHaveText('COMPTE FICTIF');
  await expect(feuille(page).getByLabel('Vers (Crédit)').locator('option:checked')).toHaveText('LIVRET FICTIF');
  await taper(page, '⌫⌫⌫⌫⌫6000');
  await feuille(page).getByRole('button', { name: 'Enregistrer' }).click();
  await expect(lignes(page)).toHaveCount(3);
  // Même date : l'ordre des deux écritures n'est pas fixé, chacune est vérifiée séparément.
  await expect(lignes(page).filter({ hasText: 'VIREMENT vers' })).toContainText(/60,00\s€\s*Débit/);
  await expect(lignes(page).filter({ hasText: 'VIREMENT depuis' })).toContainText(/60,00\s€\s*Crédit/);
  expect(await nbEcritures(page)).toBe(3);

  await recharger(page);
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('420,00 €'); // 500 − 20 − 60
  await expect(solde(page, 'LIVRET FICTIF')).toContainText('60,00 €');
});

test('supprimer : annuler garde tout ; confirmer un virement retire ses deux écritures ; conservé après rechargement', async ({ page }) => {
  await preparer(page);
  await page.getByText('VIREMENT vers LIVRET FICTIF').click();
  await feuille(page).getByRole('button', { name: 'Supprimer ce virement…' }).click();
  await expect(feuille(page).getByRole('alertdialog')).toContainText('Ses deux écritures seront supprimées.');
  await feuille(page).getByRole('alertdialog').getByRole('button', { name: 'Annuler' }).click();
  await feuille(page).getByRole('button', { name: 'Annuler' }).click();
  await expect(lignes(page)).toHaveCount(3);

  await page.getByText('VIREMENT vers LIVRET FICTIF').click();
  await feuille(page).getByRole('button', { name: 'Supprimer ce virement…' }).click();
  await feuille(page).getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('status')).toHaveText('Virement supprimé');
  await expect(lignes(page)).toHaveCount(1);
  expect(await nbEcritures(page)).toBe(1);

  await lignes(page).filter({ hasText: 'COURSES FICTIVES' }).click();
  await feuille(page).getByRole('button', { name: 'Supprimer cette opération…' }).click();
  await feuille(page).getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByText('Aucune opération pour ce choix.')).toBeVisible();

  await recharger(page);
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('500,00 €');
  await expect(solde(page, 'LIVRET FICTIF')).toContainText('0,00 €');
});
