// Aides communes aux parcours. Données FICTIVES uniquement.
import { type Page } from '@playwright/test';

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
