import { expect, test as base } from '@playwright/test';
import { unanswered } from './api';

/**
 * Playwright's test, with two checks after every test:
 *
 * - no uncaught error in the page;
 * - no API call that no fixture answered. Such a call is a 404, the page shows
 *   an error toast and carries on, and the test would otherwise pass while
 *   checking a page that half failed to load.
 *
 * A test that means to fail a request answers it itself with page.route.
 */
export const test = base.extend<{ pageChecks: void }>({
  pageChecks: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await use();

      expect(errors, 'uncaught errors in the page').toEqual([]);
      expect(unanswered.get(page) ?? [], 'API calls with no fixture').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
