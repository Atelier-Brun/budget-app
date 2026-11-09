import { expect, test } from '@playwright/test';

test("l'app démarre et affiche son nom et sa version", async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('BUDGET');
  await expect(page.getByRole('heading', { name: 'BUDGET' })).toBeVisible();
  await expect(page.getByText(/^Version \d+\.\d+\.\d+$/)).toBeVisible();
});
