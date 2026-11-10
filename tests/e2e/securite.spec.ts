// Étape 3 : code, code de secours, verrouillage, chiffrement au repos. Données et codes FICTIFS.
import { expect, test, type Page } from '@playwright/test';
import { APP, capture, CODE, compte, demarrer, deverrouiller, journal, nav, saisirCode, solde } from './aides';

/** Lecture brute (sans clé) d'un magasin : ce que verrait quelqu'un qui copie la base. */
const brut = (page: Page, magasin: string) =>
  page.evaluate(
    (m) =>
      new Promise<{ cles: string; texte: string; iterations?: number; echecs?: number; cle?: string }[]>((ok) => {
        const r = indexedDB.open('budget');
        r.onsuccess = () => {
          const g = r.result.transaction(m).objectStore(m).getAll();
          g.onsuccess = () => {
            r.result.close();
            ok(
              g.result.map((x: Record<string, unknown>) => ({
                cles: Object.keys(x).sort().join(),
                texte: x['d'] instanceof Uint8Array ? new TextDecoder().decode(x['d']) : JSON.stringify(x),
                iterations: x['iterations'] as number,
                echecs: x['echecs'] as number,
                cle: x['cle'] as string,
              })),
            );
          };
        };
      }),
    magasin,
  );

const echecs = async (page: Page) => (await brut(page, 'coffre')).find((x) => x.cle === 'essais')?.echecs ?? 0;

const fond = (page: Page, visible: boolean) =>
  page.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { value: v ? 'visible' : 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);

test('création : solidité, confirmation, code de secours vérifié ; données chiffrées au repos ; rien dans la console', async ({ page }) => {
  const console_ = journal(page);
  await page.goto(APP);
  await expect(page.getByRole('heading', { name: 'Choisissez votre code' })).toBeVisible();
  await page.keyboard.type('123456');
  await expect(page.getByText('Solidité : Faible : 8 chiffres ou plus conseillés')).toBeVisible();
  for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type(CODE);
  await expect(page.getByText('Solidité : Correct')).toBeVisible();
  await capture(page, '030-1-creation-code');
  await page.keyboard.press('Enter');
  await saisirCode(page, '99999999'); // confirmation différente
  await expect(page.getByText('Les deux codes sont différents. Recommencez.')).toBeVisible();
  await saisirCode(page, CODE);
  await saisirCode(page, CODE);

  const secours = (await page.getByLabel('Code de secours', { exact: true }).textContent())!;
  expect(secours).toMatch(/^([2-9A-HJ-NP-Z]{4}-){5}[2-9A-HJ-NP-Z]{4}$/);
  await capture(page, '030-2-code-secours');
  await page.getByRole('button', { name: 'Je l’ai noté' }).click();
  await page.getByLabel(/Recopiez le groupe/).fill('ZZZZ');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Groupe incorrect.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Revoir le code' }).click();
  await expect(page.getByLabel('Code de secours', { exact: true })).toHaveText(secours);
  await page.getByRole('button', { name: 'Je l’ai noté' }).click();
  const n = Number((await page.getByText(/Recopiez le groupe n° \d/).textContent())!.match(/\d/)![0]);
  await page.getByLabel(/Recopiez le groupe/).fill(secours.split('-')[n - 1]!.toLowerCase());
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(nav(page)).toBeVisible();

  await compte(page, 'Compte fictif', { solde: '123,45' });
  await nav(page).getByRole('button', { name: 'Accueil' }).click();
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('123,45 €');
  const comptes = await brut(page, 'comptes');
  expect(comptes.map((c) => c.cles)).toEqual(['d,id,iv']);
  expect(comptes[0]!.texte).not.toContain('FICTIF');
  expect((await brut(page, 'coffre')).find((c) => c.cle === 'coffre')!.iterations).toBe(600_000);
  const tout = console_.join('\n');
  expect(tout).not.toContain(CODE);
  for (const g of secours.split('-')) expect(tout).not.toContain(g);
  expect(tout).not.toContain('ERREUR');
});

test('verrouillage : bouton, arrière-plan (contenu masqué), 2 min sans geste ; erreurs puis délai conservé', async ({ page }) => {
  await page.clock.install();
  await demarrer(page);
  await compte(page, 'Compte fictif', { solde: '100' });

  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await capture(page, '030-5-reglages');
  await page.getByRole('button', { name: 'Verrouiller maintenant' }).click();
  await expect(page.getByRole('heading', { name: 'Saisissez votre code' })).toBeVisible();
  await expect(page.getByText('COMPTE FICTIF')).toHaveCount(0);
  await capture(page, '030-3-verrouillage');
  await deverrouiller(page);
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('100,00 €');

  // Passage en arrière-plan : verrouillée et masquée aussitôt.
  await fond(page, false);
  await expect(page.locator('.masque')).toBeVisible();
  await expect(page.getByText('COMPTE FICTIF')).toHaveCount(0);
  await fond(page, true);
  await expect(page.locator('.masque')).toHaveCount(0);
  await deverrouiller(page);

  // 2 minutes sans geste.
  await page.clock.fastForward('01:50');
  await expect(nav(page)).toBeVisible();
  await page.clock.fastForward('00:20');
  await expect(page.getByRole('heading', { name: 'Saisissez votre code' })).toBeVisible();

  // 3 erreurs sans délai, puis 30 s ; jamais d'effacement.
  for (let i = 1; i <= 4; i++) {
    await saisirCode(page, '11112222');
    await expect.poll(() => echecs(page)).toBe(i);
  }
  await expect(page.getByText('Trop d’erreurs. Nouvel essai possible dans 30 s.')).toBeVisible();
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeDisabled();
  await capture(page, '030-4-delai');
  await page.reload();
  await expect(page.getByText(/Nouvel essai possible dans/)).toBeVisible(); // le délai survit au rechargement
  await page.clock.fastForward('00:31');
  await expect(page.getByText(/Nouvel essai possible dans/)).toHaveCount(0);
  await deverrouiller(page);
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('100,00 €');
  expect(await echecs(page)).toBe(0);
});

test('changer le code (code actuel exigé) ; code oublié : code de secours puis nouveau code', async ({ page }) => {
  const secours = await demarrer(page);
  await compte(page, 'Compte fictif', { solde: '100' });

  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Changer le code' }).click();
  await saisirCode(page, '00000000'); // code actuel faux
  await saisirCode(page, '5566778899');
  await saisirCode(page, '5566778899');
  await expect(page.getByText('Code actuel incorrect.')).toBeVisible();
  await saisirCode(page, CODE);
  await saisirCode(page, '5566778899');
  await expect(page.getByText('Solidité : Solide')).toHaveCount(0); // écran de confirmation : pas d'indicateur
  await saisirCode(page, '5566778899');
  await expect(page.getByRole('status').filter({ hasText: 'Code modifié' })).toBeVisible();

  await page.getByRole('button', { name: 'Verrouiller maintenant' }).click();
  await saisirCode(page, CODE); // ancien code refusé
  await expect(page.getByText('Code incorrect.')).toBeVisible();
  await deverrouiller(page, '5566778899');

  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Verrouiller maintenant' }).click();
  await page.getByRole('button', { name: 'Code oublié ?' }).click();
  await page.getByLabel('Code de secours (24 caractères)').fill('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Code incorrect.')).toBeVisible();
  await page.getByLabel('Code de secours (24 caractères)').fill(secours.toLowerCase());
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Code de secours accepté. Choisissez votre nouveau code.')).toBeVisible();
  await saisirCode(page, '24681357');
  await saisirCode(page, '24681357');
  await expect(nav(page)).toBeVisible();
  await expect(solde(page, 'COMPTE FICTIF')).toContainText('100,00 €');
  await page.reload();
  await deverrouiller(page, '24681357');
});
