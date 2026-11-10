// Le dernier bouton de chaque écran à contenu long doit être entièrement visible au-dessus de la barre du bas
// (zone sûre comprise) et touchable, une fois la page défilée jusqu'en bas. Données FICTIVES.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { capture, categorie, compte, demarrer, nav } from './aides';

test.describe.configure({ timeout: 120_000 });

/** Défile tout en bas puis vérifie : bouton au-dessus de la barre, et c'est bien lui qui reçoit le toucher. */
async function dernierBoutonAccessible(page: Page, bouton: Locator) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(250);
  const b = (await bouton.boundingBox())!;
  const barre = (await nav(page).boundingBox())!;
  // Le bouton « + » dépasse au-dessus de la barre : c'est lui la limite haute réelle.
  const plus = (await nav(page).getByRole('button', { name: 'Saisir une opération' }).boundingBox())!;
  const limite = Math.min(barre.y, plus.y);
  const ecran = page.viewportSize()!;
  console.log(`marge sous « ${(await bouton.textContent())!.trim()} » : ${Math.round(limite - (b.y + b.height))} px`);
  expect(b.y + b.height, 'bouton caché par la barre ou le « + »').toBeLessThanOrEqual(limite - 8);
  expect(b.y + b.height).toBeLessThanOrEqual(ecran.height);
  const touche = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button, label')?.textContent?.trim() ?? '', {
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
  });
  expect(touche).toBe((await bouton.textContent())!.trim());
}

test('écrans longs : dernier bouton visible et touchable au-dessus de la barre', async ({ page }) => {
  await demarrer(page);
  for (const [nom, type] of [['Courant un', ''], ['Courant deux', ''], ['Livret un', 'Épargne'], ['Livret deux', 'Épargne'], ['Livret trois', 'Épargne']] as const)
    await compte(page, `${nom} fictif`, type ? { type } : {});
  await categorie(page, 'Habitat fictif');
  const reglages = () => nav(page).getByRole('button', { name: 'Réglages' }).click();

  // Accueil (5 comptes) puis Pointage
  await nav(page).getByRole('button', { name: 'Accueil' }).click();
  await dernierBoutonAccessible(page, page.getByRole('button', { name: /^LIVRET TROIS FICTIF/ }));
  await page.evaluate(() => window.scrollTo(0, 0));
  await reglages();
  await page.getByRole('button', { name: /^Pointage/ }).click();
  await dernierBoutonAccessible(page, page.getByRole('button', { name: 'Valider le pointage' }));
  await capture(page, '040-4-pointage');

  // Fiche échéance (formulaire long, fin par nombre + dernière différente)
  await reglages();
  await page.getByRole('button', { name: 'Échéancier' }).click();
  await page.getByRole('button', { name: 'Nouvelle échéance' }).click();
  await page.getByText('Nombre', { exact: true }).click();
  await page.getByText('Dernière échéance d’un montant différent').click();
  await dernierBoutonAccessible(page, page.getByRole('button', { name: 'Enregistrer' }));

  // Réglages, Sauvegarde, fiche compte
  await reglages();
  await dernierBoutonAccessible(page, page.getByRole('button', { name: 'Verrouiller maintenant' }));
  await page.getByRole('button', { name: /^Sauvegarde/ }).click();
  await dernierBoutonAccessible(page, page.getByRole('button', { name: 'Restaurer une sauvegarde…' }));
  await reglages();
  await page.getByRole('button', { name: 'Comptes' }).click();
  await page.getByRole('button', { name: /^COURANT UN FICTIF/ }).click();
  await dernierBoutonAccessible(page, page.getByRole('button', { name: /Archiver ce compte/ }));
});
