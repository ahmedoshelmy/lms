import { expectAccessible } from './support/a11y';
import { mockApi } from './support/api';
import { FIXTURES } from './support/fixtures';
import { RoleName, USERS, expectSettled, hoursAgo, localMonth, signIn } from './support/session';
import { expect, test } from './support/test';

/** Every page each role uses most, with its own title. */
const PAGES: { role: RoleName; path: string; title: string }[] = [
  { role: 'Admin', path: '/dashboard', title: 'Overview' },
  { role: 'Admin', path: '/schedule', title: 'Schedule' },
  { role: 'Admin', path: '/courses', title: 'Courses' },
  { role: 'Admin', path: '/attendance', title: 'Sessions' },
  { role: 'Admin', path: '/groups', title: 'Groups' },
  { role: 'Admin', path: '/groups/3', title: 'Group' },
  { role: 'Admin', path: '/students', title: 'Students' },
  { role: 'Admin', path: '/instructors', title: 'Instructors' },
  { role: 'Admin', path: '/evaluations', title: 'Monthly Reports' },
  { role: 'Admin', path: '/instructor-kpis', title: 'Instructor KPIs' },
  { role: 'Admin', path: '/sales', title: 'Sales' },
  { role: 'Admin', path: '/sessions/7', title: 'Session' },
  { role: 'Instructor', path: '/dashboard', title: 'Overview' },
  { role: 'Instructor', path: '/sessions/7', title: 'Session' },
  { role: 'Instructor', path: '/my-kpis', title: 'My KPIs' },
];

/**
 * Answers that depend on today, worked out when each test runs: the month the
 * KPI page asks for, and a class two hours ago (inside the register's window,
 * whatever the date), taught by the instructor who signs in.
 */
function todaysAnswers() {
  const month = localMonth();
  const session = FIXTURES['GET /Schedule/sessions/7'] as Record<string, unknown>;
  return {
    [`GET /kpis/months/${month}`]: {
      month,
      status: 'Open',
      settings: {
        weights: { reports: 40, registers: 40, cancellations: 20 },
        bands: { excellent: 90, good: 75 },
        ownerEmail: null,
      },
      events: [],
      instructors: [],
    },
    'GET /kpis/me': [],
    'GET /Schedule/sessions/7': {
      ...session,
      instructorId: USERS.Instructor.id,
      startsAt: hoursAgo(2),
      endsAt: hoursAgo(0.5),
    },
  };
}

for (const theme of ['light', 'dark'] as const) {
  for (const { role, path, title } of PAGES) {
    test(`${role} ${path} (${theme}): named, loads, and passes axe`, async ({ page }, info) => {
      // Dark mode is checked once, at the desktop size.
      test.skip(theme === 'dark' && info.project.name !== 'desktop', 'Dark is checked on desktop');
      await signIn(page, role, theme);
      await mockApi(page, todaysAnswers());

      await page.goto(path);

      await expect(page).toHaveTitle(`${title} · Mindvalley`);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expectSettled(page);
      await expectAccessible(page);
    });
  }
}
