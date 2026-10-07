import { Page } from '@playwright/test';
import { test, expect } from './testSetup';
import { basicInit, stores, users } from './mocks';
import { fillLoginForm, login } from './helpers';

async function orderPizzas(page: Page, pizzas: string[]) {
  await page.getByRole('button', { name: 'Order now' }).click();
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption(stores.lehi.id);
  for (const pizza of pizzas) {
    await page.getByRole('link', { name: `Image Description ${pizza}` }).click();
  }
  await expect(page.locator('form')).toContainText(`Selected pizzas: ${pizzas.length}`);
  await page.getByRole('button', { name: 'Checkout' }).click();
}

test.beforeEach(async ({ page }) => {
  await basicInit(page);
});

test('purchase with login', async ({ page }) => {
  await orderPizzas(page, ['Veggie', 'Pepperoni']);
  // Not logged in yet, so checkout asks for a login first
  await fillLoginForm(page, users.diner);

  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page.getByText('0.008')).toBeVisible();

  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.locator('#hs-jwt-modal')).toContainText('valid');
  await expect(page.locator('#hs-jwt-modal')).toContainText('Pizza Vendor');
});

test('verify an invalid pizza', async ({ page }) => {
  // Opening the delivery page directly leaves it without a real order JWT
  await page.goto('/delivery');
  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page.locator('#hs-jwt-modal')).toContainText('invalid');
  await expect(page.locator('#hs-jwt-modal')).toContainText('Looks like you have a bad pizza!');
});

test('cancel payment keeps the order', async ({ page }) => {
  await login(page, users.diner);
  await orderPizzas(page, ['Veggie']);

  await expect(page.getByRole('main')).toContainText('Send me that pizza right now!');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await expect(page.locator('form')).toContainText('Selected pizzas: 1');
});
