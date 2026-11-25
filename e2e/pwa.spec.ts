import { mockApi } from './support/api';
import { expect, test } from './support/test';

test.describe('The installable app', () => {
  test('links a valid manifest, and every icon in it loads', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');

    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await page.request.get(`/${href}`)).json();
    expect(manifest).toMatchObject({
      name: 'Mindvalley Management',
      short_name: 'Mindvalley',
      start_url: '/',
      display: 'standalone',
    });
    // Installable: a 192 and a 512, and one the platform may crop to its own shape.
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      const response = await page.request.get(`/${icon.src}`);
      expect(response.status(), icon.src).toBe(200);
    }
  });

  test('says so when the connection goes, and when it comes back', async ({ page, context }) => {
    await mockApi(page);
    await page.goto('/login');
    const notice = page.getByText("You're offline");

    await context.setOffline(true);
    await expect(notice).toBeVisible();
    await context.setOffline(false);
    await expect(notice).toHaveCount(0);
  });
});
