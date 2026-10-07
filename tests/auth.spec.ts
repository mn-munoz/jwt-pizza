import { test, expect } from './testSetup';
import { basicInit, users } from './mocks';
import { expectRequest, fillLoginForm, fillRegisterForm, login } from './helpers';

test.describe('login', () => {
  test.beforeEach(async ({ page }) => {
    await basicInit(page);
  });

  test('login', async ({ page }) => {
    await page.getByRole('link', { name: 'Login' }).click();
    await fillLoginForm(page, users.diner);

    await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
  });

  test('login with wrong password', async ({ page }) => {
    await page.getByRole('link', { name: 'Login' }).click();
    await fillLoginForm(page, { ...users.diner, password: 'wrong' });

    await expect(page.getByRole('main')).toContainText('"code":401');
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByRole('link', { name: 'KC' })).not.toBeVisible();
  });

  test('logout', async ({ page }) => {
    await login(page, users.diner);

    await expectRequest(page, 'DELETE', '/api/auth', () => page.getByRole('link', { name: 'Logout' }).click());

    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'KC' })).not.toBeVisible();
    await expect(page.getByText("The web's best pizza", { exact: true })).toBeVisible();
  });
});

test.describe('register', () => {
  test.beforeEach(async ({ page }) => {
    await basicInit(page);
  });

  test('register', async ({ page }) => {
    const newUser = { name: 'Pat Doe', email: 'pat@jwt.com', password: 'secret' };

    const request = await expectRequest(page, 'POST', '/api/auth', () => fillRegisterForm(page, newUser));

    expect(request.postDataJSON()).toMatchObject(newUser);
    await expect(page.getByRole('link', { name: 'PD' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).not.toBeVisible();
  });

  test('register with existing email', async ({ page }) => {
    await fillRegisterForm(page, users.diner);

    await expect(page.getByRole('main')).toContainText('user already exists');
    await expect(page.getByText('Welcome to the party')).toBeVisible();
  });

  test('register with a single name', async ({ page }) => {
    await fillRegisterForm(page, { name: 'Cher', email: 'cher@jwt.com', password: 'believe' });

    await expect(page.getByRole('link', { name: 'C', exact: true })).toBeVisible();
  });
});
