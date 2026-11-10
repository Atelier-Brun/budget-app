// Stockage (1d) dans le vrai moteur WebKit : création, séparation app/démo, conservation, versions. Données FICTIVES.
import { expect, test, type Page } from '@playwright/test';
import { APP, creerCode, DEMO } from './aides';

/** Attend que la base existe, puis renvoie { version, magasins }. */
async function decrire(page: Page, nom: string) {
  await expect
    .poll(() => page.evaluate(async (n) => (await indexedDB.databases()).some((d) => d.name === n), nom))
    .toBe(true);
  return page.evaluate(
    (n) =>
      new Promise<{ version: number; magasins: string[] }>((ok) => {
        const r = indexedDB.open(n);
        r.onsuccess = () => {
          const db = r.result;
          ok({ version: db.version, magasins: [...db.objectStoreNames].sort() });
          db.close();
        };
      }),
    nom,
  );
}

/** Écrit (ou lit si `valeur` est absente) dans le magasin comptes, par l'API brute. */
function comptes(page: Page, nom: string, valeur?: object) {
  return page.evaluate(
    ([n, v]) =>
      new Promise<unknown[]>((ok, ko) => {
        const r = indexedDB.open(n as string);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('comptes', v ? 'readwrite' : 'readonly');
          const lecture = v ? null : tx.objectStore('comptes').getAll();
          if (v) tx.objectStore('comptes').put(v);
          tx.oncomplete = () => {
            db.close();
            ok(lecture ? lecture.result : []);
          };
          tx.onabort = () => ko(tx.error);
        };
      }),
    [nom, valeur] as const,
  );
}

const FICTIF = { id: 'id-fictif-1', nom: 'COMPTE FICTIF', soldeDepart: 12_345, dateDepart: '2026-11-10' };

test('l’app crée sa base v3 ; la démo a la sienne et ne touche pas à la base réelle', async ({ page }) => {
  await page.goto(APP);
  expect(await decrire(page, 'budget')).toEqual({
    version: 3,
    magasins: ['categories', 'coffre', 'comptes', 'copies', 'echeances', 'meta', 'operations'],
  });
  await comptes(page, 'budget', FICTIF);

  await page.goto(DEMO);
  await creerCode(page);
  expect((await decrire(page, 'budget-demo')).version).toBe(3);
  await expect(page.getByRole('button', { name: /^COMPTE COURANT/ })).toBeVisible(); // démo remplie
  expect(await comptes(page, 'budget-demo')).not.toContainEqual(FICTIF);
  expect(await comptes(page, 'budget')).toEqual([FICTIF]); // base réelle intacte
});

test('les données sont conservées après rechargement', async ({ page }) => {
  await page.goto(APP);
  await decrire(page, 'budget');
  await comptes(page, 'budget', FICTIF);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'BUDGET' })).toBeVisible();
  expect(await comptes(page, 'budget')).toEqual([FICTIF]);
});

test('version plus récente ailleurs : l’app se retire, puis refuse sans rien effacer', async ({ page }) => {
  await page.goto(APP);
  await decrire(page, 'budget');
  await comptes(page, 'budget', FICTIF);

  // Une « version future » ouvre la base en v99 : l'app doit fermer sa connexion et prévenir.
  await page.evaluate(
    () =>
      new Promise<void>((ok) => {
        const r = indexedDB.open('budget', 99);
        r.onsuccess = () => {
          r.result.close();
          ok();
        };
      }),
  );
  await expect(page.getByRole('alert')).toHaveText(/mis à jour dans une autre fenêtre/);

  await page.reload();
  await expect(page.getByRole('alert')).toHaveText(/version plus récente/);
  expect(await comptes(page, 'budget')).toEqual([FICTIF]);
});
