import { Page, expect } from '@playwright/test';

export const ROLES = { Student: 1, Instructor: 2, Admin: 3, Sales: 4 } as const;
export type RoleName = keyof typeof ROLES;

/** Signed in before the app starts, as a returning user is: the stored session. */
export async function signIn(page: Page, role: RoleName = 'Admin'): Promise<void> {
  const user = {
    id: role === 'Instructor' ? 3 : 1,
    name: role === 'Instructor' ? 'Mona Adel' : 'Audit Admin',
    email: 'e2e@example.test',
    role: ROLES[role],
    accessToken: 'e2e-token',
  };
  await page.addInitScript((stored) => {
    localStorage.setItem('auth_user', stored);
    localStorage.setItem('lms_theme', 'light');
  }, JSON.stringify(user));
}

/** Fails the test on any uncaught error in the page. */
export function failOnPageErrors(page: Page): void {
  page.on('pageerror', (error) => {
    throw new Error(`Uncaught in the page: ${error.message}`);
  });
}

/** The page's own heading is on screen: loaded, not still spinning. */
export async function expectHeading(page: Page, name: string | RegExp): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}
