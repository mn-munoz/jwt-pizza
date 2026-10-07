import { test, expect } from './testSetup';
import { basicInit, franchises, stores, users } from './mocks';
import { clickCloseOnRow, expectRequest, login, openAdminDashboard } from './helpers';

test.describe('admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await basicInit(page);
    await login(page, users.admin);
  });

  test('create franchise', async ({ page }) => {
    await openAdminDashboard(page);
    await page.getByRole('button', { name: 'Add Franchise' }).click();

    await expect(page.getByText('Want to create franchise?')).toBeVisible();
    await page.getByPlaceholder('franchise name').fill('pizzaPocket');
    await page.getByPlaceholder('franchisee admin email').fill(users.franchisee.email);
    const request = await expectRequest(page, 'POST', '/api/franchise', () => page.getByRole('button', { name: 'Create' }).click());

    expect(request.postDataJSON()).toMatchObject({ name: 'pizzaPocket', admins: [{ email: users.franchisee.email }] });
    await expect(page.getByRole('cell', { name: 'pizzaPocket' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'pizzaPocket' })).toContainText(users.franchisee.name);
  });

  test('close franchise', async ({ page }) => {
    const { pizzaCorp, lotaPizza } = franchises;
    await openAdminDashboard(page);
    await clickCloseOnRow(page, pizzaCorp.name);

    await expect(page.getByText('Sorry to see you go')).toBeVisible();
    await expect(page.getByRole('main')).toContainText(`Are you sure you want to close the ${pizzaCorp.name} franchise?`);
    await expectRequest(page, 'DELETE', `/api/franchise/${pizzaCorp.id}`, () => page.getByRole('button', { name: 'Close' }).click());

    await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
    await expect(page.getByRole('cell', { name: lotaPizza.name })).toBeVisible();
    await expect(page.getByRole('cell', { name: pizzaCorp.name })).not.toBeVisible();
    await expect(page.getByRole('cell', { name: stores.spanishFork.name })).not.toBeVisible();
  });

  test('close store', async ({ page }) => {
    const { lotaPizza } = franchises;
    const { lehi, springville } = stores;
    await openAdminDashboard(page);
    await clickCloseOnRow(page, lehi.name);

    await expect(page.getByText('Sorry to see you go')).toBeVisible();
    await expect(page.getByRole('main')).toContainText(`Are you sure you want to close the ${lotaPizza.name} store ${lehi.name} ?`);
    await expectRequest(page, 'DELETE', `/api/franchise/${lotaPizza.id}/store/${lehi.id}`, () => page.getByRole('button', { name: 'Close' }).click());

    await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
    await expect(page.getByRole('cell', { name: springville.name })).toBeVisible();
    await expect(page.getByRole('cell', { name: lehi.name })).not.toBeVisible();
    await expect(page.getByRole('cell', { name: lotaPizza.name })).toBeVisible();
  });

  test('page through franchises', async ({ page }) => {
    // Replace the franchise list mock with one that has two pages
    await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
      const firstPage = new URL(route.request().url()).searchParams.get('page') === '0';
      const franchiseRes = firstPage
        ? { franchises: Object.values(franchises), more: true }
        : { franchises: [{ id: '5', name: 'SliceSquad', stores: [] }], more: false };
      await route.fulfill({ json: franchiseRes });
    });
    await openAdminDashboard(page);

    await expect(page.getByRole('cell', { name: franchises.lotaPizza.name })).toBeVisible();
    await expect(page.getByRole('button', { name: '«' })).toBeDisabled();
    await page.getByRole('button', { name: '»' }).click();

    await expect(page.getByRole('cell', { name: 'SliceSquad' })).toBeVisible();
    await expect(page.getByRole('cell', { name: franchises.lotaPizza.name })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '»' })).toBeDisabled();
    await page.getByRole('button', { name: '«' }).click();

    await expect(page.getByRole('cell', { name: franchises.lotaPizza.name })).toBeVisible();
  });
});

test('admin dashboard is hidden from diners', async ({ page }) => {
  await basicInit(page);
  await login(page, users.diner);

  await expect(page.getByRole('link', { name: 'Admin' })).not.toBeVisible();
  await page.goto('/admin-dashboard');
  await expect(page.getByText('Oops')).toBeVisible();
  await expect(page.getByText("Mama Ricci's kitchen")).not.toBeVisible();
});
