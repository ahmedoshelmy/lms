import { expect, test } from '@playwright/test';
import { expectAccessible } from './support/a11y';
import { mockApi } from './support/api';
import { ROLES, failOnPageErrors } from './support/session';

test.describe('Signing in', () => {
  test.beforeEach(({ page }) => failOnPageErrors(page));

  test('the page passes axe', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await expect(page).toHaveTitle('Sign in · Mindvalley');
    await expectAccessible(page);
  });

  test('a correct sign-in lands on the overview', async ({ page }) => {
    const requests = await mockApi(page, {
      'POST /auth/login': {
        id: 1,
        name: 'Audit Admin',
        email: 'admin@example.test',
        role: ROLES.Admin,
        accessToken: 'e2e-token',
      },
    });
    await page.goto('/login');

    await page.getByLabel('Email').fill('admin@example.test');
    await page.getByLabel('Password').fill('a-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    const login = requests.find((r) => r.url().endsWith('/auth/login'))!;
    expect(login.postDataJSON()).toEqual({ email: 'admin@example.test', password: 'a-password' });
  });

  test('a refused sign-in is read out, and the fields say what is wrong', async ({ page }) => {
    await mockApi(page);
    await page.route('**/auth/login', (route) =>
      route.fulfill({ status: 401, json: { message: 'Wrong email or password.' } })
    );
    await page.goto('/login');

    // Nothing typed: the focus goes to the first field to fix.
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByLabel('Email')).toBeFocused();
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Email').fill('admin@example.test');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Wrong email or password.' })
    ).toBeVisible();
  });
});
