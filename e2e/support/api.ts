import { Page, Request } from '@playwright/test';
import { FIXTURES } from './fixtures';

/** Where the development build sends its requests (src/environments/environment.development.ts). */
export const API = 'https://mv-api.inite.tech/api';

export type Answers = Record<string, unknown>;

/** Calls each page made that no fixture answered; checked after every test (support/test.ts). */
export const unanswered = new WeakMap<Page, string[]>();

/**
 * Answers every API call from fixtures, keyed "GET /groups" (query ignored),
 * and refuses everything else that would leave the machine.
 *
 * An endpoint with no fixture gets a 404 and is recorded: the test then fails
 * (support/test.ts), rather than checking a page that half failed to load.
 *
 * Returns the requests made, for asserting on what was sent.
 */
export async function mockApi(page: Page, overrides: Answers = {}): Promise<Request[]> {
  const answers: Answers = { ...FIXTURES, ...overrides };
  const seen: Request[] = [];
  const missing: string[] = [];
  unanswered.set(page, missing);

  // Registered first, so matched last: anything not on localhost goes nowhere.
  await page.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => route.abort());

  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    seen.push(request);
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const key = `${request.method()} ${path}`;
    if (key in answers) {
      await route.fulfill({ status: 200, json: answers[key] });
    } else {
      missing.push(key);
      await route.fulfill({ status: 404, json: { message: `No fixture for ${key}` } });
    }
  });

  return seen;
}
