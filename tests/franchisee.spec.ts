import { test, expect } from './testSetup';
import { basicInit, franchises, stores, users } from './mocks';
import { clickCloseOnRow, expectRequest, login, openFranchiseDashboard } from './helpers';

test.describe('franchise dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await basicInit(page);
    await login(page, users.franchisee);
    await openFranchiseDashboard(page);
    await expect(page.getByText(franchises.lotaPizza.name)).toBeVisible();
  });

  test('create store', async ({ page }) => {
    await page.getByRole('button', { name: 'Create store' }).click();

    await expect(page.getByText('Create store')).toBeVisible();
    await page.getByPlaceholder('store name').fill('Provo');
    const request = await expectRequest(page, 'POST', `/api/franchise/${franchises.lotaPizza.id}/store`, () => page.getByRole('button', { name: 'Create' }).click());

    expect(request.postDataJSON()).toMatchObject({ name: 'Provo' });
    await expect(page.getByRole('cell', { name: 'Provo' })).toBeVisible();
    await expect(page.getByRole('cell', { name: stores.lehi.name })).toBeVisible();
  });

  test('franchisee closes a store', async ({ page }) => {
    const { lotaPizza } = franchises;
    const { lehi, springville } = stores;
    await clickCloseOnRow(page, springville.name);

    await expect(page.getByRole('main')).toContainText(`Are you sure you want to close the ${lotaPizza.name} store ${springville.name} ?`);
    await expectRequest(page, 'DELETE', `/api/franchise/${lotaPizza.id}/store/${springville.id}`, () => page.getByRole('button', { name: 'Close' }).click());

    await expect(page.getByRole('cell', { name: lehi.name })).toBeVisible();
    await expect(page.getByRole('cell', { name: springville.name })).not.toBeVisible();
  });
});

test('franchise page when not a franchisee', async ({ page }) => {
  await basicInit(page);
  await openFranchiseDashboard(page);

  await expect(page.getByText('So you want a piece of the pie?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create store' })).not.toBeVisible();
});
