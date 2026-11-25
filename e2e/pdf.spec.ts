import { mockApi } from './support/api';
import { expectSettled, localMonth, signIn } from './support/session';
import { expect, test } from './support/test';

/**
 * A PDF made in the browser, under the production Content-Security-Policy:
 * jsPDF is loaded on demand and draws without eval, or the test fails on the
 * refusal (support/test.ts).
 */
test('the KPI report downloads as a PDF under the security policy', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'Once is enough');
  const month = localMonth();
  const indicator = (value: number, detail: object) => ({
    calculated: value,
    override: null,
    value,
    detail,
  });
  await signIn(page, 'Admin');
  await mockApi(page, {
    [`GET /kpis/months/${month}`]: {
      month,
      status: 'Open',
      settings: {
        weights: { reports: 40, registers: 40, cancellations: 20 },
        bands: { excellent: 90, good: 75 },
        ownerEmail: null,
      },
      events: [],
      instructors: [
        {
          instructorId: 3,
          instructorName: 'Mona Adel',
          month,
          reports: indicator(90, { due: 10, onTime: 9, late: 1, missing: 0 }),
          registers: indicator(95, {
            taught: 20,
            onTime: 19,
            late: 1,
            recordedByAdmin: 0,
            never: 0,
          }),
          cancellations: indicator(100, { assigned: 20, cancelledByThem: 0 }),
          overall: 94,
          band: 'Excellent',
        },
      ],
    },
  });
  await page.goto('/instructor-kpis');
  await expectSettled(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /PDF, everyone/ }).click(),
  ]);

  expect(download.suggestedFilename()).toBe(`KPI-all-instructors-${month}.pdf`);
  const file = await download.path();
  expect(file).toBeTruthy();
});
