import { expect, test } from '@playwright/test';
import { demarrer } from './aides';

test("l'app démarre : nom, barre de navigation, version dans Réglages", async ({ page }) => {
  await demarrer(page);
  await expect(page).toHaveTitle('BUDGET');
  await expect(page.getByRole('heading', { name: 'BUDGET' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('button', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('button', { name: 'Réglages' }).click();
  await expect(nav.getByRole('button', { name: 'Réglages' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText(/^\d+\.\d+\.\d+$/)).toBeVisible();
});
