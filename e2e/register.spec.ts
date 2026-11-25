import { expect, test } from '@playwright/test';
import { mockApi } from './support/api';
import { FIXTURES } from './support/fixtures';
import { failOnPageErrors, signIn } from './support/session';

/** The fixture's class, two hours ago, with nobody marked: inside the 24-hour window. */
function classJustTaught() {
  const base = FIXTURES['GET /Schedule/sessions/7'] as {
    attendances: { studentId: number; studentName: string }[];
  };
  const start = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return {
    ...base,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 90 * 60 * 1000).toISOString(),
    attendances: base.attendances.map((a) => ({ ...a, status: null })),
  };
}

test('an instructor takes the register and it reaches the server whole', async ({ page }) => {
  failOnPageErrors(page);
  await signIn(page, 'Instructor');
  const session = classJustTaught();
  const requests = await mockApi(page, {
    'GET /Schedule/sessions/7': session,
    'POST /Attendance/session/7': {},
  });
  await page.goto('/sessions/7');

  const save = page.getByRole('button', { name: 'Save Attendance' });
  const [first, ...rest] = session.attendances;
  await page.getByRole('button', { name: `Mark ${first.studentName} absent` }).click();
  // Not everyone yet: saving waits.
  await expect(save).toBeDisabled();
  for (const student of rest) {
    await page.getByRole('button', { name: `Mark ${student.studentName} present` }).click();
  }
  await save.click();

  await expect(page.getByText('Attendance saved')).toBeVisible();
  const sent = requests.find((r) => r.method() === 'POST')!;
  const body = sent.postDataJSON() as { studentId: number; status: number }[];
  expect(body).toHaveLength(session.attendances.length);
  expect(body[0]).toMatchObject({ studentId: first.studentId, status: 2 });
  expect(body.slice(1).every((r) => r.status === 1)).toBe(true);
});
