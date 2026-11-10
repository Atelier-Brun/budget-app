// Aides communes aux parcours. Données FICTIVES uniquement.
import { expect, type Page } from '@playwright/test';

export const APP = '/budget-app/';
export const DEMO = '/budget-app/demo/';

export const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });
export const plus = (page: Page) => nav(page).getByRole('button', { name: 'Saisir une opération' });
export const feuille = (page: Page) => page.getByRole('dialog');

/** Tape les chiffres sur le pavé intégré (« ⌫ » = Effacer). */
export async function taper(page: Page, touches: string) {
  const pave = feuille(page).getByRole('group', { name: 'Pavé numérique' });
  for (const t of touches) await pave.getByRole('button', { name: t === '⌫' ? 'Effacer' : t, exact: true }).click();
}

export async function compte(page: Page, nom: string, opts: { type?: string; solde?: string } = {}) {
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Comptes' }).click();
  await page.getByRole('button', { name: 'Nouveau compte' }).click();
  await page.getByLabel('Nom').fill(nom);
  if (opts.type) await page.getByText(opts.type, { exact: true }).click();
  if (opts.solde) await page.getByLabel('Montant du solde de départ').fill(opts.solde);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
}

export async function categorie(page: Page, nom: string, credit = false) {
  await nav(page).getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: 'Catégories' }).click();
  await page.getByRole('button', { name: 'Nouvelle catégorie' }).click();
  await page.getByLabel('Nom').fill(nom);
  if (credit) await page.getByText('Crédit', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
}

/** Virement : montant au pavé → compte de départ → compte d'arrivée → Valider. */
export async function virer(page: Page, touches: string, depuis: string, vers: string, note = '') {
  await plus(page).click();
  await feuille(page).getByText('Virement', { exact: true }).click();
  await taper(page, touches);
  await feuille(page).getByLabel('Depuis (Débit)').selectOption({ label: depuis });
  await feuille(page).getByLabel('Vers (Crédit)').selectOption({ label: vers });
  if (note) await feuille(page).getByLabel('Note (facultative)').fill(note);
  await feuille(page).getByRole('button', { name: 'Valider' }).click();
}

/** Solde affiché à l'accueil pour un compte (nom en MAJUSCULES). */
export const solde = (page: Page, nom: string) => page.getByRole('button', { name: new RegExp(`^${nom}`) });

// ——— Accès (0.3.0) : code fictif utilisé par tous les parcours ———
export const CODE = '48021573';

/** Tape un code au clavier (le pavé intégré accepte aussi le clavier physique) puis Entrée. */
export async function saisirCode(page: Page, code: string) {
  await page.keyboard.type(code);
  await page.keyboard.press('Enter');
}

/** Premier lancement : code choisi et confirmé, code de secours noté puis vérifié. Renvoie le code de secours. */
export async function creerCode(page: Page, code = CODE): Promise<string> {
  await expect(page.getByRole('heading', { name: 'Choisissez votre code' })).toBeVisible();
  await saisirCode(page, code);
  await expect(page.getByRole('heading', { name: 'Confirmez votre code' })).toBeVisible();
  await saisirCode(page, code);
  const secours = (await page.getByLabel('Code de secours', { exact: true }).textContent())!;
  await page.getByRole('button', { name: 'Je l’ai noté' }).click();
  const n = Number((await page.getByText(/Recopiez le groupe n° \d/).textContent())!.match(/\d/)![0]);
  await page.getByLabel(/Recopiez le groupe/).fill(secours.split('-')[n - 1]!);
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(nav(page)).toBeVisible();
  return secours;
}

export async function demarrer(page: Page, url = APP): Promise<string> {
  await page.goto(url);
  return creerCode(page);
}

export async function deverrouiller(page: Page, code = CODE) {
  await expect(page.getByRole('heading', { name: 'Saisissez votre code' })).toBeVisible();
  await saisirCode(page, code);
  await expect(nav(page)).toBeVisible();
}

export async function recharger(page: Page) {
  await page.reload();
  await deverrouiller(page);
}

// ——— Captures et console (0.3.0) ———
/** Capture d'écran après la fin des animations d'entrée (≤ 200 ms). */
export async function capture(page: Page, nom: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/captures/budget-${nom}.png` });
}

/** Toute la console et les erreurs de la page : rien ne doit y apparaître (ni code, ni erreur). */
export function journal(page: Page): string[] {
  const l: string[] = [];
  page.on('console', (m) => l.push(m.text()));
  page.on('pageerror', (e) => l.push(`ERREUR ${e.message}`));
  return l;
}
