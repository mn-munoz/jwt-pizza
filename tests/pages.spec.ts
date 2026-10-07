import { test, expect } from './testSetup';
import { basicInit } from './mocks';

test.beforeEach(async ({ page }) => {
  await basicInit(page);
});

test('about and history pages', async ({ page }) => {
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page.getByText('The secret sauce')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Our employees' })).toBeVisible();

  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('Mama Rucci, my my')).toBeVisible();
});
