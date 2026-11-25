import { Page } from '@playwright/test';
import { expect } from './test';

export const ROLES = { Student: 1, Instructor: 2, Admin: 3, Sales: 4 } as const;
export type RoleName = keyof typeof ROLES;

/** The user each role signs in as; the instructor teaches the fixtures' classes. */
export const USERS = {
  Admin: { id: 1, name: 'Audit Admin' },
  Instructor: { id: 3, name: 'Mona Adel' },
  Student: { id: 20, name: 'Sara Ahmed' },
  Sales: { id: 5, name: 'Nadia Sales' },
} as const;

/** Signed in before the app starts, as a returning user is: the stored session. */
export async function signIn(
  page: Page,
  role: RoleName = 'Admin',
  theme: 'light' | 'dark' = 'light'
): Promise<void> {
  const user = {
    ...USERS[role],
    email: 'e2e@example.test',
    role: ROLES[role],
    accessToken: 'e2e-token',
  };
  await page.addInitScript(
    ([stored, chosen]) => {
      localStorage.setItem('auth_user', stored);
      localStorage.setItem('lms_theme', chosen);
    },
    [JSON.stringify(user), theme]
  );
}

/**
 * The page has finished loading: no request in flight, and no error toast.
 * Waiting for one word ("Loading") let pages with other spinners through.
 */
export async function expectSettled(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.p-toast-message-error')).toHaveCount(0);
}

/** The local month, YYYY-MM, as the app works it out (not UTC's). */
export function localMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** A time `hours` before now, as the API writes it. */
export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}
