import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (T-05): the app in a real browser, every API call answered
 * from fixtures (e2e/support/api.ts), at a desktop and a phone size, with
 * an accessibility check on each page.
 *
 * They drive the Chrome installed on the machine (`channel: 'chrome'`) rather
 * than a browser Playwright downloads: GitHub's Ubuntu runners have Chrome,
 * and nobody's machine has to fetch another one.
 */
const PORT = 4300;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } },
    },
    {
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        // Pixel 7 is a Chromium device; the installed Chrome stands in for it.
        channel: 'chrome',
      },
    },
  ],
  webServer: {
    // The development build: the KPI feature is on there, and its API address
    // is the one e2e/support/api.ts intercepts. Built once and served as
    // files, so a test never meets a dev server mid-rebuild.
    command:
      'npx ng build --configuration development --output-path dist/e2e && ' +
      `node e2e/support/serve.mjs dist/e2e/browser ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 300_000,
  },
});
