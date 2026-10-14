import { test, expect } from './testSetup';
import { basicInit, users } from './mocks';
import { expectRequest, fillLoginForm, fillRegisterForm, login } from './helpers';

test('updateUser', async ({ page }) => {
  const newUser = { name: 'pizza diner', email: 'pd@jwt.com', password: 'diner' };
  await basicInit(page);
  await fillRegisterForm(page, newUser);

  await page.getByRole('link', { name: 'pd' }).click();

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('textbox').first().fill('pizza dinerx');
  const request = await expectRequest(page, 'PUT', '/api/user/5', () => page.getByRole('button', { name: 'Update' }).click());
  expect(request.postDataJSON()).toMatchObject({ name: 'pizza dinerx', email: newUser.email });

  await expect(page.getByRole('dialog')).not.toBeVisible();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');

  // The change is kept after logging out and back in
  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();
  await fillLoginForm(page, newUser);

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});

test('close the edit dialog without saving', async ({ page }) => {
  let updateRequested = false;
  page.on('request', (req) => {
    if (req.method() === 'PUT' && new URL(req.url()).pathname.startsWith('/api/user/')) updateRequested = true;
  });
  await basicInit(page);
  await login(page, users.diner);
  await page.getByRole('link', { name: users.diner.initials }).click();

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('textbox').first().fill('not saved');
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('main')).toContainText(users.diner.name);
  expect(updateRequested).toBe(false);
});
