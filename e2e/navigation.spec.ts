import { mockApi } from './support/api';
import { expectSettled, signIn } from './support/session';
import { expect, test } from './support/test';

test.beforeEach(async ({ page }) => {
  await signIn(page, 'Admin');
  await mockApi(page);
});

test('the skip link is the first stop, and goes past the navigation', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'A keyboard check');
  await page.goto('/groups');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('on a phone, the menu is a drawer that closes onto the chosen page', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phone', 'The drawer is the phone layout');
  await page.goto('/dashboard');

  const open = page.getByRole('button', { name: 'Open navigation menu' });
  await open.click();
  await expect(open).toHaveAttribute('aria-expanded', 'true');

  await page.getByRole('link', { name: 'Groups' }).first().click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(open).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('main')).toBeFocused();
});

for (const path of ['/dashboard', '/groups', '/students', '/sessions/7', '/schedule']) {
  test(`${path} does not scroll sideways`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'A phone-width check');
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectSettled(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
