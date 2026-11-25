import { readFileSync } from 'node:fs';
import { expect, test } from './support/test';

/** Files, not pages: checked once, at the desktop size. */
const once = () =>
  test.skip(test.info().project.name !== 'desktop', 'Checked once, on the desktop project');

/** The headers nginx sends (nginx-security-headers.conf). */
function nginxHeaders(): Record<string, string> {
  const text = readFileSync('nginx-security-headers.conf', 'utf8');
  return Object.fromEntries(
    [...text.matchAll(/^add_header\s+(\S+)\s+"([^"]*)"/gm)].map(([, name, value]) => [name, value])
  );
}

test.describe('Deployment configuration', () => {
  test('Vercel sends the same security headers as nginx', () => {
    once();
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      routes: { src?: string; headers?: Record<string, string> }[];
    };
    const everyRoute = vercel.routes.find((r) => r.src === '/.*' && r.headers?.['X-Frame-Options']);

    expect(everyRoute?.headers).toEqual(nginxHeaders());
  });

  test('the policy lets the app reach its API, and nothing else off-site', () => {
    once();
    const csp = nginxHeaders()['Content-Security-Policy'];
    const environment = readFileSync('src/environments/environment.ts', 'utf8');
    const api = new URL(/apiUrl:\s*'([^']+)'/.exec(environment)![1]).origin;

    expect(csp).toContain(`connect-src 'self' ${api}`);
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test('the production build keeps inline script out of index.html', () => {
    once();
    // The end-to-end tests use the development build, which never inlines
    // critical CSS; this is the check that production does not either. Its
    // loader is an inline onload handler, which the policy refuses.
    const angular = JSON.parse(readFileSync('angular.json', 'utf8'));
    const production = angular.projects['lms-platform'].architect.build.configurations.production;
    expect(production.optimization.styles.inlineCritical).toBe(false);
  });

  test('pages are served under the policy', async ({ page }) => {
    once();
    const response = await page.request.get('/login');
    expect(response.headers()['content-security-policy']).toBe(
      nginxHeaders()['Content-Security-Policy']
    );
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  });
});
