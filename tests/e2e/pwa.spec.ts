// Coquille PWA (1b) : CSP, anti-iframe, manifest, hors ligne, mise à jour, isolation de la démo.
// Tests sur la version compilée (servie par `vite preview`), jamais sur le serveur de développement.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const APP = '/budget-app/';
const DEMO = '/budget-app/demo/';

/** Collecte violations de CSP et erreurs de console dès le chargement. */
async function surveiller(page: Page): Promise<string[]> {
  const erreurs: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(m.text());
  });
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP : ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return erreurs;
}

/** Attend que le service worker contrôle la page et renvoie son adresse. */
async function swActif(page: Page): Promise<string> {
  return page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((ok) => navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true }));
    }
    return navigator.serviceWorker.controller?.scriptURL ?? '';
  });
}

test.describe.configure({ mode: 'serial' });

test('CSP stricte présente, aucune violation ni erreur de console', async ({ page }) => {
  const erreurs = await surveiller(page);
  await page.goto(APP);
  await expect(page.getByRole('heading', { name: 'BUDGET' })).toBeVisible();
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("style-src 'self'");
  expect(csp).toContain("object-src 'none'");
  await swActif(page);
  expect(erreurs).toEqual([]);
});

test("l'app ne s'affiche pas dans un cadre (anti-iframe)", async ({ page, baseURL }) => {
  await page.goto('about:blank');
  await page.setContent(`<iframe src="${new URL(APP, baseURL).href}"></iframe>`);
  const cadre = page.frameLocator('iframe');
  await expect(cadre.locator('#app')).toBeAttached();
  await page.waitForTimeout(500);
  await expect(cadre.getByRole('heading', { name: 'BUDGET' })).toHaveCount(0);
});

test('manifests distincts pour l’app et la démo', async ({ request }) => {
  const app = await (await request.get(`${APP}manifest.webmanifest`)).json();
  const demo = await (await request.get(`${DEMO}manifest.webmanifest`)).json();
  expect(app).toMatchObject({ id: APP, scope: APP, start_url: APP, name: 'BUDGET', display: 'standalone' });
  expect(demo).toMatchObject({ id: DEMO, scope: DEMO, start_url: DEMO, name: 'BUDGET DÉMO', display: 'standalone' });
});

test('fonctionne hors ligne après la première visite', async ({ page, context }) => {
  const erreurs = await surveiller(page);
  await page.goto(APP);
  expect(await swActif(page)).toMatch(/\/budget-app\/sw\.js$/);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'BUDGET' })).toBeVisible();
  await context.setOffline(false);
  expect(erreurs).toEqual([]);
});

test('bandeau « Nouvelle version disponible » puis rechargement sur action', async ({ page }) => {
  await page.goto(APP);
  await swActif(page);
  await expect(page.getByText('Nouvelle version disponible')).toHaveCount(0);
  // Simule une mise en ligne : sw.js change d'un octet.
  const chemin = 'dist/sw.js';
  const original = readFileSync(chemin, 'utf8');
  writeFileSync(chemin, `${original}\n// test ${Date.now()}`);
  try {
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect(page.getByText('Nouvelle version disponible')).toBeVisible();
    const rechargement = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Mettre à jour' }).click();
    await rechargement;
    await expect(page.getByText('Nouvelle version disponible')).toHaveCount(0);
  } finally {
    writeFileSync(chemin, original);
  }
});

test('démo isolée : bandeau, nom, service worker et caches séparés', async ({ page }) => {
  const erreurs = await surveiller(page);
  await page.goto(APP);
  await swActif(page);
  await page.goto(DEMO);
  await expect(page).toHaveTitle('BUDGET DÉMO');
  await expect(page.getByText('DÉMO – données fictives')).toBeVisible();
  // La démo finit contrôlée par son propre service worker, jamais par celui de l'app.
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ''))
    .toMatch(/\/budget-app\/demo\/sw\.js$/);
  // Première installation de la démo ≠ mise à jour : pas de bandeau.
  await page.waitForTimeout(300);
  await expect(page.getByText('Nouvelle version disponible')).toHaveCount(0);
  const caches_ = await page.evaluate(() => caches.keys());
  expect(caches_.some((n) => n.startsWith('budget-app-'))).toBe(true);
  expect(caches_.some((n) => n.startsWith('budget-demo-'))).toBe(true);
  // L'app principale n'affiche pas le bandeau démo.
  await page.goto(APP);
  await expect(page.getByText('DÉMO – données fictives')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});
