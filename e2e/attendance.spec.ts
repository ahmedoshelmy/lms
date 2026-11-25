import { Request } from '@playwright/test';
import { expectAccessible } from './support/a11y';
import { mockApi } from './support/api';
import { expectSettled, signIn } from './support/session';
import { expect, test } from './support/test';

/** The `from` and `to` of every timetable request, as dates. */
function scheduleRanges(requests: Request[]): { from: Date; to: Date }[] {
  return requests
    .map((r) => new URL(r.url()))
    .filter((u) => u.pathname.endsWith('/schedule'))
    .map((u) => ({
      from: new Date(u.searchParams.get('from') ?? NaN),
      to: new Date(u.searchParams.get('to') ?? NaN),
    }));
}

test('the Sessions page asks for a week or a month, never for every class there has been', async ({
  page,
}) => {
  await signIn(page, 'Admin');
  const requests = await mockApi(page);
  await page.goto('/attendance');
  await expectSettled(page);

  // On a phone the filters are folded away until asked for.
  const filters = page.getByRole('button', { name: 'Filters and sorting' });
  if (await filters.isVisible()) await filters.click();

  // Opens on this school week: a bounded request, at most a week long.
  const [week] = scheduleRanges(requests);
  expect(week, 'the timetable was asked for').toBeDefined();
  expect(Number.isNaN(week.from.getTime()) || Number.isNaN(week.to.getTime())).toBe(false);
  expect(week.to.getTime() - week.from.getTime()).toBeLessThanOrEqual(8 * 24 * 3600_000);
  await expect(page.getByRole('button', { name: 'This week' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  // Month, then a month back: the stepper names it and asks for just that month.
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expectSettled(page);

  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const label = previous.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  await expect(page.getByText(label, { exact: true })).toBeVisible();

  const last = scheduleRanges(requests).at(-1)!;
  expect(last.from.getTime()).toBe(previous.getTime());
  expect(last.to.getTime()).toBe(new Date(now.getFullYear(), now.getMonth(), 1).getTime());

  await expectAccessible(page);
});
