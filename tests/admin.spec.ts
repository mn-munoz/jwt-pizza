import { Page } from '@playwright/test';
import { test, expect } from './testSetup';
import { basicInit, franchises, stores, users } from './mocks';
import { clickCloseOnRow, expectRequest, login, openAdminDashboard } from './helpers';

const franchisesTableOf = (page: Page) => page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Franchisee' }) });
const usersTableOf = (page: Page) => page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Email' }) });

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

  test('list users', async ({ page }) => {
    const request = page.waitForRequest((req) => req.method() === 'GET' && new URL(req.url()).pathname === '/api/user');
    await openAdminDashboard(page);
    expect(new URL((await request).url()).searchParams.get('name')).toBe('*');

    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    const usersTable = usersTableOf(page);
    await expect(usersTable.getByRole('columnheader')).toHaveText(['Name', 'Email', 'Role', 'Action']);

    for (const user of Object.values(users)) {
      const row = usersTable.getByRole('row').filter({ hasText: user.email });
      await expect(row.getByRole('cell')).toHaveText([user.name, user.email, user.roles.map((r) => r.role).join(', '), 'Delete']);
    }
    await expect(usersTable.locator('tbody tr')).toHaveCount(Object.keys(users).length);
  });

  test('delete user', async ({ page }) => {
    const { diner } = users;
    await openAdminDashboard(page);
    const usersTable = usersTableOf(page);
    await expect(usersTable.getByRole('row').filter({ hasText: diner.email })).toBeVisible();

    await usersTable.getByRole('row').filter({ hasText: diner.email }).getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Delete user')).toBeVisible();
    await expect(page.getByRole('main')).toContainText(`Are you sure you want to delete the user ${diner.name} (${diner.email})?`);
    await expectRequest(page, 'DELETE', `/api/user/${diner.id}`, () => page.getByRole('button', { name: 'Delete' }).click());

    await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
    await expect(usersTable.getByRole('row').filter({ hasText: diner.email })).not.toBeVisible();
    await expect(usersTable.getByRole('row').filter({ hasText: users.franchisee.email })).toBeVisible();
    await expect(usersTable.locator('tbody tr')).toHaveCount(Object.keys(users).length - 1);
  });

  test('cancel deleting a user', async ({ page }) => {
    const { diner } = users;
    let deleteRequested = false;
    page.on('request', (req) => {
      if (req.method() === 'DELETE' && new URL(req.url()).pathname.startsWith('/api/user/')) deleteRequested = true;
    });
    await openAdminDashboard(page);
    await page.getByRole('row').filter({ hasText: diner.email }).getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Delete user')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: diner.email })).toBeVisible();
    expect(deleteRequested).toBe(false);
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
    const franchisesTable = franchisesTableOf(page);

    await expect(page.getByRole('cell', { name: franchises.lotaPizza.name })).toBeVisible();
    await expect(franchisesTable.getByRole('button', { name: '«' })).toBeDisabled();
    await franchisesTable.getByRole('button', { name: '»' }).click();

    await expect(page.getByRole('cell', { name: 'SliceSquad' })).toBeVisible();
    await expect(page.getByRole('cell', { name: franchises.lotaPizza.name })).not.toBeVisible();
    await expect(franchisesTable.getByRole('button', { name: '»' })).toBeDisabled();
    await franchisesTable.getByRole('button', { name: '«' }).click();

    await expect(page.getByRole('cell', { name: franchises.lotaPizza.name })).toBeVisible();
  });

  test('filter users', async ({ page }) => {
    await openAdminDashboard(page);
    const usersTable = usersTableOf(page);
    await expect(usersTable.locator('tbody tr')).toHaveCount(Object.keys(users).length);

    await usersTable.getByPlaceholder('Filter users').fill('kai');
    const request = await expectRequest(page, 'GET', '/api/user', () => usersTable.getByRole('button', { name: 'Submit' }).click());
    expect(new URL(request.url()).searchParams.get('name')).toBe('*kai*');
    expect(new URL(request.url()).searchParams.get('page')).toBe('0');

    await expect(usersTable.locator('tbody tr')).toHaveCount(1);
    await expect(usersTable.getByRole('cell', { name: users.diner.email })).toBeVisible();
    await expect(usersTable.getByRole('cell', { name: users.admin.email })).not.toBeVisible();

    // An empty filter shows everyone again
    await usersTable.getByPlaceholder('Filter users').fill('');
    await usersTable.getByRole('button', { name: 'Submit' }).click();
    await expect(usersTable.locator('tbody tr')).toHaveCount(Object.keys(users).length);
  });

  test('page through users', async ({ page }) => {
    // Replace the user list mock with one that has two pages
    await page.route(/\/api\/user(\?.*)?$/, async (route) => {
      const firstPage = new URL(route.request().url()).searchParams.get('page') === '0';
      const userRes = firstPage
        ? { users: [users.admin, users.diner], more: true }
        : { users: [{ id: '6', name: 'Page Two', email: 'p2@jwt.com', roles: [{ role: 'diner' }] }], more: false };
      await route.fulfill({ json: userRes });
    });
    await openAdminDashboard(page);
    const usersTable = usersTableOf(page);

    await expect(usersTable.getByRole('cell', { name: users.diner.email })).toBeVisible();
    await expect(usersTable.getByRole('button', { name: '«' })).toBeDisabled();
    const request = await expectRequest(page, 'GET', '/api/user', () => usersTable.getByRole('button', { name: '»' }).click());
    expect(new URL(request.url()).searchParams.get('page')).toBe('1');

    await expect(usersTable.getByRole('cell', { name: 'p2@jwt.com' })).toBeVisible();
    await expect(usersTable.getByRole('cell', { name: users.diner.email })).not.toBeVisible();
    await expect(usersTable.getByRole('button', { name: '»' })).toBeDisabled();
    await usersTable.getByRole('button', { name: '«' }).click();

    await expect(usersTable.getByRole('cell', { name: users.diner.email })).toBeVisible();
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
