import { Page, Request } from '@playwright/test';
import { expect } from './testSetup';
import { TestUser } from './mocks';

// Fills in whichever login form is on screen (the login page or the one shown at checkout)
export async function fillLoginForm(page: Page, user: { email: string; password: string }) {
  await page.getByRole('textbox', { name: 'Email address' }).fill(user.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
  await page.getByRole('button', { name: 'Login' }).click();
}

export async function login(page: Page, user: TestUser) {
  await page.getByRole('link', { name: 'Login' }).click();
  await fillLoginForm(page, user);
  await expect(page.getByRole('link', { name: user.initials, exact: true })).toBeVisible();
}

export async function fillRegisterForm(page: Page, user: { name: string; email: string; password: string }) {
  await page.getByRole('link', { name: 'Register' }).click();
  // The register page labels don't match their inputs, so use the placeholders
  await page.getByPlaceholder('Full name').fill(user.name);
  await page.getByPlaceholder('Email address').fill(user.email);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: 'Register' }).click();
}

export async function openAdminDashboard(page: Page) {
  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
}

export async function openFranchiseDashboard(page: Page) {
  // The link is in both the header and the footer
  await page.getByRole('link', { name: 'Franchise', exact: true }).first().click();
}

// Clicks the Close button on the table row that contains the given text
export async function clickCloseOnRow(page: Page, rowText: string) {
  await page.getByRole('row').filter({ hasText: rowText }).getByRole('button', { name: 'Close' }).click();
}

// Runs the action and returns the request it sent to the given method and path
export async function expectRequest(page: Page, method: string, path: string, action: () => Promise<void>): Promise<Request> {
  const request = page.waitForRequest((req) => req.method() === method && new URL(req.url()).pathname === path);
  await action();
  return request;
}
