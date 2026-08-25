import { isDevMode } from '@angular/core';
import { Role, parseRole } from '../interfaces/Role';
import { MenuItem } from '../interfaces/MenuItem';

/** Literally every role. A route using this is reachable by anyone signed in. */
export const ALL_ROLES: Role[] = [Role.Admin, Role.Instructor, Role.Student, Role.Sales];

/** Everyone who runs the schedule. */
export const OPERATIONS_ROLES: Role[] = [Role.Admin, Role.Instructor];

/** Sales proposes, operations disposes — both need the slot and hold screens. */
export const SALES_ROLES: Role[] = [Role.Admin, Role.Sales];

/**
 * Everyone whose own week the schedule can show.
 *
 * Sales is not among them, and never was: the query behind the board returns
 * an admin everything, an instructor their own sessions and a student theirs,
 * and falls through to nothing for anybody else. A salesperson opening it saw
 * an empty week. What they actually need — which hours are free — is the slot
 * finder on their own page, which answers it and says why an hour is blocked.
 */
export const SCHEDULE_ROLES: Role[] = [Role.Admin, Role.Instructor, Role.Student];

export interface RoutePermission {
  path: string;
  label: string;
  icon: string;
  roles: Role[];
  showInMenu: boolean;
  /** Shown only in a development build. */
  devOnly?: boolean;
}

export const ROUTE_PERMISSIONS: RoutePermission[] = [
  {
    path: 'dashboard',
    label: 'Overview',
    icon: 'pi pi-th-large',
    roles: ALL_ROLES,
    showInMenu: true,
  },
  {
    path: 'sessions',
    label: 'Session Detail',
    icon: 'pi pi-calendar',
    roles: [Role.Admin, Role.Instructor, Role.Student],
    showInMenu: false,
  },
  {
    path: 'schedule',
    label: 'Schedule',
    icon: 'pi pi-calendar-clock',
    roles: SCHEDULE_ROLES,
    showInMenu: true,
  },
  {
    path: 'courses',
    label: 'Courses',
    icon: 'pi pi-book',
    roles: ALL_ROLES,
    showInMenu: true,
  },
  {
    path: 'attendance',
    label: 'Sessions',
    icon: 'pi pi-calendar',
    roles: [Role.Admin, Role.Instructor],
    showInMenu: true,
  },
  {
    path: 'groups',
    label: 'Groups',
    icon: 'pi pi-sitemap',
    roles: OPERATIONS_ROLES,
    showInMenu: true,
  },
  {
    path: 'students',
    label: 'Students',
    icon: 'pi pi-graduation-cap',
    roles: [Role.Admin],
    showInMenu: true,
  },
  {
    path: 'my-learning',
    label: 'My Learning',
    icon: 'pi pi-graduation-cap',
    // A student's own record. Admin keeps it so the page can be checked
    // without borrowing somebody's login.
    roles: [Role.Student, Role.Admin],
    showInMenu: true,
  },
  {
    path: 'instructors',
    label: 'Instructors',
    icon: 'pi pi-user',
    roles: [Role.Admin],
    showInMenu: true,
  },
  {
    path: 'history',
    label: 'History & Events',
    icon: 'pi pi-history',
    roles: [Role.Admin, Role.Instructor],
    showInMenu: true,
  },
  {
    path: 'sales',
    label: 'Sales',
    icon: 'pi pi-briefcase',
    roles: SALES_ROLES,
    showInMenu: true,
  },
  {
    path: 'availability',
    label: 'Availability',
    icon: 'pi pi-clock',
    // Operations edits it, instructors ask about their own, sales reads it to
    // find a slot. Students have no business here.
    roles: [Role.Admin, Role.Instructor, Role.Sales],
    showInMenu: true,
  },
  {
    path: 'session-summaries',
    label: 'Session Summaries',
    icon: 'pi pi-comments',
    // The whole curriculum, every course and level. Staff and sales browse it
    // to see what is taught; a student wants their own classes, which is what
    // My Learning shows, not all 244 sessions of courses they are not on.
    roles: [Role.Admin, Role.Instructor, Role.Sales],
    showInMenu: true,
  },
  {
    path: 'activity-logs',
    label: 'Activity Analytics',
    icon: 'pi pi-chart-line',
    roles: [Role.Admin],
    showInMenu: true,
  },
  {
    path: 'profile',
    label: 'Profile',
    icon: 'pi pi-user',
    roles: ALL_ROLES,
    showInMenu: false,
  },
  {
    path: 'settings',
    label: 'Settings',
    icon: 'pi pi-cog',
    // Nothing here is organisation data: the API endpoint, the connection
    // check and the version are all per-browser. Keeping it admin-only meant
    // anyone else testing against a different server was stuck.
    roles: ALL_ROLES,
    showInMenu: true,
    // Kept out of the menu in a production build. It points the browser at a
    // different server, which is what you want while developing and a way to
    // break your own login otherwise. The route still answers, so anybody
    // talked through it by hand can still get there.
    devOnly: true,
  },
];

export function getRolesForPath(path: string): Role[] {
  return ROUTE_PERMISSIONS.find((route) => route.path === path)?.roles ?? [];
}

export function getMenuItemsForRole(rawRole: Role | unknown): MenuItem[] {
  const role = parseRole(rawRole);
  // isDevMode is read here rather than where the routes are declared, so it is
  // answered when the menu is built rather than whenever this file first loads.
  const showing = isDevMode();

  return ROUTE_PERMISSIONS.filter(
    (route) =>
      route.showInMenu &&
      (showing || !route.devOnly) &&
      route.roles.some((r) => parseRole(r) === role)
  ).map(({ label, icon, roles, path }) => ({
    label,
    icon,
    route: `/${path}`,
    roles,
  }));
}
