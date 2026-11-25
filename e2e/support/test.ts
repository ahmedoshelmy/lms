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
      // The served build carries the production Content-Security-Policy: a
      // script, style, font or request it refuses fails the test.
      const refused: string[] = [];
      page.on('console', (message) => {
        if (message.text().includes('Content Security Policy')) refused.push(message.text());
      });

      await use();

      expect(errors, 'uncaught errors in the page').toEqual([]);
      expect(refused, 'refused by the Content-Security-Policy').toEqual([]);
      expect(unanswered.get(page) ?? [], 'API calls with no fixture').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
