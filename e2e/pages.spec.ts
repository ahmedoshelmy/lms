import { expect, test } from '@playwright/test';
import { expectAccessible } from './support/a11y';
import { mockApi } from './support/api';
import { RoleName, failOnPageErrors, signIn } from './support/session';

/** The current month as the KPI page asks for it: the local one, not UTC's. */
const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const kpiMonth = {
  month: thisMonth,
  status: 'Open',
  settings: {
    weights: { reports: 40, registers: 40, cancellations: 20 },
    bands: { excellent: 90, good: 75 },
    ownerEmail: null,
  },
  events: [],
  instructors: [],
};

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
  { role: 'Instructor', path: '/my-kpis', title: 'My KPIs' },
];

for (const { role, path, title } of PAGES) {
  test(`${role} ${path}: named, loads, and passes axe`, async ({ page }) => {
    failOnPageErrors(page);
    await signIn(page, role);
    await mockApi(page, { [`GET /kpis/months/${thisMonth}`]: kpiMonth, 'GET /kpis/me': [] });

    await page.goto(path);

    await expect(page).toHaveTitle(`${title} · Mindvalley`);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    // Not still loading when it is checked.
    await expect(page.getByText(/Loading/)).toHaveCount(0);
    await expectAccessible(page);
  });
}
