// Virements, dépôts/retraits sur un tiers, raccourcis de la fiche (étape 2). Règle unique : Crédit monte, Débit baisse.
// Données FICTIVES uniquement.
import { expect, test } from '@playwright/test';
import { APP, categorie, compte, feuille, nav, plus, solde, taper, virer } from './aides';

test('courant → épargne puis courant → tiers (test obligatoire) : soldes, message, conservés après rechargement', async ({ page }) => {
  await page.goto(APP);
  await compte(page, 'Compte fictif', { solde: '500' });
  await compte(page, 'Livret fictif', { type: 'Épargne' });
  await compte(page, 'Ami fictif', { type: 'Tiers' });

  await virer(page, '20000', 'COMPTE FICTIF', 'LIVRET FICTIF', 'Mise de côté');
  await expect(page.getByRole('status')).toHaveText('Virement enregistré');
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('300,00 €');
  await expect(solde(page, 'LIVRET FICTIF')).toContainText('200,00 €');

  // Test obligatoire : 100 € courant → tiers = courant −100, tiers +100.
  await virer(page, '10000', 'COMPTE FICTIF', 'AMI FICTIF');
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('200,00 €');
  await expect(solde(page, 'AMI FICTIF')).toContainText('+100,00 €');

  // Test obligatoire : 100 € tiers → courant = tiers −100, courant +100.
  await virer(page, '10000', 'AMI FICTIF', 'COMPTE FICTIF');
  await expect(solde(page, 'AMI FICTIF')).toContainText('0,00 €');
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('300,00 €');

  await page.reload();
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('300,00 €');
  await expect(solde(page, 'LIVRET FICTIF')).toContainText('200,00 €');
  await expect(solde(page, 'AMI FICTIF')).toContainText('0,00 €');
  const ecritures = await page.evaluate(
    () =>
      new Promise<{ virementId?: string; categorieId?: string }[]>((ok) => {
        const r = indexedDB.open('budget');
        r.onsuccess = () => {
          const g = r.result.transaction('operations').objectStore('operations').getAll();
          g.onsuccess = () => ok(g.result);
        };
      }),
  );
  expect(ecritures).toHaveLength(6); // 3 virements = 3 paires liées, sans catégorie
  expect(new Set(ecritures.map((e) => e.virementId)).size).toBe(3);
  expect(ecritures.every((e) => e.virementId && !e.categorieId)).toBe(true);
});

test('un seul compte : pas de virement ; sans compte d’arrivée : refus ; tiers → tiers autorisé', async ({ page }) => {
  await page.goto(APP);
  await compte(page, 'Ami fictif', { type: 'Tiers' });
  await plus(page).click();
  await feuille(page).getByText('Virement', { exact: true }).click();
  await expect(feuille(page)).toContainText('Deux comptes actifs sont nécessaires pour un virement.');
  await feuille(page).getByRole('button', { name: 'Annuler' }).click();

  await compte(page, 'Autre fictif', { type: 'Tiers' });
  await plus(page).click();
  await feuille(page).getByText('Virement', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nouveau virement' })).toBeVisible();
  await taper(page, '1000');
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await expect(feuille(page).getByRole('alert')).toHaveText('Compte d’arrivée obligatoire.');
  await feuille(page).getByLabel('Depuis (Débit)').selectOption({ label: 'AMI FICTIF' });
  await feuille(page).getByLabel('Vers (Crédit)').selectOption({ label: 'AUTRE FICTIF' });
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await expect(solde(page, 'AMI FICTIF')).toContainText('−10,00 €');
  await expect(solde(page, 'AUTRE FICTIF')).toContainText('+10,00 €');
});

test('tiers : dépôt (Crédit) et retrait (Débit) avec l’extérieur, sans catégorie, autres comptes intacts', async ({ page }) => {
  await page.goto(APP);
  await compte(page, 'Compte fictif', { solde: '500' });
  await compte(page, 'Ami fictif', { type: 'Tiers' });
  for (const [sens, attendu] of [['Crédit', '+100,00 €'], ['Débit', '0,00 €'], ['Débit', '−100,00 €']] as const) {
    await plus(page).click();
    await taper(page, '10000');
    await feuille(page).getByLabel('Compte').selectOption({ label: 'AMI FICTIF' });
    await feuille(page).getByText(sens, { exact: true }).click();
    await expect(feuille(page).getByText('Catégorie (facultative pour un tiers)')).toBeVisible();
    await feuille(page).getByRole('button', { name: 'Valider' }).click();
    await expect(solde(page, 'AMI FICTIF')).toContainText(attendu);
  }
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('500,00 €');
  await nav(page).getByRole('button', { name: 'Carnet' }).click();
  await expect(page.getByText('DÉPÔT')).toHaveCount(1);
  await expect(page.getByText('RETRAIT')).toHaveCount(2);
});

test('fiche compte : solde, raccourcis Débit/Crédit/Virement avec ce compte déjà choisi ; inversion ; aperçu ; dernier compte retenu', async ({ page }) => {
  await page.goto(APP);
  await compte(page, 'Compte fictif', { solde: '500' });
  await compte(page, 'Livret fictif', { type: 'Épargne' });
  await categorie(page, 'Courses fictives');
  await nav(page).getByRole('button', { name: 'Accueil' }).click();

  await solde(page, 'LIVRET FICTIF').click();
  await expect(page.getByText('Solde').first()).toBeVisible();
  await page.getByRole('button', { name: 'Crédit', exact: true }).click();
  await expect(feuille(page).getByLabel('Compte').locator('option:checked')).toHaveText('LIVRET FICTIF');
  await expect(feuille(page).getByRole('radio', { name: 'Crédit' })).toBeChecked();
  await taper(page, '2500');
  await feuille(page).getByText('COURSES FICTIVES', { exact: true }).click(); // catégorie au sens Débit : le Crédit choisi reste
  await expect(feuille(page).getByRole('radio', { name: 'Crédit' })).toBeChecked();
  await expect(feuille(page).getByRole('list', { name: 'Aperçu du solde' })).toContainText(/0,00\s€\s→\s25,00\s€/);
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await expect(solde(page, 'LIVRET FICTIF')).toContainText('25,00 €');

  // Le dernier compte utilisé est proposé, même après rechargement.
  await page.reload();
  await plus(page).click();
  await expect(feuille(page).getByLabel('Compte').locator('option:checked')).toHaveText('LIVRET FICTIF');
  await feuille(page).getByRole('button', { name: 'Annuler' }).click();

  // Virement depuis la fiche : compte de départ déjà choisi, inversion d'un geste, aperçu des deux comptes.
  await solde(page, 'COMPTE FICTIF').click();
  await page.getByRole('button', { name: 'Virement', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nouveau virement' })).toBeVisible();
  await expect(feuille(page).getByLabel('Depuis (Débit)').locator('option:checked')).toHaveText('COMPTE FICTIF');
  await feuille(page).getByLabel('Vers (Crédit)').selectOption({ label: 'LIVRET FICTIF' });
  await feuille(page).getByRole('button', { name: 'Inverser Depuis et Vers' }).click();
  await expect(feuille(page).getByLabel('Depuis (Débit)').locator('option:checked')).toHaveText('LIVRET FICTIF');
  await expect(feuille(page).getByLabel('Vers (Crédit)').locator('option:checked')).toHaveText('COMPTE FICTIF');
  // Choisir à l'arrivée le compte de départ échange les deux : jamais identiques.
  await feuille(page).getByLabel('Vers (Crédit)').selectOption({ label: 'LIVRET FICTIF' });
  await expect(feuille(page).getByLabel('Depuis (Débit)').locator('option:checked')).toHaveText('COMPTE FICTIF');
  await taper(page, '1000');
  const apercu = feuille(page).getByRole('list', { name: 'Aperçu du solde' });
  await expect(apercu).toContainText(/500,00\s€\s→\s490,00\s€/);
  await expect(apercu).toContainText(/25,00\s€\s→\s35,00\s€/);
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByRole('status')).toHaveText('Virement enregistré');
});

test('type non modifiable pour un compte qui a des virements (message clair), libre sinon', async ({ page }) => {
  await page.goto(APP);
  await compte(page, 'Compte fictif', { solde: '500' });
  await compte(page, 'Livret fictif', { type: 'Épargne' });
  await compte(page, 'Autre fictif');
  await virer(page, '1000', 'COMPTE FICTIF', 'LIVRET FICTIF');
  await solde(page, 'LIVRET FICTIF').click();
  await expect(page.getByText('Type non modifiable : ce compte a des virements.')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Tiers' })).toBeDisabled();
  await nav(page).getByRole('button', { name: 'Accueil' }).click();
  await solde(page, 'AUTRE FICTIF').click();
  await expect(page.getByRole('radio', { name: 'Tiers' })).toBeEnabled();
  await page.getByText('Tiers', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('region', { name: 'Tiers' })).toContainText('AUTRE FICTIF');
});

test('données de la version 0.1.4 (sans virement) relues sans perte, puis virement ajouté', async ({ page }) => {
  await page.goto(APP);
  await expect(page.getByRole('button', { name: 'Créer un compte' })).toBeVisible(); // base v1 créée
  // Enregistrements exactement au format de la 0.1.4.
  await page.evaluate(
    () =>
      new Promise<void>((ok, ko) => {
        const r = indexedDB.open('budget');
        r.onsuccess = () => {
          const tx = r.result.transaction(['comptes', 'categories', 'operations'], 'readwrite');
          const depart = '2026-01-01';
          tx.objectStore('comptes').put({ id: 'c1', nom: 'COMPTE ANCIEN', type: 'courant', soldeDepart: 100_00, dateDepart: depart, archive: false, principal: true });
          tx.objectStore('comptes').put({ id: 'c2', nom: 'LIVRET ANCIEN', type: 'epargne', soldeDepart: 0, dateDepart: depart, archive: false, principal: false });
          tx.objectStore('categories').put({ id: 'k1', nom: 'CATÉGORIE ANCIENNE', sens: 'debit', archive: false });
          tx.objectStore('operations').put({ id: 'o1', compteId: 'c1', categorieId: 'k1', date: depart, sens: 'debit', montant: 12_34, note: 'ancienne' });
          tx.oncomplete = () => {
            r.result.close();
            ok();
          };
          tx.onabort = () => ko(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(solde(page, 'COMPTE ANCIEN')).toContainText('87,66 €');
  await virer(page, '6000', 'COMPTE ANCIEN', 'LIVRET ANCIEN');
  await page.reload();
  await expect(solde(page, 'COMPTE ANCIEN')).toContainText('27,66 €');
  await expect(solde(page, 'LIVRET ANCIEN')).toContainText('60,00 €');
});
