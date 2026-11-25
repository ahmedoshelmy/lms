import { mockApi } from './support/api';
import { FIXTURES } from './support/fixtures';
import { USERS, hoursAgo, signIn } from './support/session';
import { expect, test } from './support/test';

/**
 * The fixture's class, two hours ago and taught by the instructor who signs
 * in, with nobody marked: their own register, inside the 24-hour window.
 */
function classJustTaught() {
  const base = FIXTURES['GET /Schedule/sessions/7'] as {
    attendances: { studentId: number; studentName: string }[];
  };
  return {
    ...base,
    instructorId: USERS.Instructor.id,
    startsAt: hoursAgo(2),
    endsAt: hoursAgo(0.5),
    attendances: base.attendances.map((a) => ({ ...a, status: null })),
  };
}

test('an instructor takes the register and it reaches the server whole', async ({ page }) => {
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
