// Envoi A (0.4.0) : échéancier, validation des prélèvements, prévisionnel, pointage, mise à jour 0.3.0 → 0.4.0.
// Données FICTIVES ; date figée au mardi 10/11/2026 (heure de Paris) pour des résultats reproductibles.
import { expect, test, type Page } from '@playwright/test';
import { APP, capture, categorie, compte, demarrer, nav, recharger, solde } from './aides';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T10:00:00+01:00') });
});

async function nouvelleEcheance(page: Page, o: { nom: string; montant: string; date: string; cat?: string; fin?: 'Nombre'; restantes?: string }) {
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Échéancier' }).click();
  await page.getByRole('button', { name: 'Nouvelle échéance' }).click();
  await page.getByLabel('Libellé').fill(o.nom);
  await page.getByLabel(/^Catégorie/).selectOption({ label: o.cat ?? 'HABITAT FICTIF' });
  await page.getByLabel('Montant', { exact: true }).fill(o.montant);
  await page.getByLabel('Prochaine échéance').fill(o.date);
  if (o.fin) {
    await page.getByText(o.fin, { exact: true }).click();
    await page.getByLabel(/Échéances restantes/).fill(o.restantes ?? '1');
  }
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: 'Échéancier' })).toBeVisible();
}

const accueil = (page: Page) => nav(page).getByRole('button', { name: 'Accueil' }).click();

test('échéance due aujourd’hui : proposée, montant modifié, validée UNE fois ; suivante le mois prochain', async ({ page }) => {
  await demarrer(page);
  await compte(page, 'Compte fictif', { solde: '1000' });
  await categorie(page, 'Habitat fictif');
  await nouvelleEcheance(page, { nom: 'Loyer fictif', montant: '650', date: '2026-11-10' });
  await expect(page.getByRole('button', { name: /^LOYER FICTIF/ })).toContainText('prochaine le 10/11/2026');
  await capture(page, '040-1-echeancier');

  await accueil(page);
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('1 000,00 €'); // pas encore dans le solde
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('fin de mois : 350,00 €'); // seulement dans le prévisionnel
  await page.getByRole('button', { name: '1 échéance à valider' }).click();
  const carte = page.getByRole('region', { name: 'LOYER FICTIF' });
  await carte.getByLabel('Montant').fill('655,20');
  await capture(page, '040-2-a-valider');
  await carte.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Échéance validée' })).toBeVisible();
  await expect(page.getByText('Aucune échéance à valider.')).toBeVisible();

  await accueil(page);
  await expect(page.getByRole('button', { name: /échéance.* à valider/ })).toHaveCount(0);
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('344,80 €');
  await recharger(page);
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('344,80 €'); // une seule fois, conservé
  await expect(page.getByRole('button', { name: /échéance.* à valider/ })).toHaveCount(0);
  await nav(page).getByRole('button', { name: 'Carnet' }).click();
  await expect(page.locator('main')).toContainText('LOYER FICTIF'); // note de l'opération
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Échéancier' }).click();
  await expect(page.getByRole('button', { name: /^LOYER FICTIF/ })).toContainText('prochaine le 10/12/2026');
});

test('ignorer ; retards proposés dans l’ordre ; dernière échéance terminée', async ({ page }) => {
  await demarrer(page);
  await compte(page, 'Compte fictif', { solde: '100' });
  await categorie(page, 'Habitat fictif');
  // Deux échéances en retard (10/09 et 10/10) et celle du jour, sur 3 échéances au total.
  await nouvelleEcheance(page, { nom: 'Abonnement fictif', montant: '10', date: '2026-09-10', fin: 'Nombre', restantes: '3' });
  await accueil(page);
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('fin de mois : 70,00 €'); // 3 retards comptés aujourd'hui
  await page.getByRole('button', { name: '1 échéance à valider' }).click();
  const carte = page.getByRole('region', { name: 'ABONNEMENT FICTIF' });
  await expect(carte).toContainText('prévue le 10/09/2026');
  await carte.getByRole('button', { name: 'Ignorer…' }).click();
  await carte.getByRole('button', { name: 'Ignorer', exact: true }).click();
  await expect(carte).toContainText('prévue le 10/10/2026');
  // Date antérieure au départ du compte (créé aujourd'hui) : refusée ; la date se corrige avant validation.
  await carte.getByRole('button', { name: 'Valider' }).click();
  await expect(carte.getByRole('alert')).toContainText('Date antérieure au départ du compte');
  await carte.getByLabel('Date').fill('2026-11-10');
  await carte.getByRole('button', { name: 'Valider' }).click();
  await expect(carte).toContainText('prévue le 10/11/2026');
  await carte.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Aucune échéance à valider.')).toBeVisible();
  await accueil(page);
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('80,00 €'); // 1 ignorée, 2 validées
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Échéancier' }).click();
  await expect(page.getByText('Aucune échéance en cours.')).toBeVisible();
  await page.getByText('Arrêtées ou terminées (1)').click();
  await expect(page.getByRole('button', { name: /^ABONNEMENT FICTIF/ })).toContainText('Terminée');
});

test('prévisionnel : alerte si un compte courant passe sous zéro dans le mois (point bas)', async ({ page }) => {
  await demarrer(page);
  await compte(page, 'Compte fictif', { solde: '100' });
  await categorie(page, 'Habitat fictif');
  await categorie(page, 'Revenu fictif', true);
  await nouvelleEcheance(page, { nom: 'Prélèvement fictif', montant: '160', date: '2026-11-15' });
  await nouvelleEcheance(page, { nom: 'Revenu fictif', montant: '500', date: '2026-11-25', cat: 'REVENU FICTIF' });
  await accueil(page);
  // Le sens « Crédit » vient de la catégorie : 100 − 160 (15/11) = −60, puis + 500 (25/11) = 440.
  await expect(page.getByRole('alert')).toHaveText('COMPTE FICTIF : solde prévu négatif le 15/11/2026 (−60,00 €)');
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('fin de mois : 440,00 €');
  await page.clock.runFor(500); // horloge simulée : laisser finir l'animation d'entrée avant la capture
  await capture(page, '040-3-accueil-prevision');
});

test('pointage : rappel, écart corrigé en une touche (CORRECTION), tiers exclus, date affichée', async ({ page }) => {
  await demarrer(page);
  await compte(page, 'Compte fictif', { solde: '100' });
  await compte(page, 'Livret fictif', { type: 'Épargne', solde: '500' });
  await compte(page, 'Ami fictif', { type: 'Tiers' });
  await accueil(page);
  await page.getByRole('button', { name: 'Pointage de la semaine à faire' }).click();
  await expect(page.getByRole('region', { name: 'AMI FICTIF' })).toHaveCount(0);
  await page.getByLabel('Solde bancaire COMPTE FICTIF').fill('87,66');
  await expect(page.getByRole('region', { name: 'COMPTE FICTIF' })).toContainText('Écart : −12,34 €');
  await page.getByLabel('Solde bancaire LIVRET FICTIF').fill('500');
  await expect(page.getByRole('region', { name: 'LIVRET FICTIF' })).toContainText('Aucun écart.');
  await page.getByRole('button', { name: 'Valider le pointage' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Pointage enregistré : 1 correction' })).toBeVisible();
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('87,66 €');
  await expect(solde(page, 'LIVRET FICTIF')).toContainText('500,00 €');
  await expect(page.getByRole('button', { name: 'Pointage de la semaine à faire' })).toHaveCount(0);
  await recharger(page);
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('87,66 €');
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await expect(page.getByRole('button', { name: /^Pointage/ })).toContainText('10/11/2026');
  await page.getByRole('button', { name: 'Catégories' }).click();
  await expect(page.getByRole('button', { name: /^CORRECTION/ })).toBeVisible();
});

test('mise à jour d’une base 0.3.0 (v2) : copie interne faite AVANT la migration, base passée en v3', async ({ page }) => {
  await page.goto(`${APP}manifest.webmanifest`); // même origine, sans lancer l'app
  await page.evaluate(
    () =>
      new Promise<void>((ok, ko) => {
        const r = indexedDB.open('budget', 2);
        r.onupgradeneeded = () => {
          for (const m of ['comptes', 'categories', 'operations']) r.result.createObjectStore(m, { keyPath: 'id' });
          for (const m of ['meta', 'coffre']) r.result.createObjectStore(m, { keyPath: 'cle' });
          r.result.createObjectStore('copies', { keyPath: 'id' });
          r.transaction!.objectStore('operations').put({ id: 'o1', iv: new Uint8Array(12), d: new Uint8Array(20) }); // enregistrement chiffré fictif
        };
        r.onsuccess = () => (r.result.close(), ok());
        r.onerror = () => ko(r.error);
      }),
  );
  await page.goto(APP);
  const etat = await page.evaluate(
    () =>
      new Promise<{ version: number; copies: { donnees: { operations: { id: string }[]; echeances: unknown[] } }[] }>((ok) => {
        const attendre = () => {
          const r = indexedDB.open('budget');
          r.onsuccess = () => {
            const db = r.result;
            if (db.version < 3) {
              db.close();
              setTimeout(attendre, 100);
              return;
            }
            const g = db.transaction('copies').objectStore('copies').getAll();
            g.onsuccess = () => (db.close(), ok({ version: db.version, copies: g.result }));
          };
        };
        attendre();
      }),
  );
  expect(etat.version).toBe(3);
  expect(etat.copies).toHaveLength(1);
  expect(etat.copies[0]!.donnees.operations.map((o) => o.id)).toEqual(['o1']);
  expect(etat.copies[0]!.donnees.echeances).toEqual([]);
});
