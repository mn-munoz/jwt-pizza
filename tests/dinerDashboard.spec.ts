import { test, expect } from './testSetup';
import { basicInit, pastOrders, users } from './mocks';
import { login } from './helpers';

test.beforeEach(async ({ page }) => {
  await basicInit(page);
});

test('diner dashboard with order history', async ({ page }) => {
  await login(page, users.diner);
  await page.getByRole('link', { name: users.diner.initials }).click();

  await expect(page.getByText('Your pizza kitchen')).toBeVisible();
  await expect(page.getByRole('main')).toContainText(users.diner.name);
  await expect(page.getByRole('main')).toContainText(users.diner.email);
  await expect(page.getByRole('main')).toContainText('diner');
  await expect(page.getByText('Here is your history of all the good times.')).toBeVisible();
  await expect(page.getByRole('cell', { name: pastOrders[0].id, exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '0.008 ₿' })).toBeVisible();
});

test('diner dashboard without orders', async ({ page }) => {
  await login(page, users.franchisee);
  await page.getByRole('link', { name: users.franchisee.initials, exact: true }).click();

  await expect(page.getByRole('main')).toContainText('Franchisee on 2');
  await expect(page.getByText('How have you lived this long without having a pizza?')).toBeVisible();
  await page.getByRole('link', { name: 'Buy one' }).click();
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
});
