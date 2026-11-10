// Étape 3 : sauvegarde externe chiffrée et restauration. Test obligatoire : sauvegarder → effacer → restaurer → identiques.
// Données et codes FICTIFS.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { APP, capture, categorie, CODE, compte, demarrer, deverrouiller, feuille, nav, plus, saisirCode, journal, taper, virer } from './aides';

const dossier = 'test-results';

// Parcours longs (plusieurs dérivations PBKDF2 à 600 000 itérations) : marge si les tests tournent en parallèle.
test.describe.configure({ timeout: 90_000 });

/** Sauvegarde depuis Réglages ; renvoie le chemin du fichier téléchargé (repli quand le partage iOS n'existe pas). */
async function sauvegarder(page: Page, nom: string, photo = false): Promise<string> {
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: /^Sauvegarde/ }).click();
  await expect(page.getByRole('button', { name: 'Sauvegarder' })).toBeEnabled();
  if (photo) await capture(page, '6-sauvegarde');
  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sauvegarder' }).click();
  const d = await telechargement;
  expect(d.suggestedFilename()).toMatch(/^budget-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
  const chemin = `${dossier}/${nom}.json`;
  await d.saveAs(chemin);
  await expect(page.getByText('Sauvegarde créée.')).toBeVisible();
  return chemin;
}

/** Efface toute la base réelle (comme une réinstallation), puis recharge. */
async function effacer(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((ok, ko) => {
        const r = indexedDB.deleteDatabase('budget');
        r.onsuccess = () => ok();
        r.onerror = () => ko(r.error);
      }),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Choisissez votre code' })).toBeVisible();
}

/** Contenu visible de l'accueil et du carnet du mois. */
async function etat(page: Page): Promise<string> {
  await nav(page).getByRole('button', { name: 'Accueil' }).click();
  const accueil = await page.locator('main').innerText();
  await nav(page).getByRole('button', { name: 'Carnet' }).click();
  const carnet = await page.locator('main').innerText();
  await nav(page).getByRole('button', { name: 'Accueil' }).click();
  return `${accueil}\n---\n${carnet}`;
}

async function remplir(page: Page) {
  await compte(page, 'Compte fictif', { solde: '500' });
  await compte(page, 'Livret fictif', { type: 'Épargne', solde: '1000' });
  await compte(page, 'Ami fictif', { type: 'Tiers' });
  await categorie(page, 'Courses fictives');
  await plus(page).click();
  await taper(page, '2340');
  await feuille(page).getByText('COURSES FICTIVES', { exact: true }).click();
  await feuille(page).getByLabel('Note (facultative)').fill('Note fictive');
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
  await virer(page, '10000', 'COMPTE FICTIF', 'AMI FICTIF');
  await virer(page, '5000', 'LIVRET FICTIF', 'COMPTE FICTIF');
}

test('sauvegarder → effacer → restaurer → données identiques (test obligatoire)', async ({ page }) => {
  const console_ = journal(page);
  await demarrer(page);
  await remplir(page);
  await expect(page.getByText('Aucune sauvegarde externe.')).toBeVisible(); // rappel
  const avant = await etat(page);

  const chemin = await sauvegarder(page, 'sauvegarde-1', true);
  const contenu = readFileSync(chemin, 'utf8');
  expect(contenu).not.toMatch(/FICTI|COURSES|Note/i); // rien en clair dans le fichier
  await nav(page).getByRole('button', { name: 'Accueil' }).click();
  await expect(page.getByText('Aucune sauvegarde externe.')).toHaveCount(0); // rappel levé

  await effacer(page);
  await page.getByRole('button', { name: 'Restaurer une sauvegarde…' }).click();
  await page.locator('input[type=file]').setInputFiles(chemin);
  await expect(page.getByRole('heading', { name: 'Code de cette sauvegarde' })).toBeVisible();
  await saisirCode(page, '11111111');
  await expect(page.getByText('Code incorrect.')).toBeVisible();
  await saisirCode(page, CODE);
  const apercu = page.getByRole('group', { name: 'Aperçu de la sauvegarde' });
  await expect(apercu).toContainText('5 opérations · 3 comptes · 1 catégorie');
  await expect(apercu).toContainText('Ces données seront installées sur cet appareil.');
  await capture(page, '7-restauration-apercu');
  await apercu.getByRole('button', { name: 'Restaurer' }).click();
  await expect(nav(page)).toBeVisible();

  expect(await etat(page)).toBe(avant);
  await page.reload();
  await deverrouiller(page);
  expect(await etat(page)).toBe(avant);
  expect(console_.filter((l) => l.startsWith('ERREUR') || l.includes(CODE))).toEqual([]);
});

test('Réglages : fichier étranger ou démo refusé ; restauration avec copie de secours ; installation neuve par le code de secours', async ({ page }) => {
  const secours = await demarrer(page);
  await compte(page, 'Compte fictif', { solde: '100' });
  const chemin = await sauvegarder(page, 'sauvegarde-2');
  await compte(page, 'Deuxieme fictif');

  // Refus clairs, rien de modifié.
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: /^Sauvegarde/ }).click();
  await page.getByRole('button', { name: 'Restaurer une sauvegarde…' }).click();
  const champ = page.locator('input[type=file]');
  await champ.setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(page.getByText('Fichier non reconnu : ce n’est pas une sauvegarde BUDGET valide.')).toBeVisible();
  const demo = `${dossier}/sauvegarde-demo.json`;
  writeFileSync(demo, readFileSync(chemin, 'utf8').replace('"demo":false', '"demo":true'));
  await champ.setInputFiles(demo);
  await expect(page.getByText('Ce fichier vient de la démo : il ne peut pas être restauré dans l’app réelle.')).toBeVisible();

  // Restauration (code de secours du fichier accepté aussi), copie de secours faite avant.
  await champ.setInputFiles(chemin);
  await page.getByRole('button', { name: 'Utiliser le code de secours' }).click();
  await page.getByLabel('Code de secours (24 caractères)').fill(secours);
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Les données actuelles seront remplacées par celles-ci.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Restaurer', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Restauration terminée' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^COMPTE FICTIF/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^DEUXIEME FICTIF/ })).toHaveCount(0);

  // La copie de secours rend l'état d'avant.
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: /^Sauvegarde/ }).click();
  await page.getByRole('listitem').first().getByRole('button').click();
  await expect(page.getByText(/^Copie interne du/)).toBeVisible();
  await page.getByRole('button', { name: 'Restaurer', exact: true }).click();
  await expect(page.getByRole('button', { name: /^DEUXIEME FICTIF/ })).toBeVisible();

  // Installation neuve, code oublié : code de secours du fichier, puis nouveau code.
  await effacer(page);
  await page.getByRole('button', { name: 'Restaurer une sauvegarde…' }).click();
  await page.locator('input[type=file]').setInputFiles(chemin);
  await page.getByRole('button', { name: 'Utiliser le code de secours' }).click();
  await page.getByLabel('Code de secours (24 caractères)').fill(secours);
  await page.getByRole('button', { name: 'Valider' }).click();
  await page.getByRole('button', { name: 'Restaurer', exact: true }).click();
  await expect(page.getByText('Code de secours accepté. Choisissez votre nouveau code.')).toBeVisible();
  await saisirCode(page, '97531864');
  await saisirCode(page, '97531864');
  await expect(page.getByRole('button', { name: /^COMPTE FICTIF/ })).toBeVisible();
  await page.goto(APP);
  await deverrouiller(page, '97531864');
});
