import { test, expect } from './testSetup';
import { basicInit } from './mocks';
import { expectRequest, fillLoginForm, fillRegisterForm } from './helpers';

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

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza dinerx');

  // The change is kept after logging out and back in
  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();
  await fillLoginForm(page, newUser);

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});
